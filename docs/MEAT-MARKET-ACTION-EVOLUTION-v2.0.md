# MEAT MARKET — ACTION EVOLUTION BUILD SYSTEM v2.0
> Codex implementation contract. Updated action-first builds. This document **supplements** `docs/MEAT-MARKET-BUILD-SPEC-v1.3.md`; where conflicting, v2.0 governs action transformations, v1.3 governs underlying compatible organ/status semantics. Engine: existing JavaScript ES modules + HTML Canvas; no framework rewrite. This document defines design targets, not already implemented features.

## 0. Absolute gameplay constraints
- **↑↓←→ move**, **Z attack/hold**, **X dash**, **C special**, Enter menu confirm, Esc pause. No mouse, WASD, extra skill keys or mandatory rhythm combos.
- Z/X/C must meaningfully change **their action shape and decision-making**, not only DPS. Higher tiers unlock via selectable run rewards, not real-time unlock by elapsed time alone.
- Do not remove existing playable combat, tracking, hunter records, GitHub Pages or standalone builds. Existing prototype has ARM_SAW/ARM_SPINE, 3 backs, 2 hearts, 2 eyes and 12 mutations. IDs in old code are uppercase shown in this document.
- Source-of-truth is the repository code, not proposed classes; inspect `src/data.js`, `src/core.js`, `src/game.js`, `src/render.js`, `tests/combat.test.js`. Extend existing systems with minimal refactors.
- **Do not implement all 32 builds in a single PR.** Build reusable action primitives, then implement four vertical slices, then families incrementally. Track every feature with tests and in-game validation.

## 1. Action evolution architecture
Current game already defines organ + mutation effects, but has no reliable, unified action-form progression. Add a data-driven **ActionMorph** tier system. Each complete build path has T0 base action, T1 signature action, T2 evolving action, T3 mastery; in the 32 build cards below, T1 corresponds to '중반', T3 to '완성' and T2 is an explicitly defined bridge: **T2 unlocks T1 plus its specified X or C synergy, T3 unlocks final Z + final C**. Thus no abrupt complete swap.
- **T0** starts with base ARM Z/X/C and no morph bonus. Existing organ choices still available.
- **T1** grants first Z morph from corresponding build card; introduces new attack geometry, hit rule or charge behavior. Typical reward availability: after one arm and a matching back or eye.
- **T2** grants X morph and first C morph from card; requires T1 and 2 matching organs. X morph is *always* optional secondary action; base dash remains intact.
- **T3** grants final Z + final C; requires T2, matching heart and eye, and an additional upgrade opportunity. Builds don't need 4 organs to be useful in T1/T2.
- At most **one active ActionPath** per character. Mutually exclusive path selection; never auto-pick a path from gear. A change of matching organ makes current path dormant and refunds dependent tier choices in a **documented keyboard-only UI** or preserve tiers as inactive until matching gear returns (MVP use inactive, no destructive refund).
- Each tier selection consumes one level-up reward opportunity; present meaningful alternates. Display current `T1 → T2 → T3`, a concise preview of action change and tradeoff.
- Damage/range/speed percentages in older v1.3 are starter tuning; every build below includes concrete geometric/action changes and critical bounds. Tiers must never alter WASD/mouse/control layout.

## 2. Required code contracts
```ts
type ActionPathDefinition = {
 id: string; family: string; name: string;
 required: { arm: string; back: string; heart: string; eye: string };
 tier1: ActionDescriptor; tier2: ActionDescriptor; tier3: ActionDescriptor;
 constraints: { maxEntities?: number; icd?: number; targetCap?: number };
 tags: string[]; aiUsageProfile: string; visualId: string;
};
type ActionDescriptor = {
 z?: ActionMorphOperation[]; x?: ActionMorphOperation[]; c?: ActionMorphOperation[];
 timing?: {windup?:number; active?:number; recovery?:number; cancelFrom?:number};
 geometry?: {shape:string; radius?:number; width?:number; coneRad?:number; length?:number};
 cost?: {hp?:number; charge?:number; stacks?:number};
 targeting?: {assistAngle:number; lockDuration:number; requiresLOS?:boolean};
};
type BuildActionState = {
 version:2; pathId: string|null; tier:0|1|2|3;
 counters:Record<string,number>; comboWindowEnd:number;
 temporaryEntities:Array<{entityId:string;kind:string;expiresAt:number;sourceId:string}>;
};
```
- Interpret descriptors through small typed, tested action primitives; **no eval, script strings, arbitrary JS callbacks from data**.
- Reuse `CombatEvents` and existing `CONFIG.maxChainDepth`, `CONFIG.maxChainEvents`; preserve deterministic ordering. Add source attack instance, effect chain root, expiry timestamps, per-target hit cooldown.
- Existing actions: `Actor.attack`, `Actor.buffer`, `Actor.specialAt`, `Actor.dashUntil`; avoid independent timers that bypass their lifecycle.
- Suggested primitives: ArcSlash, Thrust, ConeBurst, Projectile, PiercingRay, ChargedRelease, BeamChain, Orbit, Shockwave, Pull, Push, GroundLine, GroundCloud, GroundMine, AnchorLink, DelayedEcho, ReplicateStrike, Mark, StackConsume, Detonate, SummonOrder, TeleportlessLunge, GuardWindow, CounterWindow, AirborneVisual, Channel, CleaveAround, RepositionProjectile, ResourceBank, Split, Rebound. Implement in shared action resolver and render adapters.
- Spatial placement clips to arena bounds and obstacle collision. Do not teleport through walls. Visual effects must never conceal incoming boss telegraphs. Per target per attack instance single hit except explicit multi-hit/ticks.
- If a tier is dormant because an organ swapped, its Z/X/C revert to baseline *without leaving active subscriptions, lingering summons or unpaid modifiers*. Restoring required gear re-enables same tier.
- Store action morph IDs, tier, counters versioned in run saves/death records. Old `meat-market.deaths.v1` must load unchanged. Unknown IDs safely fall back T0. Hunter can use available morph at reduced T2 complexity with readable telegraph; never silently call missing action implementation.

## 3. Global tuning defaults (starting hypothesis, tune in tests)
- Existing baseline: 0.22s dash/0.16s invulnerable/2 charges, maxEnemies=160, maxProjectiles=350, 5–8 min run.
- Attack direction: prioritize facing cone; last movement heading fallback; target correction must not hit behind player by default.
- Existing maxChainDepth=4, maxChainEvents=64, enforce budgets for spawn/summons/area fields. For new delayed effects, carry root ID and suppress explosive self-recursion.
- Temporary construct limits per player: mines 5, ground fields 3, lines 2–4 by build, summons 3, echoes 3, homing projectiles 6. Cap active hitboxes independently from rendering.
- Default dot tick >=0.4s, deferred proc cooldown >=0.3s; per-action absolute damage caps where multi-projectile can hit same target.
- The T1/T2/T3 tier upgrades should make output demonstrably stronger but T3 should trade off with mobility, setup, precision, risk or cooldown. Avoid all-purpose guaranteed upgrades.
- When conditions are unmet, revert to well-defined baseline Z/C rather than dead input; failed C may have standard C use if explicit in card.

