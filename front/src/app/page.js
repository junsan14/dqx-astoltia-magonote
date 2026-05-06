import { redirect } from "next/navigation";
import {
  createBaseMetadata,
  getSiteDescription,
  getSiteTitle,
} from "@/lib/metadata";

export function generateMetadata() {
  const locale = "ja";

  return createBaseMetadata({
    locale,
    title: getSiteTitle(locale),
    description: getSiteDescription(locale),
    path: "/",
    withSiteName: false,
  });
}

export default function Page() {
  redirect("/ja");
}