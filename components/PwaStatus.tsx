"use client";

import { useEffect, useState } from "react";

/**
 * The service worker is cache-first for same-origin GETs, which is right for a
 * shipped offline-capable app and wrong during development: it would serve
 * stale JS chunks and defeat hot reload.
 */
const SERVICE_WORKER_ENABLED = process.env.NODE_ENV === "production";

export function PwaStatus() {
  // Always starts optimistic so the client's first paint matches the
  // prerendered HTML. The real value is read in the effect below.
  const [online, setOnline] = useState(true);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    // `navigator.onLine` can read false while the network stack is still coming
    // up, and the browser does not always emit a matching "online" event once
    // it settles. Reading it once at mount and then only trusting events left
    // the banner stuck on "Offline mode" while the app was demonstrably online,
    // so re-sync from the property whenever the page could have missed a
    // transition.
    const sync = () => setOnline(navigator.onLine);
    sync();

    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };

    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (!SERVICE_WORKER_ENABLED) {
      // Tear down a worker installed by an earlier production visit (or a
      // previous dev session), otherwise it keeps serving cached chunks here.
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister())),
        )
        .catch(() => undefined);
      return;
    }

    if (navigator.storage?.persist) {
      void navigator.storage.persist().catch(() => false);
    }

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateReady(true);
            }
          });
        });

        // A worker that installed while the page was closed is already waiting
        // when we register. Without this the update banner only ever appears
        // for people who happen to be looking at the tab at the right moment.
        if (registration.waiting && navigator.serviceWorker.controller) {
          setUpdateReady(true);
        }
        void registration.update().catch(() => undefined);

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
  }, []);

  if (online && !updateReady) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-3 left-1/2 z-[90] -translate-x-1/2 rounded-full border border-white/12 bg-[rgb(25_22_20_/_0.92)] px-3 py-1.5 text-[10px] text-neutral-300 shadow-xl backdrop-blur-xl"
    >
      {online ? (
        <button
          type="button"
          onClick={() => {
            // Tell the waiting worker to take over before reloading. Reloading
            // alone can land back on the old worker, which is how a user ends
            // up clicking "update" repeatedly with nothing changing.
            void navigator.serviceWorker
              .getRegistration()
              .then((registration) => {
                registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
              })
              .finally(() => window.location.reload());
          }}
          className="min-h-[32px] px-1 hover:text-white"
        >
          A new version of Neuron is ready · reload to use it
        </button>
      ) : (
        <span>
          Offline · the map, your journals, progress, diagnostics and session
          planning all work without a connection
        </span>
      )}
    </div>
  );
}
