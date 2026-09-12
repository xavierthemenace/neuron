/**
 * Light, dark, or whatever the machine says.
 *
 * Kept in localStorage rather than in the profile: it is a property of this
 * screen, not of the record, so it should not travel in a backup or follow a
 * profile onto someone else's monitor. It is read by an inline script before
 * first paint, which is the only way to avoid a white flash on the way into a
 * dark app.
 */

export type ThemePreference = "system" | "light" | "dark";

export const THEME_KEY = "neuron.theme";

export const THEME_LABEL: Record<ThemePreference, string> = {
  system: "Match the system",
  light: "Light",
  dark: "Dark",
};

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function readTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    // Private windows and blocked storage both throw rather than return null.
    return "system";
  }
}

/** Writes the attribute the stylesheet keys off, and remembers the choice. */
export function applyTheme(preference: ThemePreference): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (preference === "system") delete root.dataset.theme;
  else root.dataset.theme = preference;

  try {
    if (preference === "system") window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, preference);
  } catch {
    // A preference that cannot be saved still applies for this visit.
  }

  window.dispatchEvent(new Event(THEME_EVENT));
}

const THEME_EVENT = "neuron:theme";

/**
 * Subscription for `useSyncExternalStore`.
 *
 * The preference lives outside React — in localStorage, and on the document
 * element — so it is read as an external store rather than mirrored into
 * component state. The `storage` event covers a change made in another tab.
 */
export function subscribeTheme(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(THEME_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(THEME_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

/** What the server renders, before any preference is known. */
export function serverTheme(): ThemePreference {
  return "system";
}

/** The order the toggle walks through. */
export const THEME_CYCLE: ThemePreference[] = ["system", "light", "dark"];

export function nextTheme(current: ThemePreference): ThemePreference {
  return THEME_CYCLE[(THEME_CYCLE.indexOf(current) + 1) % THEME_CYCLE.length];
}

/**
 * The script that runs before first paint.
 *
 * Inlined into the document rather than imported, because anything that waits
 * for a bundle has already let the wrong background render.
 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(
  THEME_KEY,
)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;}catch(e){}`;
