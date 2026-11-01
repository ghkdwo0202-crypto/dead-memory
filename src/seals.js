export const ELEMENT_KEYS = Object.freeze({
  KeyA: "fire",
  KeyS: "water",
  KeyD: "lightning",
  KeyF: "wind",
});
export const ELEMENTS = Object.freeze({
  fire: { symbol: "F", glyph: "炎", color: "#ff9570" },
  water: { symbol: "W", glyph: "水", color: "#81c6f0" },
  lightning: { symbol: "L", glyph: "雷", color: "#eed594" },
  wind: { symbol: "V", glyph: "風", color: "#a5e3c9" },
});
export function canonical(seals) {
  if (seals.length !== 3 || seals.some((e) => !ELEMENTS[e])) return null;
  return seals
    .map((e) => ELEMENTS[e].symbol)
    .sort((a, b) => "FWLV".indexOf(a) - "FWLV".indexOf(b))
    .join("");
}
export class SealSequence {
  constructor(request, recipeToId) {
    this.request = request;
    this.recipeToId = recipeToId;
    this.seals = [];
    this.expiresAt = 0;
    this.lastRecipe = null;
  }
  input(element, now) {
    if (!ELEMENTS[element]) return false;
    if (now > this.expiresAt) this.seals = [];
    this.seals.push(element);
    this.expiresAt = now + 0.75;
    if (this.seals.length === 1)
      this.request(`SINGLE_${element.toUpperCase()}`, now);
    else if (this.seals.length === 3) {
      const recipe = canonical(this.seals);
      this.seals = [];
      this.expiresAt = 0;
      this.lastRecipe = recipe;
      this.request(this.recipeToId[recipe], now);
    }
    return true;
  }
  tick(now) {
    if (now > this.expiresAt) {
      this.seals = [];
      this.expiresAt = 0;
    }
  }
  possible() {
    const counts = {};
    for (const e of this.seals) {
      const s = ELEMENTS[e].symbol;
      counts[s] = (counts[s] || 0) + 1;
    }
    return Object.keys(this.recipeToId).filter((r) =>
      Object.entries(counts).every(([s, n]) => r.split(s).length - 1 >= n),
    );
  }
}
