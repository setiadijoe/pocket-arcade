export function attachControls(canvas, game, actions) {
  const pressedKeys = new Set();
  const activeDirections = new Set();
  const updateDirection = () => {
    const rightPressed = pressedKeys.has("ArrowRight") || pressedKeys.has("KeyD") || activeDirections.has(1);
    const leftPressed = pressedKeys.has("ArrowLeft") || pressedKeys.has("KeyA") || activeDirections.has(-1);
    game.inputDirection = rightPressed ? 1 : leftPressed ? -1 : 0;
  };
  const onPointerMove = (event) => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const x = ((event.clientX - rect.left) / rect.width) * 960;
    game.movePaddleTo(x);
  };

  const onKeyDown = (event) => {
    if (event.code === "Space" && event.repeat) return;
    pressedKeys.add(event.code);
    if (event.code === "ArrowLeft" || event.code === "KeyA") {
      event.preventDefault();
    } else if (event.code === "ArrowRight" || event.code === "KeyD") {
      event.preventDefault();
    } else if (event.code === "Space") {
      event.preventDefault();
      actions.toggle();
    }
    updateDirection();
  };

  const onKeyUp = (event) => {
    pressedKeys.delete(event.code);
    updateDirection();
  };

  const onDirectionPointerDown = (event) => {
    event.preventDefault();
    const direction = Number(event.currentTarget.dataset.direction);
    activeDirections.add(direction);
    event.currentTarget.setPointerCapture(event.pointerId);
    updateDirection();
  };

  const onDirectionPointerUp = (event) => {
    const direction = Number(event.currentTarget.dataset.direction);
    activeDirections.delete(direction);
    updateDirection();
  };

  const onActionPointerDown = (event) => {
    const button = event.currentTarget;
    if (
      button.dataset.action === "primary" &&
      game.state === "playing" &&
      game.activeUpgrade === "shooter"
    ) {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      actions.setShooting(true);
    }
  };

  const onActionPointerUp = (event) => {
    if (event.currentTarget.dataset.action === "primary") actions.setShooting(false);
  };

  const directionButtons = document.querySelectorAll("[data-direction]");
  for (const button of directionButtons) {
    button.addEventListener("pointerdown", onDirectionPointerDown);
    button.addEventListener("pointerup", onDirectionPointerUp);
    button.addEventListener("pointercancel", onDirectionPointerUp);
    button.addEventListener("lostpointercapture", onDirectionPointerUp);
  }

  const actionButtons = document.querySelectorAll("[data-action]");
  const actionClickHandlers = new Map();
  for (const button of actionButtons) {
    const onActionClick = () => {
      if (button.dataset.action === "start") actions.start();
      else if (button.dataset.action === "pause") actions.pause();
      else if (
        button.dataset.action === "primary" &&
        !(game.state === "playing" && game.activeUpgrade === "shooter")
      ) actions.start();
    };
    actionClickHandlers.set(button, onActionClick);
    button.addEventListener("pointerdown", onActionPointerDown);
    button.addEventListener("pointerup", onActionPointerUp);
    button.addEventListener("pointercancel", onActionPointerUp);
    button.addEventListener("lostpointercapture", onActionPointerUp);
    button.addEventListener("click", onActionClick);
  }

  const onBlur = () => {
    pressedKeys.clear();
    activeDirections.clear();
    game.inputDirection = 0;
    actions.setShooting(false);
    if (game.state === "playing") game.pause();
  };

  canvas.addEventListener("pointermove", onPointerMove);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  return () => {
    canvas.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    for (const button of directionButtons) {
      button.removeEventListener("pointerdown", onDirectionPointerDown);
      button.removeEventListener("pointerup", onDirectionPointerUp);
      button.removeEventListener("pointercancel", onDirectionPointerUp);
      button.removeEventListener("lostpointercapture", onDirectionPointerUp);
    }
    for (const button of actionButtons) {
      button.removeEventListener("pointerdown", onActionPointerDown);
      button.removeEventListener("pointerup", onActionPointerUp);
      button.removeEventListener("pointercancel", onActionPointerUp);
      button.removeEventListener("lostpointercapture", onActionPointerUp);
      button.removeEventListener("click", actionClickHandlers.get(button));
    }
  };
}
