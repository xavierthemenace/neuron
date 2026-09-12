import type { MetadataRoute } from "next";

// The manifest has no dynamic inputs, and a static export needs to be told so
// before it will write it out as a file.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Neuron — Intelligence Map",
    short_name: "Neuron",
    description:
      "A local-first map of trainable intelligence with cognitive workouts, journals, analytics, and offline access.",
    start_url: "/",
    display: "standalone",
    background_color: "#efece6",
    theme_color: "#efece6",
    orientation: "any",
    categories: ["education", "productivity", "health"],
    icons: [
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      {
        src: "/neuron-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
