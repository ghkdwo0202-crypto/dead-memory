# KAGE//IN — 스타일리시 인술 조합 액션 로그라이크
**GAME DESIGN + CODEX IMPLEMENTATION SPEC v3.0** · 2026-11-01

> **최우선**: 이것은 MEAT MARKET의 생체 이식 세계관과 빌드 축을 **대체하는 새 게임 방향**이다. 기존 JavaScript/Canvas 코드와 배포 파이프라인은 가능한 한 재사용하되 세계관/기관 이름/액션 빌드를 그대로 섞지 말 것. 이 문서는 기획·구현 지시이며 개발 완료를 의미하지 않는다.

## 0. 즉시 이해되는 게임 후크
**"인(印) 세 개를 맺어 인술을 만들고, 검격과 회피로 적을 공중에 띄워 인술을 이어붙이는 초고속 닌자 로그라이크."**
가제 `KAGE//IN` (변경 가능). 마을을 침공한 닌자 군단을 돌파해 성 최상층의 수장을 처치한다. 컷신 없이 첫 10초에 적을 베고 첫 인술을 사용한다. 복잡한 혈통/기억/조직 설정 없음.
2D 톱다운; 적/플레이어의 공중 상태는 **가상의 높이 레이어와 그림자**로 표현(실제 플랫폼 점프 게임 아님). 대상: PC 키보드, 게임패드 추후.
플레이 경험: 빠른 이동 → 찰나의 접근 → 3타 검술 → 띄우기 → 공중 추격 → 결인 인술 → 착지 파동 → 회피 취소 → 다음 교전.

## 1. 핵심 설계 우선순위
1. **인술 없이 Z/X/Space만으로도 재미있는 액션**: 짧은 검격 콤보, 유효한 피격 경직, 이동 압박, 적 공격 전조, 적중 확인, 대시 취소, 공중 추격.
2. 인술은 피아노 건반처럼 조작을 방해하는 보조 미니게임이 아니라, 전투 사이 빈틈에 3개 인을 맺는 **전술 선택**. 인술 미사용으로도 일반 몬스터 처치 가능.
3. 인술 반응이 시각 효과만이 아니라 **적의 위치/고도/속성 상태/다음 행동 선택**을 바꿔야 한다.
4. 20개 인술이 모두 단순 다른 색 폭발이 아니라 투사체, 장판, 돌진, 띄우기, 묶기, 반격, 추적, 격추, 고유 리소스 등 역할을 가진다.
5. 마우스·WASD 이동·Q/E/F 콤보 금지. 방향키를 유지.

## 2. 조작 설계 — 기존 약속 + Invoker식 입력
| 입력 | 기능 | 판정 |
|---|---|---|
| ↑ ↓ ← → | 8방향 이동/바라보기 | 대각선 정규화 |
| Z | 기본 검격 / 길게 누르면 반복 | 공중에서 공중 검격 |
| X | 대시/회피 | 방향키 입력 없으면 마지막 바라본 방향 |
| Space | 점프·공중 추격 | 지상에서 점프, 띄운 적 근처에서는 방향키 + Space로 자동 추격 |
| A | 화인(炎) 입력 | 이동 없이도 입력 가능 |
| S | 수인(水) 입력 | 결인 시 기존 공격 큐 방해 없음 |
| D | 뇌인(雷) 입력 | 좌측 3키 |
| F | 풍인(風) 입력 | 좌측 4키 |
| V | 결인 확정(Invoke) / 인술 슬롯 전환 | 3개 인이 있다면 신규 인술 생성; 없으면 저장된 인술 슬롯 전환 |
| C | 준비된 인술 발동 | C 쿨다운이 아니라 해당 인술 고유 쿨다운 |
| Enter | 보상·메뉴 확인 | 방향키로 선택 |
| Esc | 일시정지/취소 | 전투 중 정지 |

