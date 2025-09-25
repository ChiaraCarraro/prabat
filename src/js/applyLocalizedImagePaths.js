export const applyLocalizedImagePaths = (lang) => {
  let folder;
  if (lang === "ki" || lang === "sw") {
    folder = "ki";
  } else if (lang === "ger" || lang === "en" || lang === "tr") {
    folder = "ger";
  }
  const allImgs = document.querySelectorAll("[data-img]");
  allImgs.forEach(img => {
    const relPath = img.getAttribute("data-img");
    img.src = `images/${folder}/${relPath}`;
    console.log(`Setting image src to: ${img.src}`);
  });
}