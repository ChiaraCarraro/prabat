// ---------------------------------------------------------------------------------------------------------------------
// FUNCTION FOR LOADING LANGUAGE FILES
// ---------------------------------------------------------------------------------------------------------------------

// src/loadLanguage.js (adjust paths if this file lives in src/js/)
import ger from '../../public/lang/ger.json';
import sw  from '../../public/lang/sw.json';
import ki  from '../../public/lang/ki.json';
import en  from '../../public/lang/en.json';
import tr  from '../../public/lang/tr.json';
import ch  from '../../public/lang/ch.json';

const DICT = { ger, sw, ki, en, tr, ch };

export async function loadLanguage(langCode) {
  const translations = DICT[langCode];
  try {
    if (translations.introImages) {
        window.localizedIntroImages = translations.introImages;
    }
    if (translations.images) {
        window.localizedImages = translations.images; // store for later
    }



    // Text content
    const textElements = [
      { id: "webcam-question", key: "webcamquestion" },
      { id: "yes", key: "yes" },
      { id: "no", key: "no" },
      { id: "dataDisclaimer", key: "dataDisclaimer" },
      { id: "imageDisclaimer", key: "imageDisclaimer" },
      { id: "start-button", key: "startButton" },
      { id: "theGame", key: "theGame" },
      { id: "descriptionGame", key: "descriptionGame", html: true },
      { id: "instructionsGame", key: "instructionsGame", html: true },
      { id: "continue", key: "continue" },
      { id: "letsgo", key: "letsgo" },
      { id: "heading-fullscreen", key: "headingfullscreen" },
      { id: "enterPseudo", key: "enterPseudo" },
      { id: "noiseQuestion", key: "noiseQuestion" },
      { id: "goodbye-message", key: "goodbyeMessage", html: true },
      { id: "goodbyeVideoText", key: "goodbyeVideoText" },
      { id: "goodbyeContact", key: "goodbyeContact" },
      { id: "goodbyeSeeYou", key: "goodbyeSeeYou" },
      { id: "goodbyeSignature", key: "goodbyeSignature", html: true },
      { id: "uploadMessage", key: "uploadMessage" }
    ];

    // html: true keeps <strong>/<br> markup from the language file
    textElements.forEach(({ id, key, html }) => {
      const el = document.getElementById(id);
      if (el && translations[key] !== undefined) {
        if (html) {
          el.innerHTML = translations[key];
        } else {
          el.innerText = translations[key];
        }
      }
    });
    //document.getElementById("fullscreen_3").innerText = translations.fullscreen_instructions_3;
    //document.getElementById("fullscreen_4").innerText = translations.fullscreen_instructions_4;

    //document.getElementById("test_sound").innerText = translations.test_sound;
    //document.getElementById("test_sound_sub").innerText = translations.test_sound_sub;
    //document.getElementById("start_game").innerText = translations.start_game;
    //document.getElementById("continue_button_text").innerText = translations.button_continue;

    // Image content
    if (translations.images) {
      for (const [id, path] of Object.entries(translations.images)) {
        console.log(`Attempting to update image: id=${id}, src=${path}`);
        const imgEl = document.getElementById(id);
        if (imgEl) {
          imgEl.src = path;
        } else {
          console.warn(`No <img> with id="${id}" found in the DOM.`);
        }
      }
    }


  } catch (err) {
    console.error("Language load failed", err);
  }
}
