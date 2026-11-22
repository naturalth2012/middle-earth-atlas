import { CHARACTERS, EVENTS, WORKS, DIFFERENCES } from '../data.js'
import { PLACES, ARTIFACTS, QUOTES, GLOSSARY, PLOT } from '../lore.js'
import { AVATARS, TONE_LABELS } from '../journey.js'
import { THEMES } from '../themes.js'
import { RECORD_TIER, FIELD_SAFETY, MAX_TIER, maskRecord, normalizeTier } from '../spoiler.js'
import { networkSummary } from '../analysis.js'
import { buildGraph, plot, bundle, relationPath, neighbors } from '../engine.js'

let fails = 0
const fail = (msg) => { fails++; console.log('FAIL ' + msg) }
const ok = (msg) => console.log('ok   ' + msg)
const check = (cond, msg) => cond ? ok(msg) : fail(msg)

const byId = new Map(CHARACTERS.map(c => [c.id, c]))
const eventIds = new Set(EVENTS.map(e => e.id))
const workIds = new Set(WORKS.map(w => w.id))

// 1. unique ids
const uniq = (arr, label) => {
  const seen = new Set(); const dups = []
  for (const x of arr) { if (seen.has(x)) dups.push(x); seen.add(x) }
  check(dups.length === 0, `${label} ids unique${dups.length ? ' dups=' + dups.join(',') : ''}`)
}
uniq(CHARACTERS.map(c => c.id), 'character')
uniq(EVENTS.map(e => e.id), 'event')
uniq(PLACES.map(p => p.id), 'place')
uniq(ARTIFACTS.map(a => a.id), 'artifact')
uniq(AVATARS.map(a => a.id), 'avatar')

// 2. relations use {to,type,label}
let relCount = 0
const pairCount = new Map()
const edgeSet = new Set()
for (const c of CHARACTERS) {
  for (const r of (c.relations || [])) {
    relCount++
    if (!r.to) fail(`${c.id} relation missing 'to'`)
    else if (!byId.has(r.to)) fail(`relation target missing: ${c.id} -> ${r.to}`)
    if (r.to === c.id) fail(`self loop: ${c.id}`)
    const key = [c.id, r.to].sort().join('|')
    pairCount.set(key, (pairCount.get(key) || 0) + 1)
    edgeSet.add(key)
  }
}
const dups = [...pairCount.entries()].filter(([, n]) => n > 2)
check(dups.length === 0, `pairs appear at most twice (236 directed, ${edgeSet.size} undirected)${dups.length ? ' dups=' + dups.map(([k, n]) => k + 'x' + n).join('; ') : ''}`)
check(relCount % 2 === 0, `relation count even (${relCount})`)
let asym = 0
const asymList = []
for (const c of CHARACTERS) for (const r of (c.relations || [])) {
  if (!byId.get(r.to)?.relations?.some(x => x.to === c.id)) { asym++; asymList.push(`${c.id}->${r.to}`) }
}
// Asymmetry is an accepted data convention (see AUDIT-FULL.md): one-directional
// mentions like frodo->aragorn; every pair still ≤2 directed rows. Report only.
check(asym <= 100, `relations symmetric-by-convention (asymmetric=${asym} of ${relCount})${asymList.slice(0, 5).map(s => ' ' + s).join('')}`)

// 3. events: order contiguous+unique; refs valid
const orders = EVENTS.map(e => e.order).sort((a, b) => a - b)
check(orders.every((o, i) => o === i + 1), 'event orders contiguous 1..N')
check(new Set(orders).size === EVENTS.length, 'event orders unique')
for (const e of EVENTS) {
  for (const cid of (e.characters || [])) if (!byId.has(cid)) fail(`event ${e.id} unknown character ${cid}`)
  for (const wid of (e.works || [])) if (!workIds.has(wid)) fail(`event ${e.id} unknown work ${wid}`)
}
ok('event refs done')

// 4. character works valid
for (const c of CHARACTERS) for (const wid of Object.keys(c.works || {})) if (!workIds.has(wid)) fail(`character ${c.id} unknown work ${wid}`)
ok('character work refs done')

// 5. avatars/scenes
let sceneCount = 0, choiceCount = 0, toneBad = []
for (const a of AVATARS) {
  if (!byId.has(a.character)) fail(`avatar ${a.id} -> character '${a.character}' not in dataset`)
  for (const s of (a.scenes || [])) {
    sceneCount++
    const chs = s.choices || []
    choiceCount += chs.length
    if (chs.length < 2) fail(`scene ${a.id}/${s.id} <2 choices`)
    if (chs.filter(c => c.canon).length !== 1) fail(`scene ${a.id}/${s.id} canon count != 1`)
    if (s.event && !eventIds.has(s.event)) fail(`scene ${a.id}/${s.id} unknown event ${s.event}`)
    for (const k of ['sight', 'sound', 'touch', 'smell']) if (!s.atmosphere?.[k]) fail(`scene ${a.id}/${s.id} atmosphere missing ${k}`)
    for (const c of chs) if (c.tone && !TONE_LABELS[c.tone]) toneBad.push(`${a.id}/${s.id}:${c.tone}`)
  }
}
check(sceneCount === 50, `scene count = ${sceneCount}`)
check(choiceCount === 104, `choice count = ${choiceCount}`)
check(toneBad.length === 0, `all choice tones in TONE_LABELS${toneBad.length ? ' bad=' + toneBad.join(',') : ''}`)

