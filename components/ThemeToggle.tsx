"use client";

import { useSyncExternalStore } from "react";
import {
  THEME_LABEL,
  applyTheme,
  nextTheme,
  readTheme,
  serverTheme,
  subscribeTheme,
  type ThemePreference,
} from "@/lib/theme";

const ICON: Record<ThemePreference, React.ReactNode> = {
  system: (
    <g fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="4" width="14" height="10" rx="1.6" />
      <path d="M7 17h6" strokeLinecap="round" />
    </g>
  ),
  light: (
    <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="10" cy="10" r="3.4" />
      <path d="M10 2.4v1.8M10 15.8v1.8M2.4 10h1.8M15.8 10h1.8M4.6 4.6l1.3 1.3M14.1 14.1l1.3 1.3M15.4 4.6l-1.3 1.3M5.9 14.1l-1.3 1.3" />
    </g>
  ),
  dark: (
    <path
      d="M15.6 11.8A6.2 6.2 0 0 1 8.2 4.4a6.2 6.2 0 1 0 7.4 7.4Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  ),
};

/**
 * One control, three states.
 *
 * Starts on "match the system", which is the answer most people want and
 * nobody has to set. The other two exist because a machine set to dark at
 * night is not the same as a person who wants this app dark.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  // The preference lives in localStorage and on the document element, so it is
  // read as an external store. The server renders "system", which is also what
  // the first client render sees — the inline boot script has already put the
  // real value on the element, so nothing flashes while React catches up.
  const theme = useSyncExternalStore(subscribeTheme, readTheme, serverTheme);

  const change = () => applyTheme(nextTheme(theme));

  return (
    <button
      type="button"
      onClick={change}
      title={`Appearance: ${THEME_LABEL[theme]}. Click for ${THEME_LABEL[nextTheme(theme)].toLowerCase()}.`}
      aria-label={`Appearance: ${THEME_LABEL[theme]}. Change it.`}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-neutral-500 transition-colors hover:bg-white/[0.07] hover:text-neutral-100 ${className}`}
    >
      <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" aria-hidden="true">
        {ICON[theme]}
      </svg>
    </button>
  );
}
