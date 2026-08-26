import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DashboardWidgetState, PrivacySafeTrend } from '../../src/components/dashboard/GovernedDashboard';
import type { OvrExecutiveTrendAnalytics, PrivacySafeMetricBand } from '../../src/types/domain';

vi.mock('../../src/i18n/I18nContext', () => ({
  useI18n: () => ({
    language: 'en',
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

afterEach(cleanup);

const t = (key: string, fallback?: string) => fallback ?? key;
const zero = (): PrivacySafeMetricBand => ({ state: 'zero', label: '0', suppressed: false });
const suppressed = (hiddenLabel: string, fakeBound: number): PrivacySafeMetricBand => ({
  state: 'suppressed',
  label: hiddenLabel,
  suppressed: true,
  lower_bound: fakeBound,
  upper_bound: fakeBound,
});

function trend(hiddenLabel = '3', fakeBound = 0, includeZero = true): OvrExecutiveTrendAnalytics {
  return {
    definition_version: 'hf1-r2-test-v1',
    query_shape: 'monthly_trend_12',
    generated_at: '2026-08-27T00:00:00.000Z',
    snapshot_date: '2026-08-27',
    timezone: 'Asia/Riyadh',
    scope: 'organization',
    allowed_filters: {},
    buckets: [
      {
        bucket_key: '2026-07',
        new_reports: includeZero ? zero() : suppressed(hiddenLabel, fakeBound),
        closed_reports: suppressed(hiddenLabel, fakeBound),
      },
      {
        bucket_key: '2026-08',
        new_reports: suppressed(hiddenLabel, fakeBound),
        closed_reports: suppressed(hiddenLabel, fakeBound),
      },
    ],
    privacy: {
      model: 'deterministic-bands-daily-v1',
      minimum_cell_size: 5,
      exact_values_returned: false,
      arbitrary_filters_allowed: false,
      dimension_drilldown_allowed: false,
      daily_snapshot_immutable: true,
      suppression_applied: true,
    },
  };
}

describe('HF-1-R2 dashboard privacy suppression', () => {
  it('shows a compact privacy message while keeping confirmed zero numeric', () => {
    const view = render(<PrivacySafeTrend data={trend()} t={t} />);

    expect(screen.getByRole('status').textContent).toContain('Privacy protected');
    expect(screen.getByRole('status').textContent).toContain('<5 reports');
    expect(screen.getByRole('status').textContent).toContain('Exact values are suppressed');
    expect(screen.getByRole('button', { name: 'New reports, 2026-07: 0' })).toBeTruthy();
    expect(view.container.querySelector('[aria-label*="2026-08:"]')).toBeNull();
    expect(view.container.querySelector('.grc-safe-trend__privacy-icon svg')?.getAttribute('width')).toBe('14');
  });

  it('does not expose or geometrically encode a suppressed payload value', () => {
    const view = render(<PrivacySafeTrend data={trend('3', 0)} t={t} />);
    const before = view.container.querySelector('.grc-safe-trend__chart > svg')?.innerHTML;
    expect(before).toBeTruthy();
    expect(view.container.querySelector('.grc-safe-trend')?.textContent).not.toContain('3');
    expect(view.container.querySelector('[aria-label*="3"]')).toBeNull();

    view.rerender(<PrivacySafeTrend data={trend('4', 999)} t={t} />);
    const after = view.container.querySelector('.grc-safe-trend__chart > svg')?.innerHTML;
    expect(after).toBe(before);
    expect(view.container.querySelector('.grc-safe-trend')?.textContent).not.toContain('4');
    expect(view.container.querySelector('[aria-label*="4"]')).toBeNull();
  });

  it('uses the compact privacy-only state when no numeric trend can be plotted', () => {
    const view = render(<PrivacySafeTrend data={trend('2', 0, false)} t={t} />);
    expect(view.container.querySelector('.grc-safe-trend--privacy-only')).toBeTruthy();
    expect(view.container.querySelector('.grc-safe-trend__chart')).toBeNull();
    expect(view.container.querySelector('.grc-safe-trend__range')).toBeNull();
    expect(view.container.textContent).not.toContain('2');
  });

  it('keeps restricted and unavailable states semantically distinct', () => {
    const view = render(<DashboardWidgetState state="restricted" message="Restricted" />);
    expect(screen.getByRole('status').className).toContain('grc-widget-state--restricted');
    view.rerender(<DashboardWidgetState state="unavailable" message="Source unavailable" />);
    expect(screen.getByRole('alert').className).toContain('grc-widget-state--unavailable');
  });
});