## 4. Thirty-two independently implementable action build paths
Each path: precise gear signature; Z morph from base → T1 → T3; X morph available at T2; C morph base → T2 → T3; risk, activation and expected user decisions. Every row is a design target, not shipping behavior.

### 절단/근접 family

#### PATH_01 — 회전 도살자
- **Slots:** arm `ARM_SAW`, back `BACK_BLADES`, heart `HEART_HUNGER`, eye `EYE_BLOOD`.
- **Z T0:** 부채꼴 3타. **T1:** 3타째 270° 회전, 위치 고정 0.12초. **T3:** 전방 180°+후방 180° 이중 궤적, 뒤쪽 적 추가 타격.
- **X T2:** 베기 중 X로 짧은 관통 대시, 회피 후 반원 후려치기.
- **C T0:** C 회전 절단. **T2:** C 종료 시 회전 칼날 2초 가속. **T3:** C가 주위 적을 중심으로 당긴 뒤 360° 3회 회전.
- **Constraint:** 전진 45px 베기 후 회복, 타격 대상만 출혈. 회전 중 이동속도 -25%, 동일 대상 최대 3틱.
- **Combat loop:** 세 번 이상 적중한 적 하나에 폭주 출혈을 적용. **Distinctive decision:** 원형 광역형·포위 탈출용.
- **Acceptance test:** Equip exactly listed organs and select PATH_01 T1/T2/T3; verify Z changes at T1, X+C at T2, Z+C at T3, limits and missing-gear fallback, and baseline inputs remain available.

#### PATH_02 — 갈고리 집행자
- **Slots:** arm `ARM_SAW`, back `BACK_TENTACLE`, heart `HEART_HUNGER`, eye `EYE_HUNTER`.
- **Z T0:** 부채꼴 베기. **T1:** 표식 적에게 좁은 찌르기로 자동 전환. **T3:** 표식 적 30% HP 미만에서 1회 전방 처형 베기 발동.
- **X T2:** X 회피 직후 0.7초 내 Z는 70px 돌진 찌르기.
- **C T0:** C 넓은 베기. **T2:** C가 표식 적 하나를 90px 끌어당김. **T3:** C 끌기 성공 시 대상 방향으로 2차 절단.
- **Constraint:** 표식이 없으면 일반 공격, 뒤쪽 타깃 자동 선회 금지. 보스 끌기 금지, 끌기 불가 대상은 20% 추가 피해.
- **Combat loop:** 표식 부여→접근→처형 루프. **Distinctive decision:** 정예 단일 격파.
- **Acceptance test:** Equip exactly listed organs and select PATH_02 T1/T2/T3; verify Z changes at T1, X+C at T2, Z+C at T3, limits and missing-gear fallback, and baseline inputs remain available.

#### PATH_03 — 피의 박자
- **Slots:** arm `ARM_SAW`, back `BACK_TENTACLE`, heart `HEART_HUNGER`, eye `EYE_BLOOD`.
- **Z T0:** 기본 3타. **T1:** 정해진 박자(0.15~0.35초) Z 재입력 성공 시 4타 열림. **T3:** 4타 성공 뒤 5타 충격파, 실패하면 3타 루프로 복귀.
- **X T2:** 박자 성공 직후 X는 무적 +0.06초, 재사용 충전 없음.
- **C T0:** C 회전 베기. **T2:** 박자 2회 성공하면 C 연계 타격 2회. **T3:** 박자 3회 성공하면 C가 전방 연속 6타.
- **Constraint:** Z 홀드 시 자동 연타 가능하나 박자 보너스 불가. 기본 조작 유지, 타이밍 입력은 선택적 고점.
- **Combat loop:** 입력 숙련도를 주는 근접 리듬. **Distinctive decision:** 기계적 손맛 강화.
- **Acceptance test:** Equip exactly listed organs and select PATH_03 T1/T2/T3; verify Z changes at T1, X+C at T2, Z+C at T3, limits and missing-gear fallback, and baseline inputs remain available.

#### PATH_04 — 재단선
- **Slots:** arm `ARM_SAW`, back `BACK_TURRET`, heart `HEART_BLAST`, eye `EYE_HUNTER`.
- **Z T0:** 전방 참격. **T1:** Z 적중 지점에 3초간 절단선 설치 (최대 2). **T3:** 절단선 통과 적에게 베기, Z로 선을 다시 그으면 교차점 폭발.
- **X T2:** X가 선을 가로지르면 뒤쪽 선에 충격파.
- **C T0:** C 회전 절단. **T2:** C가 모든 절단선을 한 번 발동. **T3:** C가 절단선 2개를 연결해 중앙 직선 절단.
- **Constraint:** 절단선에는 0.5초 동일 대상 히트 간격. 선은 벽을 통과하지 않음, 최대 2개.
- **Combat loop:** 동선을 긋고 유도하는 공간 통제. **Distinctive decision:** 배치형 근접.
- **Acceptance test:** Equip exactly listed organs and select PATH_04 T1/T2/T3; verify Z changes at T1, X+C at T2, Z+C at T3, limits and missing-gear fallback, and baseline inputs remain available.

### 투사체/원거리 family

#### PATH_05 — 가시 산탄병
- **Slots:** arm `ARM_SPINE`, back `BACK_TURRET`, heart `HEART_HUNGER`, eye `EYE_HUNTER`.
- **Z T0:** 단일 가시. **T1:** Z 3발 산탄, 한 발 피해 55%. **T3:** Z 5발 산탄 + 2m 이내 적중 시 좁은 관통침 추가.
- **X T2:** X 뒤 Z 1회는 후방 견제탄 2발 추가.
- **C T0:** C 5발 방사. **T2:** C 9발 원형 방사. **T3:** C 전방 압축 산탄 12발, 거리별 피해 감쇠.
- **Constraint:** 산탄이 같은 대상을 맞힐 때 2발째부터 피해 30%. 투사체 총량 예산/프레임 제한.
- **Combat loop:** 거리 조절로 산탄 집중. **Distinctive decision:** 근중거리 산탄.
- **Acceptance test:** Equip exactly listed organs and select PATH_05 T1/T2/T3; verify Z changes at T1, X+C at T2, Z+C at T3, limits and missing-gear fallback, and baseline inputs remain available.

