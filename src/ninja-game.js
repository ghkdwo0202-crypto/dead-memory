import { SEALS, NINJUTSU } from "./ninjutsu-data.js";
import { NinjaGame, readNinjaRecords } from "./ninja.js";
import { renderNinja } from "./ninja-render.js";
import { createStorage } from "./storage.js";
const $ = (id) => document.getElementById(id),
  canvas = $("game"),
  ctx = canvas.getContext("2d"),
  storage = createStorage(() => localStorage);
let game = null,
  screen = "title",
  selection = 0,
  last = 0,
  lastHUD = -1,
  sound = false,
  audio = null,
  activeSounds = 0,
  shake = true,
  reducedFlash = false,
  helpReturn = "title",
  lastNotice = "",
  lastAttack = 0;
const keys = new Set();
let sealCommands = [];
let lastSpellLog = 0;
let sealTutorial = false;
let pressed = {
  dashPressed: false,
  jumpPressed: false,
  specialPressed: false,
  attackPressed: false,
};
function clearInput() {
  keys.clear();
  sealCommands = [];
  if (game) {
    game.pending = {};
    game.ninjutsu.commands = [];
    game.ninjutsu.cancelBuffered();
  }
  pressed = {
    dashPressed: false,
    jumpPressed: false,
    specialPressed: false,
    attackPressed: false,
  };
}
function beep(frequency = 330, life = 0.06) {
  if (!sound || activeSounds >= 16) return;
  try {
    audio ??= new AudioContext();
    const o = audio.createOscillator(),
      gain = audio.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(frequency, audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(
      Math.max(50, frequency * 0.5),
      audio.currentTime + life,
    );
    gain.gain.setValueAtTime(0.035, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + life);
    o.connect(gain).connect(audio.destination);
    activeSounds++;
    o.onended = () => {
      activeSounds--;
      gain.disconnect();
    };
    o.start();
    o.stop(audio.currentTime + life);
  } catch {}
}
function toggleSound() {
  sound = !sound;
  $("audio").textContent = sound ? "소리 끄기" : "소리 켜기";
  $("audio").setAttribute("aria-pressed", String(sound));
  if (sound) beep();
}
function select(index) {
  const buttons = [...$("overlay").querySelectorAll("[data-menu]")];
  if (!buttons.length) return;
  selection = (index + buttons.length) % buttons.length;
  buttons.forEach((b, i) => {
    b.classList.toggle("selected", i === selection);
    b.tabIndex = i === selection ? 0 : -1;
    b.setAttribute("aria-current", String(i === selection));
  });
  buttons[selection].focus({ preventScroll: true });
  buttons[selection].scrollIntoView({ block: "nearest" });
}
function menu(html, actions) {
  clearInput();
  $("overlay").innerHTML = `<div class="modal">${html}</div>`;
  $("overlay").classList.remove("hidden");
  [...$("overlay").querySelectorAll("[data-menu]")].forEach((b, i) => {
    b.onclick = () => {
      beep(250, 0.04);
      actions[i]?.();
    };
    b.onfocus = () => {
      selection = i;
    };
  });
  select(0);
}
function title() {
  if (game) game.mode = "paused";
  screen = "title";
  menu(
    `<div class="eyebrow">忍 / SHADOWS IN MOTION</div><h2>KAGE<span style="color:#ed7067">//</span>IN<small>칼끝에서 시작되는 공중 액션</small></h2><p>세 번 베어 띄우고, 공중에서 따라붙는다.<br>찰나의 회피로 빈틈을 만들고, 끊김 없이 다음 적에게.</p><div class="seal-preview" aria-label="화 수 뇌 풍 결인"><span>炎</span><span>水</span><span>雷</span><span>風</span></div><p class="settings-note">A A A + V로 화둔 준비, C로 발동.<br>수둔(S×3) · 뇌둔(D×3) · 풍둔(F×3)도 조합하세요.<br>V로 두 기억 슬롯 교대 · 혼합 인술은 다음 업데이트 예정.</p><div class="menu-actions"><button data-menu class="primary" id="start">출격 →</button><button data-menu id="dojo">검술 수련장</button><button data-menu>조작 안내</button><button data-menu>결인 입문 모드: ${sealTutorial ? "켜짐" : "꺼짐"}</button></div><p class="menu-hint">↑ ↓ 선택 · ENTER 확인 / PC KEYBOARD</p>`,
    [
      () => start(false),
      () => start(true),
      help,
      () => {
        sealTutorial = !sealTutorial;
        title();
        select(3);
      },
    ],
  );
}
function start(dojo = false) {
  game = new NinjaGame({ storage, dojo, sealTutorial });
  lastHUD = -1;
  lastAttack = 0;
  lastSpellLog = 0;
  lastNotice = "";
  resume();
  hud();
}
function resume() {
  if (!game) return;
  game.mode = "playing";
  screen = "play";
  clearInput();
  $("overlay").classList.add("hidden");
  canvas.focus();
}
function pause() {
  if (!game || screen !== "play") return;
  game.mode = "paused";
  screen = "pause";
  pauseMenu();
}
function pauseMenu() {
  menu(
    `<div class="eyebrow">HOLD THE FLOW</div><h2 class="help-title">호흡을 고르다.</h2><p>전투와 공중 상태가 멈춰 있습니다.</p><div class="menu-actions"><button data-menu class="primary">계속 →</button><button data-menu>조작 안내</button><button data-menu>화면 흔들림: ${shake ? "켜짐" : "꺼짐"}</button><button data-menu>광원 효과 줄이기: ${reducedFlash ? "켜짐" : "꺼짐"}</button><button data-menu>입구로</button></div><p class="menu-hint">↑ ↓ 선택 · ENTER 확인 · ESC 복귀</p>`,
    [
      resume,
      help,
      () => {
        shake = !shake;
        pauseMenu();
        select(2);
      },
      () => {
        reducedFlash = !reducedFlash;
        pauseMenu();
        select(3);
      },
      title,
    ],
  );
}
function help() {
  helpReturn = screen;
  if (game?.mode === "playing") game.mode = "paused";
  screen = "help";
  menu(
    `<div class="eyebrow">THE WAY OF THE BLADE</div><h2 class="help-title">손끝에 흐름을.</h2><div class="help-grid"><kbd>↑ ↓ ← →</kbd><span>이동 · 바라보기. WASD 이동은 사용하지 않습니다.</span><kbd>Z</kbd><span>3타 검술 · 홀드 반복. 3타가 작은 적을 띄웁니다.</span><kbd>X</kbd><span>2회 충전 회피. 실제 공격을 피하면 Z 반격 창이 열립니다.<br>검격 활성 중에는 취소할 수 없습니다.</span><kbd>SPACE</kbd><span>점프. 방향키와 함께 누르면 전방의 떠 있는 적을 추격합니다.<br>공중 추격은 한 연계에 1회, 점프 자체에는 무적이 없습니다.</span><kbd>Z → Z</kbd><span>공중 2타 후 짧은 시간 안에 ↓+Z: 착지 격추.<br>↓는 이동키이므로 지상에서는 일반 공격입니다.</span><kbd>C</kbd><span>준비한 인술 발동. 인술이 없으면 4초 쿨다운 표창.</span><kbd>ESC</kbd><span>일시정지 · 흔들림/광원 효과 설정.</span></div><p class="settings-note">A/S/D/F: 화/수/뇌/풍 인. 같은 키 3번 → V 준비 → C 발동.<br>인이 비어 있을 때 V로 두 슬롯 교대. 조합은 순서와 무관합니다.<br>화둔은 지상 전용, 뇌둔은 전방 표적 필요. 두 준비 인술은 쿨다운을 공유하지 않습니다.</p><div class="menu-actions"><button data-menu class="primary" id="close-help">알겠습니다 →</button></div>`,
    [
      () => {
        if (helpReturn === "play") resume();
        else if (helpReturn === "pause") {
          screen = "pause";
          pauseMenu();
        } else if (helpReturn === "reward") rewards();
        else title();
      },
    ],
  );
}
function rewards() {
  screen = "reward";
  const names = {
    health: ["활력 수련", "최대 체력 +20 · 체력 40 회복"],
    speed: ["경공 수련", "이동 속도 +5% · 최대 +30%"],
    breath: ["호흡 정돈", "회피 2회 충전 · 남은 인술 대기시간 2초 감소"],
  };
  menu(
    `<div class="eyebrow">LEVEL ${game.level} / REFINE THE FLOW</div><h2 class="help-title">다음 교전을 준비하다.</h2><p>선택하는 동안 전투와 재사용 대기시간이 멈춥니다.</p><div class="menu-actions">${game.rewardChoices.map((r) => `<button data-menu><b>${names[r.id][0]}</b><br><small>${names[r.id][1]}</small></button>`).join("")}</div><p class="menu-hint">↑ ↓ 선택 · ENTER 확인</p>`,
    game.rewardChoices.map((r, i) => () => {
      if (game.choose(i)) {
        if (game.mode === "levelup") rewards();
        else resume();
        hud();
      }
    }),
  );
}
function result() {
  screen = "result";
  menu(
    `<div class="eyebrow">EVERY SHADOW FALLS</div><h2 class="help-title">다음 칼날은, 더 날카롭게.</h2><p>${game.cause}에게 쓰러졌습니다.<br>교전 ${timeLabel(game.t)} · ${game.kills} 처치 · 스타일 ${game.styleRank()}<br>${game.dojo ? "수련 기록은 저장하지 않습니다." : game.saved ? "이번 교전 기록을 저장했습니다." : "기록은 현재 탭에서만 유지됩니다."}</p><div class="menu-actions"><button data-menu class="primary">다시 출격 →</button><button data-menu>검술 수련장</button><button data-menu>입구로</button></div>`,
    [() => start(false), () => start(true), title],
  );
}
const timeLabel = (t) =>
  `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
function hud() {
  if (!game) return;
  const p = game.player;
  $("hp-text").textContent = `${Math.ceil(p.hp)} / ${p.maxHP}`;
  $("hp-fill").style.width = `${Math.max(0, (p.hp / p.maxHP) * 100)}%`;
  $("dashes").textContent =
    p.dashes === 2 ? "▰ ▰" : p.dashes === 1 ? "▰ ▱" : "▱ ▱";
  $("special-cd").textContent =
    p.specialAt > game.t ? `${(p.specialAt - game.t).toFixed(1)}s` : "READY";
  const n = game.ninjutsu,
    spell = NINJUTSU[n.invoked[0]],
    preview = n.preview();
  if (spell)
    $("special-cd").textContent =
      (n.cooldowns[spell.id] || 0) > game.t
        ? `${(n.cooldowns[spell.id] - game.t).toFixed(1)}s`
        : "READY";
  document.querySelectorAll(".seal-keys span").forEach((node, i) => {
    const element = Object.keys(SEALS)[i],
      open = n.unlocked(element);
    node.style.opacity = open ? "1" : ".35";
    node.title = open
      ? `${SEALS[element].name}인 입력`
      : `입문 모드: ${element === "lightning" ? 60 : 90}초 뒤 개방`;
  });
  $("seal-ring").innerHTML = [0, 1, 2]
    .map((i) => {
      const e = SEALS[n.ring[i]];
      return `<span class="seal-cell" style="--seal:${e?.color || "#536474"}">${e?.glyph || "·"}</span>`;
    })
    .join("");
  $("seal-preview").textContent = preview
    ? `${preview.name}${preview.implemented ? " · V 준비" : " · 혼합 인술 예정"}`
    : `${n.ring.length}/3 결인 · 같은 인 세 개를 입력하세요`;
  $("spell-slots").innerHTML = n.invoked
    .map((id, i) => {
      const d = NINJUTSU[id],
        cd = Math.max(0, (n.cooldowns[id] || 0) - game.t),
        e = SEALS[d?.element];
      return `<div class="spell-slot ${i === 0 ? "selected-spell" : ""}" style="--seal:${e?.color || "#536474"}"><span class="spell-glyph">${e?.glyph || "∅"}</span><div><small>${i === 0 ? "C / 발동" : "V / 교대"}</small><b>${d?.name || "빈 기억 슬롯"}</b><span>${d ? d.description : "결인 3개 → V로 준비"}</span></div><strong>${d ? (cd ? cd.toFixed(1) + "s" : "READY") : "—"}</strong></div>`;
    })
    .join("");
  if (n.logs.length !== lastSpellLog) {
    beep(
      { fire: 170, water: 290, lightning: 110, wind: 620 }[spell?.element] ||
        330,
      0.1,
    );
    lastSpellLog = n.logs.length;
  }
  $("style-rank").textContent = game.styleRank();
  $("style-cue").textContent =
    p.perfectDodgeWindowEnd > game.t
      ? "간파! Z로 60px 반격 찌르기."
      : p.airHeight > 0
        ? "공중 검격 → 두 번째 타 뒤 ↓+Z"
        : "검격 · 추격 · 회피로 흐름을 이어가세요.";
  $("momentum").textContent = [1, 2, 3]
    .map((n) => (p.momentum >= n ? "●" : "○"))
    .join(" ");
  $("air-state").textContent =
    p.airHeight > 0
      ? `${p.followUsed ? "공중 추격" : "체공"} · 검격 ${Math.min(2, p.airHits)}/2`
      : "지상";
  $("air-fill").style.width = `${p.airHeight * 100}%`;
  $("kills").textContent = String(game.kills).padStart(3, "0");
  $("time").textContent = timeLabel(game.t);
  $("enemy-count").textContent =
    `${game.dojo ? "TRAINING" : "HOSTILES"} / ${String(game.enemies.length).padStart(2, "0")}`;
  $("objective").textContent = game.dojo
    ? "수련장 · 고정 표적 / ESC로 입구 복귀"
    : "Z3 띄우기 → 방향키 + Space 추격 → 공중 Z → ↓+Z";
  const notice = game.notifications.at(-1);
  $("notice").classList.toggle("hidden", !notice);
  if (notice) {
    $("notice").replaceChildren();
    const strong = document.createElement("strong"),
      small = document.createElement("span");
    strong.textContent = notice.text;
    small.textContent = notice.sub;
    $("notice").append(strong, small);
    if (lastNotice !== notice.text) {
      beep(notice.text.includes("간파") ? 720 : 280, 0.1);
      lastNotice = notice.text;
    }
  }
  if (p.stats.attacks !== lastAttack) {
    beep([280, 360, 190][(p.comboIndex + 2) % 3], 0.05);
    lastAttack = p.stats.attacks;
  }
}
window.addEventListener("keydown", (e) => {
  const code = e.code;
  if (
    [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "KeyZ",
      "KeyX",
      "KeyC",
      "KeyA",
      "KeyS",
      "KeyD",
      "KeyF",
      "KeyV",
      "Space",
      "Escape",
      "Enter",
    ].includes(code)
  )
    e.preventDefault();
  if (screen !== "play") {
    if (code === "ArrowDown" || code === "ArrowRight") select(selection + 1);
    if (code === "ArrowUp" || code === "ArrowLeft") select(selection - 1);
    if (e.repeat) return;
    if (code === "Enter")
      $("overlay").querySelectorAll("[data-menu]")[selection]?.click();
    if (code === "Escape") {
      if (screen === "pause") resume();
      else if (screen === "help") $("close-help").click();
    }
    return;
  }
  if (code === "Escape" && !e.repeat) {
    pause();
    return;
  }
  keys.add(code);
  if (!e.repeat) {
    const element = {
      KeyA: "fire",
      KeyS: "water",
      KeyD: "lightning",
      KeyF: "wind",
    }[code];
    if (element) {
      sealCommands.push(element);
      beep(
        { fire: 340, water: 420, lightning: 580, wind: 720 }[element],
        0.035,
      );
    }
    if (code === "KeyV") sealCommands.push("invoke");
    if (code === "KeyZ") pressed.attackPressed = true;
    if (code === "KeyX") pressed.dashPressed = true;
    if (code === "Space") pressed.jumpPressed = true;
    if (code === "KeyC") pressed.specialPressed = true;
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => {
  clearInput();
  pause();
});
$("help").onclick = help;
$("audio").onclick = toggleSound;
$("audio").textContent = "소리 켜기";
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000 || 0);
  last = now;
  if (screen === "play" && game?.mode === "playing") {
    game.tick(dt, {
      up: keys.has("ArrowUp"),
      down: keys.has("ArrowDown"),
      left: keys.has("ArrowLeft"),
      right: keys.has("ArrowRight"),
      attack: keys.has("KeyZ"),
      sealCommands,
      ...pressed,
    });
    sealCommands = [];
    pressed = {
      dashPressed: false,
      jumpPressed: false,
      specialPressed: false,
      attackPressed: false,
    };
    if (game.t - lastHUD > 0.075 || game.mode !== "playing") {
      hud();
      lastHUD = game.t;
    }
    if (game.mode === "dead") result();
    else if (game.mode === "levelup") rewards();
  }
  renderNinja(ctx, screen === "title" ? null : game, now / 1000, {
    shake,
    reducedFlash,
  });
  requestAnimationFrame(frame);
}
window.kageIn = {
  snapshot: () => ({
    screen,
    selection,
    sound,
    shake,
    reducedFlash,
    ...(game?.snapshot() || {
      mode: "title",
      records: readNinjaRecords(storage).length,
    }),
  }),
};
title();
requestAnimationFrame(frame);
