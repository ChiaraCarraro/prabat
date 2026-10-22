// ---------------------------------------------------------------------------------------------------------------------
// Before the study starts: load every picture of the chosen language into the browser cache,
// so trials appear without delay. When all pictures are loaded (or failed), the "wait" button
// is hidden and the start button shown. Called by prabat.js.
// ---------------------------------------------------------------------------------------------------------------------
import { getLanguageSettings } from "./languageSettings.js";
import { loadAssetList } from "./loadAssetList.js";

export async function preloadImages(lang) {
  const waitButton = document.getElementById("wait-button");
  const prabatButton = document.getElementById("prabat-button");
  prabatButton.style.visibility = "hidden";

  const { imageList } = getLanguageSettings(lang);
  try {
    const urls = await loadAssetList(`images/${imageList}`);
    if (urls.length === 0) {
      console.log(`No images found in ${imageList}`);
      return;
    }
    console.log(`Found ${urls.length} images. Loading...`);

    const loads = urls.map((src) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => {
          console.log(`Failed to load ${src}`);
          resolve(); // a missing picture must not block the study
        };
        img.src = src;
      });
    });

    await Promise.all(loads);
    console.log("All images loaded!");
    waitButton.style.visibility = "hidden";
    prabatButton.style.visibility = "visible";
  } catch (err) {
    console.log("Error loading image list:", err);
  }
}
