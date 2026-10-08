import type { AssistantAction } from './contracts';
export function assertTaskEdit(action: AssistantAction) {
  if (action.kind === 'update_task' && !Object.entries(action).some(([key, value]) => !['kind', 'taskId', 'expectedUpdatedAt', 'deferNonUrgent'].includes(key) && value !== undefined)) {
    throw new Error('update_task necesită câmpul de modificat: pentru reprogramare transmite dueDate ISO din resolve_datetime și startTime HH:mm; pentru stare transmite status. ID-ul singur nu modifică taskul.');
  }
}
