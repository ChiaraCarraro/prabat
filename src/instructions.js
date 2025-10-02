import "./css/landingpages.css";
import { loadLanguage } from "./js/loadLanguage.js"; // adjust path as needed

let studyChoices;
const storedChoices = localStorage.getItem("storedChoices");
if (storedChoices) {
  studyChoices = JSON.parse(storedChoices);
} else {
  console.error("No data found in local storage");
}

const button = document.getElementById("instructions-button");

// Get language from URL
const lang = studyChoices?.lang || "ger";
  
// Load localized text/images
(async () => {
  await loadLanguage(lang);
})();

function applyLocalizedImagePaths(lang) {
  let folder;
  if (lang === "ki" || lang === "sw") {
    folder = "ki";
  } else if (lang === "ger" || lang === "en" || lang === "tr") {
    folder = "ger";
  } else {
    folder = lang;
  }
  const allImgs = document.querySelectorAll("[data-img]");
  allImgs.forEach(img => {
    const relPath = img.getAttribute("data-img");
    img.src = `images/${folder}/${relPath}`;
    console.log(`Setting image src to: ${img.src}`);
  });
}

applyLocalizedImagePaths(lang);

studyChoices.ID = studyChoices?.ID ?? "testID";
studyChoices.webcam = studyChoices?.webcam ?? false;
studyChoices.lang = studyChoices?.lang ?? "ger";

// On continue, forward to prabat.html with language in URL
const handleContinueClick = (event) => {
  event.preventDefault();
  localStorage.setItem("storedChoices", JSON.stringify(studyChoices));
  window.location.href = `./prabat.html`;
};

button.addEventListener("click", handleContinueClick);
