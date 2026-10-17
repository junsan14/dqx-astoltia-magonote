export function resizeCrop(area, edge, dx, dy, size) {
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Math.round(value)));
  if (edge === "move") {
    return { ...area, x: clamp(area.x + dx, 0, size.width - area.width), y: clamp(area.y + dy, 0, size.height - area.height) };
  }
  let left = area.x;
  let top = area.y;
  let right = left + area.width;
  let bottom = top + area.height;
  if (edge.includes("w")) left = clamp(left + dx, 0, right - 1);
  if (edge.includes("e")) right = clamp(right + dx, left + 1, size.width);
  if (edge.includes("n")) top = clamp(top + dy, 0, bottom - 1);
  if (edge.includes("s")) bottom = clamp(bottom + dy, top + 1, size.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}
