"use client";
export const SESSION_EVENT = "jarvis:session";
const key = (uid: string, agencyId: string) =>
  `jarvis-session:${agencyId}:${uid}`;
// Event-only clock, shared by lifecycle and audio callbacks; never sampled in render.
export function voiceTimestamp() {
  return performance.now();
}
export function activeJarvisSession(uid: string, agencyId: string) {
  try {
    const raw = localStorage.getItem(key(uid, agencyId));
    if (raw) {
      const row = JSON.parse(raw);
      if (
        /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
          row.id,
        )
      )
        return row as { id: string; hasHistory: boolean };
    }
  } catch {}
  const row = { id: crypto.randomUUID(), hasHistory: false };
  storeJarvisSession(uid, agencyId, row.id, false);
  return row;
}
export function storeJarvisSession(
  uid: string,
  agencyId: string,
  id: string,
  hasHistory = true,
) {
  try {
    localStorage.setItem(
      key(uid, agencyId),
      JSON.stringify({ id, hasHistory }),
    );
  } catch {}
  window.dispatchEvent(
    new CustomEvent(SESSION_EVENT, {
      detail: { uid, agencyId, id, hasHistory },
    }),
  );
}
export function editableTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],.monaco-editor,.cm-editor',
      ),
    )
  );
}