#### PATH_06 — 뼈 저격수
- **Slots:** arm `ARM_SPINE`, back `BACK_TURRET`, heart `HEART_HUNGER`, eye `EYE_WEAK`.
- **Z T0:** Z 가시. **T1:** 움직이지 않고 0.45초 Z 충전 시 관통 직선탄. **T3:** 0.9초 완충 시 좁은 레일 탄, 적중 보스 경직 게이지 +30.
- **X T2:** 충전 중 X 후 0.6초 Z는 충전량 50% 보존.
- **C T0:** C 부채꼴 가시. **T2:** C가 적 표식 하나에 큰 관통탄. **T3:** C가 일직선 3회 후속탄 발사.
- **Constraint:** 충전 중 이동속도 35%, X 즉시 충전 취소. 표적 방향은 발사 직전 1회 고정.
- **Combat loop:** 충전 고점과 회피 리스크. **Distinctive decision:** 보스 집중.
- **Acceptance test:** Equip exactly listed organs and select PATH_06 T1/T2/T3; verify Z changes at T1, X+C at T2, Z+C at T3, limits and missing-gear fallback, and baseline inputs remain available.

#### PATH_07 — 귀환 가시
- **Slots:** arm `ARM_SPINE`, back `BACK_BLADES`, heart `HEART_PARASITE`, eye `EYE_HUNTER`.
- **Z T0:** Z 단발. **T1:** Z 가시 최대 거리에서 복귀, 귀환 시 60% 피해. **T3:** 가시 2개까지 경로 유지, X로 귀환 방향 급변.
- **X T2:** X 무적 성공 시 공중 가시 1개 즉시 귀환.
- **C T0:** C 다발 발사. **T2:** C 두 개의 왕복 가시. **T3:** C 가시들이 플레이어 주변 1회 선회 후 복귀.
- **Constraint:** 복귀 탄은 발사원 기준, 벽 충돌 시 파괴. 화면 밖 탄 유지 시간 최대 2.5초.
- **Combat loop:** 경로 설계형. **Distinctive decision:** 왕복 투사체.
- **Acceptance test:** Equip exactly listed organs and select PATH_07 T1/T2/T3; verify Z changes at T1, X+C at T2, Z+C at T3, limits and missing-gear fallback, and baseline inputs remain available.

#### PATH_08 — 가시 지뢰꾼
- **Slots:** arm `ARM_SPINE`, back `BACK_POISON`, heart `HEART_BLAST`, eye `EYE_SWARM`.
- **Z T0:** Z 가시. **T1:** Z가 바닥에 박혀 3초 지뢰 (활성 0.4초). **T3:** Z가 지뢰끼리 140px 내 연쇄 기폭, 최대 5개.
- **X T2:** X는 가까운 지뢰를 지나가며 작동시키지 않음.
- **C T0:** C 가시 다발. **T2:** C가 설치 지뢰를 원격 기폭. **T3:** C가 설치 지뢰 모두를 중심으로 2차 작은 가시 발사.
- **Constraint:** 설치 지뢰 한도 초과 시 가장 오래된 제거. 폭발 자기피해 없음, 적 공격 전조 가림 금지.
- **Combat loop:** 유도+구역 설계. **Distinctive decision:** 원거리 함정.
- **Acceptance test:** Equip exactly listed organs and select PATH_08 T1/T2/T3; verify Z changes at T1, X+C at T2, Z+C at T3, limits and missing-gear fallback, and baseline inputs remain available.

### 충격/강타 family

#### PATH_09 — 지진 분쇄자
- **Slots:** arm `ARM_CRUSH`, back `BACK_BLADES`, heart `HEART_BLAST`, eye `EYE_SWARM`.
- **Z T0:** 무거운 내려찍기. **T1:** Z가 타격 지점에 짧은 전방 파동. **T3:** 3회 Z마다 V자 균열 2줄, 각각 지연 폭발.
- **X T2:** X 끝 지점에 약한 지진 원형 판정.
- **C T0:** C 전방 충격파. **T2:** C가 균열을 즉시 기폭. **T3:** C가 일직선 3회 지진 연속 발동.
- **Constraint:** 균열은 최대 4개, 벽 너머 생성 불가. 강한 회복 0.25초, X 취소 가능 구간 별도.
- **Combat loop:** 군중을 모아 지진 폭파. **Distinctive decision:** 중거리 충격파.
- **Acceptance test:** Equip exactly listed organs and select PATH_09 T1/T2/T3; verify Z changes at T1, X+C at T2, Z+C at T3, limits and missing-gear fallback, and baseline inputs remain available.

#### PATH_10 — 반동 망치
- **Slots:** arm `ARM_CRUSH`, back `BACK_TENTACLE`, heart `HEART_UNDYING`, eye `EYE_WEAK`.
- **Z T0:** Z 강타. **T1:** Z 적중 시 캐릭터가 35px 뒤로 반동 (절벽 무관). **T3:** 벽에 적 밀착시 2차 충격파, 캐릭터는 경계에서 정지.
- **X T2:** X를 피해 없이 성공하면 다음 Z의 준비 -40%.
- **C T0:** C 전방 충격파. **T2:** C가 대상을 90px 밀어 벽 충돌 시 기절. **T3:** C가 보스에겐 끌기 대신 경직 게이지 피해.
- **Constraint:** 넉백 반동 중 신규 Z 금지, X로 반동 취소. 보스 기절 불가, 보스 경직게이지 감소로 변환.
- **Combat loop:** 큰 타격 한 방과 안전한 후퇴. **Distinctive decision:** 밀격 제어.
- **Acceptance test:** Equip exactly listed organs and select PATH_10 T1/T2/T3; verify Z changes at T1, X+C at T2, Z+C at T3, limits and missing-gear fallback, and baseline inputs remain available.

#### PATH_11 — 공중파쇄
- **Slots:** arm `ARM_CRUSH`, back `BACK_TURRET`, heart `HEART_HUNGER`, eye `EYE_HUNTER`.
- **Z T0:** Z 내려찍기. **T1:** Z 성공 후 0.6초 내 Z는 상향 타격(띄우기 판정). **T3:** 상향 타격 뒤 다음 Z는 착지 강타, 좁은 추가 피해.
- **X T2:** X는 콤보 중간 탈출, 공중 상태 잔상 제거.
- **C T0:** C 충격파. **T2:** C가 공중 표시 대상에 더 강한 폭발. **T3:** C가 공중 표시 대상 1명에 따라붙는 단일 강타.
- **Constraint:** 상향 타격 중 적 위치만 시각적으로 변화; 실제 2D 충돌 유지. 대상 없으면 일반 C, 강제 추적 거리 최대 120.
- **Combat loop:** 적중 연결형 콤보. **Distinctive decision:** 콤보 강타.
- **Acceptance test:** Equip exactly listed organs and select PATH_11 T1/T2/T3; verify Z changes at T1, X+C at T2, Z+C at T3, limits and missing-gear fallback, and baseline inputs remain available.

