export async function preloadAudios(lang) {
  const waitButton = document.getElementById("wait-button");
  const prabatButton = document.getElementById("prabat-button");
  prabatButton.style.display = 'none';
  // prabatButton.style.visibility = 'visible';
  try {
      let audioJsonName;
      if (lang === "ki") {
        audioJsonName = "audio-ki.json"
      } else if (lang === "sw") {
        audioJsonName = "audio-sw.json"
      } else if (lang === "ger" || lang === "en" ) {
        audioJsonName = "audio-ger.json"
      } else if ( lang === "tr") {
        audioJsonName = "audio-tr.json"
      }
  
    // Build URL relative to current document so it works under subpaths
    const jsonUrl = new URL(`audio/${audioJsonName}`, document.baseURI).toString();
    const response = await fetch(jsonUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${response.url} (status ${response.status})`);
    }
    const audioList = await response.json();

    // Normalize audio URLs to work under any base path (subfolder deployments)
    const normalizedList = audioList.map((p) => {
      try {
        const pathStr = String(p).trim();
        if (/^https?:\/\//i.test(pathStr)) return pathStr;
        // join with current document path while handling leading slashes
        return new URL(pathStr.replace(/^\//, ''), document.baseURI).href;
      } catch (_) {
        return p;
      }
    });

    if (!Array.isArray(audioList) || audioList.length === 0) {
      console.log(`No audio found in ${audioJsonName}`);
      console.log(`No audio found!`);
      return;
    }
    console.log(`Found ${audioList.length} audio. Checking HTTP status...`);

    // Check each audio URL with a HEAD request, track progress
    let checked = 0;
    const total = normalizedList.length;
    const checkPromises = normalizedList.map(async (src) => {
      try {
        const res = await fetch(src, { method: 'HEAD', cache: 'no-store' });
        checked++;
        if (!res.ok) {
          //console.log(`OK ${res.status}: ${src} (${checked}/${total})`);
          console.warn(`FAIL ${res.status}: ${src} (${checked}/${total})`);
        } 
      }
      catch (e) {
        checked++;
        console.warn(`ERR: ${src} (${checked}/${total})`, e);
      }
    });

    // Wait for all to complete
    await Promise.all(checkPromises);
    console.log("Audio status checks complete.");
    waitButton.style.display = 'none';
    prabatButton.style.display = 'inline';

  } catch (err) {
    console.log("Error loading audio.json:", err);
    console.log("Error loading audio list.");
  }
}