import {
  HEROES,
  OFFENSES,
  SUPPORTS,
  FUSIONS,
  ELEMENTS,
  ROOMS,
  REWARDS,
  fusionFor,
} from "./data.js";
import { Run, GalleryState, SafeStore, RUN_KEY, clamp } from "./model.js";
import { draw } from "./render.js";
const $ = (id) => document.getElementById(id),
  canvas = $("world"),
  ctx = canvas.getContext("2d"),
  overlay = $("overlay"),
  hud = $("hud");
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let storage;
try {
  storage = window.localStorage;
} catch {}
const store = new SafeStore(storage);
const defaultOptions = { reveal: false, flash: true, volume: 0.3 };
const savedOptions = store.read("kage-in.v5.options.v1", {});
const options = { ...defaultOptions };
if (savedOptions?.version === 1) {
  for (const k of ["reveal", "flash"])
    if (typeof savedOptions[k] === "boolean") options[k] = savedOptions[k];
  if (Number.isFinite(savedOptions.volume))
    options.volume = clamp(savedOptions.volume, 0, 1);
}
let run = null,
  screen = "loading",
  returnTo = () => title(),
  galleryTab = "hero",
  detailIndex = 0,
  zoom = 1,
  info = true,
  selection = 0,
  heroIndex = 0,
  supportId = "S01",
  last = 0,
  lastMode = "",
  gallery,
  manifest,
  detailEntries = [],
  audio;
const keys = new Set(),
  edge = {};
let attack = false,
  aim = { x: 1000, y: 405 };
function clearInput() {
  keys.clear();
  attack = false;
  for (const k of Object.keys(edge)) delete edge[k];
}
function toast(text) {
  $("toast").textContent = text;
  $("toast").style.display = "block";
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("toast").style.display = "none"), 3500);
}
function beep(freq = 330) {
  if (!options.volume) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(),
      g = audio.createGain();
    o.frequency.value = freq;
    o.type = "triangle";
    g.gain.setValueAtTime(options.volume * 0.08, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.08);
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + 0.08);
  } catch {}
}
function view(name, html, bindings = {}) {
  clearInput();
  screen = name;
  overlay.className = name === "title" ? "title" : "";
  overlay.innerHTML = html;
  hud.classList.add("hidden");
  selection = 0;
  for (const [id, fn] of Object.entries(bindings)) {
    const e = $(id);
    if (e) e.onclick = fn;
  }
  overlay
    .querySelectorAll("button")
    .forEach((b) => b.addEventListener("click", () => beep(440)));
  const first = overlay.querySelector("button:not(:disabled)");
  first?.focus({ preventScroll: true });
}
const head = (eyebrow, title, text = "") =>
  `<header class="page-head"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1>${text ? `<p>${text}</p>` : ""}</div><button id="back">← 뒤로 <small>ESC</small></button></header>`;
