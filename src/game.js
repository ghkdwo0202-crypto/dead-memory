import { Game, loadDeaths } from "./core.js";
import {
  ORGANS,
  MUTATIONS,
  SLOTS,
  SLOT_COLORS,
  CONFIG,
  ACTION_UPGRADES,
  actionRank,
} from "./data.js";
import { render } from "./render.js";
import { createStorage } from "./storage.js";
const $ = (id) => document.getElementById(id),
  canvas = $("game"),
  ctx = canvas.getContext("2d");
const icons = {
  ARM_SAW: "✷",
  ARM_SPINE: "⋔",
  BACK_TENTACLE: "෴",
  BACK_TURRET: "⌖",
  BACK_BLADES: "✣",
  HEART_HUNGER: "♡",
  HEART_BLAST: "◈",
  EYE_BLOOD: "◉",
  EYE_HUNTER: "⊙",
};
const storage = createStorage(() => localStorage);
let game = null,
  screen = "title",
  shown = "",
  selection = 0,
  forceHunter = false,
  sound = false,
  audio = null,
  keys = new Set(),
  pressed = { dash: false, special: false },
  last = 0,
  lastHUD = -1,
  camera = { x: 600, y: 420 },
  lastNotify = "",
  helpReturn = "title";
const timeLabel = (t) =>
  `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
function beep(freq = 300, duration = 0.08) {
  if (!sound) return;
  try {
    audio ??= new AudioContext();
    const o = audio.createOscillator(),
      gain = audio.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(freq, audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(
      freq * 0.65,
      audio.currentTime + duration,
    );
    gain.gain.setValueAtTime(0.05, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    o.connect(gain).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + duration);
  } catch {}
}
function toggleSound() {
  sound = !sound;
  $("audio").textContent = sound ? "소리 끄기" : "소리 켜기";
  $("audio").setAttribute("aria-pressed", String(sound));
  if (sound) beep();
}
function setSelection(index) {
  const buttons = [...$("overlay").querySelectorAll("[data-menu]")];
  if (!buttons.length) return;
  selection = (index + buttons.length) % buttons.length;
  buttons.forEach((b, i) => {
    b.classList.toggle("selected", i === selection);
    b.setAttribute("aria-current", String(i === selection));
    b.tabIndex = i === selection ? 0 : -1;
  });
  buttons[selection].focus({ preventScroll: true });
  buttons[selection].scrollIntoView({ block: "nearest", inline: "nearest" });
}
function modal(html, actions) {
  keys.clear();
  pressed = { dash: false, special: false };
  $("overlay").innerHTML = `<div class="modal">${html}</div>`;
  $("overlay").classList.remove("hidden");
  const buttons = [...$("overlay").querySelectorAll("[data-menu]")];
  buttons.forEach((b, i) => {
    b.onclick = () => {
      beep(280, 0.045);
      actions[i]?.();
    };
    b.onfocus = () => {
      selection = i;
      buttons.forEach((el, j) => el.classList.toggle("selected", i === j));
    };
  });
  setSelection(0);
}
function start(previewActions = false) {
  game = new Game({ storage, forceHunter, previewActions });
  if (previewActions)
    game.notify(
      "톱날 운용 · 완성형 미리보기",
      "이 런은 사망 기록을 저장하지 않습니다.",
    );
  screen = "play";
  shown = "";
  lastHUD = -1;
  lastNotify = "";
  $("overlay").classList.add("hidden");
  $("permit-number").textContent = String(
    loadDeaths(storage).length + 1,
  ).padStart(4, "0");
  canvas.focus();
  updateHUD();
}
function title() {
  screen = "title";
  shown = "title";
  const records = loadDeaths(storage);
  modal(
    `<span class="poster-tag">FRESH BODIES. BETTER PRICES.</span><h2 class="poster-title">MEAT<span>MARKET</span></h2><p>괴물을 죽이고, 몸을 바꾸고, 살아서 돌아오세요.<br>죽은 사냥꾼도 이곳에서는 상품입니다.</p><div class="menu-actions"><button data-menu class="primary" id="start">사냥터 입장 →</button><button data-menu id="force-hunter">이전 상품 테스트: ${records.length ? (forceHunter ? "켜짐 · 18초 후 출현" : "꺼짐") : "저장된 기록 없음"}</button><button data-menu id="open-help">조작 안내</button><button data-menu id="menu-sound">${sound ? "소리 끄기" : "소리 켜기"}</button><button data-menu id="action-preview">완성형 톱날 액션 미리보기</button></div><p class="menu-hint">↑ ↓ 선택 · ENTER 확인 / KEYBOARD ONLY / 5–8 MIN RUN</p>`,
    [
      start,
      () => {
        if (records.length) forceHunter = !forceHunter;
        title();
      },
      openHelp,
      () => {
        toggleSound();
        title();
      },
      () => start(true),
    ],
  );
}
function resume() {
  if (!game) return;
  game.mode = "playing";
  screen = "play";
  shown = "";
  keys.clear();
  pressed = { dash: false, special: false };
  $("overlay").classList.add("hidden");
  canvas.focus();
}
function pause() {
  if (!game || game.mode !== "playing") return;
  game.mode = "paused";
  screen = "pause";
  shown = "pause";
  modal(
    `<div class="eyebrow">THE MARKET CAN WAIT.</div><h2>잠시 영업 중단.</h2><p>사냥과 성장 시간은 멈춰 있습니다.</p><div class="menu-actions"><button data-menu class="primary" id="resume">계속 사냥하기</button><button data-menu>조작 안내</button><button data-menu>소리 켜기 / 끄기</button><button data-menu>공격 콘 표시: ${game.debugTargeting ? "켜짐" : "꺼짐"}</button></div><p class="menu-hint">↑ ↓ 선택 · ENTER 확인 · ESC 복귀</p>`,
    [
      resume,
      openHelp,
      () => {
        toggleSound();
      },
      () => {
        game.debugTargeting = !game.debugTargeting;
        game.mode = "playing";
        pause();
      },
    ],
  );
}
function openHelp() {
  if (game && ["levelup", "inherit", "dead", "victory"].includes(game.mode))
    return;
  helpReturn = game?.mode === "playing" ? "play" : screen;
  if (game?.mode === "playing") game.mode = "paused";
  screen = "help";
  shown = "help";
  modal(
    '<div class="eyebrow">A SHORT GUIDE TO STAYING ALIVE</div><h2>몸값을 올리는 방법.</h2><div class="help-grid"><span><kbd>↑ ↓ ← →</kbd> 8방향 이동</span><span><kbd>Z</kbd> 기본 공격 / 길게 누르기</span><span><kbd>X</kbd> 회피 / 2회 충전</span><span><kbd>C</kbd> 팔 기관 특수 공격</span><span><kbd>↑ ↓</kbd> 메뉴 선택</span><span><kbd>ENTER</kbd> 확인</span><span><kbd>ESC</kbd> 일시정지 / 취소</span><span>마우스 조준은 없습니다.</span></div><p>이동 방향을 기준으로 가까운 적에게 공격이 보정됩니다.<br>초록 경험치 조각을 주우면 기관과 변이를 선택합니다.<br>팔: 직접 공격 · 등: 자동 공격 · 심장과 눈: 빌드 시너지<br>같은 적에게 Z 3타를 맞히면 강화 베기와 출혈이 발생합니다.<br>레벨업에서 톱날 운용을 선택하면 X→Z, 3타→C, C→Z가 열립니다.<br>주황 전조를 보고 X로 회피하세요. 5분 후 주인이 등장합니다.<br>사망한 빌드는 같은 브라우저에 최대 8개 저장됩니다.<br>플레이에는 PC 키보드가 필요합니다.</p><div class="menu-actions"><button data-menu class="primary" id="close-help">확인</button></div>',
    [
      () => {
        if (helpReturn === "title") title();
        else if (helpReturn === "pause") {
          game.mode = "playing";
          pause();
        } else resume();
      },
    ],
  );
}
function rewardInfo(reward) {
  if (reward.kind === "action") {
    const d = ACTION_UPGRADES[reward.id],
      rank = game.player.actionRanks[d.id] || 0,
      next = d.ranks[rank];
    return {
      title: next.name,
      description: next.description,
      label: `톱날 운용 ${rank + 1}/${d.maxRank} / 액션 강화`,
      icon: "↯",
      color: "#f3ba82",
      note: "공격 동작 변화 · 기관 획득 대신 선택",
    };
  }
  if (reward.kind === "organ") {
    const o = ORGANS[reward.id],
      old = game.player.organs[o.slot];
    return {
      title: o.name,
      description: o.description,
      label: `${SLOTS[o.slot]} 기관 / ${old ? "교체" : "이식"}`,
      icon: icons[o.id],
      color: SLOT_COLORS[o.slot],
      note: old
        ? `${ORGANS[old].name} 대체 · 연결 변이 제거`
        : "새로운 신체 슬롯 활성화",
    };
  }
  if (reward.kind === "mutation") {
    const m = MUTATIONS[reward.id],
      o = ORGANS[reward.organID];
    return {
      title: m.name,
      description: m.description,
      label: `변이 / ${o.name}`,
      icon: "✢",
      color: "#cfcd87",
      note: "현재 기관과 호환 · 행동 변화",
    };
  }
  const map = {
      damage: ["근섬유 강화", "모든 피해 +10%.", "공격력 강화"],
      health: ["생체 봉합", "최대 체력 +20, 체력 35 회복.", "생존 강화"],
      speed: ["신경 가속", "이동 속도 +5%.", "기동 강화"],
    },
    [title, description, label] = map[reward.id];
  return {
    title,
    description,
    label,
    icon: "+",
    color: "#c4c396",
    note: "현재 신체에 즉시 적용",
  };
}
function showRewards() {
  const inherit = game.mode === "inherit";
  screen = "reward";
  shown = `${game.mode}:${game.level}`;
  const cards = game.rewardChoices
    .map((r, i) => {
      const v = rewardInfo(r);
      return `<button data-menu class="reward-card" data-reward="${i}" style="--organ-color:${v.color}"><span class="selection-index">0${i + 1}</span><span class="organ-icon">${v.icon}</span><small>${v.label}</small><strong>${v.title}</strong><p>${v.description}</p><span class="synergy">${r.synergy ? "↗ 빌드 연결 · " : ""}${v.note}</span></button>`;
    })
    .join("");
  modal(
    `<div class="reward-header"><div class="eyebrow">${inherit ? "PREVIOUS OWNER: DECEASED" : "LEVEL " + String(game.level).padStart(2, "0") + " / BODY MODIFICATION"}</div><h2>${inherit ? "소유권을 이전합니다." : "어디까지 인간일 건가요?"}</h2><p>${inherit ? "추적자가 실제 보유한 기관 또는 호환 변이입니다." : "기관을 이식하거나 변이하세요. 선택하는 동안 사냥은 멈춥니다."}</p></div><div class="reward-cards">${cards}</div><p class="menu-hint">↑ ↓ 선택 · ENTER 이식 / 되돌릴 수 없습니다.</p>`,
    game.rewardChoices.map((_, i) => () => {
      if (game.choose(i)) {
        shown = "";
        if (game.mode === "levelup" || game.mode === "inherit") {
          showRewards();
          updateHUD();
          return;
        }
        screen = "play";
        $("overlay").classList.add("hidden");
        keys.clear();
        canvas.focus();
        updateHUD();
      }
    }),
  );
}
function showResult() {
  const won = game.mode === "victory";
  screen = "result";
  shown = game.mode;
  const p = game.player,
    organs = Object.values(p.organs)
      .filter(Boolean)
      .map((id) => ORGANS[id].name)
      .join(" · "),
    mutations =
      p.mutations.map((m) => MUTATIONS[m.id].name).join(" · ") || "없음";
  modal(
    `<div class="eyebrow">${won ? "PAYMENT AUTHORIZED" : game.previewActions ? "ACTION PREVIEW / NOT ARCHIVED" : "LOT CLOSED / " + (game.saved ? "BUILD ARCHIVED" : "SAVE FAILED")}</div><h2>${won ? "살아서 돌아온 <em>상품.</em>" : "다음 주인을 <em>기다립니다.</em>"}</h2><p>${won ? "도축장 주인을 처치했습니다. 이번 사냥의 수익은 당신 것입니다." : game.previewActions ? "미리보기가 끝났습니다. 일반 사냥에서는 톱날 운용을 성장 보상으로 선택하세요." : `${game.cause}에게 쓰러졌습니다. 당신이 만든 빌드가 다음 사냥터에 남습니다.`}</p><div class="result-stats"><span><b>${timeLabel(game.t)}</b>생존 시간</span><span><b>${game.kills}</b>처치</span><span><b>${game.level}</b>신체 레벨</span></div><p class="result-build">${organs}<br>변이: ${mutations}<br>피해 / 직접 ${Math.round(p.stats.direct)} · 자동 ${Math.round(p.stats.auto)} · 변이 ${Math.round(p.stats.mutation)}<br>${won ? "탈출한 빌드는 사망 기록에 추가되지 않습니다." : game.previewActions ? "미리보기 런은 사망 기록을 저장하지 않습니다." : !game.saved ? "기록을 저장하지 못했습니다." : storage.persistent ? "추적자 기록을 브라우저에 저장했습니다." : "저장이 차단되어 현재 탭에서만 기록됩니다."}</p><div class="menu-actions"><button data-menu class="primary" id="restart">다시 사냥하기 →</button><button data-menu id="return-title">시장 입구로</button></div>`,
    [() => start(game.previewActions), title],
  );
}
function syncScreen() {
  if (!game || screen === "title" || screen === "help" || screen === "pause")
    return;
  if (
    ["levelup", "inherit"].includes(game.mode) &&
    shown !== `${game.mode}:${game.level}`
  )
    showRewards();
  if (["dead", "victory"].includes(game.mode) && shown !== game.mode)
    showResult();
}
function updateHUD() {
  if (!game) return;
  const p = game.player;
  $("hp-text").textContent = `${Math.ceil(p.hp)} / ${p.maxHP}`;
  $("hp-fill").style.width = `${Math.max(0, (p.hp / p.maxHP) * 100)}%`;
  $("dash-indicator").textContent =
    p.dashes === 2 ? "▰ ▰" : p.dashes === 1 ? "▰ ▱" : "▱ ▱";
  $("special-cd").textContent =
    p.specialAt > game.t ? `${(p.specialAt - game.t).toFixed(1)}s` : "READY";
  $("level").textContent = `LV. ${String(game.level).padStart(2, "0")}`;
  $("xp-fill").style.width =
    `${Math.min(100, (game.xp / game.xpRequired) * 100)}%`;
  $("xp-text").textContent = `${game.xp} / ${game.xpRequired}`;
  $("organs").innerHTML = Object.entries(SLOTS)
    .map(([slot, label]) => {
      const id = p.organs[slot],
        o = ORGANS[id];
      return `<div class="organ" style="--organ-color:${SLOT_COLORS[slot]}"><div class="organ-icon">${icons[id] || "+"}</div><div><div class="organ-name">${o?.name || "이식되지 않음"}</div><div class="organ-sub">${slot.toUpperCase()} / ${o ? "GRAFTED" : "VACANT"}</div></div><span class="organ-slot">${label}</span></div>`;
    })
    .join("");
  const flow = ACTION_UPGRADES.ARM_SAW_FLOW,
    rank = actionRank(p),
    combo = game.t <= p.sawCombo.until ? p.sawCombo.hits : 0;
  let cue = combo
    ? `같은 적 연격 ${combo}/3 · 다음 Z 적중을 노리세요.`
    : "같은 적에게 Z 세 번 적중하면 강화 3타와 출혈.";
  if (
    rank >= 1 &&
    game.t - p.lastDashAt <= flow.dashWindow &&
    p.dashLinkUsed !== p.dashSerial
  )
    cue = "Z · 돌파 베기 준비 — 짧게 파고듭니다.";
  if (rank >= 2 && p.finisherUntil > game.t)
    cue =
      p.specialAt <= game.t
        ? "C · 회수 회전 준비! 주변 적을 끌어모아 마무리."
        : "연격 마무리 준비 · C 쿨다운을 확인하세요.";
  $("action-cue").textContent =
    p.organs.arm === "ARM_SAW"
      ? cue
      : "가시 팔 · 방향을 잡고 Z, 포위되기 전에 C 부채꼴 사격.";
  $("action-rank").textContent =
    p.organs.arm === "ARM_SAW" ? `톱날 운용 ${rank}/3` : "가시 발사 팔";
  $("action-stages").innerHTML = flow.ranks
    .map(
      (r, i) =>
        `<span class="action-stage ${rank > i ? "unlocked" : ""}"><b>${i + 1}</b>${r.name}</span>`,
    )
    .join("");
  $("action-window").style.width =
    p.finisherUntil > game.t
      ? Math.min(
          100,
          ((p.finisherUntil - game.t) / flow.finisherWindow) * 100,
        ) + "%"
      : "0%";
  $("mutation-count").textContent = String(p.mutations.length).padStart(2, "0");
  $("mutations").innerHTML = p.mutations.length
    ? p.mutations
        .map(
          (m) =>
            `<span class="mutation" title="${ORGANS[m.organID].name}: ${MUTATIONS[m.id].description}">${MUTATIONS[m.id].name}</span>`,
        )
        .join("")
    : '<span class="dim">다음 성장을 기다리는 중.</span>';
  $("time").textContent = timeLabel(game.t);
  $("kills").textContent = String(game.kills).padStart(3, "0");
  $("value").textContent = (
    12000 +
    game.level * 3500 +
    game.kills * 170 +
    p.mutations.length * 4000
  ).toLocaleString("ko-KR");
  $("population").textContent = `${game.enemies.length} LIVE SPECIMENS`;
  $("objective").textContent =
    game.boss && !game.boss.dead
      ? "도축장 주인을 처치하고 탈출하세요."
      : game.t < 18
        ? "Z로 공격하고, 경험치 조각을 수집하세요."
        : "5분까지 살아남으세요. 새 기관으로 몸값을 올리세요.";
  const major =
    game.boss && !game.boss.dead
      ? game.boss
      : game.hunter && !game.hunter.dead
        ? game.hunter
        : null;
  $("boss-hud").classList.toggle("hidden", !major);
  if (major) {
    $("boss-name").textContent =
      major === game.boss ? "도축장 주인" : "이전의 사냥꾼 · " + major.state;
    $("boss-hp").textContent = `${Math.ceil(major.hp)} HP`;
    $("boss-fill").style.width =
      `${Math.max(0, (major.hp / major.maxHP) * 100)}%`;
  }
  const notice = game.notifications.at(-1);
  $("notice").classList.toggle("hidden", !notice);
  if (notice) {
    $("notice").replaceChildren();
    const b = document.createElement("strong"),
      s = document.createElement("span");
    b.textContent = notice.text;
    s.textContent = notice.sub;
    $("notice").append(b, s);
    if (lastNotify !== notice.text) {
      beep(notice.text.includes("상품") ? 190 : 280, 0.13);
      lastNotify = notice.text;
    }
  }
}
window.addEventListener("keydown", (event) => {
  const code = event.code;
  if (
    [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Enter",
      "Escape",
      "Space",
      "KeyZ",
      "KeyX",
      "KeyC",
    ].includes(code)
  )
    event.preventDefault();
  const inMenu = !$("overlay").classList.contains("hidden");
  if (inMenu) {
    if (code === "ArrowUp" || code === "ArrowLeft") setSelection(selection - 1);
    if (code === "ArrowDown" || code === "ArrowRight")
      setSelection(selection + 1);
    if (event.repeat) return;
    if (code === "Enter")
      $("overlay").querySelectorAll("[data-menu]")[selection]?.click();
    if (code === "Escape") {
      if (screen === "help") $("close-help").click();
      else if (screen === "pause") resume();
    }
    return;
  }
  if (code === "Escape" && !event.repeat) {
    pause();
    return;
  }
  keys.add(code);
  if (!event.repeat) {
    if (code === "KeyX") pressed.dash = true;
    if (code === "KeyC") pressed.special = true;
  }
});
window.addEventListener("keyup", (event) => keys.delete(event.code));
window.addEventListener("blur", () => {
  keys.clear();
  pressed = { dash: false, special: false };
  if (game?.mode === "playing" && screen === "play") pause();
});
$("help").onclick = openHelp;
$("audio").onclick = () => {
  toggleSound();
  if (screen === "title") title();
};
function frame(now) {
  const dt = Math.min(0.04, (now - last) / 1000 || 0);
  last = now;
  if (game?.mode === "playing" && screen === "play") {
    const inputProcessed = game.tick(dt, {
      up: keys.has("ArrowUp"),
      down: keys.has("ArrowDown"),
      left: keys.has("ArrowLeft"),
      right: keys.has("ArrowRight"),
      attack: keys.has("KeyZ"),
      dashPressed: pressed.dash,
      specialPressed: pressed.special,
    });
    if (inputProcessed) pressed = { dash: false, special: false };
    if (game.t - lastHUD > 0.08 || game.mode !== "playing") {
      updateHUD();
      lastHUD = game.t;
    }
    syncScreen();
  }
  camera = render(ctx, screen === "title" ? null : game, now / 1000);
  requestAnimationFrame(frame);
}
title();
requestAnimationFrame(frame);
window.meatMarket = {
  snapshot: () => ({
    screen,
    selection,
    persistent: storage.persistent,
    forceHunter,
    camera: { ...camera },
    ...(game?.snapshot() || {
      mode: "title",
      records: loadDeaths(storage).length,
    }),
  }),
};
