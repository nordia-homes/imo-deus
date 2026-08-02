const { contextBridge, ipcRenderer } = require('electron');

const api = {
  isDesktop: () => ipcRenderer.invoke('desktop:is-desktop'),
  showDesktopNotification: (input) => ipcRenderer.invoke('notifications:show', input),
  consumePendingNotificationNavigation: () => ipcRenderer.invoke('notifications:consume-pending-navigation'),
  onDesktopNotificationNavigate: (callback) => {
    const listener = (_event, path) => callback(path);
    ipcRenderer.on('notifications:navigate', listener);
    return () => ipcRenderer.removeListener('notifications:navigate', listener);
  },
  generatePropertyPresentationPdf: (input) => ipcRenderer.invoke('property-presentation:generate-pdf', input),
  getFacebookLocalRunnerStatus: () => ipcRenderer.invoke('facebook-local-runner:get-status'),
  pairFacebookLocalRunner: (input) => ipcRenderer.invoke('facebook-local-runner:pair', input),
  syncFacebookLocalRunnerNow: () => ipcRenderer.invoke('facebook-local-runner:sync-now'),
  openFacebookLocalConnection: (input) => ipcRenderer.invoke('facebook-local-runner:open-connection', input),
  onFacebookLocalRunnerStatusChanged: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('facebook-local-runner:status-changed', listener);
    return () => ipcRenderer.removeListener('facebook-local-runner:status-changed', listener);
  },

  getOlxPhoneNumber: (input) => ipcRenderer.invoke('olx-phone:get-number', input),
  startFacebookRunner: (input) => ipcRenderer.invoke('facebook-runner:start', input),
  retryFacebookRunnerCurrentGroup: () => ipcRenderer.invoke('facebook-runner:retry-current-group'),
  markFacebookRunnerPosted: () => ipcRenderer.invoke('facebook-runner:mark-posted'),
  skipFacebookRunnerGroup: () => ipcRenderer.invoke('facebook-runner:skip-group'),
  stopFacebookRunner: () => ipcRenderer.invoke('facebook-runner:stop'),
  resetFacebookRunnerProfile: () => ipcRenderer.invoke('facebook-runner:reset-profile'),
  getFacebookRunnerStatus: () => ipcRenderer.invoke('facebook-runner:get-status'),
  saveFacebookRunnerSessionFile: (input) => ipcRenderer.invoke('facebook-runner:save-session-file', input),
  onFacebookRunnerStatusChanged: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('facebook-runner:status-changed', listener);
    return () => ipcRenderer.removeListener('facebook-runner:status-changed', listener);
  },
};

contextBridge.exposeInMainWorld('imodeusDesktop', api);
