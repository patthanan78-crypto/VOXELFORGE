// Procedural Web Audio API sound synthesizer (zero external audio dependencies)
import type { MtrTrainModelId } from '../data/mtrTransit';

class VoxelAudioEngine {
  private ctx: AudioContext | null = null;
  private activeAnnouncementAudio: HTMLAudioElement | null = null;
  private announcementTimer: number | null = null;
  public muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playBlockBreak(soundType: 'grass' | 'stone' | 'wood' | 'sand' | 'glass') {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = soundType === 'glass' ? 0.16 : 0.11;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const env = Math.pow(1 - i / bufferSize, 1.8);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = soundType === 'glass' ? 'highpass' : 'bandpass';
    const freqMap = {
      grass: 460,
      stone: 820,
      wood: 580,
      sand: 1100,
      glass: 2400,
    };
    filter.frequency.setValueAtTime(freqMap[soundType], now);
    filter.Q.setValueAtTime(1.4, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);

    // Subtle low thud
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = soundType === 'glass' ? 'sine' : 'triangle';
    const basePitch = soundType === 'stone' ? 140 : soundType === 'wood' ? 185 : soundType === 'glass' ? 980 : 110;
    osc.frequency.setValueAtTime(basePitch, now);
    osc.frequency.exponentialRampToValueAtTime(basePitch * 0.5, now + 0.08);
    oscGain.gain.setValueAtTime(0.14, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playBlockPlace(soundType: 'grass' | 'stone' | 'wood' | 'sand' | 'glass') {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const base = soundType === 'stone' ? 220 : soundType === 'wood' ? 260 : 180;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.35, now + 0.06);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playFootstep() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(115 + Math.random() * 25, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.045);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  public playJump() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.11);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playLaunchChime() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [392, 493.88, 587.33, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.1, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  private scheduleBellTone(
    ctx: AudioContext,
    startTime: number,
    freq: number,
    duration: number,
    peakGain: number,
    harmonicRatio = 2.0,
    harmonicScale = 0.22,
  ) {
    const fund = ctx.createOscillator();
    const fundGain = ctx.createGain();
    fund.type = 'sine';
    fund.frequency.setValueAtTime(freq, startTime);
    fundGain.gain.setValueAtTime(0.0001, startTime);
    fundGain.gain.linearRampToValueAtTime(peakGain, startTime + 0.008);
    fundGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    fund.connect(fundGain);
    fundGain.connect(ctx.destination);
    fund.start(startTime);
    fund.stop(startTime + duration + 0.02);

    if (harmonicScale > 0) {
      const harm = ctx.createOscillator();
      const harmGain = ctx.createGain();
      harm.type = 'sine';
      harm.frequency.setValueAtTime(freq * harmonicRatio, startTime);
      harmGain.gain.setValueAtTime(0.0001, startTime);
      harmGain.gain.linearRampToValueAtTime(peakGain * harmonicScale, startTime + 0.005);
      harmGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.65);
      harm.connect(harmGain);
      harmGain.connect(ctx.destination);
      harm.start(startTime);
      harm.stop(startTime + duration * 0.68);
    }
  }

  private schedulePneumaticDoorSlide(ctx: AudioContext, startTime: number, opening: boolean) {
    const duration = opening ? 0.28 : 0.36;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      const env = opening
        ? Math.sin(Math.min(1, t * 4) * Math.PI * 0.5) * Math.pow(1 - t, 1.5)
        : Math.sin(t * Math.PI) * 0.85;
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(opening ? 950 : 720, startTime);
    filter.frequency.exponentialRampToValueAtTime(opening ? 1550 : 480, startTime + duration);
    filter.Q.setValueAtTime(1.8, startTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(opening ? 0.045 : 0.052, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0005, startTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(startTime);

    if (!opening) {
      // Soft rubber door gasket seal thud at the end of door travel
      const thudTime = startTime + duration * 0.92;
      const thud = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thud.type = 'triangle';
      thud.frequency.setValueAtTime(92, thudTime);
      thud.frequency.exponentialRampToValueAtTime(42, thudTime + 0.075);
      thudGain.gain.setValueAtTime(0.065, thudTime);
      thudGain.gain.exponentialRampToValueAtTime(0.0005, thudTime + 0.08);
      thud.connect(thudGain);
      thudGain.connect(ctx.destination);
      thud.start(thudTime);
      thud.stop(thudTime + 0.09);
    }
  }

  public playTrainDoorChime(opening: boolean, modelId?: MtrTrainModelId) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (modelId === 'hk_mtr_m_train' || modelId === 'hk_mtr_airport') {
      if (opening) {
        // Hong Kong MTR: crisp two-tone arrival/open chime + pneumatic unseal
        this.scheduleBellTone(ctx, now, 659.25, 0.22, 0.07, 2.0, 0.18); // E5
        this.scheduleBellTone(ctx, now + 0.13, 880.0, 0.28, 0.075, 2.0, 0.16); // A5
        this.schedulePneumaticDoorSlide(ctx, now + 0.06, true);
      } else {
        // Hong Kong MTR: signature rapid multi-pulse "do-do-do-do..." door-closing warning chimes
        // Real HK MTR trains sound ~12 crisp ~1174Hz (D6) pulses at ~68ms intervals before doors slide shut
        const pulseCount = 12;
        const interval = 0.068;
        for (let i = 0; i < pulseCount; i++) {
          this.scheduleBellTone(ctx, now + i * interval, 1174.66, 0.046, 0.062, 2.0, 0.24);
        }
        this.schedulePneumaticDoorSlide(ctx, now + 0.72, false);
      }
      return;
    }

    if (modelId === 'bangkok_mrt_blue') {
      if (opening) {
        // Bangkok MRT Blue Line (Siemens Modular Metro): warm descending 2-tone station arrival chime
        this.scheduleBellTone(ctx, now, 659.25, 0.24, 0.075, 2.0, 0.14); // E5
        this.scheduleBellTone(ctx, now + 0.15, 523.25, 0.34, 0.08, 2.0, 0.12); // C5
        this.schedulePneumaticDoorSlide(ctx, now + 0.08, true);
      } else {
        // Bangkok MRT Blue Line: crisp 5-beat Siemens warning pulse ("bi-bi-bi-bi-bi")
        const pulseCount = 5;
        const interval = 0.142;
        for (let i = 0; i < pulseCount; i++) {
          this.scheduleBellTone(ctx, now + i * interval, 1479.98, 0.085, 0.065, 1.5, 0.18); // F#6
        }
        this.schedulePneumaticDoorSlide(ctx, now + 0.68, false);
      }
      return;
    }

    if (modelId === 'nyc_subway_r160' || modelId === 'nyc_subway_r211') {
      if (opening) {
        // NYC MTA R160/R211: quick electronic door-release chirp + air release
        this.scheduleBellTone(ctx, now, 880.0, 0.11, 0.065, 2.0, 0.18);
        this.schedulePneumaticDoorSlide(ctx, now + 0.04, true);
      } else {
        // NYC Subway MTA R160/R211: iconic two-tone descending "Bing-Bong" electric door closing chime
        this.scheduleBellTone(ctx, now, 659.25, 0.34, 0.088, 2.01, 0.25); // "Bing" (E5)
        this.scheduleBellTone(ctx, now + 0.26, 523.25, 0.56, 0.092, 2.01, 0.22); // "Bong" (C5)
        this.schedulePneumaticDoorSlide(ctx, now + 0.58, false);
      }
      return;
    }

    // Default generic transit chime
    if (opening) {
      this.scheduleBellTone(ctx, now, 523.25, 0.2, 0.065, 2.0, 0.16);
      this.scheduleBellTone(ctx, now + 0.11, 659.25, 0.24, 0.07, 2.0, 0.16);
      this.schedulePneumaticDoorSlide(ctx, now + 0.05, true);
    } else {
      for (let i = 0; i < 4; i++) {
        this.scheduleBellTone(ctx, now + i * 0.12, 880, 0.08, 0.058, 2.0, 0.18);
      }
      this.schedulePneumaticDoorSlide(ctx, now + 0.48, false);
    }
  }

  public stopAnnouncement() {
    if (this.announcementTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.announcementTimer);
      this.announcementTimer = null;
    }
    if (this.activeAnnouncementAudio) {
      try {
        this.activeAnnouncementAudio.pause();
        this.activeAnnouncementAudio.currentTime = 0;
      } catch {
        // ignore audio reset error
      }
      this.activeAnnouncementAudio = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore speech cancel error
      }
    }
  }

