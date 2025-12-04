// js/sharedAudioContext.js
// ----------------------------------------------------------
// One shared AudioContext for the whole app.
// Every sprite block (and any future WebAudio feature) should
// use this instead of creating a new AudioContext.
// ----------------------------------------------------------

let sharedCtx = null;

export function getSharedAudioContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;

  if (!AudioCtx) {
    console.warn("Web Audio API is not supported in this browser.");
    return null;
  }

  if (!sharedCtx) {
    sharedCtx = new AudioCtx();
  }

  return sharedCtx;
}
