import { beforeEach, describe, expect, it, vi } from 'vitest';

// Render and effect phases are separate so the regression is checked before
// effects flush, exactly when a dashboard redirect can observe the hook result.
const hooks = vi.hoisted(() => ({
  state: undefined as any, effect: undefined as any, dependency: undefined as any,
  cleanup: undefined as any, next: undefined as any, fail: undefined as any,
}));
vi.mock('react', () => ({
  useState: (initial: any) => {
    if (hooks.state === undefined) hooks.state = initial;
    return [hooks.state, (value: any) => { hooks.state = value; }];
  },
  useEffect: (effect: any, [dependency]: any[]) => {
    if (dependency !== hooks.dependency) {
      hooks.dependency = dependency;
      hooks.effect = effect;
    }
  },
}));
vi.mock('firebase/firestore', () => ({
  onSnapshot: vi.fn((_ref, next, fail) => {
    hooks.next = next;
    hooks.fail = fail;
    return vi.fn();
  }),
}));
vi.mock('@/firebase/error-emitter', () => ({ errorEmitter: { emit: vi.fn() } }));
import { useDoc } from './use-doc';

const reference = (path: string) => ({ path, __memo: true }) as any;
function flushEffect() {
  if (!hooks.effect) return;
  hooks.cleanup?.();
  hooks.cleanup = hooks.effect();
  hooks.effect = undefined;
}
function snapshot(id: string, data: Record<string, unknown> | null) {
  hooks.next({ id, exists: () => data !== null, data: () => data });
}
beforeEach(() => {
  hooks.cleanup?.();
  Object.assign(hooks, { state: undefined, effect: undefined, dependency: undefined,
    cleanup: undefined, next: undefined, fail: undefined });
});

describe('useDoc subscription transitions', () => {
  it('reports loading immediately when the profile supplies an agency reference', () => {
    expect(useDoc(null).isLoading).toBe(false);
    flushEffect();
    const agency = reference('agencies/agency-1');
    expect(useDoc(agency)).toEqual({ data: null, isLoading: true, error: null });
    flushEffect();
    snapshot('agency-1', { name: 'Agency' });
    expect(useDoc(agency)).toEqual({ data: { id: 'agency-1', name: 'Agency' }, isLoading: false, error: null });
  });

  it('hides stale data when switching documents and ignores the old subscription', () => {
    const first = reference('users/first');
    useDoc(first);
    flushEffect();
    snapshot('first', { agencyId: 'old-agency' });
    const oldCallback = hooks.next;
    const second = reference('users/second');
    expect(useDoc(second)).toEqual({ data: null, isLoading: true, error: null });
    flushEffect();
    oldCallback({ id: 'first', exists: () => true, data: () => ({ agencyId: 'old-agency' }) });
    expect(useDoc(second).isLoading).toBe(true);
    snapshot('second', null);
    expect(useDoc(second)).toEqual({ data: null, isLoading: false, error: null });
  });

  it('clears data immediately when disabled and finishes loading on subscription failure', () => {
    const agency = reference('agencies/agency-1');
    useDoc(agency);
    flushEffect();
    hooks.fail({ code: 'permission-denied' });
    expect(useDoc(agency)).toMatchObject({ data: null, isLoading: false, error: expect.any(Error) });
    expect(useDoc(null)).toEqual({ data: null, isLoading: false, error: null });
  });
});
