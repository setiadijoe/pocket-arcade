const PLAYER_NAME_KEY = "pocket-arcade-player-name";

export function getSavedPlayerName() {
  try {
    return window.localStorage.getItem(PLAYER_NAME_KEY) ?? "";
  } catch (error) {
    console.error("Tidak dapat membaca nama pemain tersimpan", error);
    return "";
  }
}

export function savePlayerName(name) {
  window.localStorage.setItem(PLAYER_NAME_KEY, name);
}