#### PATH_12 — 균열 사냥꾼
- **Slots:** arm `ARM_CRUSH`, back `BACK_ELECTRIC`, heart `HEART_OVERCHARGE`, eye `EYE_WEAK`.
- **Z T0:** Z 강타. **T1:** Z로 감전 대상 강타하면 지면 전기 균열. **T3:** 균열을 2개 연결하면 적 사이 전류 다리 생성.
- **X T2:** X로 균열을 횡단 시 다음 Z 한 번 감전 부여.
- **C T0:** C 충격파. **T2:** C로 균열 모두 즉시 전도. **T3:** C가 균열 연결 지점으로 번개를 3번 전파.
- **Constraint:** 다리는 최대 3초, 2개만 존재. 동일 대상 감전 0.4초 틱 제한.
- **Combat loop:** 둔중한 공격과 전류 구역. **Distinctive decision:** 감전 지면.
- **Acceptance test:** Equip exactly listed organs and select PATH_12 T1/T2/T3; verify Z changes at T1, X+C at T2, Z+C at T3, limits and missing-gear fallback, and baseline inputs remain available.

### 촉수/제어 family

#### PATH_13 — 도살 올가미
- **Slots:** arm `ARM_WHIP`, back `BACK_TENTACLE`, heart `HEART_HUNGER`, eye `EYE_HUNTER`.
- **Z T0:** 중거리 휘두르기. **T1:** Z 적중 적 중 1명을 40px 당김. **T3:** 끌려온 적 2명 이상이면 다음 Z에 관통 휩쓸기.
- **X T2:** X 뒤 Z는 반원 반격 휘두르기.
- **C T0:** C 갈고리 당김. **T2:** C로 최대 3명 끌기. **T3:** C 끌기 직후 자동 Z 추격 베기 예약 (0.25초 입력 버퍼).
- **Constraint:** 정예 끌기는 절반, 보스 끌기 면역. 자동 Z는 무료 한 번만, 그 뒤 재연계 금지.
- **Combat loop:** 적을 모으는 수동 콤보. **Distinctive decision:** 집결 근접.
- **Acceptance test:** Equip exactly listed organs and select PATH_13 T1/T2/T3; verify Z changes at T1, X+C at T2, Z+C at T3, limits and missing-gear fallback, and baseline inputs remain available.

#### PATH_14 — 거미줄 집행자
- **Slots:** arm `ARM_WHIP`, back `BACK_POISON`, heart `HEART_BLAST`, eye `EYE_INFECTION`.
- **Z T0:** Z 채찍. **T1:** Z 적중 지점 사이 둔화 실 연결(최대 2). **T3:** Z가 실 사이 적을 한번 끌어당겨 독 중첩.
- **X T2:** X가 실을 통과하면 둔화 면역 1초.
- **C T0:** C 갈고리. **T2:** C가 마지막 실을 한 지점으로 당김. **T3:** C로 전부 당긴 뒤 독 구름 1회 발동.
- **Constraint:** 거미줄은 최대 4초, 중첩 둔화 1회. 정예 끌기 절반, 보스 이동 불가.
- **Combat loop:** 적 동선 조절. **Distinctive decision:** 와이어 구역.
- **Acceptance test:** Equip exactly listed organs and select PATH_14 T1/T2/T3; verify Z changes at T1, X+C at T2, Z+C at T3, limits and missing-gear fallback, and baseline inputs remain available.

#### PATH_15 — 채찍 회오리
- **Slots:** arm `ARM_WHIP`, back `BACK_BLADES`, heart `HEART_HUNGER`, eye `EYE_SWARM`.
- **Z T0:** Z 중거리 호. **T1:** Z 홀드 0.7초면 몸 주위를 도는 연속 채찍. **T3:** 2초 이상 유지하면 점진 범위 확장, 이동속도 감소.
- **X T2:** X 후 Z 홀드 재시작 시 첫 회전 즉시 발생.
- **C T0:** C 당기기. **T2:** C가 회오리 종료 순간 넉백 파동. **T3:** C가 회오리 중 끌려온 적을 주변에 던짐.
- **Constraint:** 홀드 중 회피 가능하나 채찍 유지 리셋. 회오리 최대 유지 3초, 자동 리셋.
- **Combat loop:** 홀드와 위험 거리 관리. **Distinctive decision:** 지속 근접.
- **Acceptance test:** Equip exactly listed organs and select PATH_15 T1/T2/T3; verify Z changes at T1, X+C at T2, Z+C at T3, limits and missing-gear fallback, and baseline inputs remain available.

#### PATH_16 — 포식 끈
- **Slots:** arm `ARM_WHIP`, back `BACK_TENTACLE`, heart `HEART_COAGULATE`, eye `EYE_BLOOD`.
- **Z T0:** Z 채찍. **T1:** Z로 출혈 적 한 명과 피의 줄 연결(2.5초). **T3:** 줄 연결 중 거리 160px 내 Z 적중마다 대상에게 추가 찌르기.
- **X T2:** X가 연결 대상을 관통하면 출혈 1스택.
- **C T0:** C 갈고리. **T2:** C가 연결 적을 중심으로 작은 원형 베기. **T3:** C가 연결 적을 당기지 않고 공중 고정 표시 후 처형형 다중타.
- **Constraint:** 연결 1명, 거리 초과 시 끊김. 보스 고정 이동효과 없음, 추가피해만.
- **Combat loop:** 연결 유지하며 움직임. **Distinctive decision:** 단일 대상 링크.
- **Acceptance test:** Equip exactly listed organs and select PATH_16 T1/T2/T3; verify Z changes at T1, X+C at T2, Z+C at T3, limits and missing-gear fallback, and baseline inputs remain available.

### 회피/기동 family

#### PATH_17 — 잔상 검객
- **Slots:** arm `ARM_SAW`, back `BACK_BLADES`, heart `HEART_HUNGER`, eye `EYE_HUNTER`.
- **Z T0:** Z 기본 베기. **T1:** X 후 0.7초 Z는 경로 따라 잔상 1회 추가 공격. **T3:** X 종료 지점에 0.8초 지연 잔상 2개가 같은 Z 복제.
- **X T2:** X 성공 회피 시 잔상 1개 추가 (최대 3).
- **C T0:** C 회전 베기. **T2:** C가 잔상 위치에서 1회 동시 베기. **T3:** C가 잔상 모두 소비해 선형 절단.
- **Constraint:** 복제 잔상은 원본 45% 피해, 추가 이벤트 재귀 금지. 잔상은 공격 전조를 숨기지 않도록 반투명.
- **Combat loop:** 회피 경로를 설계. **Distinctive decision:** 후속 공격.
- **Acceptance test:** Equip exactly listed organs and select PATH_17 T1/T2/T3; verify Z changes at T1, X+C at T2, Z+C at T3, limits and missing-gear fallback, and baseline inputs remain available.

