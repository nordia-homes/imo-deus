import { describe, expect, it } from 'vitest';
import { hasViewingSelection, selectedViewing } from '../viewing-selection';
import type { AssistantMessage } from '../contracts';

const history = (...ids: string[][]) => ids.map((rows, index) => ({ id: String(index), role: 'assistant', text: '', createdAt: '', cards: [{ type: 'data', title: '', source: 'viewings', rows: rows.map(id => ({ id })) }] })) as AssistantMessage[];
describe('trusted viewing selection', () => {
  it('uses the latest singleton, not an older selection', () => {
    expect(selectedViewing(history(['old'], ['new']))).toBe('new');
    expect(selectedViewing(history(['old'], ['a', 'b']))).toBeUndefined();
    expect(selectedViewing(history(['old'], []))).toBeUndefined();
  });
  it('uses compacted context only when no newer viewing card exists', () => {
    const summary = { selections: [{ source: 'viewings', orderedIds: ['old'] }] };
    expect(selectedViewing([], summary)).toBe('old');
    expect(selectedViewing(history(['a', 'b']), summary)).toBeUndefined();
    expect(selectedViewing([], { selections: [...summary.selections, { source: 'viewings', orderedIds: ['a', 'b'] }] })).toBeUndefined();
  });
  it('requires a selected ID or a single explicit ID, never a substring', () => {
    expect(hasViewingSelection('v', 'Pregătește confirmarea vizionării')).toBe(false);
    expect(hasViewingSelection('v', 'Pregătește confirmarea', 'v')).toBe(true);
    expect(hasViewingSelection('new', 'Confirmare ID: new', 'old')).toBe(true);
    expect(hasViewingSelection('old', 'Confirmare ID: new', 'old')).toBe(false);
    expect(hasViewingSelection('a', 'ID: a și ID: b')).toBe(false);
  });
});
