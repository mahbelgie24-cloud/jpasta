"use client";

/**
 * New-order alert (Phase 2) — a two-tone chime synthesized with WebAudio
 * (no audio asset), a title flash for background tabs, and haptics where
 * available. Muted state persists in localStorage. Browsers gate audio
 * behind a user gesture: the first chime attempt after any interaction
 * succeeds; earlier attempts fail silently by design.
 */

let muted = false;

export function loadSoundPreference(): boolean {
  if (typeof window === "undefined") return true;
  muted = window.localStorage.getItem("jpasta.sound") === "off";
  return !muted;
}

export function setSoundPreference(enabled: boolean): void {
  muted = !enabled;
  window.localStorage.setItem("jpasta.sound", enabled ? "on" : "off");
}

let audioCtx: AudioContext | null = null;

function tone(
  ctx: AudioContext,
  freq: number,
  startAt: number,
  duration: number,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.22, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.03);
}

let titleFlashTimer: ReturnType<typeof setInterval> | null = null;
let baseTitle: string | null = null;

export function alertNewOrder(count: number): void {
  if (muted) return;

  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === "suspended") {
      void audioCtx.resume();
    }
    const t0 = audioCtx.currentTime + 0.01;
    tone(audioCtx, 880, t0, 0.16);
    tone(audioCtx, 1174.7, t0 + 0.18, 0.16);
    tone(audioCtx, 1567.98, t0 + 0.36, 0.22);
  } catch {
    // autoplay policy — silent until the next user gesture
  }

  try {
    navigator.vibrate?.([180, 90, 180]);
  } catch {
    // unsupported — fine
  }

  if (typeof document !== "undefined" && !titleFlashTimer) {
    baseTitle = document.title;
    let on = false;
    titleFlashTimer = setInterval(() => {
      on = !on;
      document.title = on
        ? `(${count}) طلب جديد — JPasta`
        : (baseTitle ?? document.title);
    }, 900);
    // stop flashing after 30s — the board itself shows the state
    setTimeout(() => clearTitleFlash(), 30000);
  }
}

/** Restore the title immediately (tab focused, order acknowledged, unmount). */
export function clearTitleFlash(): void {
  if (titleFlashTimer) {
    clearInterval(titleFlashTimer);
    titleFlashTimer = null;
  }
  if (baseTitle && typeof document !== "undefined") {
    document.title = baseTitle;
    baseTitle = null;
  }
}
