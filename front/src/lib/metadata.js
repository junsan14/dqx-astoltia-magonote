// src/lib/metadata.js

import { siteConfig } from "@/config/site";

export function getSiteName(locale = "ja") {
  return locale === "en" ? siteConfig.name.en : siteConfig.name.ja;
}

export function getSiteTitle(locale = "ja") {
  return locale === "en" ? siteConfig.title.en : siteConfig.title.ja;
}

export function getSiteDescription(locale = "ja") {
  return locale === "en"
    ? siteConfig.description.en
    : siteConfig.description.ja;
}

export function getOgLocale(locale = "ja") {
  return locale === "en" ? "en_US" : "ja_JP";
}

export function createBaseMetadata({
  locale = "ja",
  title,
  description,
  path,
  image = siteConfig.ogp.top,
  withSiteName = true,
}) {
  const siteName = getSiteName(locale);
  const fullTitle = withSiteName ? `${title} | ${siteName}` : title;

  return {
    title: fullTitle,
    description,

    alternates: {
      canonical: path,
      languages: {
        ja: path.replace(/^\/en/, "/ja"),
        en: path.replace(/^\/ja/, "/en"),
      },
    },

    openGraph: {
      title: fullTitle,
      description,
      url: path,
      siteName,
      locale: getOgLocale(locale),
      type: "website",
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: fullTitle,
        },
      ],
    },

    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image],
    },
  };
}