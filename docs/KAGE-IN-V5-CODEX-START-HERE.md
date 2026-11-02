# KAGE//IN V5 — Codex 작업 시작 지침

1. [통합 사양서](../docs/KAGE-IN-V5-PRODUCTION-SPEC-GALLERY.md)를 **현재 우선 계약**으로 읽을 것. 이전 P3/P4는 obsolete: 2D 횡스크롤·세 결인·자동 혼합 인술 코드를 V5와 혼합하지 말 것.
2. `main`은 MEAT MARKET 코드이므로 별도의 신규 진입점에서 KAGE//IN을 구현. 현재 저장소 상태 및 Unity 개발 환경 감사를 먼저 수행.
3. 갤러리 JSON: [gallery_manifest.json](../assets/kage-in/gallery/gallery_manifest.json). PNG 리소스는 **아직 GitHub 미업로드**. manifest `sourceFilename`에 따라 사용자가 전달한 ZIP 이미지 7개를 대응 `asset` 경로에 복사하여 import. 누락시 placeholder. 없는 이미지를 GitHub에서 찾았다고 말하지 말 것.
4. 첫 구현 목표는 **조작 가능한 타이틀 + 갤러리 + 캐릭터 선택 + 3인 기본 전투 + 한 개의 클리어 가능 방**, 그리고 전투 데이터 O12/S4/Q48 레지스트리와 테스트.
5. 다음 작업에서 48 Q 각각의 판정/경로와 강화, 방 보상, 진행을 구현. 아직 미정인 분기 이름·막 세부 설정은 제안 상태로 표기.
6. 모든 업데이트에서 테스트 명령/실행 지침/스냅샷/미구현을 보고. MEAT MARKET 소스·다운로드와 세이브 키 유지.

## 적용 자료
- `docs/KAGE-IN-V5-PRODUCTION-SPEC-GALLERY.md`: 완전한 V5 기획 및 검수
- `assets/kage-in/gallery/gallery_manifest.json`: 타이틀+갤러리 에셋 ID, 이름, 해금 조건, 소스 파일명
- 채팅 파일 `KAGEIN_V5_reference_assets.zip`: 사용자가 내려받아 저장소에 추가할 PNG 7장

## 이미지 품질 기준
키츠네 마스터 원본을 질감 기준으로 하고, 얼굴·특징을 새로 재해석하지 말 것. 고로 등에 포신/대포 금지. 시로하 최초 짧은 머리 얼굴 고정. 색상 조정은 원본 얼굴 변형 없이 수행.

## 단계 보고 템플릿
- 동작하는 기능
- 스텁/미구현과 이유
- 테스트 결과
- 재현 가능한 실행법
- 스크린샷/영상과 Art asset source
- 다음 우선순위
