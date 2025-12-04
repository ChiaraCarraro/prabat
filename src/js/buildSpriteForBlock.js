// js/buildSpriteForBlock.js
// ----------------------------------------------------------
// Given a block name (e.g. "DiscourseNovelty"),
// build one fused AudioBuffer and a timing map from its
// transition slides (<div class="trials transitionSlide BLOCKNAME">).
// ----------------------------------------------------------

import { getSharedAudioContext } from "./sharedAudioContext.js";


export async function buildSpriteForBlock(blockName) {
  const ctx = getSharedAudioContext();
  if (!ctx) {
    throw new Error("buildSpriteForBlock: Web Audio API not available.");
  }

  // 1. Find all transition slides for this block, in DOM order
  const slides = Array.from(
    document.querySelectorAll(`.trials.transitionSlide.${blockName}`)
  );

  if (slides.length === 0) {
    throw new Error(
      `buildSpriteForBlock: no .transitionSlide found for block "${blockName}".`
    );
  }

  // 2. Collect all prompt audio clips (label + url)
  //    We take the <audio class="prompt"> from each slide.
  const clips = []; // [{ label, url }, ...]

  for (const slide of slides) {
    const prompt = slide.querySelector("audio.prompt");
    if (!prompt || !prompt.src) continue;

    const url = prompt.src;

    // Derive a human-readable label from the filename
    // e.g. "DiscNovLook.mp3" -> "DiscNovLook"
    const filename = url.split("/").pop() || "";
    const label = filename.replace(/\.[^.]+$/, "");

    clips.push({ label, url });
  }

  if (clips.length === 0) {
    throw new Error(
      `buildSpriteForBlock: no <audio class="prompt"> elements found for block "${blockName}".`
    );
  }

  // 3. Load & decode all clips in parallel
  const decoded = await Promise.all(
    clips.map(async ({ label, url }) => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(
          `buildSpriteForBlock: failed to load "${url}" – ${res.status} ${res.statusText}`
        );
      }
      const arrayBuf = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(arrayBuf);
      return { label, buf };
    })
  );

  // 4. Basic consistency check: same sample rate & channels
  const firstBuf = decoded[0].buf;
  const numChannels = firstBuf.numberOfChannels;
  const sampleRate = firstBuf.sampleRate;

  for (const { label, buf } of decoded) {
    if (buf.sampleRate !== sampleRate || buf.numberOfChannels !== numChannels) {
      console.warn(
        `buildSpriteForBlock: clip "${label}" has different sampleRate/channels from the first clip. ` +
          `This can make the fused audio sound odd. (sampleRate=${buf.sampleRate}, channels=${buf.numberOfChannels})`
      );
    }
  }

  // 5. Compute total length in samples
  let totalLength = 0;
  for (const { buf } of decoded) {
    totalLength += buf.length;
  }

  // 6. Create the big buffer (sprite)
  const bigBuffer = ctx.createBuffer(numChannels, totalLength, sampleRate);

  // 7. Build timing map (in seconds) & copy audio into bigBuffer
  const timing = {}; // { label: { start, duration } }
  let offset = 0;

  for (const { label, buf } of decoded) {
    const length = buf.length;

    for (let ch = 0; ch < numChannels; ch++) {
      const dst = bigBuffer.getChannelData(ch);
      const src = buf.getChannelData(ch);
      dst.set(src, offset);
    }

    const startSeconds = offset / sampleRate;
    const durationSeconds = length / sampleRate;

    timing[label] = {
      start: startSeconds,
      duration: durationSeconds,
    };

    offset += length;
  }

  // 8. Return everything the player needs
  return {
    ctx,
    audioBuffer: bigBuffer,
    timing,
  };
}
