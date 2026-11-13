export const WORLD_WIDTH = 960;
export const WORLD_HEIGHT = 600;

const INITIAL_CONFIG = { paddleBounce: 0.1, paddleWidth: WORLD_WIDTH / 8, maxSpeed: 2 };
const ROW_COLORS = ["#253626", "#354a31", "#435b3a", "#536b43", "#657d4d", "#78915b"];
const ROWS = 6;
const LEVEL_COUNT = 99;
const BRICK_TOP = 76;
const BRICK_GAP = 7;
const PADDLE_SPEED_REFERENCE = 0.44;
const MAX_BOUNCE_ANGLE = Math.PI / 2 - 0.02;
const PADDLE_SPEED_FACTOR = 0.25;
const PADDLE_IDLE_TIMEOUT = 100;
const UPGRADE_TYPES = ["wide", "shooter", "shield"];
const UPGRADE_DROP_SPEED = 110;
const SHOT_INTERVAL = 0.5;
const SHOT_SPEED = 360;
const SHIELD_DURATION = 20;
const LEVEL_LAYOUTS = new Map();

function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function createLevelPattern(level, rows, columns, salt) {
  const random = createRandom(level * 2654435761 + salt * 2246822519);
  const family = Math.floor((level - 1) / 9);
  const variant = (level - 1) % 9;
  const centerX = (columns - 1) / 2;
  const centerY = (rows - 1) / 2;
  const pattern = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column) => {
      const distanceX = Math.abs(column - centerX) / Math.max(centerX, 1);
      const distanceY = Math.abs(row - centerY) / Math.max(centerY, 1);
      const shift = variant % Math.max(columns, 1);

      switch (family) {
        case 0:
          return row < rows - (variant % 3);
        case 1:
          return distanceX <= (row + 1 + variant % 3) / (rows + 1);
        case 2:
          return distanceX <= (rows - row + variant % 3) / (rows + 1);
        case 3:
          return (row + column + variant) % 2 === 0;
        case 4:
          return (row + variant) % 2 === 0 || row === centerY;
        case 5:
          return (column + shift) % 3 !== 1;
        case 6:
          return distanceX + distanceY <= 1.25 + (variant % 3) * 0.15;
        case 7:
          return Math.abs(row - Math.round((column + variant) * (rows - 1) / Math.max(columns - 1, 1))) <= 1;
        case 8:
          return row === 0 || row === rows - 1 || column === 0 || column === columns - 1;
        case 9:
          return (column + row * (variant % 4 + 1)) % 4 !== 1;
        default:
          return distanceX <= 0.45 + random() * 0.45 || distanceY <= 0.4;
      }
    })
  );

  const flips = 1 + variant % 3;
  for (let index = 0; index < flips; index += 1) {
    const row = Math.floor(random() * rows);
    const column = Math.floor(random() * columns);
    pattern[row][column] = !pattern[row][column];
  }
  if (!pattern.some((row) => row.some(Boolean))) pattern[rows - 1][Math.floor(columns / 2)] = true;
  return pattern;
}

function getLevelPatterns(rows, columns) {
  const key = `${rows}x${columns}`;
  if (LEVEL_LAYOUTS.has(key)) return LEVEL_LAYOUTS.get(key);

  const usedPatterns = new Set();
  const patterns = Array.from({ length: LEVEL_COUNT }, (_, index) => {
    let salt = 0;
    let pattern;
    let signature;
    do {
      pattern = createLevelPattern(index + 1, rows, columns, salt);
      signature = pattern.map((row) => row.map(Number).join("")).join("");
      salt += 1;
    } while (usedPatterns.has(signature));
    usedPatterns.add(signature);
    return pattern;
  });
  LEVEL_LAYOUTS.set(key, patterns);
  return patterns;
}

export class BreakoutGame {
  constructor({ onSound, onLevelComplete } = {}) {
    this.onSound = onSound;
    this.onLevelComplete = onLevelComplete;
    this.level = 1;
    this.loop = 1;
    this.speedMultiplier = 1;
    this.score = 0;
    this.lives = 3;
    this.state = "ready";
    this.inputDirection = 0;
    this.lastPaddleMove = null;
    this.paddleSpeedX = 0;
    this.activeUpgrade = null;
    this.upgradeTimer = 0;
    this.upgradeDrops = [];
    this.projectiles = [];
    this.shotCooldown = 0;
    this.shooting = false;
    this.resetBoard();
    this.resetBallAndPaddle();
  }

  get config() {
    return INITIAL_CONFIG;
  }

