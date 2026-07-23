import { describe, expect, it } from 'vitest';
import {
  buildBaseline,
  buildCatalogFingerprint,
  countCreatedObjectIdentities,
  scanBaseline,
  splitSqlStatements,
} from '../../scripts/gate11-immutable-baseline.mjs';

const fixture = `
SET statement_timeout = 0;
CREATE SCHEMA IF NOT EXISTS "public";
ALTER SCHEMA "public" OWNER TO "pg_database_owner";
CREATE TYPE "public"."state" AS ENUM ('active', 'inactive');
ALTER TYPE "public"."state" OWNER TO "postgres";
CREATE TABLE "public"."records" ("id" uuid NOT NULL, "state" "public"."state" NOT NULL);
ALTER TABLE "public"."records" OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."safe_check"() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN EXISTS (SELECT 1 FROM "public"."records" WHERE "state" = 'active');
END;
$function$;
ALTER FUNCTION "public"."safe_check"() OWNER TO "postgres";
ALTER TABLE ONLY "public"."records" ADD CONSTRAINT "records_pkey" PRIMARY KEY ("id");
ALTER TABLE "public"."records" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "records_read" ON "public"."records" FOR SELECT TO "authenticated" USING ("public"."safe_check"());
REVOKE ALL ON FUNCTION "public"."safe_check"() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."safe_check"() TO "authenticated";
`;

describe('Gate 11 immutable baseline contract', () => {
  it('splits SQL without breaking function bodies', () => {
    const statements = splitSqlStatements(fixture);
    expect(statements.some((statement) => statement.includes('RETURN EXISTS'))).toBe(true);
    expect(statements.filter((statement) => statement.includes('safe_check')).length).toBeGreaterThanOrEqual(4);
  });

  it('removes session and owner noise from the stable catalog', () => {
    const fingerprint = buildCatalogFingerprint(fixture);
    expect(fingerprint.object_counts.type).toBe(1);
    expect(fingerprint.object_counts.table).toBe(1);
    expect(fingerprint.object_counts.function).toBe(1);
    expect(fingerprint.object_counts.policy).toBe(1);
    expect(fingerprint.canonical_statement_count).toBeGreaterThan(5);
  });

  it('counts replaced views once for baseline validation', () => {
    const duplicateView = `${fixture}\nCREATE OR REPLACE VIEW "public"."current_records" AS SELECT 1 AS value;\nCREATE OR REPLACE VIEW "public"."current_records" AS SELECT 2 AS value;`;
    expect(countCreatedObjectIdentities(duplicateView)).toEqual(expect.objectContaining({
      table: 1,
      view: 1,
      function: 1,
      policy: 1,
    }));
  });

  it('builds an immutable, empty-target-only baseline', () => {
    const fingerprint = buildCatalogFingerprint(fixture);
    const baseline = buildBaseline(fixture, {
      catalogSha256: fingerprint.canonical_sql_sha256,
      tableCount: 1,
      viewCount: 0,
      functionCount: 1,
      policyCount: 1,
    });
    expect(baseline).toContain('GATE11_BASELINE_ALREADY_PRESENT');
    expect(baseline).toContain('GATE11_SUPABASE_PLATFORM_SCHEMAS_REQUIRED');
    expect(baseline).toContain('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    expect(baseline).toContain('INSERT INTO "public"."patch83u_runtime_control"');
    expect(baseline).toContain("true, '174.2-auth-first', 'disabled'");
    expect(baseline).toContain("TIMESTAMPTZ '1970-01-01 00:00:00+00'");
    expect(baseline).not.toMatch(/OWNER TO/);
  });

  it('binds a versioned baseline to its migration ceiling and first shared forward migration', () => {
    const fingerprint = buildCatalogFingerprint(fixture);
    const baseline = buildBaseline(fixture, {
      catalogSha256: fingerprint.canonical_sql_sha256,
      baselineVersion: 2,
      migrationCeiling: 185,
      firstFutureMigration: 186,
      tableCount: 1,
      viewCount: 0,
      functionCount: 1,
      policyCount: 1,
    });
    expect(baseline).toContain('immutable application baseline v2 through migration 185');
    expect(baseline).toContain('First shared forward migration: 186.');
  });

  it('rejects sensitive and environment-bound values', () => {
    expect(scanBaseline('select 1')).toEqual(expect.objectContaining({ project_references: 0, jwt_values: 0 }));
    expect(scanBaseline('select \'zghsgzrdwbqdrpuxanac\'').project_references).toBe(1);
    expect(scanBaseline('select \'sb_secret_example\'').secret_keys).toBe(1);
    expect(scanBaseline("INSERT INTO auth.users(id) VALUES ('x')").auth_data_writes).toBe(1);
    expect(scanBaseline('INSERT INTO "public"."patch83u_runtime_control" ("singleton") VALUES (true)'))
      .toEqual(expect.objectContaining({ approved_structural_runtime_seeds: 1, unapproved_top_level_data_statements: 0 }));
  });
});
