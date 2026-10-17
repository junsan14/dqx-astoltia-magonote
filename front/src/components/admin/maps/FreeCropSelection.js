"use client";

import { useRef } from "react";
import { resizeCrop } from "./freeCropGeometry";

const handles = [
  ["n", "上", "50%", "0%", "ns-resize"],
  ["s", "下", "50%", "100%", "ns-resize"],
  ["w", "左", "0%", "50%", "ew-resize"],
  ["e", "右", "100%", "50%", "ew-resize"],
  ["nw", "左上", "0%", "0%", "nwse-resize"],
  ["ne", "右上", "100%", "0%", "nesw-resize"],
  ["sw", "左下", "0%", "100%", "nesw-resize"],
  ["se", "右下", "100%", "100%", "nwse-resize"],
];

export default function FreeCropSelection({ source, size, area, onChange, disabled }) {
  const frame = useRef(null);
  const drag = useRef(null);

  function start(event, edge) {
    if (disabled || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = frame.current.getBoundingClientRect();
    drag.current = { edge, area, x: event.clientX, y: event.clientY, scaleX: size.width / rect.width, scaleY: size.height / rect.height, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event) {
    const current = drag.current;
    if (!current || disabled || current.pointerId !== event.pointerId) return;
    onChange(resizeCrop(current.area, current.edge,
      (event.clientX - current.x) * current.scaleX,
      (event.clientY - current.y) * current.scaleY, size));
  }

  function keyboard(event, edge) {
    const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (disabled || !directions[event.key]) return;
    event.preventDefault();
    event.stopPropagation();
    const [dx, dy] = directions[event.key];
    const step = event.shiftKey ? 10 : 1;
    onChange(resizeCrop(area, edge, dx * step, dy * step, size));
  }

  return (
    <div style={{ padding: 14, background: "#111", overflow: "hidden" }}>
      <div ref={frame} style={{ position: "relative", width: "100%", maxWidth: 720, margin: "auto", aspectRatio: `${size.width} / ${size.height}`, userSelect: "none" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={source} alt="切り取り元のマップ" draggable={false} style={{ display: "block", width: "100%", height: "100%", pointerEvents: "none" }} />
        <div
          role="group" aria-label="切り取り範囲。矢印キーで移動" tabIndex={disabled ? -1 : 0}
          onPointerDown={(event) => start(event, "move")}
          onPointerMove={move}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
          onLostPointerCapture={() => { drag.current = null; }}
          onKeyDown={(event) => keyboard(event, "move")}
          style={{ position: "absolute", left: `${area.x / size.width * 100}%`, top: `${area.y / size.height * 100}%`, width: `${area.width / size.width * 100}%`, height: `${area.height / size.height * 100}%`, boxSizing: "border-box", border: "2px solid #fff", boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)", cursor: "move", touchAction: "none" }}
        >
          {handles.map(([edge, label, left, top, cursor]) => (
            <button key={edge} type="button" aria-label={`${label}の切り取り位置を調整`} disabled={disabled}
              onPointerDown={(event) => start(event, edge)}
              onKeyDown={(event) => keyboard(event, edge)}
              style={{ position: "absolute", left, top, width: 22, height: 22, padding: 0, transform: "translate(-50%, -50%)", border: "2px solid #fff", borderRadius: 4, background: "#2563eb", cursor, touchAction: "none" }} />
          ))}
        </div>
      </div>
    </div>
  );
}
