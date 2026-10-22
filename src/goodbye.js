// ---------------------------------------------------------------------------------------------------------------------
// GOODBYE PAGE (goodbye.html): shown after the study; only needs the texts in the chosen language.
// ---------------------------------------------------------------------------------------------------------------------
import "./css/landingpages.css";
import { loadLanguage } from "./js/loadLanguage.js";
import { getStudyChoices } from "./js/studyChoices.js";

const lang = getStudyChoices().lang ?? "ger";

(async () => {
  await loadLanguage(lang);
})();
