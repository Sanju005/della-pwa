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
        src: "/brand/app-icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/app-icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/brand/apple-icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
