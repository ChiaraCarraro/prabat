// import { pause } from "./js/pause.js";

// ./js/playAudios.js
export const allAudios = [];

export function playAudio(audio) {
  // Stop all other audios
  allAudios.forEach((a) => {
    if (a && a !== audio) {
      a.pause();
      a.currentTime = 0;
    }
  });

  if (!audio) return null;

  audio.muted = false;

  try {
    const playPromise = audio.play();

    // Modern browsers: play() → Promise
    if (playPromise && typeof playPromise.then === "function") {
      return playPromise;
    }

    // Older Safari: play() returns undefined → simulate a rejection
    return Promise.reject(
      new Error("audio.play() did not return a Promise (probably older Safari)")
    );
  } catch (err) {
    // Synchronous failure (rare but possible)
    return Promise.reject(err);
  }
}
