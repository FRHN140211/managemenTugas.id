/* ============================================================
   sentry.js — Sentry browser SDK initialization
   DSN and config are injected by server.js into the HTML.
   ============================================================ */

(function () {
  'use strict';

  var DSN = window.SENTRY_DSN || '';
  if (!DSN) return;

  var environment = window.SENTRY_ENV || 'production';
  var tracesSampleRate = typeof window.SENTRY_TRACES_SAMPLE_RATE === 'number'
    ? window.SENTRY_TRACES_SAMPLE_RATE : 0.1;
  var replaysSessionSampleRate = typeof window.SENTRY_REPLAYS_SESSION_SAMPLE_RATE === 'number'
    ? window.SENTRY_REPLAYS_SESSION_SAMPLE_RATE : 0.1;
  var replaysOnErrorSampleRate = typeof window.SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE === 'number'
    ? window.SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE : 1.0;

  function bootstrap() {
    if (typeof Sentry === 'undefined') {
      setTimeout(bootstrap, 50);
      return;
    }

    try {
      Sentry.init({
        dsn: DSN,
        environment: environment,
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration({
            sessionSampleRate: replaysSessionSampleRate,
            errorSampleRate: replaysOnErrorSampleRate
          })
        ],
        tracesSampleRate: tracesSampleRate,
        attachStacktrace: true,
        beforeSend: function (event) {
          if (event.request) {
            delete event.request.cookies;
            delete event.request.headers;
          }
          if (event.user && event.user.email) {
            event.user.email = undefined;
          }
          return event;
        }
      });

      Sentry.captureMessage('Sentry browser SDK initialized', 'info');
    } catch (e) {
      console.warn('Sentry browser SDK init failed:', e);
    }
  }

  var script = document.createElement('script');
  script.src = 'https://browser.sentry-cdn.com/7.119.0/bundle.min.js';
  script.crossOrigin = 'anonymous';
  script.onload = bootstrap;
  script.onerror = function () {
    console.warn('Failed to load Sentry browser SDK from CDN');
  };
  document.head.appendChild(script);
})();
