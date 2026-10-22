// ---------------------------------------------------------------------------------------------------------------------
// Before the study starts: check that every audio file of the chosen language can be reached
// (a quick HEAD request per file; problems are logged as warnings). When all checks are done,
// the "wait" button is replaced by the start button. Called by prabat.js.
// ---------------------------------------------------------------------------------------------------------------------
import { getLanguageSettings } from "./languageSettings.js";
import { loadAssetList } from "./loadAssetList.js";

export async function preloadAudios(lang) {
  const waitButton = document.getElementById("wait-button");
  const prabatButton = document.getElementById("prabat-button");
  prabatButton.style.display = "none";

  const { audioList } = getLanguageSettings(lang);
  try {
    const urls = await loadAssetList(`audio/${audioList}`);
    if (urls.length === 0) {
      console.log(`No audio found in ${audioList}`);
      return;
    }
    console.log(`Found ${urls.length} audio. Checking HTTP status...`);

    let checked = 0;
    const total = urls.length;
    const checks = urls.map(async (src) => {
      try {
        const response = await fetch(src, { method: "HEAD", cache: "no-store" });
        checked++;
        if (!response.ok) {
          console.warn(`FAIL ${response.status}: ${src} (${checked}/${total})`);
        }
      } catch (e) {
        checked++;
        console.warn(`ERR: ${src} (${checked}/${total})`, e);
      }
    });

    await Promise.all(checks);
    console.log("Audio status checks complete.");
    waitButton.style.display = "none";
    prabatButton.style.display = "inline";
  } catch (err) {
    console.log("Error loading audio list:", err);
  }
}
