import "./globals.css";
import { mochiy, kosugi } from "@/app/fonts";
import { GoogleTagManager } from "@next/third-parties/google";
import { RouteProgressProvider } from "@/components/common/route-progress/RouteProgressProvider";
import RouteProgressBar from "@/components/common/route-progress/RouteProgressBar";

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body className={`antialiased ${kosugi.className} ${mochiy.variable}`}>
        <RouteProgressProvider>
          <RouteProgressBar />
          {children}
        </RouteProgressProvider>
      </body>

      {process.env.NODE_ENV === "production" && (
        <GoogleTagManager gtmId="GTM-K29NKBTR" />
      )}
    </html>
  );
}