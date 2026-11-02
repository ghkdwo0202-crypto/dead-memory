# KAGE//IN V5 구현 감사

## 기준

2026-11-02 디자인 스냅샷, PR #9 `design/kage-in-v5-production-spec-gallery`, commit `995d7d877c1cda487e54f71bed3c915d9db28cc9`. 통합 사양서와 gallery manifest를 해당 커밋에서 원문 보관했다. 이전 MEAT MARKET v1.3, KAGE P3/P4는 V5의 개발 계약이 아니다.

원격 브랜치 확인: main=b99fae3, P2 배포=6027ce2, P3 구현=1414287. P3 트리에는 sideview/physics2d/seals와 P2/P3 ZIP이 있으나 Unity 프로젝트가 없고 폐기된 횡스크롤/결인 계약을 구현한다. 그대로 V5로 옮기지 않는다. main의 JavaScript/Canvas, 저장 실패 폴백 아이디어와 정적 실행 방식을 재사용한다.

## 환경과 결정

- 현재 main 기준선 b99fae3, 기존 사용자 변경 없음. 작업 브랜치 `feature/kage-in-v5-web-slice`.
- Unity/UnityHub/unity-editor/dotnet 명령, ProjectVersion.txt, Unity 프로젝트가 /workspace에 없다. Unity 빌드나 검증이 가능하다고 주장하지 않는다.
- V5 §14의 명시적 대체 구현 규정에 따라 독립 `kage-in-v5/index.html` + JavaScript/Canvas 웹 수직 절편을 개발한다. Unity 버전은 지정/추측하지 않는다.
- 기존 index.html/src/downloads/세이브 키는 보존. 신규 저장소는 `kage-in.v5.*`, 갤러리는 `kage-in.gallery.v1`.
- manifest의 PNG 7장은 현재 로컬 첨부/저장소에 없다. 생성한 얼굴로 대체하지 않는다. 누락 표시와 실제 이미지 로더를 사용한다.

## 첫 납품 범위

실제 타이틀/갤러리/설정/캐릭터 선택/허브, 3인 구별되는 기본 전투, 적과 클리어 가능한 방, 보상/다음방/보스/결과의 짧은 검증 루프. O12/S4/Q48은 정의와 완전성 검사부터 제공하며 미구현 개별 기술을 완료 처리하지 않는다. 60분 5막과 분기 강화, 라이벌 실전, 확정 아트/음향은 후속 범위.

테스트: 기존 회귀, V5 전투/저장/갤러리/레지스트리 단위 검사, 실제 Chromium 입력/해상도/저장 복원, 독립 오프라인 빌드.
