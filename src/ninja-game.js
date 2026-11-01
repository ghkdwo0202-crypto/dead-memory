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
let pressed = {
  dashPressed: false,
  jumpPressed: false,
  specialPressed: false,
  attackPressed: false,
};
function clearInput() {
  keys.clear();
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
    `<div class="eyebrow">忍 / SHADOWS IN MOTION</div><h2>KAGE<span style="color:#ed7067">//</span>IN<small>칼끝에서 시작되는 공중 액션</small></h2><p>세 번 베어 띄우고, 공중에서 따라붙는다.<br>찰나의 회피로 빈틈을 만들고, 끊김 없이 다음 적에게.</p><div class="seal-preview" aria-label="속성 결인 다음 업데이트 예정"><span>炎</span><span>水</span><span>雷</span><span>風</span></div><p class="settings-note">지금은 검술·회피·점프를 다듬는 기본 액션 버전입니다.<br>속성 결인과 인술 조합은 다음 업데이트에서 개방됩니다.</p><div class="menu-actions"><button data-menu class="primary" id="start">출격 →</button><button data-menu id="dojo">검술 수련장</button><button data-menu>조작 안내</button></div><p class="menu-hint">↑ ↓ 선택 · ENTER 확인 / PC KEYBOARD</p>`,
    [() => start(false), () => start(true), help],
  );
}
function start(dojo = false) {
  game = new NinjaGame({ storage, dojo });
  lastHUD = -1;
  lastAttack = 0;
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
    `<div class="eyebrow">THE WAY OF THE BLADE</div><h2 class="help-title">손끝에 흐름을.</h2><div class="help-grid"><kbd>↑ ↓ ← →</kbd><span>이동 · 바라보기. WASD 이동은 사용하지 않습니다.</span><kbd>Z</kbd><span>3타 검술 · 홀드 반복. 3타가 작은 적을 띄웁니다.</span><kbd>X</kbd><span>2회 충전 회피. 실제 공격을 피하면 Z 반격 창이 열립니다.<br>검격 활성 중에는 취소할 수 없습니다.</span><kbd>SPACE</kbd><span>점프. 방향키와 함께 누르면 전방의 떠 있는 적을 추격합니다.<br>공중 추격은 한 연계에 1회, 점프 자체에는 무적이 없습니다.</span><kbd>Z → Z</kbd><span>공중 2타 후 짧은 시간 안에 ↓+Z: 착지 격추.<br>↓는 이동키이므로 지상에서는 일반 공격입니다.</span><kbd>C</kbd><span>표창 투척 · 4초 쿨다운. 인술 미개방 버전의 기본 기술.</span><kbd>ESC</kbd><span>일시정지 · 흔들림/광원 효과 설정.</span></div><p class="settings-note">A/S/D/F 결인 · V 인술 준비는 다음 개발 단계입니다.</p><div class="menu-actions"><button data-menu class="primary" id="close-help">알겠습니다 →</button></div>`,
    [
      () => {
        if (helpReturn === "play") resume();
        else if (helpReturn === "pause") {
          screen = "pause";
          pauseMenu();
        } else title();
      },
    ],
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
      ...pressed,
    });
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