**핵심 UX:** 세 인을 모두 입력하면 자동으로 레시피 미리보기. V를 눌러 준비 인술을 2개 중 앞 슬롯에 저장, 기존 앞 슬롯은 뒷 슬롯로 밀린다. V를 빈 입력 상태에서 짧게 누르면 앞/뒤 슬롯이 교대된다. C는 현재 앞 슬롯 인술 즉시 발동. 준비된 인술이 없는 상태의 C는 기본 4초 쿨다운 작은 표창 투척, 절대 공백 입력 아님.
**인 입력**: 마지막 3개를 유지하는 FIFO 링버퍼, 4번째 입력부터 가장 오래된 인 제거. V 확정 후 버퍼 비움. **조합은 순서와 무관한 다중집합** (FFF, FFW, WFF 모두 같은 인술), 인보커처럼 기억/선택이 있지만 조합 난도를 불필요하게 늘리지 않는다. 장착 인술은 사망/런 리셋 전까지 슬롯에 보관; V 재호출이 이미 저장된 인술을 중복 넣지 않고 첫 슬롯으로 당긴다.
**조작 숙련도**: 초반에는 A(화), S(수)만 열어 4개 조합부터 시작, D(뇌), F(풍) 단계적으로 개방하는 *접근성 튜토리얼 옵션* 지원. 정식 런의 레시피 잠금은 별도 보상 시스템과 분리한다. 화면 하단 큰 A/S/D/F 인디케이터, 3개 인 슬롯, 2개 준비 인술과 각각 쿨다운 표시. Z/X/Space/C는 손가락 동선이 부딪히지 않도록 키 반복·버퍼 우선순위 설계. 키 리맵 제공은 권장, 기본 설정은 유지.
**조작 리스크**: A/S/D/F/V/Space/Z/X/C는 액션이 많으므로 한손 입력 실험 필수. Z/X/C 우선, 입력 버퍼 0.15초, 결인 1개당 키다운 이벤트만 인정(키 홀드 반복 무시). 공격 중 결인 입력 허용하되 결인 자체는 피해·무적·캔슬을 부여하지 않는다. V/C 동시 입력은 V 준비 처리 후 C 사용하도록 결정적 순서. 120Hz 반복에도 한 키다운 1회.
**발동 시점**: 결인(A/S/D/F)은 공격/대시 중에도 가능, V는 공격 recovery 후 실행 가능하지만 0.2초 버퍼, C는 공격의 취소 가능 구간 또는 공중에서만 즉시 실행, 그렇지 않으면 0.2초 버퍼. 일부 인술은 C 발동 후 짧은 경직을 가진다. 인술이 피격 시 버퍼 소실되는 룰은 UI에 표시.

## 3. 핵심 액션 — 닌자 액션이 지루해지지 않게 하는 필수 요소
### 3.1 기본 검술 Z (정확한 애니메이션 상태)
- 지상 기본 3타: Z1 0.08/0.07/0.14초, Z2 0.09/0.07/0.17초, Z3 0.11/0.09/0.20초 [windup/active/recovery].
- 1·2타: 전방 110도/90px, 진행 방향 자동 보정 ±50도. 3타: 145도/110px, 소형 적 띄우기, 정예는 경직 게이지 +25, 보스는 +8.
- 연속 입력 보유 0.19초, Z 홀드 기본 연타 지원(정확한 박자 입력 강제하지 않음). 3타 종료 시 짧은 틈. 적중하면 0.045~0.075초 히트스톱(플레이어·적·카메라 분리), 피격 강도별 화면 흔들림 작은 범위.
- 적 한 타당 1회 피격; 공격 중 방향 고정 0.10초, 무조건 뒤쪽 적에게 자동 돌아서지 않음.
- 기본 공격 리스크: 모든 공격 취소 가능하지 않음. Z1/2 recovery 이후 X 캔슬, Z3은 마지막 활성 끝 0.06초 뒤에 X 캔슬. C의 공격 캔슬은 인술별 데이터로 제한.

### 3.2 X 대시와 스타일
- 0.22초 이동/0.14초 무적, 2충전/2.3초 회복 (조정값); 적 관통 허용, 벽/장애물 관통 금지.
- **정확한 회피**: 실제 적 공격이 대시 무적으로 무효화됐을 때 단일 attackInstanceID 당 1회만 `PerfectDodge` 발생. 성공 시 0.7초 '반격 창' 오픈, 다음 Z는 60px 전진 찌르기 또는 공중에서는 추격 베기로 변환.
- 단순 X 연타가 인술 자원/특수 연계의 고점을 얻지 않도록 실제 회피 성공과 구분.
- 회피 시 2~3프레임 잔상, 짧은 시간 저속 효과는 플레이어의 성공 회피에서 0.12초 **연출용**만 허용. 네트워크 타임스케일 없는 싱글플레이 기준.

### 3.3 Space 점프/공중 추격/격추
- "공중"은 독립 높이 `airHeight`(0~1), `airVelocity`, `juggleUntil`의 2.5D 게임플레이 레이어. 실제 물리 점프/높낮이 충돌은 없음. 발밑 그림자로 원래 바닥 좌표 유지.
- Space 지상 점프: 0.52초 체공, 수평 이동 가능. 공중에서 Z 사용 시 공중 2타, 두 번째 타는 적을 살짝 앞으로 밀어냄. 기본 점프 무적 없음.
- 적이 Z3/풍인술에 떠 있으면 근처 220px 내 방향키 + Space로 **공중 추격 100px** 허용(기본 1회/공중 연계), 가장 가까운 전방 떠있는 적 대상. 적의 공중 상태는 소형 최대 1.2초, 정예 최대 0.45초, 보스 실공중 불가(경직 축적으로 환산).
- 공중에서 C를 사용 가능한 레시피는 공중에서 즉시 발동하고 일정한 수평 마찰; 지상 전용 인술은 공중 중 누르면 0.2초 보류 후 불발이라면 확실한 UI 피드백.
- 착지 강하: 공중 Z 두 번째 타 후 X 없이 ↓+Z (아래 이동과 공격) 때 바닥 방향 충격파를 **선택적으로** 발동, 단 ↓+Z가 모든 상황에서 강제 강하가 되지 않도록 '공중 2타 후 0.3초' 조건. 방향키는 손에 익힌 이동이므로 방향 입력이 추가 스킬 키가 되는 위험을 튜토리얼에 명시.
- 공중 콤보 횟수 제한 6히트, 적 띄우기 갱신은 한 대상 1회/2초, 무한 공중 띄우기 금지. 떨어지는 대상은 플레이어가 확인 가능한 착지 그림자 보유.

