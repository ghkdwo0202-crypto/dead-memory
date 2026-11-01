# MEAT MARKET — Build System Implementation Specification v1.3

> Codex handoff document. Status: implementation-ready **prototype specification**, with explicitly marked tuning values. Read the existing project before changing code.

## 0. Mission and non-negotiable constraints

Build a keyboard-only 2D top-down action-survivor roguelike in which the player defeats monsters, grafts their organs, and combines organ mutations into radically different combat styles. The hunter made from a dead player's build is a later feature, **not** the main source of fun.

- Movement: **arrow keys** (8 directions, normalized diagonals).
- Z: primary attack; holding Z repeats at weapon attack cadence.
- X: directional dash with brief invulnerability.
- C: arm-organ special attack.
- Enter: confirm; Esc: pause/back; arrow keys navigate menus.
- **No mouse requirement, no WASD movement, no Q/E/F combos, no additional organ activation keys.**
- Automatic organs trigger without additional keys.
- Do not replace an existing game engine, language, input architecture, or asset pipeline without approval.
- Inspect the repository first; if the project is empty and no engine is selected, stop and request an engine decision.
- Implement one vertical slice at a time; run available tests and report actual results, not assumed results.

## 1. Gameplay goals and measurable acceptance

1. Within the first 3 minutes the player acquires an organ and feels a mechanical change.
2. By minute 5, two distinct organ interactions can be active.
3. By minute 10, at least one clearly visible synergistic chain can be completed.
4. The player must still benefit from active Z attacks, X dodge timing and positioning after automatic weapons become strong.
5. At least three builds must produce observably different player decisions, not merely different DPS values.
6. A complete test run should eventually last ~15–20 minutes; the first vertical slice may use a 5–8 minute run.
7. All required menus are operable using the keyboard only.

These are design targets, not claims that balance has been validated.

## 2. Player controls and combat behavior

### 2.1 Movement and facing
- Arrow keys move in eight directions; normalize diagonal vectors.
- Preserve `lastNonZeroFacing` independently from movement state.
- Z attack targets a valid enemy inside a **configurable cone relative to facing**; otherwise attack in `lastNonZeroFacing` direction.
- Candidate priority defaults to smallest angular deviation, then distance, then stable entity ID. Do not snap to targets behind the player unless a weapon explicitly allows it.
- Lock attack facing during each strike's active frames to avoid jitter.
- Keep targeting cone/range configurable by weapon and expose debug visualization.

### 2.2 Attacks
- Primary attack phases: windup → active → recovery. Z hold queues subsequent attacks at attack cadence.
- Attack buffering and dash-cancel windows are configurable per weapon.
- C triggers the arm's special if off cooldown; no mana in prototype.
- Attack instances receive stable unique IDs; a target cannot be hit twice by the same instance unless the ability explicitly specifies multi-hit behavior.
- Hits convey damage, stagger, knockback, impact FX and small hitstop; effect budgets must be configurable.

### 2.3 Dash
- X uses current direction or last facing if stationary.
- Initial tuning: 0.22s duration, 0.16s invulnerability, 2 charges, 2.5s recharge per charge.
- `SuccessfulEvade` fires **only** when an actual hostile hit is prevented by dash invulnerability, once per hostile attack instance. Merely pressing X is not a successful evade.
- Dash-cancel and input buffering behavior must be explicit in the state machine.

## 3. Build architecture

Three layers:

1. **Organs** (four exclusive equipment slots): ARM (primary + special), BACK (automatic weapon), HEART (core passive), EYE (targeting/conditional passive).
2. **Organ mutations**: maximum **two per equipped organ**; organ-specific compatibility; one copy of a unique mutation per organ by default.
3. **Global adaptations**: maximum **three active**; apply build-wide modifiers with clear costs.

Maximum equipped build components = 4 organs + 8 attached mutations + 3 adaptations = 15. A viable build must not require filling every slot.

