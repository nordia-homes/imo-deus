import { describe, expect, it } from 'vitest';
import { canAccessCase, canPublishProperty, canReadLead } from './policy';

describe('collaboration access boundaries', () => {
  const caseData = { collaboratorUid: 'partner-agent', ownerAgentUid: 'owner-agent', ownerAgencyId: 'owner-agency' };

  it('keeps buyer activity with the collaborator who generated the link', () => {
    expect(canReadLead({ uid: 'partner-agent' }, { collaboratorUid: 'partner-agent' })).toBe(true);
    expect(canReadLead({ uid: 'owner-agent' }, { collaboratorUid: 'partner-agent' })).toBe(false);
    expect(canReadLead({ uid: 'another-partner' }, { collaboratorUid: 'partner-agent' })).toBe(false);
  });

  it('allows only case participants or the owner agency administrator', () => {
    expect(canAccessCase({ uid: 'partner-agent' }, 'collaborator', caseData)).toBe(true);
    expect(canAccessCase({ uid: 'owner-agent', agencyId: 'owner-agency' }, 'agent', caseData)).toBe(true);
    expect(canAccessCase({ uid: 'owner-admin', agencyId: 'owner-agency' }, 'admin', caseData)).toBe(true);
    expect(canAccessCase({ uid: 'owner-colleague', agencyId: 'owner-agency' }, 'agent', caseData)).toBe(false);
    expect(canAccessCase({ uid: 'other-admin', agencyId: 'other-agency' }, 'admin', caseData)).toBe(false);
  });

  it('limits publishing to the assigned agent or administrator of the source agency', () => {
    expect(canPublishProperty({ uid: 'owner-agent', agencyId: 'owner-agency' }, 'agent', 'owner-agency', 'owner-agent')).toBe(true);
    expect(canPublishProperty({ uid: 'owner-admin', agencyId: 'owner-agency' }, 'admin', 'owner-agency', 'owner-agent')).toBe(true);
    expect(canPublishProperty({ uid: 'another-agent', agencyId: 'owner-agency' }, 'agent', 'owner-agency', 'owner-agent')).toBe(false);
    expect(canPublishProperty({ uid: 'external-admin', agencyId: 'external-agency' }, 'admin', 'owner-agency', 'owner-agent')).toBe(false);
  });
});
