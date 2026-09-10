/**
 * A LIFO stack of dismissable layers.
 *
 * Every overlay used to register its own window keydown listener, which made
 * Escape ambiguous: with the AI Coach open on top of the side panel, one press
 * closed the *panel underneath* and left the modal up. Listeners on the same
 * target fire in registration order, so "who was mounted first" decided the
 * winner rather than "who is on top".
 *
 * Now a single listener owns the key and routes it to the most recently opened
 * layer, so Escape always peels exactly one layer off the top.
 */

export type DismissLayer = {
  /** Called when this layer is the topmost one and Escape is pressed. */
  close: () => void;
};

const stack: DismissLayer[] = [];
let listening = false;

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== "Escape" || stack.length === 0) return;
  // Let a composing IME or an in-progress autocomplete swallow its own Escape.
  if (event.defaultPrevented || event.isComposing) return;

  const top = stack[stack.length - 1];
  event.preventDefault();
  // Keeps any legacy per-component listener from also reacting to this press.
  event.stopImmediatePropagation();
  top.close();
}

function ensureListening() {
  if (listening || typeof window === "undefined") return;
  // Capture phase so the stack decides before anything closer to the target.
  window.addEventListener("keydown", onKeyDown, true);
  listening = true;
}

export function pushDismissLayer(layer: DismissLayer): () => void {
  ensureListening();
  stack.push(layer);
  return () => {
    const index = stack.lastIndexOf(layer);
    if (index !== -1) stack.splice(index, 1);
  };
}

/** Topmost-layer check, for components that need to know if they have focus priority. */
export function isTopDismissLayer(layer: DismissLayer): boolean {
  return stack[stack.length - 1] === layer;
}

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function focusableWithin(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) =>
      !element.hasAttribute("aria-hidden") &&
      (element.offsetWidth > 0 ||
        element.offsetHeight > 0 ||
        element === document.activeElement),
  );
}
