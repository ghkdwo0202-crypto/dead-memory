export const CONFIG = {
  width: 2400,
  height: 1600,
  playerSpeed: 195,
  playerHP: 120,
  dash: {
    duration: 0.22,
    invulnerable: 0.16,
    charges: 2,
    recharge: 2.5,
    speed: 720,
  },
  attackBuffer: 0.24,
  maxChainDepth: 4,
  maxChainEvents: 64,
  bossTime: 300,
  runLimit: 480,
  maxEnemies: 160,
  maxProjectiles: 350,
  pickupRadius: 95,
};
export const SLOTS = { arm: "팔", back: "등", heart: "심장", eye: "눈" };
const organ = (
  id,
  name,
  slot,
  description,
  tags,
  stats,
  effects,
  cooldown,
  mutations,
  visual,
) => ({
  id,
  name,
  slot,
  description,
  tags,
  baseStats: stats,
  triggerConditions:
    slot === "back"
      ? ["OnOrganTriggered"]
      : slot === "heart"
        ? ["OnKill"]
        : ["OnDirectHit"],
  effects,
  cooldown,
  targetingRule: {
    distance: stats.range || 400,
    assistAngle: 1.35,
    directionLock: 0.13,
  },
  visualID: visual,
  availableMutations: mutations,
  aiUsageProfile: {
    distance: tags.includes("projectile") ? 260 : 85,
    specialRange: stats.range || 180,
  },
});
export const ORGANS = Object.fromEntries(
  [
    organ(
      "ARM_SAW",
      "톱날 팔",
      "arm",
      "같은 적에게 Z 3타 적중 시 강화 베기와 출혈. C: 회전 베기.",
      ["melee", "bleed", "direct"],
      {
        damage: 22,
        range: 118,
        cone: 1.15,
        windup: 0.09,
        active: 0.07,
        recovery: 0.21,
        knockback: 24,
        stagger: 0.18,
        moveScale: 0.9,
        cancelFrom: 0.07,
        bufferWindow: 0.24,
        comboWindow: 1.3,
        thirdStrikeMultiplier: 1.3,
        comboWindups: [0.07, 0.09, 0.12],
        comboRecoveries: [0.17, 0.19, 0.26],
      },
      ["bleed"],
      5,
      [
        "MUT03",
        "MUT04",
        "MUT05",
        "MUT06",
        "MUT07",
        "MUT08",
        "MUT09",
        "MUT10",
        "MUT12",
      ],
      "saw",
    ),
    organ(
      "ARM_SPINE",
      "가시 발사 팔",
      "arm",
      "가시를 발사합니다. C: 전방에 다섯 가시를 펼칩니다.",
      ["projectile", "direct"],
      {
        damage: 19,
        range: 520,
        cone: 0.2,
        windup: 0.12,
        active: 0.05,
        recovery: 0.29,
        knockback: 15,
        stagger: 0.1,
        moveScale: 0.95,
        cancelFrom: 0.06,
      },
      ["spike"],
      5.5,
      [
        "MUT01",
        "MUT02",
        "MUT03",
        "MUT05",
        "MUT06",
        "MUT07",
        "MUT08",
        "MUT09",
        "MUT10",
        "MUT11",
        "MUT12",
      ],
      "spine",
    ),
    organ(
      "BACK_TENTACLE",
      "포식 촉수",
      "back",
      "가까운 적을 자동으로 찌릅니다. 체력 30% 미만 대상에 추가 피해.",
      ["auto", "melee", "execute"],
      { damage: 16, range: 185 },
      ["tentacle"],
      1.25,
      ["MUT03", "MUT05", "MUT06", "MUT07", "MUT09", "MUT10", "MUT12"],
      "tentacle",
    ),
    organ(
      "BACK_TURRET",
      "기생 포탑",
      "back",
      "직접 공격한 적을 우선 조준해 가시탄을 발사합니다.",
      ["auto", "projectile"],
      { damage: 13, range: 490 },
      ["turret"],
      1.1,
      [
        "MUT01",
        "MUT02",
        "MUT03",
        "MUT05",
        "MUT06",
        "MUT07",
        "MUT09",
        "MUT10",
        "MUT11",
        "MUT12",
      ],
      "turret",
    ),
    organ(
      "BACK_BLADES",
      "회전 칼날",
      "back",
      "주변을 공전하는 칼날이 접촉한 적을 베어냅니다.",
      ["auto", "melee", "orbit"],
      { damage: 10, range: 100 },
      ["orbit"],
      0.45,
      ["MUT03", "MUT04", "MUT05", "MUT06", "MUT07", "MUT09", "MUT10", "MUT12"],
      "blades",
    ),
    organ(
      "HEART_HUNGER",
      "굶주린 심장",
      "heart",
      "처치하면 2초간 공격 속도가 25% 증가합니다.",
      ["passive", "kill", "haste"],
      {},
      ["kill-haste"],
      0,
      ["MUT07"],
      "hunger",
    ),
    organ(
      "HEART_BLAST",
      "폭발 심장",
      "heart",
      "적 다섯 마리 처치마다 주변에 충격파를 방출합니다.",
      ["passive", "kill", "blast"],
      { damage: 28, range: 160 },
      ["kill-blast"],
      0.4,
      ["MUT03", "MUT05", "MUT12"],
      "blast",
    ),
    organ(
      "EYE_BLOOD",
      "핏빛 눈",
      "eye",
      "자동 기관이 출혈 대상을 먼저 노립니다.",
      ["passive", "bleed", "target"],
      {},
      ["bleed-priority"],
      0,
      [],
      "blood",
    ),
    organ(
      "EYE_HUNTER",
      "사냥꾼의 눈",
      "eye",
      "직접 적중하면 4초 표식. 자동 기관이 표식 대상에 30% 추가 피해.",
      ["passive", "mark", "target"],
      {},
      ["mark"],
      0,
      [],
      "hunter",
    ),
  ].map((o) => [o.id, o]),
);
const mutation = (id, name, tags, event, description, icd = 0) => ({
  id,
  name,
  compatibleTags: tags,
  triggerEvent: event,
  conditions: { equippedSource: true },
  effectOperations: [id],
  internalCooldown: icd,
  maxTriggerCount: 1,
  visualID: id.toLowerCase(),
  description,
});
export const MUTATIONS = Object.fromEntries(
  [
    mutation(
      "MUT01",
      "분열",
      ["projectile"],
      "OnProjectileHit",
      "가시 적중 시 작은 가시 2개 생성.",
      0.3,
    ),
    mutation(
      "MUT02",
      "관통",
      ["projectile"],
      "OnAttack",
      "가시가 두 적을 추가로 관통합니다.",
    ),
    mutation(
      "MUT03",
      "폭발",
      ["melee", "projectile", "blast"],
      "OnHit",
      "적중 시 작은 범위 폭발.",
      1.6,
    ),
    mutation(
      "MUT04",
      "전염",
      ["bleed", "execute"],
      "OnStatusApplied",
      "출혈·독을 주변 두 적에게 전파.",
      1,
    ),
    mutation(
      "MUT05",
      "흡혈",
      ["melee", "projectile", "blast"],
      "OnHit",
      "이 기관 피해의 6%를 회복합니다.",
      0.15,
    ),
    mutation(
      "MUT06",
      "복제",
      ["melee", "projectile"],
      "OnAttack",
      "같은 기관의 공격을 40% 위력으로 추가 발동.",
      2,
    ),
    mutation(
      "MUT07",
      "가속",
      ["direct", "auto", "haste"],
      "OnKill",
      "처치 시 2초간 공격 속도가 추가 20% 증가.",
    ),
    mutation(
      "MUT08",
      "반격",
      ["direct"],
      "OnSuccessfulEvade",
      "실제 공격을 피하면 주변으로 반격 가시 8개 발사.",
      1,
    ),
    mutation(
      "MUT09",
      "처형",
      ["melee", "projectile"],
      "OnHit",
      "체력 30% 미만 적에게 피해 40% 증가.",
    ),
    mutation(
      "MUT10",
      "집중",
      ["direct", "auto"],
      "OnHit",
      "같은 적 연속 적중 시 피해 증가. 최대 30%.",
    ),
    mutation(
      "MUT11",
      "귀환",
      ["projectile"],
      "OnProjectileHit",
      "가시가 최대 거리에서 돌아와 다시 타격합니다.",
    ),
    mutation(
      "MUT12",
      "연쇄",
      ["melee", "projectile", "blast"],
      "OnHit",
      "근처 다른 적 하나에게 감전 피해와 둔화.",
      0.65,
    ),
  ].map((m) => [m.id, m]),
);
export const STATUSES = {
  bleed: {
    name: "출혈",
    duration: 3,
    maxStacks: 4,
    refresh: "duration",
    tick: 0.5,
    damage: 2,
    immune: [],
  },
  poison: {
    name: "독",
    duration: 4,
    maxStacks: 5,
    refresh: "duration",
    tick: 0.5,
    damage: 1.5,
    immune: ["spitter"],
  },
  shock: {
    name: "감전",
    duration: 1.5,
    maxStacks: 1,
    refresh: "duration",
    tick: 0.5,
    damage: 3,
    immune: [],
  },
  slow: {
    name: "둔화",
    duration: 2,
    maxStacks: 1,
    refresh: "duration",
    speed: 0.6,
    immune: [],
  },
  stun: {
    name: "기절",
    duration: 0.35,
    maxStacks: 1,
    refresh: "duration",
    speed: 0,
    immune: ["boss"],
  },
};
export const ENEMIES = {
  hungry: {
    name: "굶주린 것",
    hp: 55,
    speed: 65,
    damage: 9,
    xp: 4,
    radius: 14,
    color: "#b5a584",
  },
  crawler: {
    name: "기어오는 것",
    hp: 21,
    speed: 115,
    damage: 6,
    xp: 4,
    radius: 11,
    color: "#b2bf86",
  },
  spitter: {
    name: "침 뱉는 것",
    hp: 40,
    speed: 52,
    damage: 9,
    xp: 7,
    radius: 16,
    color: "#b7c56b",
  },
  exploder: {
    name: "터지는 것",
    hp: 27,
    speed: 76,
    damage: 18,
    xp: 6,
    radius: 17,
    color: "#de8b56",
  },
  elite: {
    name: "고기 집게",
    hp: 300,
    speed: 60,
    damage: 20,
    xp: 50,
    radius: 27,
    color: "#cf6e67",
  },
  boss: {
    name: "도축장 주인",
    hp: 1800,
    speed: 51,
    damage: 28,
    xp: 200,
    radius: 45,
    color: "#ed695e",
  },
};
export const SLOT_COLORS = {
  arm: "#f6a477",
  back: "#d7c16e",
  heart: "#f28091",
  eye: "#b4b8e7",
};
export const OBSTACLES = [
  { x: 680, y: 480, w: 100, h: 110 },
  { x: 1600, y: 460, w: 120, h: 100 },
  { x: 680, y: 1050, w: 110, h: 100 },
  { x: 1590, y: 1040, w: 120, h: 115 },
];
export function compatible(organID, mutationID) {
  const o = ORGANS[organID],
    m = MUTATIONS[mutationID];
  return Boolean(
    o &&
      m &&
      o.availableMutations.includes(m.id) &&
      m.compatibleTags.some((t) => o.tags.includes(t)),
  );
}

