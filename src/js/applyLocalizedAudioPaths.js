// ---------------------------------------------------------------------------------------------------------------------
// Set the src of every <audio data-audio="..."> to the recording of the chosen language,
// e.g. data-audio="cat.mp3" -> audio/ger/cat.mp3. Used by prabat.js.
// ---------------------------------------------------------------------------------------------------------------------
export const applyLocalizedAudioPaths = (lang) => {
  document.querySelectorAll("[data-audio]").forEach((audio) => {
    const fileName = audio.getAttribute("data-audio");
    audio.src = `audio/${lang}/${fileName}`;
  });
};
