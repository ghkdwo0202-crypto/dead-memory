import { ORGANS } from "./data.js";
export const ACTION_PATHS = {
  PATH_01: {
    id: "PATH_01",
    family: "절단/근접",
    name: "회전 도살자",
    required: {
      arm: "ARM_SAW",
      back: "BACK_BLADES",
      heart: "HEART_HUNGER",
      eye: "EYE_BLOOD",
    },
    implemented: true,
    tags: ["절단/근접"],
    aiUsageProfile: "baseline-telegraphed",
    visualId: "path_01",
    constraints: {
      maxEntities: 3,
      icd: 0.3,
      targetCap: 3,
    },
    tier1: {
      z: [
        {
          op: "ArcSlash",
          when: "third",
          coneRad: 4.71238898,
          root: 0.12,
          lunge: 45,
        },
      ],
      preview: "Z 변화: 3타 270° 회전·짧은 전진 / X·C: 기본",
    },
    tier2: {
      x: [
        {
          op: "DelayedEcho",
          mode: "dash-arc",
          coneRad: 3.14159265,
          damageScale: 0.6,
        },
      ],
      c: [
        {
          op: "Orbit",
          mode: "boost",
          duration: 2,
          haste: 1.8,
        },
      ],
      preview:
        "Z: T1 유지 / X 변화: 공격 취소 후 반원 베기 / C 변화: 종료 후 칼날 2초 가속",
    },
    tier3: {
      z: [
        {
          op: "ArcSlash",
          coneRad: 6.28318531,
          dual: true,
          root: 0.12,
        },
      ],
      c: [
        {
          op: "Pull",
          radius: 205,
          distance: 60,
        },
        {
          op: "CleaveAround",
          ticks: 3,
          interval: 0.3,
          radius: 205,
          damageScale: 0.8,
          capScale: 5.1,
        },
      ],
      preview:
        "Z 변화: 전후방 이중 회전 / X: T2 유지 / C 변화: 당기기 + 360° 3회 회전",
    },
  },
  PATH_02: {
    id: "PATH_02",
    family: "절단/근접",
    name: "갈고리 집행자",
    required: {
      arm: "ARM_SAW",
      back: "BACK_TENTACLE",
      heart: "HEART_HUNGER",
      eye: "EYE_HUNTER",
    },
    implemented: false,
    tags: ["절단/근접"],
    aiUsageProfile: "baseline-telegraphed",
    visualId: "path_02",
    constraints: {
      maxEntities: 3,
      icd: 0.3,
      targetCap: 3,
    },
    tier1: {
      z: [],
      preview:
        "부채꼴 베기. **T1:** 표식 적에게 좁은 찌르기로 자동 전환. **T3:** 표식 적 30% HP 미만에서 1회 전방 처형 베기 발동.",
    },
    tier2: {
      x: [],
      c: [],
      preview:
        "X 회피 직후 0.7초 내 Z는 70px 돌진 찌르기. / C 넓은 베기. **T2:** C가 표식 적 하나를 90px 끌어당김. **T3:** C 끌기 성공 시 대상 방향으로 2차 절단.",
    },
    tier3: {
      z: [],
      c: [],
      preview:
        "부채꼴 베기. **T1:** 표식 적에게 좁은 찌르기로 자동 전환. **T3:** 표식 적 30% HP 미만에서 1회 전방 처형 베기 발동. / C 넓은 베기. **T2:** C가 표식 적 하나를 90px 끌어당김. **T3:** C 끌기 성공 시 대상 방향으로 2차 절단.",
    },
  },
  PATH_03: {
    id: "PATH_03",
    family: "절단/근접",
    name: "피의 박자",
    required: {
      arm: "ARM_SAW",
      back: "BACK_TENTACLE",
      heart: "HEART_HUNGER",
      eye: "EYE_BLOOD",
    },
    implemented: false,
    tags: ["절단/근접"],
    aiUsageProfile: "baseline-telegraphed",
    visualId: "path_03",
    constraints: {
      maxEntities: 3,
      icd: 0.3,
      targetCap: 3,
    },
    tier1: {
      z: [],
      preview:
        "기본 3타. **T1:** 정해진 박자(0.15~0.35초) Z 재입력 성공 시 4타 열림. **T3:** 4타 성공 뒤 5타 충격파, 실패하면 3타 루프로 복귀.",
    },
    tier2: {
      x: [],
      c: [],
      preview:
        "박자 성공 직후 X는 무적 +0.06초, 재사용 충전 없음. / C 회전 베기. **T2:** 박자 2회 성공하면 C 연계 타격 2회. **T3:** 박자 3회 성공하면 C가 전방 연속 6타.",
    },
    tier3: {
      z: [],
      c: [],
      preview:
        "기본 3타. **T1:** 정해진 박자(0.15~0.35초) Z 재입력 성공 시 4타 열림. **T3:** 4타 성공 뒤 5타 충격파, 실패하면 3타 루프로 복귀. / C 회전 베기. **T2:** 박자 2회 성공하면 C 연계 타격 2회. **T3:** 박자 3회 성공하면 C가 전방 연속 6타.",
    },
  },
  PATH_04: {
    id: "PATH_04",
    family: "절단/근접",
    name: "재단선",
    required: {
      arm: "ARM_SAW",
      back: "BACK_TURRET",
      heart: "HEART_BLAST",
      eye: "EYE_HUNTER",
    },
    implemented: false,
    tags: ["절단/근접"],
    aiUsageProfile: "baseline-telegraphed",
    visualId: "path_04",
    constraints: {
      maxEntities: 3,
      icd: 0.3,
      targetCap: 3,
    },
    tier1: {
      z: [],
      preview:
        "전방 참격. **T1:** Z 적중 지점에 3초간 절단선 설치 (최대 2). **T3:** 절단선 통과 적에게 베기, Z로 선을 다시 그으면 교차점 폭발.",
    },
    tier2: {
      x: [],
      c: [],
      preview:
        "X가 선을 가로지르면 뒤쪽 선에 충격파. / C 회전 절단. **T2:** C가 모든 절단선을 한 번 발동. **T3:** C가 절단선 2개를 연결해 중앙 직선 절단.",
    },
    tier3: {
      z: [],
      c: [],
      preview:
        "전방 참격. **T1:** Z 적중 지점에 3초간 절단선 설치 (최대 2). **T3:** 절단선 통과 적에게 베기, Z로 선을 다시 그으면 교차점 폭발. / C 회전 절단. **T2:** C가 모든 절단선을 한 번 발동. **T3:** C가 절단선 2개를 연결해 중앙 직선 절단.",
    },
  },
  PATH_05: {
    id: "PATH_05",
    family: "투사체/원거리",
    name: "가시 산탄병",
    required: {
      arm: "ARM_SPINE",
      back: "BACK_TURRET",
      heart: "HEART_HUNGER",
      eye: "EYE_HUNTER",
    },
    implemented: false,
    tags: ["투사체/원거리"],
    aiUsageProfile: "baseline-telegraphed",
    visualId: "path_05",
    constraints: {
      maxEntities: 3,
      icd: 0.3,
      targetCap: 3,
    },
    tier1: {
      z: [],
      preview:
        "단일 가시. **T1:** Z 3발 산탄, 한 발 피해 55%. **T3:** Z 5발 산탄 + 2m 이내 적중 시 좁은 관통침 추가.",
    },
    tier2: {
      x: [],
      c: [],
      preview:
        "X 뒤 Z 1회는 후방 견제탄 2발 추가. / C 5발 방사. **T2:** C 9발 원형 방사. **T3:** C 전방 압축 산탄 12발, 거리별 피해 감쇠.",
    },
    tier3: {
      z: [],
      c: [],
      preview:
        "단일 가시. **T1:** Z 3발 산탄, 한 발 피해 55%. **T3:** Z 5발 산탄 + 2m 이내 적중 시 좁은 관통침 추가. / C 5발 방사. **T2:** C 9발 원형 방사. **T3:** C 전방 압축 산탄 12발, 거리별 피해 감쇠.",
    },
  },
  PATH_06: {
    id: "PATH_06",
    family: "투사체/원거리",
    name: "뼈 저격수",
    required: {
      arm: "ARM_SPINE",
      back: "BACK_TURRET",
      heart: "HEART_HUNGER",
      eye: "EYE_WEAK",
    },
    implemented: true,
    tags: ["투사체/원거리"],
    aiUsageProfile: "baseline-telegraphed",
    visualId: "path_06",
    constraints: {
      maxEntities: 3,
      icd: 0.3,
      targetCap: 3,
    },
    tier1: {
      z: [
        {
          op: "ChargedRelease",
          threshold: 0.45,
          railThreshold: 0.9,
          length: 620,
          width: 22,
        },
      ],
      preview: "Z 변화: 정지 0.45초 충전 후 관통탄 / X·C: 기본",
    },
    tier2: {
      x: [
        {
          op: "ResourceBank",
          ratio: 0.5,
          duration: 0.6,
        },
      ],
      c: [
        {
          op: "PiercingRay",
          length: 650,
          width: 28,
          damageScale: 2,
          mark: true,
        },
      ],
      preview:
        "Z: T1 유지 / X 변화: 충전 취소·50% 보존 0.6초 / C 변화: 표적 관통탄",
    },
    tier3: {
      z: [
        {
          op: "ChargedRelease",
          threshold: 0.45,
          railThreshold: 0.9,
          length: 850,
          width: 12,
          bossStagger: 30,
        },
      ],
      c: [
        {
          op: "PiercingRay",
          length: 850,
          width: 24,
          damageScale: 2,
          followups: 3,
          interval: 0.3,
          capScale: 5,
        },
      ],
      preview:
        "Z 변화: 0.9초 레일탄·보스 경직 +30 / X: T2 유지 / C 변화: 직선 3회 후속탄",
    },
  },
  PATH_07: {
    id: "PATH_07",
    family: "투사체/원거리",
    name: "귀환 가시",
    required: {
      arm: "ARM_SPINE",
      back: "BACK_BLADES",
      heart: "HEART_PARASITE",
      eye: "EYE_HUNTER",
    },
    implemented: false,
    tags: ["투사체/원거리"],
    aiUsageProfile: "baseline-telegraphed",
    visualId: "path_07",
    constraints: {
      maxEntities: 3,
      icd: 0.3,
      targetCap: 3,
    },
    tier1: {
      z: [],
      preview:
        "Z 단발. **T1:** Z 가시 최대 거리에서 복귀, 귀환 시 60% 피해. **T3:** 가시 2개까지 경로 유지, X로 귀환 방향 급변.",
    },
    tier2: {
      x: [],
      c: [],
      preview:
        "X 무적 성공 시 공중 가시 1개 즉시 귀환. / C 다발 발사. **T2:** C 두 개의 왕복 가시. **T3:** C 가시들이 플레이어 주변 1회 선회 후 복귀.",
    },
    tier3: {
      z: [],
      c: [],
      preview:
        "Z 단발. **T1:** Z 가시 최대 거리에서 복귀, 귀환 시 60% 피해. **T3:** 가시 2개까지 경로 유지, X로 귀환 방향 급변. / C 다발 발사. **T2:** C 두 개의 왕복 가시. **T3:** C 가시들이 플레이어 주변 1회 선회 후 복귀.",
    },
  },
  PATH_08: {
    id: "PATH_08",
    family: "투사체/원거리",
    name: "가시 지뢰꾼",
    required: {
      arm: "ARM_SPINE",
      back: "BACK_POISON",
      heart: "HEART_BLAST",
      eye: "EYE_SWARM",
    },
    implemented: false,
    tags: ["투사체/원거리"],
    aiUsageProfile: "baseline-telegraphed",
    visualId: "path_08",
    constraints: {
      maxEntities: 3,
      icd: 0.3,
      targetCap: 3,
    },
    tier1: {
      z: [],
      preview:
        "Z 가시. **T1:** Z가 바닥에 박혀 3초 지뢰 (활성 0.4초). **T3:** Z가 지뢰끼리 140px 내 연쇄 기폭, 최대 5개.",
    },
    tier2: {
      x: [],
      c: [],
      preview:
        "X는 가까운 지뢰를 지나가며 작동시키지 않음. / C 가시 다발. **T2:** C가 설치 지뢰를 원격 기폭. **T3:** C가 설치 지뢰 모두를 중심으로 2차 작은 가시 발사.",
    },
    tier3: {
      z: [],
      c: [],
      preview:
        "Z 가시. **T1:** Z가 바닥에 박혀 3초 지뢰 (활성 0.4초). **T3:** Z가 지뢰끼리 140px 내 연쇄 기폭, 최대 5개. / C 가시 다발. **T2:** C가 설치 지뢰를 원격 기폭. **T3:** C가 설치 지뢰 모두를 중심으로 2차 작은 가시 발사.",
    },
  },
  PATH_09: {
    id: "PATH_09",
    family: "충격/강타",
    name: "지진 분쇄자",
    required: {
      arm: "ARM_CRUSH",
      back: "BACK_BLADES",
      heart: "HEART_BLAST",
      eye: "EYE_SWARM",
    },
    implemented: false,
    tags: ["충격/강타"],
    aiUsageProfile: "baseline-telegraphed",
    visualId: "path_09",
    constraints: {
      maxEntities: 3,
      icd: 0.3,
      targetCap: 3,
    },
    tier1: {
      z: [],
      preview:
        "무거운 내려찍기. **T1:** Z가 타격 지점에 짧은 전방 파동. **T3:** 3회 Z마다 V자 균열 2줄, 각각 지연 폭발.",
    },
    tier2: {
      x: [],
      c: [],
      preview:
        "X 끝 지점에 약한 지진 원형 판정. / C 전방 충격파. **T2:** C가 균열을 즉시 기폭. **T3:** C가 일직선 3회 지진 연속 발동.",
    },
    tier3: {
      z: [],
      c: [],
      preview:
        "무거운 내려찍기. **T1:** Z가 타격 지점에 짧은 전방 파동. **T3:** 3회 Z마다 V자 균열 2줄, 각각 지연 폭발. / C 전방 충격파. **T2:** C가 균열을 즉시 기폭. **T3:** C가 일직선 3회 지진 연속 발동.",
    },
  },
  PATH_10: {
    id: "PATH_10",
    family: "충격/강타",
    name: "반동 망치",
    required: {
      arm: "ARM_CRUSH",
      back: "BACK_TENTACLE",
      heart: "HEART_UNDYING",
      eye: "EYE_WEAK",
    },
    implemented: false,
    tags: ["충격/강타"],
    aiUsageProfile: "baseline-telegraphed",
    visualId: "path_10",
    constraints: {
      maxEntities: 3,
      icd: 0.3,
      targetCap: 3,
    },
    tier1: {
      z: [],
      preview:
        "Z 강타. **T1:** Z 적중 시 캐릭터가 35px 뒤로 반동 (절벽 무관). **T3:** 벽에 적 밀착시 2차 충격파, 캐릭터는 경계에서 정지.",
    },
    tier2: {
      x: [],
      c: [],
      preview:
        "X를 피해 없이 성공하면 다음 Z의 준비 -40%. / C 전방 충격파. **T2:** C가 대상을 90px 밀어 벽 충돌 시 기절. **T3:** C가 보스에겐 끌기 대신 경직 게이지 피해.",
    },
    tier3: {
      z: [],
      c: [],
      preview:
        "Z 강타. **T1:** Z 적중 시 캐릭터가 35px 뒤로 반동 (절벽 무관). **T3:** 벽에 적 밀착시 2차 충격파, 캐릭터는 경계에서 정지. / C 전방 충격파. **T2:** C가 대상을 90px 밀어 벽 충돌 시 기절. **T3:** C가 보스에겐 끌기 대신 경직 게이지 피해.",
    },
  },
  PATH_11: {
    id: "PATH_11",
    family: "충격/강타",
    name: "공중파쇄",
    required: {
      arm: "ARM_CRUSH",
      back: "BACK_TURRET",
      heart: "HEART_HUNGER",
      eye: "EYE_HUNTER",
    },
    implemented: false,
    tags: ["충격/강타"],
    aiUsageProfile: "baseline-telegraphed",
    visualId: "path_11",
    constraints: {
      maxEntities: 3,
      icd: 0.3,
      targetCap: 3,
    },
    tier1: {
      z: [],
      preview:
        "Z 내려찍기. **T1:** Z 성공 후 0.6초 내 Z는 상향 타격(띄우기 판정). **T3:** 상향 타격 뒤 다음 Z는 착지 강타, 좁은 추가 피해.",
    },
    tier2: {
      x: [],
      c: [],
      preview:
        "X는 콤보 중간 탈출, 공중 상태 잔상 제거. / C 충격파. **T2:** C가 공중 표시 대상에 더 강한 폭발. **T3:** C가 공중 표시 대상 1명에 따라붙는 단일 강타.",
    },
    tier3: {
      z: [],
      c: [],
      preview:
        "Z 내려찍기. **T1:** Z 성공 후 0.6초 내 Z는 상향 타격(띄우기 판정). **T3:** 상향 타격 뒤 다음 Z는 착지 강타, 좁은 추가 피해. / C 충격파. **T2:** C가 공중 표시 대상에 더 강한 폭발. **T3:** C가 공중 표시 대상 1명에 따라붙는 단일 강타.",
    },
  },
  PATH_12: {
    id: "PATH_12",
    family: "충격/강타",
    name: "균열 사냥꾼",
    required: {
      arm: "ARM_CRUSH",
      back: "BACK_ELECTRIC",
      heart: "HEART_OVERCHARGE",
      eye: "EYE_WEAK",
    },
    implemented: false,
    tags: ["충격/강타"],
    aiUsageProfile: "baseline-telegraphed",
    visualId: "path_12",
    constraints: {
      maxEntities: 3,
      icd: 0.3,
      targetCap: 3,
    },
    tier1: {
      z: [],
      preview:
        "Z 강타. **T1:** Z로 감전 대상 강타하면 지면 전기 균열. **T3:** 균열을 2개 연결하면 적 사이 전류 다리 생성.",
    },
    tier2: {
      x: [],
      c: [],
      preview:
        "X로 균열을 횡단 시 다음 Z 한 번 감전 부여. / C 충격파. **T2:** C로 균열 모두 즉시 전도. **T3:** C가 균열 연결 지점으로 번개를 3번 전파.",
    },
    tier3: {
      z: [],
      c: [],
      preview:
        "Z 강타. **T1:** Z로 감전 대상 강타하면 지면 전기 균열. **T3:** 균열을 2개 연결하면 적 사이 전류 다리 생성. / C 충격파. **T2:** C로 균열 모두 즉시 전도. **T3:** C가 균열 연결 지점으로 번개를 3번 전파.",
    },
  },
  PATH_13: {
    id: "PATH_13",
    family: "촉수/제어",
    name: "도살 올가미",
    required: {
      arm: "ARM_WHIP",
      back: "BACK_TENTACLE",
      heart: "HEART_HUNGER",
      eye: "EYE_HUNTER",
    },
    implemented: false,
    tags: ["촉수/제어"],
    aiUsageProfile: "baseline-telegraphed",
    visualId: "path_13",
    constraints: {
      maxEntities: 3,
      icd: 0.3,
      targetCap: 3,
    },
    tier1: {
      z: [],
      preview:
        "중거리 휘두르기. **T1:** Z 적중 적 중 1명을 40px 당김. **T3:** 끌려온 적 2명 이상이면 다음 Z에 관통 휩쓸기.",
    },
    tier2: {
      x: [],
      c: [],
      preview:
        "X 뒤 Z는 반원 반격 휘두르기. / C 갈고리 당김. **T2:** C로 최대 3명 끌기. **T3:** C 끌기 직후 자동 Z 추격 베기 예약 (0.25초 입력 버퍼).",
    },
    tier3: {
      z: [],
      c: [],
      preview:
        "중거리 휘두르기. **T1:** Z 적중 적 중 1명을 40px 당김. **T3:** 끌려온 적 2명 이상이면 다음 Z에 관통 휩쓸기. / C 갈고리 당김. **T2:** C로 최대 3명 끌기. **T3:** C 끌기 직후 자동 Z 추격 베기 예약 (0.25초 입력 버퍼).",
    },
  },
  PATH_14: {
    id: "PATH_14",
    family: "촉수/제어",
    name: "거미줄 집행자",
    required: {
      arm: "ARM_WHIP",
      back: "BACK_POISON",
      heart: "HEART_BLAST",
      eye: "EYE_INFECTION",
    },
    implemented: false,
    tags: ["촉수/제어"],
    aiUsageProfile: "baseline-telegraphed",
    visualId: "path_14",
    constraints: {
      maxEntities: 3,
      icd: 0.3,
      targetCap: 3,
    },
    tier1: {
      z: [],
      preview:
        "Z 채찍. **T1:** Z 적중 지점 사이 둔화 실 연결(최대 2). **T3:** Z가 실 사이 적을 한번 끌어당겨 독 중첩.",
    },
    tier2: {
      x: [],
      c: [],
      preview:
        "X가 실을 통과하면 둔화 면역 1초. / C 갈고리. **T2:** C가 마지막 실을 한 지점으로 당김. **T3:** C로 전부 당긴 뒤 독 구름 1회 발동.",
    },
    tier3: {
      z: [],
      c: [],
      preview:
        "Z 채찍. **T1:** Z 적중 지점 사이 둔화 실 연결(최대 2). **T3:** Z가 실 사이 적을 한번 끌어당겨 독 중첩. / C 갈고리. **T2:** C가 마지막 실을 한 지점으로 당김. **T3:** C로 전부 당긴 뒤 독 구름 1회 발동.",
    },
  },
  PATH_15: {
    id: "PATH_15",
    family: "촉수/제어",
    name: "채찍 회오리",
    required: {
      arm: "ARM_WHIP",
      back: "BACK_BLADES",
      heart: "HEART_HUNGER",
      eye: "EYE_SWARM",
    },
    implemented: false,
    tags: ["촉수/제어"],
    aiUsageProfile: "baseline-telegraphed",
    visualId: "path_15",
    constraints: {
      maxEntities: 3,
      icd: 0.3,
      targetCap: 3,
    },
    tier1: {
      z: [],
      preview:
        "Z 중거리 호. **T1:** Z 홀드 0.7초면 몸 주위를 도는 연속 채찍. **T3:** 2초 이상 유지하면 점진 범위 확장, 이동속도 감소.",
    },
    tier2: {
      x: [],
      c: [],
      preview:
        "X 후 Z 홀드 재시작 시 첫 회전 즉시 발생. / C 당기기. **T2:** C가 회오리 종료 순간 넉백 파동. **T3:** C가 회오리 중 끌려온 적을 주변에 던짐.",
    },
    tier3: {
      z: [],
      c: [],
      preview:
        "Z 중거리 호. **T1:** Z 홀드 0.7초면 몸 주위를 도는 연속 채찍. **T3:** 2초 이상 유지하면 점진 범위 확장, 이동속도 감소. / C 당기기. **T2:** C가 회오리 종료 순간 넉백 파동. **T3:** C가 회오리 중 끌려온 적을 주변에 던짐.",
    },
  },
  PATH_16: {
    id: "PATH_16",
    family: "촉수/제어",
    name: "포식 끈",
    required: {
      arm: "ARM_WHIP",
      back: "BACK_TENTACLE",
      heart: "HEART_COAGULATE",
      eye: "EYE_BLOOD",
    },
    implemented: false,
    tags: ["촉수/제어"],
    aiUsageProfile: "baseline-telegraphed",
    visualId: "path_16",
    constraints: {
      maxEntities: 3,
      icd: 0.3,
      targetCap: 3,
    },
    tier1: {
      z: [],
      preview:
        "Z 채찍. **T1:** Z로 출혈 적 한 명과 피의 줄 연결(2.5초). **T3:** 줄 연결 중 거리 160px 내 Z 적중마다 대상에게 추가 찌르기.",
    },
    tier2: {
      x: [],
      c: [],
      preview:
        "X가 연결 대상을 관통하면 출혈 1스택. / C 갈고리. **T2:** C가 연결 적을 중심으로 작은 원형 베기. **T3:** C가 연결 적을 당기지 않고 공중 고정 표시 후 처형형 다중타.",
    },
    tier3: {
      z: [],
      c: [],
      preview:
        "Z 채찍. **T1:** Z로 출혈 적 한 명과 피의 줄 연결(2.5초). **T3:** 줄 연결 중 거리 160px 내 Z 적중마다 대상에게 추가 찌르기. / C 갈고리. **T2:** C가 연결 적을 중심으로 작은 원형 베기. **T3:** C가 연결 적을 당기지 않고 공중 고정 표시 후 처형형 다중타.",
    },
  },
  PATH_17: {
    id: "PATH_17",
    family: "회피/기동",
    name: "잔상 검객",
    required: {
      arm: "ARM_SAW",
      back: "BACK_BLADES",
      heart: "HEART_HUNGER",
      eye: "EYE_HUNTER",
    },
    implemented: true,
    tags: ["회피/기동"],
    aiUsageProfile: "baseline-telegraphed",
    visualId: "path_17",
    constraints: {
      maxEntities: 3,
      icd: 0.3,
      targetCap: 3,
    },
    tier1: {
      z: [
        {
          op: "DelayedEcho",
          mode: "dash-z",
          window: 0.7,
          delay: 0.12,
          count: 1,
          damageScale: 0.45,
        },
      ],
      preview: "Z 변화: 회피 직후 공격하면 경로 중간 잔상 / X·C: 기본",
    },
    tier2: {
      x: [
        {
          op: "DelayedEcho",
          mode: "successful-evade",
          count: 1,
          damageScale: 0.45,
        },
      ],
      c: [
        {
          op: "ReplicateStrike",
          damageScale: 0.45,
        },
      ],
      preview:
        "Z: T1 유지 / X 변화: 실제 공격 회피 성공 시 추가 잔상 / C 변화: 잔상 위치에서 베기",
    },
    tier3: {
      z: [
        {
          op: "DelayedEcho",
          mode: "dash-z",
          window: 0.7,
          delay: 0.8,
          count: 2,
          damageScale: 0.45,
        },
      ],
      c: [
        {
          op: "GroundLine",
          consume: true,
          width: 30,
          damageScale: 0.45,
        },
      ],
      preview:
        "Z 변화: 끝점 잔상 2개가 0.8초 후 재현 / X: T2 유지 / C 변화: 잔상 소비·연결선 공격",
    },
  },
  PATH_18: {
    id: "PATH_18",
    family: "회피/기동",
    name: "관통 유령",
    required: {
      arm: "ARM_SPINE",
      back: "BACK_TURRET",
      heart: "HEART_PARASITE",
      eye: "EYE_HUNTER",
    },
    implemented: false,
    tags: ["회피/기동"],
    aiUsageProfile: "baseline-telegraphed",
    visualId: "path_18",
    constraints: {
      maxEntities: 3,
      icd: 0.3,
      targetCap: 3,
    },
    tier1: {
      z: [],
      preview:
        "Z 가시. **T1:** X 이동 경로에 유령탄 3발 남김. **T3:** X 성공 회피시 다음 Z가 유령탄 전체 발사 방향 변경.",
    },
    tier2: {
      x: [],
      c: [],
      preview:
        "X는 기존 2충전, 추가 충전 보상 금지. / C 다발 가시. **T2:** C가 경로 유령탄을 동시 폭발. **T3:** C 폭발된 유령탄에서 가까운 표식 대상 관통탄 발사.",
    },
    tier3: {
      z: [],
      c: [],
      preview:
        "Z 가시. **T1:** X 이동 경로에 유령탄 3발 남김. **T3:** X 성공 회피시 다음 Z가 유령탄 전체 발사 방향 변경. / C 다발 가시. **T2:** C가 경로 유령탄을 동시 폭발. **T3:** C 폭발된 유령탄에서 가까운 표식 대상 관통탄 발사.",
    },
  },
  PATH_19: {
    id: "PATH_19",
    family: "회피/기동",
    name: "회피 태풍",
    required: {
      arm: "ARM_WHIP",
      back: "BACK_ELECTRIC",
      heart: "HEART_OVERCHARGE",
      eye: "EYE_SWARM",
    },
    implemented: false,
    tags: ["회피/기동"],
    aiUsageProfile: "baseline-telegraphed",
    visualId: "path_19",
    constraints: {
      maxEntities: 3,
      icd: 0.3,
      targetCap: 3,
    },
    tier1: {
      z: [],
      preview:
        "Z 채찍. **T1:** X 성공 회피 후 1초 Z가 전기 채찍 1회. **T3:** 연속 성공 회피 2회 이후 다음 Z는 번개 원호 3중.",
    },
    tier2: {
      x: [],
      c: [],
      preview:
        "X 재충전 시간은 고정, 추가 무적 증가 없음. / C 갈고리. **T2:** C가 감전 적 사이 전기줄 형성. **T3:** C가 줄 형성 직후 2회 연속 전기 쓸기.",
    },
    tier3: {
      z: [],
      c: [],
      preview:
        "Z 채찍. **T1:** X 성공 회피 후 1초 Z가 전기 채찍 1회. **T3:** 연속 성공 회피 2회 이후 다음 Z는 번개 원호 3중. / C 갈고리. **T2:** C가 감전 적 사이 전기줄 형성. **T3:** C가 줄 형성 직후 2회 연속 전기 쓸기.",
    },
  },
  PATH_20: {
    id: "PATH_20",
    family: "회피/기동",
    name: "돌진 포식자",
    required: {
      arm: "ARM_CRUSH",
      back: "BACK_TENTACLE",
      heart: "HEART_UNDYING",
      eye: "EYE_PREDATOR",
    },
    implemented: false,
    tags: ["회피/기동"],
    aiUsageProfile: "baseline-telegraphed",
    visualId: "path_20",
    constraints: {
      maxEntities: 3,
      icd: 0.3,
      targetCap: 3,
    },
    tier1: {
      z: [],
      preview:
        "Z 강타. **T1:** X 후 0.5초 Z는 90px 짧은 돌진 강타. **T3:** 돌진 적중 시 차지 보존 1회, 다음 Z 추가 넉백.",
    },
    tier2: {
      x: [],
      c: [],
      preview:
        "X 성공 회피면 돌진 강타 즉시 사용 가능. / C 충격파. **T2:** C가 이동 방향 돌진 후 충격파. **T3:** C 돌진 종료 위치에서 좁은 범위 2회 강타.",
    },
    tier3: {
      z: [],
      c: [],
      preview:
        "Z 강타. **T1:** X 후 0.5초 Z는 90px 짧은 돌진 강타. **T3:** 돌진 적중 시 차지 보존 1회, 다음 Z 추가 넉백. / C 충격파. **T2:** C가 이동 방향 돌진 후 충격파. **T3:** C 돌진 종료 위치에서 좁은 범위 2회 강타.",
    },
  },
  PATH_21: {
    id: "PATH_21",
    family: "중독/전염",
    name: "독무 도축자",
    required: {
      arm: "ARM_WHIP",
      back: "BACK_POISON",
      heart: "HEART_BLAST",
      eye: "EYE_INFECTION",
    },
    implemented: false,
    tags: ["중독/전염"],
    aiUsageProfile: "baseline-telegraphed",
    visualId: "path_21",
    constraints: {
      maxEntities: 3,
      icd: 0.3,
      targetCap: 3,
    },
    tier1: {
      z: [],
      preview:
        "Z 채찍. **T1:** Z 적중 시 대상 뒤에 1.5초 소형 독 구름 생성. **T3:** 독 구름에 들어온 적에게 Z로 2차 출혈 부여.",
    },
    tier2: {
      x: [],
      c: [],
      preview:
        "X로 독 구름 통과 시 자기 이속 +10% 1초. / C 당김. **T2:** C가 독 구름 중심으로 적을 끌기. **T3:** C로 구름 3개를 하나로 합쳐 폭발.",
    },
    tier3: {
      z: [],
      c: [],
      preview:
        "Z 채찍. **T1:** Z 적중 시 대상 뒤에 1.5초 소형 독 구름 생성. **T3:** 독 구름에 들어온 적에게 Z로 2차 출혈 부여. / C 당김. **T2:** C가 독 구름 중심으로 적을 끌기. **T3:** C로 구름 3개를 하나로 합쳐 폭발.",
    },
  },
  PATH_22: {
    id: "PATH_22",
    family: "중독/전염",
    name: "감염 연금술사",
    required: {
      arm: "ARM_SPINE",
      back: "BACK_POISON",
      heart: "HEART_OVERCHARGE",
      eye: "EYE_INFECTION",
    },
    implemented: false,
    tags: ["중독/전염"],
    aiUsageProfile: "baseline-telegraphed",
    visualId: "path_22",
    constraints: {
      maxEntities: 3,
      icd: 0.3,
      targetCap: 3,
    },
    tier1: {
      z: [],
      preview:
        "Z 가시. **T1:** Z 가시 적중 시 독 1중첩, 감전 적엔 독 2. **T3:** 독 5중첩 대상에 Z 적중 시 독 소비 후 주변 감전.",
    },
    tier2: {
      x: [],
      c: [],
      preview:
        "X 성공 회피 후 다음 Z에 감전 부여. / C 다발. **T2:** C가 독 5 이상 적 최대 3명을 동시에 폭발. **T3:** C 폭발 대상 주변에 독 구름 생성.",
    },
    tier3: {
      z: [],
      c: [],
      preview:
        "Z 가시. **T1:** Z 가시 적중 시 독 1중첩, 감전 적엔 독 2. **T3:** 독 5중첩 대상에 Z 적중 시 독 소비 후 주변 감전. / C 다발. **T2:** C가 독 5 이상 적 최대 3명을 동시에 폭발. **T3:** C 폭발 대상 주변에 독 구름 생성.",
    },
  },
  PATH_23: {
    id: "PATH_23",
    family: "중독/전염",
    name: "역병 사냥감",
    required: {
      arm: "ARM_SAW",
      back: "BACK_POISON",
      heart: "HEART_COAGULATE",
      eye: "EYE_INFECTION",
    },
    implemented: false,
    tags: ["중독/전염"],
    aiUsageProfile: "baseline-telegraphed",
    visualId: "path_23",
    constraints: {
      maxEntities: 3,
      icd: 0.3,
      targetCap: 3,
    },
    tier1: {
      z: [],
      preview:
        "Z 베기. **T1:** Z로 출혈+독 대상에게 1.3배 피해. **T3:** 둘 다 걸린 적 처치시 주변 2명에 출혈+독 각각 1.",
    },
    tier2: {
      x: [],
      c: [],
      preview:
        "X 후 1.2초 기본 공격에 독 1스택 추가. / C 회전 베기. **T2:** C가 이중 상태 대상에 좁은 처형 베기. **T3:** C가 처치 성공 시 120px 역병 파동.",
    },
    tier3: {
      z: [],
      c: [],
      preview:
        "Z 베기. **T1:** Z로 출혈+독 대상에게 1.3배 피해. **T3:** 둘 다 걸린 적 처치시 주변 2명에 출혈+독 각각 1. / C 회전 베기. **T2:** C가 이중 상태 대상에 좁은 처형 베기. **T3:** C가 처치 성공 시 120px 역병 파동.",
    },
  },
  PATH_24: {
    id: "PATH_24",
    family: "중독/전염",
    name: "전기 전염선",
    required: {
      arm: "ARM_CRUSH",
      back: "BACK_ELECTRIC",
      heart: "HEART_OVERCHARGE",
      eye: "EYE_INFECTION",
    },
    implemented: false,
    tags: ["중독/전염"],
    aiUsageProfile: "baseline-telegraphed",
    visualId: "path_24",
    constraints: {
      maxEntities: 3,
      icd: 0.3,
      targetCap: 3,
    },
    tier1: {
      z: [],
      preview:
        "Z 강타. **T1:** 감전 적 Z 적중 시 인접 적 하나에 튀는 번개. **T3:** Z가 충격파로 전기선 설치, 전기선 위 적에게 감전.",
    },
    tier2: {
      x: [],
      c: [],
      preview:
        "X 지나간 구간에 짧은 전기 잔상 1개. / C 충격파. **T2:** C가 전기선 모두를 발화. **T3:** C가 전기선 끝마다 전기 폭발 1회.",
    },
    tier3: {
      z: [],
      c: [],
      preview:
        "Z 강타. **T1:** 감전 적 Z 적중 시 인접 적 하나에 튀는 번개. **T3:** Z가 충격파로 전기선 설치, 전기선 위 적에게 감전. / C 충격파. **T2:** C가 전기선 모두를 발화. **T3:** C가 전기선 끝마다 전기 폭발 1회.",
    },
  },
  PATH_25: {
    id: "PATH_25",
    family: "소환/자동연계",
    name: "새끼 사냥꾼",
    required: {
      arm: "ARM_SAW",
      back: "BACK_BROOD",
      heart: "HEART_PARASITE",
      eye: "EYE_HUNTER",
    },
    implemented: true,
    tags: ["소환/자동연계"],
    aiUsageProfile: "baseline-telegraphed",
    visualId: "path_25",
    constraints: {
      maxEntities: 3,
      icd: 0.3,
      targetCap: 3,
    },
    tier1: {
      z: [
        {
          op: "SummonOrder",
          mode: "single-mark-dash",
          count: 1,
        },
      ],
      preview: "Z 변화: 적중 표식·새끼 1마리 돌진 / X·C: 기본",
    },
    tier2: {
      x: [
        {
          op: "SummonOrder",
          mode: "hold-vulnerable",
          duration: 0.8,
        },
      ],
      c: [
        {
          op: "SummonOrder",
          mode: "focus",
        },
      ],
      preview:
        "Z: T1 유지 / X 변화: 새끼는 회피하지 않고 공격 유지 / C 변화: 전원 집중 대상 변경",
    },
    tier3: {
      z: [
        {
          op: "SummonOrder",
          mode: "third-hit-flank",
          count: 2,
        },
      ],
      c: [
        {
          op: "SummonOrder",
          mode: "converge-execute",
          count: 3,
        },
      ],
      preview:
        "Z 변화: 세 번째 적중에 새끼 2마리 협공 / X: T2 유지 / C 변화: 전원 합동 처형·보스 추가 피해",
    },
  },
  PATH_26: {
    id: "PATH_26",
    family: "소환/자동연계",
    name: "기생 지휘관",
    required: {
      arm: "ARM_SPINE",
      back: "BACK_BROOD",
      heart: "HEART_PARASITE",
      eye: "EYE_HUNTER",
    },
    implemented: false,
    tags: ["소환/자동연계"],
    aiUsageProfile: "baseline-telegraphed",
    visualId: "path_26",
    constraints: {
      maxEntities: 3,
      icd: 0.3,
      targetCap: 3,
    },
    tier1: {
      z: [],
      preview:
        "Z 가시. **T1:** Z 적중 타깃에게 새끼 우선 집중. **T3:** Z 두 번 연속 적중 시 소환체 탄막 발사.",
    },
    tier2: {
      x: [],
      c: [],
      preview:
        "X 직후 0.6초 새끼들이 플레이어 주변으로 모임. / C 다발. **T2:** C가 소환체 공격 주기 즉시 초기화. **T3:** C가 소환체 3마리 돌진 후 원위치.",
    },
    tier3: {
      z: [],
      c: [],
      preview:
        "Z 가시. **T1:** Z 적중 타깃에게 새끼 우선 집중. **T3:** Z 두 번 연속 적중 시 소환체 탄막 발사. / C 다발. **T2:** C가 소환체 공격 주기 즉시 초기화. **T3:** C가 소환체 3마리 돌진 후 원위치.",
    },
  },
  PATH_27: {
    id: "PATH_27",
    family: "소환/자동연계",
    name: "살아있는 성채",
    required: {
      arm: "ARM_CRUSH",
      back: "BACK_TURRET",
      heart: "HEART_PARASITE",
      eye: "EYE_HUNTER",
    },
    implemented: false,
    tags: ["소환/자동연계"],
    aiUsageProfile: "baseline-telegraphed",
    visualId: "path_27",
    constraints: {
      maxEntities: 3,
      icd: 0.3,
      targetCap: 3,
    },
    tier1: {
      z: [],
      preview:
        "Z 강타. **T1:** 정지 0.5초 후 Z는 방벽 타격+포탑 연동. **T3:** 방벽 유지 중 포탑 2연사, 캐릭터 이동 50%.",
    },
    tier2: {
      x: [],
      c: [],
      preview:
        "X로 방벽 취소 가능, 회피 충전 소모. / C 충격파. **T2:** C를 방벽 중 사용하면 전방 포탑 집중 사격. **T3:** C 방벽 2회 유지 성공 시 강력한 전방 포격.",
    },
    tier3: {
      z: [],
      c: [],
      preview:
        "Z 강타. **T1:** 정지 0.5초 후 Z는 방벽 타격+포탑 연동. **T3:** 방벽 유지 중 포탑 2연사, 캐릭터 이동 50%. / C 충격파. **T2:** C를 방벽 중 사용하면 전방 포탑 집중 사격. **T3:** C 방벽 2회 유지 성공 시 강력한 전방 포격.",
    },
  },
  PATH_28: {
    id: "PATH_28",
    family: "소환/자동연계",
    name: "포탑 사냥망",
    required: {
      arm: "ARM_WHIP",
      back: "BACK_TURRET",
      heart: "HEART_PARASITE",
      eye: "EYE_HUNTER",
    },
    implemented: false,
    tags: ["소환/자동연계"],
    aiUsageProfile: "baseline-telegraphed",
    visualId: "path_28",
    constraints: {
      maxEntities: 3,
      icd: 0.3,
      targetCap: 3,
    },
    tier1: {
      z: [],
      preview:
        "Z 채찍. **T1:** Z 적중 시 포탑 표적 강제 변경. **T3:** Z로 표적 2명 연결 후 포탑 번갈아 사격.",
    },
    tier2: {
      x: [],
      c: [],
      preview:
        "X 뒤 포탑은 현재 두 표적에 1회씩 발사. / C 갈고리. **T2:** C가 표식 둘을 한곳으로 당김. **T3:** C 뒤 포탑 두 대상 중심 교차 탄막.",
    },
    tier3: {
      z: [],
      c: [],
      preview:
        "Z 채찍. **T1:** Z 적중 시 포탑 표적 강제 변경. **T3:** Z로 표적 2명 연결 후 포탑 번갈아 사격. / C 갈고리. **T2:** C가 표식 둘을 한곳으로 당김. **T3:** C 뒤 포탑 두 대상 중심 교차 탄막.",
    },
  },
  PATH_29: {
    id: "PATH_29",
    family: "폭발/위험",
    name: "폭탄 심장",
    required: {
      arm: "ARM_SAW",
      back: "BACK_BLADES",
      heart: "HEART_BLAST",
      eye: "EYE_SWARM",
    },
    implemented: false,
    tags: ["폭발/위험"],
    aiUsageProfile: "baseline-telegraphed",
    visualId: "path_29",
    constraints: {
      maxEntities: 3,
      icd: 0.3,
      targetCap: 3,
    },
    tier1: {
      z: [],
      preview:
        "Z 베기. **T1:** Z 처치 3회 누적 시 다음 Z 폭발 부여. **T3:** 다음 Z가 적 3명 적중 시 2차 폭발.",
    },
    tier2: {
      x: [],
      c: [],
      preview:
        "X 종료 시 보류 폭발을 소형 파동으로 소모 가능. / C 회전 베기. **T2:** C에 보류 폭발 적용 가능. **T3:** C가 넓은 범위 2회 폭발, 전체 피해 140% 한도.",
    },
    tier3: {
      z: [],
      c: [],
      preview:
        "Z 베기. **T1:** Z 처치 3회 누적 시 다음 Z 폭발 부여. **T3:** 다음 Z가 적 3명 적중 시 2차 폭발. / C 회전 베기. **T2:** C에 보류 폭발 적용 가능. **T3:** C가 넓은 범위 2회 폭발, 전체 피해 140% 한도.",
    },
  },
  PATH_30: {
    id: "PATH_30",
    family: "폭발/위험",
    name: "불사의 주먹",
    required: {
      arm: "ARM_CRUSH",
      back: "BACK_TENTACLE",
      heart: "HEART_UNDYING",
      eye: "EYE_PREDATOR",
    },
    implemented: false,
    tags: ["폭발/위험"],
    aiUsageProfile: "baseline-telegraphed",
    visualId: "path_30",
    constraints: {
      maxEntities: 3,
      icd: 0.3,
      targetCap: 3,
    },
    tier1: {
      z: [],
      preview:
        "Z 강타. **T1:** HP 40% 이하 때 Z 준비시간 -20%. **T3:** HP 25% 이하 때 Z 2회 연속 강타, 2번째 60% 피해.",
    },
    tier2: {
      x: [],
      c: [],
      preview:
        "X 성공 회피 시 5HP 회복, 3초 내부 쿨다운. / C 충격파. **T2:** C에 HP 소모 8 추가해 1.5배 충격파. **T3:** C 사용 시 8HP 소모 후 남은 HP 1 미만 불가.",
    },
    tier3: {
      z: [],
      c: [],
      preview:
        "Z 강타. **T1:** HP 40% 이하 때 Z 준비시간 -20%. **T3:** HP 25% 이하 때 Z 2회 연속 강타, 2번째 60% 피해. / C 충격파. **T2:** C에 HP 소모 8 추가해 1.5배 충격파. **T3:** C 사용 시 8HP 소모 후 남은 HP 1 미만 불가.",
    },
  },
  PATH_31: {
    id: "PATH_31",
    family: "폭발/위험",
    name: "유혈 장전",
    required: {
      arm: "ARM_SPINE",
      back: "BACK_TURRET",
      heart: "HEART_COAGULATE",
      eye: "EYE_BLOOD",
    },
    implemented: false,
    tags: ["폭발/위험"],
    aiUsageProfile: "baseline-telegraphed",
    visualId: "path_31",
    constraints: {
      maxEntities: 3,
      icd: 0.3,
      targetCap: 3,
    },
    tier1: {
      z: [],
      preview:
        "Z 가시. **T1:** 출혈 적 공격 시 혈탄 1발 축적, 최대 3. **T3:** 3발 축적 후 다음 Z가 관통 혈탄으로 교체.",
    },
    tier2: {
      x: [],
      c: [],
      preview:
        "X 직후 Z는 혈탄의 발사 속도만 증가. / C 다발 가시. **T2:** C로 혈탄 전체 소비해 일제사. **T3:** 혈탄 3개 소모 시 직선 혈류 포격.",
    },
    tier3: {
      z: [],
      c: [],
      preview:
        "Z 가시. **T1:** 출혈 적 공격 시 혈탄 1발 축적, 최대 3. **T3:** 3발 축적 후 다음 Z가 관통 혈탄으로 교체. / C 다발 가시. **T2:** C로 혈탄 전체 소비해 일제사. **T3:** 혈탄 3개 소모 시 직선 혈류 포격.",
    },
  },
  PATH_32: {
    id: "PATH_32",
    family: "폭발/위험",
    name: "자폭 사육사",
    required: {
      arm: "ARM_WHIP",
      back: "BACK_BROOD",
      heart: "HEART_BLAST",
      eye: "EYE_SWARM",
    },
    implemented: false,
    tags: ["폭발/위험"],
    aiUsageProfile: "baseline-telegraphed",
    visualId: "path_32",
    constraints: {
      maxEntities: 3,
      icd: 0.3,
      targetCap: 3,
    },
    tier1: {
      z: [],
      preview:
        "Z 채찍. **T1:** Z로 새끼에 폭발 표식, 1마리 1회만. **T3:** Z 적중 시 폭발 새끼를 대상에게 돌진시켜 폭파.",
    },
    tier2: {
      x: [],
      c: [],
      preview:
        "X 후 1초는 새끼 자폭 면역(원래 자기피해 없음). / C 갈고리. **T2:** C가 폭발 새끼를 적 한 명에게 이동. **T3:** C가 모든 새끼를 순차 폭발, 0.15초 간격.",
    },
    tier3: {
      z: [],
      c: [],
      preview:
        "Z 채찍. **T1:** Z로 새끼에 폭발 표식, 1마리 1회만. **T3:** Z 적중 시 폭발 새끼를 대상에게 돌진시켜 폭파. / C 갈고리. **T2:** C가 폭발 새끼를 적 한 명에게 이동. **T3:** C가 모든 새끼를 순차 폭발, 0.15초 간격.",
    },
  },
};
export const SUPPORTED_OPERATIONS = new Set([
  "ArcSlash",
  "DelayedEcho",
  "Orbit",
  "Pull",
  "CleaveAround",
  "ChargedRelease",
  "ResourceBank",
  "PiercingRay",
  "ReplicateStrike",
  "GroundLine",
  "SummonOrder",
]);
export function validatePaths(registry = ACTION_PATHS) {
  const errors = [],
    families = new Map();
  for (const [id, p] of Object.entries(registry)) {
    if (id !== p.id) errors.push(`${id}: ID mismatch`);
    families.set(p.family, (families.get(p.family) || 0) + 1);
    for (const slot of ["arm", "back", "heart", "eye"])
      if (ORGANS[p.required?.[slot]]?.slot !== slot)
        errors.push(`${id}: missing ${slot} organ`);
    for (const tier of ["tier1", "tier2", "tier3"])
      for (const key of ["z", "x", "c"])
        for (const op of p[tier]?.[key] || [])
          if (!SUPPORTED_OPERATIONS.has(op.op))
            errors.push(`${id}: unsupported operation ${op.op}`);
    if (p.implemented)
      for (const [tier, keys] of [
        ["tier1", ["z"]],
        ["tier2", ["x", "c"]],
        ["tier3", ["z", "c"]],
      ])
        for (const key of keys)
          if (!p[tier]?.[key]?.length)
            errors.push(`${id}: ${tier}.${key} missing`);
  }
  return {
    valid: errors.length === 0,
    errors,
    count: Object.keys(registry).length,
    families: Object.fromEntries(families),
  };
}
export function emptyMorph() {
  return {
    version: 2,
    pathId: null,
    tier: 0,
    counters: {},
    comboWindowEnd: 0,
    temporaryEntities: [],
  };
}
export function restoreMorph(saved) {
  const p = ACTION_PATHS[saved?.pathId];
  if (
    saved?.version !== 2 ||
    !p?.implemented ||
    !Number.isInteger(saved.tier) ||
    saved.tier < 1 ||
    saved.tier > 3
  )
    return emptyMorph();
  const counters = Object.fromEntries(
    Object.entries(saved.counters || {})
      .filter(
        ([k, v]) => k.length < 40 && Number.isFinite(v) && Math.abs(v) < 1e6,
      )
      .slice(0, 20),
  );
  return { ...emptyMorph(), pathId: p.id, tier: saved.tier, counters };
}
export function serializeMorph(actor) {
  return restoreMorph(actor.actionMorph);
}
export function gearMatches(actor, path, tier) {
  return Boolean(
    path &&
      actor.organs.arm === path.required.arm &&
      actor.organs.back === path.required.back &&
      (tier < 2 ||
        actor.organs.heart === path.required.heart ||
        actor.organs.eye === path.required.eye) &&
      (tier < 3 ||
        (actor.organs.heart === path.required.heart &&
          actor.organs.eye === path.required.eye)),
  );
}
export function activeMorphTier(actor) {
  const s = actor.actionMorph,
    p = ACTION_PATHS[s?.pathId];
  return actor.team === "hunter"
    ? 0
    : p?.implemented && s.tier >= 1 && gearMatches(actor, p, s.tier)
      ? s.tier
      : 0;
}
export function morphRewards(actor) {
  const s = actor.actionMorph || emptyMorph();
  if (!s.pathId)
    return Object.values(ACTION_PATHS)
      .filter((p) => p.implemented && gearMatches(actor, p, 1))
      .map((p) => ({ kind: "path", id: p.id, tier: 1, synergy: true }));
  const p = ACTION_PATHS[s.pathId];
  return p?.implemented && s.tier < 3 && gearMatches(actor, p, s.tier + 1)
    ? [{ kind: "path-tier", id: p.id, tier: s.tier + 1, synergy: true }]
    : [];
}
export function selectMorph(actor, reward) {
  const choices = morphRewards(actor);
  if (
    !choices.some(
      (r) =>
        r.kind === reward.kind && r.id === reward.id && r.tier === reward.tier,
    )
  )
    return false;
  const old = actor.actionMorph;
  actor.actionMorph = {
    ...emptyMorph(),
    pathId: reward.id,
    tier: reward.tier,
    counters: { ...(old?.counters || {}) },
  };
  actor.morphController?.sync(actor);
  return true;
}
function freezePath(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const item of Object.values(value)) freezePath(item);
    Object.freeze(value);
  }
  return value;
}
freezePath(ACTION_PATHS);
