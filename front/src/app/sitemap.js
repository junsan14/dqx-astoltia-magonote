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

  const now = new Date();

  const jaUrls = routes.map((route) => {
    const jaUrl = `${baseUrl}${route || "/"}`;
    const enUrl = route === "" ? `${baseUrl}/en` : `${baseUrl}/en${route}`;

    return {
      url: jaUrl,
      lastModified: now,
      changeFrequency: "weekly",
      priority: route === "" ? 1 : 0.9,
      alternates: {
        languages: {
          ja: jaUrl,
          en: enUrl,
          "x-default": jaUrl,
        },
      },
    };
  });

  const enUrls = routes.map((route) => {
    const jaUrl = `${baseUrl}${route || "/"}`;
    const enUrl = route === "" ? `${baseUrl}/en` : `${baseUrl}/en${route}`;

    return {
      url: enUrl,
      lastModified: now,
      changeFrequency: "weekly",
      priority: route === "" ? 1 : 0.9,
      alternates: {
        languages: {
          ja: jaUrl,
          en: enUrl,
          "x-default": jaUrl,
        },
      },
    };
  });

  return [...jaUrls, ...enUrls];
}