### 3.4 근접 격투 기술의 명확한 보상
- 적 공격 후 빈틈에 접근하면 Z1 넉백 + Z2 옆각 타격 + Z3 띄우기.
- 근접 명중 3회 누적 시 **기세 1(최대 3)**, '기세'는 인술 피해 +5%/스택 또는 공중 추격 거리 +10px, 5초 미타격 시 1스택 감소. 이는 공격을 강제하는 고리이지 인술 발동의 필수 마나가 아님.
- 기세 3에서 C 사용 시 해당 인술에 고유 '개화' 효과 추가(레시피마다 부가기능. 아래 각 인술의 반응/연계 설명 기반)하며 기세 3 소모. 플레이어의 Z 액션이 후반에도 가치 있게 남도록 한다.

### 3.5 적 전투 가독성
- 일반 5유형: 접근 잡몹, 빠른 측면암살, 원거리 표창, 탱커 방패, 자폭 화약통.
- 정예 3유형: 광역 발도, 돌진 창병, 카운터 방패 닌자(연타 시 반격). 보스는 3페이즈 패턴, 1.2초 이상 사전조짐을 동반한 강공격.
- 전조 > 플레이어 공격 FX 순서로 렌더, 바닥 위험 표시 빨강/주황과 플레이어 인술 색상 구분.
- 보스에 대한 띄우기·끌기·기절은 경직 게이지로 변환. 적 패턴 중 슈퍼아머 일관성 유지.
- 적이 빈틈 없는 추격만 하지 않게 0.3~0.6초 공격 준비, 회복 시간, 측면/뒤 공간 활용. 이탈 공간을 항상 남기는 스폰 규칙.

### 3.6 스타일 판정(점수는 성능을 강제하지 않음)
- Style D/C/B/A/S/SS. 적중, 2종 이상 공격 사용, 공중 추격, PerfectDodge, 상이한 속성 반응마다 상승, 같은 Z만 반복하면 감쇠.
- 스타일 등급은 전투 이펙트·보상 XP 소폭(+0~10%)만 영향. 필수 파밍 최적화로 강제하지 않음.
- 사망/피격 시 일정 감점, 스타일은 초단위 소멸. 실제 게임 실력에 따른 기분 좋은 피드백.
- 후반 웨이브에 160체 이상 중 style 평가가 이벤트 폭증 유발하지 않도록 적중 발생량은 스로틀링.

## 4. 4속성 × 3인 = 20개 고유 레시피
입력 대응: F(화)=A, W(수)=S, L(뇌)=D, V(풍)=F. 아래 F/W/L/V는 **데이터 레시피 기호**이고 실제 키 F는 풍, 혼동 금지. 인은 3회 입력하며 **순서 무관**. 멀티셋 조합 수 C(4+3-1,3)=20. 모든 20가지 정확히 정의하며, 추가 숨은 레시피 금지.
속성 역할: 화=점화/폭발/밀기, 수=젖음/파도/둔화, 뇌=감전/연쇄/추격, 풍=베기/띄우기/끌기. 속성 '상성 +% 피해'는 사용하지 않고 **상태와 공간 조작**이 핵심.
표 아래 타이밍 순서는 windup/active/recovery(s). 쿨다운은 인술별 독립값, C 발동은 전역 쿨다운 0.2초 및 해당 인술 쿨다운을 모두 검사. 시전 불가 인술은 준비 슬롯에 남고 C를 소비하지 않는다.

