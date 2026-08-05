import type {
  DesktopFacebookRunnerActionResult,
  DesktopFacebookRunnerStatus,
  SaveFacebookRunnerSessionInput,
  StartFacebookRunnerInput,
} from '@/lib/desktop/facebook-promotion';
import type {
  DesktopGmailRunnerStatus,
  GmailRunnerAttachment,
  StartGmailRunnerInput,
} from '@/lib/desktop/gmail-runner';

type FacebookLocalRunnerStatus = {
  paired: boolean;
  running: boolean;
  deviceId?: string | null;
  agencyId?: string | null;
  apiBase?: string | null;
  lastSeenAt?: string | null;
  lastError?: string | null;
  nextWakeAt?: string | null;
  launchReason?: string | null;
  wakeTasksConfigured?: boolean;
};

declare global {
  interface Window {
    imodeusDesktop?: {
      isDesktop: () => Promise<boolean>;
      showDesktopNotification: (input: { title: string; body: string; actionUrl?: string }) => Promise<{ shown: boolean }>;
      consumePendingNotificationNavigation: () => Promise<string | null>;
      onDesktopNotificationNavigate: (callback: (path: string) => void) => () => void;
      getFacebookLocalRunnerStatus: () => Promise<FacebookLocalRunnerStatus>;
      pairFacebookLocalRunner: (input: {
        idToken: string;
        apiBase: string;
        deviceName?: string;
      }) => Promise<FacebookLocalRunnerStatus>;
      syncFacebookLocalRunnerNow: () => Promise<FacebookLocalRunnerStatus>;
      openFacebookLocalConnection: (input: { connectionId: string }) => Promise<{ connected: boolean }>;
      onFacebookLocalRunnerStatusChanged: (callback: (status: FacebookLocalRunnerStatus) => void) => () => void;
      generatePropertyPresentationPdf: (input: {
        url: string;
        token: string;
        fileName?: string;
        method?: 'GET' | 'POST';
        body?: unknown;
      }) => Promise<{ canceled: boolean; filePath?: string | null }>;
      getOlxPhoneNumber: (input: { url: string }) => Promise<{ phone?: string; message?: string }>;
      selectGmailRunnerFiles: () => Promise<{ canceled: boolean; files: GmailRunnerAttachment[] }>;
      startGmailRunner: (input: StartGmailRunnerInput) => Promise<DesktopGmailRunnerStatus>;
      retryGmailRunner: () => Promise<DesktopGmailRunnerStatus>;
      stopGmailRunner: () => Promise<DesktopGmailRunnerStatus>;
      resetGmailRunnerProfile: () => Promise<DesktopGmailRunnerStatus>;
      getGmailRunnerStatus: () => Promise<DesktopGmailRunnerStatus>;
      onGmailRunnerStatusChanged: (callback: (status: DesktopGmailRunnerStatus) => void) => () => void;
      startFacebookRunner: (input: StartFacebookRunnerInput) => Promise<DesktopFacebookRunnerStatus>;
      retryFacebookRunnerCurrentGroup: () => Promise<DesktopFacebookRunnerActionResult>;
      markFacebookRunnerPosted: () => Promise<DesktopFacebookRunnerActionResult>;
      skipFacebookRunnerGroup: () => Promise<DesktopFacebookRunnerActionResult>;
      stopFacebookRunner: () => Promise<DesktopFacebookRunnerStatus>;
      resetFacebookRunnerProfile: () => Promise<DesktopFacebookRunnerStatus>;
      getFacebookRunnerStatus: () => Promise<DesktopFacebookRunnerStatus>;
      saveFacebookRunnerSessionFile: (input: SaveFacebookRunnerSessionInput) => Promise<{ canceled: boolean; filePath?: string | null }>;
      onFacebookRunnerStatusChanged: (callback: (status: DesktopFacebookRunnerStatus) => void) => () => void;
    };
  }
}

export {};
