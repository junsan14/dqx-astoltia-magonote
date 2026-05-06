export default function sitemap() {
  const baseUrl = "https://www.dqx-tool.com";

  const routes = [
    "",
    "/tools/monster-search",
    "/tools/craft-profit",
    "/tools/monster-zukan",
    "/tools/map-monster-browser",
    "/tools/kishoju",
    "/tools/weight-checker",
  ];

  const locales = ["ja", "en"];

  return locales.flatMap((locale) =>
    routes.map((route) => ({
      url: `${baseUrl}/${locale}${route}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: route === "" ? 1 : 0.9,
      alternates: {
        languages: {
          ja: `${baseUrl}/ja${route}`,
          en: `${baseUrl}/en${route}`,
        },
      },
    }))
  );
}