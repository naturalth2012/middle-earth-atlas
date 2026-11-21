/**
 * Development probe for the avatar storage adapter.
 *
 * Runs the real `buildAvatarStorage()` from client.js against a simulated
 * localStorage, so the persistence path is exercised end to end (round trip,
 * tampering, clearing) rather than only through the pure storage.js module.
 *
 * Run: node scripts/probe-storage.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const engine = await import(new URL('../engine.js', import.meta.url).href)

const React = {
  createElement(type, props, ...children) {
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

const backing = new Map()
let storageBroken = false

let spec
globalThis.window = {
  __ModuleLoader__: { load(s) { spec = s } },
  addEventListener() {},
  removeEventListener() {},
  localStorage: {
    getItem(k) { if (storageBroken) throw new Error('denied'); return backing.has(k) ? backing.get(k) : null },
    setItem(k, v) { if (storageBroken) throw new Error('quota'); backing.set(k, String(v)) },
    removeItem(k) { if (storageBroken) throw new Error('denied'); backing.delete(k) },
  },
}
globalThis.fetch = async () => ({ ok: true, json: async () => ({}) })

let source = fs.readFileSync(path.join(root, 'client.js'), 'utf8').replace(/\r\n/g, '\n')
// Insert the probe just before the Copy banner comment, keeping the comment intact.
const marker = '\n/* ------------------------------------------------------------------ *\n     * Copy\n'
if (!source.includes(marker)) { console.error('probe marker not found'); process.exit(2) }
source = source.replace(marker, '\n    globalThis.__MEA_STORAGE__ = { buildAvatarStorage }\n' + marker)

new Function('window', 'require', source)(globalThis.window, requireFn)
const mod = spec.factory(requireFn)
const ctx = {
  get(name) { return name === 'locale' ? null : undefined },
  effect(fn) { return fn() },
  slots: { inject(owner, cb) { cb() }, register() { return {} } },
}
mod.apply(ctx)

const build = globalThis.__MEA_STORAGE__ && globalThis.__MEA_STORAGE__.buildAvatarStorage
if (typeof build !== 'function') { console.error('buildAvatarStorage not exposed'); process.exit(2) }

const adapter = build()
const journey = engine.avatarJourney('frodo')
const scene0 = journey.scenes[0]
const scene1 = journey.scenes[1]

const errors = []
const ok = (name, cond, detail) => { if (!cond) errors.push(name + (detail ? ' — ' + detail : '')) }

// --- round trip ---
ok('persist returns true', adapter.persist('frodo', { picks: { [scene0.id]: 0 }, step: 1, tier: 2 }) === true)
const restored = adapter.restore('frodo', journey)
ok('restore returns a snapshot', Boolean(restored))
ok('restore keeps the choice', restored && restored.picks[scene0.id] === 0)
ok('restore keeps the step', restored && restored.step === 1)
ok('restore keeps the tier', restored && restored.tier === 2)
ok('tier is remembered', adapter.rememberedTier('frodo') === 2)

// --- isolation ---
const sam = engine.avatarJourney('sam')
ok('other avatar sees nothing', adapter.restore('sam', sam) === null)

// --- clear ---
ok('clear returns true', adapter.clear('frodo') === true)
ok('cleared restore is null', adapter.restore('frodo', journey) === null)
ok('tier survives clearing the journey', adapter.rememberedTier('frodo') === 2)

// --- tampering ---
backing.set('mea:avatar:v1:frodo', JSON.stringify({ v: 1, picks: { bogus: 99 }, step: 99, tier: 9 }))
const tampered = adapter.restore('frodo', journey)
ok('tampered picks are dropped', !tampered || !('bogus' in tampered.picks))
ok('tampered step is clamped', !tampered || tampered.step <= journey.scenes.length - 1)
ok('tampered tier is clamped', !tampered || [1, 2, 3].includes(tampered.tier))

backing.set('mea:avatar:v1:frodo', '{not json')
ok('corrupt JSON restores as null', adapter.restore('frodo', journey) === null)

backing.set('mea:avatar:v1:frodo', JSON.stringify({ v: 999, picks: {}, step: 0 }))
ok('future version is rejected', adapter.restore('frodo', journey) === null)

// --- out-of-range choice ---
backing.set('mea:avatar:v1:frodo', JSON.stringify({ v: 1, picks: { [scene0.id]: scene0.choices.length + 3 }, step: 1, tier: 1 }))
const oob = adapter.restore('frodo', journey)
ok('out-of-range choice is dropped', !oob || !(scene0.id in oob.picks))

// --- hostile storage must degrade, not throw ---
storageBroken = true
let threw = false
try {
  adapter.persist('frodo', { picks: {}, step: 0, tier: 1 })
  adapter.restore('frodo', journey)
  adapter.clear('frodo')
  adapter.rememberedTier('frodo')
} catch (error) {
  threw = true
}
ok('a failing localStorage never throws', threw === false)
ok('restore degrades to null when storage fails', adapter.restore('frodo', journey) === null)
storageBroken = false

console.log('storage adapter probe')
console.log('  round trip:', restored ? 'ok' : 'FAILED')
console.log('  errors:', errors.length)
errors.forEach((e) => console.log('    ' + e))
process.exit(errors.length ? 1 : 0)
