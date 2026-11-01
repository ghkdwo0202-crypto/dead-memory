export const SEALS = Object.freeze({
  fire: Object.freeze({
    symbol: "F",
    key: "A",
    glyph: "炎",
    name: "화",
    color: "#ff926c",
  }),
  water: Object.freeze({
    symbol: "W",
    key: "S",
    glyph: "水",
    name: "수",
    color: "#7cbfff",
  }),
  lightning: Object.freeze({
    symbol: "L",
    key: "D",
    glyph: "雷",
    name: "뇌",
    color: "#ead692",
  }),
  wind: Object.freeze({
    symbol: "V",
    key: "F",
    glyph: "風",
    name: "풍",
    color: "#a7e8ce",
  }),
});
export function normalizeRecipe(seals) {
  if (
    !Array.isArray(seals) ||
    seals.length !== 3 ||
    seals.some((e) => !SEALS[e])
  )
    return null;
  const order = ["F", "W", "L", "V"];
  return seals
    .map((e) => SEALS[e].symbol)
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .join("");
}
const planned = [
  ["FFF", "화둔·홍련폭"],
  ["WWW", "수둔·격류진"],
  ["LLL", "뇌둔·천뢰격"],
  ["VVV", "풍둔·진공참"],
  ["FFW", "증기폭쇄"],
  ["FFL", "폭염낙뢰"],
  ["FFV", "화염용권"],
  ["FWW", "열수분출"],
  ["WWL", "도전수옥"],
  ["WWV", "빙결수리검"],
  ["FLL", "열뢰창"],
  ["WLL", "뇌수쇄도"],
  ["LLV", "순뢰보"],
  ["FVV", "열풍쇄"],
  ["WVV", "한풍질주"],
  ["LVV", "풍뢰선"],
  ["FWL", "멸진뇌폭"],
  ["FWV", "환류염무"],
  ["FLV", "뇌화비연"],
  ["WLV", "천우뇌옥"],
];
const specs = [
  {
    element: "fire",
    states: ["ground"],
    times: [0.16, 0.08, 0.2],
    cooldown: 5.5,
    range: 180,
    cone: Math.PI * 2,
    operations: [
      {
        op: "Detonate",
        offset: 65,
        radius: 115,
        damage: 36,
        push: 45,
        status: "burn",
      },
    ],
    description: "전방 폭발 · 3초 점화 · 밀어내기",
    limit: "지상 전용 · 좁은 범위",
  },
  {
    element: "water",
    states: ["ground", "air"],
    times: [0.14, 0.12, 0.18],
    cooldown: 6,
    range: 220,
    cone: Math.PI / 3,
    operations: [
      {
        op: "GroundWave",
        length: 220,
        width: 145,
        speed: 500,
        damage: 25,
        push: 55,
        status: "wet",
      },
    ],
    description: "전진하는 파도 · 4초 젖음 · 적 밀기",
    limit: "담장에 막힘 · 보스 밀기 면역",
  },
  {
    element: "lightning",
    states: ["ground", "air"],
    times: [0.13, 0.04, 0.26],
    cooldown: 7,
    range: 440,
    cone: (140 * Math.PI) / 180,
    operations: [{ op: "LightningStrike", damage: 40, status: "shock" }],
    description: "전방 표식 우선 낙뢰 · 감전 · 공중 적 경직",
    limit: "전방 ±70° · 시야 안 표적 필요",
  },
  {
    element: "wind",
    states: ["ground", "air"],
    times: [0.12, 0.12, 0.16],
    cooldown: 5,
    range: 360,
    cone: Math.PI / 2,
    operations: [
      {
        op: "ProjectileFan",
        count: 2,
        spread: 0.36,
        length: 360,
        width: 30,
        speed: 620,
        damage: 27,
        status: "windMark",
        launch: true,
        bossStagger: 25,
      },
    ],
    description: "두 갈래 칼바람 · 띄우기 → Space 추격",
    limit: "한 대상 1회 적중 · 띄우기 2초 간격",
  },
];
function freeze(value) {
  if (value && typeof value === "object") {
    for (const v of Object.values(value)) freeze(v);
    Object.freeze(value);
  }
  return value;
}
export const NINJUTSU = freeze(
  Object.fromEntries(
    planned.map(([recipe, name], i) => {
      const spec = specs[i];
      return [
        `NIN_${String(i + 1).padStart(3, "0")}`,
        {
          id: `NIN_${String(i + 1).padStart(3, "0")}`,
          recipe,
          name,
          implemented: Boolean(spec),
          ...(spec
            ? {
                ...spec,
                casting: {
                  allowedStates: spec.states,
                  windup: spec.times[0],
                  active: spec.times[1],
                  recovery: spec.times[2],
                  cancelFrom: spec.times[0] + spec.times[1],
                },
                tags: [spec.element, spec.operations[0].op],
                targeting: {
                  mode:
                    spec.element === "lightning" ? "marked-forward" : "facing",
                  coneRad: spec.cone,
                  range: spec.range,
                  lineOfSight: true,
                },
                bloom: [],
                audioId: spec.element,
                aiTelegraphId: `nin_${i + 1}`,
                maxEntities: i === 3 ? 2 : 1,
                visualId: spec.element,
              }
            : {
                description: "혼합 인술 · 다음 업데이트 예정",
                operations: [],
              }),
        },
      ];
    }),
  ),
);
export function recipeFor(seals) {
  const recipe = normalizeRecipe(seals);
  return recipe
    ? Object.values(NINJUTSU).find((d) => d.recipe === recipe) || null
    : null;
}
export const NINJUTSU_OPERATIONS = Object.freeze([
  "Detonate",
  "GroundWave",
  "LightningStrike",
  "ProjectileFan",
]);
export function validateNinjutsu(registry = NINJUTSU) {
  const errors = [],
    recipes = new Set();
  for (const d of Object.values(registry)) {
    if (recipes.has(d.recipe)) errors.push("duplicate " + d.recipe);
    recipes.add(d.recipe);
    if (d.implemented) {
      if (
        !d.cooldown ||
        !d.casting.allowedStates.length ||
        !d.operations.length
      )
        errors.push("incomplete " + d.id);
      for (const op of d.operations)
        if (!NINJUTSU_OPERATIONS.includes(op.op))
          errors.push("unsupported " + op.op);
    }
  }
  return {
    valid: !errors.length,
    errors,
    count: recipes.size,
    implemented: Object.values(registry).filter((d) => d.implemented).length,
  };
}
