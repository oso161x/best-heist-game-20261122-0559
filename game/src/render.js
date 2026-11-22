// The painter: the vault floor, the cones, the thief, the HUD and the screens. It reads
// the world and draws it; it never changes a rule.

import { ALARM, CAMERA, FIELD, FONT, GUARD, LOOT, PALETTE, PLAYER } from './config.js';
import { CAMERAS, EXIT_ZONE, PANEL, SOLIDS } from './level.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

const TAU = Math.PI * 2;

// Dust motes drifting over the floor: fixed pseudo-random seeds, so every run looks the same.
const MOTES = Array.from({ length: 36 }, (_, i) => ({
  x: ((i * 397) % 1280) + 10,
  y: ((i * 251) % 720) + 10,
  speed: 4 + ((i * 13) % 9),
  size: 1 + ((i * 7) % 2),
}));

function drawCone(ctx, x, y, angle, range, halfAngle, fill) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, angle - halfAngle, angle + halfAngle);
  ctx.closePath();
  const gradient = ctx.createRadialGradient(x, y, 10, x, y, range);
  gradient.addColorStop(0, fill);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();
}

function drawCase(ctx, rect, label) {
  ctx.fillStyle = PALETTE.caseGlass;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = PALETTE.caseEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
  ctx.fillStyle = 'rgba(238, 241, 245, 0.35)';
  ctx.beginPath();
  ctx.moveTo(rect.x + 8, rect.y + rect.h - 6);
  ctx.lineTo(rect.x + rect.w * 0.4, rect.y + 6);
  ctx.lineTo(rect.x + rect.w * 0.55, rect.y + 6);
  ctx.lineTo(rect.x + 20, rect.y + rect.h - 6);
  ctx.closePath();
  ctx.fill();
  if (label) {
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h + 14);
  }
}

