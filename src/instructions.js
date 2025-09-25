import "./css/landingpages.css";
import { loadLanguage } from "./js/loadLanguage.js"; // adjust path as needed
import { applyLocalizedImagePaths } from "./js/applyLocalizedImagePaths.js"; // adjust path as needed

const button = document.getElementById("instructions-button");

// Get language from URL
const params = new URLSearchParams(window.location.search);
let lang;

// Extract ID and webcam from stored choices
const storedChoices = localStorage.getItem("storedChoices");
let studyChoices;
let webcam;
let subjID;

if (storedChoices) {
  studyChoices = JSON.parse(storedChoices);
  lang = studyChoices?.lang || "ger";
  webcam = studyChoices?.webcam || "false";
  subjID = studyChoices?.ID || "testID";

} else {
  console.error("No data found in local storage");
  lang = params.get("lang") || "ger";
  webcam =
    new URL(document.location.href).searchParams.get('webcam') || "false";
  subjID =
  new URL(document.location.href).searchParams.get('ID') || 'testID';
}

// Load localized text/images
(async () => {
  await loadLanguage(lang);
})();


applyLocalizedImagePaths(lang);



// On continue, forward to prabat.html with language in URL
const handleContinueClick = (event) => {
  event.preventDefault();
  studyChoices.ID = subjID ?? "testID";
  studyChoices.webcam = webcam ?? "false";
  studyChoices.lang = lang ?? "ger";
  localStorage.setItem("storedChoices", JSON.stringify(studyChoices));
  window.location.href = `./prabat.html`;
};

button.addEventListener("click", handleContinueClick);
