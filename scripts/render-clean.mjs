import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const port = process.argv[2] || '11548'
const root = new URL('../client.js', import.meta.url)

const React = {
  createElement(type, props, ...children) {
    if (type == null) throw new Error('undefined type')
    return { type, props: props || {}, children: children.flat(Infinity).filter((c) => c != null && c !== false) }
  },
  Fragment: 'Fragment',
  useState(init) { return [typeof init === 'function' ? init() : init, () => {}] },
  useEffect() {},   // do not run: we control the render pass manually
  useMemo(fn) { return fn() },
  useReducer(s) { return [s, () => {}] },
  useRef(v) { return { current: v } },
}

let spec
globalThis.window = {
  __ModuleLoader__: { load(s) { spec = s } },
  addEventListener() {}, removeEventListener() {},
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
}
globalThis.fetch = async () => ({ ok: true, json: async () => ({}) })

const req = (n) => (n === 'react' ? React : (() => { throw new Error(n) })())
new Function('window', 'require', fs.readFileSync(root, 'utf8'))(globalThis.window, req)
const mod = spec.factory(req)

let Page
mod.apply({
  get: (n) => (n === 'locale' ? null : undefined),
  effect: (f) => f(),
  slots: { inject: (o, cb) => cb(), register: (d, c) => { if (d.name === 'main') Page = c; return d } },
})

function walk(node, trail = 'Page', d = 0) {
  if (node == null || typeof node !== 'object') return
  if (Array.isArray(node)) { node.forEach((n) => walk(n, trail, d)); return }
  if (typeof node.type === 'function') {
    let out
    try { out = node.type(node.props || {}) }
    catch (e) { console.log('CRASH ' + trail + ' > ' + (node.type.name || '?') + ' :: ' + e.message); return }
    if (d < 40) walk(out, trail + '>' + (node.type.name || '?'), d + 1)
    return
  }
  walk(node.children, trail, d)
}

// Render 1: loading branch, nothing injected.
const t1 = Page({ t: (k) => k, onBack() {} })
walk(t1)
console.log('loading branch walked')

// Render 2: AtlasPage with data loaded, drawer state null. We reach it by
// invoking the nested AtlasPage directly with data already provided.
let AtlasPage
const t2 = Page({ t: (k) => k, onBack() {} })
AtlasPage = t2.type
if (typeof AtlasPage !== 'function') {
  // Page returns AtlasPage element; extract from its children chain.
  const find = (n) => {
    if (n && typeof n === 'object') {
      if (typeof n.type === 'function' && n.type.name === 'AtlasPage') return n.type
      for (const c of n.children || []) { const r = find(c); if (r) return r }
    }
    return null
  }
  AtlasPage = find(t2)
}
console.log('AtlasPage found:', typeof AtlasPage === 'function')

if (AtlasPage) {
  // Real data from host, maxTier=3 (default) so nothing is masked.
  const realFetch = globalThis.fetch
  const r = await realFetch(`http://127.0.0.1:${port}/plugins/middle-earth-atlas/bundle?maxTier=3`)
  const DATA = await r.json()

  // Override ONLY the first useState (data) while leaving drawer=null.
  let first = true
  const React3 = {
    ...React,
    useState(init) {
      const v = typeof init === 'function' ? init() : init
      if (first) { first = false; return [DATA, () => {}] }
      return [v, () => {}]
    },
  }
  // Rebuild with React3 just for AtlasPage invocation.
  const src = fs.readFileSync(root, 'utf8')
  let spec3
  const w3 = { __ModuleLoader__: { load(s) { spec3 = s } }, addEventListener() {}, removeEventListener() {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} } }
  const req3 = (n) => (n === 'react' ? React3 : (() => { throw new Error(n) })())
  new Function('window', 'require', src)(w3, req3)
  const mod3 = spec3.factory(req3)
  let P3
  mod3.apply({ get: (n) => (n === 'locale' ? null : undefined), effect: (f) => f(),
    slots: { inject: (o, cb) => cb(), register: (d, c) => { if (d.name === 'main') P3 = c; return d } } })
  const el = P3({ t: (k) => k, onBack() {} })
  const walk3 = (node, trail = 'Page3', d = 0) => {
    if (node == null || typeof node !== 'object') return
    if (Array.isArray(node)) { node.forEach((n) => walk3(n, trail, d)); return }
    if (typeof node.type === 'function') {
      let out
      try { out = node.type(node.props || {}) }
      catch (e) { console.log('CRASH ' + trail + ' > ' + (node.type.name || '?') + ' :: ' + e.message); return }
      if (d < 40) walk3(out, trail + '>' + (node.type.name || '?'), d + 1)
      return
    }
    walk3(node.children, trail, d)
  }
  walk3(el)
  console.log('loaded branch walked')
}
