import "./css/prabat.css";
import * as DetectRTC from "detectrtc";

import { downloadData } from "./js/downloadData.js";
import { downloadVideo } from "./js/downloadVideo.js";
// Server upload is switched off (see "end of trials" below). To switch it on again,
// uncomment these two imports and the upload block.
// import { uploadData } from "./js/uploadData.js";
// import { uploadVideo } from "./js/uploadVideo.js";
import { pause } from "./js/pause.js";
import { openFullscreen } from "./js/openFullscreen.js";
import { checkForTouchscreen } from "./js/checkForTouchscreen.js";
// DISABLED: randomised item order is not used in the current version of the study.
// import { randomizeNewTrials } from "./js/randomizeNewTrials.js";
import { loadLanguage } from "./js/loadLanguage.js";
import { applyLocalizedAudioPaths } from "./js/applyLocalizedAudioPaths.js";
import { applyLocalizedImagePaths } from "./js/applyLocalizedImagePaths.js";
import { preloadAudios } from "./js/preloadAudios.js";
import { preloadImages } from "./js/preloadImages.js";
import {
  startRecording,
  initMedia,
  isMediaRecorderSupported,
  stopRecording,
} from "./js/mediaRecorderServices.js";
import { buildSpriteForBlock } from "./js/buildSpriteForBlock.js";
import { getSharedAudioContext } from "./js/sharedAudioContext.js";
import { routeNodeToMix } from "./js/recordingAudioMix.js";
import { playAudioWebAudio } from "./js/playAudioWebAudio.js";

const storedChoices = localStorage.getItem("storedChoices");
let studyChoices;
if (storedChoices) {
  studyChoices = JSON.parse(storedChoices);
} else {
  console.error("No data found in local storage");
}
const lang = studyChoices?.lang || "ger"; // fallback: German

function showBlockRestartPrompt(restartFn) {
  const overlay = document.getElementById("audio-unlock-overlay");
  const btn = document.getElementById("audio-unlock-button");
  if (!overlay || !btn) {
    restartFn();
    return;
  }

  overlay.style.display = "flex";
  btn.textContent = "Nochmal abspielen"; // e.g. “Play again”

  btn.onclick = () => {
    overlay.style.display = "none";
    restartFn();
  };
}

// runTransitionBlock function

