import "./globals.css";
import { mochiy, kosugi } from "@/app/fonts";
import { GoogleTagManager } from "@next/third-parties/google";
import { RouteProgressProvider } from "@/components/common/route-progress/RouteProgressProvider";
import RouteProgressBar from "@/components/common/route-progress/RouteProgressBar";
import RouteProgressAutoDone from "@/components/common/route-progress/RouteProgressAutoDone";
import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
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