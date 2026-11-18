// audio.js — every sound in Neon Drift Arena is synthesized with WebAudio:
// no audio files, no samples, nothing to load. Short oscillator blips cover
// the effects, and a slow two-oscillator bass pulse plays under the action.

const SoundFX = (() => {
  let ctx = null;
  let master = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      return true;
    } catch (err) {
      return false;
    }
  }

  function blip(freqA, freqB, seconds, type, volume) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freqA, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqB, 1), t + seconds);
    gain.gain.setValueAtTime(volume || 0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + seconds);
  }

  function noise(seconds, volume) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const size = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  // A minor-key bass line, one note every 240 ms, kept quiet under the game.
  const BASS_LINE = [110, 110, 130.81, 98, 110, 110, 164.81, 146.83];

  function startMusic() {
    if (!ensure() || musicTimer) return;
    musicTimer = setInterval(() => {
      if (muted) return;
      const note = BASS_LINE[musicStep % BASS_LINE.length];
      musicStep++;
      blip(note, note, 0.22, 'triangle', 0.16);
      if (musicStep % 4 === 0) blip(note * 2, note * 2, 0.12, 'sine', 0.05);
    }, 240);
  }

  function toggleMute() {
    muted = !muted;
    return muted;
  }

  return {
    unlock: ensure,
    toggleMute,
    startMusic,
    shoot() { blip(880, 220, 0.08, 'square', 0.18); },
    enemyHit() { blip(300, 140, 0.05, 'sawtooth', 0.12); },
    explosion() { noise(0.35, 0.5); blip(160, 40, 0.3, 'sawtooth', 0.3); },
    playerHurt() { blip(200, 60, 0.25, 'sawtooth', 0.4); },
    pickup() { blip(520, 1040, 0.12, 'sine', 0.3); },
    waveClear() { blip(523, 523, 0.1, 'square', 0.25); setTimeout(() => blip(784, 784, 0.16, 'square', 0.25), 90); },
    gameOver() { blip(392, 98, 0.7, 'triangle', 0.4); },
    victory() { blip(523, 523, 0.12, 'square', 0.25); setTimeout(() => blip(659, 659, 0.12, 'square', 0.25), 110); setTimeout(() => blip(784, 784, 0.24, 'square', 0.3), 220); },
  };
})();
