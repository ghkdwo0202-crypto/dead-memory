import { SideGame } from "./sideview-core.js";
import { renderSide } from "./sideview-render.js";
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
  shake = true,
  lowFlash = false,
  sound = false,
  audio = null,
  lastNotice = "",
  helpReturn = "title";
const keys = new Set();
let edges = {};
function clear() {
  keys.clear();
  edges = {};
  if (game) game.pending = {};
}
function beep(f = 300) {
  if (!sound) return;
  try {
    audio ??= new AudioContext();
    const o = audio.createOscillator(),
      a = audio.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(f, audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(f * 0.5, audio.currentTime + 0.07);
    a.gain.setValueAtTime(0.025, audio.currentTime);
    a.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.08);
    o.connect(a).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + 0.08);
    o.onended = () => a.disconnect();
  } catch {}
}
function select(i) {
  const bs = [...$("overlay").querySelectorAll("[data-menu]")];
  if (!bs.length) return;
  selection = (i + bs.length) % bs.length;
  bs.forEach((b, j) => {
    b.classList.toggle("selected", j === selection);
    b.tabIndex = j === selection ? 0 : -1;
  });
  bs[selection].focus({ preventScroll: true });
  bs[selection].scrollIntoView({ block: "nearest" });
}
function menu(html, actions) {
  clear();
  $("overlay").innerHTML = `<div class="modal">${html}</div>`;
  $("overlay").classList.remove("hidden");
  [...$("overlay").querySelectorAll("[data-menu]")].forEach((b, i) => {
    b.onclick = () => {
      beep();
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
    `<div class="eyebrow">月影 / BLADE UNDER THE MOON</div><h2>KAGE<span style="color:#ed756a">//</span>IN<small>월하 성문</small></h2><p>성벽을 딛고 뛰어오르고, 아래로 베어 다시 날아오른다.<br>적의 공격을 간파한 찰나에, 반격의 칼날을 올려라.</p><p>실제 점프와 발판이 있는 횡스크롤 액션 버전입니다.<br>C는 근접 피니시입니다. V·기억 슬롯은 사용하지 않습니다.<br>속성 자동 결인은 다음 단계에서 추가됩니다.</p><div class="menu-actions"><button data-menu class="primary" id="start">성문 돌파 →</button><button data-menu>검술 수련장</button><button data-menu>조작 안내</button></div><p class="menu-hint">↑ ↓ 선택 · ENTER 확인</p>`,
    [() => start("run"), () => start("dojo"), help],
  );
}
function start(demo) {
  game = new SideGame({ storage, demo });
  lastHUD = -1;
  lastNotice = "";
  resume();
  hud();
}
function resume() {
  game.mode = "playing";
  screen = "play";
  clear();
  $("overlay").classList.add("hidden");
  canvas.focus();
}
function pause() {
  if (screen !== "play" || game?.mode !== "playing") return;
  game.mode = "paused";
  screen = "pause";
  pauseMenu();
}
function pauseMenu() {
  menu(
    `<div class="eyebrow">HOLD THE BLADE</div><h2 class="compact">호흡을 고르다.</h2><p>물리·전투·쿨다운이 모두 멈췄습니다.</p><div class="menu-actions"><button data-menu class="primary">계속 →</button><button data-menu>조작 안내</button><button data-menu>흔들림: ${shake ? "켜짐" : "꺼짐"}</button><button data-menu>광원 효과 줄이기: ${lowFlash ? "켜짐" : "꺼짐"}</button><button data-menu>입구로</button></div>`,
    [
      resume,
      help,
      () => {
        shake = !shake;
        pauseMenu();
        select(2);
      },
      () => {
        lowFlash = !lowFlash;
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
    `<div class="eyebrow">FOOTWORK / STEEL / TIMING</div><h2 class="compact">성벽 위의 검술.</h2><div class="help-grid"><kbd>← →</kbd><span>좌우 달리기 · 바라보기. ↑는 조준, ↓는 공중 빠른 낙하.</span><kbd>SPACE</kbd><span>실제 점프. 길게 누르면 높이 뜁니다.<br>발판 끝 직후에도 점프 가능. 일방향 발판에서는 ↓+Space로 내려가기.</span><kbd>Z</kbd><span>지상 3타 / 공중 2타. 홀드 반복.<br>↑+Z 상향 베기, 공중 ↓+Z 적중 시 포고 반동 점프.</span><kbd>X</kbd><span>회피 2충전, 공중에서는 착지 전 1회.<br>벽을 뚫지 않습니다. X 직후 Z는 짧은 돌파 베기.</span><kbd>C</kbd><span>지상 상향 발도 / 공중 하향 격추. 2.8초 쿨다운.<br>실제 공격 회피 성공 시 0.55초 동안 반격 피니시 강화.</span><kbd>ESC</kbd><span>정지·흔들림/광원 효과 설정. V는 사용하지 않습니다.</span></div><div class="menu-actions"><button data-menu class="primary" id="close-help">알겠습니다 →</button></div>`,
    [
      () => {
        if (helpReturn === "play") resume();
        else if (helpReturn === "pause") {
          screen = "pause";
          pauseMenu();
        } else if (helpReturn === "reward") reward();
        else title();
      },
    ],
  );
}
function reward() {
  screen = "reward";
  const defs = {
    health: ["활력", "최대 체력 +20 · 체력 40 회복"],
    speed: ["경공", "좌우 속도 +5% · 최대 +25%"],
    breath: ["호흡", "회피 충전 · 피니시 준비"],
  };
  menu(
    `<div class="eyebrow">LEVEL ${game.level}</div><h2 class="compact">다음 성벽을 향해.</h2><div class="menu-actions">${game.rewardChoices.map((id) => `<button data-menu>${defs[id][0]}<small>${defs[id][1]}</small></button>`).join("")}</div>`,
    game.rewardChoices.map((_, i) => () => {
      if (game.choose(i)) {
        resume();
        hud();
      }
    }),
  );
}
function result() {
  screen = "result";
  menu(
    `<div class="eyebrow">EVERY SHADOW FALLS</div><h2 class="compact">다시, 칼을 고르다.</h2><p>처치 ${game.kills} · 스타일 ${game.styleRank()}<br>다음 도전에서는 발판과 적의 빈틈을 이용하세요.</p><div class="menu-actions"><button data-menu class="primary">다시 도전 →</button><button data-menu>수련장</button><button data-menu>입구로</button></div>`,
    [() => start("run"), () => start("dojo"), title],
  );
}
function hud() {
  if (!game) return;
  const p = game.player;
  $("hp-text").textContent = `${Math.ceil(p.hp)} / ${p.maxHP}`;
  $("hp-fill").style.width = `${Math.max(0, (p.hp / p.maxHP) * 100)}%`;
  $("dash").textContent =
    p.dashes === 2 ? "▰ ▰" : p.dashes === 1 ? "▰ ▱" : "▱ ▱";
  $("finisher").textContent =
    p.finisherAt > game.t ? `${(p.finisherAt - game.t).toFixed(1)}s` : "READY";
  $("style").textContent = game.styleRank();
  $("cue").textContent =
    p.perfectUntil > game.t
      ? "간파! C로 반격 피니시."
      : p.grounded
        ? "Z3 띄우기 → 점프 → 공중 검격"
        : "↓+Z 포고 · C 하향 격추";
  $("air").textContent = p.grounded ? "지상" : p.vy < 0 ? "상승 중" : "낙하 중";
  $("checkpoint").textContent =
    { gate: "밤의 성문", "roof-gate": "첫 성벽", "inner-gate": "안쪽 성문" }[
      game.checkpoint.id
    ] || "수련장";
  $("kills").textContent = String(game.kills).padStart(3, "0");
  $("time").textContent =
    `${String(Math.floor(game.t / 60)).padStart(2, "0")}:${String(Math.floor(game.t % 60)).padStart(2, "0")}`;
  $("enemy-count").textContent =
    `${game.demo === "dojo" ? "TRAINING" : "HOSTILES"} / ${game.enemies.length}`;
  const n = game.notifications.at(-1);
  $("notice").classList.toggle("hidden", !n);
  if (n) {
    $("notice").replaceChildren();
    const b = document.createElement("strong"),
      s = document.createElement("span");
    b.textContent = n.text;
    s.textContent = n.sub;
    $("notice").append(b, s);
    if (lastNotice !== n.text) {
      beep(n.text.includes("간파") ? 700 : 300);
      lastNotice = n.text;
    }
  }
}
window.addEventListener("keydown", (e) => {
  if (
    [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Space",
      "KeyZ",
      "KeyX",
      "KeyC",
      "Enter",
      "Escape",
    ].includes(e.code)
  )
    e.preventDefault();
  if (screen !== "play") {
    if (["ArrowDown", "ArrowRight"].includes(e.code)) select(selection + 1);
    if (["ArrowUp", "ArrowLeft"].includes(e.code)) select(selection - 1);
    if (e.repeat) return;
    if (e.code === "Enter")
      $("overlay").querySelectorAll("[data-menu]")[selection]?.click();
    if (e.code === "Escape") {
      if (screen === "pause") resume();
      else if (screen === "help") $("close-help").click();
    }
    return;
  }
  if (e.code === "Escape" && !e.repeat) {
    pause();
    return;
  }
  keys.add(e.code);
  if (!e.repeat) {
    if (e.code === "Space") edges.jumpPressed = true;
    if (e.code === "KeyX") edges.dashPressed = true;
    if (e.code === "KeyZ") edges.attackPressed = true;
    if (e.code === "KeyC") edges.finisherPressed = true;
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => {
  clear();
  pause();
});
$("help").onclick = help;
$("sound").onclick = () => {
  sound = !sound;
  $("sound").textContent = sound ? "소리 끄기" : "소리 켜기";
  $("sound").setAttribute("aria-pressed", String(sound));
  beep();
};
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000 || 0);
  last = now;
  if (screen === "play" && game?.mode === "playing") {
    game.tick(dt, {
      left: keys.has("ArrowLeft"),
      right: keys.has("ArrowRight"),
      up: keys.has("ArrowUp"),
      down: keys.has("ArrowDown"),
      attack: keys.has("KeyZ"),
      jumpHeld: keys.has("Space"),
      ...edges,
    });
    edges = {};
    if (game.t - lastHUD > 0.075 || game.mode !== "playing") {
      hud();
      lastHUD = game.t;
    }
    if (game.mode === "dead") result();
    else if (game.mode === "levelup") reward();
  }
  renderSide(ctx, screen === "title" ? null : game, now / 1000, {
    shake,
    lowFlash,
  });
  requestAnimationFrame(frame);
}
window.kageIn = {
  snapshot: () => ({
    screen,
    selection,
    shake,
    lowFlash,
    ...(game?.snapshot() || { mode: "title", phase: "P3-A/B" }),
  }),
};
title();
requestAnimationFrame(frame);