  public playStationAnnouncement(text: string, audioDataUrl?: string) {
    if (this.muted) return;
    this.stopAnnouncement();

    const ctx = this.ensureContext();
    if (ctx) {
      const now = ctx.currentTime;
      const notes = [587.33, 739.99, 880];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const t = now + i * 0.11;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.08, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.3);
      });
    }

    if (typeof window === 'undefined') return;

    const speakText = () => {
      if (this.muted || !text.trim() || !('speechSynthesis' in window)) return;
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.98;
        utterance.pitch = 1.0;
        utterance.volume = 0.88;
        window.speechSynthesis.speak(utterance);
      } catch {
        // ignore SpeechSynthesis failures in headless/restricted contexts
      }
    };

    this.announcementTimer = window.setTimeout(() => {
      this.announcementTimer = null;
      if (this.muted) return;

      if (audioDataUrl) {
        try {
          const audio = new Audio(audioDataUrl);
          audio.volume = 0.92;
          this.activeAnnouncementAudio = audio;
          audio.onended = () => {
            if (this.activeAnnouncementAudio === audio) {
              this.activeAnnouncementAudio = null;
            }
          };
          audio.onerror = () => {
            if (this.activeAnnouncementAudio === audio) {
              this.activeAnnouncementAudio = null;
            }
            speakText();
          };
          audio.play().catch(() => {
            speakText();
          });
          return;
        } catch {
          // fallback to speech synthesis
        }
      }

      speakText();
    }, 360);
  }
}

export const voxelAudio = new VoxelAudioEngine();
