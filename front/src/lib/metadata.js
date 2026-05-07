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

function normalizePath(path = "/") {
  if (!path || path === "/ja") return "/";
  return path.replace(/^\/ja(?=\/|$)/, "") || "/";
}

function getJapanesePath(path = "/") {
  const normalized = normalizePath(path);

  if (normalized === "/en") return "/";
  if (normalized.startsWith("/en/")) {
    return normalized.replace(/^\/en/, "") || "/";
  }

  return normalized;
}

function getEnglishPath(path = "/") {
  const jaPath = getJapanesePath(path);

  if (jaPath === "/") return "/en";
  return `/en${jaPath}`;
}

export function createBaseMetadata({
  locale = "ja",
  title,
  description,
  path = "/",
  image = siteConfig.ogp.top,
  withSiteName = true,
}) {
  const siteName = getSiteName(locale);
  const fullTitle = withSiteName ? `${title} | ${siteName}` : title;

  const canonicalPath = locale === "en" ? getEnglishPath(path) : getJapanesePath(path);

  return {
    title: fullTitle,
    description,

    alternates: {
      canonical: canonicalPath,
      languages: {
        ja: getJapanesePath(path),
        en: getEnglishPath(path),
        "x-default": getJapanesePath(path),
      },
    },

    openGraph: {
      title: fullTitle,
      description,
      url: canonicalPath,
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