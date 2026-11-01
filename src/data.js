const rows = [
  [
    "A01",
    "화염 참격",
    "공격",
    5,
    "fire",
    "전방 부채꼴을 화염검으로 벱니다.",
    32,
    145,
  ],
  ["A02", "뇌전 창", "공격", 6, "lightning"],
  ["A03", "빙결 파편", "공격", 5, "ice"],
  ["A04", "관통 사격", "공격", 6, "piercing"],
  [
    "M01",
    "뇌전 돌진",
    "기동",
    7,
    "lightning",
    "조준 방향으로 돌진하며 경로의 적을 공격합니다.",
    28,
    200,
  ],
  ["M02", "그림자 도약", "기동", 8, "shadow"],
  ["M03", "갈고리 이동", "기동", 7, "hook"],
  ["M04", "잔상 질주", "기동", 8, "illusion"],
  [
    "D01",
    "반격 태세",
    "방어",
    8,
    "parry",
    "0.65초간 방어합니다. 첫 0.25초에 막으면 반격합니다.",
    38,
    130,
  ],
  ["D02", "마력 방벽", "방어", 10, "barrier"],
  [
    "D03",
    "흡혈 낙인",
    "방어",
    9,
    "blood",
    "주변 적에게 5초 낙인. 낙인에 준 피해의 25%를 회복합니다.",
    12,
    190,
  ],
  ["D04", "시간 지연", "방어", 12, "time"],
  ["C01", "독 안개", "제어", 9, "poison"],
  [
    "C02",
    "중력 구체",
    "제어",
    11,
    "gravity",
    "조준 위치에 3초간 적을 끌어당기는 중력장을 만듭니다.",
    7,
    260,
  ],
  ["C03", "빙결 덫", "제어", 9, "ice"],
  ["C04", "침묵 낙인", "제어", 10, "silence"],
  [
    "S01",
    "그림자 분신",
    "소환",
    12,
    "shadow",
    "4초간 주변 적을 공격하는 분신을 소환합니다.",
    16,
    190,
  ],
  ["S02", "마검 소환", "소환", 11, "sword"],
  ["S03", "자동 포탑", "소환", 12, "turret"],
  ["S04", "망령 사역", "소환", 13, "spirit"],
];
export const CORE_IDS = ["A01", "M01", "S01", "D03", "D01", "C02"];
export const SKILLS = Object.fromEntries(
  rows.map(
    ([
      id,
      name,
      category,
      cooldown,
      tag,
      description,
      damage = 0,
      range = 0,
    ]) => [
      id,
      {
        id,
        name,
        category,
        tags: [tag, category],
        cooldown,
        castTime: id === "M01" ? 0.22 : 0.18,
        range,
        damage,
        statusEffects:
          id === "D03"
            ? ["blood-mark"]
            : id === "C02"
              ? ["pull"]
              : id === "D01"
                ? ["parry"]
                : [],
        animationID: id.toLowerCase(),
        vfxID: tag,
        aiUsageConditions: {
          maxRange: range,
          minDistance: id === "M01" ? 70 : 0,
        },
        description:
          description || "이 프로토타입에서는 데이터만 정의되어 있습니다.",
        implemented: CORE_IDS.includes(id),
      },
    ],
  ),
);
const recipes = [
  ["R01", "A01 M01", "뇌염 돌파", "화염 폭발을 동반한 돌진", "hit"],
  ["R02", "A03 A04", "쇄빙 저격", "냉기 대상 관통 후 파편 폭발"],
  ["R03", "A02 C02", "뇌전 감옥", "중력장 내부 전류 연결"],
  ["R04", "A04 M02", "그림자 저격", "이전 위치에서 추가 사격"],
  ["R05", "M01 S01", "뇌영 분신", "분신이 돌진 경로 재현"],
  ["R06", "M02 D01", "허공 반격", "순간이동 후 반격"],
  ["R07", "M03 A01", "작열 강습", "접근 후 광역 화염 참격"],
  ["R08", "M04 C03", "빙영 궤적", "이동 경로에 빙결 함정"],
  ["R09", "D01 A02", "낙뢰 반격", "패링 성공 후 강화 뇌전 창", "parry"],
  ["R10", "D02 C02", "중력 방벽", "투사체 흡수 및 방출"],
  ["R11", "D03 A01", "혈염참", "낙인 대상에 화염 피해와 추가 흡혈"],
  ["R12", "D04 A04", "시공 저격", "지연 투사체 추가 생성"],
  ["R13", "C01 A01", "독염 폭발", "독 안개 점화"],
  ["R14", "C02 A03", "빙하 압축", "끌어당긴 적에게 냉기 폭발"],
  ["R15", "C03 A02", "빙뢰 쇄격", "빙결 대상 연쇄 감전"],
  ["R16", "C04 M02", "침묵 암살", "침묵 대상 순간이동 기습"],
  ["R17", "S01 A01", "환영 화염검", "분신의 화염 참격 복제"],
  ["R18", "S02 M03", "마검 강림", "소환 마검 위치로 이동 공격"],
  ["R19", "S03 A02", "전자 포격", "포탑의 전격 추가 공격"],
  ["R20", "S04 D03", "영혼 포식", "망령 공격을 통한 흡혈"],
];
const advanced = [
  ["U01", "A01 M01 S01", "뇌염환영참", "돌진 끝에 분신들이 화염 참격을 복제"],
  ["U02", "A02 C02 S03", "천뢰 감옥"],
  ["U03", "D03 A01 D02", "불사의 혈검"],
  ["U04", "C03 A02 A03", "절대영도"],
  ["U05", "C04 M02 D01", "무영살"],
  ["U06", "C01 A01 C02", "역병 대폭발"],
  ["U07", "S02 M03 M04", "천검 강림"],
  ["U08", "D04 A04 M02", "정지된 탄환"],
];
export const RECIPES = [...recipes, ...advanced].map(
  ([id, sequence, name, effect = "", condition = "use"]) => ({
    id,
    sequence: sequence.split(" "),
    name,
    effect,
    condition,
    type: id[0] === "U" ? "advanced" : "unique",
    window: 2,
    extensionWindow: 1.5,
    implemented: ["R01", "R05", "R11", "U01"].includes(id),
    parent: id === "U01" ? "R01" : null,
  }),
);
export const ACTIVE_RECIPES = RECIPES.filter((r) => r.implemented);
export const COLORS = {
  fire: "#ff9b67",
  lightning: "#7bf8d5",
  shadow: "#ba9aff",
  blood: "#ff6a95",
  parry: "#f9dc95",
  gravity: "#97a8ff",
};
export function availableRecipes(ids) {
  return ACTIVE_RECIPES.filter((r) =>
    r.sequence.every((id) => ids.includes(id)),
  );
}
export function connections(id, owned) {
  return ACTIVE_RECIPES.filter(
    (r) =>
      r.sequence.includes(id) &&
      r.sequence.some((s) => s !== id && owned.includes(s)),
  );
}
export function rewardCandidates(owned, pool = CORE_IDS, random = Math.random) {
  const choices = pool.filter((id) => !owned.includes(id));
  const shuffled = choices
    .map((id) => ({ id, n: random() }))
    .sort((a, b) => a.n - b.n)
    .map((x) => x.id);
  // Keep one predictable build connection, with two shuffled alternatives.
  const link = choices.find((id) => connections(id, owned).length);
  return [...new Set([...(link ? [link] : []), ...shuffled])].slice(0, 3);
}
