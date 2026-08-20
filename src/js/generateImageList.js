// generateImageList.js
import fs from 'fs'
import path from 'path'

/**
 * Returns a list of image file paths for the given language.
 * @param {string} lang - Language folder (e.g., 'ger', 'eng')
 * @returns {string[]} List of image paths
 */
export function getImageList(lang = "tr") {
  try {
    const folder = path.join("images", lang);
    const files = fs.readdirSync(folder);

    const imageList = files
      .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
      .map(f => `images/${lang}/${f}`);

    return imageList;
  } catch (err) {
    console.error("Error reading image folder:", err);
    return [];
  }
}
