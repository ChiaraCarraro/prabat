import "./css/prabat.css";
import * as DetectRTC from "detectrtc";

import { downloadData } from "./js/downloadData.js";
import { uploadData } from "./js/uploadData.js";
import { uploadVideo } from "./js/uploadVideo.js";
import { downloadVideo } from "./js/downloadVideo.js";
import { pause } from "./js/pause.js";
// import { hideURLparams } from './js/hideURLparams.js';
import { openFullscreen } from "./js/openFullscreen.js";
import { checkForTouchscreen } from "./js/checkForTouchscreen.js";
// import { randomizeNewTrials } from './js/randomizeNewTrials.js';
import { loadLanguage } from "./js/loadLanguage.js";
import { applyLocalizedAudioPaths } from "./js/applyLocalizedAudioPaths.js";
import { applyLocalizedImagePaths } from "./js/applyLocalizedImagePaths.js";
import { preloadAudios } from "./js/preloadAudios.js";
import { preloadImages } from "./js/preloadImages.js";
import { startRecording, initMedia, isMediaRecorderSupported, stopRecording } from "./js/mediaRecorderServices.js";
import { playAudio, allAudios } from "./js/playAudios.js";
import { buildSpriteForBlock } from "./js/buildSpriteForBlock.js";
import { getSharedAudioContext } from "./js/sharedAudioContext.js";