### 3.1 Equipment rules
- Each organ has a stable ID and slot type. Exactly one ARM must always be equipped; other slots may be empty.
- Organ swap is atomic: unsubscribe old effects, remove modifiers and visuals, equip new organ, recalculate stats, subscribe new effects.
- Mutations incompatible with replacement organs must **not silently disappear**: show a keyboard-selectable transfer/refund/replacement choice, or for the MVP automatically refund a mutation selection token and explain the action in UI.
- Mutations are attached to specific organ instances, not globally active by mere ownership.
- Adaptations are global and not tied to organ replacement.
- Changes should be applied via a single build transaction to prevent partially updated state.

### 3.2 Data model (engine-agnostic)
```text
OrganDefinition {
  id, displayName, slot: ARM|BACK|HEART|EYE,
  tags[], stats, primaryAttack?, specialAttack?,
  automaticAttack?, passiveEffects[], targetPolicy?,
  allowedMutationIds[], visualId, aiProfile?
}
MutationDefinition {
  id, displayName, applicableSlotTypes[], requiredTags[],
  forbiddenTags[], eventType, conditions[], operations[],
  internalCooldown, maxProcsPerChain, numericalTuning
}
AdaptationDefinition {
  id, displayName, modifiers[], procRules?, tradeoffs[]
}
BuildState {
  version, organsBySlot, mutationsBySlot[], adaptations[],
  upgradeRanksById, derivedStats
}
CombatEvent {
  eventId, type, sourceId, targetId?, sourceOrganId?,
  attackInstanceId?, chainId, depth, parentEventId?,
  tags[], payload, flags: {isCopied, isSecondary}
}
```
- Definitions are immutable and data-driven (engine resource / JSON / equivalent). Save state contains **IDs and ranks**, not duplicated definition data.
- Use versioned serialization and validation of unknown/removed IDs.
- Keep derived stats recomputable, not authoritative save data.

## 4. Shared tags and event contract

### 4.1 Tags
`MELEE`, `PROJECTILE`, `AREA`, `AUTO`, `BLEED`, `POISON`, `SHOCK`, `SUMMON`, `DASH`, `EXECUTE`, `MARK`, `KILL`, `DIRECT`, `COPIED`, `SECONDARY`.

Tags represent **actual attack/effect capabilities**. Merely equipping a BLEED organ does not make every other organ eligible for BLEED-only mutations.

### 4.2 Events
`OnAttack`, `OnHit`, `OnDirectHit`, `OnKill`, `OnDash`, `OnSuccessfulEvade`, `OnStatusApplied`, `OnProjectileHit`, `OnOrganTriggered`.

- `OnDirectHit` requires a player-initiated primary/special attack; automatic organ hits do not count.
- `OnKill` fires exactly once per enemy death with a deterministically selected kill credit owner.
- Event processing order must be deterministic: base damage → mitigation → status application → death resolution → resulting proc events (with stable ordering by priority and ID).
- Use a bounded queue, not uncontrolled recursive calls. Default max chain depth: **5**; default same effect re-trigger per chain: **1** unless definition overrides.
- Copies carry `COPIED` and cannot trigger another copy by default.
- Multi-hit abilities may specify per-target cooldowns. Do not globally block legitimate multi-hit attacks.
- Record `chainId`, `depth`, `attackInstanceId`, source/target and effect IDs in debug logs.
- Visually cap particles/projectiles without silently deleting already committed damage calculations.

### 4.3 Status effects
- BLEED: damage over time, up to 5 stacks.
- POISON: damage over time, up to 10 stacks.
- SHOCK: one active shocked state; chain interactions.
- SLOW: strongest modifier wins (do not stack multiplicatively by default).
- STUN: regular enemies briefly disabled; bosses use stagger meter instead of indefinite stun.
- Status definitions separately specify duration, refresh policy, tick interval, max stacks and boss rules.
- Initial `EXECUTE` threshold: target <=20% HP. **Bosses cannot be instantly executed**; use bounded bonus damage instead.

## 5. Content catalogue: organs (22 total)

All numerical parameters below are **initial prototype tuning**; make editable through data.

### 5.1 ARM (4)

