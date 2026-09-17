import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "fitcoach",
    short_name: "fitcoach",
    description: "Una scheda che dice il perché. Un coach che ti scrive il giorno in cui non hai voglia.",
    lang: "it",
    start_url: "/oggi",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F4F4F1",
    theme_color: "#F4F4F1",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
