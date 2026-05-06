export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/ja/admin/",
          "/en/admin/",
          "/ja/tools/kishoju/rooms/",
          "/en/tools/kishoju/rooms/",
        ],
      },
    ],
    sitemap: "https://www.dqx-tool.com/sitemap.xml",
    host: "https://www.dqx-tool.com",
  };
}