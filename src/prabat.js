// ---------------------------------------------------------------------------------------------------------------------
// THE STUDY ITSELF (prabat.html)
//
// prabat.html contains every trial as a <div class="trials ...">, all hidden. This file shows them
// one after the other, plays their audio, records the child's choice and, at the end, saves the
// responses (CSV) and the optional webcam video. See the comment at the top of prabat.html for
// the meaning of the trial classes.
//
// Flow: start button -> sound test (trial 0) -> trials -> download data -> goodbye.html
// ---------------------------------------------------------------------------------------------------------------------
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
import { getStudyChoices } from "./js/studyChoices.js";

const studyChoices = getStudyChoices();
const lang = studyChoices.lang || "ger"; // fallback: German

// ---------------------------------------------------------------------------------------------------------------------
// TRANSITION BLOCKS
// A block is a short story told over several slides (<div class="trials SpriteAudioTrials
// transitionSlide BLOCKNAME">), ending with a "critical" slide where the child chooses.
// The audio of all slides of a block is joined into one "sprite" (see buildSpriteForBlock.js)
// and played slide by slide without gaps.
// ---------------------------------------------------------------------------------------------------------------------

// Blocks whose audio sprite is built before the study starts
const BLOCK_NAMES = [
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

// After a block has played, the trial counter jumps over the block's remaining slides.
// Value = number of slides in the block minus 1.
const SLIDES_TO_SKIP = {
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

const blockSprites = {}; // blockName -> { ctx, audioBuffer, timing }

/** Name of the block a trial belongs to (one of its classes), or "" if none. */
function findBlockName(trial) {
  return Object.keys(SLIDES_TO_SKIP).find((name) => trial.classList.contains(name)) || "";
}

// If the audio of a block got stuck, ask the participant to play it again
function showBlockRestartPrompt(restartBlock) {
  const overlay = document.getElementById("audio-unlock-overlay");
  const overlayButton = document.getElementById("audio-unlock-button");
  if (!overlay || !overlayButton) {
    restartBlock();
    return;
  }

  overlay.style.display = "flex";
  overlayButton.textContent = "Nochmal abspielen"; // "Play again"

  overlayButton.onclick = () => {
    overlay.style.display = "none";
    restartBlock();
  };
}

/**
 * Play all slides of a transition block, one after the other, then call onFinished.
 * Slides with class "silent" are shown for the length of their audio without playing it.
 */
async function runTransitionBlock(blockName, onFinished) {
  const sprite = blockSprites[blockName];
  if (!sprite) {
    console.warn(`No sprite for block "${blockName}"`);
    if (onFinished) onFinished();
    return;
  }

  const { ctx, audioBuffer, timing } = sprite;

  // IMPORTANT for iOS: resume the shared AudioContext here
  try {
    if (ctx && ctx.state === "suspended") {
      await ctx.resume();
    }
  } catch (e) {
    console.warn("[TransitionBlock] Could not resume AudioContext:", e);
  }

  // One gain node (volume) for the whole block; it also feeds the webcam recording,
  // so the block's audio is captured clearly alongside the microphone.
  const spriteGain = ctx.createGain();
  spriteGain.gain.value = 1;
  spriteGain.connect(ctx.destination);
  routeNodeToMix(spriteGain);

  const slides = Array.from(document.querySelectorAll(`.trials.transitionSlide.${blockName}`));

  if (!slides.length) {
    console.warn(`No transition slides found for block "${blockName}"`);
    if (onFinished) onFinished();
    return;
  }

  let slideIndex = 0;
  let previousSlide = null;

  // Current Web Audio playback & safety timeout, so we can stop them cleanly
  let currentSource = null;
  let currentTimeout = null;
  let blockFinished = false;

  function stopCurrentPlayback() {
    if (currentSource) {
      try {
        currentSource.onended = null; // avoid calling callbacks after stop()
        currentSource.stop();
      } catch (e) {
        console.warn("Error stopping currentSource:", e);
      }
      currentSource = null;
    }

    if (currentTimeout) {
      clearTimeout(currentTimeout);
      currentTimeout = null;
    }
  }

  // Restart the entire block from its first slide
  function restartBlock() {
    console.warn("Restarting block:", blockName);
    blockFinished = false;
    stopCurrentPlayback();

    if (previousSlide) {
      previousSlide.style.display = "none";
    }

    slideIndex = 0;
    previousSlide = null;
    showSlideAndPlay();
  }

  // Called when audio is blocked or a segment never ends
  function handleBlocked() {
    // Ignore late "blocked" events after the block already finished (e.g. user left the app)
    if (blockFinished) {
      console.warn("Blocked event after block finished, ignoring:", blockName);
      return;
    }

    console.warn("Audio in block", blockName, "seems blocked; asking to restart");
    stopCurrentPlayback();
    showBlockRestartPrompt(restartBlock);
  }

  // Play the part of the sprite that belongs to one slide
  function playSegment(label, onEnded) {
    const segment = timing[label];
    if (!segment) {
      console.warn("No timing info for label:", label);
      if (onEnded) onEnded();
      return;
    }

    if (!ctx || ctx.state === "closed") {
      console.warn("AudioContext is closed for block", blockName);
      if (onEnded) onEnded();
      return;
    }

    stopCurrentPlayback();

    let ended = false;
    const endOnce = () => {
      if (ended) return;
      ended = true;

      // The segment finished normally, so the safety timeout is not needed
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
      source.connect(spriteGain);
      source.onended = endOnce;
      source.start(ctx.currentTime, segment.start, segment.duration);

      currentSource = source;
    } catch (e) {
      console.error("Error starting segment", label, e);
      handleBlocked();
      return;
    }

    // Safety net: if the segment never reports its end, treat the audio as blocked
    const timeoutMs = segment.duration * 1000 + 500;
    currentTimeout = setTimeout(() => {
      if (!ended && !blockFinished) {
        console.warn("Sprite segment did not end, restarting block:", label);
        handleBlocked();
      }
    }, timeoutMs);
  }

  function showSlideAndPlay() {
    const slide = slides[slideIndex];

    if (!slide) {
      // end of block
      blockFinished = true;
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
    slide.querySelectorAll("img.object").forEach((img) => {
      img.style.pointerEvents = "none";
    });

    const prompt = slide.querySelector("audio.prompt");
    if (!prompt) {
      slideIndex++;
      showSlideAndPlay();
      return;
    }

    // The sprite segment is named after the audio file, e.g. "DiscNovLook.mp3" -> "DiscNovLook"
    const fileName = prompt.src.split("/").pop();
    const label = fileName.replace(/\.[^.]+$/, "");

    if (slide.classList.contains("silent")) {
      const segment = timing[label];
      const waitMs = segment ? segment.duration * 1000 : 500;
      setTimeout(() => {
        slideIndex++;
        showSlideAndPlay();
      }, waitMs);
      return;
    }

    // Normal case: play the segment, then go to the next slide.
    // If the audio is blocked, playSegment calls handleBlocked() instead.
    playSegment(label, () => {
      slideIndex++;
      showSlideAndPlay();
    });
  }

  showSlideAndPlay();
}

// ---------------------------------------------------------------------------------------------------------------------
// SMALL HELPERS
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Mobile browsers only allow sound after a user gesture. Call this inside a click handler:
 * it resumes the shared AudioContext and plays a 1-frame silent sound to "unlock" audio.
 */
function unlockAudio() {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) {
      return;
    }

    if (ctx.state === "suspended") {
      ctx.resume().catch((err) => {
        console.warn("Could not resume shared AudioContext:", err);
      });
    }

    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
  } catch (e) {
    console.warn("unlockAudio failed:", e);
  }
}

/**
 * Each trial has a normal background (#background) and one where Ella is talking
 * (#background-talking). Show the talking one while she speaks, the normal one otherwise.
 */
function setTalkingBackground(trial, isTalking) {
  const background = trial.querySelector("#background");
  const talkingBackground = trial.querySelector("#background-talking");
  if (background) background.style.display = isTalking ? "none" : "block";
  if (talkingBackground) talkingBackground.style.display = isTalking ? "block" : "none";
}

/** Make the stage background transparent, so the trial's own background picture is visible. */
function showTrialBackgrounds() {
  document.getElementById("flex-wrapper").style.backgroundColor = "transparent";
}

/** Hide the trial with the given number (trials get the ids trial0, trial1, ... on start). */
function hideTrial(trialIndex) {
  document.getElementById(`trial${trialIndex}`).style.display = "none";
}

/** Object name from a picture's file name, e.g. ".../objects/cat.svg" -> "cat". */
function objectNameFromSrc(src) {
  return src.split("/").pop().replace(".svg", "").replace(".gif", "");
}

// ---------------------------------------------------------------------------------------------------------------------
// SETUP (runs once the page is loaded)
// ---------------------------------------------------------------------------------------------------------------------
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

  // Build the audio sprites of all transition blocks
  try {
    for (const blockName of BLOCK_NAMES) {
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

  // Number the trials in page order: ids trial0, trial1, ... The prompt audio of each trial
  // gets the same id, so the speaker button can find it.
  const trials = document.querySelectorAll(".trials");
  trials.forEach((trial, index) => {
    const trialId = `trial${index}`;
    trial.id = trialId;

    const promptAudio = trial.querySelector("audio.prompt");
    if (promptAudio) {
      promptAudio.id = trialId;
    }
  });

  // Everything that is saved: meta information and one entry per response
  const responseLog = {
    meta: {
      subjID: studyChoices.ID || "testID",
      order: window.location.pathname.split("/").pop().replace(".html", ""),
      touchscreen: checkForTouchscreen(),
      webcam: studyChoices.webcam,
    },
    data: [],
  };

  // Log the participant's device and browser
  DetectRTC.load(() => {
    responseLog.meta.os = DetectRTC.osName;
    responseLog.meta.browser = DetectRTC.browser.name;
    responseLog.meta.browserVersion = JSON.stringify(DetectRTC.browser.version);
    responseLog.meta.safari = DetectRTC.browser.isSafari || false;
    responseLog.meta.iOSSafari = responseLog.meta.touchscreen && responseLog.meta.safari;

    if (devmode) console.log(responseLog.meta);
  });

  // Study state
  let trialNr = 0; // number of the next trial to show
  let responseTimerStart = 0; // when the choice became possible (ms)
  let clickTime = 0; // when the child chose a picture (ms)
  let repeatCount = 0; // how often the speaker was pressed in the current trial
  let skipResponseAudio; // true after a block was replayed with the speaker button

  // Page elements
  const betweenTrials = document.getElementById("between-trials");
  const betweenTrialsBackground = document.getElementById("between-trials-background");
  const continueButton = document.getElementById("prabat-button");
  const speakerButton = document.getElementById("speaker");
  const headingFullscreen = document.getElementById("heading-fullscreen");
  const headingTestsound = document.getElementById("heading-testsound");
  const testSound = document.getElementById("testsound");

  // The continue button reacts to one click; it is armed again for the next trial
  const waitForContinueClick = () => {
    continueButton.addEventListener("click", handleContinueClick, {
      capture: false,
      once: true,
    });
  };

  // Let the child choose one of the given pictures
  const waitForChoice = (objectImages) => {
    objectImages.forEach((img) => {
      img.style.pointerEvents = "auto";
      img.addEventListener("click", handleResponseClick, {
        capture: false,
        once: false,
      });
    });
  };

  // -------------------------------------------------------------------------------------------------------------------
  // RESPONSE CLICK: the child chose a picture
  // -------------------------------------------------------------------------------------------------------------------
  const handleResponseClick = async (event) => {
    event.preventDefault();

    // Ella and transition pictures are not answers
    if (event.target.id === "character" || event.target.id === "transition") {
      return;
    }

    const currentTrial = document.getElementById(`trial${trialNr - 1}`);
    const responseAudio = currentTrial.querySelector("audio.preResponse");

    clickTime = new Date().getTime();

    // Blue border on the chosen picture only
    Array.from(currentTrial.getElementsByTagName("img")).forEach((img) => {
      if (img !== event.target && img.id !== "character" && img.id !== "background") {
        img.style.border = "transparent";
      }
    });
    event.target.style.border = "0.3cqw solid blue";

    // Ella reacts to the choice ("Aha", "Mmh", ...); she is only shown talking for real words
    if (responseAudio) {
      const isTalking = responseAudio.src.indexOf("Mmh") === -1;
      if (isTalking) setTalkingBackground(currentTrial, true);

      continueButton.disabled = true;
      await playAudioWebAudio(responseAudio);
      setTalkingBackground(currentTrial, false);
    }

    continueButton.disabled = false;

    // Save the response (a later choice in the same trial overwrites the earlier one)
    responseLog.data[trialNr - 2] = {
      timestamp: new Date(parseInt(clickTime)).toISOString(),
      responseTime: clickTime - responseTimerStart,
      trial: trialNr,
      targetObject: objectNameFromSrc(
        currentTrial.querySelector('img[data-word-category="target"]').src
      ),
      chosenObject: objectNameFromSrc(event.target.src),
      chosenCategory: event.target.dataset.wordCategory,
      chosenPosition: event.target.closest("div").id,
      repeatCount: repeatCount,
      browser: DetectRTC.browser.name,
      OS: DetectRTC.osName,
    };

    waitForContinueClick();
  };

  // -------------------------------------------------------------------------------------------------------------------
  // CONTINUE CLICK: go to the next trial
  // -------------------------------------------------------------------------------------------------------------------
  const handleContinueClick = async (event) => {
    event.preventDefault();
    repeatCount = 0;
    if (trialNr > 0) {
      speakerButton.classList.add("disabled");
      continueButton.disabled = true;
    }

    // Trials with an <audio class="response"> play it after "continue"
    // (no trial of the current version has one)
    if (skipResponseAudio === false && trialNr > 0) {
      const previousTrial = document.getElementById(`trial${trialNr - 1}`);
      const previousResponseAudio = previousTrial
        ? previousTrial.querySelector("audio.response")
        : null;

      if (previousResponseAudio) {
        setTalkingBackground(previousTrial, true);
        await playAudioWebAudio(previousResponseAudio);
        setTalkingBackground(previousTrial, false);
      }
    }

    if (devmode) {
      console.log("trialNr", trialNr);
      console.log(allAudios[trialNr]);
      console.log(responseLog);
    }

    // First click: unlock audio, go fullscreen and play the sound test
    if (trialNr === 0) {
      unlockAudio(); // very important for Android / iOS

      if (!devmode && !responseLog.meta.iOSSafari) openFullscreen();
      headingFullscreen.style.display = "none";
      headingTestsound.style.display = "inline";
      speakerButton.style.display = "block";

      if (allAudios[trialNr]) {
        playAudioWebAudio(allAudios[trialNr]);
      }

      waitForContinueClick();
    }

    // End of trials: stop the recording, save the data, go to the goodbye page
    if (trialNr === trials.length) {
      studyChoices.ID = responseLog.meta.subjID;
      const overlay = document.querySelector("#uploadOverlay"); // full-screen spinner
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

    // Single slide with Ella talking, no choice ("transitionEmpty")
    if (currentTrial.classList.contains("transitionEmpty")) {
      betweenTrialsBackground.src = "images/backgrounds/background_empty.svg";
      headingTestsound.style.display = "none";
      hideTrial(trialNr - 1);

      const trialAudio = currentTrial.querySelector("audio.prompt");

      betweenTrials.style.display = "none";
      showTrialBackgrounds();
      currentTrial.style.display = "block";

      if (trialAudio) {
        continueButton.disabled = true;
        speakerButton.classList.add("disabled");

        await playAudioWebAudio(trialAudio);

        speakerButton.classList.remove("disabled");
        setTalkingBackground(currentTrial, false);
        waitForContinueClick();
        continueButton.disabled = false;
      }
    }

    // Transition block: play all its slides, then show its critical (choice) slide
    if (currentTrial.classList.contains("SpriteAudioTrials")) {
      const blockName = findBlockName(currentTrial);
      const slidesToSkip = SLIDES_TO_SKIP[blockName] || 0;
      showTrialBackgrounds();
      betweenTrials.style.display = "none";
      headingTestsound.style.display = "none";
      hideTrial(trialNr - 1);

      await runTransitionBlock(blockName, () => {
        const criticalTrial = document.querySelector(`.trials.${blockName}.critical`);
        hideTrial(trialNr - 1);
        criticalTrial.style.display = "block";

        if (!blockName.includes("intro")) {
          // Response time starts when the choice slide appears
          responseTimerStart = new Date().getTime();
          setTalkingBackground(criticalTrial, false);
          speakerButton.classList.remove("disabled");
          waitForChoice(Array.from(criticalTrial.querySelectorAll("img.object")));
        } else {
          // The intro has no choice: the child just continues
          speakerButton.classList.remove("disabled");
          continueButton.disabled = false;
          const background = criticalTrial.querySelector("#background");
          if (background) {
            background.style.display = "block";
          }
          waitForContinueClick();
        }
        trialNr = trialNr + slidesToSkip; // jump over the block's other slides
      });
    }

    // Normal trial: Ella asks for a picture, then the child chooses
    if (
      trialNr > 0 &&
      !currentTrial.classList.contains("transitionSlide") &&
      !currentTrial.classList.contains("transitionEmpty")
    ) {
      // Optional language-specific background pictures ("images" in the language file;
      // no language file uses this at the moment)
      const firstBackground = document.getElementById("background");
      if (firstBackground && window.localizedImages?.background) {
        firstBackground.src = window.localizedImages.background;
      }
      const firstTalkingBackground = document.getElementById("background-talking");
      if (firstTalkingBackground && window.localizedImages?.background) {
        firstTalkingBackground.src = window.localizedImages.background;
      }

      const currentTrial = document.getElementById(`trial${trialNr}`);
      headingTestsound.style.display = "none";
      hideTrial(trialNr - 1);

      const trialAudio = currentTrial.querySelector("audio.prompt");

      betweenTrials.style.display = "none";

      // Ella is shown talking during the prompt, except for "Mmh" sounds
      if (!trialAudio.src.includes("Mmh")) {
        setTalkingBackground(currentTrial, true);
      }

      showTrialBackgrounds();
      currentTrial.style.display = "block";

      // Play the prompt; the continue button stays disabled meanwhile
      if (trialAudio) {
        continueButton.disabled = true;
        await playAudioWebAudio(trialAudio);
      }

      // Response time starts when the prompt has finished
      responseTimerStart = new Date().getTime();

      setTalkingBackground(currentTrial, false);
      speakerButton.classList.remove("disabled");
      waitForChoice(Array.from(currentTrial.querySelectorAll("img.object")));
    }
    skipResponseAudio = false;
    trialNr++;
  };

  // -------------------------------------------------------------------------------------------------------------------
  // SPEAKER CLICK: play the current prompt again (counted in "repeated")
  // -------------------------------------------------------------------------------------------------------------------
  const handleSpeakerClick = async (event) => {
    event.preventDefault();
    repeatCount += 1;
    const currentTrial = document.getElementById(`trial${trialNr - 1}`);
    if (!currentTrial) return;

    const objectImages = Array.from(currentTrial.querySelectorAll("img.object"));

    // No choice possible while the prompt is replayed
    objectImages.forEach((img) => {
      img.style.pointerEvents = "none";
      img.style.border = "transparent";
    });

    if (currentTrial.classList.contains("SpriteAudioTrials")) {
      // Replay the whole transition block from its first slide
      const blockName = findBlockName(currentTrial);
      const slidesToSkip = SLIDES_TO_SKIP[blockName] || 0;
      hideTrial(trialNr - 1);
      trialNr = trialNr - (slidesToSkip + 1); // back to the block's first slide
      skipResponseAudio = true; // the next "continue" must not replay a response
      showTrialBackgrounds();
      betweenTrials.style.display = "none";
      headingTestsound.style.display = "none";

      const background = currentTrial.querySelector("#background");
      if (background) {
        background.style.display = blockName.includes("intro") ? "block" : "none";
      }
      const talkingBackground = currentTrial.querySelector("#background-talking");
      if (talkingBackground) {
        talkingBackground.style.display = "block";
      }

      continueButton.disabled = true; // no "continue" until a new choice is made
      speakerButton.classList.add("disabled");
      objectImages.forEach((img) => {
        img.style.pointerEvents = "none";
      });

      continueButton.removeEventListener("click", handleResponseClick);

      await runTransitionBlock(blockName, () => {
        const criticalTrial = document.querySelector(`.trials.${blockName}.critical`);
        hideTrial(trialNr - 1);
        criticalTrial.style.display = "block";

        if (!blockName.includes("intro")) {
          // Response time starts when the choice slide appears
          responseTimerStart = new Date().getTime();
          setTalkingBackground(criticalTrial, false);
          speakerButton.classList.remove("disabled");
          continueButton.disabled = true;
          waitForChoice(Array.from(criticalTrial.querySelectorAll("img.object")));
        } else {
          speakerButton.classList.remove("disabled");
          continueButton.disabled = false;
          const criticalBackground = criticalTrial.querySelector("#background");
          if (criticalBackground) {
            criticalBackground.style.display = "block";
          }
          waitForContinueClick();
        }
        trialNr = trialNr + (slidesToSkip + 1); // back to where we were
      });
    } else if (currentTrial.classList.contains("transitionSlide")) {
      speakerButton.disabled = true;
      return;
    } else if (currentTrial.classList.contains("transitionEmpty")) {
      const trialAudio = currentTrial.querySelector(`audio#${currentTrial.id}`);

      speakerButton.classList.add("disabled");

      if (!trialAudio) {
        console.error("No <audio> found for transitionEmpty slide:", currentTrial.id);
        return;
      }

      continueButton.disabled = true;
      setTalkingBackground(currentTrial, true);

      await playAudioWebAudio(trialAudio);

      speakerButton.classList.remove("disabled");
      continueButton.disabled = false;
      setTalkingBackground(currentTrial, false);
    } else if (currentTrial.id === "trial0") {
      // Sound test
      if (testSound) {
        playAudioWebAudio(testSound);
      } else {
        console.warn('Element with ID "testsound" not found.');
      }
    } else {
      // Normal trial: replay its prompt (the audio with the same id as the trial)
      const trialAudio = currentTrial.querySelector(`audio#${currentTrial.id}`);
      if (!trialAudio) return;

      // The continue button stays disabled until a new choice is made
      continueButton.removeEventListener("click", handleResponseClick);
      continueButton.disabled = true;

      setTalkingBackground(currentTrial, true);
      speakerButton.classList.add("disabled");

      await playAudioWebAudio(trialAudio);

      speakerButton.classList.remove("disabled");
      objectImages.forEach((img) => {
        img.style.pointerEvents = "auto";
      });
      setTalkingBackground(currentTrial, false);
    }
  };

  continueButton.addEventListener("click", handleContinueClick, {
    capture: false,
    once: true,
  });

  speakerButton.addEventListener("click", handleSpeakerClick, {
    capture: false,
    once: false,
  });

  // -------------------------------------------------------------------------------------------------------------------
  // START: give the browser time for the webcam permission, then show the start button
  // -------------------------------------------------------------------------------------------------------------------
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

    continueButton.style.display = "inline";
    continueButton.disabled = false;
  };
  startTrials();

  // DISABLED: randomised item order (see the import at the top of this file)
  // randomizeNewTrials();
});