| 세 인 | 인술 | 계열 | 고유 발동/판정 | 사용 가능한 상태 | 시전 타이밍(s) | CD(s) | 액션 연계/권장 사용 | 안전/한계 |
|---|---|---|---|---|---|---|---|---|
| `FFF` | 화둔·홍련폭 | 화 | 전방 115px 범위 폭발, 점화 3초 | 지상 | 0.16/0.08/0.20 | 5.5 | 타격 적을 밀어내고 마지막 Z로 폭발 연계 | 과열+1; 좁은 범위 |
| `WWW` | 수둔·격류진 | 수 | 전방 220px 파도, 젖음 4초, 약한 적 밀기 | 지상/공중 | 0.14/0.12/0.18 | 6.0 | 적을 일렬로 모아 후속 검격으로 밀착 | 보스 밀기 면역 |
| `LLL` | 뇌둔·천뢰격 | 뇌 | 가장 가까운 전방 표식 대상 낙뢰, 감전 3초 | 지상/공중 | 0.13/0.04/0.26 | 7.0 | 공중 적에게 추가 경직, 공중 추격 콤보 | 전방 보정 70도 |
| `VVV` | 풍둔·진공참 | 풍 | 전방 2갈래 넓은 칼바람, 적 1회 띄우기 | 지상/공중 | 0.12/0.12/0.16 | 5.0 | 첫 적중 시 띄우기 → Space 점프 추격 | 보스 띄우기 대신 강한 경직 축적 |
| `FFW` | 증기폭쇄 | 화+수 | 젖은 적 중심 증기 폭발, 안개 1.5초 | 지상/공중 | 0.12/0.07/0.23 | 6.5 | 수둔 적중 후 즉시 폭발, 공중 격추 | 젖음 1스택 소비 |
| `FFL` | 폭염낙뢰 | 화+뇌 | 붉은 낙뢰가 3회 지연 강하, 점화 대상 추가 타격 | 지상 | 0.18/0.06/0.25 | 8.0 | 접근→Z 점화→X 이탈→낙뢰 | 표식 최대 3, 동일 대상 최대 2회 |
| `FFV` | 화염용권 | 화+풍 | 전방을 이동하는 불꽃 회오리 2.0초 | 지상/공중 | 0.15/0.12/0.20 | 7.0 | 회오리와 나란히 이동하면서 적 몰기 | 동시 1개 |
| `FWW` | 열수분출 | 수+화 | 발밑에서 전방으로 3번 솟는 열수 기둥 | 지상 | 0.17/0.09/0.22 | 6.0 | Z로 띄운 적을 반복 공중 타격 | 같은 대상 0.28초 타격 간격 |
| `WWL` | 도전수옥 | 수+뇌 | 젖은 적 최대 3명을 잇는 감전 수류탄 | 지상/공중 | 0.16/0.07/0.21 | 7.5 | 젖음 보급→전기 체인→돌진 마무리 | 한 연쇄 최대 3명 |
| `WWV` | 빙결수리검 | 수+풍 | 전방 회전 얼음표창 3개, 둔화와 짧은 발 묶음 | 지상/공중 | 0.11/0.10/0.17 | 5.5 | 빙결 틈에 접근해 다단 검격 | 보스는 둔화 25%만 |
| `FLL` | 열뢰창 | 뇌+화 | 정면 좁은 고속 관통 뇌창, 과열 대상 폭발 | 지상/공중 | 0.18/0.04/0.24 | 7.0 | 모아둔 적을 일직선으로 꿰뚫기 | 관통 5개체, 시야 장애물에 소멸 |
| `WLL` | 뇌수쇄도 | 뇌+수 | 젖음 대상에 연쇄 전격 장판 2.5초 | 지상 | 0.16/0.10/0.21 | 7.5 | 장판에 적 유도→칼날 마무리 | 장판 2개 한도, 타격 틱 ≥0.5초 |
| `LLV` | 순뢰보 | 뇌+풍 | 시선 방향 140px 무적 아닌 초고속 베기 돌진 | 지상/공중 | 0.08/0.12/0.18 | 6.0 | X 회피로 적 뒤 확보→순뢰보→공중 연계 | 벽 관통 불가, 시전 중 첫 0.07초만 무적 |
| `FVV` | 열풍쇄 | 풍+화 | 전방 160도 공기 압축 후 화염 절단 2회 | 지상 | 0.13/0.08/0.20 | 6.5 | 적을 한쪽으로 몰고 넓은 범위 두 번 절단 | 넉백 보스 제한 |
| `WVV` | 한풍질주 | 풍+수 | 짧은 100px 전진과 얼음 궤적 1.7초 | 지상/공중 | 0.10/0.13/0.18 | 6.0 | 궤적에 적을 묶고 역방향 Z로 공중 추격 | 경계/벽 자동 정지 |
| `LVV` | 풍뢰선 | 풍+뇌 | 전방 2개 바람선 사이 2회 전기 칼날 교차 | 지상/공중 | 0.12/0.09/0.19 | 6.0 | 적 공격 유도 후 교차선 위로 회피 | 선은 최대 2개 |
| `FWL` | 멸진뇌폭 | 화+수+뇌 | 젖음·점화를 순서 없이 모으고 전격 기폭하는 강력한 처형 인술 | 지상 | 0.21/0.10/0.28 | 10.0 | 상태 준비→감전 폭발→Z 추가 베기 | 보스 즉사 없음, 폭발 최대 320% Z 기준 |
| `FWV` | 환류염무 | 화+수+풍 | 2초간 회전하며 화염과 증기의 이중 원 궤적 생성 | 지상/공중 | 0.17/0.22/0.24 | 9.0 | X로 원 궤적을 가로질러 적을 모으고 점화 | 2개 원, 이동 80% |
| `FLV` | 뇌화비연 | 화+뇌+풍 | 전방 적 최대 3명 사이 전격 화염 3연속 발도 | 지상/공중 | 0.14/0.18/0.22 | 9.5 | Z 공중 띄우기→추격→3연속 발도→착지 | 뒤쪽 자동추적 금지, 전방 120도 |
| `WLV` | 천우뇌옥 | 수+뇌+풍 | 젖은 적을 중심으로 2.5초 폭풍 감옥, 감전과 약한 끌기 | 지상 | 0.22/0.10/0.28 | 10.0 | 군중 구속→Space 공중 콤보→C로 피니시 | 보스 끌기 면역, 감옥 1개 |

