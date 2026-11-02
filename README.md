# KAGE//IN V5 — 다운로드해서 실행

**[실행 ZIP 다운로드](https://github.com/ghkdwo0202-crypto/dead-memory/raw/refs/heads/downloads/kage-in-v5/downloads/v5/KAGE-IN-V5.zip)** → 압축 해제 → `KAGE-IN-V5.html`을 Chrome/Edge로 열기. Node.js나 localhost 접속은 필요하지 않습니다.

[단독 HTML 파일](https://github.com/ghkdwo0202-crypto/dead-memory/blob/downloads/kage-in-v5/downloads/v5/KAGE-IN-V5.html)은 GitHub 페이지 오른쪽 위 **Download raw file**로 저장할 수도 있습니다.

최신 기준은 [PR #9의 V5 통합 명세](docs/KAGE-IN-V5-PRODUCTION-SPEC-GALLERY.md)입니다. 이전 P3/P4와 MEAT MARKET은 별도 프로토타입입니다. V5 첫 웹 절편은 **[독립 실행 HTML](downloads/v5/KAGE-IN-V5.html)** 을 내려받아 열거나, `npm start` 후 `http://localhost:3000/kage-in-v5/index.html`에서 실행합니다.

[실제 구현 범위·실행·검증·미구현](kage-in-v5/README.md) / [환경 감사와 대체 구현 결정](docs/KAGE-IN-V5-AUDIT.md). Unity가 없는 환경에서 만든 웹 대체 절편이며, 5막·60분 런이나 Q48 전체 구현을 완료한 버전은 아닙니다. 기존 게임과 다운로드는 아래에 그대로 보존합니다.

---

# MEAT MARKET

괴물을 죽이고 신체 기관을 이식하는 **키보드 전용 2D 액션 서바이버 로그라이크** 프로토타입입니다. 기존 DEAD MEMORY의 JavaScript + Canvas 엔진과 배포 구조를 유지하고 초기 [개발 명세 v1.1](docs/MEAT-MARKET-SPECIFICATION.md)에 맞춰 전환했습니다. 이후 확장의 기준은 [Issue #2](https://github.com/ghkdwo0202-crypto/dead-memory/issues/2)와 [PR #1의 개발 명세 v1.3](docs/MEAT-MARKET-BUILD-SPEC-v1.3.md)입니다. 현재 구현과 v1.3의 차이 및 단계별 계획은 [Phase 0 보고](docs/PHASE0-REVIEW.md)에 정리했습니다.

## v0.3 — 빌드를 찍을수록 달라지는 톱날 액션

기본 Z는 **같은 적에게 3타 적중**해야 강화 베기와 출혈이 나옵니다. 레벨업에서 **톱날 운용**을 선택하면 다음 동작이 차례로 열립니다.

1. **돌파 베기:** X 뒤 Z로 짧게 파고들며 공격. 추가 무적은 없습니다.
2. **회수 회전:** 3타 적중 뒤 1.4초 안에 C를 사용하면 주변 적을 끌어모아 마무리합니다.
3. **전투 순환:** 실제 공격 회피 시 C 쿨다운 감소, C 뒤 Z로 빠르게 복귀합니다.

바로 확인하려면 시작 화면에서 **완성형 톱날 액션 미리보기**를 선택하세요. 미리보기는 사망 기록을 저장하지 않습니다. 일반 런은 랭크 0에서 시작합니다. [이번 단계 구현·검증·남은 문제](docs/PHASE1-ACTION-AXIS.md).

## 다운로드해서 바로 플레이

**[게임 ZIP 다운로드](https://github.com/ghkdwo0202-crypto/dead-memory/raw/refs/heads/main/downloads/MEAT-MARKET.zip)** → 압축 풀기 → `MEAT-MARKET.html`을 Chrome 또는 Edge로 열기 → Enter.

`npm run build:standalone`으로 `.local/standalone/MEAT-MARKET.html`을 만들 수 있습니다. 이 파일 하나를 PC로 옮겨 Chrome 또는 Edge로 열면 됩니다. HTML 안에 코드와 스타일이 모두 포함되어 있으므로 플레이할 때 Node.js, 개발 서버, 인터넷 연결이 필요하지 않습니다. `npm run build:download`는 같은 파일과 실행 안내를 ZIP으로 묶어 `downloads/MEAT-MARKET.zip`을 갱신합니다.

## 플레이

GitHub Pages 배포가 완료되면 **https://ghkdwo0202-crypto.github.io/dead-memory/** 에서 설치 없이 플레이합니다. 저장소/주소는 유지하고 게임 이름과 내용만 변경했습니다. PC 키보드가 필요합니다.

| 입력           | 동작                                           |
| -------------- | ---------------------------------------------- |
| 방향키 ↑ ↓ ← → | 8방향 이동 / 메뉴 후보 선택                    |
| Z              | 기본 공격, 누르고 있으면 연속 공격             |
| X              | 이동 방향 회피, 입력이 없으면 마지막 이동 방향 |
| C              | 팔 기관 특수 공격                              |
| Enter          | 메뉴 확인 / 보상 이식                          |
| Esc            | 일시정지 / 허용된 화면 취소                    |

**시작:** Enter → 방향키로 이동하면서 Z → 경험치 조각 수집 → 방향키·Enter로 이식. 5분 후 등장하는 도축장 주인을 처치하면 탈출합니다. 8분이 되면 시장이 폐장합니다. WASD, 마우스 조준, Q/E/F 연계는 사용하지 않습니다. 레벨업을 취소할 수는 없습니다.

## 주요 시스템

- 팔 2종, 등 자동 기관 3종, 심장 2종, 눈 2종과 부위별 외형
- 변이 12종, 호환성 검사, 시너지 보상, 출혈/독/감전/둔화/기절
- 수동 공격 준비/활성/회복, 자동 방향 보정, 입력 버퍼, 회피 취소와 2충전 무적 회피
- 몬스터 4종, 시간 기반 웨이브, 정예 갈고리와 보스 네 패턴
- 경험치 흡수와 키보드 보상 3택, 생존·빌드·피해 통계
- 사망 빌드를 계승하는 추적자와 실제 보유 기관/변이 계승 보상

사망 기록은 같은 브라우저/접속 주소에 최대 8개 저장됩니다. 새 키는 `meat-market.deaths.v1`이며, 이전 `dead-memory.deaths.v1` 기록은 보존하지만 MEAT MARKET 추적자로 변환하지 않습니다. 저장이 차단되면 현재 탭에서만 유지되고 결과 화면에 표시합니다. 일반 추적자는 100초 후 35% 확률로 출현하며, 사망 기록이 있으면 입구 메뉴의 **이전 상품 테스트**로 18초 출현을 켤 수 있습니다.

## 로컬 개발

Node.js 22 이상(검증: 24.19.0)이 필요합니다. 런타임 의존성 설치/API 키 없이 실행됩니다.

```sh
npm start
```

같은 PC의 브라우저에서 `http://localhost:3000`을 엽니다. 다른 포트는 `PORT=3001 npm start`로 지정합니다.

```sh
npm test             # 기존 40개 + 액션 축 19개 테스트
npm run check        # JavaScript 구문 검사
npm run build:pages  # .local/pages/ 정적 산출물 생성
```

선택적 브라우저 검사(별도 임시 프로필, 실제 플레이 기록을 건드리지 않음):

```sh
npm install --no-save --package-lock=false playwright@1.58.2
npm run test:browser
```

실행 중인 개발 서버가 필요합니다. 시스템 Chromium은 `/usr/bin/chromium`을 기본 사용합니다. 다른 경로는 `CHROMIUM_PATH`, 다른 접속 주소는 `GAME_URL`, Playwright 모듈 경로는 `PLAYWRIGHT_MODULE` 환경 변수로 지정합니다. Chromium이 없다면 Playwright 브라우저를 설치하고 실행 파일 경로를 지정하세요.

## 구조와 범위

- `src/data.js`: 기관·변이·상태·적·런 설정 리소스
- `src/core.js`: 헤드리스 게임 시뮬레이션, 입력·공격·회피·전투 이벤트·기관·변이·성장·AI·저장
- `src/storage.js`: 저장 차단/용량 초과 시 현재 탭 기록을 보존하는 저장 어댑터
- `src/navigation.js`: 기존 코드에서 재사용한 시야/BFS 경로 탐색
- `src/render.js`: Canvas 아레나·외형·전조·전투 효과
- `src/game.js`, `src/style.css`, `index.html`: 키보드 메뉴·HUD·브라우저 입력
- `tests/combat.test.js`, `scripts/browser-smoke.mjs`: 규칙/통합/실제 브라우저 검사
- [구현 계획](docs/PLAN.md), [완료 기능·제한·미구현·다음 단계](docs/IMPLEMENTATION.md)

현재는 고정 아레나와 임시 도형 아트로 만든 5~8분 초벌입니다. 장기 밸런스, 정식 미술·음향, 절차적 맵, 돈/빚 메타 성장과 본격 스토리는 다음 범위입니다. 이전 구현 설명은 [DEAD MEMORY 기록](docs/DEAD-MEMORY-IMPLEMENTATION.md)에 보존했습니다.

## GitHub Pages 배포

`main`에 푸시하면 `Deploy game to GitHub Pages` 워크플로가 테스트 후 게임 파일만 배포합니다. 진행 상황은 저장소의 Actions에서 확인합니다. 자동 사이트 생성이 권한 문제로 실패하면 **Settings → Pages → Build and deployment → Source → GitHub Actions**를 선택한 뒤 워크플로를 재실행하세요. 클라우드 환경 자체의 게시와는 별개입니다.

최초 Pages 사이트 생성은 기본 Actions 토큰으로 권한 오류(`Resource not accessible by integration`)가 날 수 있습니다. 이 경우 저장소 관리자가 Pages 설정에서 Source를 GitHub Actions로 선택해 사이트를 활성화해야 합니다. 단순 재실행만으로는 권한 문제가 해결되지 않습니다.