const storedChoices = localStorage.getItem("storedChoices");
let studyChoices;
if (storedChoices) {
  studyChoices = JSON.parse(storedChoices);
} else {
  console.error("No data found in local storage");
}
const lang = studyChoices?.lang || "tr"; // fallback to English



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
      console.log("[TransitionBlock] Resumed AudioContext for block:", blockName);
    }
  } catch (e) {
    console.warn("[TransitionBlock] Could not resume AudioContext:", e);
  }

  // Use a gain node so we can control volume of transition blocks
  const spriteGain = ctx.createGain();
  spriteGain.gain.value = 0.7;   // ≈ -3 dB
  spriteGain.connect(ctx.destination);

  const slides = Array.from(
    document.querySelectorAll(`.trials.transitionSlide.${blockName}`)
  );

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
        currentSource.onended = null;   // avoid calling callbacks after stop()
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
      source.connect(spriteGain);      // 👈 use the ONE gain node we made above
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

    // Keep existing opacity (important for Discourse Novelty animations)
    const objects = slide.querySelectorAll("img.object");
    objects.forEach((img) => {
      // img.style.opacity = "1";  // leave opacity to CSS/HTML
      img.style.pointerEvents = "none"; // usually no responses in transition slides
    });

    const prompt = slide.querySelector("audio.prompt");
    if (!prompt) {
      currentIndex++;
      showSlideAndPlay();
      return;
    }

    const file = prompt.src.split("/").pop();      // "DiscNovLook.mp3"
    const label = file.replace(/\.[^.]+$/, "");    // "DiscNovLook"

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
  try{
    await loadLanguage(lang);
    applyLocalizedImagePaths(lang); 
    applyLocalizedAudioPaths(lang);  
    await preloadAudios(lang);
    await preloadImages(lang);
  }
  catch (err){
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
      // "GestureThree",
      "ConversationalPerspectiveTakingOne",
      // "ConversationalPerspectiveTakingTwo",
      // "ConversationalPerspectiveTakingThree",
      "IndirectRequest",
      // "InformativenessOne",
      "InformativenessTwo",
      "SpeakersPreference",
      "intro"
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

  const devmode = false;

  const domAudios = [...document.querySelectorAll("audio")];
  allAudios.push(...domAudios);


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

  // hide url parameters
  // hideURLparams();

  //------------------------------------------------------------------
  // log user testing setup
  //------------------------------------------------------------------
  DetectRTC.load(() => {
    responseLog.meta.os = DetectRTC.osName;
    responseLog.meta.browser = DetectRTC.browser.name;
    responseLog.meta.browserVersion = JSON.stringify(DetectRTC.browser.version);
    responseLog.meta.safari = DetectRTC.browser.isSafari || false;
    responseLog.meta.iOSSafari =
      responseLog.meta.touchscreen && responseLog.meta.safari;

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
  const betweenTrialsBackground = document.getElementById(
    "between-trials-background"
  );
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
    console.log("currentTrial:", currentTrial, trialNr - 1);
    const responseAudio = currentTrial.querySelector('audio.preResponse');
    console.log("response audio:", responseAudio);



    t1 = new Date().getTime();

    // Clear borders on other images first
    const currentImages = Array.from(currentTrial.getElementsByTagName("img"));
    currentImages.forEach((img) => {
      if (
        img !== event.target &&
        img.id !== "character" &&
        img.id !== "background"
      ) {
        img.style.border = "transparent";
      }
    });

    // Now show blue border on the clicked one
    event.target.style.border = "0.3vw solid blue";

    if (responseAudio) {
      const bg = currentTrial.querySelector("#background");
      const talk = currentTrial.querySelector("#background-talking");
      const shouldTalk = responseAudio.src.indexOf("Mmh") === -1;

      responseAudio.addEventListener("play", () => {
        if (shouldTalk && bg && talk) {
          bg.style.display = "none";
          talk.style.display = "block";
        }
        button.disabled = true;
      });

      responseAudio.addEventListener("ended", () => {
        if (bg && talk) {
          bg.style.display = "block";
          talk.style.display = "none";
        }
        button.disabled = false;
      });

      playAudio(responseAudio);
    }

    button.disabled = false;

    // NOTE: removed the immediate button.disabled = false here

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
      chosenObject: event.target.src
        .split("/")
        .pop()
        .replace(".svg", "")
        .replace(".gif", ""),
      chosenCategory: event.target.dataset.wordCategory,
      chosenPosition: event.target.closest("div").id,
      repeatCount: repeatCount,
      browser: DetectRTC.browser.name,
      OS: DetectRTC.osName,
    };

    console.log("repeatCount:", repeatCount);
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
        prevResponseAudio = prevTrial.querySelector('audio.response');
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

        // // Let Safari paint the talking background + disabled state BEFORE audio
        // await pause(50);

        await new Promise((resolve) => {
          prevResponseAudio.onended = () => {
            // Show the image with id "background"
            if (backgroundImg) {
              backgroundImg.style.display = "block";
            }
            // Hide the image with id "background-talking"
            if (backgroundTalkingImg) {
              backgroundTalkingImg.style.display = "none";
            }
            resolve();
          };

          // playAudio(prevResponseAudio);

          if (prevResponseAudio) {
            playAudio(prevResponseAudio);
          }

        });
        // await pause(1000);
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
        playAudio(allAudios[trialNr]);
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

      try {
        await uploadData(responseLog.data, responseLog.meta.subjID);
        await pause(2000);
      } catch (err) {
        console.error("Error during data uploading processing:", err);
      } 
      try {
        if (responseLog.meta.webcam === "true") {
          // !responseLog.meta.iOSSafari && 
          await uploadVideo(responseLog.meta.webcam, responseLog.meta.subjID);
          await pause(5000);
        }
      } catch (err) {
        console.error("Error during video uploading processing:", err);
      }
      try {
        await downloadData(responseLog.data, responseLog.meta.subjID);
        await pause(2000);
      } catch (err) {
        console.error("Error during data downloading processing:", err);
      } 
      try {
        if (responseLog.meta.webcam === "true") {
          // !responseLog.meta.iOSSafari &&
          await downloadVideo(responseLog.meta.webcam, responseLog.meta.subjID);
          await pause(5000);
        }
      } catch (err) {
        console.error("Error during video downloading processing:", err);
      } 
      window.location.href = `./goodbye.html`;
      overlay.classList.add("hidden");
      // window.location.href = `https://devpsy.web.leuphana.de/prabat-consent/goodbye.html`;
    }

    const currentTrial = document.getElementById(`trial${trialNr}`);

    // transition images for trials that need multiple slides

    if (currentTrial.classList.contains("transitionEmpty")) {
      betweenTrialsBackground.src = "images/backgrounds/background_empty.svg";
      headingTestsound.style.display = "none";
      const lastTrial = document.getElementById(`trial${trialNr - 1}`);
      lastTrial.style.display = "none";

      // betweenTrials.style.display = "flex";
      // betweenTrialsBackground.style.opacity = 1;
      //await pause(150);

      const trialAudio = currentTrial.querySelector("audio.prompt");

      betweenTrials.style.display = "none";

      //document.body.style.backgroundImage = "url('images/backgrounds/background01.png')";
      document.body.style.backgroundSize = "cover";
      document.body.style.backgroundPosition = "center";
      const flexWrapper = document.getElementById("flex-wrapper");
      flexWrapper.style.backgroundColor = "transparent";
      //betweenTrials.style.display = 'none';

      currentTrial.style.display = "block";
      console.log( "transitionEmpty slide:", currentTrial);

      // Let Safari paint at least one frame
      // await pause(50);


      if (trialAudio) {
        playAudio(trialAudio);
        // button.disabled = true;
        // speaker.classList.add("disabled");
      }
      console.log(trialAudio);

      trialAudio.onended = () => {
        speaker.classList.remove("disabled");
        const backgroundImg = currentTrial.querySelector("#background");
        if (backgroundImg) {
          backgroundImg.style.display = "block";
        }
        // Hide the image with id "background-talking"
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
        "DiscourseNovelty": 5,
        "SpeakersPreference": 5,
        "GestureOne": 1,
        "GestureTwo": 1,
        // "GestureThree": 1,
        "ConversationalPerspectiveTakingOne": 2,
        // "ConversationalPerspectiveTakingTwo": 2,
        // "ConversationalPerspectiveTakingThree": 1,
        "IndirectRequest": 1,
        "EmotionalProsody": 3,
        // "InformativenessOne": 3,
        "InformativenessTwo": 3,
        "intro": 4
      };
      BlockName = Object.keys(blockSkipAhead).find(name => currentTrial.classList.contains(name)) || "";
      console.log("BlockName:", BlockName);
      SkipAheadIndex = blockSkipAhead[BlockName] || 0;
      const flexWrapper = document.getElementById("flex-wrapper");
      flexWrapper.style.backgroundColor = "transparent";
      betweenTrials.style.display = "none";
      headingTestsound.style.display = "none";
      // const lastTrial = document.getElementById(`trial${trialNr - 1}`);
      // lastTrial.style.display = "none";
      const lastTrial = document.getElementById(`trial${trialNr - 1}`);
      lastTrial.style.display = "none";
      // button.disabled = true;

      // speaker.classList.add("disabled");
      
      await runTransitionBlock(BlockName, () => {
        if (!BlockName.includes("intro")) {
          const currentTrial = document.querySelector(`.trials.${BlockName}.critical`);
          const currentImages = Array.from(currentTrial.querySelectorAll("img.object"));
          const lastTrial = document.getElementById(`trial${trialNr - 1}`);
          lastTrial.style.display = "none";
          currentTrial.style.display = "block";

          // Start RT timing *after* everything appears
          t0 = new Date().getTime();

          console.log(currentImages);
          
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
          console.log("before adding event listener")

          // enable speaker again
          speaker.classList.remove("disabled");
          console.log("speaker enabled");
          
          currentImages.forEach((img) => {
            console.log("event listener added")
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
          console.log("intro block - before adding event listener")
          // enable speaker again
          speaker.classList.remove("disabled");
          console.log("speaker enabled");
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
        trialNr = trialNr +  SkipAheadIndex ; // skip ahead past the discourse novelty trials
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
      const audioSrc = (trialAudio.src);

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
      //betweenTrials.style.display = 'none';

      currentTrial.style.display = "block";

      // Let Safari paint at least one frame
      // await pause(50);   
      
      // play audio of current trial
      if (trialAudio) {
        // disable speaker during playback
        if (trialAudio) {
          playAudio(trialAudio);

        }
        // if (speaker) {
        //   // disable speaker during playback
        //   // speaker.classList.add("disabled");
        //   // console.log("speaker disabled");
        // }

        button.disabled = true;
        // playAudio(trialAudio);

        console.log("This is:", trialAudio);
        console.log("This is:", audioSrc);
        
      }

      // Start RT timing *after* everything appears
      t0 = new Date().getTime();

      const currentImages = Array.from(currentTrial.querySelectorAll("img.object"));
      console.log(currentImages);

      trialAudio.onended = () => {
        // Show the image with id "background"

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
        console.log("before adding event listener")

        // enable speaker again
        speaker.classList.remove("disabled");
        console.log("speaker enabled");
        
        currentImages.forEach((img) => {
          console.log("event listener added")
          img.addEventListener("click", handleResponseClick, {
          capture: false,
          once: false,
          });
        });
      };
    }
    console.log(trialNr);
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
    console.log(currentTrial);
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
        "DiscourseNovelty": 5,
        "SpeakersPreference": 5,
        "GestureOne": 1,
        "GestureTwo": 1,
        // "GestureThree": 1,
        "ConversationalPerspectiveTakingOne": 2,
        // "ConversationalPerspectiveTakingTwo": 2,
        // "ConversationalPerspectiveTakingThree": 1,
        "IndirectRequest": 1,
        "EmotionalProsody": 3,
        // "InformativenessOne": 3,
        "InformativenessTwo": 3,
        "intro": 4
      };
      BlockName = Object.keys(blockSkipAhead).find(name => currentTrial.classList.contains(name)) || "";
      console.log("BlockName:", BlockName);
      SkipAheadIndex = blockSkipAhead[BlockName] || 0;
      //////////////
      const lastTrial = document.getElementById(`trial${trialNr-1}`);
      lastTrial.style.display = "none";
      trialNr = trialNr - (SkipAheadIndex + 1);// point to the trial you want
      skipAdvance = true;                 // don’t auto ++ on this pass
      const flexWrapper = document.getElementById("flex-wrapper");
      flexWrapper.style.backgroundColor = "transparent";
      betweenTrials.style.display = "none";
      headingTestsound.style.display = "none";
      // const lastTrial = document.getElementById(`trial${trialNr - 1}`);
      // lastTrial.style.display = "none";
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
      console.log("speaker disabled");  
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

          console.log(currentImages);
          
          const backgroundImg = currentTrial.querySelector("#background");
          if (backgroundImg) {
            backgroundImg.style.display = "block";
          }
          // Hide the image with id "background-talking"
          const backgroundTalkingImg = currentTrial.querySelector("#background-talking");
          if (backgroundTalkingImg) {
            backgroundTalkingImg.style.display = "none";
          }
          console.log("before adding event listener")

          // enable speaker again
          speaker.classList.remove("disabled");
          console.log("speaker enabled");

          button.disabled = true;
          
          currentImages.forEach((img) => {
            img.style.pointerEvents = "auto";
            console.log("event listener added")
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
          console.log("intro block - before adding event listener")
          // enable speaker again
          speaker.classList.remove("disabled");
          console.log("speaker enabled");
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
        trialNr = trialNr +  (SkipAheadIndex + 1) ; // skip ahead past the discourse novelty trials
      });
    } else if (currentTrial.classList.contains("transitionSlide")) {
      const speakerButton = document.getElementById("speaker");
      if (speakerButton) {
        speakerButton.disabled = true;     // make it inactive
      }
      return;
    } else if (currentTrial.classList.contains("transitionEmpty")) {
      const trialId = currentTrial.id; // e.g. "trial0", "trial1"
      const trialAudio = currentTrial.querySelector(`audio#${trialId}`);
      speaker.classList.add("disabled");
      console.log("speaker disabled");

        // --- Guard against missing audio tag ---
      if (!trialAudio) {
        console.error("No <audio> found for transitionEmpty slide:", trialId);
        return;
      }

      // trialAudio.currentTime = 0;
      await playAudio(trialAudio);
      console.log("played");
      button.disabled = true; // prevent clicking until a new choice is made

      const backgroundImg = currentTrial.querySelector("#background");
      if (backgroundImg) {
        backgroundImg.style.display = "none";
      }
      // Hide the image with id "background-talking"
      const backgroundTalkingImg = currentTrial.querySelector("#background-talking");
      if (backgroundTalkingImg) {
        backgroundTalkingImg.style.display = "block";
      }

      trialAudio.onended = () => {
        speaker.classList.remove("disabled");
        console.log("speaker enabled");
        button.disabled = false;
        const backgroundImg = currentTrial.querySelector("#background");
        if (backgroundImg) {
          backgroundImg.style.display = "block";
        }
        // Hide the image with id "background-talking"
        const backgroundTalkingImg = currentTrial.querySelector("#background-talking");
        if (backgroundTalkingImg) {
          backgroundTalkingImg.style.display = "none";
        }
      };
    } else if (currentTrial.id === "trial0") {
      if (TestSound) {
        //TestSound.play();
        playAudio(TestSound);
      } else {
        console.warn('Element with ID "testsound" not found.');
      }
    } else {
      // const backgroundTalkingImg = currentTrial.querySelector("#background-talking");
      // backgroundTalkingImg.style.display = "block";
      // find the audio inside with the same id as the trial div
      const trialId = currentTrial.id; // e.g. "trial0", "trial1"
      const trialAudio = currentTrial.querySelector(`audio#${trialId}`);
      if (!trialAudio) return;
      
      // -----------------------------------
      // DISABLE OR REMOVE CONTINUE BUTTON CLICK
      // -----------------------------------
      const button = document.getElementById("prabat-button");
      if (button) {
        button.removeEventListener("click", handleResponseClick);
        button.disabled = true; // prevent clicking until a new choice is made
      }

        // --- Guard against missing audio tag ---
      if (!trialAudio) {
        console.error("No <audio> found for transitionEmpty slide:", trialId);
        return;
      }

      // (re)start the audio
      // trialAudio.currentTime = 0;
      //await trialAudio.play();
      await playAudio(trialAudio);
      console.log("played");
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
      console.log("speaker disabled");

      trialAudio.onended = () => {
        speaker.classList.remove("disabled");
        console.log("speaker enabled");

        currentImages.forEach((img) => {
          img.style.pointerEvents = "auto";
        });
        // Show the image with id "background"
        const backgroundImg = currentTrial.querySelector("#background");
        if (backgroundImg) {
          backgroundImg.style.display = "block";
        }
        // Hide the image with id "background-talking"
        const backgroundTalkingImg = currentTrial.querySelector("#background-talking");
        if (backgroundTalkingImg) {
          backgroundTalkingImg.style.display = "none";
        }
      };
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

    // ---------------------------------------------------------------------------------------------------------------------
    // FOR DEMO: Conditional Recording (only if not iOS Safari)
    // ---------------------------------------------------------------------------------------------------------------------
    if (responseLog.meta.webcam === "true") {
      // !responseLog.meta.iOSSafari &&
      if (!isMediaRecorderSupported()) {
      console.log("MediaRecorder is not supported in this browser.");
      }
      else if (responseLog.meta.webcam === "true") {
        try {
          console.log("Requesting camera/microphone...");
          await initMedia({
            audio: true,
            video: {
              frameRate: { min: 1, ideal: 5, max: 10 },
              width: { min: 640, ideal: 640, max: 640 },   // keep it small
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

  //------------------------------------------------------------------
  // randomize new words
  //------------------------------------------------------------------
  // console.log(randomizeNewTrials());
});
