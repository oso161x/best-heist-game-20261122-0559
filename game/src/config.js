// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical
// area; the renderer scales it to the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  speed: 232,
  sneakSpeed: 122,
  /** Sneaking shrinks the distance at which guards and cameras notice the thief. */
  sneakNotice: 0.62,
  grabRange: 40,
  coinRange: 150,
  coins: 3,
};

export const GUARD = {
  radius: 15,
  patrolSpeed: 92,
  chaseSpeed: 244,
  investigateSpeed: 132,
  /** Half-angle of the vision cone, in radians. */
  coneHalfAngle: 0.55,
  coneRange: 252,
  catchRadius: 27,
  /** Suspicion gained per second while the thief is visible, at point blank. */
  suspicionRate: 1.35,
  suspicionDecay: 0.55,
  /** Seconds a guard keeps chasing after losing sight before it investigates. */
  chaseMemory: 2.5,
  investigateSeconds: 2.2,
};

export const CAMERA = {
  coneHalfAngle: 0.46,
  coneRange: 302,
  /** Alarm per second while a camera sees the thief. */
  alarmRate: 17,
  /** Seconds a camera stays dark after the control panel disables it. */
  disabledSeconds: 25,
  panelCooldown: 45,
};

/** The alarm meter: 0 is calm, 100 is a lockdown and the run ends. */
export const ALARM = {
  guardRate: 30,
  decay: 7,
  max: 100,
  /** At or above this, every guard hunts the thief's last known spot. */
  huntAt: 60,
};

export const LOOT = {
  diamond: { points: 500, label: 'Star Diamond' },
  gold: { points: 300, label: 'Gold Bars' },
  painting: { points: 200, label: 'Painting' },
};

/** Time bonus: this many points a second under the par time. */
export const TIME_BONUS = { parSeconds: 240, pointsPerSecond: 5 };

export const PALETTE = {
  backdrop: '#0d0f16',
  floor: '#171a26',
  floorTile: '#1c2030',
  floorLine: '#232839',
  wall: '#2e3348',
  wallTop: '#3d4360',
  caseGlass: 'rgba(127, 212, 255, 0.16)',
  caseEdge: '#5b7d94',
  gold: '#f2c94c',
  diamond: '#7ff3ff',
  painting: '#e8a34c',
  player: '#232733',
  playerMask: '#7ff3ff',
  guard: '#8c2f2f',
  guardCone: 'rgba(242, 201, 76, 0.20)',
  guardConeSuspicious: 'rgba(242, 140, 60, 0.30)',
  guardConeAlert: 'rgba(229, 83, 75, 0.34)',
  camera: '#9aa3b2',
  cameraCone: 'rgba(229, 83, 75, 0.16)',
  exit: '#3fce7c',
  panel: '#4fc3f7',
  text: '#eef1f5',
  muted: '#8b93a3',
  alarmLow: '#3fce7c',
  alarmMid: '#f2c94c',
  alarmHigh: '#e5534b',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'midnight-vault.best';
