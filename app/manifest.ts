import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DELLA",
    short_name: "DELLA",
    description: "Book trusted home and lifestyle services in one DELLA app.",
    start_url: "/onboarding",
    display: "standalone",
    background_color: "#f5f1fb",
    theme_color: "#645394",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