### 4.1 인술 속성 연쇄 처리(고정 규칙)
- `Wet`(젖음): 4초, 최대 1중첩, 뇌속성 최초 적중 시 감전 확산 1회 후 Wet 소모(해당 레시피가 Wet 재사용을 명시했다면 우선순위 override). 젖음은 시각적으로 푸른 물방울/바닥 반사.
- `Burn`(점화): 3초, 최대 3중첩. 매 0.5초 도트, 풍속성 적중 시 1회 화염선 확산. 뇌속성 적중 시 과부하 소형 폭발(대상당 0.7초 ICD).
- `Shock`(감전): 3초, 최대 2중첩. 두 번째 중첩 시 0.3초 일반 적 경직, 보스는 8 경직 게이지. 물 적중 시 Wet 전도 효과를 우선한다.
- `WindMark`: 2초, 풍 인술은 적을 살짝 띄움/끌기; 젖은 적에게 풍 인술을 맞히면 1초 둔화(보스 25% 상한).
- `Launch`: 공격 상태 아닌 움직임 변화; 적당 공중 판정 제한, 보스 경직 변환.
- 반응 처리 우선순위: 직접 피해 → 상태 적용 → 반응 판정 → 대상 이동/공중 → 처치 → 보상/스타일. 한 `chainRoot`당 동일 pair reaction 최대 1회.
- **인술 자체의 20개 레시피와 속성 반응은 별개**. 예: WWW 수둔을 적중시키고 LLL 뇌둔을 발동해 Wet→Shock. FWL 혼합 인술은 준비 없이 상태 3개를 공짜로 붙이는 것이 아니라 독립 10초 CD 인술이다.
- 동시 반응 제한: 단일 적에 최대 2개의 반응/0.5초, 반응은 자체 반응을 트리거하지 않음. 플레이어가 순서/표적을 정하는 선택을 남긴다.

### 4.2 기세 3 개화 효과의 공통 원칙
- 인술에 사전 정의된 `bloom` operation 1개를 부착한다. 기술의 판정 모양 또는 타이밍이 달라져야 하고 단순 계수 상승만 허용하지 않는다.
- 범용 개화 예시: 화둔은 지연 잔불 2개, 수둔은 양측 파도 추가, 뇌둔은 다음 표식에 낙뢰 1회, 풍둔은 착지 칼바람 부여. 혼합은 재료 속성 2개 중 우선 태그에 맞는 한 가지. 데이터 테이블에 명시.
- 기세가 3 미만인 일반 인술도 완전한 기능. 개화는 선택적 고점.

## 5. 액션 중심 12개 빌드 (레시피가 유닛, 빌드는 전투 방식)
**한 런의 빌드 구성**: 2개 기억 슬롯(인술 2개) + 1개 검술 스타일 + 1개 회피 변형 + 2개 인술 진화 패시브. 인술은 영구 배우는 스킬이 아니라 3인+V로 언제든 준비 가능하지만, 런에서 잠금 해제된 계열/변형에 따라 위력이 달라짐. **20개 인술은 같은 런에서 모두 조합 가능**, 빌드는 2개 자주 쓰는 인술과 강화 동작의 선택으로 성격이 달라짐. 엄격한 "4개 기관 조합" 없음.
기본 검술 스타일: 거합(충전), 연참(빠른 4타), 쌍검(부채꼴), 체술(근접 띄우기). 기본 스타일 변경 보상으로 선택 가능.
회피 변형: 잔상(지연 베기), 회전(회피 종료 광역 검격), 추격(표식 적 방향 자동 보정), 반격(PerfectDodge 후 칼날). X 이동/무적 기본 룰 유지.
인술 진화 패시브: 연쇄, 분열, 장판, 추적, 압축, 띄우기 증폭, 격추, 공중 연계, 재사용 감소, 개화 연장 중 2개 선택; 일부는 상호 배타. 보상 UI에 사전 효과/거래 비용 표시.

