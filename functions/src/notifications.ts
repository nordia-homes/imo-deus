import crypto from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore, type DocumentReference } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const REGION = 'us-central1';
const BUCHAREST_TIME_ZONE = 'Europe/Bucharest';
const APP_BASE_URL = (process.env.APP_BASE_URL || 'https://imodeus.ro').replace(/\/+$/, '');
const EVENT_COLLECTION = 'notificationEvents';
const SCHEDULE_COLLECTION = 'notificationSchedules';
const DELIVERY_COLLECTION = 'notificationDeliveryJobs';
const MAX_ATTEMPTS = 8;
const LEASE_MS = 2 * 60_000;

type NotificationEventType =
  | 'storia.message_received'
  | 'viewing.assigned'
  | 'viewing.assignment_changed'
  | 'viewing.rescheduled'
  | 'viewing.reminder_2h'
  | 'viewing.tomorrow_digest'
  | 'task.assigned'
  | 'task.updated'
  | 'facebook_groups.publish_completed'
  | 'facebook_groups.publish_failed'
  | 'property.assigned'
  | 'property.assignment_changed'
  | 'client_portal.feedback_updated';

type NotificationEventDocument = {
  type: NotificationEventType;
  schemaVersion: 1;
  agencyId: string;
  entityType: string;
  entityId: string;
  sourceEventId: string;
  sourceUpdateTime?: Timestamp | null;
  occurredAt: Timestamp;
  priority: 'action_required' | 'reminder' | 'info';
  payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'dead';
  attemptCount: number;
  nextAttemptAt: Timestamp;
  leaseOwner?: string | null;
  leaseUntil?: Timestamp | null;
  lastError?: string | null;
  completedAt?: Timestamp | null;
  expiresAt: Timestamp;
};

type Recipient = {
  uid: string;
  variant?: 'assigned' | 'removed';
};

type NotificationPresentation = {
  category: string;
  title: string;
  body: string;
  actionUrl: string;
  tag: string;
  ttlSeconds: number;
};

function now() {
  return Timestamp.now();
}

function timestampAfter(milliseconds: number) {
  return Timestamp.fromMillis(Date.now() + milliseconds);
}

function hashId(...parts: unknown[]) {
  return crypto
    .createHash('sha256')
    .update(parts.map((part) => String(part ?? '')).join('\u001f'))
    .digest('base64url')
    .slice(0, 44);
}

function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function nullableString(value: unknown) {
  const normalized = stringValue(value).trim();
  return normalized || null;
}

function valuesDiffer(left: unknown, right: unknown) {
  return JSON.stringify(left ?? null) !== JSON.stringify(right ?? null);
}

function isDemoAgency(agencyId: string) {
  return agencyId.startsWith('demo-');
}

function retryAt(attemptCount: number) {
  const delaySeconds = Math.min(3600, 30 * 2 ** Math.max(0, attemptCount - 1));
  return Timestamp.fromMillis(Date.now() + delaySeconds * 1000);
}

