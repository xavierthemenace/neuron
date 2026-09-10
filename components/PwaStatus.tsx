"use client";

import { useEffect, useState } from "react";

export function PwaStatus() {
  const [online, setOnline] = useState(true);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((registration) => {
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateReady(true);
            }
          });
        });
      }).catch(() => undefined);
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
        <button type="button" onClick={() => window.location.reload()} className="hover:text-white">
          Neuron update ready · reload
        </button>
      ) : (
        <span>Offline mode · cached graph, journals, progress, and workouts remain available</span>
      )}
    </div>
  );
}