  resetBoard() {
    const columns = (window.matchMedia("(min-width: 1024px)").matches ? 12
      : window.matchMedia("(min-width: 768px)").matches ? 10
        : window.matchMedia("(min-width: 640px)").matches ? 8 : 6) * 2;
    const gap = (columns > 16 ? BRICK_GAP : 5) / 2;
    const brickWidth = (WORLD_WIDTH - 64 - gap * (columns - 1)) / columns;
    const brickHeight = 22;
    const layoutWidth = columns * brickWidth + (columns - 1) * gap;
    const brickLeft = (WORLD_WIDTH - layoutWidth) / 2;
    const pattern = getLevelPatterns(ROWS, columns)[this.level - 1];
    const alivePositions = [];
    for (let row = 0; row < ROWS; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        if (pattern[row][column]) alivePositions.push({ row, column });
      }
    }
    const upgradesByPosition = new Map(
      UPGRADE_TYPES.map((type, index) => {
        const position = alivePositions[Math.floor(((index + 1) * alivePositions.length) / (UPGRADE_TYPES.length + 1))];
        return [`${position.row}:${position.column}`, type];
      })
    );
    this.columns = columns;
    this.brickHeight = brickHeight;
    this.bricks = Array.from({ length: ROWS }, (_, row) =>
      Array.from({ length: columns }, (_, column) => ({
        x: brickLeft + column * (brickWidth + gap),
        y: BRICK_TOP + row * (brickHeight + gap),
        width: brickWidth,
        height: brickHeight,
        color: ROW_COLORS[row],
        alive: pattern[row][column],
        upgrade: upgradesByPosition.get(`${row}:${column}`) ?? null
      }))
    );
  }

  resetBallAndPaddle() {
    this.paddle = {
      x: (WORLD_WIDTH - this.config.paddleWidth) / 2,
      y: WORLD_HEIGHT - 38,
      width: this.config.paddleWidth,
      height: 12
    };
    this.ball = { x: 0, y: 0, radius: 8, vx: 1, vy: -1, attached: true };
    this.paddleSpeedX = 0;
    this.lastPaddleMove = null;
    this.attachBallToPaddle();
  }

  attachBallToPaddle() {
    this.ball.x = this.paddle.x + this.paddle.width / 2;
    this.ball.y = this.paddle.y - this.ball.radius - 1;
  }

  start() {
    if (this.state === "gameover") return;
    if (this.state === "paused") {
      this.state = "playing";
      return;
    }
    this.state = "playing";
    this.ball.attached = false;
  }

  pause() {
    if (this.state === "playing") {
      this.state = "paused";
      this.setShooting(false);
    } else if (this.state === "paused") {
      this.state = "playing";
    }
  }

  setShooting(shooting) {
    this.shooting = shooting && this.state === "playing" && this.activeUpgrade === "shooter";
    if (!this.shooting) this.shotCooldown = 0;
  }

  newGame() {
    this.level = 1;
    this.loop = 1;
    this.speedMultiplier = 1;
    this.score = 0;
    this.lives = 3;
    this.clearUpgrade();
    this.upgradeDrops = [];
    this.state = "ready";
    this.inputDirection = 0;
    this.resetBoard();
    this.resetBallAndPaddle();
  }

  movePaddleTo(x, now = performance.now()) {
    const oldX = this.paddle.x;
    this.paddle.x = this.clamp(x - this.paddle.width / 2, 0, WORLD_WIDTH - this.paddle.width);
    if (this.lastPaddleMove !== null && now > this.lastPaddleMove) {
      this.paddleSpeedX = (this.paddle.x - oldX) / (now - this.lastPaddleMove);
    }
    this.lastPaddleMove = now;
    if (this.ball.attached) this.attachBallToPaddle();
  }

  update(deltaSeconds) {
    if (this.state !== "playing") return;
    const dt = Math.min(deltaSeconds, 0.032);
    if (this.inputDirection) {
      const previousX = this.paddle.x;
      this.paddle.x = this.clamp(
        this.paddle.x + this.inputDirection * 440 * dt,
        0,
        WORLD_WIDTH - this.paddle.width
      );
      if (dt > 0) {
        this.paddleSpeedX = (this.paddle.x - previousX) / (dt * 1000);
        this.lastPaddleMove = performance.now();
      }
      if (this.ball.attached) this.attachBallToPaddle();
    }
    if (this.lastPaddleMove === null || performance.now() - this.lastPaddleMove > PADDLE_IDLE_TIMEOUT) {
      this.paddleSpeedX = 0;
    }
    if (this.ball.attached) {
      this.ball.attached = false;
      this.ball.vx = this.speedMultiplier;
      this.ball.vy = -this.speedMultiplier;
    }

    this.updateUpgradeEffects(dt);
    this.updateUpgradeDrops(dt);
    this.updateProjectiles(dt);
    if (this.state !== "playing") return;
    const distanceScale = dt * 200;
    this.ball.x += this.ball.vx * distanceScale;
    this.ball.y += this.ball.vy * distanceScale;
    this.handlePaddleCollision();
    this.handleBrickCollision();
    if (this.state !== "playing") return;
    this.handleWallCollision();
    this.keepBallSpeedInRange();
  }

  updateUpgradeEffects(deltaSeconds) {
    if (this.activeUpgrade === "shield") {
      this.upgradeTimer = Math.max(0, this.upgradeTimer - deltaSeconds);
      if (this.upgradeTimer === 0) this.clearUpgrade();
    } else if (this.activeUpgrade === "shooter" && this.shooting) {
      this.shotCooldown -= deltaSeconds;
      if (this.shotCooldown <= 0) {
        this.fireShots();
        this.shotCooldown = SHOT_INTERVAL;
      }
    }
  }

  updateUpgradeDrops(deltaSeconds) {
    for (let index = this.upgradeDrops.length - 1; index >= 0; index -= 1) {
      const drop = this.upgradeDrops[index];
      drop.y += UPGRADE_DROP_SPEED * deltaSeconds;
      const caught = drop.y + drop.radius >= this.paddle.y &&
        drop.y - drop.radius <= this.paddle.y + this.paddle.height &&
        drop.x >= this.paddle.x &&
        drop.x <= this.paddle.x + this.paddle.width;
      if (caught) {
        this.activateUpgrade(drop.type);
        this.upgradeDrops.splice(index, 1);
      } else if (drop.y - drop.radius > WORLD_HEIGHT) {
        this.upgradeDrops.splice(index, 1);
      }
    }
  }

  updateProjectiles(deltaSeconds) {
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index];
      projectile.x += projectile.vx * deltaSeconds;
      projectile.y += projectile.vy * deltaSeconds;
      let hit = null;
      for (const row of this.bricks) {
        hit = row.find((brick) => brick.alive &&
          projectile.x >= brick.x &&
          projectile.x <= brick.x + brick.width &&
          projectile.y >= brick.y &&
          projectile.y <= brick.y + brick.height);
        if (hit) break;
      }
      if (hit) {
        this.projectiles.splice(index, 1);
        this.destroyBrick(hit);
      } else if (projectile.y < 0 || projectile.x < 0 || projectile.x > WORLD_WIDTH) {
        this.projectiles.splice(index, 1);
      }
    }
  }

  fireShots() {
    this.projectiles.push({
      x: this.paddle.x + this.paddle.width / 2,
      y: this.paddle.y + this.paddle.height * 0.25,
      vx: 0,
      vy: -SHOT_SPEED,
      radius: 5
    });
  }

  activateUpgrade(type) {
    this.clearUpgrade();
    this.activeUpgrade = type;
    if (type === "wide") {
      const center = this.paddle.x + this.paddle.width / 2;
      this.paddle.width = this.config.paddleWidth * 2;
      this.paddle.x = this.clamp(center - this.paddle.width / 2, 0, WORLD_WIDTH - this.paddle.width);
    } else if (type === "shield") {
      this.upgradeTimer = SHIELD_DURATION;
    } else if (type === "shooter") {
      this.shotCooldown = 0;
    }
  }

  clearUpgrade() {
    this.activeUpgrade = null;
    this.upgradeTimer = 0;
    this.shotCooldown = 0;
    this.shooting = false;
    this.projectiles = [];
    if (this.paddle) {
      const center = this.paddle.x + this.paddle.width / 2;
      this.paddle.width = this.config.paddleWidth;
      this.paddle.x = this.clamp(center - this.paddle.width / 2, 0, WORLD_WIDTH - this.paddle.width);
    }
  }

  handlePaddleCollision() {
    const ball = this.ball;
    const paddle = this.paddle;
    const verticalPosition = this.clamp(
      (ball.y - paddle.y) / paddle.height,
      0,
      1
    );
    const sideInset = this.activeUpgrade === "shooter"
      ? paddle.width * 0.2 * (1 - verticalPosition)
      : 0;
    if (
      ball.vy > 0 &&
      ball.y + ball.radius >= paddle.y &&
      ball.y - ball.radius <= paddle.y + paddle.height &&
      ball.x >= paddle.x + sideInset - ball.radius &&
      ball.x <= paddle.x + paddle.width - sideInset + ball.radius
    ) {
      this.onSound?.("paddle");
      ball.y = paddle.y - ball.radius;
      const incomingSpeed = Math.hypot(ball.vx, ball.vy);
      const incomingAngle = Math.atan2(Math.abs(ball.vx), Math.abs(ball.vy));
      const directionMatch = Math.sign(this.paddleSpeedX) * Math.sign(ball.vx);

      if (directionMatch) {
        const movementStrength = this.clamp(
          Math.abs(this.paddleSpeedX) / PADDLE_SPEED_REFERENCE,
          0,
          1
        );
        const intensity = this.config.paddleBounce * movementStrength;
        const outgoingAngle = this.clamp(
          incomingAngle + Math.sign(directionMatch) * intensity,
          0,
          MAX_BOUNCE_ANGLE
        );
        const speedFactor = 1 + Math.sign(directionMatch) * intensity * PADDLE_SPEED_FACTOR;
        const outgoingSpeed = Math.min(incomingSpeed * speedFactor, this.maxBallSpeed);

        ball.vx = Math.sign(ball.vx) * outgoingSpeed * Math.sin(outgoingAngle);
        ball.vy = -outgoingSpeed * Math.cos(outgoingAngle);
      } else {
        ball.vy = -Math.abs(ball.vy);
      }
      this.clampBallVelocity();
    }
  }

  handleBrickCollision() {
    const ball = this.ball;
    let hit = null;
    let overlapX = Infinity;
    let overlapY = Infinity;
    for (const row of this.bricks) {
      for (const brick of row) {
        if (!brick.alive) continue;
        const closestX = this.clamp(ball.x, brick.x, brick.x + brick.width);
        const closestY = this.clamp(ball.y, brick.y, brick.y + brick.height);
        const dx = ball.x - closestX;
        const dy = ball.y - closestY;
        if (dx * dx + dy * dy > ball.radius * ball.radius) continue;
        const xOverlap = ball.radius - Math.abs(ball.x - (brick.x + brick.width / 2));
        const yOverlap = ball.radius - Math.abs(ball.y - (brick.y + brick.height / 2));
        if (xOverlap < overlapX && yOverlap < overlapY) {
          hit = brick;
          overlapX = xOverlap;
          overlapY = yOverlap;
        }
      }
    }
    if (!hit) return;

    this.onSound?.("brick");
    this.destroyBrick(hit);
    if (overlapX < overlapY) {
      ball.vx *= -1;
      ball.x += ball.vx > 0 ? overlapX : -overlapX;
    } else {
      ball.vy *= -1;
      ball.y += ball.vy > 0 ? overlapY : -overlapY;
    }
  }

  destroyBrick(brick) {
    if (!brick.alive) return;
    brick.alive = false;
    this.score += 1;
    if (brick.upgrade) {
      this.upgradeDrops.push({
        x: brick.x + brick.width / 2,
        y: brick.y + brick.height / 2,
        radius: 9,
        type: brick.upgrade
      });
    }
    if (!this.bricks.some((row) => row.some((brick) => brick.alive))) this.advanceLevel();
  }

  handleWallCollision() {
    const ball = this.ball;
    if (ball.x - ball.radius <= 0) {
      ball.x = ball.radius;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x + ball.radius >= WORLD_WIDTH) {
      ball.x = WORLD_WIDTH - ball.radius;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y - ball.radius <= 0) {
      ball.y = ball.radius;
      ball.vy = Math.abs(ball.vy);
    }
    if (ball.vy > 0 && this.activeUpgrade === "shield") {
      const shieldY = this.paddle.y + this.paddle.height;
      if (ball.y + ball.radius >= shieldY) {
        ball.y = shieldY - ball.radius;
        ball.vy = -Math.abs(ball.vy);
      }
    } else if (ball.y - ball.radius > WORLD_HEIGHT) {
      this.loseBall();
    }
  }

  get maxBallSpeed() {
    return this.config.maxSpeed * this.speedMultiplier * Math.SQRT2;
  }

  advanceLevel() {
    this.onLevelComplete?.();
    if (this.level === LEVEL_COUNT) {
      this.level = 1;
      this.loop += 1;
      this.speedMultiplier *= 1.1;
      this.ball.vx *= 1.1;
      this.ball.vy *= 1.1;
    } else {
      this.level += 1;
    }
    this.setShooting(false);
    this.resetBoard();
    this.state = "ready";
    this.resetBallAndPaddle();
  }

  clampBallVelocity() {
    const speed = Math.hypot(this.ball.vx, this.ball.vy);
    if (speed <= this.maxBallSpeed) return;
    const scale = this.maxBallSpeed / speed;
    this.ball.vx *= scale;
    this.ball.vy *= scale;
  }

  keepBallSpeedInRange() {
    if (Math.abs(this.ball.vx) < 0.01) this.ball.vx = Math.sign(this.ball.vx || 1) * 0.25;
    if (Math.abs(this.ball.vy) < 0.01) this.ball.vy = -0.25;
  }

  loseBall() {
    this.clearUpgrade();
    this.upgradeDrops = [];
    this.lives = Math.max(0, this.lives - 1);
    if (this.lives === 0) {
      this.state = "gameover";
      this.ball.attached = true;
      return;
    }
    this.state = "ready";
    this.ball.attached = true;
    this.ball.vx = this.speedMultiplier;
    this.ball.vy = -this.speedMultiplier;
    this.attachBallToPaddle();
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
}
