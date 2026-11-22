// Tiny synthesized sound: a few WebAudio bleeps, no audio files, no network. The context
// is created lazily on the first user gesture, so a page that never gets played stays silent.

let audio = null;
let muted = false;

function ensureAudio() {
  if (audio === null) {
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      audio = Ctor ? new Ctor() : null;
    } catch {
      audio = null;
    }
  }
  if (audio && audio.state === 'suspended') void audio.resume();
  return audio;
}

function tone(freq, seconds, type, gainValue, when = 0) {
  const ctx = ensureAudio();
  if (ctx === null || muted) return;
  const start = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + seconds + 0.05);
}

export const sound = {
  /** Call from any user gesture so the browser lets the context start. */
  unlock() {
    ensureAudio();
  },
  toggleMute() {
    muted = !muted;
    return muted;
  },
  grab() {
    tone(880, 0.12, 'sine', 0.16);
    tone(1318, 0.18, 'sine', 0.14, 0.09);
  },
  coin() {
    tone(1568, 0.07, 'triangle', 0.1);
  },
  panel() {
    tone(523, 0.1, 'square', 0.07);
    tone(784, 0.14, 'square', 0.06, 0.08);
  },
  alarm() {
    tone(220, 0.22, 'sawtooth', 0.12);
    tone(185, 0.28, 'sawtooth', 0.12, 0.2);
  },
  caught() {
    tone(392, 0.25, 'sawtooth', 0.14);
    tone(311, 0.25, 'sawtooth', 0.14, 0.22);
    tone(233, 0.45, 'sawtooth', 0.14, 0.44);
  },
  win() {
    [523, 659, 784, 1047].forEach((freq, i) => tone(freq, 0.22, 'sine', 0.14, i * 0.11));
  },
};
