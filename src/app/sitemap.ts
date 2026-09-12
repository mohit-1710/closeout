import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/product", "/how-it-works"].map((route) => ({
    url: `https://closeout-ashen.vercel.app${route}`,
    changeFrequency: "weekly",
    priority: route === "/" ? 1 : 0.8,
  }));
}
