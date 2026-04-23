import type { DemoSessionState } from "@/lib/demo/types";
import { createDemoSessionState } from "@/lib/demo/seed";

const DEMO_SESSION_ID_KEY = "imodeus:demo:session-id";
const DEMO_SESSION_STATE_KEY = "imodeus:demo:data";

function canUseBrowserStorage() {
  return typeof window !== "undefined";
}

export function loadDemoSessionState(): DemoSessionState | null {
  if (!canUseBrowserStorage()) return null;

  try {
    const raw = window.sessionStorage.getItem(DEMO_SESSION_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DemoSessionState;
  } catch (error) {
    console.warn("Could not load demo session state:", error);
    return null;
  }
}

export function persistDemoSessionState(state: DemoSessionState) {
  if (!canUseBrowserStorage()) return;

  try {
    window.sessionStorage.setItem(DEMO_SESSION_ID_KEY, state.sessionId);
    window.sessionStorage.setItem(DEMO_SESSION_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Could not persist demo session state:", error);
  }
}

export function initializeDemoSessionState() {
  const existing = loadDemoSessionState();
  if (existing) return existing;

  const created = createDemoSessionState();
  persistDemoSessionState(created);
  return created;
}

export function resetDemoSessionState() {
  const next = createDemoSessionState();
  persistDemoSessionState(next);
  return next;
}

export function clearDemoSessionState() {
  if (!canUseBrowserStorage()) return;

  try {
    window.sessionStorage.removeItem(DEMO_SESSION_ID_KEY);
    window.sessionStorage.removeItem(DEMO_SESSION_STATE_KEY);
  } catch (error) {
    console.warn("Could not clear demo session state:", error);
  }
}
