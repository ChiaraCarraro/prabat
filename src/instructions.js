// ---------------------------------------------------------------------------------------------------------------------
// INSTRUCTIONS PAGE (instructions.html): shows the instructions in the chosen language,
// then continues to the study (prabat.html).
// ---------------------------------------------------------------------------------------------------------------------
import "./css/landingpages.css";
import { loadLanguage } from "./js/loadLanguage.js";
import { applyLocalizedImagePaths } from "./js/applyLocalizedImagePaths.js";
import { getStudyChoices, saveStudyChoices } from "./js/studyChoices.js";

// The page can also be opened directly with URL parameters,
// e.g. instructions.html?lang=ger&ID=P001&webcam=true. Then save them as the participant's
// choices and remove them from the address bar.
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.toString()) {
  saveStudyChoices(Object.fromEntries(urlParams));
  window.history.replaceState(null, document.title, window.location.pathname);
}

// Fill in defaults for anything that is missing
const studyChoices = getStudyChoices();
studyChoices.ID = studyChoices.ID ?? "testID";
studyChoices.webcam = (studyChoices.webcam === "true").toString();
studyChoices.lang = studyChoices.lang ?? "ger";
const lang = studyChoices.lang;

(async () => {
  await loadLanguage(lang);
})();
applyLocalizedImagePaths(lang);

document.getElementById("instructions-button").addEventListener("click", (event) => {
  event.preventDefault();
  saveStudyChoices(studyChoices);
  window.location.href = `./prabat.html`;
});