| ID | 빌드 | 주 인술 2개 | 검술/회피 | 초기(1~3분) → 중기(3~6분) → 완성(6~8분) | 플레이 선택 |
|---|---|---|---|---|---|
| B01 | 번개 유령 | 순뢰보/뇌화비연 | 연참/잔상 | 표식 검격 → 잔상 돌파 → 공중 3연속 발도 | 뒤로 돌아가는 진입각 |
| B02 | 화염 거합 | 홍련폭/화염용권 | 거합/회전 | 충전 절단 → 불길 동선 → 용권을 따라 연속 베기 | 긴 준비와 이탈 선택 |
| B03 | 파도 검객 | 격류진/빙결수리검 | 쌍검/추격 | 젖음 생성 → 밀기+빙결 → 붙잡힌 적 공중 추격 | 몬스터 밀집 재배치 |
| B04 | 폭풍 살수 | 진공참/천우뇌옥 | 체술/반격 | 띄우기 → 공중 연계 → 폭풍 감옥 격추 | 띄울 적 선별 |
| B05 | 증기 암살자 | 증기폭쇄/증기계열(열수분출) | 거합/잔상 | 수인 준비 → 증기 엄폐 → 단일 거합 격추 | 공격 전 위치 숨김 |
| B06 | 기뢰 참격 | 폭염낙뢰/순뢰보 | 쌍검/추격 | 점화 베기 → 낙뢰 표식 → 돌진 폭발 | 표식 타이밍 |
| B07 | 빙풍 무희 | 한풍질주/빙결수리검 | 연참/회전 | 수리검 둔화 → 얼음 궤적 → 빠른 회전 베기 | 궤적 안팎 이동 |
| B08 | 수뢰 연결자 | 도전수옥/뇌수쇄도 | 쌍검/반격 | 젖음 전파 → 전격 체인 → 장판·격추 | 적을 선으로 묶기 |
| B09 | 충격 체술가 | 진공참/열수분출 | 체술/추격 | Z3 띄우기 → 공중 추격 → 지상 열수 마무리 | 공중 타격 횟수 |
| B10 | 화산 지배자 | 홍련폭/화염용권 | 거합/회전 | 점화 → 불길 장판 → 용권으로 집결 폭발 | 지형 유도 |
| B11 | 낙뢰 카운터 | 천뢰격/폭염낙뢰 | 연참/반격 | 정확한 회피 → 반격 창 → 3회 낙뢰 | 적 공격 전조 읽기 |
| B12 | 질풍 창수 | 풍둔 회귀륜 대체: 진공참/풍뢰선 | 쌍검/잔상 | 칼바람 선 → 회피 잔상 → 교차 전기 칼날 | 두 공격선 교차 |

**빌드 설계 보정:** 기존 기획에서 `빙결수리검` 등 레시피 이름을 UI에 노출하고, 모든 빌드는 반드시 20레시피 표에 존재하는 정확한 인술 ID 두 개로 매핑한다. B12의 주 인술은 진공참/풍뢰선 두 개로 확정. 빌드 중첩 패시브만으로 별도의 주문을 생성하지 않음. 강력한 빌드가 나와도 Z·X·Space의 효용이 사라지지 않아야 한다.

## 6. 성장·런 구성
- 초기 5~8분 프로토타입, 검증 후 12~18분 런으로 확장. 0~1분: Z/X 기본 조작과 화/수 2인. 1~3분: D/F 입력 해금(튜토리얼에서 단계 개방), 1개 검술 스타일, 1개 인술 각인. 3~5분: 2개 기억 슬롯과 속성 반응, 공중 추격. 5~8분: 회피 변형/진화 패시브·보스.
- 레벨업 3택: 검술 스타일/회피 변형/인술 진화/기세 효율/HP 선택지. 인술 레시피의 기본 기능은 해금 후 모든 조합으로 접근 가능해야 하며, 특정 주문을 얻지 못해 아무것도 못 쓰는 RNG 금지.
- 성장의 핵심은 `스킬이 더 세짐`이 아니라 `검격 패턴/추격 타이밍/회피 보상/인술의 지형 효과가 바뀜`. 최초 보상 90초 이내, 4분 내 눈에 띄는 2종 액션 변화(목표값).
- 유저가 20개의 조합을 암기할 필요 없도록 인술 도감(F1 선택적), 현재 3인 조합 미리보기, 즐겨찾기 2개, 인술 슬롯 아이콘과 4색 링 UI 제공. F1은 메뉴/도감용만, 전투 액션 키 아님.
- 플레이어가 결인하려다 피격되더라도 인 입력은 유지, V 시전 준비는 피격 시 취소될 수 있으나 3인 링버퍼는 유지(실패 스트레스 감소).
- 메타 성장: 속성/인술 선택 폭과 특수 연출 언락 중심, 원시 공격력 무한 성장 금지.

