import * as Sentry from '@sentry/react-native';

// Get your DSN from https://sentry.io → Settings → Projects → Client Keys (DSN)
// Leave empty to disable Sentry (events are captured locally but not sent).
const SENTRY_DSN = '';

export function initSentry(): void {
  Sentry.init({
    dsn: SENTRY_DSN || undefined,
    // Debug logging routes through console.error, which Metro renders as a red
    // error overlay. With no DSN, every capture would log a "Transport disabled"
    // error, so only enable it once a DSN is actually configured.
    debug: __DEV__ && !!SENTRY_DSN,
    // Sample 20% of traces in production to stay within free-tier limits
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    environment: __DEV__ ? 'development' : 'production',
  });
}

// Call in catch blocks that currently swallow errors silently.
// Safe to call even with no DSN configured — falls back to a console log
// instead of asking Sentry to send (and log-fail on) a disabled transport.
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (!SENTRY_DSN) {
    if (__DEV__) console.warn('[captureError]', error, context);
    return;
  }

  if (context) {
    Sentry.withScope((scope) => {
      scope.setExtras(context);
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

export { Sentry };
