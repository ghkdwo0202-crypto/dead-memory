# KAGE//IN — P3 횡스크롤

최우선 기준: [P3 v3.1 요청서](docs/KAGE-IN-P3-SIDEVIEW-AUTO-NINJUTSU-v3.1.md). **실제 중력과 발판 충돌**을 사용하는 횡스크롤 닌자 액션입니다. P2 탑뷰/가상 높이/V·기억 슬롯을 새 플레이에 사용하지 않습니다.

이번 체크포인트는 **P3-A/B/C**입니다. 단일 즉발 4종, 상위 단일 조합4종, 화수뇌 혼합1종을 구현했습니다. 나머지15인술/6원소반응/검술·회피·각인 확장/새보스는 P3-D/E에 남았습니다.

## 실행과 조작

Node.js 22 이상에서 `npm start` → `http://localhost:3000`. 첫 화면에서 **성문 돌파** 또는 **검술 수련장**을 방향키·Enter로 선택합니다.

| 입력 | 실제 기능 |
| --- | --- |
| ← → | 좌우 달리기·바라보기 |
| Space | 실제 점프·홀드 높이 조절·공중 제어 |
| ↑ / ↓ | 위쪽 조준 / 공중 빠른 낙하 |
| ↓+Space | 일방향 발판 내려가기 |
| Z 홀드 | 지상3타·공중2타 |
| ↑+Z / 공중 ↓+Z | 상향 베기 / 포고 반동 점프 |
| X | 좌우 회피·공중1회·벽 차폐 |
| C | 근접 피니시: 지상 띄우기 / 공중 격추, CD2.8초 |
| A/S/D/F | 화/수/뇌/풍: 첫 인 기본기 → 둘째 조합만 → 셋째 자동 인술 |
| V | 사용하지 않음 |
| Enter / Esc | 메뉴 확인 / 정지·설정 |

인 사이 **0.75초** 이내 입력합니다. 키 홀드/자동 반복은 결인에 포함하지 않습니다. 기본기 CD는 속성별1초, 조합 CD는 독립입니다. 시전 대기는1개/0.18초이며 실패 이유를 표시합니다. 고정60Hz 틱 경계에서는 최대1틱 판정 오차가 있습니다.

- A 한 번: 화염 수리검. A A A: 기본 화염+홍련폭.
- S S S: 격류진. 지상은 발판 표면 파도, 공중은 물칼날.
- D D D: 천뢰격. 전방 시야의 적에게 낙뢰.
- F F F: 진공참. 지상 상승 칼바람/공중 하향 변형.
- A S D (순서 무관): 멸진뇌폭. 기존 젖음/점화를 소비해 강화.

V나 C로 인술을 준비/시전하지 않습니다. 혼합15개는 미리보기 메타데이터만 있고 시전되지 않습니다. 마우스/WASD 이동은 없습니다.

## 검증·빌드

```sh
npm test
npm run check
npm run build:pages
npm run build:download
npm run test:browser             # 물리·C·포고·공중 대시 실제 키보드
npm run test:auto-seals-browser  # 첫 즉발/둘째미발동/셋째자동/5조합
npm run test:offline             # 서버 종료 후 단일 HTML 플레이
```

브라우저 검사에는 Playwright와 Chromium이 필요합니다. `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH`, `GAME_URL`을 지정할 수 있습니다. 산출물은 `.local/standalone/KAGE-IN-P3.html`, `downloads/KAGE-IN-P3.zip`. 압축을 풀고 HTML을 Chrome/Edge로 열면 Node.js나 인터넷 없이 플레이합니다.

## 보존과 보고

P2: `downloads/KAGE-IN.zip`을 그대로 보존. 로컬 페이지는 `/p2.html`, 새로 빌드는 `npm run build:p2`. MEAT MARKET은 `/legacy.html`. 이전 저장 키를 읽거나 지우지 않으며 새 저장은 `kage-in.p3.v1`입니다. 별도 전환 브랜치에서 작업하며 main 병합/환경·Pages 게시를 하지 않습니다.

- [P2 ZIP 원본 감사](docs/P2-SOURCE-AUDIT.md)
- [P3-A/B 결과](docs/KAGE-IN-P3-AB.md)
- [P3-C 결과 및 남은 범위](docs/KAGE-IN-P3-C.md)
- [기존 P2 설명](docs/KAGE-IN-P2-README.md)
