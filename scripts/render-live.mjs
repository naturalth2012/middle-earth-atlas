/**
 * End-to-end render probe: fetch real data from the running Host and render
 * the FULL component tree the way React would, invoking nested function
 * components. This is the closest reproduction of what the user sees.
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const port = process.argv[2] || '11548'
const root = new URL('../client.js', import.meta.url)

const React = {
  createElement(type, props, ...children) {
    if (type == null) throw new Error('undefined element type')
    return { type, props: props || {}, children: children.flat(Infinity).filter((c) => c != null && c !== false) }
  },
  Fragment: 'Fragment',
  useState(init) { return [typeof init === 'function' ? init() : init, () => {}] },
  useEffect(fn) { try { fn() } catch {} },
  useMemo(fn) { return fn() },
  useReducer(s) { return [s, () => {}] },
  useRef(v) { return { current: v } },
}

let spec
globalThis.window = {
  __ModuleLoader__: { load(s) { spec = s } },
  addEventListener() {},
  removeEventListener() {},
  localStorage: {
    getItem: () => null, setItem() {}, removeItem() {},
  },
}

const realFetch = globalThis.fetch
globalThis.fetch = async (u) => {
  const url = String(u).startsWith('http') ? String(u) : `http://127.0.0.1:${port}${u}`
  const res = await realFetch(url)
  return { ok: res.ok, status: res.status, json: async () => res.json() }
}

const requireFn = (n) => (n === 'react' ? React : (() => { throw new Error('require:' + n) })())
new Function('window', 'require', fs.readFileSync(root, 'utf8'))(globalThis.window, requireFn)

const mod = spec.factory(requireFn)
let Page
mod.apply({
  get: (n) => (n === 'locale' ? null : undefined),
  effect: (f) => f(),
  slots: {
    inject: (o, cb) => cb(),
    register: (d, comp) => { if (d.name === 'main') Page = comp; return d },
  },
})

const t = (key) => key

// Invocation 1: Page renders AtlasPage, whose useState(null) + useEffect fetch
// means the first paint is the loading branch. Our stub's useEffect runs the
// fetch, but state won't actually change (no setState), so we render both
// branches by calling AtlasPage with data=null and data=real separately.
async function main() {
  const bundleRes = await realFetch(`http://127.0.0.1:${port}/plugins/middle-earth-atlas/bundle?maxTier=3`)
  const DATA = await bundleRes.json()
  console.log('fetch bundle:', Object.keys(DATA).join(','))

  let child = Page({ t, onBack() {} })
  const errors = []
  let depth = 0

  function walk(node, trail, dataOverride) {
    if (node == null || typeof node !== 'object') return
    if (Array.isArray(node)) { node.forEach((n) => walk(n, trail, dataOverride)); return }
    let type = node.type
    let props = node.props || {}
    if (typeof type === 'function') {
      let out
      try {
        // Inject real data into AtlasPage so we render the loaded branch.
        if (type.name === 'AtlasPage' && dataOverride) {
          out = type({ ...props, __testData: DATA })
        } else {
          out = type(props)
        }
      } catch (e) {
        errors.push(trail + ' > ' + (type.name || 'Anon') + ' :: ' + e.message)
        return
      }
      if (depth < 60) {
        depth++
        walk(out, trail + '>' + (type.name || 'Anon'), dataOverride)
        depth--
      }
      return
    }
    walk(node.children, trail, dataOverride)
  }

  // Loading branch.
  walk(child, 'Page', false)
  console.log('loading branch errors:', errors.length)
  errors.forEach((e) => console.log('  ' + e))

  // Loaded branch: locate AtlasPage directly and call it with mocked data via
  // a fresh useState that returns DATA instead of null.
  const React2 = {
    ...React,
    useState(init) {
      const v = typeof init === 'function' ? init() : init
      // First useState in AtlasPage is `data`; serve real data.
      if (v === null) return [DATA, () => {}]
      return [v, () => {}]
    },
  }
  let spec2
  const window2 = {
    __ModuleLoader__: { load(s) { spec2 = s } },
    addEventListener() {}, removeEventListener() {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  }
  const req2 = (n) => (n === 'react' ? React2 : (() => { throw new Error(n) })())
  new Function('window', 'require', fs.readFileSync(root, 'utf8'))(window2, req2)
  const mod2 = spec2.factory(req2)
  let Page2
  mod2.apply({
    get: (n) => (n === 'locale' ? null : undefined),
    effect: (f) => f(),
    slots: { inject: (o, cb) => cb(), register: (d, c) => { if (d.name === 'main') Page2 = c; return d } },
  })
  const loadedErrors = []
  const child2 = Page2({ t, onBack() {} })
  const walk2 = (node, trail, d = 0) => {
    if (node == null || typeof node !== 'object') return
    if (Array.isArray(node)) { node.forEach((n) => walk2(n, trail, d)); return }
    if (typeof node.type === 'function') {
      let out
      try { out = node.type(node.props || {}) }
      catch (e) { loadedErrors.push(trail + ' > ' + (node.type.name || 'Anon') + ' :: ' + e.message); return }
      if (d < 60) walk2(out, trail + '>' + (node.type.name || 'Anon'), d + 1)
      return
    }
    walk2(node.children, trail, d)
  }
  walk2(child2, 'Page2')
  console.log('loaded branch errors:', loadedErrors.length)
  loadedErrors.slice(0, 12).forEach((e) => console.log('  ' + e))

  process.exit(errors.length + loadedErrors.length ? 1 : 0)
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(2) })
