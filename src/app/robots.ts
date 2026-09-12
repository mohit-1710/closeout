import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/app", "/api/"] },
    sitemap: "https://closeout-ashen.vercel.app/sitemap.xml",
  };
}
