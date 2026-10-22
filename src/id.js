// ---------------------------------------------------------------------------------------------------------------------
// ID PAGE (id.html): the participant enters a pseudonym (ID) and chooses whether the webcam
// recording should run. The start button is enabled once both are filled in.
// ---------------------------------------------------------------------------------------------------------------------
import "./css/landingpages.css";
import { loadLanguage } from "./js/loadLanguage.js";
import { setButtonState } from "./js/setButtonState.js";
import { getStudyChoices, saveStudyChoices } from "./js/studyChoices.js";

const studyChoices = getStudyChoices();
const lang = studyChoices.lang || "ger";

const startButton = document.getElementById("custom-button");
const idField = document.getElementById("participant-id");
const idCounter = document.getElementById("id-counter");

// The checked webcam radio button ("true" / "false"), or null if none is checked yet
function getCheckedWebcamOption() {
  return document.querySelector('input[name="webcam-options"]:checked');
}

function updateButtonState() {
  const id = idField.value.trim();
  if (idCounter) idCounter.textContent = `${id.length} / 8`;
  setButtonState(startButton, id.length > 0 && !!getCheckedWebcamOption());
}

function listenToWebcamOptions() {
  // Listen on the document, so it still works if the radio buttons are re-rendered later
  document.addEventListener("change", (e) => {
    if (e.target && e.target.matches('input[name="webcam-options"]')) {
      updateButtonState();
    }
  });
}

idField.addEventListener("input", updateButtonState);

startButton.addEventListener("click", (event) => {
  event.preventDefault();

  const subjID = idField.value.trim();
  const webcamOption = getCheckedWebcamOption();

  if (!subjID || !webcamOption) {
    alert("Please enter your ID and select a webcam option before continuing.");
    return;
  }

  saveStudyChoices({ ID: subjID, webcam: webcamOption.value, lang: lang });
  window.location.href = `./instructions.html`;
});

// Init
(async () => {
  setButtonState(startButton, false); // start disabled

  await loadLanguage(lang); // localization may re-render the form
  listenToWebcamOptions(); // attach after DOM is ready
  updateButtonState(); // compute once
})();
