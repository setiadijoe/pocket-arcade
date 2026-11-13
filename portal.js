import { getSavedPlayerName, savePlayerName } from "./shared/player-name.js";

const form = document.getElementById("player-form");
const input = document.getElementById("player-name");
const status = document.getElementById("player-status");
const gameButtons = document.querySelectorAll("[data-game]");

if (!(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement)) {
  throw new Error("Elemen formulir pemain tidak ditemukan.");
}
if (!(status instanceof HTMLElement)) {
  throw new Error("Elemen status pemain tidak ditemukan.");
}

let savedName = getSavedPlayerName();
input.value = savedName;

function setGamesEnabled(enabled) {
  for (const button of gameButtons) {
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error("Tombol game tidak valid.");
    }
    button.disabled = !enabled;
  }
}

setGamesEnabled(savedName.length > 0);

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = input.value.trim();
  if (!name || name.length > 30) {
    input.setCustomValidity("Nama harus terdiri dari 1 sampai 30 karakter.");
    input.reportValidity();
    return;
  }

  input.setCustomValidity("");
  try {
    savePlayerName(name);
    savedName = name;
    setGamesEnabled(true);
    status.dataset.error = "false";
    status.textContent = `Nama ${name} tersimpan. Pilih game untuk mulai bermain.`;
  } catch (error) {
    console.error("Tidak dapat menyimpan nama pemain", error);
    status.dataset.error = "true";
    status.textContent = "Nama tidak dapat disimpan di browser ini. Periksa pengaturan penyimpanan.";
  }
});

input.addEventListener("input", () => {
  input.setCustomValidity("");
  const name = input.value.trim();
  setGamesEnabled(name.length > 0 && name === savedName);
  if (name !== savedName) {
    status.dataset.error = "false";
    status.textContent = "Simpan nama ini sebelum memilih game.";
  }
});

for (const button of gameButtons) {
  button.addEventListener("click", () => {
    if (button.disabled) return;
    const game = button.dataset.game;
    if (game !== "breakout" && game !== "snake" && game !== "tetris") {
      throw new Error(`Game tidak dikenal: ${game}`);
    }
    window.location.assign(`/${game}/`);
  });
}
