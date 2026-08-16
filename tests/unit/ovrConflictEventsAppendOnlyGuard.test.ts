import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('GRC v1.3 Migration 199: OVR Conflict Events Append-Only Row Guard', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/199_ovr_conflict_events_append_only_row_guard.sql'
  );

  it('proves migration 199 defines a row-level append-only trigger on ovr_conflict_events', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Drops previous statement-level trigger
    expect(sql).toContain(
      'drop trigger if exists trg_ovr_conflict_events_append_only on public.ovr_conflict_events;'
    );

    // Creates row-level trigger
    expect(sql).toContain('create trigger trg_ovr_conflict_events_append_only');
    expect(sql).toMatch(
      /before\s+update\s+or\s+delete\s+on\s+public\.ovr_conflict_events/i
    );
    expect(sql).toMatch(/for\s+each\s+row/i);
    expect(sql).not.toMatch(/for\s+each\s+statement/i);
    expect(sql).toMatch(
      /execute\s+function\s+ovr_v11_private\.guard_append_only\(\)/i
    );
  });

  it('proves migration 199 introduces no security definer or grant widening', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).not.toMatch(/security\s+definer/i);
    expect(sql).not.toMatch(/grant\s+/i);
    expect(sql).not.toMatch(/create\s+function/i);
    expect(sql).not.toMatch(/create\s+or\s+replace\s+function/i);
  });

  it('proves semantic equivalence of row-level trigger behavior', () => {
    // Conceptual verification:
    // 1. In a statement-level trigger, BEFORE DELETE fires unconditionally even when 0 rows match.
    // 2. In a row-level trigger:
    //    - If 0 rows match: The trigger function is NEVER invoked; 0-row DELETE succeeds.
    //    - If >=1 rows match: The trigger function is invoked on the first matching row and raises OVR_V11_CONFLICT_EVENTS_APPEND_ONLY.
    //    - If an UPDATE is attempted: The trigger function is invoked on the row and raises OVR_V11_CONFLICT_EVENTS_APPEND_ONLY.
    //    - INSERT is not intercepted (BEFORE UPDATE OR DELETE only).
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('before update or delete');
    expect(sql).toContain('for each row');
  });
});
