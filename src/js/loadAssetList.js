// ---------------------------------------------------------------------------------------------------------------------
// Load a list of asset files (a JSON array of paths such as "audio/ger/cat.mp3") and turn every
// path into a full URL. Paths are resolved against the page's <base>, so the study also works
// when it is installed in a sub folder of the web server. Used by preloadAudios.js and preloadImages.js.
// ---------------------------------------------------------------------------------------------------------------------
export async function loadAssetList(listPath) {
  const response = await fetch(new URL(listPath, document.baseURI).toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch ${response.url} (status ${response.status})`);
  }
  const paths = await response.json();

  const urls = paths.map((path) => {
    try {
      const pathString = String(path).trim();
      if (/^https?:\/\//i.test(pathString)) return pathString;
      return new URL(pathString.replace(/^\//, ""), document.baseURI).href;
    } catch (_) {
      return path;
    }
  });

  return urls;
}
