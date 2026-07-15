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

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstileLoadPromise) return turnstileLoadPromise;

  turnstileLoadPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement('script');
    let timeoutId: number | undefined;

    const cleanup = () => {
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
    const onLoad = () => {
      cleanup();
      if (window.turnstile) {
        resolve(window.turnstile);
      } else {
        turnstileLoadPromise = null;
        reject(new Error('The CAPTCHA provider loaded without a usable browser API.'));
      }
    };
    const onError = () => {
      cleanup();
      turnstileLoadPromise = null;
      reject(new Error('The CAPTCHA provider could not be loaded.'));
    };

    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
    timeoutId = window.setTimeout(onError, 15_000);

    if (!existing) {
      script.id = TURNSTILE_SCRIPT_ID;
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.referrerPolicy = 'strict-origin-when-cross-origin';
      document.head.appendChild(script);
    }
  });

  return turnstileLoadPromise;
}

interface TurnstileLoginCaptchaProps {
  siteKey: string;
  language: 'en' | 'ar';
  resetVersion: number;
  onToken: (token: string | null) => void;
  onUnavailable: (message: string) => void;
}

export function TurnstileLoginCaptcha({
  siteKey,
  language,
  resetVersion,
  onToken,
  onUnavailable,
}: TurnstileLoginCaptchaProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<TurnstileWidgetId | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  useEffect(() => {
    let active = true;

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
            onUnavailable('The CAPTCHA challenge is unavailable. Sign-in remains blocked.');
          },
          'timeout-callback': () => {
            if (!active) return;
            onToken(null);
            onUnavailable('The CAPTCHA challenge timed out. Complete it again.');
          },
        });
        setStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setStatus('unavailable');
        onToken(null);
        onUnavailable('The CAPTCHA provider could not be loaded. Sign-in remains blocked.');
      });

    return () => {
      active = false;
      const widgetId = widgetIdRef.current;
      widgetIdRef.current = null;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [language, onToken, onUnavailable, siteKey]);

  useEffect(() => {
    const widgetId = widgetIdRef.current;
    if (resetVersion > 0 && widgetId && window.turnstile) {
      window.turnstile.reset(widgetId);
    }
  }, [resetVersion]);

  return (
    <div className="auth-captcha" aria-label="Login CAPTCHA challenge">
      <div ref={containerRef} />
      <span className="muted" aria-live="polite">
        {status === 'loading'
          ? (language === 'ar' ? 'جارٍ تحميل اختبار CAPTCHA…' : 'Loading CAPTCHA challenge…')
          : status === 'unavailable'
            ? (language === 'ar' ? 'اختبار CAPTCHA غير متاح.' : 'CAPTCHA challenge unavailable.')
            : null}
      </span>
    </div>
  );
}