#### PATH_18 — 관통 유령
- **Slots:** arm `ARM_SPINE`, back `BACK_TURRET`, heart `HEART_PARASITE`, eye `EYE_HUNTER`.
- **Z T0:** Z 가시. **T1:** X 이동 경로에 유령탄 3발 남김. **T3:** X 성공 회피시 다음 Z가 유령탄 전체 발사 방향 변경.
- **X T2:** X는 기존 2충전, 추가 충전 보상 금지.
- **C T0:** C 다발 가시. **T2:** C가 경로 유령탄을 동시 폭발. **T3:** C 폭발된 유령탄에서 가까운 표식 대상 관통탄 발사.
- **Constraint:** 유령탄은 최대 6, 2초 후 소멸. 유령탄은 다른 유령탄을 소환하지 않음.
- **Combat loop:** 대시 궤도 사격. **Distinctive decision:** 기동 투사체.
- **Acceptance test:** Equip exactly listed organs and select PATH_18 T1/T2/T3; verify Z changes at T1, X+C at T2, Z+C at T3, limits and missing-gear fallback, and baseline inputs remain available.

#### PATH_19 — 회피 태풍
- **Slots:** arm `ARM_WHIP`, back `BACK_ELECTRIC`, heart `HEART_OVERCHARGE`, eye `EYE_SWARM`.
- **Z T0:** Z 채찍. **T1:** X 성공 회피 후 1초 Z가 전기 채찍 1회. **T3:** 연속 성공 회피 2회 이후 다음 Z는 번개 원호 3중.
- **X T2:** X 재충전 시간은 고정, 추가 무적 증가 없음.
- **C T0:** C 갈고리. **T2:** C가 감전 적 사이 전기줄 형성. **T3:** C가 줄 형성 직후 2회 연속 전기 쓸기.
- **Constraint:** 회피 성공은 실제 공격 회피일 때만, 시간창 4초. 성공 회피 보너스 만료 시 단계 리셋.
- **Combat loop:** 적 공격 패턴 읽기. **Distinctive decision:** 고위험 카운터.
- **Acceptance test:** Equip exactly listed organs and select PATH_19 T1/T2/T3; verify Z changes at T1, X+C at T2, Z+C at T3, limits and missing-gear fallback, and baseline inputs remain available.

#### PATH_20 — 돌진 포식자
- **Slots:** arm `ARM_CRUSH`, back `BACK_TENTACLE`, heart `HEART_UNDYING`, eye `EYE_PREDATOR`.
- **Z T0:** Z 강타. **T1:** X 후 0.5초 Z는 90px 짧은 돌진 강타. **T3:** 돌진 적중 시 차지 보존 1회, 다음 Z 추가 넉백.
- **X T2:** X 성공 회피면 돌진 강타 즉시 사용 가능.
- **C T0:** C 충격파. **T2:** C가 이동 방향 돌진 후 충격파. **T3:** C 돌진 종료 위치에서 좁은 범위 2회 강타.
- **Constraint:** 연속 돌진 보존은 런당이 아니라 1연계당 1회. 벽 관통 금지, 적 관통 여부 명시.
- **Combat loop:** 들어가서 끊고 빠지는 빌드. **Distinctive decision:** 돌격.
- **Acceptance test:** Equip exactly listed organs and select PATH_20 T1/T2/T3; verify Z changes at T1, X+C at T2, Z+C at T3, limits and missing-gear fallback, and baseline inputs remain available.

### 중독/전염 family

#### PATH_21 — 독무 도축자
- **Slots:** arm `ARM_WHIP`, back `BACK_POISON`, heart `HEART_BLAST`, eye `EYE_INFECTION`.
- **Z T0:** Z 채찍. **T1:** Z 적중 시 대상 뒤에 1.5초 소형 독 구름 생성. **T3:** 독 구름에 들어온 적에게 Z로 2차 출혈 부여.
- **X T2:** X로 독 구름 통과 시 자기 이속 +10% 1초.
- **C T0:** C 당김. **T2:** C가 독 구름 중심으로 적을 끌기. **T3:** C로 구름 3개를 하나로 합쳐 폭발.
- **Constraint:** 구름 최대 3개, 동일 대상 틱 0.5초. 보스 독 중첩 상한 동일, 끌기 면역.
- **Combat loop:** 유도와 독 지형 사용. **Distinctive decision:** 지형 상태이상.
- **Acceptance test:** Equip exactly listed organs and select PATH_21 T1/T2/T3; verify Z changes at T1, X+C at T2, Z+C at T3, limits and missing-gear fallback, and baseline inputs remain available.

#### PATH_22 — 감염 연금술사
- **Slots:** arm `ARM_SPINE`, back `BACK_POISON`, heart `HEART_OVERCHARGE`, eye `EYE_INFECTION`.
- **Z T0:** Z 가시. **T1:** Z 가시 적중 시 독 1중첩, 감전 적엔 독 2. **T3:** 독 5중첩 대상에 Z 적중 시 독 소비 후 주변 감전.
- **X T2:** X 성공 회피 후 다음 Z에 감전 부여.
- **C T0:** C 다발. **T2:** C가 독 5 이상 적 최대 3명을 동시에 폭발. **T3:** C 폭발 대상 주변에 독 구름 생성.
- **Constraint:** 감전 확산 한 적당 0.8초 제한. 구름은 자기 자신을 폭발로 재생성하지 않음.
- **Combat loop:** 상태 쌓기와 소비 타이밍. **Distinctive decision:** 중첩 폭발.
- **Acceptance test:** Equip exactly listed organs and select PATH_22 T1/T2/T3; verify Z changes at T1, X+C at T2, Z+C at T3, limits and missing-gear fallback, and baseline inputs remain available.

#### PATH_23 — 역병 사냥감
- **Slots:** arm `ARM_SAW`, back `BACK_POISON`, heart `HEART_COAGULATE`, eye `EYE_INFECTION`.
- **Z T0:** Z 베기. **T1:** Z로 출혈+독 대상에게 1.3배 피해. **T3:** 둘 다 걸린 적 처치시 주변 2명에 출혈+독 각각 1.
- **X T2:** X 후 1.2초 기본 공격에 독 1스택 추가.
- **C T0:** C 회전 베기. **T2:** C가 이중 상태 대상에 좁은 처형 베기. **T3:** C가 처치 성공 시 120px 역병 파동.
- **Constraint:** 중첩 이동은 원본의 1스택만, 무한 전파 금지. 처형은 보스 일격사 금지.
- **Combat loop:** 준비 후 한 번에 번지기. **Distinctive decision:** 전염 연쇄.
- **Acceptance test:** Equip exactly listed organs and select PATH_23 T1/T2/T3; verify Z changes at T1, X+C at T2, Z+C at T3, limits and missing-gear fallback, and baseline inputs remain available.

