(() => {
  let activeRequest = null;

  function normalizePhone(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.startsWith('004') && digits.length === 13) return digits.slice(3);
    if (digits.startsWith('4') && digits.length === 11) return digits.slice(1);
    if (/^0[237]\d{8}$/.test(digits)) return digits;
    return '';
  }

  function extractPhone(value) {
    const matches = String(value || '').match(/(?:\+4|004)?0[237]\d(?:[\s.-]?\d){7,8}/g) || [];
    for (const match of matches) {
      const phone = normalizePhone(match);
      if (phone) return phone;
    }
    return '';
  }

  function findPhone() {
    const telephoneLink = Array.from(document.querySelectorAll('a[href^="tel:"]'))
      .map((node) => node.getAttribute('href') || '')
      .find(Boolean);
    return extractPhone(telephoneLink || document.body?.innerText || '');
  }

  function findRevealControl() {
    const direct = document.querySelector(
      '[data-testid="show-phone"], [data-cy*="phone" i], [data-testid*="phone" i], [aria-label*="telefon" i], [aria-label*="phone" i]'
    );
    if (direct instanceof HTMLElement) return direct;
    return Array.from(document.querySelectorAll('button, a, [role="button"]')).find((node) => {
      const label = [
        node.textContent || '',
        node.getAttribute('aria-label') || '',
        node.getAttribute('data-testid') || '',
      ].join(' ');
      return /arat|afi|num|telefon|phone|contact/i.test(label);
    });
  }

  async function extractDisplayedPhone() {
    const immediate = findPhone();
    if (immediate) return { phone: immediate, status: 'success' };

    const control = findRevealControl();
    if (!(control instanceof HTMLElement)) {
      return { phone: '', status: 'phone_control_missing' };
    }

    control.scrollIntoView({ block: 'center', behavior: 'instant' });
    control.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    control.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    control.click();

    return new Promise((resolve) => {
      const startedAt = Date.now();
      const observer = new MutationObserver(() => {
        const phone = findPhone();
        if (!phone) return;
        observer.disconnect();
        clearInterval(interval);
        resolve({ phone, status: 'success' });
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['href'],
      });
      const interval = setInterval(() => {
        const phone = findPhone();
        if (phone || Date.now() - startedAt >= 5500) {
          observer.disconnect();
          clearInterval(interval);
          resolve({
            phone: phone || '',
            status: phone ? 'success' : 'not_found',
          });
        }
      }, 250);
    });
  }

  window.addEventListener('message', async (event) => {
    const payload = event.data;
    if (
      event.source !== window ||
      payload?.source !== 'imodeus-app' ||
      payload?.type !== 'IMODEUS_OLX_PHONE_REQUEST' ||
      !payload?.requestId
    ) {
      return;
    }
    if (activeRequest) {
      window.postMessage(
        {
          source: 'imodeus-olx-extension',
          type: 'IMODEUS_OLX_PHONE_RESULT',
          requestId: payload.requestId,
          phone: '',
          status: 'busy',
        },
        '*'
      );
      return;
    }

    activeRequest = payload.requestId;
    try {
      const result = await extractDisplayedPhone();
      window.postMessage(
        {
          source: 'imodeus-olx-extension',
          type: 'IMODEUS_OLX_PHONE_RESULT',
          requestId: payload.requestId,
          ...result,
        },
        '*'
      );
    } finally {
      activeRequest = null;
    }
  });
})();
