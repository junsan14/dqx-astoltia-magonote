import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { fetchMonsterDetail } from "@/lib/monsters";
import { createBaseMetadata } from "@/lib/metadata";
import MonsterDropSection from "@/components/tools/monsters/detail/MonsterDropSection";
import MonsterMapSection from "@/components/tools/monsters/detail/MonsterMapSection";
import MonsterDetailPageClientShell from "@/components/tools/monsters/detail/MonsterDetailPageClientShell";
import MonsterOverviewSection from "@/components/tools/monsters/detail/MonsterOverviewSection";

export async function generateMetadata({ params }) {
  const { locale, id: monsterId } = await params;
  const isEn = locale === "en";

  let monster = null;

  try {
    monster = await fetchMonsterDetail(monsterId, locale);
  } catch {
    // metadataでは握りつぶしてfallbackを返す
  }

  const monsterName =
    monster?.name || (isEn ? "Monster Detail" : "モンスター詳細");

  const description = isEn
    ? `Check ${monsterName}'s drops, orbs, equipment, and appearance maps in Dragon Quest X.`
    : `${monsterName} のドロップ、宝珠、白宝箱、出現マップを確認できるページです。`;

  return createBaseMetadata({
    locale,
    title: monsterName,
    description,
    path: `/${locale}/tools/monsters/${monsterId}`,
    type: "article",
  });
}

export default async function MonsterDetailPage({ params, searchParams }) {
  const { locale, id: monsterId } = await params;
  const resolvedSearchParams = await searchParams;

  const t = await getTranslations({
    locale,
    namespace: "MonsterDetailPage",
  });

  const page = Math.max(1, Number(resolvedSearchParams?.page) || 1);

  const rawBack = resolvedSearchParams?.back;
  const normalizedBack =
    typeof rawBack === "string"
      ? decodeURIComponent(rawBack).replace(/^\/(ja|en)(?=\/|$)/, "")
      : "";

  const isFromMonsterSearch =
    normalizedBack.startsWith("/tools/monster-search");

  const safeBackHref = normalizedBack.startsWith("/tools/")
    ? normalizedBack
    : resolvedSearchParams?.from === "zukan"
      ? `/tools/monster-zukan?page=${page}`
      : "/tools/monster-search";

  let monster = null;
  let errorText = "";

  try {
    monster = await fetchMonsterDetail(monsterId, locale);
  } catch (error) {
    console.error(error);
    errorText = t("fetchError");
  }

  if (errorText || !monster) {
    return (
      <MonsterDetailPageClientShell>
        <div style={styles.centerBox}>
          <p style={styles.errorText}>{errorText || t("notFound")}</p>
          <Link href={safeBackHref} locale={locale} style={styles.backLink}>
            ← {t("backToSearch")}
          </Link>
        </div>
      </MonsterDetailPageClientShell>
    );
  }

  return (
    <MonsterDetailPageClientShell>
      <div style={styles.container}>
        <div style={styles.topNav}>
          <Link href={safeBackHref} locale={locale} style={styles.backLink}>
            ← {t("backToSearch")}
          </Link>
        </div>

        <MonsterOverviewSection monster={monster} />

        <MonsterDropSection
          monster={monster}
          showMonsterImage={isFromMonsterSearch}
          normalDrops={monster.normal_drops ?? []}
          rareDrops={monster.rare_drops ?? []}
          whiteBoxDrops={monster.equipment_drops ?? []}
          orbDrops={monster.orb_drops ?? []}
        />

        <MonsterMapSection maps={monster.maps ?? []} title="生息地" />
      </div>
    </MonsterDetailPageClientShell>
  );
}

const styles = {
  container: {
    maxWidth: "1120px",
    margin: "0 auto",
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
  },
  topNav: {
    marginBottom: "14px",
  },
  backLink: {
    color: "inherit",
    textDecoration: "none",
    fontSize: "13px",
    fontWeight: 700,
  },
  centerBox: {
    maxWidth: "720px",
    margin: "80px auto",
    borderRadius: "18px",
    padding: "32px 20px",
    textAlign: "center",
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
  },
  errorText: {
    margin: "0 0 12px",
    fontSize: "14px",
  },
};