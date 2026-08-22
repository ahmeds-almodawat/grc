import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('canonical page route audit', () => {
  it('covers the current registry, runtime switch, navigation keys, and unique public locations', () => {
    const result = spawnSync(process.execPath, ['scripts/audit-routes.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    const audit = JSON.parse(result.stdout);
    expect(audit.routeCount).toBeGreaterThanOrEqual(70);
    expect(audit.switchCount).toBe(audit.routeCount);
    expect(audit.navCount).toBeGreaterThan(0);
    expect(audit.missingSwitch).toEqual([]);
    expect(audit.navWithoutRoute).toEqual([]);
    expect(audit.unusedSwitch).toEqual([]);
    expect(audit.duplicateLocations).toEqual([]);
    expect(audit.status).toBe('pass');
  });
});
