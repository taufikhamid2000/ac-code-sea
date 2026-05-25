/**
 * Procedural game audio. No asset files — sounds are synthesized via
 * the Web Audio API at runtime, so we ship zero kilobytes of audio.
 *
 * Sound design is intentionally rough — just enough auditory feedback
 * to sell the moments. When real sounds matter (recorded SFX,
 * licensed music), drop .ogg/.mp3 files in public/audio/ and swap
 * these synth calls for Phaser.Sound playback.
 *
 * Constructor takes an AudioContext (typically from Phaser's
 * WebAudioSoundManager so unlocking/resume is handled centrally).
 */

export class GameAudio {
  private ctx: AudioContext;
  private masterGain: GainNode;

  constructor(ctx: AudioContext, masterVolume = 0.45) {
    this.ctx = ctx;
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = masterVolume;
    this.masterGain.connect(ctx.destination);
  }

  /** Low-pass filtered noise burst — percussive/non-tonal sounds. */
  private noiseBurst(filterFreq: number, decay: number, gain: number) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const sampleLen = Math.max(1, Math.floor(ctx.sampleRate * decay));
    const noise = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, sampleLen, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + decay);
    noise.connect(filter).connect(env).connect(this.masterGain);
    noise.start(now);
    noise.stop(now + decay + 0.05);
  }

  /** Frequency-sweeping oscillator — tonal/pitched sounds. */
  private tone(
    startHz: number,
    endHz: number,
    decay: number,
    gain: number,
    type: OscillatorType = "sine"
  ) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(startHz, now);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(1, endHz),
      now + decay
    );
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + decay);
    osc.connect(env).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + decay + 0.05);
  }

  playFootstep() {
    this.noiseBurst(140, 0.04, 0.08);
  }

  playJump() {
    this.tone(240, 480, 0.1, 0.12, "triangle");
  }

  playLand() {
    this.noiseBurst(80, 0.06, 0.16);
  }

  /** Strike connecting with the knight — sword on armor. */
  playStrike() {
    this.noiseBurst(280, 0.08, 0.2);
    this.tone(900, 700, 0.08, 0.1, "square");
  }

  /** Parry success — bright, satisfying clang. */
  playParry() {
    this.tone(1400, 1700, 0.2, 0.2, "triangle");
    this.tone(700, 850, 0.16, 0.12, "triangle");
    this.noiseBurst(2200, 0.04, 0.08);
  }

  /** Player takes damage. */
  playHurt() {
    this.noiseBurst(70, 0.12, 0.22);
    this.tone(140, 90, 0.18, 0.12, "sawtooth");
  }

  /** Knight death — the satisfying drop. */
  playKill() {
    this.noiseBurst(100, 0.28, 0.3);
    this.tone(160, 50, 0.45, 0.18, "sawtooth");
  }

  /** Stealth kill — quieter, knife-like. */
  playStealthKill() {
    this.noiseBurst(1500, 0.05, 0.12);
    this.tone(380, 120, 0.16, 0.1, "triangle");
  }

  /** Distant cannon — low boom. */
  playCannon() {
    this.noiseBurst(80, 0.45, 0.32);
    this.tone(75, 28, 0.5, 0.22, "sine");
  }
}