#### PATH_24 — 전기 전염선
- **Slots:** arm `ARM_CRUSH`, back `BACK_ELECTRIC`, heart `HEART_OVERCHARGE`, eye `EYE_INFECTION`.
- **Z T0:** Z 강타. **T1:** 감전 적 Z 적중 시 인접 적 하나에 튀는 번개. **T3:** Z가 충격파로 전기선 설치, 전기선 위 적에게 감전.
- **X T2:** X 지나간 구간에 짧은 전기 잔상 1개.
- **C T0:** C 충격파. **T2:** C가 전기선 모두를 발화. **T3:** C가 전기선 끝마다 전기 폭발 1회.
- **Constraint:** 전기선 2개, 3초, 동일 대상 0.6초 틱. 감전 이벤트의 동일 원본 재귀 1회 제한.
- **Combat loop:** 전기선 설치+점화. **Distinctive decision:** 배치 전이.
- **Acceptance test:** Equip exactly listed organs and select PATH_24 T1/T2/T3; verify Z changes at T1, X+C at T2, Z+C at T3, limits and missing-gear fallback, and baseline inputs remain available.

### 소환/자동연계 family

#### PATH_25 — 새끼 사냥꾼
- **Slots:** arm `ARM_SAW`, back `BACK_BROOD`, heart `HEART_PARASITE`, eye `EYE_HUNTER`.
- **Z T0:** Z 베기. **T1:** Z로 표식 시 새끼 1마리가 1회 돌진. **T3:** Z 세 번째 적중마다 새끼 2마리가 양방향 협공.
- **X T2:** X 중 새끼는 적 공격에서 회피하지 않음.
- **C T0:** C 회전 베기. **T2:** C가 새끼 전원 집중 대상 변경. **T3:** C가 새끼를 한 대상에 모아 합동 처형.
- **Constraint:** 새끼 3마리 상한, 표식 유지 4초. 보스 처형은 추가 피해로만 처리.
- **Combat loop:** 직접 지시형 소환. **Distinctive decision:** 소환 주력.
- **Acceptance test:** Equip exactly listed organs and select PATH_25 T1/T2/T3; verify Z changes at T1, X+C at T2, Z+C at T3, limits and missing-gear fallback, and baseline inputs remain available.

#### PATH_26 — 기생 지휘관
- **Slots:** arm `ARM_SPINE`, back `BACK_BROOD`, heart `HEART_PARASITE`, eye `EYE_HUNTER`.
- **Z T0:** Z 가시. **T1:** Z 적중 타깃에게 새끼 우선 집중. **T3:** Z 두 번 연속 적중 시 소환체 탄막 발사.
- **X T2:** X 직후 0.6초 새끼들이 플레이어 주변으로 모임.
- **C T0:** C 다발. **T2:** C가 소환체 공격 주기 즉시 초기화. **T3:** C가 소환체 3마리 돌진 후 원위치.
- **Constraint:** 소환체 탄막은 각각 40% 피해, 무한 생성 금지. 새끼 소멸 상태이면 C 보상은 가시 기본만.
- **Combat loop:** 지휘와 대열 정돈. **Distinctive decision:** 소환 컨트롤.
- **Acceptance test:** Equip exactly listed organs and select PATH_26 T1/T2/T3; verify Z changes at T1, X+C at T2, Z+C at T3, limits and missing-gear fallback, and baseline inputs remain available.

#### PATH_27 — 살아있는 성채
- **Slots:** arm `ARM_CRUSH`, back `BACK_TURRET`, heart `HEART_PARASITE`, eye `EYE_HUNTER`.
- **Z T0:** Z 강타. **T1:** 정지 0.5초 후 Z는 방벽 타격+포탑 연동. **T3:** 방벽 유지 중 포탑 2연사, 캐릭터 이동 50%.
- **X T2:** X로 방벽 취소 가능, 회피 충전 소모.
- **C T0:** C 충격파. **T2:** C를 방벽 중 사용하면 전방 포탑 집중 사격. **T3:** C 방벽 2회 유지 성공 시 강력한 전방 포격.
- **Constraint:** 방벽은 1.2초, 최대 HP 아닌 별도 1회 방어막. 피해량 상향과 기동력 저하를 상충.
- **Combat loop:** 정지 방어하고 사격. **Distinctive decision:** 거점 전투.
- **Acceptance test:** Equip exactly listed organs and select PATH_27 T1/T2/T3; verify Z changes at T1, X+C at T2, Z+C at T3, limits and missing-gear fallback, and baseline inputs remain available.

#### PATH_28 — 포탑 사냥망
- **Slots:** arm `ARM_WHIP`, back `BACK_TURRET`, heart `HEART_PARASITE`, eye `EYE_HUNTER`.
- **Z T0:** Z 채찍. **T1:** Z 적중 시 포탑 표적 강제 변경. **T3:** Z로 표적 2명 연결 후 포탑 번갈아 사격.
- **X T2:** X 뒤 포탑은 현재 두 표적에 1회씩 발사.
- **C T0:** C 갈고리. **T2:** C가 표식 둘을 한곳으로 당김. **T3:** C 뒤 포탑 두 대상 중심 교차 탄막.
- **Constraint:** 동시 표적 최대 2, 표식 만료 4초. 보스는 이동하지 않음, 공격 집중은 적용.
- **Combat loop:** 타깃 분배와 집중. **Distinctive decision:** 자동무기 지휘.
- **Acceptance test:** Equip exactly listed organs and select PATH_28 T1/T2/T3; verify Z changes at T1, X+C at T2, Z+C at T3, limits and missing-gear fallback, and baseline inputs remain available.

### 폭발/위험 family

#### PATH_29 — 폭탄 심장
- **Slots:** arm `ARM_SAW`, back `BACK_BLADES`, heart `HEART_BLAST`, eye `EYE_SWARM`.
- **Z T0:** Z 베기. **T1:** Z 처치 3회 누적 시 다음 Z 폭발 부여. **T3:** 다음 Z가 적 3명 적중 시 2차 폭발.
- **X T2:** X 종료 시 보류 폭발을 소형 파동으로 소모 가능.
- **C T0:** C 회전 베기. **T2:** C에 보류 폭발 적용 가능. **T3:** C가 넓은 범위 2회 폭발, 전체 피해 140% 한도.
- **Constraint:** 폭발 발동은 최대 1회 보류, 초과 스택 불가. 보류 폭발 소모 후 초기화.
- **Combat loop:** 처치 스택을 쌓는 폭탄. **Distinctive decision:** 대량처치.
- **Acceptance test:** Equip exactly listed organs and select PATH_29 T1/T2/T3; verify Z changes at T1, X+C at T2, Z+C at T3, limits and missing-gear fallback, and baseline inputs remain available.

