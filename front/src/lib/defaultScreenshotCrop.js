// Calibrated against the supplied 1920x1080 Switch 2 screenshots.
// UI panels do not scale by the same factor as the screenshot resolution.
export const SWITCH_2_MAP_CROP = { x: 45, y: 32, width: 630, height: 726 };
export const SWITCH_2_MONSTER_CROP = { x: 484, y: 302, width: 441, height: 441 };

function isSwitch2Screenshot(width, height) {
  return width >= 1920 && height >= 1080 && Math.abs(width / height - 16 / 9) < 0.01;
}

function scaleSwitch2Crop(crop, width, height) {
  return {
    x: Math.round(crop.x * width / 1920),
    y: Math.round(crop.y * height / 1080),
    width: Math.round(crop.width * width / 1920),
    height: Math.round(crop.height * height / 1080),
  };
}

export function getDefaultMapAreaPixels(width, height) {
  if (isSwitch2Screenshot(width, height)) {
    return scaleSwitch2Crop(SWITCH_2_MAP_CROP, width, height);
  }
  return width >= 525 && height >= 590
    ? { x: 35, y: 25, width: 490, height: 565 }
    : { x: 0, y: 0, width, height };
}

export function getDefaultMonsterAreaPixels(width, height) {
  if (isSwitch2Screenshot(width, height)) {
    const crop = scaleSwitch2Crop(SWITCH_2_MONSTER_CROP, width, height);
    const size = Math.min(crop.width, crop.height);
    return { ...crop, width: size, height: size };
  }
  // Keep the existing Switch Lite default for older screenshots.
  const size = Math.min(width, height) / 2.1;
  return {
    x: Math.round(Math.max(0, Math.min(width * 0.345 - size / 2, width - size))),
    y: Math.round(Math.max(0, Math.min(height * 0.48 - size / 2, height - size))),
    width: Math.round(size),
    height: Math.round(size),
  };
}