| ID | Name | Z attack | C special | Signature / weakness |
|---|---|---|---|---|
| ARM01 | Saw Arm (톱날 팔) | 18 damage, 0.38s cadence, 75 range, 3-hit melee chain | radial spinning cut, 7s CD | 3 consecutive hits on same target apply BLEED; weak vs distant enemies |
| ARM02 | Spike Launcher (가시 발사 팔) | 13 damage, 0.32s cadence, 280 range projectile | fan volley, 8s CD | projectile synergy; vulnerable when surrounded |
| ARM03 | Bone Crusher (골격 분쇄 팔) | 42 damage, 0.85s cadence, 90 range | frontal shockwave, 9s CD | stagger/partial armor bypass; slow |
| ARM04 | Whip Tentacle (채찍 촉수 팔) | 22 damage, 0.55s cadence, 150 range | pull enemies inward, 8s CD | control and grouping; weak single-target DPS |

For ARM01, define whether 18 damage applies per strike and define third-strike bonus explicitly in data; initial default: 18 per strike, third strike 1.3×. A “three-hit combo” counts successful hits on the **same target**, not simply pressing Z three times.

### 5.2 BACK (6)

| ID | Name | Default behavior | Role |
|---|---|---|---|
| BACK01 | Devouring Tentacle (포식 촉수) | 14 damage every 1.0s, prioritizes low-HP enemies | execute/cleanup |
| BACK02 | Parasite Turret (기생 포탑) | 10 projectile damage every 0.7s, prioritizes marked targets | ranged focus |
| BACK03 | Rotating Blades (회전 칼날) | 8 contact damage per target per 0.5s | close defense |
| BACK04 | Poison Sac (독낭 분사기) | 3s poison cloud every 4s; 5 damage/s base | area denial |
| BACK05 | Brood Organ (번식 기관) | spawn minion every 5s, 7 damage per hit, max 3 active | summon swarm |
| BACK06 | Electric Organ (전기 기관) | 12 damage every 1.8s, chains to max 3 targets | crowd chaining |

### 5.3 HEART (6)

| ID | Name | Effect |
|---|---|---|
| HEART01 | Hungry Heart (굶주린 심장) | temporary attack-speed bonus after kills |
| HEART02 | Explosive Heart (폭발 심장) | AoE burst after configurable kill count |
| HEART03 | Clotting Heart (응고 심장) | heal when directly damaging a bleeding enemy; cooldown/cap |
| HEART04 | Overcharged Heart (과충전 심장) | bonus electric damage against shocked targets; cooldown |
| HEART05 | Parasite Heart (기생 심장) | auto-organ hits reduce C cooldown, with per-second cap |
| HEART06 | Undying Heart (불사의 심장) | bonus damage at low HP; healing efficiency penalty |

### 5.4 EYE (6)

| ID | Name | Effect |
|---|---|---|
| EYE01 | Blood Eye (핏빛 눈) | prioritize bleeding targets for automatic attacks |
| EYE02 | Hunter Eye (사냥꾼의 눈) | direct attacks mark targets; auto weapons favor/deal bonus to marked targets |
| EYE03 | Predator Eye (포식자의 눈) | prioritize low-HP enemies |
| EYE04 | Contagion Eye (전염의 눈) | status effects spread to nearby enemies on status-affected target death |
| EYE05 | Weakpoint Eye (약점의 눈) | direct-hit bonuses vs elites/bosses |
| EYE06 | Swarm Eye (군집의 눈) | boost auto attacks based on nearby enemy count, capped |

