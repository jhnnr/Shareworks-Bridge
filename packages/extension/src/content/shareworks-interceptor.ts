// Injected into the page's MAIN execution world to hook window.fetch and XMLHttpRequest
(function initializePageInterceptor() {
  const customWindow = window as unknown as { __SW_INTERCEPTOR_ACTIVE__?: boolean };
  if (customWindow.__SW_INTERCEPTOR_ACTIVE__) {
    return;
  }
  customWindow.__SW_INTERCEPTOR_ACTIVE__ = true;

  const KEYWORDS_REGEX = /portfolio|holding|grant|equity|solium|account|sw-ptpapi|linkedAccount/i;

  // 1. Hook window.fetch
  const originalFetch = window.fetch;
  if (originalFetch) {
    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
      const response = await originalFetch.call(this, input, init);
      try {
        const url = typeof input === 'string' ? input : (input as Request)?.url || '';
        if (KEYWORDS_REGEX.test(url)) {
          response
            .clone()
            .json()
            .then((data: unknown) => {
              if (data && typeof data === 'object') {
                window.postMessage(
                  {
                    source: 'shareworks-page-interceptor',
                    url,
                    data,
                  },
                  '*'
                );
              }
            })
            .catch(() => {});
        }
      } catch {
        // Suppress interception errors
      }
      return response;
    };
  }

  // 2. Hook XMLHttpRequest
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    asyncParam?: boolean,
    user?: string | null,
    password?: string | null
  ) {
    (this as unknown as { _swUrl?: string })._swUrl = String(url);
    return originalOpen.call(this, method, url, asyncParam ?? true, user, password);
  };

  XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
    this.addEventListener('load', function () {
      try {
        const url = (this as unknown as { _swUrl?: string })._swUrl || '';
        if (KEYWORDS_REGEX.test(url) && this.responseText) {
          const data: unknown = JSON.parse(this.responseText);
          if (data && typeof data === 'object') {
            window.postMessage(
              {
                source: 'shareworks-page-interceptor',
                url,
                data,
              },
              '*'
            );
          }
        }
      } catch {
        // Suppress parsing errors
      }
    });
    return originalSend.call(this, body);
  };
})();