#### PATH_30 — 불사의 주먹
- **Slots:** arm `ARM_CRUSH`, back `BACK_TENTACLE`, heart `HEART_UNDYING`, eye `EYE_PREDATOR`.
- **Z T0:** Z 강타. **T1:** HP 40% 이하 때 Z 준비시간 -20%. **T3:** HP 25% 이하 때 Z 2회 연속 강타, 2번째 60% 피해.
- **X T2:** X 성공 회피 시 5HP 회복, 3초 내부 쿨다운.
- **C T0:** C 충격파. **T2:** C에 HP 소모 8 추가해 1.5배 충격파. **T3:** C 사용 시 8HP 소모 후 남은 HP 1 미만 불가.
- **Constraint:** 체력 조건 해제되면 즉시 추가공격 중단. 극단적인 폭딜과 체력 관리.
- **Combat loop:** 저체력 격투. **Distinctive decision:** undefined.
- **Acceptance test:** Equip exactly listed organs and select PATH_30 T1/T2/T3; verify Z changes at T1, X+C at T2, Z+C at T3, limits and missing-gear fallback, and baseline inputs remain available.

#### PATH_31 — 유혈 장전
- **Slots:** arm `ARM_SPINE`, back `BACK_TURRET`, heart `HEART_COAGULATE`, eye `EYE_BLOOD`.
- **Z T0:** Z 가시. **T1:** 출혈 적 공격 시 혈탄 1발 축적, 최대 3. **T3:** 3발 축적 후 다음 Z가 관통 혈탄으로 교체.
- **X T2:** X 직후 Z는 혈탄의 발사 속도만 증가.
- **C T0:** C 다발 가시. **T2:** C로 혈탄 전체 소비해 일제사. **T3:** 혈탄 3개 소모 시 직선 혈류 포격.
- **Constraint:** 출혈 적 대상이 없으면 일반 Z, 혈탄은 6초 보관. 소모 탄이 없으면 일반 C.
- **Combat loop:** 상태이상으로 탄을 재장전. **Distinctive decision:** 리소스형.
- **Acceptance test:** Equip exactly listed organs and select PATH_31 T1/T2/T3; verify Z changes at T1, X+C at T2, Z+C at T3, limits and missing-gear fallback, and baseline inputs remain available.

#### PATH_32 — 자폭 사육사
- **Slots:** arm `ARM_WHIP`, back `BACK_BROOD`, heart `HEART_BLAST`, eye `EYE_SWARM`.
- **Z T0:** Z 채찍. **T1:** Z로 새끼에 폭발 표식, 1마리 1회만. **T3:** Z 적중 시 폭발 새끼를 대상에게 돌진시켜 폭파.
- **X T2:** X 후 1초는 새끼 자폭 면역(원래 자기피해 없음).
- **C T0:** C 갈고리. **T2:** C가 폭발 새끼를 적 한 명에게 이동. **T3:** C가 모든 새끼를 순차 폭발, 0.15초 간격.
- **Constraint:** 새끼는 자폭 후 재생성 쿨다운 4초. 소환 수 3, 연쇄 폭발 한 번씩.
- **Combat loop:** 위치 조작 후 소환 폭발. **Distinctive decision:** 자폭 소환.
- **Acceptance test:** Equip exactly listed organs and select PATH_32 T1/T2/T3; verify Z changes at T1, X+C at T2, Z+C at T3, limits and missing-gear fallback, and baseline inputs remain available.

## 5. Explicit implementation dependencies
The new build path table references some planned organs beyond current MVP. Implement them via the **v1.3 full organ registry**, retaining old IDs. Required IDs: `ARM_SAW`, `ARM_SPINE`, `ARM_CRUSH` (new), `ARM_WHIP` (new), `BACK_BLADES`, `BACK_TENTACLE`, `BACK_TURRET`, `BACK_POISON` (new), `BACK_BROOD` (new), `BACK_ELECTRIC` (new), `HEART_HUNGER`, `HEART_BLAST`, `HEART_COAGULATE` (new), `HEART_OVERCHARGE` (new), `HEART_PARASITE` (new), `HEART_UNDYING` (new), `EYE_BLOOD`, `EYE_HUNTER`, `EYE_WEAK` (new), `EYE_SWARM` (new), `EYE_INFECTION` (new), `EYE_PREDATOR` (new).
- `EYE_WEAK` weak-point eye and `EYE_PREDATOR` execute eye are distinct. `EYE_INFECTION` spreads status. `EYE_SWARM` scales by nearby target count.
- `HEART_PARASITE` reduces C cooldown on qualified auto-organ hits. `HEART_COAGULATE` heals from bleed interaction. `HEART_OVERCHARGE` improves shock. `HEART_UNDYING` is risk/reward under low HP.
- In path cards `BACK_BROOD` means summoned brood minions (cap 3); `BACK_POISON` toxic field; `BACK_ELECTRIC` electric chain. These are NOT present in current src/data.js; register new definitions before their paths.
- The 32 paths are **exclusive** tiered transformations; old mutations and global adaptations stay in parallel. One morph per run by default. Do not treat paths as mutually combinable mutations.
- v1.3's existing 18 mutation variants and 8 global adaptations remain required. Action morph implementation is an additional layer, not a substitute for existing content.

## 6. Reward generation and progression algorithm
```
function actionPathRewards(actor, rng) {
 const valid = PATHS.filter(p => p.required.arm === actor.organs.arm &&
                            p.required.back === actor.organs.back);
 const installed = actor.actionPath;
 if (!installed) return valid.map(p => ({kind:'path', id:p.id, tier:1}));
 const p = PATHS[installed.pathId];
 if (!p || p.required.arm !== actor.organs.arm) return [];
 if (installed.tier === 1 && p.required.back === actor.organs.back &&
     (p.required.heart === actor.organs.heart || p.required.eye === actor.organs.eye))
   return [{kind:'path-tier', id:p.id, tier:2}];
 if (installed.tier === 2 && p.required.heart === actor.organs.heart &&
     p.required.eye === actor.organs.eye)
   return [{kind:'path-tier', id:p.id, tier:3}];
 return [];
}
```
- Rule clarification: T1 requires matching arm+back; T2 requires at least one listed heart/eye plus arm+back; T3 requires all four. `pathId` selection is explicit, never silently swapped. Path reward candidate is included in the existing 3-choice keyboard UI; never always force it if competing build options are valid. Ensure level curve makes T3 feasible within the short prototype by test overrides.
- All rewards are committed by a single transaction; no duplicate tier, no wrong path upgrades, no more than one active path. Keep fair fallback when the player changes organs. Use seeded RNG tests.

