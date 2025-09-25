import "./css/landingpages.css";
import { loadLanguage } from "./js/loadLanguage.js";
import { setButtonState } from "./js/setButtonState.js";

const button = document.getElementById("custom-button");
const textField = document.getElementById("participant-id");
const idCounter = document.getElementById("id-counter");

function getWebcamSelected() {
  return !!document.querySelector('input[name="webcam-options"]:checked');
}

function getWebcamValue() {
  const el = document.querySelector('input[name="webcam-options"]:checked');
  return el ? el.value : "false";
}

function updateButtonState() {
  const idVal = textField.value.trim();
  if (idCounter) idCounter.textContent = `${idVal.length} / 8`;
  setButtonState(button, idVal.length > 0 && getWebcamSelected());
}

function wireUpWebcamHandlers() {
  // Delegate so it still works if radios are re-rendered later
  document.addEventListener("change", (e) => {
    if (e.target && e.target.matches('input[name="webcam-options"]')) {
      updateButtonState();
    }
  });
}

textField.addEventListener("input", updateButtonState);

button.addEventListener("click", (event) => {
  event.preventDefault();

  const subjID = textField.value.trim();
  const webcamSelected = getWebcamSelected();

  if (!subjID || !webcamSelected) {
    alert("Please enter your ID and select a webcam option before continuing.");
    return;
  }

  const webcam = getWebcamValue();
  const params = new URLSearchParams(window.location.search);
  const lang = params.get("lang");

  localStorage.setItem("storedChoices", JSON.stringify({ ID: subjID, webcam: webcam, lang: lang }));
  window.location.href = `./instructions.html?lang=${lang}&ID=${subjID}&webcam=${webcam}`;
});

// Init
(async () => {
  setButtonState(button, false);     // start disabled
  const params = new URLSearchParams(window.location.search);
  const lang = params.get("lang") || "en";

  await loadLanguage(lang);          // localization may re-render the form
  wireUpWebcamHandlers();            // attach after DOM is ready
  updateButtonState();               // compute once
})();