### 5.5 Concrete starter values for passives (all editable)
- HEART01: +8% attack speed per kill, max 5 stacks, 3s duration refreshed on kill.
- HEART02: burst 30 damage in radius 90 every 8 credited kills; chain kills count but effect cannot trigger itself more than once per chain.
- HEART03: heal 1 HP per qualifying direct hit, max 4 HP/s; not triggered by status ticks.
- HEART04: +8 electric damage on direct hit vs shocked target, 0.5s internal CD per target.
- HEART05: each eligible auto hit reduces C remaining cooldown by 0.15s, max 0.6s reduction per real second.
- HEART06: below 35% HP gain +30% damage, receive 40% less healing.
- EYE02: mark lasts 4s, only one primary marked target; auto attacks deal +20% damage to marked target.
- EYE05: +20% direct damage vs elites and bosses.
- EYE06: +4% auto damage per enemy within radius 160, max +40%.
- EYE04: on status-affected enemy death, transfer one stack of each transferable status to up to 3 nearby enemies within radius 100; each death processes once.

## 6. Mutations (18) and compatibility

**Correction to previous brainstorming:** Some examples mixed mutation and adaptation names, and the initial 12-mutation prototype list was smaller. This specification consolidates **18 concrete organ mutations** and keeps global adaptations separate. Add explicit effect definitions rather than treating all examples as simultaneously available.

| ID | Name | Required capability | Effect | Tradeoff / guard |
|---|---|---|---|---|
| MUT01 | Split (분열) | PROJECTILE | projectile hit emits 2 child projectiles | original projectile -20% damage; child projectiles cannot split again |
| MUT02 | Pierce (관통) | PROJECTILE | +2 pierces | -25% knockback |
| MUT03 | Expansion (확장) | MELEE or AREA | +30% attack area/range | -10% attack speed |
| MUT04 | Focus (집중) | MELEE or PROJECTILE | +30% damage to same target on repeated hits, capped | -20% area/width |
| MUT05 | Return (귀환) | PROJECTILE | projectile returns and can hit again | -15% firing rate; return is separate attack instance |
| MUT06 | Rupture (파열) | status-applying hit | small AoE on status-hit condition | 1s internal CD per target |
| MUT07 | Bleed Spread (출혈 확산) | BLEED | on bleeding target kill spread 1 bleed stack to nearby enemies | -10% direct attack damage on attached organ |
| MUT08 | Poison Growth (독 증식) | POISON | poison cap +5 | first poison tick -20% damage |
| MUT09 | Shock Transfer (감전 전이) | SHOCK | shocked hit arcs to nearby target | -15% single-target shock damage |
| MUT10 | Status Detonation (상태 폭발) | BLEED or POISON or SHOCK | consume up to 3 stacks/charges for AoE burst | consumes buildup; ICD 1.5s |
| MUT11 | Extended Status (지속 강화) | status application | +50% status duration | -10% immediate damage |
| MUT12 | Status Feast (상태 포식) | BLEED or POISON | consume up to 2 stacks to heal 2 HP | max 3 HP/s; consumed stacks cannot deal further ticks |
| MUT13 | Dodge Counter (회피 반격) | ARM or BACK | on SuccessfulEvade emit short-range spikes | 1 proc per hostile attack instance, 1s ICD |
| MUT14 | Afterimage (잔상 공격) | ARM | first Z hit within 0.8s after successful dash copies previous attack at 50% damage | copied hit cannot copy again |
| MUT15 | Execution Haste (처형 가속) | EXECUTE or kill-capable attack | on credited kill +12% attack speed for 2s, max 3 stacks | stack cap |
| MUT16 | Concentrated Assault (공격 집중) | ARM or BACK | consecutive hits on same target +5% damage per stack, max 6 | resets on target change or 2s inactivity |
| MUT17 | Blood Pursuit (피의 추격) | BLEED | +15% move speed while approaching bleeding enemy within 180 | no bonus while moving away |
| MUT18 | Crisis Frenzy (위기 폭주) | BACK | under 30% HP auto-organ cadence +30% | only while under threshold |

### 6.1 Mutation placement rule
- Organ mutations must list explicit compatible organ IDs or applicable slot + required capability tags.
- MUT13 is eligible on ARM or BACK but its generated spike effect is attached to the chosen organ.
- MUT14 is ARM only.
- MUT18 is BACK only.
- No mutation can equip if the target organ lacks the behavior needed to generate its trigger.
- `Focus` and `Expansion` may coexist if both are supported; apply modifiers in a documented deterministic order.
- Global adaptations do not consume mutation slots.

