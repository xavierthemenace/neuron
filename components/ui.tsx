"use client";

import { useId, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  CONFIDENCE_BLURB,
  CONFIDENCE_HUE,
  CONFIDENCE_LABEL,
  KIND_BLURB,
  KIND_GLYPH,
  KIND_LABEL,
} from "@/lib/evidence";
import { ESTIMATE_CONFIDENCE_LABEL, type EstimateConfidence } from "@/lib/competence";
import type { EvidenceConfidence, NodeKind } from "@/lib/types";
import { useDismissable } from "./useDismissable";

/**
 * Shared primitives.
 *
 * Two rules are enforced here rather than left to each screen: a number is
 * never rendered without the confidence that belongs to it, and every
 * recommendation carries a "Why?" that expands into the actual reasoning. Both
 * are easy to honour in one component and impossible to honour consistently in
 * twenty.
 */

export function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
            {title}
          </h3>
          {hint && <p className="mt-0.5 text-[9px] leading-relaxed text-neutral-600">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A labelled 0-1 bar. `caption` is where the honesty goes. */
export function Meter({
  label,
  value,
  hue = 230,
  caption,
  emphasis = false,
}: {
  label: string;
  value: number;
  hue?: number;
  caption?: string;
  emphasis?: boolean;
}) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        <span className={emphasis ? "font-medium text-neutral-200" : "text-neutral-400"}>
          {label}
        </span>
        <span className="tabular-nums text-neutral-300">{percent}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${percent}%`,
            background: `oklch(0.56 ${emphasis ? 0.15 : 0.09} ${hue})`,
            boxShadow: undefined,
          }}
        />
      </div>
      {caption && <p className="mt-1 text-[9px] leading-relaxed text-neutral-600">{caption}</p>}
    </div>
  );
}

export function ConfidenceChip({
  band,
  prefix,
}: {
  band: EvidenceConfidence;
  prefix?: string;
}) {
  const hue = CONFIDENCE_HUE[band];
  return (
    <span
      title={CONFIDENCE_BLURB[band]}
      className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider"
      style={{
        borderColor: `oklch(0.55 0.12 ${hue} / 0.38)`,
        background: `oklch(0.72 0.11 ${hue} / 0.18)`,
        color: `oklch(0.42 0.12 ${hue})`,
      }}
    >
      {prefix && <span className="font-normal normal-case opacity-70">{prefix}</span>}
      {CONFIDENCE_LABEL[band]}
    </span>
  );
}

/**
 * Estimate confidence, which is a different claim from scientific evidence
 * confidence and is deliberately styled differently so the two never blur.
 */
export function EstimateChip({
  level,
  observations,
}: {
  level: EstimateConfidence;
  observations?: number;
}) {
  const tone =
    level === "high"
      ? "border-emerald-300/25 bg-emerald-300/[0.07] text-emerald-100/85"
      : level === "medium"
        ? "border-sky-300/25 bg-sky-300/[0.07] text-sky-100/85"
        : level === "low"
          ? "border-amber-300/25 bg-amber-300/[0.07] text-amber-100/80"
          : "border-white/12 bg-white/[0.03] text-neutral-500";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${tone}`}
    >
      Confidence: {ESTIMATE_CONFIDENCE_LABEL[level]}
      {observations !== undefined && observations > 0 && (
        <span className="opacity-60">· {observations} obs</span>
      )}
    </span>
  );
}

export function KindChip({ kind }: { kind: NodeKind }) {
  return (
    <span
      title={KIND_BLURB[kind]}
      className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.03] px-1.5 py-0.5 text-[9px] text-neutral-400"
    >
      <span aria-hidden="true">{KIND_GLYPH[kind]}</span>
      {KIND_LABEL[kind]}
    </span>
  );
}

/**
 * The "Why?" disclosure.
 *
 * Every score, ranking and recommendation in Neuron is required to be able to
 * explain itself. Making that one component means an unexplained number is a
 * visibly missing element rather than an invisible omission.
 */
