/**
 * Synthesized sound feedback using the Web Audio API.
 * No external audio files — keeps the bundle small and the sounds clinical.
 * Honors a user preference in localStorage ("medstock_sound" === "off").
 */

const PREF_KEY = "medstock_sound";

export type SoundKind = "scanOk" | "scanError" | "saveOk" | "saveError" | "notify";

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const C =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      ctx = new C();
    } catch {
      ctx = null;
    }
  }
  return ctx;
}

export function isSoundOn(): boolean {
  return localStorage.getItem(PREF_KEY) !== "off";
}

export function setSoundOn(on: boolean): void {
  localStorage.setItem(PREF_KEY, on ? "on" : "off");
}

type Tone = {
  freq: number;
  duration: number; // seconds
  delay?: number; // seconds
  type?: OscillatorType;
  volume?: number; // 0..1
};

function playTones(tones: Tone[]) {
  if (!isSoundOn()) return;
  const ac = getContext();
  if (!ac) return;

  // Some browsers (and Tauri on first load) require a user-gesture resume.
  if (ac.state === "suspended") {
    void ac.resume();
  }

  const now = ac.currentTime;
  for (const tone of tones) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = tone.type ?? "sine";
    osc.frequency.value = tone.freq;

    const start = now + (tone.delay ?? 0);
    const stop = start + tone.duration;
    const peak = tone.volume ?? 0.08;

    // Tiny attack/release so it never pops.
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.01);
    gain.gain.linearRampToValueAtTime(0, stop);

    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(start);
    osc.stop(stop + 0.02);
  }
}

const presets: Record<SoundKind, Tone[]> = {
  scanOk: [
    { freq: 880, duration: 0.08 },
    { freq: 1320, duration: 0.1, delay: 0.07 },
  ],
  scanError: [
    { freq: 220, duration: 0.18, type: "square", volume: 0.06 },
  ],
  saveOk: [{ freq: 720, duration: 0.12 }],
  saveError: [{ freq: 180, duration: 0.2, type: "square", volume: 0.06 }],
  notify: [
    { freq: 660, duration: 0.07 },
    { freq: 990, duration: 0.07, delay: 0.06 },
  ],
};

export function playSound(kind: SoundKind) {
  playTones(presets[kind]);
}
