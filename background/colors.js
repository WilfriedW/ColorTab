// Valeurs RGB de référence des 8 couleurs natives de groupes Chrome.
export const CHROME_GROUP_COLORS = {
  grey: [95, 99, 104],
  blue: [26, 115, 232],
  red: [217, 48, 37],
  yellow: [249, 171, 0],
  green: [24, 128, 56],
  pink: [208, 24, 132],
  purple: [161, 66, 244],
  cyan: [0, 123, 131],
  orange: [250, 144, 62],
};

export function hexToRgb(hex) {
  const m = String(hex)
    .replace("#", "")
    .match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

export function nearestChromeGroupColor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return "grey";
  let best = "grey";
  let bestDist = Infinity;
  for (const [name, c] of Object.entries(CHROME_GROUP_COLORS)) {
    const d =
      (rgb[0] - c[0]) ** 2 + (rgb[1] - c[1]) ** 2 + (rgb[2] - c[2]) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = name;
    }
  }
  return best;
}