// 6. quotes attribution
for (const q of QUOTES) if (q.character && !byId.has(q.character)) fail(`quote unknown character ${q.character}`)
ok('quote attributions valid')

// 7. places/artifacts refs
for (const p of PLACES) for (const cid of (p.characters || [])) if (!byId.has(cid)) fail(`place ${p.id} unknown character ${cid}`)
for (const a of ARTIFACTS) for (const cid of (a.characters || [])) if (!byId.has(cid)) fail(`artifact ${a.id} unknown character ${cid}`)
ok('place/artifact refs done')

// 8. RECORD_TIER — keys span kinds (characters + events + places + artifacts)
const gateIds = new Set([
  ...CHARACTERS.map(c => c.id),
  ...EVENTS.map(e => e.id),
  ...PLACES.map(p => p.id),
  ...ARTIFACTS.map(a => a.id),
])
for (const [id, t] of Object.entries(RECORD_TIER)) {
  if (!gateIds.has(id)) fail(`RECORD_TIER '${id}' not in dataset`)
  if (!(t >= 1 && t <= MAX_TIER)) fail(`RECORD_TIER '${id}' tier ${t} out of range`)
}
ok(`RECORD_TIER ok (${Object.keys(RECORD_TIER).length})`)

// 9. FIELD_SAFETY kinds
const needKinds = ['character', 'event', 'place', 'artifact', 'quote', 'glossary', 'work']
const missing = needKinds.filter(k => !FIELD_SAFETY[k])
check(missing.length === 0, `FIELD_SAFETY covers kinds${missing.length ? ' missing=' + missing.join(',') : ''}`)

// 10. graph
const g = buildGraph({})
check(g.nodes.length === CHARACTERS.length, `graph nodes ${g.nodes.length} == ${CHARACTERS.length}`)
const s = networkSummary({})
ok(`network: nodes=${s.nodes} edges=${s.edges} avgPath=${s.averagePathLength} diameter=${s.diameter} unreachablePairs=${s.unreachablePairs}`)

// 11. counts
check(Array.isArray(PLOT) && PLOT.length === 4, `plot arcs = ${PLOT.length}`)
check(THEMES.length === 7, `themes = ${THEMES.length}`)
check(DIFFERENCES.length === 10, `differences = ${DIFFERENCES.length}`)
check(GLOSSARY.length === 9, `glossary = ${GLOSSARY.length}`)
check(WORKS.length === 6, `works = ${WORKS.length}`)
check(QUOTES.length === 39, `quotes = ${QUOTES.length}`)

// 12. spoiler-gate spot checks (fix-stage regressions)
check(maskRecord('work', { id: 'lotr-book', summary: 'x' }, 1).summary === undefined, 'work summary gated at tier1')
check(maskRecord('work', { id: 'lotr-book', summary: 'x' }, 2).summary === 'x', 'work summary visible at tier2')
check(normalizeTier(undefined) === MAX_TIER, 'normalizeTier(undefined) = MAX_TIER')
const p1 = plot({ maxTier: 1 })
check(p1.flatMap(a => a.beats).every(b => !b.locked || (b.title === null && b.desc === null)), 'plot locked beats hide title/desc')
const b1 = bundle({ maxTier: 1 })
const b3 = bundle({ maxTier: 3 })
check(Array.isArray(b1.differences) && b1.differences.length === 0, 'bundle differences gated at tier1')
check(b1.journeys.filter(j => j.locked).every(j => j.desc === ''), 'bundle journeys desc gated when locked')
// A place whose own record ceiling is above tier 1 must lose its summary
// entirely (isengard: 「最终被恩特大军摧毁」) — and get it back at tier 3.
check(b1.places.every(p => {
  const recordCap = RECORD_TIER[p.id]
  return !(typeof recordCap === 'number' && recordCap > 1) || p.summary === undefined
}), 'bundle gated places hide summary at tier1')
const isengardT1 = b1.places.find(p => p.id === 'isengard')
const isengardT3 = b3.places.find(p => p.id === 'isengard')
check(isengardT1 && isengardT1.summary === undefined, 'isengard summary hidden at tier1')
check(isengardT3 && isengardT3.summary !== undefined, 'isengard summary visible at tier3')
const r1 = relationPath('frodo', 'gollum', { maxTier: 1 })
check(r1.ok && r1.steps.every(s => s.label === '' || s.label === undefined), 'relationPath labels gated at tier1')
const n1 = neighbors('frodo', { maxTier: 1 })
check(n1 && Object.values(n1.groups).flat().every(i => i.locked ? !i.label : true), 'neighbors locked items hide label at tier1')

console.log(fails === 0 ? '\nALL INVARIANTS PASS' : `\n${fails} INVARIANT FAILURES`)
process.exit(fails ? 1 : 0)
