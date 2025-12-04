// import { pause } from "./js/pause.js";

// ./js/playAudios.js
export const allAudios = [];




// // Global state + helpers used by Safari/Android fallback:
// let audioUnlocked = false;

export function showAudioUnlockPrompt(retryFn) {
  const overlay = document.getElementById("audio-unlock-overlay");
  const btn = document.getElementById("audio-unlock-button");

  // If overlay is missing for some reason, just retry immediately
  if (!overlay || !btn) {
    if (typeof retryFn === "function") retryFn();
    return;
  }

  // Text can be localized later if you like
  btn.textContent = "🔊 Oops! Etwas ist falsch gegangen. Tippe hier, um den Ton zu starten";

  overlay.style.display = "flex";

  btn.onclick = () => {
    overlay.style.display = "none";
    if (typeof retryFn === "function") retryFn();
  };
}

// audioEl is a normal <audio> element
export function playAudio(audioEl) {
  if (!audioEl) return Promise.resolve();

  try {
    // Start from the beginning
    audioEl.pause();
    audioEl.currentTime = 0;
  } catch (e) {
    console.warn("Could not reset audio element:", e);
  }

  const playPromise = audioEl.play();

  // Modern browsers return a Promise from audio.play()
  if (playPromise && typeof playPromise.then === "function") {
    return playPromise.catch((err) => {
      console.warn("audio.play() was blocked or failed:", err);
      // Show overlay, and when the user taps, try again
      showAudioUnlockPrompt(() => playAudio(audioEl));
    });
  } else {
    // Older browsers: nothing to await, just return resolved promise
    return Promise.resolve();
  }
}


// // Optional: if you're also using Web Audio sprites,
// // install this unlock as well:
// export function unlockAudioContext(audioCtx) {
//   if (audioCtx.state !== "suspended") return;
//   const b = document.body;
//   const events = ["touchstart","touchend","mousedown","keydown"];
//   const unlock = () => audioCtx.resume().catch(()=>{}).finally(clean);
//   const clean = () => events.forEach(ev => b.removeEventListener(ev, unlock));
//   events.forEach(ev => b.addEventListener(ev, unlock, false));
// }

// export function getAudioUnlocked() {
//   return audioUnlocked;
// }
