export const applyLocalizedImagePaths = (lang) => {
  let folder;
  if (lang === "ki" || lang === "sw") {
    folder = "ki";
  } if (lang === "ger" || lang === "en") {
    folder = "ger";
  } else if (lang === "tr") {
    folder = "tr";
  }
  const allImgs = document.querySelectorAll("[data-img]");
  allImgs.forEach(img => {
    const relPath = img.getAttribute("data-img");
    img.src = new URL(`images/${folder}/${relPath}`, document.baseURI).toString();
  });
}