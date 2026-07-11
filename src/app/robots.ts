import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/app", "/admin", "/api/", "/auth/", "/profile", "/credits"],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/app", "/admin", "/api/", "/auth/", "/profile", "/credits"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
