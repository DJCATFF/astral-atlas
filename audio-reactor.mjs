const clamp = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const shape = value => Math.pow(clamp((value - .008) * 1.55), .65);
const BANDS = ['bass', 'lowMid', 'mid', 'vocal', 'treble'];
const follow = (current, target, dt, attack = .018, release = .16) =>
  current + (target - current) * (1 - Math.exp(-dt / (target > current ? attack : release)));

// The only inputs are actual host samples and frame duration. No time/BPM-based
// substitute signal: silence produces zero pulse, zero spectrum and no onsets.
export class AudioReactor {
  constructor(count = 96) {
    this.value = { bass: 0, lowMid: 0, mid: 0, vocal: 0, treble: 0, power: 0, hit: 0, bloom: 0, hasSignal: false, source: 'none', unavailable: false, spectrum: new Float32Array(count) };
    this.reset();
  }
  reset() {
    for (const key of BANDS) this.value[key] = 0;
    this.value.power = this.value.hit = this.value.bloom = 0;
    this.value.hasSignal = false;
    this.value.source = 'none';this.value.unavailable = false;
    this.value.spectrum.fill(0);
    this.lastBass = this.cooldown = 0;
    return this.value;
  }
  step(source, seconds, preview = false) {
    const dt = Math.max(.001, Math.min(.08, seconds || 1 / 60));
    const bands = source.getBands();
    const spectrum = source.getSpectrum();
    let power = clamp(source.getPower());
    const raw = BANDS.map(key => clamp(bands[key]));
    // Folia 0.7.28's idle/HiFi path supplies an identical sine "breath" to
    // power and all five bands, with no FFT. Do not call that a music signal.
    const idleBreath = !preview && !spectrum?.length && power > 0 && raw.every(v => Math.abs(v - power) < .000001);
    this.value.unavailable = idleBreath;
    if(idleBreath){raw.fill(0);power=0;}
    this.value.source = spectrum?.length ? 'fft' : raw.some(v=>v>0) || power>0 ? 'bands' : 'none';
    const levels = this.value.spectrum;
    let spectralPeak = 0;
    if (spectrum?.length) {
      // Logarithmic pooling preserves bass detail. The API supplies no sample
      // rate, so these bins are deliberately not labelled with invented Hz.
      for (let i = 0; i < levels.length; i++) {
        const start = Math.floor(Math.expm1(Math.log1p(spectrum.length) * i / levels.length));
        const end = Math.min(spectrum.length, Math.max(start + 1, Math.ceil(Math.expm1(Math.log1p(spectrum.length) * (i + 1) / levels.length))));
        let peak = 0;
        for (let j = start; j < end; j++) peak = Math.max(peak, clamp(spectrum[j] / 255));
        spectralPeak = Math.max(spectralPeak, peak);
        levels[i] = follow(levels[i], shape(peak), dt, .015, .13);
      }
      // Some hosts expose only the FFT. Recover broad envelopes in that case.
      if (!raw.some(value => value > 0)) {
        const edges = [0, .22, .42, .61, .79, 1];
        for (let b = 0; b < 5; b++) {
          let peak = 0;
          for (let i = Math.floor(edges[b] * levels.length); i < Math.ceil(edges[b + 1] * levels.length); i++) peak = Math.max(peak, levels[i]);
          // levels are already perceptually shaped; invert before the shared pass.
          raw[b] = peak > 0 ? Math.pow(peak, 1 / .65) / 1.55 + .008 : 0;
        }
      }
    } else {
      // A band-only host gets five honest frequency sectors, not a fabricated FFT.
      if (!raw.some(value => value > 0) && power > 0) raw.fill(power);
      for (let i = 0; i < levels.length; i++) {
        const band = Math.min(4, Math.floor(i / levels.length * 5));
        levels[i] = follow(levels[i], shape(raw[band]), dt, .015, .13);
      }
    }
    const bass = shape(Math.max(raw[0], raw[1] * .7));
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.value.hit *= Math.exp(-dt / .19);
    if (bass > .16 && bass - this.lastBass > .08 && this.cooldown === 0) {
      this.value.hit = Math.max(this.value.hit, clamp((bass - this.lastBass) * 2));
      this.cooldown = .17;
    }
    this.lastBass = bass;
    for (let i = 0; i < BANDS.length; i++) this.value[BANDS[i]] = follow(this.value[BANDS[i]], shape(raw[i]), dt);
    this.value.power = follow(this.value.power, shape(Math.max(power, ...raw, spectralPeak)), dt);
    // A slower phrase envelope unfolds the structure without making every
    // syllable shake the whole drawing. Vocal is a band, not source separation.
    this.value.bloom = follow(this.value.bloom, shape(raw[3]) * .65 + shape(raw[2]) * .25 + this.value.power * .1, dt, .52, .95);
    this.value.hasSignal = Math.max(power, ...raw, spectralPeak) > .008;
    return this.value;
  }
}

// A slower, spatially pooled envelope for distant stardust. Keep the fast
// onset follower above for the instrument; stars should not look like needles.
export class StardustEnvelope {
  constructor(count=96,{attack=.10,release=.38}={}){this.value={spectrum:new Float32Array(count)};this.attack=attack;this.release=release;}
  reset(){this.value.spectrum.fill(0);}
  step(signal,seconds){
    const dt=Math.max(.001,Math.min(.08,seconds||1/60)),input=signal.spectrum||[];
    for(let i=0;i<this.value.spectrum.length;i++){
      let sum=0,weight=0;
      for(let j=-2;j<=2;j++){
        const bin=Math.max(0,Math.min(input.length-1,i+j)),w=3-Math.abs(j);
        sum+=(Number.isFinite(input[bin])?input[bin]:0)*w;weight+=w;
      }
      const target=Math.max(0,Math.min(1,(sum/weight-.025)/.975));
      this.value.spectrum[i]=follow(this.value.spectrum[i],target,dt,this.attack,this.release);
    }
    return this.value;
  }
}
