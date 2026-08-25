// import { pause } from "./js/pause.js";

// ./js/playAudios.js
import { routeElementToMix } from "./recordingAudioMix.js";

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

// js/playAudios.js
// audioEl: a normal <audio> element
export function playAudio(audioEl) {
  if (!audioEl) return Promise.resolve();

  // Route this element's output into the shared recording mix
  // (in addition to its normal speaker output), so the webcam
  // recording captures the stimulus audio clearly too.
  routeElementToMix(audioEl);

  // IMPORTANT: do NOT pause()/currentTime=0 here.
  // Safari can throw AbortError if we keep resetting.
  const playPromise = audioEl.play();

  if (playPromise && typeof playPromise.then === "function") {
    return playPromise.catch((err) => {
      console.warn("audio.play() was blocked or failed:", err.name, err.message);

      // 1) Autoplay block (what we really want the overlay for)
      if (err.name === "NotAllowedError" || err.name === "SecurityError") {
        // Show overlay ONCE, and on user tap, just try a simple play()
        showAudioUnlockPrompt(() => {
          audioEl.play().catch((e) => {
            console.warn("Retry after unlock still failed:", e.name, e.message);
          });
        });
        return;
      }

      // 2) AbortError = Safari aborted the previous play (often harmless)
      //    Do NOT show the overlay again – it just loops.
      if (err.name === "AbortError") {
        console.warn("Ignoring AbortError from audio.play()");
        return;
      }

      // 3) Anything else: just log
      console.warn("Unhandled audio.play() error:", err);
    });
  }

  // Older browsers: no Promise support
  return Promise.resolve();
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
