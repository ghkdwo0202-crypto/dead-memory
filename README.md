# KAGE//IN

닌자 검술과 공중 추격을 기반으로 속성 결인 인술을 조합하는 JavaScript + Canvas 액션 로그라이크. 개발 기준은 [v3.0 기획안](docs/KAGE-IN-NINJUTSU-ACTION-ROGUELIKE-v3.0.md)입니다.

현재 구현은 **P2 결인/Invoke/첫 4개 인술**까지입니다. 기본 검술·X 회피·Space 추격을 유지하며 A/S/D/F 세 인으로 인술을 준비하고 두 슬롯을 V로 교대합니다.

| 인 입력 | 준비 → 발동 | 인술 | CD / 제한 |
| --- | --- | --- | --- |
| A A A (화) | V → C | 화둔·홍련폭: 전방 폭발·점화·밀기 | 5.5초 / 지상 전용 |
| S S S (수) | V → C | 수둔·격류진: 이동 파도·젖음·밀기 | 6초 / 벽에 막힘 |
| D D D (뇌) | V → C | 뇌둔·천뢰격: 전방 표식 우선 낙뢰·감전 | 7초 / 전방 표적 필요 |
| F F F (풍) | V → C | 풍둔·진공참: 두 갈래 칼바람·띄우기 | 5초 / 한 대상 1회 |

결인 입력이 비어 있으면 V로 두 기억 슬롯을 교대합니다. 쿨다운은 인술별 독립이며 재준비/교대로 초기화되지 않습니다. 슬롯이 없으면 C는 표창입니다. 혼합 16개는 이름과 조합 미리보기만 제공하며 준비/시전되지 않습니다. 속성 반응·개화·12개 빌드·새 보스는 이후 단계입니다.

## 실행

[최신 P2 실행 ZIP 다운로드](https://github.com/ghkdwo0202-crypto/dead-memory/raw/6027ce2/downloads/KAGE-IN.zip) → 압축 해제 → `KAGE-IN.html` 열기.

개발 시 Node.js 22 이상에서 `npm start` 후 `http://localhost:3000`을 엽니다. 첫 화면에서 Enter로 출격하거나 방향키로 **검술 수련장**을 선택하세요.

| 입력 | 기능 |
| --- | --- |
| 방향키 | 이동 / 메뉴 선택 |
| Z | 검격 3타 / 홀드 반복 / 공중 검격 |
| X | 2충전 회피, 실제 공격 회피 성공 후 Z 반격 |
| Space | 점프 / 전방에 띄운 적이 있으면 공중 추격 |
| 공중 Z 2타 후 ↓+Z | 짧은 시간 내 착지 격추 (지상에서는 일반 Z) |
| A/S/D/F | 화/수/뇌/풍 인 입력 · 키 홀드 반복 무시 |
| V | 인 3개로 인술 준비 / 빈 입력일 때 두 슬롯 교대 |
| C | 준비 인술 발동 / 슬롯이 비었으면 4초 표창 |
| Enter / Esc | 확인 / 일시정지·설정 |

결인은 마지막 3개를 유지하며 순서와 무관합니다. 정상 모드에서는 4개 인이 모두 열립니다. 입구의 **결인 입문 모드**를 켜면 A/S부터 시작하고 수련 60초에 D, 90초에 F가 열립니다. WASD 이동이나 마우스 조준은 없습니다. 성장 3택 메뉴는 잠시 전투를 멈춥니다. 사망 교전 요약은 `kage-in.deaths.v1`로 저장하며 `meat-market.deaths.v1`을 읽거나 변경하지 않습니다.

## 검증·빌드

```sh
npm test
npm run check
npm run build:pages
npm run build:standalone
npm run build:download
```

단일 파일: `.local/standalone/KAGE-IN.html`. 다운로드 묶음: `downloads/KAGE-IN.zip`. ZIP을 풀고 HTML을 Chrome/Edge로 열면 Node.js나 인터넷 없이 플레이합니다. 빌드는 배포/게시를 수행하지 않습니다.

브라우저 검사는 실행 중인 개발 서버와 Playwright/Chromium이 필요합니다. `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH`, `GAME_URL`을 지정할 수 있습니다.

```sh
npm run test:browser          # KAGE//IN 실제 키보드·공중 연계
npm run test:seals-browser    # 결인/4인술/슬롯/성장 보상 실제 전투
npm run test:offline          # 서버 종료 후 단일 HTML 결인·공중 추격
npm run test:legacy-browser   # 보존된 MEAT MARKET 회귀
npm run test:morph-browser    # 기존 ActionMorph 연구실
```

기존 게임은 `legacy.html`과 `archive/action-morph-v2-source` 브랜치에 보존했습니다. 새 작업 브랜치는 `feature/kage-in-p2`이며 main은 변경하지 않습니다. [기존 설명](docs/MEAT-MARKET-README.md), [P0/P1 분석·결과](docs/KAGE-IN-P0-P1.md), [P2 보고](docs/KAGE-IN-P2.md)를 참고하세요.
