# KAGE//IN V5 — 첫 웹 수직 절편

최신 기준: [V5 통합 명세](../docs/KAGE-IN-V5-PRODUCTION-SPEC-GALLERY.md), [시작 지침](../docs/KAGE-IN-V5-CODEX-START-HERE.md), [PR #9](https://github.com/ghkdwo0202-crypto/dead-memory/pull/9), 원문 커밋 `995d7d877c1cda487e54f71bed3c915d9db28cc9` (2026-11-02). P3/P4의 횡스크롤·결인은 사용하지 않는다.

## 실행

- 설치 없이: `downloads/v5/KAGE-IN-V5.html`을 Chrome/Edge로 열기. 코드·스타일·갤러리 manifest 포함, 외부 라이브러리/네트워크/API 키 불필요.
- 개발: 저장소에서 `npm start`, `http://localhost:3000/kage-in-v5/index.html` 접속. 기존 `/`의 MEAT MARKET과 별개다.
- Unity 에디터/프로젝트가 없는 환경이므로 V5 §14에 따라 제공하는 **웹 대체 구현**이다. Unity 프로젝트나 빌드가 아니다.

## 실제 동작

- 좌측 메뉴·붉은 달·세 영웅 기호가 있는 임시 타이틀, 새 게임, 명시적 이어하기, 설정, 갤러리, 종료 화면. 16:9 레터박스, 키보드/마우스 메뉴 탐색.
- 영웅 3인 선택. 카라스 빠른 검격/전진 7연 E, 키츠네 빠른 쌍단도/9연 E, 고로 느리고 무거운 카나보/강한 E. 도형 아트이며 마스터 초상·정식 애니메이션은 미포함. 고로는 앞의 가시 카나보를 들며 등 뒤 총포가 없다.
- WASD 정규화 이동, 마우스 조준, 좌클릭 홀드 기본타, Space 회피, E, 우클릭 지원, 1/2/3/4 인퓨전, Esc. 고정 60Hz 전투, 벽 충돌, 공격별 중복 적중 방지. 대시는 공격을 취소한다.
- 지원 4종: 기본타 약화 복제 분신, 끌어모으기/감속 사슬, 벽 앞에서 정지하는 치환, 감속 결계. 쿨다운 독립.
- 다음 실제 타격에만 소비되는 화/수/뇌/풍. 빗나가면 예약 유지. 점화 지속피해, 감속, 짧은 감전 경직, 밀기. 보스 경직은 단축. 속성간 반응은 미구현.
- 검병의 실제 전조와 피해, 장애물 2개, 전투방 클리어, 상한 있는 공통 스탯 보상, 경비 마당/온천의 2택, 문지기 보스, 결과/재시작. 보스는 현재 넓은 단일 강타 패턴으로 5막 보스 완성본이 아니다.
- O12/S4/Q48 고유 이름·조합 데이터와 lookup 검증. 실제 O는 O01/O05/O09만 사용한다. 나머지 O9와 Q48은 `implemented:false`, 고유 판정 미구현을 게임 도움말/HUD에 표시한다. Q를 눌러도 게이지를 소모하거나 가짜 합성을 재생하지 않는다.
- 갤러리 7항목. 기본 공개 영웅3/타이틀1, 라이벌별 조우 이벤트 해금·중복 방지·기본 공개 옵션. 잠긴 항목은 이름/서사 대신 획득 힌트, 확대·이전/다음·정보 토글·전체화면 요청, 저장/백업/해금 초기화. 실제 라이벌 전투는 미구현이므로 자연 조우 해금은 아직 없다.
- 이미지 비동기 로딩 실패 시 누락 표시. 지정 PNG **7장 모두 현재 미포함**이며 `downloads/v5/asset-report.json`에 목록을 출력한다. 원본 생성/복제를 주장하지 않는다. 아트 추가는 manifest의 지정 경로로 원본을 가져오는 후속 작업이다.
- 런 `kage-in.v5.run.v1`, 설정 `kage-in.v5.options.v1`, 갤러리 `kage-in.gallery.v1` 분리. JSON 손상 복구, 세이브 검증, 저장 차단 시 탭 메모리 폴백. 방 시작/보상/일시정지에서 저장하며 종료된 런은 이어하기에서 제외한다. 재개 시 공격 중간 상태와 예약 연격은 취소한다.

## 검증

```sh
npm test                 # 기존 59개 + V5 15개 회귀
npm run check            # 기존 구문 검사
npm run test:v5          # V5 15개
npm run check:v5
npm run build:v5
```

실제 Chromium 자동화:

```sh
npm install --prefix work/browser --no-save --package-lock=false playwright@1.58.2
PLAYWRIGHT_MODULE=../work/browser/node_modules/playwright/index.mjs npm run test:v5:browser
```

서버 실행 필요. 기본 Chromium `/usr/bin/chromium`; `CHROMIUM_PATH`/`GAME_URL`로 변경 가능. 타이틀·갤러리 잠금/해금/줌/재시작 저장, 3인 진입, WASD, 속성 예약, 실제 공격→보상→문→보스→결과, 일시정지 중 시간 정지, 이어하기, 720p/1080p/울트라와이드, 단독 HTML 직접 로드 검사를 수행한다. 완료 흐름 검사는 테스트 응답에만 삽입한 fixture로 적 위치/HP를 조정한 뒤 실제 입력/판정으로 처치한다. 일반 플레이 밸런스·손맛 검증을 대체하지 않는다.

클라우드 Chromium 정책상 `file://` URL은 차단된다. 단독 HTML은 네트워크 요청을 막고 브라우저 문서에 직접 로드하여 스크립트·스타일 포함과 전투 진입을 검증한다. 사용자의 PC에서 파일을 직접 여는 수동 검사는 미실시다.

## 변경과 후속 범위

신규 `kage-in-v5/{index.html,style.css,data.js,model.js,render.js,game.js,README.md}`, `assets/kage-in/gallery/gallery_manifest.json`, V5 명세·감사 문서, `tests/v5.test.js`, V5 빌드/브라우저 스크립트와 독립 다운로드. package.json에는 V5 명령을 추가하고 기본 test/check에도 V5 검증을 연결했으며 README에 신규 진입점만 안내했다. 기존 게임 소스/ZIP/배포 workflow/저장 키는 보존한다. 잘못 시작한 MEAT MARKET 장착 수정은 원복했다.

아직 없음: Unity, 원본 아트/정식 스프라이트, O9·Q48 고유 동작, 공격/지원 3분기·Tier1~3, 경로 그래프·상점·계약, 적 변종·다페이즈 보스, 5막·60분 런, 라이벌·서사·엔딩, BGM/음성, 정식 피드백/입력 버퍼·히트스톱·공속 튜닝. 60fps 실측 달성을 주장하지 않는다.

다음 우선순위는 원본 PNG 가져오기와 Unity 개발 환경 결정, 그리고 대표 O×S 한 조합의 실제 Q 동작 완주다. 아직 미정인 분기 이름이나 막 설정은 확정값으로 만들지 않았다. 원격 푸시·배포·PR 병합은 수행하지 않았다.
