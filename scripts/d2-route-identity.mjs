export const CAPTURED = 'CAPTURED';
export const CAPTURE_WRONG_ROUTE = 'CAPTURE_WRONG_ROUTE';

function normalizedText(value) {
  return typeof value === 'string' ? value.trim() : '';
}
export function validateRouteIdentity({
  requestedPageKey,
  requestedLocation,
  browserLocation,
  renderedPageKey,
  renderedPageLocation,
  renderedHeading,
}) {
  const expectedPageKey = normalizedText(requestedPageKey);
  const expectedLocation = normalizedText(requestedLocation);
  const actualPageKey = normalizedText(renderedPageKey);
  const actualLocation = normalizedText(renderedPageLocation);
  const actualHeading = normalizedText(renderedHeading);
  let urlLocation = '';

  try {
    const url = new URL(browserLocation, 'http://127.0.0.1');
    urlLocation = normalizedText(url.searchParams.get('page'));
  } catch {
    urlLocation = '';
  }

  const checks = {
    requestedPageKeyPresent: Boolean(expectedPageKey),
    requestedLocationPresent: Boolean(expectedLocation),
    urlLocationMatches: urlLocation === expectedLocation,
    renderedPageKeyMatches: actualPageKey === expectedPageKey,
    renderedPageLocationMatches: actualLocation === expectedLocation,
    pageHeadingPresent: Boolean(actualHeading),
  };
  const passed = Object.values(checks).every(Boolean);

  return {
    status: passed ? CAPTURED : CAPTURE_WRONG_ROUTE,
    passed,
    requestedPageKey: expectedPageKey,
    requestedLocation: expectedLocation,
    browserLocation: normalizedText(browserLocation),
    urlLocation,
    renderedPageKey: actualPageKey,
    renderedPageLocation: actualLocation,
    renderedHeading: actualHeading,
    checks,
  };
}

/**
 * Capture only after route identity is proven. The caller may provide one
 * recovery navigation; a second mismatch is returned without another retry.
 */
export async function captureWithRouteIdentity({
  readIdentity,
  capture,
  recover,
  maximumAttempts = 2,
}) {
  if (maximumAttempts !== 2) {
    throw new Error('D2-R route capture permits exactly one retry.');
  }

  const attempts = [];
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const identity = validateRouteIdentity(await readIdentity());
    attempts.push({ attempt, ...identity });
    if (identity.passed) {
      await capture(identity);
      return { ...identity, attempts };
    }
    if (attempt < maximumAttempts && recover) await recover(identity);
  }

  return {
    ...attempts.at(-1),
    status: CAPTURE_WRONG_ROUTE,
    passed: false,
    attempts,
  };
}
