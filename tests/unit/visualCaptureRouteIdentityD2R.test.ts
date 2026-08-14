import { describe, expect, it, vi } from 'vitest';
import {
  CAPTURED,
  CAPTURE_WRONG_ROUTE,
  captureWithRouteIdentity,
  validateRouteIdentity,
} from '../../scripts/d2-route-identity.mjs';

const expected = {
  requestedPageKey: 'admin',
  requestedLocation: 'admin',
  browserLocation: 'http://127.0.0.1:4173/?page=admin',
  renderedPageKey: 'admin',
  renderedPageLocation: 'admin',
  renderedHeading: 'User Management Center',
};

describe('D2-R screenshot route identity', () => {
  it('accepts a capture only when URL and rendered route markers agree', () => {
    expect(validateRouteIdentity(expected)).toMatchObject({
      status: CAPTURED,
      passed: true,
      urlLocation: 'admin',
      renderedPageKey: 'admin',
    });
  });

  it('classifies a silent fallback as CAPTURE_WRONG_ROUTE', () => {
    const result = validateRouteIdentity({
      ...expected,
      renderedPageKey: 'dailyOperationsHub',
      renderedPageLocation: 'daily-operations',
      renderedHeading: 'Daily Operations',
    });
    expect(result.status).toBe(CAPTURE_WRONG_ROUTE);
    expect(result.checks.renderedPageKeyMatches).toBe(false);
    expect(result.checks.renderedPageLocationMatches).toBe(false);
  });

  it('rejects a mislabeled URL even if the rendered marker is correct', () => {
    const result = validateRouteIdentity({
      ...expected,
      browserLocation: 'http://127.0.0.1:4173/?page=policies',
    });
    expect(result.status).toBe(CAPTURE_WRONG_ROUTE);
    expect(result.checks.urlLocationMatches).toBe(false);
  });

  it('requires a rendered page heading in addition to route markers', () => {
    const result = validateRouteIdentity({ ...expected, renderedHeading: ' ' });
    expect(result.status).toBe(CAPTURE_WRONG_ROUTE);
    expect(result.checks.pageHeadingPresent).toBe(false);
  });

  it('permits one recovery navigation and captures only after identity passes', async () => {
    const capture = vi.fn();
    const recover = vi.fn();
    const readIdentity = vi.fn()
      .mockResolvedValueOnce({
        ...expected,
        renderedPageKey: 'dailyOperationsHub',
        renderedPageLocation: 'daily-operations',
        renderedHeading: 'Daily Operations',
      })
      .mockResolvedValueOnce(expected);

    const result = await captureWithRouteIdentity({ readIdentity, capture, recover });
    expect(result.status).toBe(CAPTURED);
    expect(result.attempts).toHaveLength(2);
    expect(recover).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it('does not capture or retry again after the second mismatch', async () => {
    const capture = vi.fn();
    const recover = vi.fn();
    const readIdentity = vi.fn().mockResolvedValue({
      ...expected,
      renderedPageKey: 'dailyOperationsHub',
      renderedPageLocation: 'daily-operations',
      renderedHeading: 'Daily Operations',
    });

    const result = await captureWithRouteIdentity({ readIdentity, capture, recover });
    expect(result.status).toBe(CAPTURE_WRONG_ROUTE);
    expect(result.attempts).toHaveLength(2);
    expect(recover).toHaveBeenCalledTimes(1);
    expect(capture).not.toHaveBeenCalled();
  });
});
