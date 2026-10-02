export type Channel = 'storia' | 'whatsapp' | 'messenger' | 'instagram';
export type Capability = 'publish' | 'receive' | 'send' | 'comments' | 'insights' | 'templates' | 'nativeSync';
export type CapabilityState = { status: 'active' | 'configuration_required' | 'reconnect_required' | 'unavailable'; reason: string };
export type Connection = {
  id: string; agencyId: string; channel: Channel; externalId: string; name: string;
  parentId?: string; currency?: string; appId?: string; status: 'connected' | 'disconnected'; capabilities: Partial<Record<Capability, CapabilityState>>;
  updatedAt: string; mode?: 'cloud' | 'coexistence'; lastSyncAt?: string; historyFrom?: string;
};
export type Conversation = {
  id: string; agencyId: string; channel: Channel; connectionId: string; externalParticipantId: string;
  name: string; phone?: string; email?: string; contactId: string | null; propertyIds: string[];
  assigneeId: string | null; collaboratorIds: string[];
  status: 'new' | 'open' | 'waiting' | 'snoozed' | 'resolved' | 'spam';
  lastMessageAt: string; latestMessage: string; lastInboundAt: string | null;
  lastOutboundAt: string | null; needsReply: boolean; readBy: Record<string, string>;
  externalUrl?: string; version: number; createdAt: string;
};
export type Message = {
  id: string; externalId: string | null; conversationId: string; agencyId: string;
  direction: 'received' | 'sent'; origin: 'imodeus' | 'native' | 'unknown'; text: string;
  createdAt: string; authorId: string | null;
  status: 'received' | 'queued' | 'sending' | 'accepted' | 'delivered' | 'read' | 'failed' | 'unknown';
  attachments: Array<{ id?: string; localId?: string; name: string; type: string; url?: string }>;
  error?: string; imported?: boolean;
};
export type Actor = { uid: string; agencyId: string; role?: string };
export function canReadConversation(actor: Actor, conversation: Pick<Conversation, 'agencyId' | 'assigneeId' | 'collaboratorIds'>) {
  return actor.agencyId === conversation.agencyId && (actor.role === 'admin' ||
    conversation.assigneeId === actor.uid || conversation.collaboratorIds.includes(actor.uid));
}
export function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
export function withinResponseWindow(lastInboundAt: string | null, now = Date.now()) {
  if (!lastInboundAt) return false;
  const time = Date.parse(lastInboundAt);
  return Number.isFinite(time) && time <= now && now - time < 24 * 60 * 60 * 1000;
}
export function advanceStatus(current: Message['status'], incoming: Message['status']): Message['status'] {
  const rank: Partial<Record<Message['status'], number>> = { queued: 0, sending: 1, unknown: 1, accepted: 2, failed: 2.5, delivered: 3, read: 4 };
  return (rank[incoming] ?? -1) >= (rank[current] ?? -1) ? incoming : current;
}
export function budgetReservation(limit: number, spent: number, reserved: number, amount: number) {
  if (![limit, spent, reserved, amount].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error('Buget invalid.');
  if (spent + reserved + amount > limit) throw new Error('Plafonul de consum este epuizat.');
  return reserved + amount;
}
export const CHANNEL_LABELS: Record<Channel, string> = { storia: 'Storia', whatsapp: 'WhatsApp', messenger: 'Messenger', instagram: 'Instagram' };
