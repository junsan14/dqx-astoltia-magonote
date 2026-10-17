"use client";

import { useEffect, useRef, useState } from "react";
import FreeCropSelection from "./FreeCropSelection";
import { createImage, getCroppedImageBlob } from "@/lib/cropImage";

export default function MapImageCropper({ value, onApply, onBusyChange }) {
  const [source, setSource] = useState("");
  const [area, setArea] = useState(null);
  const [imageSize, setImageSize] = useState(null);
  const [defaultArea, setDefaultArea] = useState(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const savedArea = useRef(null);
  const urls = useRef(new Set());
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const ownedUrls = urls.current;
    return () => {
      alive.current = false;
      ownedUrls.forEach((url) => URL.revokeObjectURL(url));
      ownedUrls.clear();
    };
  }, []);

  function processing(next) {
    setBusy(next);
    onBusyChange(next);
  }

  async function apply(image, pixels) {
    const result = await getCroppedImageBlob(image, pixels, "map.png");
    if (!alive.current) {
      URL.revokeObjectURL(result.previewUrl);
      return;
    }
    urls.current.add(result.previewUrl);
    savedArea.current = pixels;
    onApply(result);
  }

  async function selectFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    processing(true);
    setError("");
    const url = URL.createObjectURL(file);
    urls.current.add(url);
    try {
      const image = await createImage(url);
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      const pixels = width >= 525 && height >= 590
        ? { x: 35, y: 25, width: 490, height: 565 }
        : { x: 0, y: 0, width, height };
      await apply(url, pixels);
      if (!alive.current) return;
      setImageSize({ width, height });
      setSource(url);
      setDefaultArea(pixels);
      setEditing(false);
    } catch {
      if (alive.current) setError("画像を読み込めませんでした。別の画像を選択してください。");
    } finally {
      if (alive.current) processing(false);
    }
  }

  function startEdit(pixels = savedArea.current) {
    setArea({ ...pixels });
    setEditing(true);
    onBusyChange(true);
  }

  async function confirm() {
    if (!area) return;
    processing(true);
    setError("");
    try {
      await apply(source, area);
      if (alive.current) setEditing(false);
    } catch {
      if (alive.current) setError("切り取りに失敗しました。もう一度お試しください。");
      return;
    } finally {
      if (alive.current) setBusy(false);
    }
    if (alive.current) onBusyChange(false);
  }

  return (
    <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
      <label>
        画像を選択
        <input type="file" accept="image/*" onChange={selectFile} disabled={busy || editing} />
      </label>
      {error && <div role="alert">{error}</div>}
      {editing ? (
        <>
          <FreeCropSelection source={source} size={imageSize} area={area} onChange={setArea} disabled={busy} />
          <p style={{ margin: 0, fontSize: 13 }}>
            青いハンドルで上下・左右の端を調整できます。枠の内側をドラッグすると範囲を移動できます。
            矢印キーでも調整できます（Shiftで10px）。
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[["left", "左", area.x, imageSize.width - 1],
              ["top", "上", area.y, imageSize.height - 1],
              ["width", "幅", area.width, imageSize.width - area.x],
              ["height", "高さ", area.height, imageSize.height - area.y]].map(([key, label, number, max]) => (
              <label key={key} style={{ display: "grid", gap: 4 }}>
                {label}（px）
                <input type="number" min={key === "left" || key === "top" ? 0 : 1} max={max}
                  value={number} disabled={busy} style={{ width: 100 }}
                  onChange={(event) => {
                    if (event.target.value === "") return;
                    const min = key === "left" || key === "top" ? 0 : 1;
                    const next = Math.max(min, Math.min(max, Math.round(Number(event.target.value))));
                    if (!Number.isFinite(next)) return;
                    setArea((current) => key === "left"
                      ? { ...current, x: next, width: Math.min(current.width, imageSize.width - next) }
                      : key === "top"
                        ? { ...current, y: next, height: Math.min(current.height, imageSize.height - next) }
                        : { ...current, [key]: next });
                  }} />
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button type="button" onClick={confirm} disabled={busy || !area}>この範囲で決定</button>
            <button type="button" onClick={() => startEdit(defaultArea)} disabled={busy}>デフォルト範囲に戻す</button>
            <button type="button" disabled={busy} onClick={() => { setEditing(false); onBusyChange(false); }}>キャンセル</button>
          </div>
        </>
      ) : (
        <>
          {value && (
            // Blob URLs are local previews; preserve the image's actual aspect ratio.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="マップの保存範囲プレビュー" style={{ maxWidth: "100%", maxHeight: 480, objectFit: "contain" }} />
          )}
          {source && <button type="button" onClick={() => startEdit()} disabled={busy}>切り取り範囲を再選択</button>}
        </>
      )}
      <p style={{ margin: 0, fontSize: 12 }}>
        画像を選ぶと既定の範囲を自動で切り取ります。「切り取り範囲を再選択」で上下・左右を動かして、縦横比を固定せずに調整できます。
        保存済み画像の範囲を広げる場合は、元画像を選び直してください。
      </p>
      {busy && <div role="status">画像を処理中...</div>}
    </div>
  );
}
