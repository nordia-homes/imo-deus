import { describe, expect, it } from 'vitest';
import { socialConnectionSummary, socialDashboardRequest } from '../social-dashboard';
describe('social dashboard projection', () => {
  it.each(['configuration_required', 'reconnect_required', 'unavailable', 'unknown'])('reports %s capability without exposing raw reasons', status => {
    const result = socialConnectionSummary('id', { status: 'connected', channel: 'instagram', token: 'SECRET', capabilities: { publish: { status, reason: 'SECRET' } } });
    expect(result.needsAttention).toBe(true); expect(JSON.stringify(result)).not.toContain('SECRET');
  });
  it('does not interpret missing configuration as healthy', () => expect(socialConnectionSummary('id', {}).needsAttention).toBe(true));
  it('recognizes read commands only', () => { expect(socialDashboardRequest('Arată-mi dashboardul social.')).toBe('dashboard'); expect(socialDashboardRequest('Reconectează pagina')).toBeNull(); });
});
