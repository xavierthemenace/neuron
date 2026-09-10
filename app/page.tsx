"use client";

import dynamic from "next/dynamic";

/**
 * React Flow measures the DOM to lay out the viewport, so it must not render on
 * the server. `ssr: false` is only permitted inside a Client Component, which
 * is why this page carries the directive.
 */
const NeuralGraph = dynamic(() => import("@/components/NeuralGraph"), {
  ssr: false,
  loading: () => (
    <div className="grid h-dvh w-full place-items-center bg-[var(--surface)]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-3 w-3 animate-ping rounded-full bg-neutral-500" />
        <p className="text-xs tracking-widest text-neutral-600 uppercase">
          Wiring the network
        </p>
      </div>
    </div>
  ),
});

export default function Page() {
  return (
    <main className="relative h-dvh w-full">
      <NeuralGraph />
    </main>
  );
}