### 6.2 Additional effect operators
To support the eight reference builds without hidden bespoke code, implement these as **organ native behavior or explicit operators**, not as phantom mutation IDs: `EXECUTE_BONUS`, `MARK_TARGET`, `SPAWN_PROJECTILE`, `APPLY_STATUS`, `SPREAD_STATUS`, `HEAL`, `REDUCE_COOLDOWN`, `MODIFY_ATTACK_SPEED`, `TRIGGER_AOE`, `SUMMON`, `TARGET_PRIORITY`, `DAMAGE_MODIFIER`.

## 7. Global adaptations (8)

| ID | Name | Benefit | Cost |
|---|---|---|---|
| ADP01 | Berserker (광전사) | +30% direct attack damage | +20% damage received |
| ADP02 | Agile Predator (기민한 포식자) | dash recharge -25% | max HP -20% |
| ADP03 | Flesh Proliferation (육체 증식) | auto-organ damage +35% | direct attack damage -20% |
| ADP04 | Iron Skin (강철 피부) | damage taken -20% | move speed -15% |
| ADP05 | Chain Instinct (연쇄 본능) | +1 permitted secondary target per chain-capable effect | base direct damage -15%; does not override recursion safeguards |
| ADP06 | Hunting Instinct (사냥 본능) | +35% damage vs marked targets | -15% damage vs unmarked targets |
| ADP07 | Pain Absorption (고통 흡수) | on taking damage +20% attack for 3s | 5s ICD |
| ADP08 | Last Stand (마지막 발악) | once per run survive lethal hit at 1 HP and gain +30% damage for 4s | one activation per run; does not prevent environmental hard-fail events |

- Max 3 adaptations; no duplicate adaptation ID.
- Multiplicative modifiers and additive modifiers must have documented ordering.
- Cap extreme derived stats and expose the caps in data, not hard-coded hidden constants.

## 8. Eight reference builds and test recipes

These are **target synergies**, not guaranteed item drops. A debug build editor must allow direct construction of each recipe for tests.

| # | Build | ARM | BACK | HEART | EYE | Key mutations/adaptation | Player action loop |
|---|---|---|---|---|---|---|---|
| 1 | Blood Butcher (피의 도살자) | ARM01 | BACK01 | HEART03 | EYE01 | MUT07 on ARM01; MUT15 on BACK01; MUT12 on ARM01 if compatible | direct-hit bleed → auto finish → spread/heal → keep close |
| 2 | Spike Storm (가시 폭풍) | ARM02 | BACK02 | HEART05 | EYE02 | MUT02 + MUT01 on ARM02; MUT05 as alternative to one of these | line up piercing shots → split → turret focus → C cooldown reduction |
| 3 | Bone Breaker (골격 파괴자) | ARM03 | BACK03 | HEART06 | EYE05 | MUT04 + MUT03 on ARM03 | dodge telegraph → timed smash → stagger → repeat |
| 4 | Contagion Hive (전염 군체) | ARM04 | BACK04 | HEART02 | EYE04 | MUT08 + MUT10 on BACK04; MUT07 only if a BLEED source is added | pull into poison cloud → spread poison → detonate |
| 5 | Lightning Butcher (번개 도살기) | ARM02 | BACK06 | HEART04 | EYE06 | MUT09 on BACK06; MUT02 on ARM02; ADP05 | gather targets → arc electricity through dense crowd |
| 6 | Dodge Hunter (회피 사냥꾼) | ARM04 | BACK01 | HEART01 | EYE02 | MUT13 on BACK01; MUT14 on ARM04; ADP02 | bait hit → successful dash → counter + afterimage → finish |
| 7 | Living Turret (살아 있는 포탑) | ARM03 | BACK02 | HEART05 | EYE02 | MUT16 on BACK02; ADP03; optional MUT15 on BACK02 | direct hit marks priority target → turret focuses → C more often |
| 8 | Explosive Monster (폭발성 괴물) | ARM01 | BACK03 | HEART02 | EYE06 | MUT03 on ARM01; MUT18 on BACK03; ADP01 | dive into mob → AoE kills → explosive chain |

