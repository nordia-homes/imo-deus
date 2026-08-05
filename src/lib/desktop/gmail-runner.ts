export type GmailRunnerAttachment = {
  name: string;
  path?: string | null;
  url?: string | null;
  size?: number | null;
};

export type GmailRunnerSession = {
  jobId: string;
  saleId: string;
  messageRecordId: string;
  trackingCode: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyText: string;
  bodyHtml?: string | null;
  attachments: GmailRunnerAttachment[];
};

export type GmailRunnerState =
  | 'idle'
  | 'starting'
  | 'needs_login'
  | 'preparing'
  | 'waiting_for_send'
  | 'sent_ui_confirmed'
  | 'stopped'
  | 'error';

export type DesktopGmailRunnerStatus = {
  state: GmailRunnerState;
  message: string;
  jobId?: string | null;
  saleId?: string | null;
  messageRecordId?: string | null;
  completedFields?: string[];
  missingFields?: string[];
  attachmentCount?: number;
  preparedAt?: string | null;
  sentAt?: string | null;
  attempt?: number;
  selectorProfile?: string | null;
  canRetry?: boolean;
  diagnosticCode?: string | null;
};

export type StartGmailRunnerInput = { session: GmailRunnerSession };