## 7. Action descriptor binding and tier activation contract
- Each `ActionPathDefinition` must include concrete operations for Z T1/T3, X T2, C T2/T3. For cards with an effect described under Z's T3 that actually modifies persistent projectiles/structures, define a typed action operation with duration, maxEntities and cleanup.
- T3 **inherits** T1 and T2 unless text explicitly replaces the previous attack type. Example: 'Z becomes shotgun' replaces base projectile with 3-shot, then T3 replaces with 5-shot, never stacks 3+5.
- T2 only adds X and C, preserving T1 Z. All dash modifiers must preserve X's real dash (trajectory, charges, invulnerability) except explicitly shortened or canceled actions in build cards.
- Channel/charge effects: Z hold has priority over hold-to-repeat only for explicitly charged/channelled builds (e.g., 뼈 저격수, 채찍 회오리). Normal Z hold keeps auto-repeat.
- No extra keys for alternate modes; context (range, stack, mark, attack cadence, dash window) determines variation. Show clear telegraphs and optional HUD counters.
- C cooldown governed by arm’s equipped `specialAt` and `cooldown`; morph may modulate effects but not silently remove cooldown.
- AI/hunter: morph use must be bounded by readable windup and explicit range. Upgrade save records to v2 only after back-compat tests with v1.

## 8. Visual and UX contract
- Each tier award: brief text `Z 변화: … / X 변화: … / C 변화: …`, with preview geometry. Use Enter selection, arrows navigate, Esc pause rules unchanged.
- Display `PATH_XX` name, current tier and stack/window indicator when relevant (blood ammo, echo charges, mine count, poison stacks, cadence).
- Attack silhouettes must be readable: arc slash = curved ribbon, precise thrust = thin line, charged shot = expanding reticle, ground line/mine = floor indicator, echo = translucent character, summons = small silhouettes.
- Render enemy attacks over build FX, allocate separate layer or priority so incoming telegraphs aren't obscured.
- Performance budgets on 160 enemies / 350 projectile config; large build chains should not grow unbounded. Draw reduction must never remove gameplay hit detection.

## 9. Test plan (mandatory)
1. **Data tests:** 32 unique path IDs, 8 families × 4, all organ references resolve, all operation names supported, all tier descriptors include expected changed actions; no duplicate declarations.
2. **Tier tests:** T0 Z/X/C baseline, T1 modifies only Z, T2 modifies X+C, T3 modifies Z+C; each path exact four-slot requirements and reward gating.
3. **Control tests:** arrow diagonal normalization, Z hold semantics, X dash timing, C cooldown, all UI keyboard focus, no WASD or mouse needed.
4. **Combat tests:** shape hitboxes vs walls; no backward auto-target; attacks not double-hitting same target except authorized tick. Charged vs repeated attack behavior.
5. **Safety:** max mine/summon/line/echo/shot caps; chained explosion and attack clone cannot recursively trigger without bound; dot internal cooldown.
6. **Swap/save:** dropping a required organ deactivates path, no phantom listeners; re-equipping restores; invalid legacy ID falls back to T0; old death saves still load.
7. **AI:** hunters use safe subset or documented baseline with telegraphed morph, no crash on old records.
8. **Regression:** `npm test`, `npm run check`, `npm run build:pages`, `npm run build:standalone`.
9. **Scenario:** one deterministic scenario per build (32), assert T1/T2/T3 distinct effects and at least one path-specific limitation; at least 4 automated browser-level action animation checks when browser harness available.
10. **Design acceptance:** each completed build produces **a new player decision** (when to attack, how long to charge, where to place lines, when to dash, whom to mark, when to cash stacks), not just improved numbers.

## 10. Sequenced Codex implementation roadmap
- **A — Audit & contract:** compare current data/core/render/UI/tests against v1.3 + v2.0, document gaps, add action-path registry schema and validator; no gameplay regression.
- **B — Action resolver:** shared typed operations, action lifecycle, conditional morph routing, combat event safety, view-layer rendering hooks, persistent entity cleanup; unit tests.
- **C — Four vertical slices:** implement PATH_01 (area melee), PATH_06 (charged sniper), PATH_17 (dash echoes), PATH_25 (summon companion). These cover geometry, charge, dash and autonomous actors.
- **D — Existing organ family completion:** add remaining v1.3 planned organ IDs including 2 new arms, 3 new backs, 4 new hearts, 4 new eyes. Retain current organ effect semantics and compatibility.
- **E — The remaining 28 paths:** process families in 4-path batches; add deterministic tests for each.
- **F — Tier reward/UI/saves/hunter:** keyboard-only tier rewards, previews, build display, v1 compatibility, hunter telegraphs.
- **G — Balance/performance:** 5–8 minute progression, boss telegraph legibility, FPS, bounded pooled entities and release builds.
- After each phase list changed files, actual tests run, failing cases, observed gameplay limitations and next work. **No claiming all 32 implemented until each automated scenario passes and gameplay actually presents the action morphs.**

## 11. Definition of Done
- 32 paths accessible in run via valid prerequisite equipment and selectable T1/T2/T3 upgrades.
- Z behavior changes at T1 and again at T3; X gains one meaningful contextual feature at T2; C gets changed at T2 and T3 for every path.
- Four action families differ in **player inputs and spatial tactics**, no extra keys, active combat remains essential after auto organs ramp up.
- No missing asset or scripted dependency prevents starting with placeholder geometry; keyboard UI works.
- No unbounded recursive hits/summons/mines/projectiles. Old saves + existing hunter still work.
- CI and release scripts pass; progression and cooldown are tunable in plain data.

## 12. Known design assumptions and contradictions to resolve
- Paths currently require exact four-organ match for T3. With 4 slots and 32 paths this is a large loot constraint; implement **path-aware candidate weights and debug override**, then playtest. Do not hide 32 paths behind unreachable RNG.
- The old spec allows only 2 mutations per organ, 3 adaptations; preserve limits. ActionPath is a *distinct* slot and costs 3 levelup picks for T1/T2/T3.
- In PATH_03 manual rhythm input is **optional** and Z hold remains viable; do not turn it into the discarded Q/E/F combo requirement.
- In PATH_26 HP-drain C cannot kill the user; clamp at 1HP. Successful evade is only a real attack negated during X invulnerability.
- `EYE_WEAK`, `EYE_INFECTION`, etc. are new and may need naming alignment in v1.3. The stable IDs defined above are canonical in v2.0; write migration aliases only when needed.
- Pull/launch effects are never allowed to drag bosses through walls or immobilize them; replace with stagger meter or bonus damage.
