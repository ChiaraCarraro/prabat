export async function preloadImages(lang) {
  const waitButton = document.getElementById("wait-button");
  const prabatButton = document.getElementById("prabat-button");
  prabatButton.style.visibility = 'hidden';
  // prabatButton.style.visibility = 'visible';
  try {
      let imageJsonName;
      if (lang === "ki" || lang === "sw") {
        imageJsonName = "images-ki.json"
      } else if (lang === "ger" || lang === "en" || lang === "tr") {
        imageJsonName = "images-ger.json"
      }
  
    // Build URL relative to current document so it works under subpaths
    const url = document.baseURI.toString() + `images/${imageJsonName}`
    console.log("document:"+ url);
    //const jsonUrl = new URL(`images/${imageJsonName}`, document.baseURI).toString();
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${response.url} (status ${response.status})`);
    }
    const imageList = await response.json();

    // Normalize image URLs to work under any base path (subfolder deployments)
    const normalizedList = imageList.map((p) => {
      try {
        const pathStr = String(p).trim();
        if (/^https?:\/\//i.test(pathStr)) return pathStr;
        // join with current document path while handling leading slashes
        return new URL(pathStr.replace(/^\//, ''), document.baseURI).href;
      } catch (_) {
        return p;
      }
    });

    if (!Array.isArray(imageList) || imageList.length === 0) {
      console.log(`No images found in ${imageJsonName}`);
      console.log(`No images found!`);
      return;
    }
    console.log(`Found ${imageList.length} images. Loading...`);

    //Preload all images and track progress
    let loaded = 0;
    const total = imageList.length;

    const preloadPromises = normalizedList.map(src => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          loaded++;
          //console.log(`Loaded ${loaded}/${total}`);
          resolve();
        };
        img.onerror = () => {
          console.log(`Failed to load ${src}`);
          loaded++;
          //console.log(`Loaded ${loaded}/${total} (some failed)`);
          resolve(); // still resolve, don’t block
        };
        img.src = src;
      });
    });

    // Wait for all to complete
    await Promise.all(preloadPromises);
    console.log("All images loaded!");
    waitButton.style.visibility = 'hidden';
    prabatButton.style.visibility = 'visible';

  } catch (err) {
    console.log("Error loading images.json:", err);
    console.log("Error loading image list.");
  }
}