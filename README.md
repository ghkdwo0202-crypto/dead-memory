# KAGE//IN

닌자 검술과 공중 추격을 기반으로 속성 결인 인술을 조합하는 JavaScript + Canvas 액션 로그라이크. 개발 기준은 [v3.0 기획안](docs/KAGE-IN-NINJUTSU-ACTION-ROGUELIKE-v3.0.md)입니다.

현재 구현은 **P0 분석 + P1 기본 액션 프로토타입**입니다. Z3 띄우기 → Space 추격 → 공중 Z 2타 → ↓+Z 격추, 2충전 회피와 정확한 회피 반격, 표창, 작은 적 3종을 시험할 수 있습니다. 인술·레벨업 빌드·보스·완성 런은 이후 단계이며 아직 구현되지 않았습니다.

## 실행

개발 시 Node.js 22 이상에서 `npm start` 후 `http://localhost:3000`을 엽니다. 첫 화면에서 Enter로 출격하거나 방향키로 **검술 수련장**을 선택하세요.

| 입력 | 기능 |
| --- | --- |
| 방향키 | 이동 / 메뉴 선택 |
| Z | 검격 3타 / 홀드 반복 / 공중 검격 |
| X | 2충전 회피, 실제 공격 회피 성공 후 Z 반격 |
| Space | 점프 / 전방에 띄운 적이 있으면 공중 추격 |
| 공중 Z 2타 후 ↓+Z | 짧은 시간 내 착지 격추 (지상에서는 일반 Z) |
| C | 표창, 4초 쿨다운 (P1 기본 기술) |
| Enter / Esc | 확인 / 일시정지·설정 |

A/S/D/F 인 3개와 V 준비·C 인술 발동은 P2부터 구현합니다. 기존 WASD 이동이나 마우스 조준은 없습니다. 사망 교전 요약은 `kage-in.deaths.v1`로 저장하며 `meat-market.deaths.v1`을 읽거나 변경하지 않습니다.

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
npm run test:legacy-browser   # 보존된 MEAT MARKET 회귀
npm run test:morph-browser    # 기존 ActionMorph 연구실
```

기존 게임은 `legacy.html`과 `archive/action-morph-v2-source` 브랜치에 보존했습니다. 새 작업 브랜치는 `feature/kage-in-p1`이며 main은 변경하지 않습니다. [기존 설명](docs/MEAT-MARKET-README.md), [P0/P1 분석·결과](docs/KAGE-IN-P0-P1.md)를 참고하세요.