async function runTransitionBlock(blockName, onFinished) {
  const sprite = blockSprites[blockName];
  if (!sprite) {
    console.warn(`No sprite for block "${blockName}"`);
    if (onFinished) onFinished();
    return;
  }

  const { ctx, audioBuffer, timing } = sprite;

  // --- IMPORTANT for iOS: resume the shared AudioContext here ---
  try {
    if (ctx && ctx.state === "suspended") {
      await ctx.resume();
    }
  } catch (e) {
    console.warn("[TransitionBlock] Could not resume AudioContext:", e);
  }

  // Use a gain node so we can control volume of transition blocks
  const spriteGain = ctx.createGain();
  spriteGain.gain.value = 1;
  spriteGain.connect(ctx.destination);
  // Also feed the transition-block sprite audio into the recording mix,
  // so it's captured clearly in the webcam recording alongside the mic.
  routeNodeToMix(spriteGain);

  const slides = Array.from(document.querySelectorAll(`.trials.transitionSlide.${blockName}`));

  if (!slides.length) {
    console.warn(`No transition slides found for block "${blockName}"`);
    if (onFinished) onFinished();
    return;
  }

  let currentIndex = 0;
  let previousSlide = null;

  // Track current Web Audio playback & timeout so we can stop them cleanly
  let currentSource = null;
  let currentTimeout = null;
  let blockFinished = false;

  function stopCurrentPlayback() {
    // Stop any currently playing sprite segment
    if (currentSource) {
      try {
        currentSource.onended = null; // avoid calling callbacks after stop()
        currentSource.stop();
      } catch (e) {
        console.warn("Error stopping currentSource:", e);
      }
      currentSource = null;
    }

    // Clear the watchdog timeout
    if (currentTimeout) {
      clearTimeout(currentTimeout);
      currentTimeout = null;
    }
  }

  // 🔁 Restart the entire block from the beginning
  function restartBlock() {
    console.warn("Restarting block:", blockName);

    // We are explicitly restarting → this block is "active" again
    blockFinished = false;

    // Stop anything that might still be playing from before
    stopCurrentPlayback();

    if (previousSlide) {
      previousSlide.style.display = "none";
    }

    currentIndex = 0;
    previousSlide = null;
    showSlideAndPlay();
  }

  // Called when audio is blocked or segment never ends
  function handleBlocked() {
    // If the block already finished and we moved on,
    // ignore late "blocked" events (e.g. user left the app)
    if (blockFinished) {
      console.warn("Blocked event after block finished, ignoring:", blockName);
      return;
    }

    console.warn("Audio in block", blockName, "seems blocked; asking to restart");

    // Stop any stray playback before we show the restart overlay
    stopCurrentPlayback();

    showBlockRestartPrompt(restartBlock);
  }

  // helper to play one sprite segment
  function playSegment(label, onEnded) {
    const info = timing[label];
    if (!info) {
      console.warn("No timing info for label:", label);
      if (onEnded) onEnded();
      return;
    }

    // optional: guard against closed context here
    if (!ctx || ctx.state === "closed") {
      console.warn("AudioContext is closed for block", blockName);
      if (onEnded) onEnded();
      return;
    }

    // Before starting a new segment, stop any old one + clear its timer
    stopCurrentPlayback();

    let advanced = false;
    const safeEnd = () => {
      if (advanced) return;
      advanced = true;

      // This segment finished normally → no need for the fallback timeout
      if (currentTimeout) {
        clearTimeout(currentTimeout);
        currentTimeout = null;
      }

      currentSource = null;

      if (onEnded) onEnded();
    };

    try {
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(spriteGain); // 👈 use the ONE gain node we made above
      source.onended = safeEnd;
      source.start(ctx.currentTime, info.start, info.duration);

      currentSource = source;
    } catch (e) {
      console.error("Error starting segment", label, e);
      // We failed to start → treat like a block
      handleBlocked();
      return;
    }

    // Safety net: if onended never fires, treat as blocked
    const fallbackMs = info.duration * 1000 + 500;
    currentTimeout = setTimeout(() => {
      if (!advanced && !blockFinished) {
        console.warn("Sprite segment did not end, restarting block:", label);
        handleBlocked();
      }
    }, fallbackMs);
  }

  function showSlideAndPlay() {
    const slide = slides[currentIndex];

    if (!slide) {
      // end of block
      blockFinished = true;

      // Clean up any active audio / timeouts
      stopCurrentPlayback();

      if (previousSlide) previousSlide.style.display = "none";
      if (onFinished) onFinished();
      return;
    }

    if (previousSlide) {
      previousSlide.style.display = "none";
    }

    slide.style.display = "block";
    previousSlide = slide;

    // Objects can't be clicked during transition slides. Their opacity is left to the
    // HTML/CSS (important for the Discourse Novelty animations).
    const objects = slide.querySelectorAll("img.object");
    objects.forEach((img) => {
      img.style.pointerEvents = "none";
    });

    const prompt = slide.querySelector("audio.prompt");
    if (!prompt) {
      currentIndex++;
      showSlideAndPlay();
      return;
    }

    const file = prompt.src.split("/").pop(); // "DiscNovLook.mp3"
    const label = file.replace(/\.[^.]+$/, ""); // "DiscNovLook"

    if (slide.classList.contains("silent")) {
      const info = timing[label];
      const waitMs = info ? info.duration * 1000 : 500;
      setTimeout(() => {
        currentIndex++;
        showSlideAndPlay();
      }, waitMs);
      return;
    }

    // Normal case: play segment, then advance.
    // If blocked, playSegment will call handleBlocked() instead.
    playSegment(label, () => {
      currentIndex++;
      showSlideAndPlay();
    });
  }

  showSlideAndPlay();
}

const blockSprites = {}; // blockName -> { ctx, audioBuffer, timing }

