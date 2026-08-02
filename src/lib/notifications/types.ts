import type { Timestamp } from 'firebase/firestore';

export const NOTIFICATION_CATEGORY_KEYS = [
  'storiaMessages',
  'viewingAssignments',
  'viewingRescheduled',
  'viewingReminders',
  'taskAssignments',
  'taskUpdates',
  'facebookCompleted',
  'facebookFailed',
  'propertyAssignments',
  'clientPortalFeedback',
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORY_KEYS)[number];

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  storiaMessages: 'Mesaj Storia nou',
  viewingAssignments: 'Vizionare atribuita sau realocata',
  viewingRescheduled: 'Vizionare reprogramata',
  viewingReminders: 'Remindere pentru vizionari',
  taskAssignments: 'Task atribuit',
  taskUpdates: 'Modificare task',
  facebookCompleted: 'Publicare Facebook finalizata',
  facebookFailed: 'Publicare Facebook esuata',
  propertyAssignments: 'Proprietate atribuita sau realocata',
  clientPortalFeedback: 'Feedback din portalul clientului',
};

export type NotificationPreferences = {
  pushEnabled: boolean;
  categories: Partial<Record<NotificationCategory, boolean>>;
  updatedAt?: Timestamp | string | null;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  pushEnabled: true,
  categories: Object.fromEntries(
    NOTIFICATION_CATEGORY_KEYS.map((category) => [category, true]),
  ) as Record<NotificationCategory, boolean>,
};

export type AppNotification = {
  id: string;
  eventId: string;
  recipientId: string;
  agencyId: string;
  type: string;
  category: NotificationCategory;
  priority: 'action_required' | 'reminder' | 'info';
  title: string;
  body: string;
  actionUrl: string;
  entityType: string;
  entityId: string;
  createdAt: Timestamp | string;
  isRead: boolean;
  readAt?: Timestamp | string | null;
  expiresAt?: Timestamp | string | null;
};

export type MessagingRegistration = {
  id: string;
  installationId: string;
  target: string;
  targetKind: 'token';
  platform: 'web';
  origin: string;
  deviceLabel?: string;
  enabled: boolean;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
  lastSeenAt?: Timestamp | string;
};
