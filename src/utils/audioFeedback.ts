// Web Audio API synthesized feedback (no external assets needed, 100% offline)

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx && typeof window !== "undefined") {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Play a pleasant, melodic chime for correct answers
 */
export function playCorrectSound(enabled: boolean = true): void {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    
    // First tone (G5: 784Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(784, now);
    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.18);

    // Second harmonious tone (C6: 1046Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1046.5, now + 0.1);
    gain2.gain.setValueAtTime(0.1, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.35);
  } catch {
    // Ignore audio autoplay restrictions
  }
}

/**
 * Play a gentle, soft low tone for wrong answers (never harsh)
 */
export function playWrongSound(enabled: boolean = true): void {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = "triangle";
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.linearRampToValueAtTime(180, now + 0.22);
    
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  } catch {
    // Ignore audio restrictions
  }
}

/**
 * Play a micro subtle tap sound for option selections
 */
export function playClickSound(enabled: boolean = true): void {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, now);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  } catch {
    // Ignore
  }
}

/**
 * Play a triumphant victory fanfare for 100% accuracy / perfect scores
 */
export function playVictoryFanfare(enabled: boolean = true): void {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const notes = [
      { freq: 523.25, time: 0.0, dur: 0.16 }, // C5
      { freq: 659.25, time: 0.12, dur: 0.16 }, // E5
      { freq: 783.99, time: 0.24, dur: 0.2 }, // G5
      { freq: 1046.5, time: 0.4, dur: 0.55 }, // C6 (triumphant hold)
    ];

    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + time);
      gain.gain.setValueAtTime(0.09, now + time);
      gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + time);
      osc.stop(now + time + dur);
    });
  } catch {
    // Ignore audio restrictions
  }
}

/**
 * Trigger subtle haptic vibration on mobile devices
 */
export function triggerHaptic(
  type: "light" | "success" | "warning" = "light",
  enabled: boolean = true
): void {
  if (!enabled || typeof navigator === "undefined" || !("vibrate" in navigator)) {
    return;
  }
  try {
    if (type === "light") {
      navigator.vibrate(10);
    } else if (type === "success") {
      navigator.vibrate([15, 30, 15]);
    } else if (type === "warning") {
      navigator.vibrate([25, 40, 25]);
    }
  } catch {
    // Ignore devices that don't support vibration
  }
}