**Important corrections from earlier concept examples:**
- A single organ has only 2 mutation slots: never list three simultaneously attached to one organ. Where three are suggested, mark one as alternative or attach to another compatible organ.
- `MUT07 Bleed Spread` cannot function in a poison-only build unless a BLEED source is separately acquired.
- `MUT15 Execution Haste` triggers on credited kills; it does not require a literal instant execution mechanic.
- A global adaptation must use its `ADP` ID, not a mutation ID.
- Any reference build that fails compatibility validation must be treated as a **spec bug** and fixed before declaring it complete.

## 9. Progression and reward generation

### 9.1 Level-up
- Enemies drop experience pickups; pickups magnetize near player.
- Level-up pauses combat and shows **three keyboard-navigable** choices.
- Candidate types: equip new organ, swap organ, attach compatible mutation, improve an existing effect, gain adaptation.
- Starting ARM chosen at run start; no run may begin without an ARM.
- 2 rerolls per run; reroll replaces all three offers.

### 9.2 Reward algorithm
1. Inspect empty slots, equipped organs, their capabilities and available mutation slots.
2. Build all valid choices; filter duplicates, incompatible choices and maxed ranks.
3. Weight: early levels favor organ acquisition; mid levels favor synergy; late levels favor upgrades/adaptations.
4. If valid, include at least one choice directly synergistic with current equipment; avoid forcing only synergistic choices.
5. Fill remaining choices with viable alternatives; if fewer than three distinct candidates exist, generate bounded generic upgrades with defined IDs.
6. Use seeded RNG so test runs are reproducible.
7. Apply choice through a transaction and update UI and stats atomically.

### 9.3 Suggested phase weights (tunable)
| Level range | New organ | Mutation | Adaptation | Upgrade |
|---|---:|---:|---:|---:|
| 2–3 | 65% | 20% | 5% | 10% |
| 4–5 | 35% | 40% | 10% | 15% |
| 6–8 | 15% | 50% | 20% | 15% |
| 9+ | 10% | 35% | 25% | 30% |

Weights apply per candidate sampling after validity filtering, not as guarantees. Starting ARM selection occurs before level 2.

## 10. UI and feedback requirements

- HUD: HP, XP, level, dash charges, C cooldown, 4 organ icons, up to 3 adaptation icons, current mutations, run timer.
- Level-up: 3 clear cards, keyboard highlight, slot/compatibility, explicit **effect and tradeoff**, synergy cue.
- Organ swap: show what is lost/refunded before confirmation; keyboard only.
- Damage feedback: direct attacks distinct from auto-organ hits; status effects readable; avoid obscuring enemy telegraphs.
- Build inspection (pause menu): full four-slot loadout, attached mutations, adaptations, derived stats, active interactions.
- Debug: spawn dummy, spawn mob, grant XP, force organ/mutation/adaptation, set seed, toggle target cone display, inspect proc chain logs.

## 11. Hunter integration (later phase)

On player death, save a versioned snapshot: run ID, death ID, equipped organ IDs, attached mutation IDs/ranks, adaptations, relevant combat profile, death time/cause.

A future hunter uses 2–3 recognizable signature interactions, **not** every effect simultaneously. AI profiles reflect melee approach, ranged spacing or dodge counter behavior. Hunter can be spawned in debug mode and should reward an organ/mutation on defeat. This must not block the main build prototype.

## 12. Engineering boundaries

Suggested subsystems, adapted to existing engine:
- Input/PlayerController
- Movement and Facing
- AttackStateMachine / CombatResolver
- TargetingService
- OrganEquipmentService
- MutationService
- AdaptationService
- EventQueue / ProcResolver
- StatusEffectService
- StatAggregator
- XP/RewardService
- RunManager
- HunterSnapshotService (later)
- KeyboardUI and DebugBuildEditor