// ------------------------------------------------------------------
// Global audio unlock helper (for Android / iOS)
// Uses the shared AudioContext once, instead of one per block.
// ------------------------------------------------------------------
function unlockAudio() {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) {
      return;
    }

    // 1. If the context is suspended, resume it
    if (ctx.state === "suspended") {
      ctx.resume().catch((err) => {
        console.warn("Could not resume shared AudioContext:", err);
      });
    }

    // 2. Play a 1-frame silent buffer to "touch" the audio device
    // This is enough to convince mobile browsers that we used audio
    // in response to a user gesture.
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
  } catch (e) {
    console.warn("unlockAudio failed:", e);
  }
}

document.addEventListener("DOMContentLoaded", async function () {
  try {
    await loadLanguage(lang);
    applyLocalizedImagePaths(lang);
    applyLocalizedAudioPaths(lang);
    await preloadAudios(lang);
    await preloadImages(lang);
  } catch (err) {
    console.error("Error during initialization:", err);
    return;
  }

  // LOAD SPRITES FOR ALL BLOCKS
  try {
    const blockNames = [
      "EmotionalProsody",
      "DiscourseNovelty",
      "GestureOne",
      "GestureTwo",
      "ConversationalPerspectiveTakingOne",
      "IndirectRequest",
      "InformativenessTwo",
      // DISABLED blocks (their trials are commented out in prabat.html):
      // "GestureThree", "ConversationalPerspectiveTakingTwo",
      // "ConversationalPerspectiveTakingThree", "InformativenessOne",
      "SpeakersPreference",
      "intro",
    ];

    for (const blockName of blockNames) {
      try {
        blockSprites[blockName] = await buildSpriteForBlock(blockName);
      } catch (err) {
        console.error(`Error building sprite for ${blockName}:`, err);
      }
    }
  } catch (err) {
    console.error("Error building sprites:", err);
  }

  // Set to true while developing: skips fullscreen and logs extra information.
  const devmode = false;

  // Every <audio> element of the page, in page order (index 0 is the sound test).
  const allAudios = [...document.querySelectorAll("audio")];

  //------------------------------------------------------------------
  // automatically add running trial numbers as ids to html
  //------------------------------------------------------------------
  const trialDivs = document.querySelectorAll(".trials");

  // Iterate over trial divs and set their IDs
  trialDivs.forEach((div, index) => {
    const trialId = `trial${index}`;
    div.id = trialId;

    // find the prompt audio inside this div
    const promptAudio = div.querySelector("audio.prompt");
    if (promptAudio) {
      promptAudio.id = trialId; // set same id as the trial container
    }
  });

  //------------------------------------------------------------------
  // create object to save data
  //------------------------------------------------------------------
  const responseLog = {
    // get ID out of URL parameter
    meta: {
      subjID: studyChoices.ID || "testID",
      order: window.location.pathname.split("/").pop().replace(".html", ""),
      touchscreen: checkForTouchscreen(),
      webcam: studyChoices.webcam,
    },
    data: [],
  };

  //------------------------------------------------------------------
  // log user testing setup
  //------------------------------------------------------------------
  DetectRTC.load(() => {
    responseLog.meta.os = DetectRTC.osName;
    responseLog.meta.browser = DetectRTC.browser.name;
    responseLog.meta.browserVersion = JSON.stringify(DetectRTC.browser.version);
    responseLog.meta.safari = DetectRTC.browser.isSafari || false;
    responseLog.meta.iOSSafari = responseLog.meta.touchscreen && responseLog.meta.safari;

    if (devmode) console.log(responseLog.meta);
  });

  //------------------------------------------------------------------
  // study variables
  //------------------------------------------------------------------
  let trialNr = 0;
  let t0 = 0;
  let t1 = 0;

  //------------------------------------------------------------------
  // get relevant elements
  //------------------------------------------------------------------
  const betweenTrials = document.getElementById("between-trials");
  const betweenTrialsBackground = document.getElementById("between-trials-background");
  const button = document.getElementById("prabat-button");
  const speaker = document.getElementById("speaker");
  const headingFullscreen = document.getElementById("heading-fullscreen");
  const headingTestsound = document.getElementById("heading-testsound");
  const TestSound = document.getElementById("testsound");
  let skipAdvance;
  let repeatCount = 0;

  //------------------------------------------------------------------
  // HANDLE RESPONSE CLICK
  //------------------------------------------------------------------
  const handleResponseClick = async (event) => {
    event.preventDefault();

    // Prevent clicks on the img element with id="character" or "transition"
    if (event.target.id === "character" || event.target.id === "transition") {
      return;
    }

    const currentTrial = document.getElementById(`trial${trialNr - 1}`);
    const responseAudio = currentTrial.querySelector("audio.preResponse");

    t1 = new Date().getTime();

    // Clear borders on other images first
    const currentImages = Array.from(currentTrial.getElementsByTagName("img"));
    currentImages.forEach((img) => {
      if (img !== event.target && img.id !== "character" && img.id !== "background") {
        img.style.border = "transparent";
      }
    });

    // Now show blue border on the clicked one
    event.target.style.border = "0.3cqw solid blue";

    if (responseAudio) {
      const bg = currentTrial.querySelector("#background");
      const talk = currentTrial.querySelector("#background-talking");
      const shouldTalk = responseAudio.src.indexOf("Mmh") === -1;

      if (shouldTalk && bg && talk) {
        bg.style.display = "none";
        talk.style.display = "block";
      }

      button.disabled = true;

      await playAudioWebAudio(responseAudio);

      if (bg && talk) {
        bg.style.display = "block";
        talk.style.display = "none";
      }

      button.disabled = false;
    }

    button.disabled = false;

    // save response
    responseLog.data[trialNr - 2] = {
      timestamp: new Date(parseInt(t1)).toISOString(),
      responseTime: t1 - t0,
      trial: trialNr,
      targetObject: currentTrial
        .querySelector('img[data-word-category="target"]')
        .src.split("/")
        .pop()
        .replace(".svg", "")
        .replace(".gif", ""),
      chosenObject: event.target.src.split("/").pop().replace(".svg", "").replace(".gif", ""),
      chosenCategory: event.target.dataset.wordCategory,
      chosenPosition: event.target.closest("div").id,
      repeatCount: repeatCount,
      browser: DetectRTC.browser.name,
      OS: DetectRTC.osName,
    };

    button.addEventListener("click", handleContinueClick, {
      capture: false,
      once: true,
    });
  };

  //------------------------------------------------------------------
  // HANDLE CONTINUE CLICK
  //------------------------------------------------------------------
  const handleContinueClick = async (event) => {
    event.preventDefault();
    repeatCount = 0;
    if (trialNr > 0) {
      speaker.classList.add("disabled");
      button.disabled = true;
    }
    if (skipAdvance === false && trialNr > 0) {
      const prevTrialIndex = trialNr - 1;
      const prevTrial = document.getElementById(`trial${prevTrialIndex}`);
      let prevResponseAudio = null;

      if (prevTrial) {
        prevResponseAudio = prevTrial.querySelector("audio.response");
      }
      if (prevResponseAudio) {
        // Hide the image with id "background"
        const backgroundImg = prevTrial.querySelector("#background");
        if (backgroundImg) {
          backgroundImg.style.display = "none";
        }
        // Show the image with id "background-talking"
        const backgroundTalkingImg = prevTrial.querySelector("#background-talking");
        if (backgroundTalkingImg) {
          backgroundTalkingImg.style.display = "block";
        }

        await playAudioWebAudio(prevResponseAudio);

        if (backgroundImg) {
          backgroundImg.style.display = "block";
        }

        if (backgroundTalkingImg) {
          backgroundTalkingImg.style.display = "none";
        }
      }
    }

    if (devmode) {
      console.log("trialNr", trialNr);
      console.log(allAudios[trialNr]);
      console.log(responseLog);
    }

    // enable fullscreen and have short break, before first trial starts
    if (trialNr === 0) {
      // Unlock audio (very important for Android / iOS)
      unlockAudio();

      if (!devmode && !responseLog.meta.iOSSafari) openFullscreen();
      headingFullscreen.style.display = "none";
      headingTestsound.style.display = "inline";
      speaker.style.display = "block";

      if (allAudios[trialNr]) {
        playAudioWebAudio(allAudios[trialNr]);
      }

      button.addEventListener("click", handleContinueClick, {
        capture: false,
        once: true,
      });
    }

    // end of trials
    if (trialNr === trialDivs.length) {
      studyChoices.ID = responseLog.meta.subjID;
      // Show fullscreen overlay (spinner
      const overlay = document.querySelector("#uploadOverlay");
      overlay.classList.remove("hidden");
      try {
        await stopRecording();
      } catch (e) {
        console.warn("Failed to stop recording, continuing anyway:", e);
      }

      // Server upload is switched off: the CSV and the video are only downloaded on the
      // participant's device. To switch it on again, uncomment this block and the two
      // upload imports at the top of this file.
      // try {
      //   await uploadData(responseLog.data, responseLog.meta.subjID);
      //   await pause(2000);
      // } catch (err) {
      //   console.error("Error during data uploading processing:", err);
      // }
      // try {
      //   if (responseLog.meta.webcam === "true") {
      //     await uploadVideo(responseLog.meta.webcam, responseLog.meta.subjID);
      //     await pause(5000);
      //   }
      // } catch (err) {
      //   console.error("Error during video uploading processing:", err);
      // }
      try {
        await downloadData(responseLog.data, responseLog.meta.subjID);
        await pause(2000);
      } catch (err) {
        console.error("Error during data downloading processing:", err);
      }
      try {
        if (responseLog.meta.webcam === "true") {
          await downloadVideo(responseLog.meta.webcam, responseLog.meta.subjID);
          await pause(5000);
        }
      } catch (err) {
        console.error("Error during video downloading processing:", err);
      }
      window.location.href = `./goodbye.html`;
      overlay.classList.add("hidden");
    }

    const currentTrial = document.getElementById(`trial${trialNr}`);

    // transition images for trials that need multiple slides

    if (currentTrial.classList.contains("transitionEmpty")) {
      betweenTrialsBackground.src = "images/backgrounds/background_empty.svg";
      headingTestsound.style.display = "none";
      const lastTrial = document.getElementById(`trial${trialNr - 1}`);
      lastTrial.style.display = "none";

      const trialAudio = currentTrial.querySelector("audio.prompt");

      betweenTrials.style.display = "none";

      const flexWrapper = document.getElementById("flex-wrapper");
      flexWrapper.style.backgroundColor = "transparent";

      currentTrial.style.display = "block";

      if (trialAudio) {
        button.disabled = true;
        speaker.classList.add("disabled");

        await playAudioWebAudio(trialAudio);

        speaker.classList.remove("disabled");

        const backgroundImg = currentTrial.querySelector("#background");
        if (backgroundImg) {
          backgroundImg.style.display = "block";
        }

        const backgroundTalkingImg = currentTrial.querySelector("#background-talking");
        if (backgroundTalkingImg) {
          backgroundTalkingImg.style.display = "none";
        }

        button.addEventListener("click", handleContinueClick, {
          capture: false,
          once: true,
        });

        button.disabled = false;
      }
    }

    // Transition blocks handling

    if (currentTrial.classList.contains("SpriteAudioTrials")) {
      let BlockName = "";
      let SkipAheadIndex = 0;
      const blockSkipAhead = {
        DiscourseNovelty: 5,
        SpeakersPreference: 5,
        GestureOne: 1,
        GestureTwo: 1,
        ConversationalPerspectiveTakingOne: 2,
        IndirectRequest: 1,
        EmotionalProsody: 3,
        InformativenessTwo: 3,
        intro: 4,
        // DISABLED blocks: GestureThree: 1, ConversationalPerspectiveTakingTwo: 2,
        // ConversationalPerspectiveTakingThree: 1, InformativenessOne: 3
      };
      BlockName =
        Object.keys(blockSkipAhead).find((name) => currentTrial.classList.contains(name)) || "";
      SkipAheadIndex = blockSkipAhead[BlockName] || 0;
      const flexWrapper = document.getElementById("flex-wrapper");
      flexWrapper.style.backgroundColor = "transparent";
      betweenTrials.style.display = "none";
      headingTestsound.style.display = "none";
      const lastTrial = document.getElementById(`trial${trialNr - 1}`);
      lastTrial.style.display = "none";

      await runTransitionBlock(BlockName, () => {
        if (!BlockName.includes("intro")) {
          const currentTrial = document.querySelector(`.trials.${BlockName}.critical`);
          const currentImages = Array.from(currentTrial.querySelectorAll("img.object"));
          const lastTrial = document.getElementById(`trial${trialNr - 1}`);
          lastTrial.style.display = "none";
          currentTrial.style.display = "block";

          // Start RT timing *after* everything appears
          t0 = new Date().getTime();

          currentImages.forEach((img) => {
            img.style.pointerEvents = "auto";
          });

          const backgroundImg = currentTrial.querySelector("#background");
          if (backgroundImg) {
            backgroundImg.style.display = "block";
          }
          // Hide the image with id "background-talking"
          const backgroundTalkingImg = currentTrial.querySelector("#background-talking");
          if (backgroundTalkingImg) {
            backgroundTalkingImg.style.display = "none";
          }

          // enable speaker again
          speaker.classList.remove("disabled");

          currentImages.forEach((img) => {
            img.addEventListener("click", handleResponseClick, {
              capture: false,
              once: false,
            });
          });
        } else if (BlockName.includes("intro")) {
          const currentTrial = document.querySelector(`.trials.${BlockName}.critical`);
          const lastTrial = document.getElementById(`trial${trialNr - 1}`);
          lastTrial.style.display = "none";
          currentTrial.style.display = "block";
          // enable speaker again
          speaker.classList.remove("disabled");
          button.disabled = false;
          const backgroundImg = currentTrial.querySelector("#background");
          if (backgroundImg) {
            backgroundImg.style.display = "block";
          }
          button.addEventListener("click", handleContinueClick, {
            capture: false,
            once: true,
          });
        }
        trialNr = trialNr + SkipAheadIndex; // skip ahead past the discourse novelty trials
      });
    }
    // Normal blocks handling

    if (
      trialNr > 0 &&
      currentTrial.classList.contains("transitionSlide") == false &&
      currentTrial.classList.contains("transitionEmpty") == false
    ) {
      const imgEl = document.getElementById("background");
      if (imgEl && window.localizedImages?.background) {
        imgEl.src = window.localizedImages.background;
      }

      const imgElTalk = document.getElementById("background-talking");
      if (imgElTalk && window.localizedImages?.background) {
        imgElTalk.src = window.localizedImages.background;
      }

      const currentTrial = document.getElementById(`trial${trialNr}`);
      headingTestsound.style.display = "none";

      const lastTrial = document.getElementById(`trial${trialNr - 1}`);
      lastTrial.style.display = "none";

      const trialAudio = currentTrial.querySelector("audio.prompt");
      const audioSrc = trialAudio.src;

      // Play the audio element contained in currentTrial

      // save response time start point
      t0 = new Date().getTime();

      betweenTrials.style.display = "none";

      if (!audioSrc.includes("Mmh")) {
        const backgroundImg = currentTrial.querySelector("#background");
        if (backgroundImg) {
          backgroundImg.style.display = "none";
        }
        // Hide the image with id "background-talking"
        const backgroundTalkingImg = currentTrial.querySelector("#background-talking");
        if (backgroundTalkingImg) {
          backgroundTalkingImg.style.display = "block";
        }
      }

      const flexWrapper = document.getElementById("flex-wrapper");
      flexWrapper.style.backgroundColor = "transparent";

      currentTrial.style.display = "block";

      // play audio of current trial; the continue button stays disabled meanwhile
      if (trialAudio) {
        button.disabled = true;
        await playAudioWebAudio(trialAudio);
      }

      // Start RT timing *after* everything appears
      t0 = new Date().getTime();

      const currentImages = Array.from(currentTrial.querySelectorAll("img.object"));

      currentImages.forEach((img) => {
        img.style.pointerEvents = "auto";
      });

      const backgroundImg = currentTrial.querySelector("#background");
      if (backgroundImg) {
        backgroundImg.style.display = "block";
      }
      // Hide the image with id "background-talking"
      const backgroundTalkingImg = currentTrial.querySelector("#background-talking");
      if (backgroundTalkingImg) {
        backgroundTalkingImg.style.display = "none";
      }

      // enable speaker again
      speaker.classList.remove("disabled");

      currentImages.forEach((img) => {
        img.addEventListener("click", handleResponseClick, {
          capture: false,
          once: false,
        });
      });
    }
    skipAdvance = false; // consume the flag so future continues behave normally
    trialNr++;
  };

  //------------------------------------------------------------------
  // HANDLE SPEAKER CLICK
  //------------------------------------------------------------------

  const handleSpeakerClick = async (event) => {
    event.preventDefault();
    repeatCount += 1;
    const currentTrial = document.getElementById(`trial${trialNr - 1}`);
    if (!currentTrial) return;

    const currentImages = Array.from(currentTrial.querySelectorAll("img.object"));

    currentImages.forEach((img) => {
      img.style.pointerEvents = "none";
      img.style.border = "transparent";
    });

    if (currentTrial.classList.contains("SpriteAudioTrials")) {
      let BlockName = "";
      let SkipAheadIndex = 0;
      const blockSkipAhead = {
        DiscourseNovelty: 5,
        SpeakersPreference: 5,
        GestureOne: 1,
        GestureTwo: 1,
        ConversationalPerspectiveTakingOne: 2,
        IndirectRequest: 1,
        EmotionalProsody: 3,
        InformativenessTwo: 3,
        intro: 4,
        // DISABLED blocks: GestureThree: 1, ConversationalPerspectiveTakingTwo: 2,
        // ConversationalPerspectiveTakingThree: 1, InformativenessOne: 3
      };
      BlockName =
        Object.keys(blockSkipAhead).find((name) => currentTrial.classList.contains(name)) || "";
      SkipAheadIndex = blockSkipAhead[BlockName] || 0;
      const lastTrial = document.getElementById(`trial${trialNr - 1}`);
      lastTrial.style.display = "none";
      trialNr = trialNr - (SkipAheadIndex + 1); // point to the trial you want
      skipAdvance = true; // don’t auto ++ on this pass
      const flexWrapper = document.getElementById("flex-wrapper");
      flexWrapper.style.backgroundColor = "transparent";
      betweenTrials.style.display = "none";
      headingTestsound.style.display = "none";
      if (!BlockName.includes("intro")) {
        const backgroundImg = currentTrial.querySelector("#background");
        if (backgroundImg) {
          backgroundImg.style.display = "none";
        }
      } else {
        const backgroundImg = currentTrial.querySelector("#background");
        if (backgroundImg) {
          backgroundImg.style.display = "block";
        }
      }
      const backgroundTalkingImg = currentTrial.querySelector("#background-talking");
      if (backgroundTalkingImg) {
        backgroundTalkingImg.style.display = "block";
      }

      button.disabled = true; // prevent clicking until a new choice is made
      speaker.classList.add("disabled");
      currentImages.forEach((img) => {
        img.style.pointerEvents = "none";
      });

      button.removeEventListener("click", handleResponseClick);

      await runTransitionBlock(BlockName, () => {
        if (!BlockName.includes("intro")) {
          const currentTrial = document.querySelector(`.trials.${BlockName}.critical`);
          const currentImages = Array.from(currentTrial.querySelectorAll("img.object"));
          const lastTrial = document.getElementById(`trial${trialNr - 1}`);
          lastTrial.style.display = "none";
          currentTrial.style.display = "block";

          // Start RT timing *after* everything appears
          t0 = new Date().getTime();

          const backgroundImg = currentTrial.querySelector("#background");
          if (backgroundImg) {
            backgroundImg.style.display = "block";
          }
          // Hide the image with id "background-talking"
          const backgroundTalkingImg = currentTrial.querySelector("#background-talking");
          if (backgroundTalkingImg) {
            backgroundTalkingImg.style.display = "none";
          }

          // enable speaker again
          speaker.classList.remove("disabled");

          button.disabled = true;

          currentImages.forEach((img) => {
            img.style.pointerEvents = "auto";
            img.addEventListener("click", handleResponseClick, {
              capture: false,
              once: false,
            });
          });
        } else if (BlockName.includes("intro")) {
          const currentTrial = document.querySelector(`.trials.${BlockName}.critical`);
          const lastTrial = document.getElementById(`trial${trialNr - 1}`);
          lastTrial.style.display = "none";
          currentTrial.style.display = "block";
          // enable speaker again
          speaker.classList.remove("disabled");
          button.disabled = false;
          const backgroundImg = currentTrial.querySelector("#background");
          if (backgroundImg) {
            backgroundImg.style.display = "block";
          }
          button.addEventListener("click", handleContinueClick, {
            capture: false,
            once: true,
          });
        }
        trialNr = trialNr + (SkipAheadIndex + 1); // skip ahead past the discourse novelty trials
      });
    } else if (currentTrial.classList.contains("transitionSlide")) {
      const speakerButton = document.getElementById("speaker");
      if (speakerButton) {
        speakerButton.disabled = true; // make it inactive
      }
      return;
    } else if (currentTrial.classList.contains("transitionEmpty")) {
      const trialId = currentTrial.id;
      const trialAudio = currentTrial.querySelector(`audio#${trialId}`);

      speaker.classList.add("disabled");

      if (!trialAudio) {
        console.error("No <audio> found for transitionEmpty slide:", trialId);
        return;
      }

      button.disabled = true;

      const backgroundImg = currentTrial.querySelector("#background");
      if (backgroundImg) {
        backgroundImg.style.display = "none";
      }

      const backgroundTalkingImg = currentTrial.querySelector("#background-talking");
      if (backgroundTalkingImg) {
        backgroundTalkingImg.style.display = "block";
      }

      await playAudioWebAudio(trialAudio);

      speaker.classList.remove("disabled");
      button.disabled = false;

      if (backgroundImg) {
        backgroundImg.style.display = "block";
      }

      if (backgroundTalkingImg) {
        backgroundTalkingImg.style.display = "none";
      }
    } else if (currentTrial.id === "trial0") {
      if (TestSound) {
        playAudioWebAudio(TestSound);
      } else {
        console.warn('Element with ID "testsound" not found.');
      }
    } else {
      // find the audio inside with the same id as the trial div
      const trialId = currentTrial.id; // e.g. "trial0", "trial1"
      const trialAudio = currentTrial.querySelector(`audio#${trialId}`);
      if (!trialAudio) return;

      // The continue button stays disabled until a new choice is made
      button.removeEventListener("click", handleResponseClick);
      button.disabled = true;

      const backgroundImg = currentTrial.querySelector("#background");
      if (backgroundImg) {
        backgroundImg.style.display = "none";
      }
      // Hide the image with id "background-talking"
      const backgroundTalkingImg = currentTrial.querySelector("#background-talking");
      if (backgroundTalkingImg) {
        backgroundTalkingImg.style.display = "block";
      }

      speaker.classList.add("disabled");

      await playAudioWebAudio(trialAudio);

      speaker.classList.remove("disabled");

      currentImages.forEach((img) => {
        img.style.pointerEvents = "auto";
      });
      // Show the image with id "background"
      if (backgroundImg) {
        backgroundImg.style.display = "block";
      }
      // Hide the image with id "background-talking"
      if (backgroundTalkingImg) {
        backgroundTalkingImg.style.display = "none";
      }
    }
  };

  //------------------------------------------------------------------
  // add eventListeners
  //------------------------------------------------------------------
  button.addEventListener("click", handleContinueClick, {
    capture: false,
    once: true,
  });

  speaker.addEventListener("click", handleSpeakerClick, {
    capture: false,
    once: false,
  });

  // ---------------------------------------------------------------------------------------------------------------------
  // START TRIALS
  // ---------------------------------------------------------------------------------------------------------------------
  // browser takes time for webcam permission
  const startTrials = async () => {
    await pause(500);

    // Start the webcam recording if the participant agreed to it on the ID page
    if (responseLog.meta.webcam === "true") {
      if (!isMediaRecorderSupported()) {
        console.log("MediaRecorder is not supported in this browser.");
      } else {
        try {
          console.log("Requesting camera/microphone...");
          await initMedia({
            audio: true,
            video: {
              frameRate: { min: 1, ideal: 5, max: 10 },
              width: { min: 640, ideal: 640, max: 640 }, // keep it small
              height: { min: 480, ideal: 480, max: 480 },
              facingMode: "user",
            },
          });
          console.log("Camera ready. You can start recording.");

          startRecording();
          console.log("Recording started.");
        } catch (error) {
          console.error("Failed to access camera/microphone:", error);
        }
      }
    }
    await pause(2500);

    button.style.display = "inline";
    button.disabled = false;
  };
  startTrials();

  // DISABLED: randomised item order (see the import at the top of this file)
  // randomizeNewTrials();
});
