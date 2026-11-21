/**
 * Regenerate the avatar-tab block inside client.js from avatar-tab.js.
 *
 * The browser module loader only exposes `require('react')`, so a sibling ES
 * module cannot be imported at runtime. Rather than introduce a build step,
 * this script splices the tab source into client.js between two stable markers.
 *
 * The script is idempotent: it replaces an existing block, so re-running it is
 * safe and always converges on the current source. `scripts/selfcheck.mjs`
 * verifies the block is in sync, so a forgotten run fails the checks instead of
 * silently shipping stale UI.
 *
 * Usage:
 *   node scripts/inline-avatar-tab.mjs          # rewrite client.js
 *   node scripts/inline-avatar-tab.mjs --check  # verify only, exit 1 if stale
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')

const BEGIN = '    /* --- avatar-tab:begin (generated from avatar-tab.js — do not edit here) --- */'
const END = '    /* --- avatar-tab:end --- */'

/** The tab source with its `export function` header removed. */
function readTabBody() {
  const raw = fs.readFileSync(path.join(root, 'avatar-tab.js'), 'utf8').replace(/\r\n/g, '\n')
  const header = 'export function buildAvatarTab({ h, React, t, paths }) {'
  const at = raw.indexOf(header)
  if (at === -1) throw new Error('avatar-tab.js: builder header not found')

  // The file ends with the builder's closing brace as the last line.
  const lastBrace = raw.lastIndexOf('\n}')
  if (lastBrace === -1) throw new Error('avatar-tab.js: closing brace not found')

  let body = raw.slice(at + header.length, lastBrace)
  // Drop the module-level doc comment that precedes the header.
  return body.replace(/^\s*\n/, '')
}

function buildBlock() {
  const body = readTabBody()
  return [
    BEGIN,
    '    const buildAvatarTab = ({ h, React, t, paths }) => {',
    body.replace(/\n+$/, ''),
    '    }',
    END,
  ].join('\n')
}

function readClient() {
  return fs.readFileSync(path.join(root, 'client.js'), 'utf8').replace(/\r\n/g, '\n')
}

/** Locate the generated block, tolerating the pre-marker legacy form. */
function locate(client) {
  const begin = client.indexOf(BEGIN)
  if (begin !== -1) {
    const end = client.indexOf(END, begin)
    if (end === -1) throw new Error('client.js: begin marker without end marker')
    return { start: begin, stop: end + END.length }
  }
  // Legacy: the original inliner wrote a comment header instead of markers.
  const legacy = client.indexOf('const buildAvatarTab = ({ h, React, t, paths }) => {')
  if (legacy === -1) return null
  const legacyHeader = client.lastIndexOf('    /* ---', legacy)
  const start = legacyHeader === -1 ? legacy : legacyHeader
  const copyAnchor = client.indexOf('* Copy', legacy)
  if (copyAnchor === -1) throw new Error('client.js: could not delimit the legacy block')
  const blockStart = client.lastIndexOf('    /* ---', copyAnchor)
  if (blockStart === -1) throw new Error('client.js: could not find the Copy header')
  return { start, stop: blockStart }
}

const checkOnly = process.argv.includes('--check')
const client = readClient()
const span = locate(client)

if (!span) {
  console.error('client.js: no avatar-tab block found; run without --check to create it')
  process.exit(1)
}

// Replace the span exactly: no extra padding, so repeated runs converge.
const before = client.slice(0, span.start).replace(/\s+$/u, '')
const after = client.slice(span.stop).replace(/^\s*/u, '')
const next = before + '\n' + buildBlock() + '\n' + after
const inSync = next === client

if (checkOnly) {
  if (inSync) {
    console.log('avatar-tab block is in sync with avatar-tab.js')
    process.exit(0)
  }
  console.error('avatar-tab block is STALE — run: node scripts/inline-avatar-tab.mjs')
  process.exit(1)
}

if (inSync) {
  console.log('avatar-tab block already up to date')
} else {
  fs.writeFileSync(path.join(root, 'client.js'), next, 'utf8')
  console.log('avatar-tab block regenerated from avatar-tab.js')
}
