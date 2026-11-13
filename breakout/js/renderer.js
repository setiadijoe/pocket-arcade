import { WORLD_HEIGHT, WORLD_WIDTH } from "./game.js";

export class BreakoutRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    if (!this.context) throw new Error("Canvas 2D tidak tersedia di browser ini.");
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.width * (WORLD_HEIGHT / WORLD_WIDTH) * dpr);
    this.context.setTransform(
      this.canvas.width / WORLD_WIDTH,
      0,
      0,
      this.canvas.height / WORLD_HEIGHT,
      0,
      0
    );
  }

  draw(game) {
    const context = this.context;
    context.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    context.fillStyle = "#bacd92";
    context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.drawGrid();
    this.drawBricks(game);
    this.drawShield(game);
    this.drawUpgradeDrops(game);
    this.drawProjectiles(game);
    this.drawPaddle(game);
    this.drawBall(game);
  }

  drawGrid() {
    const context = this.context;
    context.strokeStyle = "rgba(37, 54, 38, .08)";
    context.lineWidth = 1;
    for (let x = 32; x < WORLD_WIDTH; x += 32) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, WORLD_HEIGHT);
      context.stroke();
    }
  }

  drawBricks(game) {
    const context = this.context;
    for (const row of game.bricks) {
      for (const brick of row) {
        if (!brick.alive) continue;
        context.fillStyle = brick.upgrade ? {
          wide: "#da6042",
          shooter: "#536da8",
          shield: "#408f82"
        }[brick.upgrade] : brick.color;
        context.fillRect(brick.x, brick.y, brick.width, brick.height);
        context.fillStyle = "rgba(255,255,255,.2)";
        context.fillRect(brick.x + 3, brick.y + 3, brick.width - 6, 2);
        if (brick.upgrade) {
          const labels = { wide: "2X", shooter: "S", shield: "D" };
          context.fillStyle = "#fffaf1";
          context.font = "bold 11px monospace";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText(labels[brick.upgrade], brick.x + brick.width / 2, brick.y + brick.height / 2);
        }
      }
    }
  }

  drawShield(game) {
    if (game.activeUpgrade !== "shield") return;
    const context = this.context;
    context.fillStyle = "#408f82";
    context.fillRect(0, game.paddle.y + game.paddle.height, WORLD_WIDTH, 4);
  }

  drawUpgradeDrops(game) {
    const context = this.context;
    const labels = { wide: "W", shooter: "S", shield: "H" };
    const colors = { wide: "#da6042", shooter: "#536da8", shield: "#408f82" };
    for (const drop of game.upgradeDrops) {
      context.beginPath();
      context.arc(drop.x, drop.y, drop.radius, 0, Math.PI * 2);
      context.fillStyle = colors[drop.type];
      context.fill();
      context.fillStyle = "#fffaf1";
      context.font = "bold 11px monospace";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(labels[drop.type], drop.x, drop.y);
    }
  }

  drawProjectiles(game) {
    const context = this.context;
    context.fillStyle = "#fff1bd";
    for (const projectile of game.projectiles) {
      context.fillRect(
        projectile.x - projectile.radius / 2,
        projectile.y - projectile.radius,
        projectile.radius,
        projectile.radius * 2
      );
    }
  }

  drawPaddle(game) {
    const context = this.context;
    context.fillStyle = game.activeUpgrade === "wide" ? "#da6042"
      : game.activeUpgrade === "shooter" ? "#536da8" : "#253626";
    context.shadowColor = "rgba(37,54,38,.22)";
    context.shadowBlur = 8;
    if (game.activeUpgrade === "shooter") {
      const { x, y, width, height } = game.paddle;
      const inset = width * 0.2;
      context.beginPath();
      context.moveTo(x, y + height);
      context.lineTo(x + inset, y);
      context.lineTo(x + width - inset, y);
      context.lineTo(x + width, y + height);
      context.closePath();
      context.fill();
    } else {
      context.fillRect(game.paddle.x, game.paddle.y, game.paddle.width, game.paddle.height);
    }
    context.shadowBlur = 0;
  }

  drawBall(game) {
    const context = this.context;
    context.beginPath();
    context.arc(game.ball.x, game.ball.y, game.ball.radius, 0, Math.PI * 2);
    context.fillStyle = "#da6042";
    context.shadowColor = "rgba(218,96,66,.45)";
    context.shadowBlur = 10;
    context.fill();
    context.shadowBlur = 0;
  }
}
