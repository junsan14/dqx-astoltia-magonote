"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { getMonsterAssetUrl } from "@/lib/monsters";

export default function MonsterImageCard({
  monster,
  rounded = 5,
  priority = false,
  aspectRatio = "1 / 1",
}) {
  const [hasError, setHasError] = useState(false);

  const imageUrl = useMemo(() => {
    if (!monster?.image_path) return "";
    return getMonsterAssetUrl(monster.image_path);
  }, [monster?.image_path]);

  const hasImage = !!imageUrl && !hasError;

  return (
    <div
      style={{
        width: "100%",
        minWidth: 0,
      }}
    >
      {hasImage ? (
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio,
            borderRadius: `${rounded}px`,
            overflow: "hidden",
            background: "transparent",
          }}
        >
          <Image
            src={imageUrl}
            alt={monster?.name || "モンスター画像"}
            fill
            priority={priority}
            unoptimized
            sizes="(max-width: 920px) 84px, 132px"
            onError={() => setHasError(true)}
            style={{
              objectFit: "contain",
              borderRadius: `${rounded}px`,
            }}
          />
        </div>
      ) : (
        <div
          style={{
            width: "100%",
            aspectRatio,
            borderRadius: `${rounded}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--soft-bg)",
            color: "var(--text-muted)",
            fontSize: "24px",
            userSelect: "none",
          }}
        >
          👾
        </div>
      )}
    </div>
  );
}