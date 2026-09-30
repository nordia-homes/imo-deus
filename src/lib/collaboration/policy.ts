import type { CollaborationAccount, CollaborationCase, CollaborationLead } from './model';

export function canReadLead(actor: Pick<CollaborationAccount, 'uid'>, lead: Pick<CollaborationLead, 'collaboratorUid'>) {
  return actor.uid === lead.collaboratorUid;
}

export function canAccessCase(actor: Pick<CollaborationAccount, 'uid' | 'agencyId'>, role: string, value: Pick<CollaborationCase, 'collaboratorUid' | 'ownerAgentUid' | 'ownerAgencyId'>) {
  return value.collaboratorUid === actor.uid || value.ownerAgentUid === actor.uid || (role === 'admin' && Boolean(actor.agencyId) && value.ownerAgencyId === actor.agencyId);
}

export function canPublishProperty(actor: Pick<CollaborationAccount, 'uid' | 'agencyId'>, role: string, sourceAgencyId: string, ownerAgentUid: string) {
  return Boolean(actor.agencyId) && actor.agencyId === sourceAgencyId && (role === 'admin' || actor.uid === ownerAgentUid);
}
