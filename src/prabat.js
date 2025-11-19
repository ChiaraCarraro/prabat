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

const storedChoices = localStorage.getItem("storedChoices");
let studyChoices;
if (storedChoices) {
  studyChoices = JSON.parse(storedChoices);
} else {
  console.error("No data found in local storage");
}
const lang = studyChoices?.lang || "ger"; // fallback to English

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

  const devmode = false;

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
  const allAudios = document.getElementsByTagName("audio");
  const betweenTrials = document.getElementById("between-trials");
  const betweenTrialsBackground = document.getElementById(
    "between-trials-background"
  );
  const button = document.getElementById("prabat-button");
  const speaker = document.getElementById("speaker");
  const headingFullscreen = document.getElementById("heading-fullscreen");
  const headingTestsound = document.getElementById("heading-testsound");
  let skipAdvance;
  //------------------------------------------------------------------
  // define response click
  //------------------------------------------------------------------
  const handleResponseClick = async (event) => {
    event.preventDefault();

    // Prevent clicks on the img element with id="character"
    if (event.target.id === "character" || event.target.id === "transition") {
      return;
    }

    t1 = new Date().getTime();

    const currentTrial = document.getElementById(`trial${trialNr - 1}`);
    const currentImages = Array.from(currentTrial.getElementsByTagName("img"));
    currentImages.forEach((img) => {
      if (img.id !== "character" && img.id !== "background") {
        img.style.border = "transparent";
      }
    });

    event.target.style.border = "0.3vw solid blue";

    // Play the audio with id "response" if it exists
    const responseAudio = currentTrial.querySelector('audio.preResponse');
    if (responseAudio) {
      // Disable the button while audio is playing
      button.disabled = true;
      button.style.backgroundColor = "hsl(199, 100%, 21%)";
      responseAudio.play();
      const backgroundImg = currentTrial.querySelector("#background");
      // show the image with id "background-talking"
      const backgroundTalkingImg = currentTrial.querySelector("#background-talking");
      if (!responseAudio.src.includes("Mmh")) {
        backgroundImg.style.display = "none";
        backgroundTalkingImg.style.display = "block";
      }

      responseAudio.onended = () => {
        // Re-enable the button when audio ends
        button.disabled = false;
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

    // save response
    // trial - 2 since array starts at zero (-1) and continue click already advanced trial count (-1)
    responseLog.data[trialNr - 2] = {
      timestamp: new Date(parseInt(t1)).toISOString(),
      responseTime: t1 - t0,
      trial: trialNr,
      targetObject: currentTrial.querySelector('img[data-word-category="target"]').src
      .split("/")
      .pop()
      .replace('.svg', '')
      .replace('.gif', ''),
      chosenObject: event.target.src
      .split("/")
      .pop()
      .replace('.svg', '')
      .replace('.gif', ''),
      chosenCategory: event.target.dataset.wordCategory,
      chosenPosition: event.target.closest('div').id,
    };

    button.addEventListener("click", handleContinueClick, {
      capture: false,
      once: true,
    });
  };

  //------------------------------------------------------------------
  // define continue click
  //------------------------------------------------------------------
  const handleContinueClick = async (event) => {
    event.preventDefault();

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
          prevResponseAudio.play();
        });
        await pause(1000);
      }
    }

    if (devmode) {
      console.log("trialNr", trialNr);
      console.log(allAudios[trialNr]);
      console.log(responseLog);
    }

    // console.log(skipAdvance);
    // if (skipAdvance) {
    //   skipAdvance = false; // consume the flag so future continues behave normally
    // } else {
    //   trialNr++;
    // }

    // enable fullscreen and have short break, before first trial starts
    if (trialNr === 0) {
      if (!devmode & !responseLog.meta.iOSSafari);
      openFullscreen();
      headingFullscreen.style.display = "none";
      headingTestsound.style.display = "inline";
      speaker.style.display= "block";
      await pause(1000);
      // for safari, first sound needs to happen on user interaction
      allAudios[trialNr].play();

      await pause(1000);

      button.addEventListener("click", handleContinueClick, {
        capture: false,
        once: true,
      });
    }

    // end of trials
    if (trialNr === trialDivs.length) {

      await stopRecording();
      await uploadData(responseLog.data, responseLog.meta.subjID);
      await pause(3000);
      await downloadData(responseLog.data, responseLog.meta.subjID);
      await pause(3000);
      await downloadVideo(
        responseLog.meta.webcam,
        responseLog.meta.subjID,
      );
      await pause(2000);
      await uploadVideo(
        responseLog.meta.webcam,
        responseLog.meta.subjID,
      );
      await pause(3000);
      studyChoices.ID = responseLog.meta.subjID;
      window.location.href = `./goodbye.html`;
    }

    // Story

    if (trialNr === 1) {
      const images = window.localizedIntroImages 


      let currentIndex = 0;
      const imgElement = document.getElementById("background-start");

      function showNextImage() {
        const currentImage = images[currentIndex];

        imgElement.src = currentImage;

        if (currentImage.includes("start_1_waving")) {
          setTimeout(showNextImage, 3000);
        } else if (currentImage.includes("start_1")) {
          setTimeout(showNextImage, 2000);
        } else if (currentImage.includes("start_2_house")) {
          setTimeout(showNextImage, 4000);
        } else if (currentImage.includes("start_3_parents")) {
          setTimeout(showNextImage, 4000);
        } else if (currentImage.includes("start_3_friends")) {
        }

        currentIndex++;

      }

      showNextImage(); // Start the slideshow

      button.addEventListener("click", handleContinueClick, {
        capture: false,
        once: true,
      });
    }

    const currentTrial = document.getElementById(`trial${trialNr}`);

    // transition images for trials that need multiple slides

    if (currentTrial.classList.contains("transitionSlide")) {
      console.log(286);
      betweenTrialsBackground.src = "images/backgrounds/background_empty.svg";
      headingTestsound.style.display = "none";
      // pause audio (that might be playing if speaker item was clicked and prompt was repeated)
      allAudios[trialNr - 1].pause();
      allAudios[trialNr - 1].currentTime = 0;
      const lastTrial = document.getElementById(`trial${trialNr - 1}`);
      lastTrial.style.display = "none";

      // betweenTrials.style.display = "flex";
      // betweenTrialsBackground.style.opacity = 1;
      //await pause(150);

      const trialAudio = currentTrial.querySelector("audio.prompt");

      if (currentTrial.classList.contains("silent") == false) {
        // play audio of current trial
        if (trialAudio) {
          trialAudio.play();
          console.log(trialAudio);
        }
      }

      //await pause(0);

      // save response time start point
      //t0 = new Date().getTime();

      betweenTrials.style.display = "none";

      //document.body.style.backgroundImage = "url('images/backgrounds/background01.png')";
      document.body.style.backgroundSize = "cover";
      document.body.style.backgroundPosition = "center";
      const flexWrapper = document.getElementById("flex-wrapper");
      flexWrapper.style.backgroundColor = "transparent";
      //betweenTrials.style.display = 'none';

      currentTrial.style.display = "block";
      console.log(currentTrial);

      if (currentTrial.classList.contains("silent")) {
        // Wait for the animation to end, then continue
        currentTrial.addEventListener(
          "animationend",
          async () => {
            await pause(100);
            handleContinueClick(new Event("click"));
          },
          { once: true }
        );
      } else {
        trialAudio.onended = async () => {
          await pause(100);
          handleContinueClick(new Event("click"));
        };
      }
    }

    // hide last Trial, show background (empty pictures) instead
    if (
      trialNr > 0 &&
      currentTrial.classList.contains("transitionSlide") == false
    ) {
      const imgEl = document.getElementById("background");
      if (imgEl && window.localizedImages?.background) {
        imgEl.src = window.localizedImages.background;
      }

      const imgElTalk = document.getElementById("background-talking");
      if (imgEl && window.localizedImages?.background) {
        imgElTalk.src = window.localizedImages.background;
      }

      const currentTrial = document.getElementById(`trial${trialNr}`);
      headingTestsound.style.display = "none";
      // pause audio (that might be playing if speaker item was clicked and prompt was repeated)
      allAudios[trialNr - 1].pause();
      allAudios[trialNr - 1].currentTime = 0;
      const lastTrial = document.getElementById(`trial${trialNr - 1}`);
      lastTrial.style.display = "none";
      

      const trialAudio = currentTrial.querySelector("audio.prompt");
      const audioSrc = (trialAudio.src);

      // play audio of current trial
      // Play the audio element contained in currentTrial
      
      if (trialAudio) {
        trialAudio.play();
        console.log("This is:", trialAudio);
        console.log("This is:", audioSrc);
      }

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

      //document.body.style.backgroundImage = "url('images/backgrounds/background01.png')";
      //document.body.style.backgroundSize = "cover";
      //document.body.style.backgroundPosition = "center";
      const flexWrapper = document.getElementById("flex-wrapper");
      flexWrapper.style.backgroundColor = "transparent";
      //betweenTrials.style.display = 'none';

      currentTrial.style.display = "block";

      const currentImages = Array.from(currentTrial.querySelectorAll("img.object"));
      console.log(currentImages);

      trialAudio.onended = () => {
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
        console.log("before adding event listener")
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
  // define speaker click
  //------------------------------------------------------------------
  // const handleSpeakerClick = async (event) => { 
  //   event.preventDefault(); 
  //   // use trial - 1 since the trial count already went up in the continue click function 
  //   // pause audio 
  //   if (trialNr > 1) { 
  //     allAudios[trialNr].pause(); 
  //     allAudios[trialNr].currentTime = 0;
  //   } // play audio of current trial 
  //   allAudios[trialNr].play(); 
  // };

  //let skipAdvance = false;

  const handleSpeakerClick = async (event) => {
    event.preventDefault();
    const currentTrial = document.getElementById(`trial${trialNr - 1}`);
    console.log(currentTrial);
    if (!currentTrial) return;
    
    if (currentTrial.classList.contains("Informativeness")) {
      trialNr = trialNr - 4;             // point to the trial you want
      skipAdvance = true;                 // don’t auto ++ on this pass

      const button = document.getElementById("prabat-button");
      if (button) {
        // reattach the listener because it was added with { once: true }
        button.removeEventListener("click", handleContinueClick);
        button.addEventListener("click", handleContinueClick, { capture: false, once: true });
        button.click();
        currentTrial.style.display = "none";
      }
      return;
    } else if (currentTrial.classList.contains("EmotionalProsody")) {
      trialNr = trialNr - 4;             // point to the trial you want
      skipAdvance = true;                 // don’t auto ++ on this pass

      const button = document.getElementById("prabat-button");
      if (button) {
        // reattach the listener because it was added with { once: true }
        button.removeEventListener("click", handleContinueClick);
        button.addEventListener("click", handleContinueClick, { capture: false, once: true });
        button.click();
        currentTrial.style.display = "none";
      }
      return;
    } else if (currentTrial.classList.contains("SpeakersPreference")) {
      trialNr = trialNr - 6;             // point to the trial you want
      skipAdvance = true;                 // don’t auto ++ on this pass

      const button = document.getElementById("prabat-button");
      if (button) {
        // reattach the listener because it was added with { once: true }
        button.removeEventListener("click", handleContinueClick);
        button.addEventListener("click", handleContinueClick, { capture: false, once: true });
        button.click();
        currentTrial.style.display = "none";
      }
      return;
    } else if (currentTrial.classList.contains("DiscourseNovelty")) {
      trialNr = trialNr - 6;             // point to the trial you want
      skipAdvance = true;                 // don’t auto ++ on this pass

      const button = document.getElementById("prabat-button");
      if (button) {
        // reattach the listener because it was added with { once: true }
        button.removeEventListener("click", handleContinueClick);
        button.addEventListener("click", handleContinueClick, { capture: false, once: true });
        button.click();
        currentTrial.style.display = "none";
      }
      return;
    } else if (currentTrial.classList.contains("ConversationalPerspectiveTaking")) {
      trialNr = trialNr - 3;             // point to the trial you want
      skipAdvance = true;                 // don’t auto ++ on this pass

      const button = document.getElementById("prabat-button");
      if (button) {
        // reattach the listener because it was added with { once: true }
        button.removeEventListener("click", handleContinueClick);
        button.addEventListener("click", handleContinueClick, { capture: false, once: true });
        button.click();
        currentTrial.style.display = "none";
      }
      return;
    } else if (currentTrial.classList.contains("ListenerConversationalPerspectiveTaking")) {
      trialNr = trialNr - 2;             // point to the trial you want
      skipAdvance = true;                 // don’t auto ++ on this pass

      const button = document.getElementById("prabat-button");
      if (button) {
        // reattach the listener because it was added with { once: true }
        button.removeEventListener("click", handleContinueClick);
        button.addEventListener("click", handleContinueClick, { capture: false, once: true });
        button.click();
        currentTrial.style.display = "none";
      }
      return;
    } else if (currentTrial.classList.contains("IndirectRequest")) {
      trialNr = trialNr - 2;             // point to the trial you want
      skipAdvance = true;                 // don’t auto ++ on this pass

      const button = document.getElementById("prabat-button");
      if (button) {
        // reattach the listener because it was added with { once: true }
        button.removeEventListener("click", handleContinueClick);
        button.addEventListener("click", handleContinueClick, { capture: false, once: true });
        button.click();
        currentTrial.style.display = "none";
      }
      return;
    } else if (currentTrial.classList.contains("Gesture")) {
      trialNr = trialNr - 2;             // point to the trial you want
      skipAdvance = true;                 // don’t auto ++ on this pass

      const button = document.getElementById("prabat-button");
      if (button) {
        // reattach the listener because it was added with { once: true }
        button.removeEventListener("click", handleContinueClick);
        button.addEventListener("click", handleContinueClick, { capture: false, once: true });
        button.click();
        currentTrial.style.display = "none";
      }
      return;
    } else if (currentTrial.classList.contains("transitionSlide")) {
      const speakerButton = document.getElementById("speaker");
      if (speakerButton) {
        speakerButton.disabled = true;     // make it inactive
      }
      return;
    } else if (currentTrial.id === "trial0") {
      const testSoundElement = document.getElementById('testsound');
      if (testSoundElement) {
        testSoundElement.play();
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

      // // stop any currently playing audio (if you're using global lastPlayed)
      // if (!trialAudio.paused) {
      //   trialAudio.pause();
      //   trialAudio.currentTime = 0;
      // }

      // (re)start the audio
      trialAudio.currentTime = 0;
      await trialAudio.play();
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

      trialAudio.onended = () => {
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



      // trialAudio.onended = () => {
      //     // Show the image with id "background"
      //     const backgroundImg = currentTrial.querySelector("#background");
      //     if (backgroundImg) {
      //       backgroundImg.style.display = "block";
      //     }
      //     // Hide the image with id "background-talking"
      //     if (backgroundTalkingImg) {
      //       backgroundTalkingImg.style.display = "none";
      //     }
      //   };
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
    //if (!responseLog.meta.iOSSafari && responseLog.meta.webcam === "true") {
    if (!isMediaRecorderSupported()) {
    console.log("MediaRecorder is not supported in this browser.");
    }
    else if (responseLog.meta.webcam === "true") {
      try {
        console.log("Requesting camera/microphone...");
        await initMedia();
        console.log("Camera ready. You can start recording.");

        startRecording({
        audio: true,
        video: {
          frameRate: {
            min: 10,
            ideal: 25,
            max: 30,
          },
          width: {
            min: 640,
            ideal: 1280,
            max: 1920,
          },
          height: {
            min: 480,
            ideal: 720,
            max: 1080,
          },
          facingMode: "user",
        },
      });
      console.log("Recording started.");
      } catch (error) {
        console.error("Failed to access camera/microphone:", error);
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
