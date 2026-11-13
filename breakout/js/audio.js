export class BreakoutAudio {
  constructor() {
    this.context = null;
  }

  unlock() {
    const AudioContext = window.AudioContext;
    if (!AudioContext) return;
    this.context ??= new AudioContext();
    if (this.context.state === "suspended") {
      void this.context.resume().catch((error) => {
        console.warn("Audio game tidak dapat diaktifkan", error);
      });
    }
  }

  play(type) {
    if (!this.context) return;

    const context = this.context;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const isPaddle = type === "paddle";
    const duration = isPaddle ? 0.11 : 0.07;

    oscillator.type = isPaddle ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(isPaddle ? 280 : 680, now);
    oscillator.frequency.exponentialRampToValueAtTime(isPaddle ? 190 : 420, now + duration);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  playGameOver() {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;

    const announcement = new window.SpeechSynthesisUtterance("Ha ha ha! Yaaah, payah.");
    announcement.lang = "id-ID";
    announcement.rate = 1.05;
    announcement.pitch = 1.15;
    window.speechSynthesis.speak(announcement);
  }

  playLevelComplete() {
    if (this.context) {
      const context = this.context;
      const now = context.currentTime;
      const sampleCount = Math.floor(context.sampleRate * 0.08);
      const applause = context.createBuffer(1, sampleCount, context.sampleRate);
      const samples = applause.getChannelData(0);
      for (let index = 0; index < sampleCount; index += 1) {
        samples[index] = Math.random() * 2 - 1;
      }

      for (let index = 0; index < 14; index += 1) {
        const start = now + index * 0.075 + Math.random() * 0.025;
        const source = context.createBufferSource();
        const filter = context.createBiquadFilter();
        const gain = context.createGain();
        source.buffer = applause;
        filter.type = "bandpass";
        filter.frequency.value = 1400 + Math.random() * 900;
        filter.Q.value = 0.8;
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(0.16, start + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.075);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(context.destination);
        source.start(start);
      }
    }

    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    const announcement = new window.SpeechSynthesisUtterance(
      "Selamat telah menyelesaikan level ini."
    );
    announcement.lang = "id-ID";
    announcement.rate = 1;
    announcement.pitch = 1;
    window.setTimeout(() => window.speechSynthesis.speak(announcement), 800);
  }
}