function drawLoot(ctx, item, time) {
  const bob = Math.sin(time * 2.4 + item.x) * 2;
  const glint = 0.55 + 0.45 * Math.sin(time * 3.1 + item.y);
  if (item.id === 'diamond') {
    ctx.save();
    ctx.translate(item.x, item.y + bob);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = PALETTE.diamond;
    ctx.globalAlpha = 0.85 + 0.15 * glint;
    ctx.fillRect(-9, -9, 18, 18);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-9, -9, 18, 18);
    ctx.restore();
  } else if (item.id === 'gold') {
    for (let i = -1; i <= 1; i += 1) {
      ctx.fillStyle = PALETTE.gold;
      ctx.globalAlpha = 0.8 + 0.2 * glint;
      ctx.fillRect(item.x + i * 13 - 6, item.y + bob - 5 + Math.abs(i) * 3, 12, 9);
      ctx.strokeStyle = '#8a6d1f';
      ctx.lineWidth = 1;
      ctx.strokeRect(item.x + i * 13 - 6, item.y + bob - 5 + Math.abs(i) * 3, 12, 9);
    }
    ctx.globalAlpha = 1;
  } else {
    ctx.save();
    ctx.translate(item.x, item.y + bob);
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(-16, -11, 32, 22);
    ctx.fillStyle = PALETTE.painting;
    ctx.fillRect(-13, -8, 26, 16);
    ctx.fillStyle = '#7fb069';
    ctx.beginPath();
    ctx.arc(-4, 2, 5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e8d44c';
    ctx.beginPath();
    ctx.arc(6, -3, 4, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawGuard(ctx, guard, time) {
  const coneFill =
    guard.mode === 'alert'
      ? PALETTE.guardConeAlert
      : guard.mode === 'suspicious' || guard.suspicion >= 0.45
        ? PALETTE.guardConeSuspicious
        : PALETTE.guardCone;
  drawCone(ctx, guard.x, guard.y, guard.angle, GUARD.coneRange, GUARD.coneHalfAngle, coneFill);
  ctx.fillStyle = PALETTE.guard;
  ctx.beginPath();
  ctx.arc(guard.x, guard.y, GUARD.radius, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#d8b25a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(guard.x, guard.y, GUARD.radius - 4, 0, TAU);
  ctx.stroke();
  // Facing tick.
  ctx.strokeStyle = '#eef1f5';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(guard.x, guard.y);
  ctx.lineTo(guard.x + Math.cos(guard.angle) * (GUARD.radius + 6), guard.y + Math.sin(guard.angle) * (GUARD.radius + 6));
  ctx.stroke();
  if (guard.mode === 'alert') {
    ctx.fillStyle = '#ff5a4e';
    ctx.font = `800 22px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('!', guard.x, guard.y - GUARD.radius - 8);
  } else if (guard.suspicion >= 0.45) {
    ctx.fillStyle = '#f2c94c';
    ctx.font = `800 20px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('?', guard.x, guard.y - GUARD.radius - 8);
  }
}

function drawCamera(ctx, camera, time) {
  if (time < camera.disabledUntil) {
    ctx.fillStyle = '#3a3f4d';
  } else {
    drawCone(ctx, camera.x, camera.y, camera.angle, CAMERA.coneRange, CAMERA.coneHalfAngle, PALETTE.cameraCone);
    ctx.fillStyle = camera.seesPlayer ? '#ff5a4e' : PALETTE.camera;
  }
  ctx.beginPath();
  ctx.arc(camera.x, camera.y, 9, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#22252f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(camera.x, camera.y);
  ctx.lineTo(camera.x + Math.cos(camera.angle) * 16, camera.y + Math.sin(camera.angle) * 16);
  ctx.stroke();
  if (time < camera.disabledUntil) {
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('OFF', camera.x, camera.y + 24);
  }
}

function drawPlayer(ctx, player, time) {
  const r = player.sneaking ? PLAYER.radius - 2 : PLAYER.radius;
  ctx.save();
  ctx.translate(player.x, player.y);
  // Shadow.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(2, r * 0.7, r, r * 0.45, 0, 0, TAU);
  ctx.fill();
  // Hooded body.
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#4a5068';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Mask stripe, facing the way the thief looks.
  ctx.rotate(player.angle);
  ctx.fillStyle = PALETTE.playerMask;
  ctx.fillRect(2, -3, r - 2, 6);
  ctx.restore();
  if (player.sneaking) {
    ctx.strokeStyle = 'rgba(127, 243, 255, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(player.x, player.y, r + 6, 0, TAU);
    ctx.stroke();
  }
}

function alarmColor(alarm) {
  if (alarm >= 75) return PALETTE.alarmHigh;
  if (alarm >= 40) return PALETTE.alarmMid;
  return PALETTE.alarmLow;
}

function drawHud(ctx, state) {
  const time = state.time;
  ctx.fillStyle = 'rgba(13, 15, 22, 0.82)';
  ctx.fillRect(0, 0, FIELD.width, 44);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 17px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(`LOOT ${state.lootTaken}/3`, 20, 29);
  ctx.fillStyle = PALETTE.gold;
  ctx.fillText(`★ ${state.score}`, 130, 29);
  // Alarm meter.
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `700 13px ${FONT}`;
  ctx.fillText('ALARM', 300, 28);
  ctx.fillStyle = '#2a3040';
  ctx.fillRect(360, 14, 260, 16);
  ctx.fillStyle = alarmColor(state.alarm);
  ctx.fillRect(360, 14, 260 * (state.alarm / ALARM.max), 16);
  if (state.alarm >= 75) {
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 9);
    ctx.strokeStyle = PALETTE.alarmHigh;
    ctx.lineWidth = 2;
    ctx.strokeRect(360, 14, 260, 16);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 15px ${FONT}`;
  ctx.textAlign = 'right';
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  ctx.fillText(`${minutes}:${String(seconds).padStart(2, '0')}`, FIELD.width - 120, 29);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 13px ${FONT}`;
  ctx.fillText(`coins ${state.player.coins}`, FIELD.width - 20, 28);
  // Objective line.
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 13px ${FONT}`;
  const objective =
    state.lootTaken < 3
      ? `Grab the loot (${state.lootTaken}/3) — E to take, Q to toss a coin, Shift to sneak`
      : 'All loot in hand — reach the green EXIT!';
  ctx.fillText(objective, 20, FIELD.height - 12);
}

function drawOverlay(ctx, title, lines, hint) {
  ctx.fillStyle = 'rgba(10, 12, 18, 0.72)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 54px ${FONT}`;
  ctx.fillText(title, FIELD.width / 2, 250);
  ctx.font = `400 20px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  lines.forEach((line, i) => {
    ctx.fillText(line, FIELD.width / 2, 300 + i * 30);
  });
  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 19px ${FONT}`;
  ctx.fillText(hint, FIELD.width / 2, 300 + lines.length * 30 + 40);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
    canvas.width = Math.floor(FIELD.width * scale);
    canvas.height = Math.floor(FIELD.height * scale);
    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;
  }
  resize();
  window.addEventListener('resize', resize);

  function draw(state, screen, best) {
    const time = state.time;
    ctx.save();
    ctx.setTransform(canvas.width / FIELD.width, 0, 0, canvas.height / FIELD.height, 0, 0);
    if (state.shake > 0) {
      const mag = state.shake * 7;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }
    // Floor.
    ctx.fillStyle = PALETTE.floor;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.strokeStyle = PALETTE.floorLine;
    ctx.lineWidth = 1;
    for (let x = 0; x <= FIELD.width; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, FIELD.height);
      ctx.stroke();
    }
    for (let y = 0; y <= FIELD.height; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(FIELD.width, y);
      ctx.stroke();
    }
    // Exit zone.
    ctx.fillStyle = 'rgba(63, 206, 124, 0.18)';
    ctx.fillRect(EXIT_ZONE.x, EXIT_ZONE.y, EXIT_ZONE.w, EXIT_ZONE.h);
    ctx.strokeStyle = PALETTE.exit;
    ctx.lineWidth = 2;
    ctx.strokeRect(EXIT_ZONE.x, EXIT_ZONE.y, EXIT_ZONE.w, EXIT_ZONE.h);
    ctx.fillStyle = PALETTE.exit;
    ctx.font = `800 15px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', EXIT_ZONE.x + EXIT_ZONE.w / 2, EXIT_ZONE.y + EXIT_ZONE.h / 2 + 5);
    // Walls and cases.
    for (const rect of SOLIDS) {
      const isWall = rect.y === 0 || rect.x === 0 || rect.x + rect.w === FIELD.width || rect.y + rect.h === FIELD.height;
      ctx.fillStyle = isWall ? PALETTE.wall : PALETTE.floorTile;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = PALETTE.wallTop;
      ctx.fillRect(rect.x, rect.y, rect.w, 4);
    }
    drawCase(ctx, { x: 590, y: 90, w: 100, h: 60 }, 'STAR DIAMOND');
    drawCase(ctx, { x: 180, y: 180, w: 110, h: 60 }, 'GOLD');
    drawCase(ctx, { x: 1010, y: 170, w: 110, h: 60 }, 'PAINTING');
    // Loot still in its case.
    for (const item of state.loot) {
      if (!item.taken) drawLoot(ctx, item, time);
    }
    // Security panel.
    const panelReady = time >= state.panelCooldownUntil;
    ctx.fillStyle = panelReady ? PALETTE.panel : '#3a3f4d';
    ctx.fillRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h);
    ctx.strokeStyle = '#22252f';
    ctx.lineWidth = 2;
    ctx.strokeRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h);
    ctx.fillStyle = '#0d0f16';
    ctx.font = `800 10px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('CAM', PANEL.x + PANEL.w / 2, PANEL.y + PANEL.h / 2 + 3);
    // Tossed coin.
    if (state.coin) {
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(state.coin.x, state.coin.y, 7, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#8a6d1f';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Cameras, then guards, then the thief.
    for (const camera of state.cameras) drawCamera(ctx, camera, time);
    for (const guard of state.guards) drawGuard(ctx, guard, time);
    drawPlayer(ctx, state.player, time);
    // Dust motes.
    ctx.fillStyle = 'rgba(238, 241, 245, 0.10)';
    for (const mote of MOTES) {
      const y = (mote.y + time * mote.speed) % FIELD.height;
      ctx.fillRect(mote.x, y, mote.size, mote.size);
    }
    // Alarm vignette.
    if (state.alarm > 25) {
      const alpha = ((state.alarm - 25) / 75) * (0.22 + 0.1 * Math.sin(time * 6));
      const gradient = ctx.createRadialGradient(
        FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.35,
        FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.75,
      );
      gradient.addColorStop(0, 'rgba(229, 83, 75, 0)');
      gradient.addColorStop(1, `rgba(229, 83, 75, ${alpha})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    ctx.restore();

    // HUD and screens draw in screen space (the same transform is still the letterbox one;
    // the HUD sits inside the 1280x720 field, so it is fine here).
    ctx.save();
    ctx.setTransform(canvas.width / FIELD.width, 0, 0, canvas.height / FIELD.height, 0, 0);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(ctx, state);
    if (screen === SCREEN_TITLE) {
      drawOverlay(
        ctx,
        'MIDNIGHT VAULT',
        [
          'A top-down heist: cross the vault, dodge the guards and cameras,',
          'grab the Star Diamond, the gold and the painting — then reach the EXIT.',
          'WASD / arrows move · Shift sneak · E grab / disable cameras · Q toss a coin',
          'P pause · M mute',
          best > 0 ? `Best score: ${best}` : 'No clean getaway yet — the vault is waiting.',
        ],
        'Press SPACE or click to start the heist',
      );
    } else if (screen === SCREEN_PAUSED) {
      drawOverlay(ctx, 'PAUSED', ['The vault holds its breath.'], 'Press P or SPACE to keep going');
    } else if (screen === SCREEN_WIN) {
      const bonus = Math.max(0, Math.round(240 - state.time)) * 5;
      drawOverlay(
        ctx,
        'HEIST COMPLETE',
        [
          `Loot ${state.score - bonus} + time bonus ${bonus} = ${state.score} points`,
          `Clean getaway in ${Math.floor(state.time / 60)}:${String(Math.floor(state.time % 60)).padStart(2, '0')}`,
          best > 0 ? `Best score: ${best}` : '',
        ].filter(Boolean),
        'Press SPACE to run it again',
      );
    } else if (screen === SCREEN_OVER) {
      drawOverlay(
        ctx,
        'CAUGHT!',
        [
          state.alarm >= 100 ? 'The alarm hit 100 — the vault locked down.' : 'A guard laid hands on the thief.',
          `Loot grabbed: ${state.lootTaken}/3 · Score ${state.score}`,
        ],
        'Press SPACE to try the vault again',
      );
    }
    ctx.restore();
  }

  return { draw };
}
