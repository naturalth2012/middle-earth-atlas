import fs from 'node:fs'

// Inline avatar-tab.js into client.js: the browser module loader only provides
// `require('react')`, so a sibling ESM file cannot be imported at runtime.
const tabFile = 'avatar-tab.js'
let tab = fs.readFileSync(tabFile, 'utf8').replace(/\r\n/g, '\n')

// Convert the exported builder into an IIFE-assigned const inside the factory.
tab = tab.replace(/^export function buildAvatarTab\(\{ h, React, t, paths \}\) \{\n/m, '')
// The builder's body ends with the final closing brace of the function.
const lastBrace = tab.lastIndexOf('\n}\n')
if (lastBrace === -1) { console.error('could not find builder end'); process.exit(1) }
let body = tab.slice(0, lastBrace + 1)

// Drop the leading module comment block.
body = body.replace(/^\/\*\*[\s\S]*?\*\/\n/, '')

// The body references `t` (the module-level default) and defines Player etc.
const inlined = `
    /* ------------------------------------------------------------------ *
     * Avatar journey tab, inlined from avatar-tab.js.
     *
     * The browser loader only exposes require('react'), so this module cannot
     * be imported at runtime; keep the source of truth in avatar-tab.js and
     * regenerate this block with scripts/inline-avatar-tab.mjs.
     * ------------------------------------------------------------------ */
    const buildAvatarTab = ({ h, React, t, paths }) => {${body}
    }
`

const file = 'client.js'
let s = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const anchor = "    /* ------------------------------------------------------------------ *\n     * Copy\n"
if (!s.includes(anchor)) { console.error('anchor missing'); process.exit(1) }
if (s.includes('const buildAvatarTab =')) {
  console.error('already inlined')
  process.exit(1)
}
s = s.replace(anchor, inlined + '\n' + anchor)
fs.writeFileSync(file, s, 'utf8')
console.log('inlined buildAvatarTab')
