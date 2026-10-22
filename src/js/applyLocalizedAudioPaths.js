export const applyLocalizedAudioPaths = (lang) => {
  const allAudios = document.querySelectorAll("[data-audio]");
  allAudios.forEach((audio) => {
    const relPath = audio.getAttribute("data-audio");
    audio.src = `audio/${lang}/${relPath}`;
  });
};