## 7. 데이터/시스템 계약 (JS + Canvas)
```ts
type Element = 'fire'|'water'|'lightning'|'wind';
type SealInput = {element:Element; timestamp:number};
type NinjutsuDefinition = {
 id:string; recipe:string; name:string; tags:string[];
 casting:{allowedStates:string[];windup:number;active:number;recovery:number;cancelFrom:number};
 cooldown:number; targeting:{mode:string;coneRad:number;range:number;lineOfSight:boolean};
 operations:ActionOperation[]; bloom:ActionOperation[]; maxEntities:number;
 visualId:string; audioId:string; aiTelegraphId:string;
};
type SealState = {ring:Element[];invoked:[string|null,string|null];selectedSlot:0|1};
type ActorCombatState = {
 combatState:'ground'|'jump'|'air-combo'|'landing'|'dash'|'stagger';
 airHeight:number;airVelocity:number;juggleCount:number;momentum:number;
 comboIndex:number;comboExpiresAt:number;bufferedInput: string|null;
 styleRank:string; perfectDodgeWindowEnd:number;
};
type NinjutsuStatus = {type:string;stacks:number;expiresAt:number;sourceId:string};
type ReactionEvent = {rootId:string;attackInstanceId:string;sourceId:string;targetId:string;
 reactionType:string;depth:number;triggeredPairs:string[];};
```
- Source `src/core.js` combat simulation, `src/data.js` definitions, `src/render.js` FX/HUD overlay, `src/game.js` keyboard mapping, `tests/` seeded tests; use a new `src/ninjutsu.js` if needed and keep simulation headless.
- typed operation interpreter, no eval/arbitrary expressions from data. Shared primitives: ArcSlash, DashSlash, AirLaunch, AirFollowup, GroundWave, ProjectileFan, HomingProjectile, ChainLightning, GroundField, DelayedStrike, Pull, Push, LineSlash, OrbitalVortex, Mark, ApplyStatus, ConsumeStatus, Detonate, SpawnAfterimage, ParryWindow, Guard, Channel, ChargedSlash, ImpactWave.
- Update existing generic `CombatEvents` using root/depth + per-target hit nonce. Max chain depth 4, total events 64 per chain; no reaction recursively triggers reaction. One airLaunch per target per 2 sec.
- Existing `meat-market.deaths.v1` must not be parsed as new ninja record; preserve storage key but new `kage-in.deaths.v1` with migration strategy explicit. Hunters from MEAT MARKET not imported; ninja clone rival optional later feature.
- Source/visible hitbox separation. EFX pooling: trail sprites 80, particles 350, projectiles 350, gameplay enemies 160 (configurable), temporal fields 12, active lightning arcs 24. When over budget, reduce FX *only* not actual hitbox count; gameplay cap explicitly enforced in simulator.
- Stable IDs for 20 recipes: `NIN_001` … `NIN_020`, canonical recipe normalized in element order F/W/L/V before lookup (use fixed sort mapping, not locale). Unknown recipe impossible after 3 valid seals; report fallback.
- Avoid JSON parsed from network; no CDN/runtime dependency needed for standalone HTML.

## 8. 연출 및 시각/청각 손맛 명세
**타격감**: 0.05s 히트스톱, 2단 속도감(시작 빠른 잔상→막타 느린 프레임→파편 소멸), 주력 칼날 궤적 70–140ms. 피격 방향 기반 입자; 정예 히트시 잠깐 화면 흔들림(최대 4px/0.12s) 및 낮고 짧은 충격음.
**이동감**: 대시는 분신 잔상을 3장만, 색 대비 명확. Z3 점프 유도는 적 머리 위 작은 띄우기 화살표로 예고. 공중 추격 시 카메라 줌 1.04배/0.18s 이내, 모션 블러 대신 선 궤적으로 표현해 Canvas 성능 안정.
**인술 연출**: A/S/D/F 누를 때 어깨 위 작은 인 문자 및 4색 광륜, 결인 확정 V 때 아주 짧은 0.08s 플래시(전투 중 화면 가림 금지), C 발동 시 인술 마다 독자 실루엣과 색. 화/수/뇌/풍을 명암/형태로도 구별(색각 접근성).
**속성 반응**: Wet→Lightning은 파란 점선→흰 번개 2프레임, Fire+Wind는 주황 소용돌이 선, Steam은 흰 구름 1.5초, 빙결은 바닥 서리 파편. 반응 타이밍과 범위 사전 예고.
**공중 연계**: 적이 떠도 바닥 그림자와 타격 숫자가 서로 붙어 보이게 하며, 위아래 위치를 실제 이동 좌표와 분리. 격추 때 원형 먼지 파동. 보스는 '높이 점프' 시각 연출 대신 경직만 적용.
**카메라**: 플레이어 중심 추적(소프트 스프링), 움직임에 20~30px 리드, 데미지 텔레그래프 화면 안정 위해 최대 흔들림 합산 제한. 플래시 옵션/흔들림 옵션 설정 제공.
**HUD**: HP/2회 대시/기세3/스타일/현재 3인/인술 2칸 및 CD/높이 상태/보스 경직. 키보드만으로 설명 UI. 위험 전조를 배경보다 밝게.
**음향**: 검격 3타별 피치차, PerfectDodge 짧은 특유 금속음, 결인 4속성 차별화 펄스음, V 확정 도장 찍는 소리, 낙뢰 저음·풍 고음, 음향 동시발음 16개 제한. 실제 파일 부재시 간결한 WebAudio 프로시저 생성도 가능하나 음소거 기본/볼륨 설정 제공.
**성능**: 60fps 목표, DOM HUD 최소 갱신, Canvas 도형 플레이스홀더라도 공격 실루엣/타격 피드백을 구현. 애니메이션 프레임 누락돼도 전투 판정은 고정 timestep 기반.

