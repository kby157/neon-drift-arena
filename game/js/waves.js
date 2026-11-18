// waves.js — the wave director. Each wave is a queue of enemies dealt out
// at the arena edges on a timer; later waves mix in the harder kinds and
// arrive faster. Clearing wave 10 wins the sector; after that the waves
// keep coming, harder, for as long as the player lasts.

const FINAL_WAVE = 10;

function waveQueue(n) {
  const q = [];
  const add = (kind, count) => { for (let i = 0; i < count; i++) q.push(kind); };
  add('chaser', 4 + n * 2);
  if (n >= 2) add('dasher', 1 + n);
  if (n >= 3) add('splitter', Math.floor(n / 2) + 1);
  if (n >= 4) add('orbiter', n - 2);
  if (n > FINAL_WAVE) { // endless mode: keep scaling past the victory wave
    add('chaser', n - FINAL_WAVE);
    add('dasher', Math.floor((n - FINAL_WAVE) / 2));
  }
  // Shuffle so kinds arrive mixed, not in blocks.
  for (let i = q.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [q[i], q[j]] = [q[j], q[i]];
  }
  return q;
}

const WaveDirector = {
  wave: 0,
  queue: [],
  spawnT: 0,
  betweenT: 0,
  state: 'between', // 'between' | 'spawning' | 'clearing'

  reset() {
    this.wave = 0;
    this.queue = [];
    this.state = 'between';
    this.betweenT = 1.2;
  },

  update(w, dt) {
    if (this.state === 'between') {
      this.betweenT -= dt;
      if (this.betweenT <= 0) {
        this.wave += 1;
        this.queue = waveQueue(this.wave);
        this.state = 'spawning';
        this.spawnT = 0;
        w.onWaveStart(this.wave);
      }
      return;
    }
    if (this.state === 'spawning') {
      this.spawnT -= dt;
      const alive = w.enemies.length;
      if (this.queue.length > 0 && this.spawnT <= 0 && alive < 14) {
        const kind = this.queue.shift();
        const pt = edgeSpawnPoint();
        w.enemies.push(makeEnemy(kind, pt.x, pt.y));
        const base = Math.max(0.32, 0.95 - this.wave * 0.05);
        this.spawnT = base * (0.7 + Math.random() * 0.6);
      }
      if (this.queue.length === 0) this.state = 'clearing';
      return;
    }
    // 'clearing': waiting for the last enemies to die
    if (w.enemies.length === 0) {
      const cleared = this.wave;
      this.state = 'between';
      this.betweenT = 2.4;
      w.onWaveCleared(cleared);
    }
  },
};
