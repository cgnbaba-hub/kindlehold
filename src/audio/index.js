// Procedural audio (WebAudio synthesis — no audio files): mixer with master / music /
// ambience / effects / voice buses, positional attenuation relative to the camera,
// event-driven SFX, day/night ambience and a generative modal score that turns tense
// during raids. Fully optional: any failure leaves the game running silently.
import { EV, PLAYER } from '../core/contracts.js';
import { log } from '../core/logger.js';
import { distToPolyline } from '../world/terrain-data.js';

const SCALE = [0, 2, 3, 5, 7, 9, 10]; // D dorian degrees

// view-only variation (never simulation): tiny LCG, keeps Math.random out of src/
let seed = 0x1a2b3c;
function rand() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
const ROOT_HZ = 146.83; // D3

export function createAudio({ bus, world, settings, getListener, terrain = null }) {
  let ctx = null;
  let meter = null, meterBuf = null;
  let ok = false;
  let failed = null;
  const buses = {};
  let noiseBuf = null;
  const unsub = [];
  let started = false;
  const rateLimit = new Map();

  function init() {
    if (ctx || failed) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error('Web Audio not supported');
      ctx = new AC();
      const master = ctx.createGain();
      // safety chain: compressor-limiter, then a hard soft-clip ceiling at about -6 dBFS,
      // so no synthesis bug can ever reach the speakers at dangerous levels
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.knee.value = 6; comp.ratio.value = 20; comp.attack.value = 0.002; comp.release.value = 0.15;
      const ceiling = ctx.createWaveShaper();
      const curve = new Float32Array(2048);
      for (let i = 0; i < curve.length; i++) { const x = (i / (curve.length - 1)) * 2 - 1; curve[i] = 0.5 * Math.tanh(x * 2); }
      ceiling.curve = curve;
      master.connect(comp); comp.connect(ceiling); ceiling.connect(ctx.destination);
      // output meter (post-limiter): used by the audio safety check and the debug API
      meter = ctx.createAnalyser(); meter.fftSize = 2048;
      ceiling.connect(meter);
      meterBuf = new Float32Array(meter.fftSize);
      buses.master = master;
      for (const k of ['music', 'ambience', 'effects', 'voice']) { const g = ctx.createGain(); g.connect(master); buses[k] = g; }
      // shared noise buffer
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      let s = 1;
      for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
      applyVolumes();
      ok = true;
    } catch (err) {
      failed = err.message;
      log.warn('audio', `audio disabled: ${err.message}`);
    }
  }

  function applyVolumes() {
    if (!ctx) return;
    const m = settings.muted ? 0 : settings.masterVolume;
    buses.master.gain.value = m;
    buses.music.gain.value = settings.musicVolume * 1.1;
    buses.ambience.gain.value = settings.ambienceVolume * 0.6;
    buses.effects.gain.value = settings.effectsVolume;
    buses.voice.gain.value = settings.voiceVolume;
  }

  /** Resume on first user gesture (autoplay policy). */
  function unlock() {
    init();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (ok && !started) { started = true; startAmbience(); startMusic(); }
  }
  const gestures = ['pointerdown', 'keydown'];
  for (const g of gestures) window.addEventListener(g, unlock, { passive: true });

  // --- positional helper ------------------------------------------------------------------
  function spatialGain(x, z) {
    if (x === undefined) return 1;
    const L = getListener();
    const d = Math.hypot(x - L.x, z - L.z);
    const zoomFalloff = 40 + L.zoom * 0.6;
    return Math.max(0, 1 - d / zoomFalloff) ** 1.5;
  }
  function allowed(key, minGapMs) {
    const now = performance.now();
    const last = rateLimit.get(key) || 0;
    if (now - last < minGapMs) return false;
    rateLimit.set(key, now);
    return true;
  }

  // --- primitives ----------------------------------------------------------------------------
  function env(g, t, a, peak, dec, sus = 0, rel = 0.1) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sus || 0.0001), t + a + dec);
    if (rel) g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec + rel);
  }
  function noise(dest, { t = ctx.currentTime, dur = 0.2, type = 'bandpass', freq = 1000, q = 1, gain = 0.3, attack = 0.005, freqEnd = null }) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain(); env(g, t, attack, gain, dur, 0, 0.02);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, rand() * 1.5); src.stop(t + attack + dur + 0.05);
  }
  function tone(dest, { t = ctx.currentTime, freq = 440, type = 'sine', dur = 0.3, gain = 0.2, attack = 0.005, freqEnd = null, detune = 0 }) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain(); env(g, t, attack, gain, dur, 0, 0.03);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + attack + dur + 0.08);
  }
  /** Lute-like pluck WITHOUT any feedback loop (cannot become unstable): a bright triangle
   *  fundamental, a sine octave and a tiny filtered-noise pick, each with its own decay. */
  function pluck(dest, { t = ctx.currentTime, freq = 220, gain = 0.2, decay = 1.6 }) {
    tone(dest, { t, freq, type: 'triangle', dur: decay, gain: gain * 0.8, attack: 0.003 });
    tone(dest, { t, freq: freq * 2, type: 'sine', dur: decay * 0.5, gain: gain * 0.3, attack: 0.003 });
    noise(dest, { t, dur: 0.03, type: 'bandpass', freq: Math.min(6000, freq * 6), q: 2, gain: gain * 0.25, attack: 0.001 });
  }
  function placed(x, z, extra = 1) {
    const g = ctx.createGain(); g.gain.value = spatialGain(x, z) * extra;
    g.connect(buses.effects);
    setTimeout(() => { try { g.disconnect(); } catch { /* ignore */ } }, 3000);
    return g;
  }

  // --- sound library --------------------------------------------------------------------------
  const sfx = {
    chop(x, z) { const d = placed(x, z, 0.8); if (!d.gain.value) return; noise(d, { freq: 900, q: 3, dur: 0.07, gain: 0.5 }); tone(d, { freq: 180, freqEnd: 90, dur: 0.08, gain: 0.25, type: 'triangle' }); },
    pick(x, z) { const d = placed(x, z, 0.7); if (!d.gain.value) return; tone(d, { freq: 1900, freqEnd: 1500, dur: 0.12, gain: 0.12, type: 'square' }); noise(d, { freq: 3000, q: 2, dur: 0.05, gain: 0.3 }); },
    hammer(x, z) { const d = placed(x, z, 0.6); if (!d.gain.value) return; tone(d, { freq: 320, freqEnd: 180, dur: 0.06, gain: 0.3, type: 'triangle' }); noise(d, { freq: 1500, q: 1.5, dur: 0.04, gain: 0.25 }); },
    anvil(x, z) { const d = placed(x, z, 0.5); if (!d.gain.value) return; tone(d, { freq: 1240, dur: 0.35, gain: 0.08 }); tone(d, { freq: 1810, dur: 0.25, gain: 0.05 }); noise(d, { freq: 4000, q: 1, dur: 0.03, gain: 0.2 }); },
    rustle(x, z) { const d = placed(x, z, 0.5); if (!d.gain.value) return; noise(d, { freq: 2500, q: 0.7, dur: 0.25, gain: 0.12, attack: 0.05 }); },
    treeFall(x, z) { const d = placed(x, z, 1); if (!d.gain.value) return; noise(d, { freq: 400, freqEnd: 120, q: 0.8, dur: 1.1, gain: 0.4, attack: 0.3, type: 'lowpass' }); tone(d, { t: ctx.currentTime + 1.2, freq: 70, freqEnd: 40, dur: 0.4, gain: 0.5 }); },
    // combat sounds come in several variants with random pitch, so a melee never sounds like a loop
    swing(x, z) {
      const d = placed(x, z, 0.6); if (!d.gain.value) return;
      const v = Math.floor(rand() * 3), p = 0.85 + rand() * 0.3;
      if (v === 0) noise(d, { freq: 1200 * p, freqEnd: 400 * p, q: 2, dur: 0.12, gain: 0.25, attack: 0.03 });
      else if (v === 1) noise(d, { freq: 1800 * p, freqEnd: 600 * p, q: 3, dur: 0.16, gain: 0.2, attack: 0.05 }); // longer whoosh
      else { noise(d, { freq: 900 * p, freqEnd: 300 * p, q: 1.5, dur: 0.1, gain: 0.28, attack: 0.02 }); noise(d, { t: ctx.currentTime + 0.05, freq: 2400 * p, q: 5, dur: 0.05, gain: 0.08 }); }
    },
    clash(x, z) {
      const d = placed(x, z, 0.8); if (!d.gain.value) return;
      const v = Math.floor(rand() * 4), p = 0.9 + rand() * 0.25;
      if (v === 0) { // steel on steel: bright ring
        tone(d, { freq: (2100 + rand() * 400) * p, dur: 0.18, gain: 0.08, type: 'square' }); tone(d, { freq: 3300 * p, dur: 0.12, gain: 0.05 }); noise(d, { freq: 5000, q: 1, dur: 0.06, gain: 0.25 });
      } else if (v === 1) { // blade on shield: wooden knock with a metal edge
        tone(d, { freq: 180 * p, freqEnd: 110 * p, dur: 0.12, gain: 0.3 }); noise(d, { freq: 900 * p, q: 1.2, dur: 0.07, gain: 0.3 }); tone(d, { freq: 2600 * p, dur: 0.08, gain: 0.035, type: 'triangle' });
      } else if (v === 2) { // glancing scrape
        noise(d, { freq: 4200 * p, freqEnd: 2200 * p, q: 6, dur: 0.2, gain: 0.14, attack: 0.01 }); tone(d, { freq: 1700 * p, freqEnd: 1500 * p, dur: 0.22, gain: 0.04, type: 'sawtooth' });
      } else { // heavy chop into mail
        noise(d, { freq: 1500 * p, q: 0.8, dur: 0.05, gain: 0.3 }); tone(d, { freq: 2800 * p, dur: 0.1, gain: 0.05, type: 'square' }); tone(d, { freq: 95 * p, freqEnd: 60, dur: 0.12, gain: 0.25 });
      }
    },
    thud(x, z) { const d = placed(x, z, 0.8); if (!d.gain.value) return; const p = 0.85 + rand() * 0.3; tone(d, { freq: 120 * p, freqEnd: 60 * p, dur: 0.15, gain: 0.35 }); noise(d, { freq: 500 * p, q: 1, dur: 0.08, gain: 0.25, type: 'lowpass' }); if (rand() < 0.4) noise(d, { t: ctx.currentTime + 0.06, freq: 2600, q: 2, dur: 0.1, gain: 0.08 }); },
    arrow(x, z) {
      const d = placed(x, z, 0.6); if (!d.gain.value) return;
      const p = 0.85 + rand() * 0.3;
      // bowstring twang, then the arrow's hiss
      tone(d, { freq: 190 * p, freqEnd: 150 * p, dur: 0.09, gain: 0.12, type: 'triangle' });
      noise(d, { t: ctx.currentTime + 0.02, freq: 3000 * p, freqEnd: 1200 * p, q: 4, dur: 0.2 + rand() * 0.08, gain: 0.16, attack: 0.02 });
    },
    sling(x, z) { const d = placed(x, z, 0.5); if (!d.gain.value) return; const p = 0.85 + rand() * 0.3; noise(d, { freq: 700 * p, freqEnd: 1400 * p, q: 3, dur: 0.18, gain: 0.15, attack: 0.04 }); if (rand() < 0.5) noise(d, { t: ctx.currentTime + 0.12, freq: 500 * p, freqEnd: 1100 * p, q: 3, dur: 0.14, gain: 0.1 }); },
    collapse(x, z) { const d = placed(x, z, 1.2); if (!d.gain.value) return; noise(d, { freq: 300, freqEnd: 80, q: 0.6, dur: 1.6, gain: 0.6, attack: 0.02, type: 'lowpass' }); for (let i = 0; i < 5; i++) tone(d, { t: ctx.currentTime + i * 0.18, freq: 90 - i * 8, dur: 0.2, gain: 0.25 }); },
    complete(x, z) { const d = placed(x, z, 0.9); if (!d.gain.value) return; const t = ctx.currentTime; [0, 4, 7].forEach((s, i) => pluck(d, { t: t + i * 0.09, freq: ROOT_HZ * 2 * 2 ** (s / 12), gain: 0.18 })); },
    flare(x, z) { const d = placed(x, z, 1.2); const t = ctx.currentTime; noise(d, { freq: 800, freqEnd: 5000, q: 0.8, dur: 0.5, gain: 0.35, attack: 0.02 }); [0, 7, 12, 19].forEach((s, i) => tone(d, { t: t + i * 0.04, freq: 440 * 2 ** (s / 12), dur: 0.9, gain: 0.07, type: 'triangle' })); },
    kindle(x, z) { const d = placed(x, z, 1.1); const t = ctx.currentTime; [0, 5, 9, 12].forEach((s, i) => tone(d, { t: t + i * 0.08, freq: 293.66 * 2 ** (s / 12), dur: 1.4, gain: 0.06, attack: 0.08 })); noise(d, { freq: 6000, q: 0.5, dur: 1.2, gain: 0.05, attack: 0.3, type: 'highpass' }); },
    horn() { const d = buses.effects; const t = ctx.currentTime; tone(d, { t, freq: 98, dur: 1.6, gain: 0.22, type: 'sawtooth', attack: 0.25 }); tone(d, { t, freq: 98 * 1.5, dur: 1.6, gain: 0.08, type: 'sawtooth', attack: 0.3, detune: 7 }); tone(d, { t: t + 1.8, freq: 110, dur: 1.2, gain: 0.2, type: 'sawtooth', attack: 0.2 }); },
    ui() { tone(buses.effects, { freq: 880, dur: 0.05, gain: 0.05, type: 'triangle' }); },
    uiBad() { tone(buses.effects, { freq: 220, freqEnd: 160, dur: 0.12, gain: 0.07, type: 'square' }); },
    objective() { const t = ctx.currentTime; [0, 4, 7, 12].forEach((s, i) => pluck(buses.effects, { t: t + i * 0.12, freq: ROOT_HZ * 2 * 2 ** (s / 12), gain: 0.2, decay: 1.8 })); },
    alarm() { const t = ctx.currentTime; for (let i = 0; i < 3; i++) tone(buses.effects, { t: t + i * 0.35, freq: 660, dur: 0.2, gain: 0.08, type: 'square' }); },
    victory() { const t = ctx.currentTime; const seq = [0, 4, 7, 12, 7, 12, 16, 19]; seq.forEach((s, i) => { pluck(buses.music, { t: t + i * 0.22, freq: ROOT_HZ * 2 ** (s / 12), gain: 0.35, decay: 2.5 }); tone(buses.music, { t: t + i * 0.22, freq: ROOT_HZ * 2 ** ((s - 12) / 12), dur: 0.5, gain: 0.08, type: 'triangle' }); }); },
    defeat() { const t = ctx.currentTime; [12, 10, 7, 5, 3, 0].forEach((s, i) => pluck(buses.music, { t: t + i * 0.4, freq: ROOT_HZ * 2 ** (s / 12), gain: 0.3, decay: 3 })); tone(buses.music, { t, freq: ROOT_HZ / 2, dur: 3, gain: 0.1, type: 'triangle', attack: 0.5 }); },
    // voice-like acknowledgements: short formant "hm"/"hup" syllables, no words
    ack(kind = 'ok') {
      const t = ctx.currentTime;
      const base = kind === 'hero' ? 230 : kind === 'attack' ? 150 : 175;
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(base, t); o.frequency.linearRampToValueAtTime(kind === 'attack' ? base * 1.3 : base * 0.92, t + 0.18);
      const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = kind === 'attack' ? 700 : 500; f1.Q.value = 5;
      const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1100; f2.Q.value = 6;
      const g = ctx.createGain(); env(g, t, 0.02, 0.35, 0.2, 0, 0.05);
      o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(buses.voice);
      o.start(t); o.stop(t + 0.35);
    },
  };

  // --- ambience ---------------------------------------------------------------------------------
  let amb = null;
  function startAmbience() {
    try {
      const wind = ctx.createBufferSource(); wind.buffer = noiseBuf; wind.loop = true;
      const wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 500;
      const wg = ctx.createGain(); wg.gain.value = 0.12;
      wind.connect(wf); wf.connect(wg); wg.connect(buses.ambience); wind.start();
      const river = ctx.createBufferSource(); river.buffer = noiseBuf; river.loop = true;
      const rf = ctx.createBiquadFilter(); rf.type = 'bandpass'; rf.frequency.value = 1300; rf.Q.value = 0.4;
      const rg = ctx.createGain(); rg.gain.value = 0;
      river.connect(rf); rf.connect(rg); rg.connect(buses.ambience); river.start(0, 0.7);
      const village = ctx.createBufferSource(); village.buffer = noiseBuf; village.loop = true;
      const vf = ctx.createBiquadFilter(); vf.type = 'bandpass'; vf.frequency.value = 380; vf.Q.value = 1.8;
      const vg = ctx.createGain(); vg.gain.value = 0;
      village.connect(vf); vf.connect(vg); vg.connect(buses.ambience); village.start(0, 1.3);
      // rain: a soft high hiss plus a low patter, silent until a shower starts
      const rain = ctx.createBufferSource(); rain.buffer = noiseBuf; rain.loop = true;
      const raf = ctx.createBiquadFilter(); raf.type = 'highpass'; raf.frequency.value = 2400;
      const rag = ctx.createGain(); rag.gain.value = 0;
      rain.connect(raf); raf.connect(rag); rag.connect(buses.ambience); rain.start(0, 0.4);
      const patter = ctx.createBufferSource(); patter.buffer = noiseBuf; patter.loop = true;
      const paf = ctx.createBiquadFilter(); paf.type = 'bandpass'; paf.frequency.value = 700; paf.Q.value = 0.7;
      const pag = ctx.createGain(); pag.gain.value = 0;
      patter.connect(paf); paf.connect(pag); pag.connect(buses.ambience); patter.start(0, 1.1);
      amb = { wf, wg, rg, vg, rag, pag, nextCritter: 0 };
    } catch (err) { log.warn('audio', `ambience failed: ${err.message}`); }
  }

  function updateAmbience(dt) {
    if (!amb) return;
    const w = world();
    const L = getListener();
    const hour = w.time.hour;
    const night = hour < 5.5 || hour > 19.5;
    const t = ctx.currentTime;
    // winter: a colder, gustier wind; the frozen river falls silent; no birds or crickets
    const snow = (w.weather && w.weather.snow) || 0;
    const frozen = !!(w.weather && w.weather.frozen);
    amb.wf.frequency.setTargetAtTime(380 + Math.sin(t * 0.13) * 180 + L.zoom * 2 + snow * (260 + Math.sin(t * 0.31) * 160), t, 0.8);
    amb.wg.gain.setTargetAtTime((0.07 + L.zoom / 900) * (1 + snow * 0.8), t, 1);
    // river loudness from distance to the listener target (river runs roughly along z≈0)
    const riverNear = terrain ? Math.max(0, 1 - distToPolyline(L.x, L.z, terrain.map.river.points) / 45) : 0;
    amb.rg.gain.setTargetAtTime(frozen ? 0 : riverNear * 0.1, t, 1);
    const home = terrain ? terrain.map.playerStart : { x: -46, z: 50 };
    const keepNear = Math.max(0, 1 - Math.hypot(L.x - home.x, L.z - home.z) / 60) * (w.players[PLAYER] ? Math.min(1, w.players[PLAYER].pop / 20) : 0);
    amb.vg.gain.setTargetAtTime(keepNear * 0.05, t, 1);
    const rain = w.weather && w.weather.kind === 'rain' ? w.weather.intensity : 0;
    amb.rag.gain.setTargetAtTime(rain * 0.09, t, 1.2);
    amb.pag.gain.setTargetAtTime(rain * 0.05, t, 1.2);
    amb.nextCritter -= dt;
    if (amb.nextCritter <= 0) {
      amb.nextCritter = night ? 0.35 + rand() * 0.5 : 1.2 + rand() * 3;
      if (snow > 0.5 || rain > 0.4) { /* silent winter, birds shelter from the rain */ } else if (night) { // crickets
        const f = 4200 + rand() * 500;
        for (let i = 0; i < 3; i++) tone(buses.ambience, { t: t + i * 0.06, freq: f, dur: 0.03, gain: 0.02 });
      } else { // bird call
        const f = 2200 + rand() * 1400;
        const n = 2 + Math.floor(rand() * 3);
        for (let i = 0; i < n; i++) tone(buses.ambience, { t: t + i * 0.13, freq: f * (1 + (i % 2) * 0.12), freqEnd: f * 1.3, dur: 0.08, gain: 0.03 });
      }
    }
  }

  // --- generative music ----------------------------------------------------------------------------
  let music = null;
  function startMusic() {
    music = { next: ctx.currentTime + 1, step: 0, tense: 0, bar: 0, degree: 0 };
    // drone pad
    try {
      const pad = ctx.createOscillator(); pad.type = 'triangle'; pad.frequency.value = ROOT_HZ / 2;
      const pad2 = ctx.createOscillator(); pad2.type = 'triangle'; pad2.frequency.value = ROOT_HZ * 0.75; pad2.detune.value = 4;
      const pg = ctx.createGain(); pg.gain.value = 0.07;
      const plp = ctx.createBiquadFilter(); plp.type = 'lowpass'; plp.frequency.value = 600;
      pad.connect(plp); pad2.connect(plp); plp.connect(pg); pg.connect(buses.music);
      pad.start(); pad2.start();
      music.pad = { pg, plp };
    } catch { /* ignore */ }
  }
  function updateMusic() {
    if (!music) return;
    const w = world();
    const raid = w.ai && (w.ai.state === 'raid' || (w.mission.flags.raidWarned && w.ai.raidTick != null && w.ai.raidTick - w.tick < 600));
    music.tense += ((raid ? 1 : 0) - music.tense) * 0.02;
    const beat = raid ? 0.32 : 0.46;
    const t = ctx.currentTime;
    if (music.pad) { music.pad.plp.frequency.setTargetAtTime(500 + music.tense * 700, t, 2); }
    while (music.next < t + 0.3) {
      const step = music.step++;
      const bar = Math.floor(step / 8);
      if (step % 8 === 0) { music.degree = [0, 3, 4, 0, 5, 3, 6, 4][bar % 8]; }
      const deg = music.degree;
      // lute-like arpeggio with gaps (seeded by step, deterministic pattern)
      const pattern = [0, 2, 4, 2, 7, 4, 2, 4];
      const play = ((step * 7 + bar * 3) % 11) > 2;
      if (play) {
        const idx = (deg + pattern[step % 8]) % 14;
        const oct = idx >= 7 ? 2 : 1;
        const semi = SCALE[idx % 7] + 12 * (oct - 1);
        pluck(buses.music, { t: music.next, freq: ROOT_HZ * 2 ** (semi / 12), gain: 0.26 + (step % 8 === 0 ? 0.1 : 0), decay: 1.8 });
      }
      if (step % 8 === 0) tone(buses.music, { t: music.next, freq: (ROOT_HZ / 2) * 2 ** (SCALE[deg % 7] / 12), dur: beat * 7, gain: 0.1, type: 'sine', attack: 0.4 });
      if (music.tense > 0.3 && step % 2 === 0) { // war drum
        noise(buses.music, { t: music.next, freq: 120, q: 1, dur: 0.18, gain: 0.35 * music.tense, type: 'lowpass' });
        tone(buses.music, { t: music.next, freq: 70, freqEnd: 45, dur: 0.18, gain: 0.3 * music.tense });
      }
      music.next += beat;
    }
  }

  // --- event wiring --------------------------------------------------------------------------------
  function on(name, fn) { unsub.push(bus.on(name, (d) => { if (!ok || !ctx || ctx.state !== 'running') return; try { fn(d); } catch (err) { log.warn('audio', err.message); } })); }
  on(EV.WORK_STRIKE, (d) => {
    const map = { forester: 'chop', quarrier: 'pick', mine: 'anvil', build: 'hammer', repair: 'hammer', harvest: 'rustle', sow: 'rustle' };
    const k = map[d.kind];
    if (k && allowed(k + Math.round(d.x / 8) + Math.round(d.z / 8), 120)) sfx[k](d.x, d.z);
  });
  on('deposit:depleted', (d) => { if (d.type === 'tree') sfx.treeFall(d.x, d.z); });
  on('combat:swing', (d) => { const e = world().entities[d.id]; if (e && allowed('swing', 60)) sfx.swing(e.x, e.z); });
  on(EV.COMBAT_HIT, (d) => { if (!allowed('hit', 45)) return; if (d.targetKind === 'building') sfx.thud(d.x, d.z); else sfx.clash(d.x, d.z); });
  on(EV.COMBAT_SHOT, (d) => { if (allowed('shot', 70)) (d.kind === 'arrow' ? sfx.arrow : sfx.sling)(d.fx, d.fz); });
  on(EV.BUILDING_DESTROYED, (d) => sfx.collapse(d.x, d.z));
  on(EV.BUILDING_COMPLETED, (d) => { const b = world().entities[d.id]; if (b && d.owner === PLAYER) sfx.complete(b.x, b.z); });
  on(EV.HERO_ABILITY, (d) => { if (d.ability === 'flare') sfx.flare(d.x, d.z); else if (d.ability === 'kindle') sfx.kindle(d.x, d.z); else if (d.ability === 'horn') sfx.horn(); });
  on(EV.UNIT_ORDER, (d) => { if (d.owner !== PLAYER || !allowed('ack', 400)) return; const w = world(); const hero = d.ids.some((id) => w.entities[id] && w.entities[id].hero); sfx.ack(hero && d.ids.length === 1 ? 'hero' : d.order === 'attack' || d.order === 'attackMove' ? 'attack' : 'ok'); });
  on(EV.UNIT_RECRUITED, () => sfx.ack('ok'));
  on(EV.MISSION_OBJECTIVE, (d) => { if (d.state === 'done') sfx.objective(); });
  on(EV.AI_WAVE, () => { sfx.horn(); });
  on('ai:harass', () => { sfx.horn(); });
  on('population:feast', (d) => { if (d.owner === PLAYER) { sfx.objective(); sfx.complete(d.x, d.z); } });
  on('mission:raid-warning', () => sfx.alarm());
  on(EV.COMMAND_REJECTED, () => { if (allowed('bad', 200)) sfx.uiBad(); });
  on(EV.MISSION_ENDED, (d) => (d.result === 'victory' ? sfx.victory : sfx.defeat)());
  on('keep:rekindled', (d) => { const k = world().entities[d.id]; sfx.flare(k ? k.x : 0, k ? k.z : 0); });
  // payday: a short run of coin clinks
  on('population:payday', (d) => {
    if (d.owner !== PLAYER || !(d.taxes > 0)) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 4; i++) tone(buses.effects, { t: t + i * 0.09 + rand() * 0.03, freq: 2600 + rand() * 900, freqEnd: 2400, type: 'triangle', dur: 0.12, gain: 0.05 });
  });
  on('settlers:ordered', (d) => { if (d.type === 'gather' && allowed('ack', 400)) sfx.ack('ok'); });

  return {
    id: 'audio',
    kind: 'view',
    unlock,
    /** Current output peak (0..1+, linear) — for automated loudness checks. */
    peak() { if (!meter) return 0; meter.getFloatTimeDomainData(meterBuf); let m = 0; for (let i = 0; i < meterBuf.length; i++) m = Math.max(m, Math.abs(meterBuf[i])); return m; },
    running: () => !!(ctx && ctx.state === 'running'),
    ui: () => { if (ok && ctx.state === 'running') sfx.ui(); },
    applyVolumes,
    render(alpha, frame) {
      if (!ok || !ctx || ctx.state !== 'running') return;
      updateAmbience(frame.dt);
      updateMusic();
    },
    pause() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); },
    resume() { if (ctx && ctx.state === 'suspended' && started) ctx.resume().catch(() => {}); },
    getHealthStatus() { return failed ? { status: 'degraded', detail: `audio unavailable: ${failed}` } : { status: 'ok', detail: ctx ? ctx.state : 'waiting for first input' }; },
    dispose() {
      unsub.forEach((u) => u());
      for (const g of gestures) window.removeEventListener(g, unlock);
      if (ctx) ctx.close().catch(() => {});
      ctx = null; ok = false;
    },
  };
}
