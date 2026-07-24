import { describe, expect, it } from 'vitest';
import {
  buildCanonicalCatalogFingerprint,
  compareCanonicalFingerprints,
} from '../../scripts/gate13sr-canonical-catalog-fingerprint.mjs';

const fingerprint = (...statements: string[]) => buildCanonicalCatalogFingerprint(statements.join('\n'));

describe('Gate 13S-R canonical catalog fingerprint', () => {
  it('ignores ordering and harmless outer whitespace', () => {
    const left = fingerprint('CREATE TABLE "public"."a" ("id" integer);', 'ALTER TABLE "public"."a" ENABLE ROW LEVEL SECURITY;');
    const right = fingerprint('  ALTER   TABLE "public"."a" ENABLE ROW LEVEL SECURITY ;', '\nCREATE TABLE "public"."a" ("id" integer);');
    expect(compareCanonicalFingerprints(left, right).exact_match).toBe(true);
  });

  it('treats CREATE versus CREATE OR REPLACE dump formatting equally', () => {
    const left = fingerprint('CREATE FUNCTION "public"."f"() RETURNS integer LANGUAGE sql AS $$ select 1 $$;');
    const right = fingerprint('CREATE OR REPLACE FUNCTION "public"."f"() RETURNS integer LANGUAGE sql AS $$ select 1 $$;');
    expect(compareCanonicalFingerprints(left, right).exact_match).toBe(true);
  });

  it.each([
    ['policy role', 'CREATE POLICY "p" ON "public"."t" TO "authenticated" USING (true);', 'CREATE POLICY "p" ON "public"."t" TO "anon" USING (true);'],
    ['policy command', 'CREATE POLICY "p" ON "public"."t" FOR SELECT TO "authenticated" USING (true);', 'CREATE POLICY "p" ON "public"."t" FOR UPDATE TO "authenticated" USING (true);'],
    ['policy using', 'CREATE POLICY "p" ON "public"."t" TO "authenticated" USING ("owner_id" = auth.uid());', 'CREATE POLICY "p" ON "public"."t" TO "authenticated" USING (true);'],
    ['policy with check', 'CREATE POLICY "p" ON "public"."t" FOR INSERT TO "authenticated" WITH CHECK ("owner_id" = auth.uid());', 'CREATE POLICY "p" ON "public"."t" FOR INSERT TO "authenticated" WITH CHECK (true);'],
    ['RLS', 'ALTER TABLE "public"."t" ENABLE ROW LEVEL SECURITY;', 'ALTER TABLE "public"."t" DISABLE ROW LEVEL SECURITY;'],
    ['FORCE RLS', 'ALTER TABLE "public"."t" FORCE ROW LEVEL SECURITY;', 'ALTER TABLE "public"."t" NO FORCE ROW LEVEL SECURITY;'],
    ['function definition', 'CREATE FUNCTION "public"."f"() RETURNS integer LANGUAGE sql AS $$ select 1 $$;', 'CREATE FUNCTION "public"."f"() RETURNS integer LANGUAGE sql AS $$ select 2 $$;'],
    ['function signature', 'CREATE FUNCTION "public"."f"(integer) RETURNS integer LANGUAGE sql AS $$ select $1 $$;', 'CREATE FUNCTION "public"."f"(text) RETURNS integer LANGUAGE sql AS $$ select 1 $$;'],
    ['search path', 'CREATE FUNCTION "public"."f"() RETURNS integer LANGUAGE sql SET search_path TO pg_catalog, public AS $$ select 1 $$;', 'CREATE FUNCTION "public"."f"() RETURNS integer LANGUAGE sql SET search_path TO public AS $$ select 1 $$;'],
    ['security definer', 'CREATE FUNCTION "public"."f"() RETURNS integer LANGUAGE sql SECURITY DEFINER AS $$ select 1 $$;', 'CREATE FUNCTION "public"."f"() RETURNS integer LANGUAGE sql SECURITY INVOKER AS $$ select 1 $$;'],
    ['grant', 'GRANT SELECT ON TABLE "public"."t" TO "authenticated";', 'GRANT UPDATE ON TABLE "public"."t" TO "authenticated";'],
    ['index expression', 'CREATE UNIQUE INDEX "i" ON "public"."t" ((lower("code")));', 'CREATE UNIQUE INDEX "i" ON "public"."t" ((upper("code")));'],
    ['index predicate', 'CREATE INDEX "i" ON "public"."t" ("id") WHERE ("active" = true);', 'CREATE INDEX "i" ON "public"."t" ("id") WHERE ("active" = false);'],
    ['lineage marker', 'COMMENT ON TABLE "public"."patch83b_release_migration_events" IS \'modern\';', 'COMMENT ON TABLE "public"."patch83b_release_migration_events" IS \'bridge\';'],
  ])('changes the hash for %s drift', (_name, leftSql, rightSql) => {
    expect(compareCanonicalFingerprints(fingerprint(leftSql), fingerprint(rightSql)).exact_match).toBe(false);
  });

  it('uses stable role names and contains no OID field', () => {
    const result = fingerprint('GRANT SELECT ON TABLE "public"."t" TO "authenticated";');
    expect(result.records[0].identity).toContain('authenticated');
    expect(JSON.stringify(result)).not.toMatch(/\"oid\"/i);
  });

  it('ignores diagnostic OID comments when stable role names match', () => {
    const left = fingerprint('-- diagnostic owner oid=16384\nGRANT SELECT ON TABLE "public"."t" TO "authenticated";');
    const right = fingerprint('-- diagnostic owner oid=24576\nGRANT SELECT ON TABLE "public"."t" TO "authenticated";');
    expect(compareCanonicalFingerprints(left, right).exact_match).toBe(true);
  });

  it('binds column definitions and defaults independently', () => {
    const left = fingerprint('CREATE TABLE "public"."t" ("id" integer NOT NULL, "state" text DEFAULT \'active\'::text);');
    const right = fingerprint('CREATE TABLE "public"."t" ("id" bigint NOT NULL, "state" text DEFAULT \'pending\'::text);');
    const comparison = compareCanonicalFingerprints(left, right);
    expect(comparison.exact_match).toBe(false);
    expect(comparison.differences.some((difference) => difference.category === 'column')).toBe(true);
    expect(comparison.differences.some((difference) => difference.category === 'column_default')).toBe(true);
  });

  it('fails closed when stable identities collide', () => {
    expect(() => fingerprint(
      'GRANT SELECT ON TABLE "public"."t" TO "authenticated";',
      'GRANT UPDATE ON TABLE "public"."t" TO "authenticated";',
    )).toThrow(/GATE13SR_DUPLICATE_STABLE_IDENTITY/);
  });

  it('fails closed on unresolved numeric role or owner identifiers', () => {
    expect(() => fingerprint('GRANT SELECT ON TABLE "public"."t" TO "16444";'))
      .toThrow(/GATE13SR_UNRESOLVED_ROLE_IDENTIFIER/);
    expect(() => fingerprint('ALTER TABLE "public"."t" OWNER TO "16444";'))
      .toThrow(/GATE13SR_UNRESOLVED_ROLE_IDENTIFIER/);
  });
});
