import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  findDeploymentAutomation,
  validateVercelDeploymentControl,
  verifyRepository,
} from '../../scripts/verify-vercel-deployment-control.mjs'
import {
  proofCommandContracts,
  proofGroups,
} from '../../scripts/v700-proof-suite.mjs'

const validConfig = {
  $schema: 'https://openapi.vercel.sh/vercel.json',
  git: {
    deploymentEnabled: {
      main: false,
    },
  },
}

describe('Vercel deployment control', () => {
  it('accepts the exact fail-closed main policy', () => {
    expect(validateVercelDeploymentControl(validConfig)).toEqual([])
  })

  it.each([
    ['missing vercel.json', null],
    ['malformed vercel.json', '{ invalid json'],
  ])('fails closed for %s', async (_case, configText) => {
    const repository = mkdtempSync(join(tmpdir(), 'grc-vercel-policy-'))
    try {
      mkdirSync(join(repository, '.github', 'workflows'), { recursive: true })
      if (configText !== null) writeFileSync(join(repository, 'vercel.json'), configText)
      expect(await verifyRepository(repository)).not.toEqual([])
    } finally {
      rmSync(repository, { recursive: true, force: true })
    }
  })

  it.each([
    ['missing git', { $schema: validConfig.$schema }],
    ['missing deploymentEnabled', { ...validConfig, git: {} }],
    ['globally enabled Git deployments', { ...validConfig, git: { deploymentEnabled: true } }],
    ['main deployment enabled', { ...validConfig, git: { deploymentEnabled: { main: true } } }],
    ['main policy missing', { ...validConfig, git: { deploymentEnabled: { release: false } } }],
    ['wildcard ambiguity', { ...validConfig, git: { deploymentEnabled: { main: false, '*': true } } }],
    ['legacy GitHub configuration', { ...validConfig, github: { enabled: true } }],
    ['conflicting Git configuration', { ...validConfig, git: { ...validConfig.git, silent: true } }],
  ])('rejects %s', (_case, config) => {
    expect(validateVercelDeploymentControl(config)).not.toEqual([])
  })

  it('allows read-only Vercel inspection in workflows', () => {
    expect(
      findDeploymentAutomation(
        '.github/workflows/inspect.yml',
        'steps:\n  - run: npx --yes vercel logs --environment production --level error',
      ),
    ).toEqual([])
  })

  it.each([
    [
      'wrapped Production deploy with flags before command',
      'steps:\n  - run: npx --yes vercel --token "$TOKEN" deploy --prebuilt --prod',
      'Vercel CLI deployment or traffic mutation',
    ],
    [
      'multiline package-manager Production deploy',
      'steps:\n  - run: |\n      pnpm exec vercel \\\n        deploy \\\n        --prod',
      'Vercel CLI deployment or traffic mutation',
    ],
    [
      'Production promotion',
      'steps:\n  - run: npm exec -- vercel promote dpl_example',
      'Vercel CLI deployment or traffic mutation',
    ],
    [
      'rollback traffic movement',
      'steps:\n  - run: yarn exec vercel rollback dpl_example',
      'Vercel CLI deployment or traffic mutation',
    ],
    [
      'alias traffic movement',
      'steps:\n  - run: bunx vercel alias set dpl_example production.example.com',
      'Vercel CLI deployment or traffic mutation',
    ],
    [
      'Vercel deployment action',
      'steps:\n  - uses: amondnet/vercel-action@v25',
      'Vercel deployment GitHub Action',
    ],
    [
      'deploy hook',
      'steps:\n  - run: curl -X POST "$VERCEL_DEPLOY_HOOK"',
      'Vercel deploy hook',
    ],
    [
      'REST deployment creation with method after URL',
      'steps:\n  - run: curl https://api.vercel.com/v13/deployments -X POST',
      'Vercel REST deployment or traffic mutation',
    ],
    [
      'CLI API promotion with method before path',
      'steps:\n  - run: npx vercel api -X POST /v10/projects/grc/promote/dpl_example',
      'Vercel REST deployment or traffic mutation',
    ],
  ])('rejects %s', (_case, workflow, finding) => {
    expect(findDeploymentAutomation('.github/workflows/release.yml', workflow)).toContain(
      `.github/workflows/release.yml: ${finding}`,
    )
  })

  it('participates in the canonical hermetic proof:ci group', () => {
    expect(proofGroups.ci).toHaveLength(8)
    expect(proofGroups.ci).toContain('v700:vercel-deployment-policy')
    expect(proofCommandContracts['v700:vercel-deployment-policy']).toMatchObject({
      hermetic: true,
      classification: 'repository-static',
    })
  })
})
