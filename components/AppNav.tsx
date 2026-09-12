"use client";

export type Screen = "today" | "map" | "data";

/**
 * Three destinations, not eleven.
 *
 * Everything the app can do still exists; what changed is that it is reachable
 * from somewhere rather than from a modal stacked on a modal. On a phone the
 * bar sits at the bottom where a thumb is, and clears the home indicator.
 */

const ITEMS: { id: Screen; label: string; icon: React.ReactNode }[] = [
  {
    id: "today",
    label: "Today",
    icon: (
      <path
        d="M4 8.5h14M6.5 3.5v3M15.5 3.5v3M4.8 5h12.4a.8.8 0 0 1 .8.8v11.4a.8.8 0 0 1-.8.8H4.8a.8.8 0 0 1-.8-.8V5.8a.8.8 0 0 1 .8-.8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    ),
  },
  {
    id: "map",
    label: "Map",
    icon: (
      <g fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="5" cy="6" r="2.1" />
        <circle cx="16" cy="9" r="2.1" />
        <circle cx="8" cy="16" r="2.1" />
        <path d="M6.9 7.2 14.1 8.4M14.6 10.8 9.6 14.4M6.2 8 7.4 13.9" strokeLinecap="round" />
      </g>
    ),
  },
  {
    id: "data",
    label: "Record",
    icon: (
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M4 17V9.5M8.6 17V4.5M13.3 17v-6M18 17V7.5" />
      </g>
    ),
  },
];

export function AppNav({
  screen,
  onChange,
  badge,
}: {
  screen: Screen;
  onChange: (screen: Screen) => void;
  /** Count shown on Record, so the queue is visible without opening it. */
  badge?: number;
}) {
  return (
    <nav
      aria-label="Main"
      className={[
        "fixed z-30 flex",
        // Phone: a real bottom bar, clear of the home indicator.
        "inset-x-0 bottom-0 border-t border-[var(--rule)] bg-[var(--panel)] backdrop-blur-xl",
        "pb-[var(--safe-bottom)]",
        // Laptop: a small pill, out of the way of the map.
        "sm:inset-x-auto sm:bottom-auto sm:left-4 sm:top-4 sm:gap-1 sm:rounded-full sm:border sm:p-1 sm:shadow-[0_6px_20px_rgb(25_22_20_/_0.10)]",
      ].join(" ")}
    >
      {ITEMS.map((item) => {
        const active = screen === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            aria-current={active ? "page" : undefined}
            className={[
              "relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
              "sm:min-h-[40px] sm:flex-none sm:flex-row sm:gap-2 sm:rounded-full sm:px-4 sm:py-0 sm:text-[12.5px]",
              active
                ? "text-[var(--green)] sm:bg-[var(--green)] sm:text-[#f3efe7]"
                : "text-[var(--ink-faint)] hover:text-[var(--ink)]",
            ].join(" ")}
          >
            <svg viewBox="0 0 22 22" className="h-[21px] w-[21px] sm:h-4 sm:w-4" aria-hidden="true">
              {item.icon}
            </svg>
            {item.label}
            {item.id === "data" && badge !== undefined && badge > 0 && (
              <span
                aria-label={`${badge} waiting`}
                className={[
                  "grid h-[15px] min-w-[15px] place-items-center rounded-full px-[3px] text-[9px] font-bold text-[var(--pop-ink)]",
                  // Over the icon on a phone, where the label sits underneath;
                  // beside the label on a laptop, where it would cover it.
                  "absolute left-[calc(50%+7px)] top-[11px]",
                  "sm:static sm:ml-0.5",
                ].join(" ")}
                style={{ background: "var(--pop)" }}
              >
                {badge > 9 ? "9+" : badge}
              </span>
            )}
            {active && (
              <span
                aria-hidden="true"
                className="absolute inset-x-[30%] top-0 h-[2px] rounded-full sm:hidden"
                style={{ background: "var(--green)" }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
