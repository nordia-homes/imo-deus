import type {
  DesktopFacebookRunnerActionResult,
  DesktopFacebookRunnerStatus,
  SaveFacebookRunnerSessionInput,
  StartFacebookRunnerInput,
} from '@/lib/desktop/facebook-promotion';

declare global {
  interface Window {
    imodeusDesktop?: {
      isDesktop: () => Promise<boolean>;
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
