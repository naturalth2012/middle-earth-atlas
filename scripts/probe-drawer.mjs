/**
 * Development probe for the dossier renderer.
 *
 * `renderDossierBody` is a pure function, so this probe feeds it every dossier
 * shape from the real engine and renders the resulting element tree. It covers
 * the branches the Drawer shows after its fetch resolves.
 *
 * Run: node scripts/probe-drawer.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const engine = await import(new URL('../engine.js', import.meta.url).href)

const React = {
  createElement(type, props, ...children) {
    if (type === undefined || type === null) throw new Error('createElement received ' + type)
    return { type, props: props || {}, children: children.flat(Infinity).filter((c) => c != null && c !== false) }
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

let spec
globalThis.window = {
  __ModuleLoader__: { load(s) { spec = s } },
  addEventListener() {},
  removeEventListener() {},
}

let source = fs.readFileSync(path.join(root, 'client.js'), 'utf8').replace(/\r\n/g, '\n')
const anchor = '\n    return {\n      inject:'
if (!source.includes(anchor)) {
  console.error('probe anchor not found')
  process.exit(2)
}
source = source.replace(anchor, '\n    globalThis.__MEA_PROBE__ = { renderDossierBody, Drawer }\n' + anchor)
new Function('window', 'require', source)(globalThis.window, requireFn)

const mod = spec.factory(requireFn)
const ctx = {
  get(name) { return name === 'locale' ? null : undefined },
  effect(fn) { return fn() },
  slots: { inject(owner, cb) { cb() }, register() { return {} } },
}
mod.apply(ctx)

const { renderDossierBody } = globalThis.__MEA_PROBE__
const t = (key) => key
const data = engine.bundle()

const cases = [
  ['character', 'frodo'],
  ['character', 'galadriel'],
  ['character', 'sauron'],
  ['character', 'sam'],
  ['character', 'gimli'],
  ['place', 'mordor'],
  ['place', 'shire'],
  ['place', 'minas_tirith'],
  ['artifact', 'one_ring'],
  ['artifact', 'narsil'],
  ['artifact', 'three_rings'],
  ['glossary', 'maiar'],
  ['glossary', 'istari'],
  ['glossary', 'canon_layers'],
]

const loaders = {
  character: (id) => engine.characterDetail(id),
  place: (id) => engine.placeDetail(id),
  artifact: (id) => engine.artifactDetail(id),
  glossary: (id) => engine.glossaryDetail(id),
}

let rendered = 0
const errors = []

function render(node, trail) {
  if (node === null || node === undefined || typeof node === 'boolean') return
  if (typeof node === 'string' || typeof node === 'number') return
  if (Array.isArray(node)) { node.forEach((n, i) => render(n, trail + '[' + i + ']')); return }
  if (typeof node.type === 'function') {
    let out
    try { out = node.type(node.props) } catch (error) {
      errors.push(trail + ' :: ' + (node.type.name || '?') + ' :: ' + error.message)
      return
    }
    rendered++
    render(out, trail + '>' + (node.type.name || '?'))
    return
  }
  if (node.type === 'Fragment') { render(node.children, trail); return }
  if (typeof node.type === 'string') { render(node.children, trail + '>' + node.type); return }
}

for (const [kind, id] of cases) {
  const payload = loaders[kind](id)
  if (!payload || payload.error) { errors.push(kind + ':' + id + ' :: no payload'); continue }
  try {
    const tree = renderDossierBody({ kind, payload, data, t, onOpen() {} })
    render(tree, 'Dossier(' + kind + ':' + id + ')')
  } catch (error) {
    errors.push('Dossier(' + kind + ':' + id + ') :: ' + error.message)
  }
}

console.log('dossier cases rendered:', cases.length)
console.log('function components rendered:', rendered)
console.log('errors:', errors.length)
errors.forEach((e) => console.log('  ' + e))
process.exit(errors.length ? 1 : 0)
