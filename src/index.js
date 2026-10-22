// ---------------------------------------------------------------------------------------------------------------------
// START PAGE (index.html): the participant picks a language, then continues to id.html.
// ---------------------------------------------------------------------------------------------------------------------
import "./css/landingpages.css";
import { saveStudyChoices } from "./js/studyChoices.js";

const languageSelect = document.getElementById("language-select");
const startButton = document.getElementById("start-button");

startButton.addEventListener("click", (event) => {
  event.preventDefault();
  // Start a fresh set of choices with only the language; id.html adds ID and webcam choice
  saveStudyChoices({ lang: languageSelect.value });
  window.location.href = `./id.html`;
});