export function Why({
  summary = "Why?",
  children,
}: {
  summary?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={id}
        className="rounded text-[10px] text-neutral-500 underline decoration-dotted underline-offset-2 transition-colors hover:text-neutral-200"
      >
        {summary}
      </button>
      {open && (
        <div
          id={id}
          className="mt-1.5 rounded-lg border border-white/8 bg-black/25 p-2.5 text-[10px] leading-relaxed text-neutral-400"
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** A modal sheet: focus-trapped, Escape-ordered, and scroll-contained. */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide = false,
  asScreen = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  /**
   * A destination reached from the navigation bar rather than something
   * stacked over the screen you were on. It drops the scrim and fills the
   * phone, because dimming the page behind a place you deliberately went is
   * how a modal looks, not how a screen looks.
   */
  asScreen?: boolean;
}) {
  const dialogRef = useRef<HTMLElement | null>(null);
  useDismissable({ open, onClose, modal: true, container: dialogRef });

  if (!open) return null;

  return (
    <div
      className={[
        "fixed inset-0 z-[80] flex justify-center sm:items-center sm:p-4",
        // A screen starts at the top and stops above the navigation bar; a
        // modal rises from the bottom edge.
        asScreen ? "items-start" : "items-end",
        asScreen
          ? "bg-[var(--paper)] sm:bg-[rgb(25_22_20_/_0.28)] sm:backdrop-blur-sm"
          : "bg-[rgb(25_22_20_/_0.34)] backdrop-blur-sm",
      ].join(" ")}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef as RefObject<HTMLElement>}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={[
          "flex max-h-[92dvh] w-full flex-col overflow-hidden border-white/12 bg-[rgb(255_255_255_/_0.985)] shadow-2xl",
          "rounded-t-2xl border-t sm:rounded-2xl sm:border",
          asScreen
            ? "max-h-none h-[calc(100dvh-68px-var(--safe-bottom))] rounded-t-none border-t-0 sm:h-auto sm:max-h-[92dvh] sm:rounded-2xl sm:border"
            : "",
          wide ? "sm:max-w-5xl" : "sm:max-w-2xl",
        ].join(" ")}
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-white">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-[10px] leading-relaxed text-neutral-500">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-neutral-500 transition-colors hover:bg-white/7 hover:text-white"
          >
            <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" aria-hidden="true">
              <path
                d="M2 2l10 10M12 2 2 12"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <footer className="shrink-0 border-t border-white/8 px-5 py-3 text-[10px] text-neutral-500">
            {footer}
          </footer>
        )}
      </section>
    </div>
  );
}

export function Chip({
  children,
  tone = "neutral",
  onClick,
  title,
  pressed,
}: {
  children: ReactNode;
  tone?: "neutral" | "active" | "warn";
  onClick?: () => void;
  title?: string;
  pressed?: boolean;
}) {
  const className = [
    "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
    // 44px targets are not achievable for inline chips inside dense prose, but
    // the padding here keeps them above the 24px WCAG 2.2 minimum.
    "min-h-[24px]",
    tone === "active"
      ? "border-cyan-300/35 bg-cyan-300/12 text-cyan-50"
      : tone === "warn"
        ? "border-amber-300/25 bg-amber-300/[0.07] text-amber-100/85"
        : "border-white/12 bg-white/[0.03] text-neutral-300",
    onClick ? "hover:border-white/30 hover:bg-white/[0.07] hover:text-white" : "",
  ].join(" ");

  if (!onClick) {
    return (
      <span className={className} title={title}>
        {children}
      </span>
    );
  }
  return (
    <button type="button" onClick={onClick} title={title} aria-pressed={pressed} className={className}>
      {children}
    </button>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center">
      <p className="text-xs font-medium text-neutral-300">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-[11px] leading-relaxed text-neutral-500">{body}</p>
    </div>
  );
}

/** A short, honest caveat. Used wherever a number could be over-read. */
export function Caveat({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-2 text-[10px] leading-relaxed text-neutral-500">
      {children}
    </p>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-neutral-500">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[9px] text-neutral-600">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs text-neutral-100 outline-none transition-colors placeholder:text-neutral-600 focus:border-white/30 focus:bg-black/50";

export const buttonClass =
  "rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-xs text-neutral-200 transition-colors hover:border-white/28 hover:bg-white/[0.09] hover:text-white disabled:cursor-not-allowed disabled:opacity-40";

export const primaryButtonClass =
  "rounded-lg border border-cyan-300/30 bg-cyan-300/15 px-3 py-2 text-xs font-medium text-cyan-50 transition-colors hover:bg-cyan-300/25 disabled:cursor-not-allowed disabled:opacity-40";
