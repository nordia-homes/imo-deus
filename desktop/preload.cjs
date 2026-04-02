const { contextBridge, ipcRenderer } = require('electron');

const api = {
  isDesktop: () => ipcRenderer.invoke('desktop:is-desktop'),
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
