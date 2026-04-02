import type { FacebookPromotionSession } from '@/lib/types';

export const FACEBOOK_PROMOTION_CHANNELS = {
  isDesktop: 'desktop:is-desktop',
  startRunner: 'facebook-runner:start',
  retryCurrentGroup: 'facebook-runner:retry-current-group',
  markPosted: 'facebook-runner:mark-posted',
  skipGroup: 'facebook-runner:skip-group',
  stopRunner: 'facebook-runner:stop',
  resetProfile: 'facebook-runner:reset-profile',
  getStatus: 'facebook-runner:get-status',
  saveSessionFile: 'facebook-runner:save-session-file',
  onStatusChanged: 'facebook-runner:status-changed',
} as const;

export type DesktopFacebookRunnerState =
  | 'idle'
  | 'starting'
  | 'running'
  | 'waiting_for_publish'
  | 'stopped'
  | 'completed'
  | 'error';

export type DesktopFacebookRunnerStatus = {
  state: DesktopFacebookRunnerState;
  message?: string;
  currentGroupIndex?: number;
  currentGroupName?: string | null;
  sessionPath?: string | null;
  completedCount?: number;
  totalCount?: number;
};

export type StartFacebookRunnerInput = {
  session: FacebookPromotionSession;
};

export type SaveFacebookRunnerSessionInput = {
  session: FacebookPromotionSession;
};

export type DesktopFacebookRunnerActionResult = {
  status: DesktopFacebookRunnerStatus;
  session?: FacebookPromotionSession | null;
};
