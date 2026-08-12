import { readFile, readdir } from 'node:fs/promises'
import { dirname, extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REQUIRED_SCHEMA = 'https://openapi.vercel.sh/vercel.json'

const VERCEL_INVOCATION =
  /(?:^|[\s;&|()])(?:(?:npx(?:\s+--yes)?|npm\s+exec(?:\s+--)|pnpm\s+(?:exec|dlx)|yarn\s+(?:exec|dlx)|bunx)\s+)?vercel(?:@[\w.-]+)?\b/gi

const CLI_TRAFFIC_MUTATION =
  /(?:^|\s)(?:deploy\b|promote\b|rollback\b|redeploy\b|alias\s+(?:set|rm|remove)\b|--prod\b)/i

const VERCEL_API = /(?:api\.vercel\.com|\bvercel(?:@[\w.-]+)?\s+api\b)/i
const VERCEL_MUTATION_ENDPOINT =
  /(?:\/deployments?\b|\/promote(?:\/|\b)|\/rollback(?:\/|\b)|\/aliases?\b)/i
const MUTATING_HTTP_METHOD =
  /(?:\bmethod\s*[:=]\s*['"]?(?:POST|PUT|PATCH|DELETE)\b|(?:-X|--request|--method)\s*(?:POST|PUT|PATCH|DELETE)\b)/i

function normalizedExecutableText(text) {
  return text
    .replace(/\\\r?\n\s*/g, ' ')
    .replace(/`\r?\n\s*/g, ' ')
    .replace(/\^\r?\n\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function executableWorkflowFragments(workflowText) {
  const lines = workflowText.split(/\r?\n/)
  const fragments = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const uses = line.match(/^\s*(?:-\s*)?uses:\s*(.+?)\s*$/)
    if (uses) {
      fragments.push(uses[1])
      continue
    }

    const run = line.match(/^(\s*)(?:-\s*)?run:\s*(.*)$/)
    if (!run) continue

    const indentation = run[1].length
    const scalar = run[2].trim()
    if (scalar && !/^[|>][-+]?\s*$/.test(scalar)) {
      fragments.push(scalar)
      continue
    }

    const block = []
    while (index + 1 < lines.length) {
      const candidate = lines[index + 1]
      if (candidate.trim() && candidate.match(/^\s*/)[0].length <= indentation) break
      block.push(candidate)
      index += 1
    }
    fragments.push(block.join('\n'))
  }

  return fragments
}

export function validateVercelDeploymentControl(config) {
  const errors = []

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return ['vercel.json must contain a JSON object']
  }

  if (config.$schema !== REQUIRED_SCHEMA) {
    errors.push(`vercel.json must use ${REQUIRED_SCHEMA}`)
  }

  const topLevelKeys = Object.keys(config).sort()
  if (topLevelKeys.join(',') !== '$schema,git') {
    errors.push('vercel.json may contain only $schema and git')
  }

  if (!config.git || typeof config.git !== 'object' || Array.isArray(config.git)) {
    errors.push('vercel.json must contain a git object')
    return errors
  }

  const gitKeys = Object.keys(config.git).sort()
  if (gitKeys.join(',') !== 'deploymentEnabled') {
    errors.push('git may contain only deploymentEnabled; legacy or conflicting Git controls are prohibited')
  }

  const deploymentEnabled = config.git.deploymentEnabled
  if (
    !deploymentEnabled ||
    typeof deploymentEnabled !== 'object' ||
    Array.isArray(deploymentEnabled)
  ) {
    errors.push('git.deploymentEnabled must be a branch policy object')
    return errors
  }

  const branches = Object.keys(deploymentEnabled).sort()
  if (branches.length !== 1 || branches[0] !== 'main') {
    errors.push('git.deploymentEnabled must contain only the protected main branch')
  }

  if (deploymentEnabled.main !== false) {
    errors.push('git.deploymentEnabled.main must be false')
  }

  return errors
}

export function findDeploymentAutomation(workflowPath, workflowText) {
  const findings = []

  for (const fragment of executableWorkflowFragments(workflowText)) {
    const executable = normalizedExecutableText(fragment)
    if (!executable) continue

    if (/^[^\s#]*vercel[^\s#]*action@/i.test(executable)) {
      findings.push(`${workflowPath}: Vercel deployment GitHub Action`)
    }

    if (/(?:deploy[-_ ]?hooks?|vercel\s+deploy-hooks)/i.test(executable)) {
      findings.push(`${workflowPath}: Vercel deploy hook`)
    }

    if (
      VERCEL_API.test(executable) &&
      VERCEL_MUTATION_ENDPOINT.test(executable) &&
      MUTATING_HTTP_METHOD.test(executable)
    ) {
      findings.push(`${workflowPath}: Vercel REST deployment or traffic mutation`)
    }

    VERCEL_INVOCATION.lastIndex = 0
    for (const invocation of executable.matchAll(VERCEL_INVOCATION)) {
      const suffix = executable.slice((invocation.index ?? 0) + invocation[0].length)
      const command = suffix.split(/(?:&&|\|\||;)/, 1)[0]
      if (CLI_TRAFFIC_MUTATION.test(command)) {
        findings.push(`${workflowPath}: Vercel CLI deployment or traffic mutation`)
        break
      }
    }
  }

  return [...new Set(findings)]
}

async function listWorkflowFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const entryPath = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listWorkflowFiles(entryPath)))
    } else if (['.yml', '.yaml'].includes(extname(entry.name).toLowerCase())) {
      files.push(entryPath)
    }
  }

  return files.sort()
}

export async function verifyRepository(rootDirectory) {
  const errors = []
  const configPath = resolve(rootDirectory, 'vercel.json')
  let config

  try {
    config = JSON.parse(await readFile(configPath, 'utf8'))
  } catch (error) {
    errors.push(`vercel.json could not be parsed: ${error.message}`)
    return errors
  }

  errors.push(...validateVercelDeploymentControl(config))

  const workflowDirectory = resolve(rootDirectory, '.github', 'workflows')
  let workflowFiles
  try {
    workflowFiles = await listWorkflowFiles(workflowDirectory)
  } catch (error) {
    errors.push(`GitHub workflows could not be inspected: ${error.message}`)
    return errors
  }

  for (const workflowPath of workflowFiles) {
    const workflowText = await readFile(workflowPath, 'utf8')
    const relativePath = relative(rootDirectory, workflowPath).replaceAll('\\', '/')
    errors.push(...findDeploymentAutomation(relativePath, workflowText))
  }

  return errors
}

async function main() {
  const scriptDirectory = dirname(fileURLToPath(import.meta.url))
  const rootDirectory = resolve(scriptDirectory, '..')
  const errors = await verifyRepository(rootDirectory)

  if (errors.length > 0) {
    console.error('VERCEL_DEPLOYMENT_CONTROL_FAILED')
    for (const error of errors) console.error(`- ${error}`)
    process.exitCode = 1
    return
  }

  console.log('VERCEL_DEPLOYMENT_CONTROL_PASSED')
  console.log('- main Git deployment: disabled')
  console.log('- unspecified branch Git deployments: eligible for Preview')
  console.log('- deployment-capable GitHub workflow automation: absent')
  console.log('- Production traffic movement: explicit promotion required')
}

const isDirectRun =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) await main()
