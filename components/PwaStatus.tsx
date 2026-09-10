"use client";

import { useEffect, useState } from "react";

export function PwaStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    if (navigator.storage?.persist) {
      void navigator.storage.persist().catch(() => false);
    }

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          registration.addEventListener("updatefound", () => {
            const worker = registration.installing;
            if (!worker) return;
            worker.addEventListener("statechange", () => {
              if (
                worker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                setUpdateReady(true);
              }
            });
          });

          void navigator.serviceWorker.ready.then((ready) => {
            const urls = performance
              .getEntriesByType("resource")
              .map((entry) => entry.name)
              .filter((value) => {
                try {
                  return new URL(value).origin === window.location.origin;
                } catch {
                  return false;
                }
              });
            ready.active?.postMessage({
              type: "CACHE_URLS",
              urls: [window.location.href, ...urls],
            });
          });
        })
        .catch(() => undefined);
    }

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (online && !updateReady) return null;

  return (
    <div className="fixed bottom-3 left-1/2 z-[90] -translate-x-1/2 rounded-full border border-white/12 bg-black/80 px-3 py-1.5 text-[10px] text-neutral-300 shadow-xl backdrop-blur-xl">
      {online ? (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="hover:text-white"
        >
          Neuron update ready · reload
        </button>
      ) : (
        <span>
          Offline mode · cached graph, journals, progress, and workouts remain
          available
        </span>
      )}
    </div>
  );
}