function formatDateTime(value: unknown) {
  const date = new Date(stringValue(value));
  if (Number.isNaN(date.getTime())) return 'data stabilită';
  return new Intl.DateTimeFormat('ro-RO', {
    timeZone: BUCHAREST_TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatTime(value: unknown) {
  const date = new Date(stringValue(value));
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ro-RO', {
    timeZone: BUCHAREST_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function sourceUpdateTime(snapshot: FirebaseFirestore.DocumentSnapshot | undefined) {
  return snapshot?.updateTime ? Timestamp.fromMillis(snapshot.updateTime.toMillis()) : null;
}

async function createNotificationEvent(input: {
  type: NotificationEventType;
  agencyId: string;
  entityType: string;
  entityId: string;
  sourceEventId: string;
  sourceUpdateTime?: Timestamp | null;
  priority?: NotificationEventDocument['priority'];
  payload: Record<string, unknown>;
}) {
  if (!input.agencyId || isDemoAgency(input.agencyId)) return null;
  const eventId = `evt_${hashId(input.type, input.agencyId, input.entityId, input.sourceEventId)}`;
  const ref = db.collection(EVENT_COLLECTION).doc(eventId);
  const document: NotificationEventDocument = {
    type: input.type,
    schemaVersion: 1,
    agencyId: input.agencyId,
    entityType: input.entityType,
    entityId: input.entityId,
    sourceEventId: input.sourceEventId,
    sourceUpdateTime: input.sourceUpdateTime || null,
    occurredAt: now(),
    priority: input.priority || 'info',
    payload: input.payload,
    status: 'pending',
    attemptCount: 0,
    nextAttemptAt: now(),
    leaseOwner: null,
    leaseUntil: null,
    lastError: null,
    completedAt: null,
    expiresAt: timestampAfter(90 * 24 * 60 * 60_000),
  };

  try {
    await ref.create(document);
  } catch (error) {
    const code = (error as { code?: number | string }).code;
    if (code !== 6 && code !== 'already-exists') throw error;
  }
  return eventId;
}

async function getAgencyAdmins(agencyId: string) {
  const users = await db.collection('users').where('agencyId', '==', agencyId).get();
  const admins = users.docs
    .filter((snapshot) => snapshot.data().role === 'admin')
    .map((snapshot) => snapshot.id);
  if (admins.length) return admins;

  const agency = await db.collection('agencies').doc(agencyId).get();
  const ownerId = nullableString(agency.data()?.ownerId);
  return ownerId ? [ownerId] : [];
}

async function resolveRecipients(event: NotificationEventDocument): Promise<Recipient[]> {
  const payload = event.payload || {};
  const directAgentId = nullableString(payload.agentId);
  let recipients: Recipient[] = [];

  switch (event.type) {
    case 'viewing.assigned':
    case 'task.assigned':
    case 'property.assigned': {
      const uid = nullableString(payload.newAgentId || payload.agentId);
      if (uid) recipients.push({ uid, variant: 'assigned' });
      break;
    }
    case 'viewing.assignment_changed':
    case 'property.assignment_changed': {
      const oldAgentId = nullableString(payload.oldAgentId);
      const newAgentId = nullableString(payload.newAgentId);
      if (oldAgentId && oldAgentId !== newAgentId) recipients.push({ uid: oldAgentId, variant: 'removed' });
      if (newAgentId && newAgentId !== oldAgentId) recipients.push({ uid: newAgentId, variant: 'assigned' });
      break;
    }
    case 'viewing.rescheduled':
    case 'task.updated':
    case 'viewing.tomorrow_digest':
    case 'facebook_groups.publish_completed':
    case 'facebook_groups.publish_failed': {
      if (directAgentId) recipients.push({ uid: directAgentId });
      break;
    }
    case 'viewing.reminder_2h': {
      const viewing = await db
        .collection('agencies').doc(event.agencyId)
        .collection('viewings').doc(event.entityId)
        .get();
      const viewingData = viewing.data();
      if (viewing.exists && viewingData?.status === 'scheduled' && viewingData.agentId) {
        recipients.push({ uid: String(viewingData.agentId) });
      }
      break;
    }
    case 'storia.message_received': {
      const propertyId = nullableString(payload.propertyId);
      if (propertyId) {
        const property = await db
          .collection('agencies').doc(event.agencyId)
          .collection('properties').doc(propertyId)
          .get();
        const propertyAgentId = nullableString(property.data()?.agentId);
        if (propertyAgentId) recipients.push({ uid: propertyAgentId });
      }
      if (!recipients.length) {
        recipients = (await getAgencyAdmins(event.agencyId)).map((uid) => ({ uid }));
      }
      break;
    }
    case 'client_portal.feedback_updated': {
      const contactId = nullableString(payload.contactId);
      if (contactId) {
        const contact = await db
          .collection('agencies').doc(event.agencyId)
          .collection('contacts').doc(contactId)
          .get();
        const contactAgentId = nullableString(contact.data()?.agentId);
        if (contactAgentId) recipients.push({ uid: contactAgentId });
      }
      if (!recipients.length) {
        recipients = (await getAgencyAdmins(event.agencyId)).map((uid) => ({ uid }));
      }
      break;
    }
  }

  const unique = new Map<string, Recipient>();
  for (const recipient of recipients) {
    if (recipient.uid) unique.set(`${recipient.uid}:${recipient.variant || 'default'}`, recipient);
  }
  const candidates = [...unique.values()];
  const profileEntries = await Promise.all([...new Set(candidates.map((recipient) => recipient.uid))].map(async (uid) => {
    const profile = await db.collection('users').doc(uid).get();
    return [uid, profile.data()] as const;
  }));
  const allowedUids = new Set(profileEntries
    .filter(([, profile]) => profile?.agencyId === event.agencyId)
    .map(([uid]) => uid));
  return candidates.filter((recipient) => allowedUids.has(recipient.uid));
}

function buildPresentation(event: NotificationEventDocument, recipient: Recipient): NotificationPresentation {
  const p = event.payload || {};
  const propertyTitle = stringValue(p.propertyTitle, 'Proprietate');
  const contactName = stringValue(p.contactName || p.senderName, 'Client');
  const previousAgentName = stringValue(p.oldAgentName, 'agentul anterior');
  const nextAgentName = stringValue(p.newAgentName, 'noul agent');

  switch (event.type) {
    case 'storia.message_received':
      return {
        category: 'storiaMessages',
        title: 'Mesaj Storia nou',
        body: `${contactName} a trimis un mesaj pentru „${propertyTitle}”.`,
        actionUrl: '/inbox',
        tag: `storia:${event.entityId}`,
        ttlSeconds: 6 * 60 * 60,
      };
    case 'viewing.assigned':
    case 'viewing.assignment_changed':
      if (recipient.variant === 'removed') {
        return {
          category: 'viewingAssignments',
          title: 'Vizionare realocată',
          body: `Vizionarea pentru „${propertyTitle}”, ${formatDateTime(p.viewingDate)}, nu îți mai este atribuită${p.newAgentId ? `. Noul agent: ${nextAgentName}.` : '.'}`,
          actionUrl: '/viewings',
          tag: `viewing-assignment:${event.entityId}`,
          ttlSeconds: 24 * 60 * 60,
        };
      }
      return {
        category: 'viewingAssignments',
        title: 'Vizionare atribuită',
        body: `Ți-a fost atribuită vizionarea pentru „${propertyTitle}”, ${formatDateTime(p.viewingDate)}${p.oldAgentId ? `. Agent anterior: ${previousAgentName}.` : '.'}`,
        actionUrl: '/viewings',
        tag: `viewing-assignment:${event.entityId}`,
        ttlSeconds: 24 * 60 * 60,
      };
    case 'viewing.rescheduled':
      return {
        category: 'viewingRescheduled',
        title: 'Vizionare reprogramată',
        body: `Vizionarea pentru „${propertyTitle}” a fost mutată de la ${formatDateTime(p.oldViewingDate)} la ${formatDateTime(p.newViewingDate)}.`,
        actionUrl: '/viewings',
        tag: `viewing-rescheduled:${event.entityId}`,
        ttlSeconds: 24 * 60 * 60,
      };
    case 'viewing.reminder_2h':
      return {
        category: 'viewingReminders',
        title: 'Vizionare în 2 ore',
        body: `La ${formatTime(p.viewingDate)} ai vizionarea pentru „${propertyTitle}” cu ${contactName}.`,
        actionUrl: '/viewings',
        tag: `viewing-reminder:${event.entityId}`,
        ttlSeconds: 2 * 60 * 60,
      };
    case 'viewing.tomorrow_digest': {
      const count = Number(p.count || 0);
      return {
        category: 'viewingReminders',
        title: count === 1 ? 'Ai 1 vizionare programată mâine' : `Ai ${count} vizionări programate mâine`,
        body: p.firstViewingDate ? `Prima vizionare începe la ${formatTime(p.firstViewingDate)}.` : 'Deschide calendarul pentru detalii.',
        actionUrl: `/viewings?date=${encodeURIComponent(stringValue(p.tomorrowDate))}`,
        tag: `viewing-digest:${recipient.uid}:${stringValue(p.tomorrowDate)}`,
        ttlSeconds: 12 * 60 * 60,
      };
    }
    case 'task.assigned':
      return {
        category: 'taskAssignments',
        title: 'Task atribuit',
        body: `Ți-a fost atribuit taskul „${stringValue(p.description, 'Task')}”${p.dueDate ? `, scadent ${stringValue(p.dueDate)}` : ''}.`,
        actionUrl: '/tasks',
        tag: `task-assignment:${event.entityId}`,
        ttlSeconds: 24 * 60 * 60,
      };
    case 'task.updated':
      return {
        category: 'taskUpdates',
        title: 'Task modificat',
        body: `Taskul „${stringValue(p.description, 'Task')}” a fost actualizat${p.dueDate ? ` pentru ${stringValue(p.dueDate)}` : ''}.`,
        actionUrl: '/tasks',
        tag: `task-updated:${event.entityId}`,
        ttlSeconds: 24 * 60 * 60,
      };
    case 'facebook_groups.publish_completed':
      return {
        category: 'facebookCompleted',
        title: 'Publicarea Facebook s-a finalizat',
        body: `„${propertyTitle}” a fost procesată în ${Number(p.groupCount || 0)} grupuri: ${Number(p.successCount || 0)} publicate sau trimise spre aprobare.`,
        actionUrl: `/properties/${event.entityId}`,
        tag: `facebook-publish:${stringValue(p.jobId, event.sourceEventId)}`,
        ttlSeconds: 24 * 60 * 60,
      };
    case 'facebook_groups.publish_failed':
      return {
        category: 'facebookFailed',
        title: 'Publicarea Facebook s-a oprit',
        body: stringValue(p.errorMessage, `Publicarea pentru „${propertyTitle}” a întâmpinat o eroare.`),
        actionUrl: `/properties/${event.entityId}`,
        tag: `facebook-publish:${stringValue(p.jobId, event.sourceEventId)}`,
        ttlSeconds: 72 * 60 * 60,
      };
    case 'property.assigned':
    case 'property.assignment_changed':
      if (recipient.variant === 'removed') {
        return {
          category: 'propertyAssignments',
          title: 'Proprietate realocată',
          body: `Proprietatea „${propertyTitle}” nu îți mai este atribuită${p.newAgentId ? `. Noul agent: ${nextAgentName}.` : '.'}`,
          actionUrl: `/properties/${event.entityId}`,
          tag: `property-assignment:${event.entityId}`,
          ttlSeconds: 24 * 60 * 60,
        };
      }
      return {
        category: 'propertyAssignments',
        title: 'Proprietate atribuită',
        body: `Ți-a fost atribuită proprietatea „${propertyTitle}”${p.oldAgentId ? `. Agent anterior: ${previousAgentName}.` : '.'}`,
        actionUrl: `/properties/${event.entityId}`,
        tag: `property-assignment:${event.entityId}`,
        ttlSeconds: 24 * 60 * 60,
      };
    case 'client_portal.feedback_updated': {
      const feedback = stringValue(p.feedback);
      const comment = stringValue(p.comment).trim();
      const changeKind = stringValue(p.changeKind, 'feedback');
      const commentAction = stringValue(p.commentAction);
      if (changeKind !== 'feedback' && commentAction) {
        const title = commentAction === 'deleted'
          ? 'Comentariu sters in portal'
          : commentAction === 'edited'
            ? 'Comentariu modificat in portal'
            : 'Comentariu nou in portal';
        const body = commentAction === 'deleted'
          ? `${contactName} a sters comentariul pentru „${propertyTitle}”.`
          : `${contactName}: „${comment.slice(0, 180)}”`;
        return {
          category: 'clientPortalFeedback',
          title,
          body,
          actionUrl: `/leads/${stringValue(p.contactId)}?recommendation=${encodeURIComponent(stringValue(p.propertyId))}`,
          tag: `portal-feedback:${stringValue(p.contactId)}:${stringValue(p.propertyId)}`,
          ttlSeconds: 24 * 60 * 60,
        };
      }
      const feedbackText = feedback === 'liked'
        ? `apreciază proprietatea „${propertyTitle}”`
        : feedback === 'disliked'
          ? `nu este interesat de proprietatea „${propertyTitle}”`
          : `și-a retras feedbackul pentru „${propertyTitle}”`;
      return {
        category: 'clientPortalFeedback',
        title: comment ? 'Comentariu nou în portal' : 'Feedback nou în portal',
        body: comment ? `${contactName}: „${comment.slice(0, 180)}”` : `${contactName} ${feedbackText}.`,
        actionUrl: `/leads/${stringValue(p.contactId)}?recommendation=${encodeURIComponent(stringValue(p.propertyId))}`,
        tag: `portal-feedback:${stringValue(p.contactId)}:${stringValue(p.propertyId)}`,
        ttlSeconds: 24 * 60 * 60,
      };
    }
  }
}

async function claimDocument(
  ref: DocumentReference,
  runnableStatuses: string[],
) {
  const leaseOwner = crypto.randomUUID();
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return null;
    const data = snapshot.data() as Record<string, unknown>;
    const status = stringValue(data.status);
    const leaseUntil = data.leaseUntil instanceof Timestamp ? data.leaseUntil : null;
    const leaseExpired = !leaseUntil || leaseUntil.toMillis() <= Date.now();
    if (status === 'processing' && !leaseExpired) return null;
    if (status !== 'processing' && !runnableStatuses.includes(status)) return null;
    const attemptCount = Number(data.attemptCount || 0) + 1;
    transaction.update(ref, {
      status: 'processing',
      attemptCount,
      leaseOwner,
      leaseUntil: timestampAfter(LEASE_MS),
      updatedAt: now(),
    });
    return { ...data, attemptCount, leaseOwner };
  });
}

async function processEventByRef(ref: DocumentReference) {
  const claimed = await claimDocument(ref, ['pending', 'failed']);
  if (!claimed) return;
  const event = claimed as unknown as NotificationEventDocument & { leaseOwner: string };

  try {
    const recipients = await resolveRecipients(event);
    const recipientContexts = await Promise.all(recipients.map(async (recipient) => {
      const [preferences, registrations, user] = await Promise.all([
        db.collection('users').doc(recipient.uid).collection('notificationPreferences').doc('default').get(),
        db.collection('users').doc(recipient.uid).collection('messagingRegistrations').where('enabled', '==', true).get(),
        db.collection('users').doc(recipient.uid).get(),
      ]);
      return { recipient, preferences: preferences.data() || {}, registrations, user: user.data() || {} };
    }));

    await db.runTransaction(async (transaction) => {
      const fresh = await transaction.get(ref);
      if (!fresh.exists || fresh.data()?.leaseOwner !== event.leaseOwner) return;

      for (const context of recipientContexts) {
        const presentation = buildPresentation(event, context.recipient);
        const notificationId = `ntf_${hashId(ref.id, context.recipient.uid)}`;
        const notificationRef = db.collection('users').doc(context.recipient.uid).collection('notifications').doc(notificationId);
        transaction.set(notificationRef, {
          id: notificationId,
          eventId: ref.id,
          recipientId: context.recipient.uid,
          agencyId: event.agencyId,
          type: event.type,
          category: presentation.category,
          priority: event.priority,
          title: presentation.title,
          body: presentation.body,
          actionUrl: presentation.actionUrl,
          entityType: event.entityType,
          entityId: event.entityId,
          createdAt: event.occurredAt || now(),
          isRead: false,
          readAt: null,
          expiresAt: timestampAfter(180 * 24 * 60 * 60_000),
        }, { merge: false });

        const preferenceData = context.preferences as { pushEnabled?: boolean; categories?: Record<string, boolean> };
        const pushEnabled = preferenceData.pushEnabled !== false
          && preferenceData.categories?.[presentation.category] !== false;
        if (!pushEnabled) continue;

        const targets: Array<{ id: string; path: string; target: string; targetKind: string }> = [];
        for (const registration of context.registrations.docs) {
          const target = stringValue(registration.data().target);
          if (!target || targets.some((item) => item.target === target)) continue;
          targets.push({
            id: registration.id,
            path: registration.ref.path,
            target,
            targetKind: stringValue(registration.data().targetKind, 'token'),
          });
        }
        const legacyTokens = Array.isArray(context.user.pushTokens) ? context.user.pushTokens.filter(Boolean) : [];
        for (const token of legacyTokens) {
          if (!targets.some((target) => target.target === token)) {
            targets.push({ id: `legacy_${hashId(token)}`, path: '', target: String(token), targetKind: 'token' });
          }
        }

        for (const target of targets) {
          const deliveryId = `dlv_${hashId(notificationId, target.id)}`;
          const deliveryRef = db.collection(DELIVERY_COLLECTION).doc(deliveryId);
          transaction.set(deliveryRef, {
            notificationId,
            notificationPath: notificationRef.path,
            eventId: ref.id,
            recipientId: context.recipient.uid,
            channel: 'push',
            category: presentation.category,
            registrationId: target.id,
            registrationPath: target.path,
            target: target.target,
            targetKind: target.targetKind,
            title: presentation.title,
            body: presentation.body,
            actionUrl: presentation.actionUrl,
            tag: presentation.tag,
            ttlSeconds: presentation.ttlSeconds,
            status: 'queued',
            attemptCount: 0,
            nextAttemptAt: now(),
            leaseOwner: null,
            leaseUntil: null,
            lastError: null,
            createdAt: now(),
            updatedAt: now(),
            expiresAt: timestampAfter(90 * 24 * 60 * 60_000),
          }, { merge: false });
        }
      }

      transaction.update(ref, {
        status: 'completed',
        completedAt: now(),
        leaseOwner: null,
        leaseUntil: null,
        lastError: null,
        updatedAt: now(),
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const dead = event.attemptCount >= MAX_ATTEMPTS;
    await ref.set({
      status: dead ? 'dead' : 'failed',
      nextAttemptAt: retryAt(event.attemptCount),
      leaseOwner: null,
      leaseUntil: null,
      lastError: message.slice(0, 1000),
      lastErrorAt: now(),
      updatedAt: now(),
    }, { merge: true });
    logger.error('Notification event processing failed.', { eventId: ref.id, attemptCount: event.attemptCount, message });
  }
}

async function processDeliveryByRef(ref: DocumentReference) {
  const claimed = await claimDocument(ref, ['queued', 'failed_transient']);
  if (!claimed) return;
  const job = claimed as Record<string, unknown> & { attemptCount: number; leaseOwner: string };
  try {
    const recipientId = stringValue(job.recipientId);
    const category = stringValue(job.category);
    if (recipientId) {
      const preferences = await db.collection('users').doc(recipientId).collection('notificationPreferences').doc('default').get();
      const preferenceData = preferences.data() as { pushEnabled?: boolean; categories?: Record<string, boolean> } | undefined;
      if (preferenceData?.pushEnabled === false || (category && preferenceData?.categories?.[category] === false)) {
        await ref.set({ status: 'suppressed', suppressedReason: 'user_preference', leaseOwner: null, leaseUntil: null, updatedAt: now() }, { merge: true });
        return;
      }
    }
    const registrationPath = stringValue(job.registrationPath);
    if (registrationPath) {
      const registration = await db.doc(registrationPath).get();
      if (!registration.exists || registration.data()?.enabled !== true || registration.data()?.target !== job.target) {
        await ref.set({ status: 'suppressed', leaseOwner: null, leaseUntil: null, updatedAt: now() }, { merge: true });
        return;
      }
    }

    const actionUrl = stringValue(job.actionUrl, '/dashboard');
    const absoluteLink = new URL(actionUrl.startsWith('/') ? actionUrl : '/dashboard', APP_BASE_URL).toString();
    const target = stringValue(job.target);
    if (!target) throw new Error('Messaging target missing.');

    const message = {
      notification: {
        title: stringValue(job.title, 'Notificare nouă'),
        body: stringValue(job.body, 'Ai o actualizare nouă.'),
      },
      webpush: {
        headers: { TTL: String(Math.max(0, Number(job.ttlSeconds || 3600))) },
        notification: {
          title: stringValue(job.title, 'Notificare nouă'),
          body: stringValue(job.body, 'Ai o actualizare nouă.'),
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: stringValue(job.tag, stringValue(job.notificationId)),
        },
        fcmOptions: { link: absoluteLink },
      },
      data: {
        notificationId: stringValue(job.notificationId),
        path: actionUrl,
      },
      token: target,
    };

    const providerMessageId = await getMessaging().send(message);
    await ref.set({
      status: 'provider_accepted',
      providerMessageId,
      acceptedAt: now(),
      leaseOwner: null,
      leaseUntil: null,
      lastError: null,
      updatedAt: now(),
    }, { merge: true });
    if (registrationPath) {
      await db.doc(registrationPath).set({ lastSuccessfulSendAt: now(), lastError: null }, { merge: true });
    }
  } catch (error) {
    const code = stringValue((error as { code?: unknown }).code);
    const message = error instanceof Error ? error.message : String(error);
    const permanent = code.includes('registration-token-not-registered')
      || code.includes('invalid-registration-token')
      || code.includes('mismatched-credential');
    const dead = permanent || job.attemptCount >= MAX_ATTEMPTS;
    await ref.set({
      status: dead ? 'failed_permanent' : 'failed_transient',
      nextAttemptAt: retryAt(job.attemptCount),
      leaseOwner: null,
      leaseUntil: null,
      lastError: `${code ? `${code}: ` : ''}${message}`.slice(0, 1000),
      lastErrorAt: now(),
      updatedAt: now(),
    }, { merge: true });
    const registrationPath = stringValue(job.registrationPath);
    if (permanent && registrationPath) {
      await db.doc(registrationPath).set({ enabled: false, disabledAt: now(), lastError: code || message }, { merge: true });
    } else if (permanent) {
      const recipientId = stringValue(job.recipientId);
      const legacyTarget = stringValue(job.target);
      if (recipientId && legacyTarget) {
        await db.collection('users').doc(recipientId).set({
          pushTokens: FieldValue.arrayRemove(legacyTarget),
        }, { merge: true });
      }
    }
    logger.error('Notification delivery failed.', { deliveryId: ref.id, attemptCount: job.attemptCount, code, message });
  }
}

function viewingScheduleId(agencyId: string, viewingId: string) {
  return `sch_${hashId('viewing-reminder-2h', agencyId, viewingId)}`;
}

function viewingFingerprint(data: Record<string, unknown>) {
  return hashId(data.viewingDate, data.status, data.agentId);
}

async function syncViewingReminder(agencyId: string, viewingId: string, data?: Record<string, unknown> | null) {
  const ref = db.collection(SCHEDULE_COLLECTION).doc(viewingScheduleId(agencyId, viewingId));
  if (!data || data.status !== 'scheduled' || !nullableString(data.agentId)) {
    await ref.set({ status: 'cancelled', cancelledAt: now(), updatedAt: now() }, { merge: true });
    return;
  }
  const viewingDate = new Date(stringValue(data.viewingDate));
  if (Number.isNaN(viewingDate.getTime())) {
    await ref.set({ status: 'obsolete', updatedAt: now(), lastError: 'Invalid viewingDate.' }, { merge: true });
    return;
  }
  const fingerprint = viewingFingerprint(data);
  const current = await ref.get();
  if (current.exists && current.data()?.sourceFingerprint === fingerprint) return;
  const reminderAt = viewingDate.getTime() - 2 * 60 * 60_000;
  await ref.set({
    type: 'viewing.reminder_2h',
    agencyId,
    entityType: 'viewing',
    entityId: viewingId,
    scheduledFor: Timestamp.fromMillis(reminderAt),
    sourceFingerprint: fingerprint,
    status: reminderAt > Date.now() ? 'pending' : 'obsolete',
    attemptCount: 0,
    nextAttemptAt: Timestamp.fromMillis(reminderAt),
    leaseOwner: null,
    leaseUntil: null,
    firedEventId: null,
    createdAt: current.data()?.createdAt || now(),
    updatedAt: now(),
    expiresAt: Timestamp.fromMillis(viewingDate.getTime() + 30 * 24 * 60 * 60_000),
  }, { merge: false });
}

async function processScheduleByRef(ref: DocumentReference) {
  const claimed = await claimDocument(ref, ['pending', 'failed']);
  if (!claimed) return;
  const schedule = claimed as Record<string, unknown> & { attemptCount: number; leaseOwner: string };
  try {
    if (schedule.type !== 'viewing.reminder_2h') {
      await ref.set({ status: 'obsolete', leaseOwner: null, leaseUntil: null, updatedAt: now() }, { merge: true });
      return;
    }
    const agencyId = stringValue(schedule.agencyId);
    const viewingId = stringValue(schedule.entityId);
    const scheduledFor = schedule.scheduledFor instanceof Timestamp ? schedule.scheduledFor : null;
    if (!scheduledFor || Date.now() - scheduledFor.toMillis() > 10 * 60_000) {
      await ref.set({ status: 'obsolete', obsoleteReason: 'missed_delivery_window', leaseOwner: null, leaseUntil: null, updatedAt: now() }, { merge: true });
      return;
    }
    const viewingRef = db.collection('agencies').doc(agencyId).collection('viewings').doc(viewingId);
    const eventId = `evt_${hashId('viewing.reminder_2h', agencyId, viewingId, schedule.sourceFingerprint)}`;
    const eventRef = db.collection(EVENT_COLLECTION).doc(eventId);
    await db.runTransaction(async (transaction) => {
      const [fresh, viewing] = await Promise.all([transaction.get(ref), transaction.get(viewingRef)]);
      if (!fresh.exists || fresh.data()?.leaseOwner !== schedule.leaseOwner) return;
      const viewingData = viewing.data() as Record<string, unknown> | undefined;
      if (!viewing.exists || !viewingData || viewingData.status !== 'scheduled' || viewingFingerprint(viewingData) !== schedule.sourceFingerprint) {
        transaction.set(ref, { status: 'obsolete', leaseOwner: null, leaseUntil: null, updatedAt: now() }, { merge: true });
        return;
      }
      transaction.set(eventRef, {
        type: 'viewing.reminder_2h',
        schemaVersion: 1,
        agencyId,
        entityType: 'viewing',
        entityId: viewingId,
        sourceEventId: stringValue(schedule.sourceFingerprint),
        sourceUpdateTime: sourceUpdateTime(viewing),
        occurredAt: now(),
        priority: 'reminder',
        payload: {
          agentId: viewingData.agentId || null,
          propertyTitle: viewingData.propertyTitle || 'Proprietate',
          contactName: viewingData.contactName || 'Client',
          viewingDate: viewingData.viewingDate,
        },
        status: 'pending',
        attemptCount: 0,
        nextAttemptAt: now(),
        leaseOwner: null,
        leaseUntil: null,
        lastError: null,
        completedAt: null,
        expiresAt: timestampAfter(90 * 24 * 60 * 60_000),
      }, { merge: true });
      transaction.update(ref, {
        status: 'fired',
        firedAt: now(),
        firedEventId: eventId,
        leaseOwner: null,
        leaseUntil: null,
        updatedAt: now(),
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const dead = schedule.attemptCount >= MAX_ATTEMPTS;
    await ref.set({
      status: dead ? 'dead' : 'failed',
      nextAttemptAt: retryAt(schedule.attemptCount),
      leaseOwner: null,
      leaseUntil: null,
      lastError: message.slice(0, 1000),
      updatedAt: now(),
    }, { merge: true });
  }
}

async function runInChunks<T>(items: T[], runner: (item: T) => Promise<void>, size = 10) {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(runner));
  }
}

function dateParts(date: Date, timeZone = BUCHAREST_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

function zonedDateToUtc(input: { year: number; month: number; day: number; hour?: number; minute?: number }, timeZone = BUCHAREST_TIME_ZONE) {
  const target = Date.UTC(input.year, input.month - 1, input.day, input.hour || 0, input.minute || 0, 0);
  let guess = target;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const actual = dateParts(new Date(guess), timeZone);
    const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    guess += target - actualAsUtc;
  }
  return new Date(guess);
}

function bucharestTomorrowRange(reference = new Date()) {
  const localToday = dateParts(reference);
  const nominalTomorrow = new Date(Date.UTC(localToday.year, localToday.month - 1, localToday.day + 1));
  const nominalDayAfter = new Date(Date.UTC(localToday.year, localToday.month - 1, localToday.day + 2));
  const tomorrow = { year: nominalTomorrow.getUTCFullYear(), month: nominalTomorrow.getUTCMonth() + 1, day: nominalTomorrow.getUTCDate() };
  const dayAfter = { year: nominalDayAfter.getUTCFullYear(), month: nominalDayAfter.getUTCMonth() + 1, day: nominalDayAfter.getUTCDate() };
  const label = `${tomorrow.year}-${String(tomorrow.month).padStart(2, '0')}-${String(tomorrow.day).padStart(2, '0')}`;
  return {
    label,
    start: zonedDateToUtc(tomorrow),
    end: zonedDateToUtc(dayAfter),
  };
}

export const notificationViewingsWritten = onDocumentWritten(
  {
    document: 'agencies/{agencyId}/viewings/{viewingId}',
    region: REGION,
    retry: true,
  },
  async (event) => {
    const agencyId = event.params.agencyId;
    const viewingId = event.params.viewingId;
    const before = event.data?.before.exists ? event.data.before.data() as Record<string, unknown> : null;
    const after = event.data?.after.exists ? event.data.after.data() as Record<string, unknown> : null;
    await syncViewingReminder(agencyId, viewingId, after);
    if (!after) return;

    const oldAgentId = nullableString(before?.agentId);
    const newAgentId = nullableString(after.agentId);
    const assignmentChanged = oldAgentId !== newAgentId;
    const dateChanged = Boolean(before && valuesDiffer(before.viewingDate, after.viewingDate));
    const updateTime = sourceUpdateTime(event.data?.after);

    if (!before && newAgentId) {
      await createNotificationEvent({
        type: 'viewing.assigned', agencyId, entityType: 'viewing', entityId: viewingId,
        sourceEventId: `${event.id}:assigned`, sourceUpdateTime: updateTime, priority: 'action_required',
        payload: { newAgentId, newAgentName: after.agentName || null, propertyTitle: after.propertyTitle, contactName: after.contactName, viewingDate: after.viewingDate },
      });
      return;
    }

    if (before && assignmentChanged) {
      await createNotificationEvent({
        type: 'viewing.assignment_changed', agencyId, entityType: 'viewing', entityId: viewingId,
        sourceEventId: `${event.id}:assignment`, sourceUpdateTime: updateTime, priority: 'action_required',
        payload: {
          oldAgentId, newAgentId, oldAgentName: before.agentName || null, newAgentName: after.agentName || null,
          propertyTitle: after.propertyTitle, contactName: after.contactName, viewingDate: after.viewingDate,
        },
      });
      return;
    }

    if (before && dateChanged && newAgentId) {
      await createNotificationEvent({
        type: 'viewing.rescheduled', agencyId, entityType: 'viewing', entityId: viewingId,
        sourceEventId: `${event.id}:rescheduled`, sourceUpdateTime: updateTime, priority: 'action_required',
        payload: { agentId: newAgentId, propertyTitle: after.propertyTitle, contactName: after.contactName, oldViewingDate: before.viewingDate, newViewingDate: after.viewingDate },
      });
    }
  },
);

const TASK_UPDATE_FIELDS = ['description', 'dueDate', 'startTime', 'duration', 'contactId', 'propertyId', 'participantName', 'participantPhone'];

export const notificationTasksWritten = onDocumentWritten(
  {
    document: 'agencies/{agencyId}/tasks/{taskId}',
    region: REGION,
    retry: true,
  },
  async (event) => {
    const agencyId = event.params.agencyId;
    const taskId = event.params.taskId;
    const before = event.data?.before.exists ? event.data.before.data() as Record<string, unknown> : null;
    const after = event.data?.after.exists ? event.data.after.data() as Record<string, unknown> : null;
    if (!after) return;
    const oldAgentId = nullableString(before?.agentId);
    const newAgentId = nullableString(after.agentId);
    const assignmentChanged = oldAgentId !== newAgentId;
    const updateTime = sourceUpdateTime(event.data?.after);

    if ((!before || assignmentChanged) && newAgentId) {
      await createNotificationEvent({
        type: 'task.assigned', agencyId, entityType: 'task', entityId: taskId,
        sourceEventId: `${event.id}:assigned`, sourceUpdateTime: updateTime, priority: 'action_required',
        payload: { agentId: newAgentId, description: after.description, dueDate: after.dueDate },
      });
      return;
    }
    const meaningfulUpdate = Boolean(before && TASK_UPDATE_FIELDS.some((field) => valuesDiffer(before[field], after[field])));
    if (meaningfulUpdate && newAgentId) {
      await createNotificationEvent({
        type: 'task.updated', agencyId, entityType: 'task', entityId: taskId,
        sourceEventId: `${event.id}:updated`, sourceUpdateTime: updateTime, priority: 'action_required',
        payload: { agentId: newAgentId, description: after.description, dueDate: after.dueDate },
      });
    }
  },
);

export const notificationPropertiesWritten = onDocumentWritten(
  {
    document: 'agencies/{agencyId}/properties/{propertyId}',
    region: REGION,
    retry: true,
  },
  async (event) => {
    const agencyId = event.params.agencyId;
    const propertyId = event.params.propertyId;
    const before = event.data?.before.exists ? event.data.before.data() as Record<string, unknown> : null;
    const after = event.data?.after.exists ? event.data.after.data() as Record<string, unknown> : null;
    if (!after) return;
    const oldAgentId = nullableString(before?.agentId);
    const newAgentId = nullableString(after.agentId);
    if (before && oldAgentId === newAgentId) return;
    if (!before && !newAgentId) return;
    await createNotificationEvent({
      type: before ? 'property.assignment_changed' : 'property.assigned',
      agencyId, entityType: 'property', entityId: propertyId,
      sourceEventId: `${event.id}:assignment`, sourceUpdateTime: sourceUpdateTime(event.data?.after), priority: 'action_required',
      payload: {
        oldAgentId, newAgentId, oldAgentName: before?.agentName || null, newAgentName: after.agentName || null,
        propertyTitle: after.title || 'Proprietate',
      },
    });
  },
);

export const notificationStoriaMessagesWritten = onDocumentWritten(
  {
    document: 'agencies/{agencyId}/storiaInboxLeads/{leadId}',
    region: REGION,
    retry: true,
  },
  async (event) => {
    const agencyId = event.params.agencyId;
    const leadId = event.params.leadId;
    const before = event.data?.before.exists ? event.data.before.data() as Record<string, unknown> : null;
    const after = event.data?.after.exists ? event.data.after.data() as Record<string, unknown> : null;
    if (!after) return;
    const oldMessages = Array.isArray(before?.messages) ? before.messages as Array<Record<string, unknown>> : [];
    const messages = Array.isArray(after.messages) ? after.messages as Array<Record<string, unknown>> : [];
    const previousIds = new Set(oldMessages.map((message) => stringValue(message.id)).filter(Boolean));
    const newMessages = (before ? messages.filter((message) => !previousIds.has(stringValue(message.id))) : messages.slice(-1))
      .filter((message) => stringValue(message.direction, 'received') === 'received');
    await runInChunks(newMessages, async (message) => {
      const messageId = stringValue(message.id);
      if (!messageId) return;
      await createNotificationEvent({
        type: 'storia.message_received', agencyId, entityType: 'storiaInboxLead', entityId: leadId,
        sourceEventId: `storia-message:${messageId}`, sourceUpdateTime: sourceUpdateTime(event.data?.after), priority: 'action_required',
        payload: {
          messageId, propertyId: after.propertyId || null, propertyTitle: after.propertyTitle || null,
          senderName: message.senderName || after.senderName || 'Client Storia', contactName: after.senderName || null,
        },
      });
    });
  },
);

export const notificationFacebookJobsWritten = onDocumentWritten(
  {
    document: 'agencies/{agencyId}/facebookCloudPublishingJobs/{jobId}',
    region: REGION,
    retry: true,
  },
  async (event) => {
    const before = event.data?.before.exists ? event.data.before.data() as Record<string, unknown> : null;
    const after = event.data?.after.exists ? event.data.after.data() as Record<string, unknown> : null;
    if (!before || !after) return;
    const beforeStatus = stringValue(before.status);
    const afterStatus = stringValue(after.status);
    if (beforeStatus === afterStatus) return;
    const failedStates = new Set(['error', 'needs_reauthentication']);
    const completed = afterStatus === 'completed' && beforeStatus !== 'completed';
    const failed = failedStates.has(afterStatus) && !failedStates.has(beforeStatus);
    if (!completed && !failed) return;
    const groups = Array.isArray(after.groups) ? after.groups as Array<Record<string, unknown>> : [];
    const successCount = groups.filter((group) => ['submitted', 'pending_approval'].includes(stringValue(group.status))).length;
    await createNotificationEvent({
      type: completed ? 'facebook_groups.publish_completed' : 'facebook_groups.publish_failed',
      agencyId: event.params.agencyId, entityType: 'property', entityId: stringValue(after.propertyId),
      sourceEventId: `${event.id}:${afterStatus}`, sourceUpdateTime: sourceUpdateTime(event.data?.after),
      priority: failed ? 'action_required' : 'info',
      payload: {
        agentId: after.ownerUid || null, jobId: event.params.jobId, propertyTitle: after.propertyTitle || 'Proprietate',
        groupCount: groups.length, successCount, errorMessage: after.errorMessage || null, status: afterStatus,
      },
    });
  },
);

export const notificationEventsCreated = onDocumentCreated(
  {
    document: `${EVENT_COLLECTION}/{eventId}`,
    region: REGION,
    retry: true,
  },
  async (event) => {
    if (event.data) await processEventByRef(event.data.ref);
  },
);

export const notificationDeliveriesCreated = onDocumentCreated(
  {
    document: `${DELIVERY_COLLECTION}/{deliveryId}`,
    region: REGION,
    retry: true,
  },
  async (event) => {
    if (event.data) await processDeliveryByRef(event.data.ref);
  },
);

export const notificationsMinuteTick = onSchedule(
  {
    schedule: 'every 1 minutes',
    timeZone: BUCHAREST_TIME_ZONE,
    region: REGION,
    memory: '512MiB',
    timeoutSeconds: 240,
  },
  async () => {
    const current = now();
    const [schedules, events, deliveries, stuckEvents, stuckDeliveries, stuckSchedules] = await Promise.all([
      db.collection(SCHEDULE_COLLECTION).where('status', 'in', ['pending', 'failed']).where('nextAttemptAt', '<=', current).orderBy('nextAttemptAt').limit(100).get(),
      db.collection(EVENT_COLLECTION).where('status', 'in', ['pending', 'failed']).where('nextAttemptAt', '<=', current).orderBy('nextAttemptAt').limit(100).get(),
      db.collection(DELIVERY_COLLECTION).where('status', 'in', ['queued', 'failed_transient']).where('nextAttemptAt', '<=', current).orderBy('nextAttemptAt').limit(100).get(),
      db.collection(EVENT_COLLECTION).where('status', '==', 'processing').where('leaseUntil', '<=', current).limit(50).get(),
      db.collection(DELIVERY_COLLECTION).where('status', '==', 'processing').where('leaseUntil', '<=', current).limit(50).get(),
      db.collection(SCHEDULE_COLLECTION).where('status', '==', 'processing').where('leaseUntil', '<=', current).limit(50).get(),
    ]);
    await Promise.all([
      runInChunks([...schedules.docs, ...stuckSchedules.docs], (snapshot) => processScheduleByRef(snapshot.ref)),
      runInChunks([...events.docs, ...stuckEvents.docs], (snapshot) => processEventByRef(snapshot.ref)),
      runInChunks([...deliveries.docs, ...stuckDeliveries.docs], (snapshot) => processDeliveryByRef(snapshot.ref)),
    ]);
    logger.info('Notification minute tick completed.', {
      schedules: schedules.size + stuckSchedules.size,
      events: events.size + stuckEvents.size,
      deliveries: deliveries.size + stuckDeliveries.size,
    });
  },
);

export const viewingTomorrowDigest = onSchedule(
  {
    schedule: '0 21 * * *',
    timeZone: BUCHAREST_TIME_ZONE,
    region: REGION,
    memory: '512MiB',
    timeoutSeconds: 240,
    retryCount: 3,
  },
  async () => {
    const range = bucharestTomorrowRange();
    const snapshot = await db.collectionGroup('viewings')
      .where('status', '==', 'scheduled')
      .where('viewingDate', '>=', range.start.toISOString())
      .where('viewingDate', '<', range.end.toISOString())
      .get();
    const grouped = new Map<string, { agencyId: string; viewingDates: string[] }>();
    for (const viewing of snapshot.docs) {
      const data = viewing.data();
      const agentId = nullableString(data.agentId);
      const pathParts = viewing.ref.path.split('/');
      const agencyId = pathParts[0] === 'agencies' ? pathParts[1] : '';
      if (!agentId || !agencyId || isDemoAgency(agencyId)) continue;
      const current = grouped.get(agentId) || { agencyId, viewingDates: [] };
      current.viewingDates.push(stringValue(data.viewingDate));
      grouped.set(agentId, current);
    }
    await runInChunks([...grouped.entries()], async ([agentId, data]) => {
      data.viewingDates.sort();
      await createNotificationEvent({
        type: 'viewing.tomorrow_digest', agencyId: data.agencyId, entityType: 'viewingDigest', entityId: `${agentId}:${range.label}`,
        sourceEventId: `viewing-digest:${agentId}:${range.label}`, priority: 'reminder',
        payload: { agentId, count: data.viewingDates.length, firstViewingDate: data.viewingDates[0] || null, tomorrowDate: range.label },
      });
    });
  },
);
