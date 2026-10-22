// js/recordingAudioMix.js
// ----------------------------------------------------------
// Mixes every audio source the app itself plays (transition-block
// sprites and single stimulus clips, both played with Web Audio)
// together with the microphone into ONE MediaStreamAudioDestinationNode,
// so the webcam recording captures a single clear track with
// both the stimulus prompts and the speaker's voice.
//
// Everything still plays out loud exactly as before - we are
// tapping the existing Web Audio graph, not replacing playback.
// ----------------------------------------------------------

import { getSharedAudioContext } from "./sharedAudioContext.js";

let mixDestination = null;

/**
 * Lazily create (once) the shared MediaStreamAudioDestinationNode
 * that all audio sources get mixed into.
 *
 * @returns {MediaStreamAudioDestinationNode|null}
 */
export function getMixDestination() {
  const ctx = getSharedAudioContext();
  if (!ctx) return null;

  if (!mixDestination) {
    mixDestination = ctx.createMediaStreamDestination();
  }

  return mixDestination;
}

/**
 * Route an existing Web Audio node (e.g. the transition-block sprite's
 * gain node) into the mix, in addition to wherever it already connects.
 *
 * @param {AudioNode} node
 */
export function routeNodeToMix(node) {
  if (!node) return;

  const destination = getMixDestination();
  if (!destination) return;

  try {
    node.connect(destination);
  } catch (e) {
    console.warn("routeNodeToMix: could not route node into recording mix:", e);
  }
}

/**
 * Feed a microphone MediaStream into the mix, so recorded audio
 * contains both the stimulus playback and the speaker's voice.
 *
 * @param {MediaStream} micStream
 */
export function routeMicIntoMix(micStream) {
  if (!micStream || micStream.getAudioTracks().length === 0) return null;

  const ctx = getSharedAudioContext();
  const destination = getMixDestination();
  if (!ctx || !destination) return null;

  try {
    const micSource = ctx.createMediaStreamSource(micStream);
    micSource.connect(destination);
    return micSource;
  } catch (e) {
    console.warn("routeMicIntoMix: could not route microphone into recording mix:", e);
    return null;
  }
}
