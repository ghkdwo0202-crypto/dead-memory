const rows = [
  ["FFF", "홍련폭", 5.5],
  ["WWW", "격류진", 6],
  ["LLL", "천뢰격", 7],
  ["VVV", "진공참", 5],
  ["FFW", "증기폭쇄", 6.5],
  ["FFL", "폭염낙뢰", 8],
  ["FFV", "화염용권", 7],
  ["FWW", "열수분출", 6],
  ["WWL", "도전수옥", 7.5],
  ["WWV", "빙결수리검", 5.5],
  ["FLL", "열뢰창", 7],
  ["WLL", "뇌수쇄도", 7.5],
  ["LLV", "순뢰보", 6],
  ["FVV", "열풍쇄", 6.5],
  ["WVV", "한풍질주", 6],
  ["LVV", "풍뢰선", 6],
  ["FWL", "멸진뇌폭", 10],
  ["FWV", "환류염무", 9],
  ["FLV", "뇌화비연", 9.5],
  ["WLV", "천우뇌옥", 10],
];
export const RECIPE_IDS = Object.freeze(
  Object.fromEntries(
    rows.map(([r], i) => [r, `NIN_${String(i + 1).padStart(3, "0")}`]),
  ),
);
const ops = {
  FFF: [
    { op: "Blast", element: "fire", range: 135, damage: 34, status: "burn" },
  ],
  WWW: [
    { op: "Wave", element: "water", range: 240, damage: 26, status: "wet" },
  ],
  LLL: [
    {
      op: "Lightning",
      element: "lightning",
      range: 420,
      damage: 38,
      status: "shock",
    },
  ],
  VVV: [
    {
      op: "Fan",
      element: "wind",
      range: 310,
      damage: 24,
      status: "wind",
      count: 2,
      launch: 560,
    },
  ],
  FWL: [
    {
      op: "Detonate",
      element: "lightning",
      range: 150,
      damage: 28,
      status: "shock",
    },
  ],
};
const singles = {
  fire: {
    name: "화염 수리검",
    op: "Shot",
    element: "fire",
    range: 230,
    damage: 13,
    status: "burn",
  },
  water: {
    name: "물 베기",
    op: "Arc",
    element: "water",
    range: 95,
    damage: 12,
    status: "wet",
    push: 24,
  },
  lightning: {
    name: "전광침",
    op: "Ray",
    element: "lightning",
    range: 180,
    damage: 12,
    status: "shock",
    pierce: 2,
  },
  wind: {
    name: "진공 수리검",
    op: "Shot",
    element: "wind",
    range: 195,
    damage: 11,
    status: "wind",
    launch: 420,
  },
};
function freeze(o) {
  if (o && typeof o === "object") {
    for (const v of Object.values(o)) freeze(v);
    Object.freeze(o);
  }
  return o;
}
export const SIDE_SKILLS = freeze(
  Object.fromEntries([
    ...rows.map(([recipe, name, cooldown], i) => {
      const operations = ops[recipe] || [];
      return [
        RECIPE_IDS[recipe],
        {
          id: RECIPE_IDS[recipe],
          recipe,
          name,
          cooldown,
          kind: "mixed",
          implemented: operations.length > 0,
          allowedStates: ["ground", "air"],
          casting: {
            windup: recipe === "LLL" ? 0.1 : 0.08,
            active: 0.06,
            recovery: 0.08,
          },
          maxEntities: recipe === "VVV" ? 2 : 1,
          operations,
          visualId: recipe,
        },
      ];
    }),
    ...Object.entries(singles).map(([e, op]) => {
      const id = `SINGLE_${e.toUpperCase()}`;
      return [
        id,
        {
          id,
          name: op.name,
          kind: "single",
          cooldown: 1,
          implemented: true,
          allowedStates: ["ground", "air", "dash"],
          casting: { windup: 0, active: 0.04, recovery: 0.08 },
          maxEntities: 1,
          operations: [op],
          visualId: e,
        },
      ];
    }),
  ]),
);
export const SIDE_OPERATIONS = Object.freeze([
  "Shot",
  "Arc",
  "Ray",
  "Blast",
  "Wave",
  "Lightning",
  "Fan",
  "Detonate",
]);
export function validateSideSkills() {
  const values = Object.values(SIDE_SKILLS),
    errors = [];
  if (new Set(values.filter((d) => d.recipe).map((d) => d.recipe)).size !== 20)
    errors.push("recipe count");
  for (const d of values.filter((d) => d.implemented))
    if (
      !d.operations.length ||
      !d.allowedStates.length ||
      d.operations.some((o) => !SIDE_OPERATIONS.includes(o.op))
    )
      errors.push(d.id);
  return {
    valid: !errors.length,
    errors,
    recipes: 20,
    singles: 4,
    mixed: values.filter((d) => d.kind === "mixed" && d.implemented).length,
  };
}
