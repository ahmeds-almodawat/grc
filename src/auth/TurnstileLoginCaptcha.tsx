import { useEffect, useRef, useState } from 'react';

const TURNSTILE_SCRIPT_ID = 'grc-login-turnstile-script';
const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

type TurnstileWidgetId = string;

interface TurnstileRenderOptions {
  sitekey: string;
  callback: (token: string) => void;
  'expired-callback': () => void;
  'error-callback': () => void;
  'timeout-callback': () => void;
  language?: string;
}

interface TurnstileApi {
  render: (element: HTMLElement, options: TurnstileRenderOptions) => TurnstileWidgetId;
  reset: (widgetId: TurnstileWidgetId) => void;
  remove: (widgetId: TurnstileWidgetId) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstileLoadPromise: Promise<TurnstileApi> | null = null;

function discardFailedTurnstileScript(): void {
  const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing && existing.dataset.grcLoadState !== 'loading') existing.remove();
  turnstileLoadPromise = null;
}

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstileLoadPromise) return turnstileLoadPromise;

  let existing = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing && existing.dataset.grcLoadState !== 'loading') {
    existing.remove();
    existing = null;
  }

  turnstileLoadPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = existing ?? document.createElement('script');
    let timeoutId: number | undefined;
    let settled = false;

    const cleanup = () => {
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      script.dataset.grcLoadState = 'failed';
      script.remove();
      turnstileLoadPromise = null;
      reject(new Error(message));
    };
    const onLoad = () => {
      if (settled) return;
      if (!window.turnstile) {
        fail('The CAPTCHA provider loaded without a usable browser API.');
        return;
      }
      settled = true;
      cleanup();
      script.dataset.grcLoadState = 'loaded';
      resolve(window.turnstile);
    };
    const onError = () => fail('The CAPTCHA provider could not be loaded.');

    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
    timeoutId = window.setTimeout(onError, 15_000);

    if (!existing) {
      script.id = TURNSTILE_SCRIPT_ID;
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.referrerPolicy = 'strict-origin-when-cross-origin';
      script.dataset.grcLoadState = 'loading';
      document.head.appendChild(script);
    }
  });

  return turnstileLoadPromise;
}

export interface TurnstileCaptchaProps {
  siteKey: string;
  language: 'en' | 'ar';
  resetVersion: number;
  onToken: (token: string | null) => void;
  onUnavailable: (message: string) => void;
  ariaLabel?: string;
}

export function TurnstileCaptcha({
  siteKey,
  language,
  resetVersion,
  onToken,
  onUnavailable,
  ariaLabel = 'Authentication CAPTCHA challenge',
}: TurnstileCaptchaProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<TurnstileWidgetId | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    // Any widget recreation invalidates the prior token, including a language
    // change. A token from a removed widget must never remain submit-capable.
    onToken(null);

    void loadTurnstile()
      .then((turnstile) => {
        if (!active || !containerRef.current) return;
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          language,
          callback: (token) => {
            if (!active) return;
            setStatus('ready');
            onToken(token);
          },
          'expired-callback': () => {
            if (!active) return;
            onToken(null);
            onUnavailable('The CAPTCHA challenge expired. Complete it again.');
            const widgetId = widgetIdRef.current;
            if (widgetId) turnstile.reset(widgetId);
          },
          'error-callback': () => {
            if (!active) return;
            setStatus('unavailable');
            onToken(null);
            onUnavailable('The CAPTCHA challenge is unavailable. Authentication remains blocked.');
          },
          'timeout-callback': () => {
            if (!active) return;
            onToken(null);
            onUnavailable('The CAPTCHA challenge timed out. Complete it again.');
            const widgetId = widgetIdRef.current;
            if (widgetId) turnstile.reset(widgetId);
          },
        });
        setStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setStatus('unavailable');
        onToken(null);
        onUnavailable('The CAPTCHA provider could not be loaded. Authentication remains blocked.');
      });

    return () => {
      active = false;
      const widgetId = widgetIdRef.current;
      widgetIdRef.current = null;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [language, loadAttempt, onToken, onUnavailable, siteKey]);

  useEffect(() => {
    const widgetId = widgetIdRef.current;
    if (resetVersion > 0 && widgetId && window.turnstile) {
      onToken(null);
      window.turnstile.reset(widgetId);
    }
  }, [onToken, resetVersion]);

  const retryProvider = () => {
    onToken(null);
    discardFailedTurnstileScript();
    setLoadAttempt((current) => current + 1);
  };

  return (
    <div className="auth-captcha" aria-label={ariaLabel}>
      <div ref={containerRef} />
      <span className="muted" aria-live="polite">
        {status === 'loading'
          ? (language === 'ar' ? 'جارٍ تحميل اختبار CAPTCHA…' : 'Loading CAPTCHA challenge…')
          : status === 'unavailable'
            ? (language === 'ar' ? 'اختبار CAPTCHA غير متاح.' : 'CAPTCHA challenge unavailable.')
            : null}
      </span>
      {status === 'unavailable' ? (
        <button className="language-toggle" type="button" onClick={retryProvider}>
          {language === 'ar' ? 'إعادة محاولة CAPTCHA' : 'Retry CAPTCHA'}
        </button>
      ) : null}
    </div>
  );
}

export function TurnstileLoginCaptcha(props: TurnstileCaptchaProps) {
  return <TurnstileCaptcha {...props} ariaLabel={props.ariaLabel ?? 'Login CAPTCHA challenge'} />;
}
