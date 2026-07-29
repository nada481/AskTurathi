/**
 * Play an audio element, ignoring AbortError when a prior play() was
 * interrupted by pause() or a new src — a normal browser race, not a failure.
 */
export async function playAudio(audioEl) {
  if (!audioEl) return;
  try {
    await audioEl.play();
  } catch (err) {
    if (err?.name === 'AbortError') return;
    throw err;
  }
}

/** Unlock autoplay after a user gesture (Chrome/Safari policy). */
export async function unlockAudioPlayback(audioEl) {
  if (!audioEl) return;
  audioEl.muted = true;
  try {
    await playAudio(audioEl);
    audioEl.pause();
    audioEl.currentTime = 0;
  } catch {
    // Autoplay may still be blocked — caller can retry on next gesture.
  } finally {
    audioEl.muted = false;
  }
}

/** Stop any in-flight playback, load a new blob URL, and play. */
export async function loadAndPlay(audioEl, objectUrl) {
  if (!audioEl) throw new Error('audio element not ready');
  audioEl.pause();
  audioEl.src = objectUrl;
  await playAudio(audioEl);
}
