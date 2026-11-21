/**
 * Development render probe — not shipped with the plugin.
 *
 * Loads `client.js` outside the browser, replaces its module loader with a
 * stub, injects a probe that exposes the internal tab components, and renders
 * every tab against the real engine bundle. This catches element-tree runtime
 * errors without a browser.
 *
 * Run: node scripts/probe.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')

const engine = await import(new URL('../engine.js', import.meta.url).href)
const DATA = engine.bundle()

/* --- A tiny React stand-in ------------------------------------------------ */
const React = {
  createElement(type, props, ...children) {
    if (type === undefined || type === null) throw new Error('createElement received ' + type)
    const kids = children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false && c !== true)
    return { type, props: props || {}, children: kids }
  },
  Fragment: 'Fragment',
  useState(init) { return [typeof init === 'function' ? init() : init, () => {}] },
  useEffect() {},
  useMemo(fn) { return fn() },
  useReducer(state) { return [state, () => {}] },
  useRef(value) { return { current: value } },
}

const requireFn = (name) => {
  if (name === 'react') return React
  throw new Error('unexpected require: ' + name)
}

/* --- Stub the browser surface -------------------------------------------- */
let spec
globalThis.window = {
  __ModuleLoader__: { load(s) { spec = s } },
  addEventListener() {},
  removeEventListener() {},
}

globalThis.fetch = async (input) => {
  const url = new URL(String(input), 'http://local')
  const p = url.pathname
  const q = Object.fromEntries(url.searchParams)
  let body = {}
  if (p.endsWith('/bundle')) body = DATA
  else if (p.endsWith('/detail')) body = engine.characterDetail(q.id) || { error: 'missing' }
  else if (p.endsWith('/place')) body = engine.placeDetail(q.id) || { error: 'missing' }
  else if (p.endsWith('/artifact')) body = engine.artifactDetail(q.id) || { error: 'missing' }
  else if (p.endsWith('/glossary')) body = engine.glossaryDetail(q.id) || { error: 'missing' }
  else if (p.endsWith('/graph')) body = engine.buildGraph({})
  else if (p.endsWith('/path')) body = engine.relationPath(q.from, q.to)
  else if (p.endsWith('/search-all')) body = engine.searchAll(q.q || '')
  else if (p.endsWith('/ask')) body = { answer: 'probe', suggestions: engine.suggestions() }
  return { ok: true, json: async () => body }
}

/* --- Load the client with a probe appended ------------------------------- */
let source = fs.readFileSync(path.join(root, 'client.js'), 'utf8').replace(/\r\n/g, '\n')
const probe = '\n    globalThis.__MEA_PROBE__ = { OverviewTab, CharactersTab, GraphTab, TimelineTab, PlacesTab, LoreTab, PlotTab, PathsTab, DiffTab, AskTab, Drawer, AtlasPage }\n'
const anchor = '\n    return {\n      inject: [\'slots\'],'
if (!source.includes(anchor)) {
  console.error('probe anchor not found — client.js structure changed')
  process.exit(2)
}
source = source.replace(anchor, probe + anchor)
new Function('window', 'require', source)(globalThis.window, requireFn)

const mod = spec.factory(requireFn)
const T = globalThis.__MEA_PROBE__

/* --- Translator from the module's own ZH strings ------------------------- */
const zhBlock = source.match(/const ZH = \{([\s\S]*?)\n    \}\n\n    const EN/)
const ZH = {}
if (zhBlock) {
  for (const m of zhBlock[1].matchAll(/([A-Za-z][A-Za-z0-9]*):\s*'((?:[^'\\]|\\.)*)'/g)) ZH[m[1]] = m[2]
}
const t = (key, vars) => {
  let s = Object.prototype.hasOwnProperty.call(ZH, key) ? ZH[key] : key
  if (vars) for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(String(vars[k]))
  return s
}

/* --- Recursive render ---------------------------------------------------- */
let rendered = 0
const errors = []
const seen = new Set()

function render(node, trail) {
  if (node === null || node === undefined || typeof node === 'boolean') return
  if (typeof node === 'string' || typeof node === 'number') return
  if (Array.isArray(node)) { node.forEach((n, i) => render(n, trail + '[' + i + ']')); return }
  if (typeof node.type === 'function') {
    const name = node.type.name || 'Anonymous'
    let out
    try {
      out = node.type(node.props)
    } catch (error) {
      errors.push(trail + ' > ' + name + ' :: ' + error.message)
      return
    }
    rendered++
    seen.add(name)
    // Guard against accidental infinite recursion.
    if (trail.length > 4000) return
    render(out, trail + ' > ' + name)
    return
  }
  if (node.type === 'Fragment') { render(node.children, trail); return }
  if (typeof node.type === 'string') { render(node.children, trail + ' > ' + node.type); return }
  errors.push(trail + ' :: unknown element type ' + String(node.type))
}

const tabs = ['OverviewTab', 'CharactersTab', 'GraphTab', 'TimelineTab', 'PlacesTab', 'LoreTab', 'PlotTab', 'PathsTab', 'DiffTab', 'AskTab']
for (const name of tabs) {
  const Comp = T[name]
  if (!Comp) { errors.push('missing component: ' + name); continue }
  render(React.createElement(Comp, { data: DATA, t, go() {}, open() {}, onBack() {} }), name)
}

// The page shell itself, in both its empty and data branches.
render(React.createElement(T.AtlasPage, { t, onBack() {} }), 'AtlasPage')

// Drawers for each dossier kind.
const dossierCases = [
  ['character', 'frodo'], ['character', 'galadriel'], ['character', 'sauron'],
  ['place', 'mordor'], ['artifact', 'one_ring'], ['glossary', 'maiar'],
]
for (const [kind, id] of dossierCases) {
  try {
    render(T.Drawer({ kind, id, data: DATA, t, onClose() {}, onOpen() {} }), 'Drawer(' + kind + ':' + id + ')')
  } catch (error) {
    errors.push('Drawer(' + kind + ':' + id + ') :: ' + error.message)
  }
}

console.log('function components rendered:', rendered)
console.log('distinct components:', [...seen].sort().join(', '))
console.log('errors:', errors.length)
errors.slice(0, 20).forEach((e) => console.log('  ' + e))
process.exit(errors.length ? 1 : 0)
