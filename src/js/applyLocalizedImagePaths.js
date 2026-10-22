// ---------------------------------------------------------------------------------------------------------------------
// Set the src of every <img data-img="..."> to the picture of the chosen language,
// e.g. data-img="backgrounds/background_task.svg" -> images/ger/backgrounds/background_task.svg.
// Used by prabat.js and instructions.js.
// ---------------------------------------------------------------------------------------------------------------------
import { getLanguageSettings } from "./languageSettings.js";

export const applyLocalizedImagePaths = (lang) => {
  const { imageFolder } = getLanguageSettings(lang);
  document.querySelectorAll("[data-img]").forEach((img) => {
    const relativePath = img.getAttribute("data-img");
    img.src = new URL(`images/${imageFolder}/${relativePath}`, document.baseURI).toString();
  });
};