## 9. 보스와 교전 레벨 디자인
첫 보스 **철가면 닌자**: 전방 발도(1.0초 예고), 삼각 표창 투척(0.7초 예고), 후방 순간 접근 *처럼 보이는* 고속 직선 돌진(0.8초 준비, 벽 통과 없음), 체력 40% 이하에 풍둔 폭풍선. 끊김 없는 공격 금지, 패턴 사이 recovery 0.5~1.0초.
보스 전투 기준: Z 직격·X 회피·Space 공중/바닥 포지셔닝·C 인술이 모두 의미 있어야 함. 공중 띄우기로 보스 영구 제어 불가. 단계 2부터 일부 속성 저항은 형식 변형 유도 정도, 특정 속성 빌드 완전 무력화 금지.
맵은 넓은 평지/짧은 담장/건물 지붕 배경 3유형. 지형 높이 점프는 구현하지 않는다. 전투 충돌은 2D 평면.

## 10. Codex 단계별 구현 (한 PR에 전부 금지)
- P0 **코드/게임 분석 및 기획 충돌 명시**: MEAT MARKET 현 버전의 기관/추적자/사망 저장을 보존하면서 새로운 닌자 기획이 무엇을 대체하는지 목록화. 별도 전환 브랜치 권장. 사용자 확인 없이 프로덕션 main 전체 삭제 금지.
- P1 **기본 닌자 액션 단독 프로토타입**: 방향키 이동, Z 3타/홀드, X 회피/PerfectDodge, Space 점프/공중 추격/격추, 작은 적 3종, 히트스톱·잔상·공중 그림자. 인술 없이 단독 플레이 가능해야 다음으로.
- P2 **결인/Invoke/발동**: A/S/D/F 링버퍼, V 준비/슬롯 교대, C 발동, 두 슬롯 기억, 첫 4개 FFF/WWW/LLL/VVV와 보상 UI. 모든 키 홀드·키보드 충돌 테스트.
- P3 **20 인술 완성**: 재료 16개 혼합 인술과 리액션, 히트박스·지형·상태·자원 캡 및 개화 효과. 레시피 20개 확인, 중복 레시피 부정 테스트.
- P4 **액션 빌드 12개**: 4개 검술 스타일, 4개 회피 변형, 인술 진화 패시브/선택지, 시너지 조합, 최소 12개 고유 전투 루프 테스트.
- P5 **연출/UX**: 검격 차별화, 4인 연출, 2스킬 슬롯, 레시피 프리뷰, 공중 도감, S/SS 스타일. Placeholder Canvas에서도 명확히.
- P6 **콘텐츠/빌드**: 정예 3종, 보스, 5–8분 런, 테스트/빌드/Pages, 키보드 UX, 기존 저장 호환.
각 단계 완료시 수정 파일/실행방법/실행된 테스트 로그/수동 플레이 체크리스트/미완료를 보고. 미구현 기능을 완료 선언 금지.

## 11. 필수 자동화/수동 검증
1. 3 seals from 4 element keys -> exactly 20 unique recipes, **all permutations same**. Ring FIFO when >3. V with empty seals toggles; C uses selected ready spell; cooldown independent per spell.
2. Z hold 3-attack loop, Z3 launches eligible mobs; Space air-followup once per sequence; air hits max 6; no boss levitation.
3. X 2 charges, invulnerable 0.14s; PerfectDodge only on actual blocked hostile attack instance. Invulnerability not granted by A/S/D/F/V.
4. Input edge: A+D+Z pressed same frame, moving left/right arrows during Invoke, V+C simultaneous, Space+Z airborne, arrow diagonal, repeated keydown. No lost controls or movement drift.
5. All 20 spell descriptors resolve typed operations, cooldown, allowed states and max entities; 20 dedicated seeded scenario tests.
6. Wet/Fire/Wind/Lightning 2-element interactions work with declared consume/ICD; no unbounded recursive reactions. AoE field cap.
7. Ground/air C activation behavior and attack cancellation is correct. Wall blocks rushes/projectiles. No targeting through walls or behind by default.
8. Style rank increased for diversity but not mandatory to win. Effects do not obscure boss telegraphs, reduced-motion/flash settings.
9. 12 builds have distinguishable gameplay decisions, not just changed damage. Deterministic samples with dummy actor positions.
10. Regressions: `npm test`, `npm run check`, `npm run build:pages`, `npm run build:standalone`; change scripts only where necessary, inspect contents before replacing.
11. New storage key, previous MEAT MARKET saves still untouched; no crash on legacy storage entries.
12. Browser smoke: real keyboard controls and Canvas visible effect/air shadow/recipe UI, manual tests if Playwright unavailable.

## 12. Definition of Done
- 기본 Z/X/Space만으로 3종 적과 전투 가능, 피격/경직/회피 타이밍이 느껴짐.
- 4개 속성 인 3개로 20개 인술을 만들고 2슬롯 저장 후 C 발동 가능; 외워서 조작하는 깊이와 UI 검색 편의 공존.
- 인술마다 판정 모양·움직임·상태/고도·적 대응이 구분됨.
- 12개 빌드가 지상/공중/대시/인술을 상호 연결하며 실제로 다르게 움직임.
- 60fps 목표 안에서 명확한 검격 흔적, 히트스톱, 분신, 대시, 낙뢰, 파도, 장판, 공중 그림자 표현.
- 키보드 전용·마우스 불필요. 기존 게임은 별도 브랜치에서 보존되고 main은 사용자 검토 전 변경 없음.
