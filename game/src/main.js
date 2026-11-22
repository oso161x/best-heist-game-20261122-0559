// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between five screens: title, play, paused, win and caught.
//
// ?seed=N fixes the patrol jitter and the dust. ?shot=cover|alarm|loot|win (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets window.__shotReady
// for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_ALARM_HIGH, EVENT_CAUGHT, EVENT_COIN, EVENT_GRAB, EVENT_PANEL, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, ACTION_TOSS, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';
import { sound } from './sound.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
void createRandom(seed);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld();
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  // One-shot presses, taken once a frame and shared by the screen handler and the step:
  // takeActions() consumes its flags, so the frame takes them and hands the interact/toss
  // bits to the step instead of each side taking them separately.
  let frameActions = 0;

  // Screen readers (and anyone watching the page's text) hear the screen changes and the grabs.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    sound.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Grab all three loot items, then reach the exit.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(won ? `Heist complete. Score ${world.state.score}.` : `Caught. Score ${world.state.score}.`);
  }

  function handleActions() {
    frameActions = input.takeActions();
    const actions = frameActions;
    if (actions & ACTION_MUTE) {
      const muted = sound.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    const steering = input.steering();
    // Confirm and pause are handled by handleActions each frame; the rest ride the step.
    const stepActions = (frameActions & ACTION_INTERACT ? 2 : 0) | (frameActions & ACTION_TOSS ? 4 : 0);
    frameActions = 0;
    const events = world.step(STEP, {
      sx: steering.x,
      sy: steering.y,
      sneaking: input.sneaking(),
      actions: stepActions,
    });
    if (events & EVENT_GRAB) {
      sound.grab();
      announce(`Loot grabbed. ${world.state.lootTaken} of 3.`);
    }
    if (events & EVENT_COIN) sound.coin();
    if (events & EVENT_PANEL) {
      sound.panel();
      announce('Cameras disabled for 25 seconds.');
    }
    if (events & EVENT_ALARM_HIGH) {
      sound.alarm();
      announce('Alarm high. The guards are hunting you.');
    }
    if (events & EVENT_CAUGHT) {
      sound.caught();
      endGame(false);
    } else if (events & EVENT_WIN) {
      sound.win();
      endGame(true);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        world.step(STEP, null);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        step();
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) {
          accumulator = 0;
          break;
        }
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Midnight Vault. Press Space or click to start the heist.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
