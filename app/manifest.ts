import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Neuron — Intelligence Map",
    short_name: "Neuron",
    description:
      "A local-first map of trainable intelligence with cognitive workouts, journals, analytics, and offline access.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0f16",
    theme_color: "#0d0f16",
    orientation: "any",
    categories: ["education", "productivity", "health"],
    icons: [
      {
        src: "/neuron-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/neuron-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
