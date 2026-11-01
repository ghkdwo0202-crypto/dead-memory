# P2 실제 배포 원본 감사

원격 `downloads/kage-in-p2`의 ZIP을 직접 다운로드해 검사했다. 이 브랜치 루트 src/README를 원본으로 간주하지 않았다.

- ZIP URL: https://github.com/ghkdwo0202-crypto/dead-memory/raw/6027ce2/downloads/KAGE-IN.zip
- ZIP SHA256: `4d613b7753c51a1233a2734f048e10e7892359a77290a5df818dde4ed469ab6b`
- ZIP 포함 파일: `KAGE-IN.html, START.txt` (CRC 통과)
- 실행 HTML SHA256: `d50df22baef3bced9c9737062f49beae2f746d260e56e566217f18a638ddd4ee`
- 실제 진입: ZIP 안 `KAGE-IN.html`의 인라인 번들 → `modules["ninja-game.js"]` → `NinjaGame`/`NinjutsuSystem`. 외부 JS/CSS 요청 없음.
- 추출 위치: `.local/p2-audit/KAGE-IN.html`, 각 번들 모듈 `.local/p2-audit/*.js`. 번들 변환된 소스로, 독립 ES module 원본 파일이 ZIP에 따로 있는 것은 아니다.
- 원본 ES modules는 작업 소스 커밋 `78ce24e`에 보존. ZIP HTML은 해당 빌드 산출물과 바이트 일치를 확인했다.

| ZIP 번들 내 모듈 | 추출 블록 SHA256 |
| --- | --- |
| `data.js` | `19c3aff885ad9476f4a7b7f62b7238d4af9515fb6566308d42739ae93953af00` |
| `navigation.js` | `b8328df4cd0e2d0a88b5fab422ea2abf9e1672dd355d11c6b850096e6b8891c9` |
| `storage.js` | `209ef55e5c90165de1e796ca17b6438258a47aa86929839fe5055a4dedc8ae4a` |
| `action-paths.js` | `d2cf6a642c838ba36c02ac848500bbf6357c1d463b133f506d3628e0b31c267f` |
| `action-morph.js` | `48973ce40310f303a2eacca009f68b73a5b6226dd6a04916961cdf03c01ba2a8` |
| `core.js` | `a1cce8e3dc89f8d7b98d305b1041b4eaa24f2d64ccc40c35c30b1c5bfbcd5783` |
| `ninjutsu-data.js` | `3ce9574901fe807c1a0e80157dd817f7a26b00d485d771f36fb55f13fe32addc` |
| `ninjutsu.js` | `c5b55d7aaa9c3e16b1eb6144f96786e939a0758ede1d2b09d7af2a0dfc70288c` |
| `ninja.js` | `b7a1183bcdc384fc40bea4649f70b74220df572e550f72cb310bb0fc1ea7da5f` |
| `ninja-render.js` | `051c7ace06f396f73bd3f7165be2218ca2c930d892bd54c2131e34341ab88460` |
| `ninja-game.js` | `a31ea67bc4a3008299d5960503345b748f60cc423e39c24856e2b73e2eb243e0` |

P2 기능: 탑뷰 방향키/Z/X/Space, A/S/D/F 3인+V 준비/C 시전, 순수4인술·2슬롯·CD, 성장3택·가상공중, 저장 `kage-in.deaths.v1`. P2 자동 테스트 135개와 브라우저·오프라인 기록은 `docs/KAGE-IN-P2.md`.

P3에서는 별도 물리·전투·렌더·입력 모듈로 전환한다. P2 코드는 `p2.html`/기존 소스/실행 ZIP으로 보존한다. 탑뷰 A*·원형 거리·가상 airHeight를 새 충돌에 재사용하지 않는다. 60Hz 고정 스텝과 플랫폼 AABB를 사용하고 새 저장은 `kage-in.p3.v1`.
