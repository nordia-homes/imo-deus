export type RuntimeMode = "real" | "demo";

const RUNTIME_MODE_STORAGE_KEY = "imodeus:runtime-mode";
export const RUNTIME_MODE_CHANGED_EVENT = "imodeus:runtime-mode-changed";

function canUseBrowserStorage() {
  return typeof window !== "undefined";
}

function emitRuntimeModeChanged(mode: RuntimeMode) {
  if (!canUseBrowserStorage()) return;

  window.dispatchEvent(
    new CustomEvent<RuntimeMode>(RUNTIME_MODE_CHANGED_EVENT, {
      detail: mode,
    })
  );
}

export function isDemoRuntimeMode(value: string | null | undefined): value is "demo" {
  return value === "demo";
}

export function getStoredRuntimeMode(): RuntimeMode {
  if (!canUseBrowserStorage()) return "real";

  try {
    const value = window.localStorage.getItem(RUNTIME_MODE_STORAGE_KEY);
    return isDemoRuntimeMode(value) ? "demo" : "real";
  } catch (error) {
    console.warn("Could not read runtime mode from storage:", error);
    return "real";
  }
}

export function setStoredRuntimeMode(mode: RuntimeMode) {
  if (!canUseBrowserStorage()) return;

  try {
    window.localStorage.setItem(RUNTIME_MODE_STORAGE_KEY, mode);
    emitRuntimeModeChanged(mode);
  } catch (error) {
    console.warn("Could not persist runtime mode:", error);
  }
}

export function clearStoredRuntimeMode() {
  if (!canUseBrowserStorage()) return;

  try {
    window.localStorage.removeItem(RUNTIME_MODE_STORAGE_KEY);
    emitRuntimeModeChanged("real");
  } catch (error) {
    console.warn("Could not clear runtime mode:", error);
  }
}
