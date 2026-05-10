import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const WORKSPACE_LAYERS = [
  { layer: 'core', name: '@txun/core' },
  { layer: 'browser', name: '@txun/browser' },
  { layer: 'calculator', name: '@txun/calculator' },
  { layer: 'calendar', name: '@txun/calendar' },
  { layer: 'clock', name: '@txun/clock' },
  { layer: 'file-manager', name: '@txun/file-manager' },
  { layer: 'image-viewer', name: '@txun/image-viewer' },
  { layer: 'settings', name: '@txun/settings' },
  { layer: 'sticky-notes', name: '@txun/sticky-notes' },
  { layer: 'task-manager', name: '@txun/task-manager' },
  { layer: 'terminal', name: '@txun/terminal' },
  { layer: 'text-editor', name: '@txun/text-editor' }
]

const dryRun = process.env.NPM_PUBLISH_DRY_RUN === 'true'
const skipPublished = process.env.NPM_SKIP_PUBLISHED !== 'false'

function readVersion(layer) {
  const packageJson = JSON.parse(readFileSync(`layers/${layer}/package.json`, 'utf8'))
  return String(packageJson.version)
}

function resolveDistTag() {
  const explicit = process.env.NPM_DIST_TAG?.trim()
  if (explicit) return explicit
  const coreVersion = readVersion('core')
  return coreVersion.includes('-') ? 'next' : 'latest'
}

function runNpm(args, stdio = 'inherit') {
  return spawnSync('npm', args, {
    stdio,
    env: process.env
  })
}

function isAlreadyPublished(packageName, version) {
  const result = runNpm(['view', `${packageName}@${version}`, 'version'], 'ignore')
  return result.status === 0
}

const distTag = resolveDistTag()
const failures = []

console.log(`Publish mode: ${dryRun ? 'dry-run' : 'publish'}`)
console.log(`Dist-tag: ${distTag}`)

for (const entry of WORKSPACE_LAYERS) {
  const version = readVersion(entry.layer)

  if (skipPublished && isAlreadyPublished(entry.name, version)) {
    console.log(`SKIP ${entry.name}@${version} (already published)`)
    continue
  }

  const args = ['publish', '--workspace', entry.name, '--tag', distTag, '--access', 'public']
  if (dryRun) args.push('--dry-run')

  console.log(`RUN npm ${args.join(' ')}`)
  const result = runNpm(args)

  if (result.status !== 0) {
    failures.push(`${entry.name}@${version}`)
  }
}

if (failures.length > 0) {
  console.error('Publish failed for:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('All packages processed successfully.')
