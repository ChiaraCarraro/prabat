import { pause } from "./pause.js";

export const allAudios = [];

export async function playAudio(audio) {
  allAudios.forEach(function (a) {
    a.pause();
    a.currentTime = 0;
  });

  // audio.play();
  if (audio) {
    try {
      const playPromise = audio.play();
      if (playPromise) await playPromise;
    } catch (err) {
      console.warn("Autoplay blocked:", err);
    }
  }
  await pause(1000);
}