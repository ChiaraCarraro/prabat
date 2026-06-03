import { getSharedAudioContext } from "./sharedAudioContext.js";

const audioBufferCache = new Map();

export async function playAudioWebAudio(audioEl, gainValue = 1.0) {
  const ctx = getSharedAudioContext();

  if (!ctx) {
    throw new Error("Web Audio API not available.");
  }

  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  const url = audioEl.src;

  let buffer = audioBufferCache.get(url);

  if (!buffer) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Could not load audio: ${url}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    buffer = await ctx.decodeAudioData(arrayBuffer);
    audioBufferCache.set(url, buffer);
  }

  return new Promise((resolve, reject) => {
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();

    source.buffer = buffer;
    gain.gain.value = gainValue;

    source.connect(gain);
    gain.connect(ctx.destination);

    source.onended = resolve;

    try {
      source.start();
    } catch (err) {
      reject(err);
    }
  });
}