// Native action growth is an organ upgrade, not a new mutation or activation key.
export const ACTION_UPGRADES = {
  ARM_SAW_FLOW: {
    id: "ARM_SAW_FLOW",
    name: "톱날 운용",
    organID: "ARM_SAW",
    maxRank: 3,
    ranks: [
      {
        name: "돌파 베기",
        description:
          "X 뒤 Z를 사용하면 짧게 파고들며 벱니다. 추가 무적은 없습니다.",
      },
      {
        name: "회수 회전",
        description:
          "같은 적에게 3타 적중 후 1.4초 안에 C: 주변 적을 끌어모아 회전 베기.",
      },
      {
        name: "전투 순환",
        description:
          "실제 공격을 회피하면 C 쿨다운이 1.25초 감소. C 뒤 Z로 빠르게 복귀.",
      },
    ],
    dashWindow: 0.75,
    lungeDistance: 65,
    finisherWindow: 1.4,
    finisherPull: 50,
    finisherDamage: 1.3,
    evadeCooldownRefund: 1.25,
    evadeRefundICD: 0.75,
    specialRecovery: 0.08,
  },
};
export function actionRank(actor, id = "ARM_SAW_FLOW") {
  const definition = ACTION_UPGRADES[id];
  return definition && actor.organs.arm === definition.organID
    ? Math.min(definition.maxRank, Math.max(0, actor.actionRanks?.[id] || 0))
    : 0;
}
export function sanitizeActionRanks(saved) {
  return Object.fromEntries(
    Object.values(ACTION_UPGRADES)
      .filter(
        (definition) =>
          Number.isInteger(saved?.[definition.id]) &&
          saved[definition.id] >= 0 &&
          saved[definition.id] <= definition.maxRank,
      )
      .map((definition) => [definition.id, saved[definition.id]]),
  );
}

