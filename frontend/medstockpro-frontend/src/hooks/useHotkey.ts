import { useEffect } from "react";

type HotkeyOptions = {
  /** Trigger even when focus is inside an input/textarea. Default: false */
  allowInInput?: boolean;
};

const isEditable = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable;
};

/**
 * Register a keyboard shortcut. Supports modifier prefixes:
 *   "mod+k"  — Cmd on macOS, Ctrl elsewhere
 *   "shift+/" "alt+n" "esc"
 *
 * Always lowercase. Single key like "n" is also accepted.
 */
export function useHotkey(
  combo: string,
  handler: (event: KeyboardEvent) => void,
  options: HotkeyOptions = {},
): void {
  useEffect(() => {
    const parts = combo.toLowerCase().split("+");
    const key = parts[parts.length - 1];
    const needMod = parts.includes("mod");
    const needShift = parts.includes("shift");
    const needAlt = parts.includes("alt");

    function onKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== key && event.code.toLowerCase() !== key)
        return;

      const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const modPressed = isMac ? event.metaKey : event.ctrlKey;

      if (needMod && !modPressed) return;
      if (!needMod && modPressed && key !== "escape") return;
      if (needShift !== event.shiftKey) return;
      if (needAlt !== event.altKey) return;

      if (!options.allowInInput && isEditable(event.target)) return;

      handler(event);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [combo, handler, options.allowInInput]);
}
