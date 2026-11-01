# MEAT MARKET

괴물을 죽이고 신체 기관을 이식하는 **키보드 전용 2D 액션 서바이버 로그라이크** 프로토타입입니다. 기존 DEAD MEMORY의 JavaScript + Canvas 엔진과 배포 구조를 유지하고 새 [개발 명세 v1.1](docs/MEAT-MARKET-SPECIFICATION.md)에 맞춰 전환했습니다.

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
npm test             # 필수 22개 케이스를 포함한 40개 테스트
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