// Planned catalogue entries resolve references but cannot enter rewards or equipment.
const plannedOrgans = [
  [
    "ARM_CRUSH",
    "골격 분쇄 팔",
    "arm",
    ["melee", "direct"],
    { damage: 42, range: 90 },
    "crush",
  ],
  [
    "ARM_WHIP",
    "채찍 촉수 팔",
    "arm",
    ["melee", "direct"],
    { damage: 22, range: 150 },
    "whip",
  ],
  [
    "BACK_POISON",
    "독낭 분사기",
    "back",
    ["auto", "poison", "area"],
    { damage: 5, range: 180 },
    "poison",
  ],
  [
    "BACK_BROOD",
    "번식 기관",
    "back",
    ["auto", "summon"],
    { damage: 7, range: 440 },
    "brood",
  ],
  [
    "BACK_ELECTRIC",
    "전기 기관",
    "back",
    ["auto", "shock"],
    { damage: 12, range: 250 },
    "electric",
  ],
  ["HEART_COAGULATE", "응고 심장", "heart", ["passive", "bleed"], {}, "clot"],
  [
    "HEART_OVERCHARGE",
    "과충전 심장",
    "heart",
    ["passive", "shock"],
    {},
    "overcharge",
  ],
  ["HEART_PARASITE", "기생 심장", "heart", ["passive", "auto"], {}, "parasite"],
  ["HEART_UNDYING", "불사의 심장", "heart", ["passive", "risk"], {}, "undying"],
  ["EYE_WEAK", "약점의 눈", "eye", ["passive", "direct"], {}, "weak"],
  ["EYE_SWARM", "군집의 눈", "eye", ["passive", "auto"], {}, "swarm"],
  ["EYE_INFECTION", "전염의 눈", "eye", ["passive", "status"], {}, "infection"],
  ["EYE_PREDATOR", "포식자의 눈", "eye", ["passive", "target"], {}, "predator"],
];
for (const [id, name, slot, tags, stats, visual] of plannedOrgans) {
  const implemented = ["BACK_BROOD", "HEART_PARASITE", "EYE_WEAK"].includes(id);
  const description =
    id === "BACK_BROOD"
      ? "5초마다 새끼 소환, 최대 3마리. 근접 공격 피해 7."
      : id === "HEART_PARASITE"
        ? "자동 기관 적중마다 C 쿨다운 0.15초 감소, 초당 최대 0.6초."
        : id === "EYE_WEAK"
          ? "정예·보스에게 직접 공격 피해 +20%."
          : "후속 단계의 계획 기관입니다. 현재 장착할 수 없습니다.";
  ORGANS[id] = {
    ...organ(
      id,
      name,
      slot,
      description,
      tags,
      stats,
      implemented ? [visual] : [],
      id === "BACK_BROOD" ? 5 : 0,
      id === "BACK_BROOD" ? ["MUT07", "MUT10"] : [],
      visual,
    ),
    implemented,
  };
}
export const MORPH_LIMITS = {
  echoes: 3,
  summons: 3,
  fields: 3,
  mines: 5,
  logs: 120,
  eventsPerTick: 32,
  delayed: 24,
};
