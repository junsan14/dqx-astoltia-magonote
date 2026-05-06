import "./globals.css";
import { mochiy, kosugi } from "@/app/fonts";
import { GoogleTagManager } from "@next/third-parties/google";
import { RouteProgressProvider } from "@/components/common/route-progress/RouteProgressProvider";
import RouteProgressBar from "@/components/common/route-progress/RouteProgressBar";
import RouteProgressAutoDone from "@/components/common/route-progress/RouteProgressAutoDone";
import { Suspense } from "react";
/*
export const metadata = {
  metadataBase: new URL("https://www.dqx-tool.com"),

  title: {
    default: "DQX Tools | ドラクエ10向け便利ツール集",
    template: "%s | DQX Tools",
  },

  description:
    "ドラクエ10の装備、宝珠、レアドロップ、モンスター出現位置などをまとめて調べられる便利ツール集。",

  keywords: [
    "DQX Tools",
    "ドラクエ10",
    "ドラゴンクエスト10",
    "宝珠",
    "レアドロップ",
    "モンスター検索",
    "職人",
    "原価計算",
    "装備",
    "マップ",
  ],

  alternates: {
    canonical: "/",
  },

  openGraph: {
    siteName: "DQX Tools",
    locale: "ja_JP",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
  },

  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};
*/
export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body className={`antialiased ${kosugi.className} ${mochiy.variable}`}>
        <RouteProgressProvider>
          <RouteProgressBar />
          <Suspense fallback={null}>
            <RouteProgressAutoDone />
          </Suspense>
          {children}
        </RouteProgressProvider>
      </body>

      {process.env.NODE_ENV === "production" && (
        <GoogleTagManager gtmId="GTM-K29NKBTR" />
      )}
    </html>
  );
}