Keep definition data separate from mutable runtime state. Event listeners must unsubscribe when organs are replaced. Avoid allocations and full enemy scans per projectile frame where engine supports pooling/spatial queries. Separate logical combat resolution from visual effects.

## 13. Implementation milestones

### Phase 0 — Audit
- Inspect engine, language, project structure, current systems, build/run/test commands.
- Identify existing functionality to reuse.
- Produce concise plan and known risks. If engine absent, ask before coding.

### Phase 1 — Keyboard combat slice
- Arrow movement; Z hold attack; X dash; C special; facing cone targeting; one enemy and health/damage.
- Verify no mouse/WASD dependence.

### Phase 2 — Data-driven equipment
- Four slots; ARM01/ARM02, BACK01/BACK02, HEART03, EYE01/EYE02.
- Atomic equip/swap, passive subscriptions, basic UI, stat recomputation.

### Phase 3 — Synergy vertical slice
- BLEED status, `OnDirectHit`, `OnKill`, `OnStatusApplied` event queue.
- Implement MUT07, MUT12, MUT15 and one adaptation.
- Make Blood Butcher fully playable; validate event chain safety.

### Phase 4 — Full content catalogue
- Remaining organs (22 total), mutations (18 total), adaptations (8 total).
- Seeded reward generation, rerolls, all 8 debug-build recipes, clear tradeoffs.
- Build tests for each data entry and every reference recipe.

### Phase 5 — Combat content and tuning
- Four enemy archetypes, elite, boss, difficulty ramp, 5–8 minute short run; tune into 15–20 minute full run later.
- Profile high-density combat, chain bursts and effect budgets.

### Phase 6 — Hunter
- Death snapshot, loading, hunter AI, spawn and rewards.
- Only after core combat and buildcrafting are fun without hunters.

## 14. Automated and manual acceptance tests

### Controls
- Arrow keys move; diagonals normalized; Z hold repeats; X directional dash; C special.
- Arrow+Z, arrow+X and arrow+C work simultaneously.
- No required mouse interactions or WASD movement.
- UI navigation works via arrows, Enter and Esc.

### Equipment
- Exactly one organ per slot; ARM mandatory.
- Equip/swap recalculates stats and event subscriptions once.
- Incompatible mutations do not survive swaps or disappear without refund/choice.
- Each organ has at most two mutations; adaptations at most three.
- Invalid content IDs are handled gracefully.

### Events
- `OnKill` fires once per death.
- `OnSuccessfulEvade` only fires on a prevented hit.
- No repeated damage from same attack instance except explicitly configured multi-hit.
- Copy cannot recursively copy.
- Chain depth/proc caps hold even in multi-kill AoE.
- Status stacks and boss execute rules hold.
- All events have stable IDs and reproducible order with fixed RNG seed.

### Build behavior
- Each of 8 recipes passes compatibility checks and can be assembled in debug editor.
- Blood Butcher: bleeding enemy prioritized, killed enemy spreads bleed, heal capped.
- Spike Storm: piercing and splitting do not recurse infinitely.
- Bone Breaker: heavy stagger and meaningful windup.
- Contagion Hive: poison propagation and detonation without nonexistent bleed source.
- Lightning Butcher: arcs respect target cap.
- Dodge Hunter: no counter proc from empty-space dash.
- Living Turret: marking redirects turret and auto hits reduce C cooldown within cap.
- Explosive Monster: kill explosions chain but stop at defined budget.

### Performance and accessibility
- Benchmark a configurable 100+ enemy test scene (not a guaranteed target FPS without engine/hardware context).
- Distinguish hostile attack telegraphs from player effects.
- Keyboard-only run can start, level up, inspect build, die and restart.

## 15. Reporting contract for Codex

After each phase, report:
1. Implemented functionality (not intended functionality).
2. Files created/changed.
3. How to launch and test.
4. Automated tests executed and their results.
5. Manual tests that remain unverified.
6. Known bugs, balance assumptions and scope deviations.
7. Next phase recommendation.

**Start now with Phase 0 and Phase 1 only. Do not attempt all phases in one pass.**