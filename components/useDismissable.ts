"use client";

import { useEffect, useRef, type RefObject } from "react";
import { focusableWithin, pushDismissLayer } from "@/lib/dismiss";

interface Options {
  open: boolean;
  onClose: () => void;
  /**
   * Modal layers move focus inside, trap Tab, and restore focus on close.
   * Non-modal layers (the side panel) only take part in Escape ordering, so
   * the graph stays keyboard-reachable while the panel is open.
   */
  modal?: boolean;
  container?: RefObject<HTMLElement | null>;
}

/**
 * Registers an overlay with the shared dismiss stack and, for modals, applies
 * the focus handling that `aria-modal="true"` promises but does not implement:
 * focus moves in on open, Tab cycles within, and the previously focused element
 * gets focus back on close.
 */
export function useDismissable({ open, onClose, modal = false, container }: Options) {
  // Kept in a ref so the layer identity stays stable while still calling the
  // latest onClose — otherwise a changed callback would reorder the stack.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    return pushDismissLayer({ close: () => onCloseRef.current() });
  }, [open]);

  useEffect(() => {
    if (!open || !modal) return;
    const node = container?.current;
    if (!node) return;

    const previous = document.activeElement as HTMLElement | null;

    // rAF: the dialog has just mounted, so wait for layout before measuring
    // which of its controls are actually visible.
    const frame = requestAnimationFrame(() => {
      if (document.activeElement && node.contains(document.activeElement)) return;
      const [first] = focusableWithin(node);
      if (first) first.focus();
      else {
        node.setAttribute("tabindex", "-1");
        node.focus();
      }
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = focusableWithin(node);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      // Wrap at both ends, and pull focus back if it escaped the dialog.
      if (!active || !node.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    node.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener("keydown", onKeyDown);
      // Reclaim focus when it is still inside the closing dialog, or when it
      // has been dropped entirely.
      //
      // The second case is the common one and used to be missed: React unmounts
      // the dialog before this cleanup runs, so `document.activeElement` is
      // already <body> and the old `node.contains(...)` check failed. Keyboard
      // users were silently returned to the top of the document on every
      // Escape. Focus is left alone only when it has genuinely moved somewhere
      // else, which means the user put it there deliberately.
      const active = document.activeElement;
      const focusWasLost = !active || active === document.body;
      if (previous?.isConnected && (focusWasLost || node.contains(active))) {
        previous.focus();
      }
    };
  }, [open, modal, container]);
}
