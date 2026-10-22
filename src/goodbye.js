import "./css/landingpages.css";
import { loadLanguage } from "./js/loadLanguage.js";

// Load the language chosen on the start page
const storedChoices = localStorage.getItem("storedChoices");
let studyChoices;
if (storedChoices) {
  studyChoices = JSON.parse(storedChoices);
} else {
  console.error("No data found in local storage");
}

const lang = studyChoices?.lang ?? "ger";

(async () => {
  await loadLanguage(lang);
})();
