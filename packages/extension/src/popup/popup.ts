function updatePopupUi(): void {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;

  chrome.runtime.sendMessage({ action: 'CHECK_STATUS' }, (res) => {
    const tabStatus = document.getElementById('tab-status');
    const authStatus = document.getElementById('auth-status');
    const badge = document.getElementById('bridge-badge');

    if (tabStatus && authStatus && res) {
      if (res.activeTabDetected) {
        tabStatus.textContent = 'Detected';
        tabStatus.style.color = '#4ade80';
      } else {
        tabStatus.textContent = 'Not Found';
        tabStatus.style.color = '#94a3b8';
      }

      if (res.authState === 'AUTHENTICATED') {
        authStatus.textContent = 'Authenticated';
        authStatus.style.color = '#4ade80';
        if (badge) badge.className = 'status-badge active';
      } else if (res.authState === 'MFA_REQUIRED') {
        authStatus.textContent = 'MFA Needed';
        authStatus.style.color = '#fbbf24';
        if (badge) badge.className = 'status-badge warning';
      } else {
        authStatus.textContent = 'Disconnected';
        authStatus.style.color = '#94a3b8';
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  updatePopupUi();

  const syncBtn = document.getElementById('sync-btn');
  if (syncBtn) {
    syncBtn.addEventListener('click', () => {
      syncBtn.textContent = 'Triggering Sync...';
      chrome.runtime.sendMessage({ action: 'START_SYNC' }, () => {
        setTimeout(() => {
          syncBtn.textContent = 'Sync Triggered';
          updatePopupUi();
        }, 1000);
      });
    });
  }
});
