/**
 * Strict rendering harness — reproduces the React hook rules that make a
 * component throw and leave a panel blank.
 *
 * The key difference from probe.mjs: hook counts are compared across renders.
 * React throws "Rendered more hooks than during the previous render" when the
 * count changes, and the slot boundary swallows it, producing a white panel.
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = new URL('../client.js', import.meta.url)
const engine = await import(new URL('../engine.js', import.meta.url).href)

function strictReact() {
  const counts = new Map()      // name -> array of hook kinds in current render
  const expected = new Map()    // name -> frozen array from first successful render
  let stack = []

  const push = (kind) => {
    if (!stack.length) throw new Error('hook outside component: ' + kind)
    const name = stack[stack.length - 1]
    if (!counts.has(name)) counts.set(name, [])
    counts.get(name).push(kind)
  }

  const api = {
    createElement(type, props, ...children) {
      if (type == null) throw new Error('createElement received ' + type)
      return {
        type,
        props: props || {},
        children: children.flat(Infinity).filter((c) => c != null && c !== false),
      }
    },
    Fragment: 'Fragment',

    useState(init) { push('useState'); return [typeof init === 'function' ? init() : init, () => {}] },
    useEffect(fn) { push('useEffect'); return undefined },
    useMemo(fn) { push('useMemo'); return fn() },
    useReducer(s) { push('useReducer'); return [s, () => {}] },
    useRef(v) { push('useRef'); return { current: v } },

    enter(name) { stack.push(name); counts.set(name, []) },
    leave(name) {
      stack.pop()
      expected.set(name, [...(counts.get(name) || [])])
    },
    check(name) {
      const now = counts.get(name) || []
      const exp = expected.get(name)
      if (exp && exp.length !== now.length) {
        throw new Error(
          `Rendered ${now.length} hooks, expected ${exp.length} in ${name}. `
          + `now=[${now}] expected=[${exp}]`,
        )
      }
    },
    expectedOf: (name) => expected.get(name) || [],
  }
  return api
}

const R = strictReact()

let spec
globalThis.window = {
  __ModuleLoader__: { load(s) { spec = s } },
  addEventListener() {},
  removeEventListener() {},
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
}
const DATA = engine.bundle({ maxTier: 3 })
globalThis.fetch = async () => ({ ok: true, json: async () => DATA })

const requireFn = (n) => (n === 'react' ? R : (() => { throw new Error('require:' + n) })())
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

function simulate(label, dataReady) {
  // Page calls useLocaleVersion (useReducer + useEffect), then renders AtlasPage.
  R.enter('Page')
  try {
    R.useReducer(0)
    R.useEffect(() => {})
    R.check('Page')
    R.leave('Page')

    // AtlasPage's own hook prefix. This mirrors the real source order.
    R.enter('AtlasPage')
    R.useState(null)              // data
    R.useState(false)             // error
    R.useState('overview')        // tab
    R.useState(null)              // drawer
    R.useState(() => 3)           // spoilerTier
    R.useEffect(() => {})         // load
    R.useMemo(() => ({}), [])     // avatarStorage
    R.useMemo(() => (() => null), [])
    R.check('AtlasPage')
    R.leave('AtlasPage')

    // A real component would return here (loading or loaded). The important
    // signal is that all eight hooks ran on BOTH passes.
    console.log(`${label}: AtlasPage hooks=${R.expectedOf('AtlasPage').length} OK (dataReady=${dataReady})`)
    return true
  } catch (e) {
    console.error(`${label}: CRASH -> ${e.message}`)
    return false
  }
}

// The actual source is what matters: extract AtlasPage's hook prefix order.
const src = fs.readFileSync(root, 'utf8').replace(/\r\n/g, '\n')
const at = src.indexOf('const AtlasPage = ')
const body = src.slice(at, at + 6000)
const hookOrder = [...body.matchAll(/React\.use(State|Effect|Memo|Reducer|Ref)/g)].map((m) => m[1])
console.log('Actual AtlasPage hook order in source:', hookOrder.join(' -> '))

const guardAt = body.search(/if \((error|!data)\)/)
const lateHooks = hookOrder.filter((_, i) => {
  // crude index check against the first guard
  const matches = [...body.matchAll(/React\.use(State|Effect|Memo|Reducer|Ref)/g)]
  return matches[i].index > guardAt
})
console.log('Hooks after first guard:', lateHooks.length)

process.exit(lateHooks.length ? 1 : 0)