function title() {
  run = null;
  lastMode = "";
  const saved = Run.restore(store.read(RUN_KEY, null));
  view(
    "title",
    `<div class="eyebrow">요괴 셋. 성 하나. 계획은 나중에.</div><h1 class="logo">KAGE<em>//</em>IN</h1><p class="subtitle">SHADOWS WITH AN ATTITUDE</p><nav class="title-nav" aria-label="타이틀 메뉴"><button id="new">새 게임 <small>START</small></button><button id="continue" ${saved ? "" : "disabled"}>이어하기 <small>CONTINUE</small></button><button id="gallery">갤러리 <small>GALLERY</small></button><button id="settings">설정 <small>SETTINGS</small></button><button id="codex">개발 현황 / 도움말</button><button id="exit">종료 <small>EXIT</small></button></nav><p class="title-note">V5 첫 플레이 절편 · WASD + 마우스<br>3명의 기본 전투 / 지원 4종 / 짧은 방 진행<br>5막·60분 런과 Q48 실전은 다음 단계입니다.</p>`,
    {
      new: () => {
        if (saved)
          confirmView("저장된 런을 새 런으로 바꿀까요?", () => heroes(), title);
        else heroes();
      },
      continue: () => {
        run = saved;
        resumeMode();
      },
      gallery: () => openGallery(title),
      settings: () => settings(title),
      codex: () => codex(title),
      exit: () =>
        view(
          "exit",
          head(
            "THANK YOU",
            "잠시 그림자 밖으로.",
            "게임을 종료했습니다. 브라우저 탭을 닫아도 됩니다.",
          ) + '<button id="return">타이틀로 돌아가기</button>',
          { back: title, return: title },
        ),
    },
  );
}
function heroes() {
  view(
    "heroes",
    head(
      "CHOOSE YOUR TROUBLE",
      "누가 먼저 담을 넘을까?",
      "한 번에 1명만 플레이합니다. 각 영웅의 첫 공격 계열을 체험합니다.",
    ) +
      `<section class="cards">${HEROES.map((h, i) => `<button class="hero-card" id="hero-${i}" style="--hero:${h.color}"><small>${h.species} / ${h.weapon}</small><span class="glyph">${h.symbol}</span><h2>${h.name}</h2><p>${h.description}</p><small>HP ${h.hp} · ${OFFENSES.find((o) => o.id === h.offense).name} →</small></button>`).join("")}</section><p class="mini">초상 원본 PNG 미포함 · 기호/도형은 임시 표현입니다.</p>`,
    {
      back: title,
      ...Object.fromEntries(
        HEROES.map((h, i) => [
          `hero-${i}`,
          () => {
            heroIndex = i;
            hub(true);
          },
        ]),
      ),
    },
  );
}
function hub(fresh = false) {
  if (fresh) {
    run = new Run(HEROES[heroIndex].id, supportId);
    run.save(store);
  }
  view(
    "hub",
    head(
      "SAFE HOUSE / V5 SLICE",
      `${run.hero.name} · 작은 은신처`,
      run.hero.line,
    ) +
      `<section class="panel"><div class="eyebrow">우클릭에 장착할 지원 인술</div><div class="support-choices">${SUPPORTS.map((s) => `<button id="support-${s.id}" class="${run.supportId === s.id ? "selected" : ""}">${s.name}</button>`).join("")}</div><p class="brief" id="support-desc">${SUPPORTS.find((s) => s.id === run.supportId).description}</p><div class="control-grid"><span><kbd>WASD</kbd>이동</span><span><kbd>마우스 / 좌클릭</kbd>조준 / 기본타</span><span><kbd>Space</kbd>회피 · 벽 통과 불가</span><span><kbd>E / 우클릭</kbd>공격 인술 / 지원</span><span><kbd>1 2 3 4</kbd>다음 타격 속성 예약</span><span><kbd>Q</kbd>고유 합성 · 미구현 안내</span></div><div class="bottom-actions"><button id="hub-gallery">갤러리</button><button class="primary" id="enter">성 외곽으로 →</button></div></section>`,
    {
      back: () =>
        confirmView(
          "타이틀로 돌아갈까요? 현재 런은 저장됩니다.",
          () => {
            run.save(store);
            title();
          },
          () => hub(),
        ),
      "hub-gallery": () => openGallery(() => hub()),
      enter: () => {
        run.enter("gate");
        run.save(store);
        play();
      },
      ...Object.fromEntries(
        SUPPORTS.map((s) => [
          `support-${s.id}`,
          () => {
            run.supportId = s.id;
            supportId = s.id;
            run.save(store);
            hub();
          },
        ]),
      ),
    },
  );
}
function play() {
  clearInput();
  screen = "combat";
  overlay.className = "hidden";
  hud.classList.remove("hidden");
  lastMode = run.mode;
  canvas.focus();
  updateHUD();
}
function resumeMode() {
  if (run.mode === "hub") hub();
  else if (run.mode === "combat") play();
  else if (run.mode === "reward") rewards();
  else doors();
}
function updateHUD() {
  if (!run) return;
  const p = run.player,
    o = OFFENSES.find((o) => o.id === run.offenseId),
    s = SUPPORTS.find((s) => s.id === run.supportId),
    q = fusionFor(o.id, s.id),
    cd = (v) => (v > run.t ? `${(v - run.t).toFixed(1)}s` : "준비");
  hud.innerHTML = `<div class="hud-top"><div class="portrait-mark">${run.hero.symbol}</div><div class="hp-wrap"><strong>${run.hero.name} · ${Math.ceil(p.hp)} / ${p.maxHP}</strong><div class="hp-line"><div class="hp-fill" style="width:${(100 * p.hp) / p.maxHP}%"></div></div><span>${o.name} / ${s.name}</span></div></div><div class="room-label">${run.room.name}<br>남은 적 ${run.enemies.length} · ${Math.floor(run.timePlayed / 60)}:${String(Math.floor(run.timePlayed % 60)).padStart(2, "0")}</div><div class="combat-hint">WASD 이동 · 좌클릭 홀드 공격<br>Space 회피 ${cd(p.dashAt)} · Esc 일시정지<br>예약 속성: ${ELEMENTS.find((e) => e.id === p.element)?.name || "없음"}</div><div class="skillbar"><div class="skill"><b>E</b>${o.active}<small>${cd(p.eAt)}</small></div><div class="skill"><b>RMB</b>${s.active}<small>${cd(p.sAt)}</small></div><div class="skill"><b>Q</b>${q.name}<small>고유 동작 미구현 · ${Math.round(p.gauge)} / 100</small><div class="gauge"><span style="width:${p.gauge}%"></span></div></div><div class="skill"><b>1—4</b>인퓨전<small>${ELEMENTS.map((e) => e.symbol).join(" / ")}</small></div></div><div class="combat-msg">${run.messageUntil > run.t ? escape(run.message) : ""}</div><button class="pause-button" id="pause-button">Ⅱ 일시정지</button>`;
  $("pause-button").onclick = pause;
}
function pause() {
  if (!run) return;
  run.save(store);
  view(
    "pause",
    head("TAKE A BREATH", "그림자 속에서 잠깐.") +
      `<section class="panel"><p class="brief">${run.hero.name} · ${run.room.name}<br>피해 강화 ${run.ranks.power}/5 · 체력 강화 ${run.ranks.health}/5 · 공속 강화 ${run.ranks.haste}/5<br>${store.persistent ? "현재 런을 저장했습니다." : "저장이 차단되어 현재 탭에서만 유지됩니다."}</p><div class="bottom-actions"><button class="primary" id="resume">계속하기</button><button id="pause-settings">설정</button><button id="pause-gallery">갤러리</button><button id="quit">런 나가기</button></div></section>`,
    {
      back: resumeMode,
      resume: resumeMode,
      "pause-settings": () => settings(pause),
      "pause-gallery": () => openGallery(pause),
      quit: () =>
        confirmView(
          "런을 저장하고 타이틀로 돌아갈까요?",
          () => {
            run.save(store);
            title();
          },
          pause,
        ),
    },
  );
}
function rewards() {
  run.save(store);
  const valid = REWARDS.filter((r) => run.ranks[r.id] < r.cap);
  if (!valid.length) {
    run.mode = "doors";
    doors();
    return;
  }
  view(
    "reward",
    head(
      "ROOM CLEARED",
      "그만큼 강해졌다.",
      "방 보상 하나를 선택하세요. 기술 분기는 다음 단계이며 아래는 공통 스탯 강화입니다.",
    ) +
      `<section class="cards">${valid.map((r) => `<button id="reward-${r.id}" class="reward-card"><div class="eyebrow">${run.ranks[r.id]} / ${r.cap}</div><h2>${r.name}</h2><p>${r.description}</p></button>`).join("")}</section>`,
    Object.fromEntries(
      valid.map((r) => [
        `reward-${r.id}`,
        () => {
          run.reward(r.id);
          doors();
        },
      ]),
    ),
  );
  $("back").disabled = true;
}
function doors() {
  run.save(store);
  const choices = run.roomId === "gate" ? ["guard", "rest"] : ["boss"];
  view(
    "doors",
    head(
      "CHOOSE THE NEXT ROOM",
      "어느 문으로 갈까?",
      "보상·체험·위험을 확인한 뒤 이동합니다. 이 절편은 문지기 처치까지 진행합니다.",
    ) +
      `<section class="cards">${choices
        .map((id) => {
          const r = ROOMS.find((r) => r.id === id);
          return `<button class="reward-card" id="door-${id}"><div class="eyebrow">위험 · ${r.risk}</div><h2>${r.name}</h2><p>체험: ${r.experience}<br>보상: ${r.reward}</p></button>`;
        })
        .join("")}</section>`,
    {
      back: pause,
      ...Object.fromEntries(
        choices.map((id) => [
          `door-${id}`,
          () => {
            run.enter(id);
            if (run.mode === "doors") doors();
            else {
              run.save(store);
              play();
            }
          },
        ]),
      ),
    },
  );
}
function result() {
  store.remove(RUN_KEY);
  const won = run.mode === "victory";
  view(
    "result",
    head(
      "END OF THE VERTICAL SLICE",
      won ? "첫 문을 열었다." : "다음엔 더 조용히.",
      "V5 첫 절편 종료 · 5막/쇼군 엔딩을 완료한 결과가 아닙니다.",
    ) +
      `<section class="panel"><h2>${won ? "문지기를 쓰러뜨렸습니다." : "요괴도 가끔은 아픕니다."}</h2><p class="brief">${run.hero.name}: “${won ? "성은 생각보다 크네. 간식부터 챙기자." : "이번 건 연습이었어."}”</p><div class="stats"><span><b>${run.kills}</b>처치</span><span><b>${Math.floor(run.timePlayed)}s</b>전투 시간</span><span><b>${run.hits}</b>적중</span></div><div class="bottom-actions"><button id="again" class="primary">다른 요괴로 다시</button><button id="result-gallery">갤러리</button><button id="to-title">타이틀로</button></div></section>`,
    {
      back: title,
      again: heroes,
      "to-title": title,
      "result-gallery": () => openGallery(result),
    },
  );
}
function confirmView(text, yes, no) {
  view(
    "confirm",
    head("CONFIRM", text) +
      `<section class="panel bottom-actions"><button id="no">취소</button><button class="primary" id="yes">확인</button></section>`,
    { back: no, no, yes },
  );
}
function settings(back) {
  returnTo = back;
  view(
    "settings",
    head("OPTIONS", "눈과 귀에 맞게.") +
      `<section class="panel"><label class="settings-row">효과음 볼륨<input id="volume" type="range" min="0" max="1" step="0.05" value="${options.volume}"></label><label class="settings-row">피격 플래시<input id="flash" type="checkbox" ${options.flash ? "checked" : ""}></label><label class="settings-row">갤러리 라이벌 미리 공개 <input id="reveal" type="checkbox" ${options.reveal ? "checked" : ""}></label><p class="mini">라이벌 미리 공개는 감상용 옵션입니다. 조우 해금 기록은 바꾸지 않습니다.<br>화면 흔들림 없음 · BGM/음성 및 키 재설정은 미구현입니다.</p><div class="bottom-actions"><button id="reset-gallery">갤러리 해금 초기화</button><button id="backup">갤러리 백업</button></div><p class="mini">${store.persistent ? "설정/갤러리는 런과 별도로 저장됩니다." : "저장 접근 제한: 이 탭에서만 변경을 보존합니다."}</p></section>`,
    {
      back,
      "reset-gallery": () =>
        confirmView(
          "갤러리 조우 해금만 초기화할까요?",
          () => {
            gallery.reset();
            settings(back);
          },
          () => settings(back),
        ),
      backup: () => {
        const blob = new Blob(
          [JSON.stringify({ version: 1, ids: [...gallery.unlocked] }, null, 2)],
          { type: "application/json" },
        );
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "KAGE-IN-gallery-backup.json";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      },
    },
  );
  for (const id of ["volume", "flash", "reveal"])
    $(id).oninput = () => {
      options[id] = id === "volume" ? Number($(id).value) : $(id).checked;
      store.write("kage-in.v5.options.v1", { version: 1, ...options });
    };
}
function art(entry, locked = false) {
  if (locked)
    return '<div class="placeholder"><b>?</b><span>미해금 · 해당 라이벌과 조우</span></div>';
  return `<img loading="lazy" src="../${escape(entry.asset)}" alt="${escape(entry.title)} 원본 아트"><div class="placeholder hidden"><b>未</b><span>원본 아트 미포함<br>${escape(entry.sourceFilename || entry.asset)}</span></div>`;
}
function bindImages() {
  overlay.querySelectorAll("img").forEach((img) => {
    const failed = () => {
      img.classList.add("hidden");
      img.nextElementSibling?.classList.remove("hidden");
    };
    img.onerror = failed;
    if (img.complete && !img.naturalWidth) failed();
  });
}
function openGallery(back) {
  returnTo = back;
  const tabs = [
    ["hero", "캐릭터"],
    ["rival", "라이벌"],
    ["title", "타이틀 & 키아트"],
    ["event", "이벤트 / 추후"],
  ];
  const entries = gallery.entries.filter((e) => e.category === galleryTab);
  view(
    "gallery",
    head(
      "THE ART OF KAGE//IN",
      "기록 보관소",
      "원본 PNG는 아직 미포함입니다. 공개 상태와 감상 기능은 아트 추가 후에도 유지됩니다.",
    ) +
      `<nav class="tabs">${tabs.map(([id, name]) => `<button id="tab-${id}" class="${galleryTab === id ? "selected" : ""}">${name}</button>`).join("")}</nav><section class="gallery-grid">${entries.map((e) => `<button class="art-card" id="art-${e.id}"><div class="art-frame">${art(e, !gallery.available(e, options.reveal))}</div><strong>${gallery.available(e, options.reveal) ? escape(e.title) : "미해금 작품"}</strong><small>${gallery.available(e, options.reveal) ? "감상하기 · 원본 파일 대기" : "라이벌과 조우하면 공개"}</small></button>`).join("") || '<p class="muted">이벤트 일러스트는 후속 단계입니다.</p>'}</section>`,
    {
      back,
      ...Object.fromEntries(
        tabs.map(([id]) => [
          `tab-${id}`,
          () => {
            galleryTab = id;
            openGallery(back);
          },
        ]),
      ),
      ...Object.fromEntries(
        entries.map((e) => [
          `art-${e.id}`,
          () => {
            if (!gallery.available(e, options.reveal)) {
              toast(
                "해당 라이벌을 만나면 해금됩니다. 설정에서 미리 공개할 수도 있습니다.",
              );
              return;
            }
            detailEntries = entries.filter((e) =>
              gallery.available(e, options.reveal),
            );
            detailIndex = detailEntries.findIndex((x) => x.id === e.id);
            zoom = 1;
            info = true;
            detail(back);
          },
        ]),
      ),
    },
  );
  bindImages();
}
function detail(back) {
  const e = detailEntries[detailIndex];
  view(
    "detail",
    head("GALLERY / ORIGINAL REFERENCE", escape(e.title)) +
      `<section class="detail-image art-frame" id="detail-image">${art(e)}</section><div class="bottom-actions"><div><button id="previous">← 이전</button> <button id="next">다음 →</button></div><div><button id="zoom-out">−</button> <span id="zoom-value">${Math.round(zoom * 100)}%</span> <button id="zoom-in">＋</button> <button id="info">정보</button> <button id="fullscreen">전체화면</button></div></div><p id="detail-info" class="detail-info ${info ? "" : "hidden"}">파일: ${escape(e.asset)} · 상태: ${escape(e.designStatus || "reference")}<br>제공된 원본 파일만 사용합니다. 대체 생성 이미지가 아닙니다.</p>`,
    {
      back: () => openGallery(back),
      previous: () => {
        detailIndex =
          (detailIndex + detailEntries.length - 1) % detailEntries.length;
        zoom = 1;
        detail(back);
      },
      next: () => {
        detailIndex = (detailIndex + 1) % detailEntries.length;
        zoom = 1;
        detail(back);
      },
      "zoom-out": () => setZoom(zoom - 0.25),
      "zoom-in": () => setZoom(zoom + 0.25),
      info: () => {
        info = !info;
        $("detail-info").classList.toggle("hidden", !info);
      },
      fullscreen: async () => {
        try {
          if (document.fullscreenElement) await document.exitFullscreen();
          else await $("detail-image").requestFullscreen();
        } catch {
          toast("이 브라우저에서는 전체화면 전환을 지원하지 않습니다.");
        }
      },
    },
  );
  $("detail-image").onwheel = (e) => {
    e.preventDefault();
    setZoom(zoom + (e.deltaY < 0 ? 0.2 : -0.2));
  };
  bindImages();
}
function setZoom(value) {
  zoom = clamp(value, 1, 4);
  $("zoom-value").textContent = `${Math.round(zoom * 100)}%`;
  const img = $("detail-image").querySelector("img");
  if (img) img.style.transform = `scale(${zoom})`;
}
function codex(back) {
  view(
    "codex",
    head(
      "IMPLEMENTATION STATUS",
      "V5, 현재 가능한 것.",
      "O12 / S4 / Q48 명명과 조합 레지스트리. 실제 동작과 데이터 정의를 구분합니다.",
    ) +
      `<p class="brief">구현: 3인 기본타·E / 지원 4종 / 4속성 예약 / 방·보상·문지기 / 갤러리·저장.<br>미구현: 나머지 O9, Q48의 고유 판정, O/S 3분기, 5막 60분, 라이벌 실전, 정식 아트·음악.<br>조작: WASD 이동 · 마우스 조준 · 좌클릭 기본타 · E 공격기 · 우클릭 지원 · Space 회피 · 1/2/3/4 화/수/뇌/풍 · Esc 일시정지.</p><div class="catalogue">${OFFENSES.map((o) => `<div>${o.id} ${o.name}<small>${o.primary} / E ${o.active}</small><small>${o.implemented ? "기본 동작 구현" : "데이터만 정의 · 미구현"}</small></div>`).join("")}${FUSIONS.map((q) => `<div>${q.name}<small>${q.offenseId} × ${q.supportId} · ${q.behavior}</small><small>고유 판정 미구현</small></div>`).join("")}</div>`,
    { back },
  );
}
function menuKeys(e) {
  const buttons = [...overlay.querySelectorAll("button:not(:disabled)")];
  let current = buttons.indexOf(document.activeElement);
  if (["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(e.code)) {
    e.preventDefault();
    if (screen === "detail" && ["ArrowLeft", "ArrowRight"].includes(e.code)) {
      $(e.code === "ArrowLeft" ? "previous" : "next").click();
      return;
    }
    const step = ["ArrowDown", "ArrowRight"].includes(e.code) ? 1 : -1;
    selection = (Math.max(0, current) + step + buttons.length) % buttons.length;
    buttons[selection]?.focus({ preventScroll: false });
  }
  if (e.code === "Escape") {
    e.preventDefault();
    $("back")?.click();
  }
}
window.addEventListener("keydown", (e) => {
  if (
    ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
      e.code,
    )
  )
    e.preventDefault();
  if (screen !== "combat") {
    menuKeys(e);
    return;
  }
  if (e.code === "Escape") {
    pause();
    return;
  }
  keys.add(e.code);
  if (e.repeat) return;
  if (e.code === "Space") edge.dash = true;
  if (e.code === "KeyE") edge.active = true;
  if (e.code === "KeyQ") edge.fusion = true;
  const index = ["Digit1", "Digit2", "Digit3", "Digit4"].indexOf(e.code);
  if (index >= 0) edge.element = index;
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
canvas.addEventListener("pointermove", (e) => {
  const rect = canvas.getBoundingClientRect();
  aim = {
    x: ((e.clientX - rect.left) * 1440) / rect.width,
    y: ((e.clientY - rect.top) * 810) / rect.height,
  };
});
canvas.addEventListener("pointerdown", (e) => {
  if (screen !== "combat") return;
  if (e.button === 0) attack = true;
  if (e.button === 2) edge.support = true;
});
window.addEventListener("pointerup", (e) => {
  if (e.button === 0) attack = false;
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("blur", () => {
  clearInput();
  if (screen === "combat") pause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && screen === "combat") pause();
});
let hudAt = 0;
function frame(now) {
  const dt = Math.min(0.08, (now - last) / 1000 || 0);
  last = now;
  if (run && screen === "combat") {
    const before = run.t,
      hits = run.hits;
    run.tick(dt, {
      x: Number(keys.has("KeyD")) - Number(keys.has("KeyA")),
      y: Number(keys.has("KeyS")) - Number(keys.has("KeyW")),
      attack,
      aim,
      ...edge,
    });
    if (run.t > before) for (const k of Object.keys(edge)) delete edge[k];
    if (run.hits > hits) beep(run.heroId === "HERO_GORO" ? 110 : 520);
    if (run.mode !== lastMode) {
      lastMode = run.mode;
      if (run.mode === "reward") rewards();
      else if (["dead", "victory"].includes(run.mode)) result();
    }
    if (now - hudAt > 80 && screen === "combat") {
      updateHUD();
      hudAt = now;
    }
  }
  draw(
    ctx,
    screen === "title" || screen === "heroes" || screen === "exit" ? null : run,
    now / 1000,
    options,
  );
  requestAnimationFrame(frame);
}
async function boot() {
  try {
    manifest =
      window.KAGE_GALLERY ||
      (await fetch("../assets/kage-in/gallery/gallery_manifest.json").then(
        (r) => {
          if (!r.ok) throw Error(r.status);
          return r.json();
        },
      ));
    if (!Array.isArray(manifest.entries)) throw Error("Invalid manifest");
    gallery = new GalleryState(manifest, store);
    title();
    requestAnimationFrame(frame);
    window.kageV5 = {
      snapshot: () => ({
        screen,
        run: run?.snapshot() || null,
        persistent: store.persistent,
        gallery: gallery.entries.map((e) => ({
          id: e.id,
          unlocked: gallery.available(e, options.reveal),
        })),
      }),
      version: "V5-web-slice",
    };
  } catch (e) {
    overlay.textContent =
      "갤러리 목록을 불러오지 못했습니다. 개발 서버 또는 단독 HTML 빌드로 실행하세요.";
    console.error(e);
  }
}
boot();
