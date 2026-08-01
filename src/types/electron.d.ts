import type {
  DesktopFacebookRunnerActionResult,
  DesktopFacebookRunnerStatus,
  SaveFacebookRunnerSessionInput,
  StartFacebookRunnerInput,
} from '@/lib/desktop/facebook-promotion';

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
