/**
 * Middle-earth Atlas — self check.
 *
 * Verifies three things without a browser:
 *   1. dataset integrity: every cross-reference resolves, ids are unique;
 *   2. engine behaviour: search, dossiers, graph, paths, timeline, ask;
 *   3. route/tool surface: every path the Host declares is unique and known.
 *
 * Run: node scripts/selfcheck.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')

const data = await import(new URL('../data.js', import.meta.url).href)
const lore = await import(new URL('../lore.js', import.meta.url).href)
const engine = await import(new URL('../engine.js', import.meta.url).href)
const journey = await import(new URL('../journey.js', import.meta.url).href)
const storage = await import(new URL('../storage.js', import.meta.url).href)

let failures = 0
let checks = 0

function check(name, condition, detail) {
  checks++
  if (condition) return
  failures++
  console.log('  FAIL  ' + name + (detail ? ' — ' + detail : ''))
}

function group(title) {
  console.log('\n' + title)
}

/* ------------------------------------------------------------------ *
 * 1. Dataset integrity
 * ------------------------------------------------------------------ */
group('dataset integrity')

const characters = data.CHARACTERS
const works = data.WORKS
const factions = data.FACTIONS
const events = data.EVENTS
const places = lore.PLACES
const artifacts = lore.ARTIFACTS
const glossary = lore.GLOSSARY
const quotes = lore.QUOTES
const plot = lore.PLOT
const journeys = lore.JOURNEYS

const charIds = new Set(characters.map((c) => c.id))
const workIds = new Set(works.map((w) => w.id))
const factionIds = new Set(factions.map((f) => f.id))

check('character ids unique', charIds.size === characters.length,
  characters.length + ' rows, ' + charIds.size + ' ids')
check('work ids unique', workIds.size === works.length)
check('faction ids unique', factionIds.size === factions.length)
check('event ids unique', new Set(events.map((e) => e.id)).size === events.length)
check('place ids unique', new Set(places.map((p) => p.id)).size === places.length)
check('artifact ids unique', new Set(artifacts.map((a) => a.id)).size === artifacts.length)

for (const c of characters) {
  check('faction exists for ' + c.id, factionIds.has(c.faction), c.faction)
  check('name present for ' + c.id, Boolean(c.name))
  check('summary present for ' + c.id, Boolean(c.summary))
  check('canon present for ' + c.id, Boolean(c.canon))
  for (const rel of c.relations || []) {
    check('relation target exists: ' + c.id + ' -> ' + rel.to, charIds.has(rel.to))
    check('relation type known: ' + c.id + ' -> ' + rel.to,
      Boolean(data.RELATION_TYPES[rel.type]), rel.type)
  }
  for (const workId of Object.keys(c.works || {})) {
    check('work exists for ' + c.id + ': ' + workId, workIds.has(workId))
  }
}

for (const e of events) {
  for (const id of e.characters || []) check('event character exists: ' + e.id + ' ' + id, charIds.has(id))
  for (const id of e.works || []) check('event work exists: ' + e.id + ' ' + id, workIds.has(id))
}

for (const p of places) {
  for (const id of p.characters || []) check('place character exists: ' + p.id + ' ' + id, charIds.has(id))
  for (const id of p.works || []) check('place work exists: ' + p.id + ' ' + id, workIds.has(id))
}

for (const a of artifacts) {
  for (const id of a.owners || []) check('artifact owner exists: ' + a.id + ' ' + id, charIds.has(id))
  for (const id of a.works || []) check('artifact work exists: ' + a.id + ' ' + id, workIds.has(id))
}

for (const g of glossary) {
  for (const id of g.related || []) check('glossary related exists: ' + g.id + ' ' + id, charIds.has(id))
}

for (const q of quotes) {
  check('quote speaker exists: ' + q.id, charIds.has(q.speaker), q.speaker)
  check('quote work exists: ' + q.id, workIds.has(q.work), q.work)
  check('quote has text: ' + q.id, Boolean(q.text))
}

for (const p of plot) {
  check('plot work exists: ' + p.work, workIds.has(p.work))
  check('plot has beats: ' + p.work, p.beats.length > 0)
  for (const b of p.beats) {
    if (b.event) check('beat event exists: ' + b.id, events.some((e) => e.id === b.event), b.event)
  }
}

for (const j of journeys) {
  check('journey has stops: ' + j.id, j.stops.length > 1)
  for (const id of j.works || []) check('journey work exists: ' + j.id + ' ' + id, workIds.has(id))
}

for (const p of data.PATHS) {
  for (const step of p.steps) check('path step work exists: ' + p.id, workIds.has(step.work), step.work)
}

// No character relation may point at itself.
for (const c of characters) {
  for (const rel of c.relations || []) {
    check('no self relation: ' + c.id, rel.to !== c.id)
  }
}

/* ------------------------------------------------------------------ *
 * 2b. Avatar journeys
 * ------------------------------------------------------------------ */
group('avatar journeys')

const avatars = journey.AVATARS
const placeIds = new Set(places.map((p) => p.id))
const eventIds = new Set(events.map((e) => e.id))
const avatarCharacterIds = new Set(charIds)

check('avatars exist', avatars.length > 0)
check('avatar ids unique', new Set(avatars.map((a) => a.id)).size === avatars.length)

let totalScenes = 0
let totalChoices = 0
for (const avatar of avatars) {
  check('avatar maps to a real character: ' + avatar.id, avatarCharacterIds.has(avatar.character), avatar.character)
  check('avatar has tagline: ' + avatar.id, Boolean(avatar.tagline))
  check('avatar has opening: ' + avatar.id, Boolean(avatar.opening))
  check('avatar has scenes: ' + avatar.id, Array.isArray(avatar.scenes) && avatar.scenes.length > 0)

  const sceneIds = new Set()
  for (const scene of avatar.scenes) {
    totalScenes++
    check('scene id unique: ' + scene.id, !sceneIds.has(scene.id))
    sceneIds.add(scene.id)
    check('scene has narration: ' + scene.id, Boolean(scene.narration))
    check('scene has stakes: ' + scene.id, Boolean(scene.stakes))
    check('scene tier is 1-3: ' + scene.id, [1, 2, 3].includes(scene.tier))
    if (scene.place) check('scene place exists: ' + scene.id, placeIds.has(scene.place), scene.place)
    if (scene.event) check('scene event exists: ' + scene.id, eventIds.has(scene.event), scene.event)
    check('scene has at least two choices: ' + scene.id, scene.choices.length >= 2)

    const canonChoices = scene.choices.filter((c) => c.canon).length
    check('scene has exactly one canon choice: ' + scene.id, canonChoices === 1, String(canonChoices))

    for (const choice of scene.choices) {
      totalChoices++
      check('choice has label: ' + scene.id, Boolean(choice.label))
      check('choice has result: ' + scene.id, Boolean(choice.result))
      check('choice tone known: ' + scene.id + '/' + choice.tone, Boolean(journey.TONE_LABELS[choice.tone]), choice.tone)
    }
  }
}

check('total scenes counted', totalScenes > 0)
check('total choices counted', totalChoices > 0)

const list3 = engine.avatarList({ maxTier: 3 })
const list1 = engine.avatarList({ maxTier: 1 })
check('avatarList returns all', list3.length === avatars.length)
check('spoiler tier 1 narrows the list', list1.length <= list3.length)
check('every tier-1 avatar has at least one scene',
  list1.every((a) => a.sceneCount >= 1))

const frodoJourney = engine.avatarJourney('frodo')
check('avatarJourney resolves by id', Boolean(frodoJourney))
check('avatarJourney resolves by Chinese name', Boolean(engine.avatarJourney('弗罗多')))
check('avatarJourney resolves by English name', Boolean(engine.avatarJourney('Frodo')))
check('unknown avatar returns null', engine.avatarJourney('nobody-xyz-123') === null)

const tier1Journey = engine.avatarJourney('frodo', { maxTier: 1 })
check('tier filter drops later scenes', tier1Journey.scenes.length < frodoJourney.scenes.length)
check('hidden scenes reported', tier1Journey.hiddenScenes > 0)
check('tier filter never leaks a higher tier',
  tier1Journey.scenes.every((s) => s.tier <= 1))

// Scoring: an all-canon run must score 1.0, an all-shadow run must score 0.
const allCanon = frodoJourney.scenes.map((s) => {
  const choice = s.choices.find((c) => c.canon)
  return { scene: s.id, choice: choice.index }
})
const perfect = engine.judgeJourney('frodo', allCanon)
check('perfect run scores 1.0', perfect && perfect.ratio === 1, String(perfect && perfect.ratio))
check('perfect run verdict mentions the book', perfect && /一致/.test(perfect.verdict))
check('perfect run reports no divergence', perfect && perfect.diverged.length === 0)

const allShadow = frodoJourney.scenes.map((s) => {
  const choice = s.choices.find((c) => !c.canon)
  return { scene: s.id, choice: choice.index }
})
const worst = engine.judgeJourney('frodo', allShadow)
check('all-shadow run scores 0', worst && worst.ratio === 0, String(worst && worst.ratio))
check('all-shadow run reports divergence', worst && worst.diverged.length === worst.total)

const partial = engine.judgeJourney('frodo', [allCanon[0]])
check('partial run counts answered only', partial && partial.answered === 1)
check('partial run caps ratio', partial && partial.ratio <= 1)

const emptyRun = engine.judgeJourney('frodo', [])
check('empty run is handled', emptyRun && emptyRun.answered === 0)
check('empty run ratio is 0', emptyRun && emptyRun.ratio === 0)

const junkRun = engine.judgeJourney('frodo', [null, 'x', { scene: 'nope', choice: 9 }, { scene: 'fr1', choice: 0 }])
check('malformed choices do not throw', junkRun !== null)
check('malformed choices ignore unknown scenes', junkRun && junkRun.answered === 1)

check('judgeJourney on unknown avatar returns null', engine.judgeJourney('nobody-xyz', []) === null)

/* ------------------------------------------------------------------ *
 * 3. Engine behaviour
 * ------------------------------------------------------------------ */
group('engine behaviour')

const bundle = engine.bundle()
check('bundle counts match data', bundle.counts.characters === characters.length)
check('bundle includes places', bundle.counts.places === places.length)
check('bundle includes artifacts', bundle.counts.artifacts === artifacts.length)
check('bundle includes glossary', bundle.counts.glossary === glossary.length)
check('bundle includes quotes', bundle.counts.quotes === quotes.length)
check('bundle includes plot', bundle.plot.length === plot.length)
check('bundle includes journeys', bundle.journeys.length === journeys.length)

const frodo = engine.searchCharacters('弗罗多')
check('search finds Frodo', frodo.length > 0 && frodo[0].name.includes('弗罗多'))

const byFaction = engine.searchCharacters('', { faction: 'elf' })
check('faction filter works', byFaction.length > 0 && byFaction.every((c) => c.faction === 'elf'))

const byWork = engine.searchCharacters('', { work: 'hobbit-book' })
check('work filter works', byWork.length > 0 && byWork.every((c) => c.works && c.works['hobbit-book']))

const dossier = engine.characterDetail('甘道夫')
check('dossier resolves alias', dossier && dossier.id === 'gandalf')
check('dossier has relations', dossier.relations.length > 0)
check('dossier has places', Array.isArray(dossier.places))
check('dossier has artifacts', Array.isArray(dossier.artifacts))
check('dossier has quotes', Array.isArray(dossier.quotes))

const graphAll = engine.buildGraph({})
check('graph has nodes', graphAll.nodes.length > 10)
check('graph has edges', graphAll.edges.length > 10)
check('graph edges reference real nodes',
  graphAll.edges.every((e) => graphAll.nodes.some((n) => n.id === e.source)
    && graphAll.nodes.some((n) => n.id === e.target)))

const focusGraph = engine.buildGraph({ focus: 'frodo' })
check('focus graph is a subset', focusGraph.nodes.length < graphAll.nodes.length && focusGraph.nodes.length > 0)

const relPath = engine.relationPath('弗罗多', '凯兰崔尔')
check('path resolves', relPath.ok === true)
check('path has steps', relPath.ok && relPath.steps.length === relPath.hops)
check('path hops are positive', relPath.ok && relPath.hops > 0)

const selfPath = engine.relationPath('甘道夫', '甘道夫')
check('self path is zero hops', selfPath.ok === true && selfPath.hops === 0)

const badPath = engine.relationPath('甘道夫', '不存在的角色XYZ')
check('bad path reports failure', badPath.ok === false)

const tl = engine.timeline({})
check('timeline returns events', tl.events.length === events.length)
const tlThird = engine.timeline({ age: '第三纪元' })
check('timeline age filter', tlThird.events.length > 0 && tlThird.events.every((e) => e.age === '第三纪元'))

check('place detail resolves', Boolean(engine.placeDetail('末日火山')))
check('artifact detail resolves', Boolean(engine.artifactDetail('至尊魔戒')))
check('glossary detail resolves', Boolean(engine.glossaryDetail('迈雅')))
check('unknown place returns null', engine.placeDetail('不存在之地XYZ') === null)

const universal = engine.searchAll('魔戒')
check('universal search groups results', universal.total > 0 && universal.groups.length > 0)

// The question answerer must never throw and must always return text.
const questions = [
  '弗罗多是谁', '索伦是谁', '甘道夫介绍', '阿拉贡和凯兰崔尔怎么联系',
  '末日火山在哪里', '至尊魔戒', '精灵三戒', '迈雅', '魔戒是怎么被毁掉的',
  '山姆和咕噜是什么关系', '随便问点什么xyz', '',
]
for (const q of questions) {
  let answer
  try { answer = engine.ask(q) } catch (error) {
    check('ask does not throw: ' + q, false, error.message)
    continue
  }
  check('ask returns text: "' + q + '"', typeof answer === 'string' && answer.length > 0)
}
check('ask knows who Frodo is', engine.ask('弗罗多是谁').includes('弗罗多'))
check('ask knows a place', engine.ask('末日火山在哪里').includes('魔多'))
check('ask falls back politely', engine.ask('xyzzyplugh').includes('没找到'))

check('suggestions are non-empty', engine.suggestions().length > 0)
check('counts are consistent', bundle.counts.relations === characters.reduce((n, c) => n + (c.relations || []).length, 0))

/* ------------------------------------------------------------------ *
 * 3. Route surface
 * ------------------------------------------------------------------ */
group('route surface')

const hostSource = fs.readFileSync(path.join(root, 'index.js'), 'utf8')
const declared = [...hostSource.matchAll(/BASE \+ '([^']+)'/g)].map((m) => m[1])
const uniquePaths = new Set(declared)
check('declared paths are unique', uniquePaths.size === declared.length,
  declared.join(', '))
check('bundle route declared', uniquePaths.has('/bundle'))
check('ask route declared', uniquePaths.has('/ask'))
check('graph route declared', uniquePaths.has('/graph'))

const clientSource = fs.readFileSync(path.join(root, 'client.js'), 'utf8').replace(/\r\n/g, '\n')
const clientPaths = [...new Set([
  ...[...clientSource.matchAll(/BASE \+ '([^'?]+)/g)].map((m) => m[1]),
])]
for (const p of clientPaths) {
  check('client path served by host: ' + p, uniquePaths.has(p))
}

// The client must not reference removed copy keys.
const zhBlock = clientSource.match(/const ZH = \{([\s\S]*?)\n    \}\n\n    const EN/)
check('client has ZH copy', Boolean(zhBlock))
if (zhBlock) {
  const keys = [...zhBlock[1].matchAll(/^\s{6}([A-Za-z][A-Za-z0-9]*):/gm)].map((m) => m[1])
  const used = [...new Set([...clientSource.matchAll(/\bt\('([A-Za-z][A-Za-z0-9]*)'/g)].map((m) => m[1]))]
  const missing = used.filter((k) => !keys.includes(k))
  check('all used copy keys exist', missing.length === 0, missing.join(', '))
}

/* ------------------------------------------------------------------ *
 * Manifest
 * ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ *
 * Generated code
 *
 * `client.js` carries a generated copy of `avatar-tab.js`, because the browser
 * module loader only exposes `require('react')`. A stale copy would ship UI the
 * author believes they already changed, so the sync is verified here rather
 * than trusted.
 * ------------------------------------------------------------------ */
group('generated code')

{
  const BEGIN = '/* --- avatar-tab:begin (generated from avatar-tab.js — do not edit here) --- */'
  const END = '/* --- avatar-tab:end --- */'
  const clientCode = fs.readFileSync(path.join(root, 'client.js'), 'utf8').replace(/\r\n/g, '\n')
  const tabCode = fs.readFileSync(path.join(root, 'avatar-tab.js'), 'utf8').replace(/\r\n/g, '\n')

  const beginAt = clientCode.indexOf(BEGIN)
  const endAt = clientCode.indexOf(END)
  check('client.js carries the generated avatar-tab block', beginAt !== -1 && endAt !== -1)
  check('exactly one generated block', beginAt !== -1
    && clientCode.indexOf(BEGIN, beginAt + 1) === -1)
  check('begin marker precedes end marker', beginAt !== -1 && endAt > beginAt)

  if (beginAt !== -1 && endAt > beginAt) {
    const embedded = clientCode.slice(beginAt, endAt + END.length)

    // Rebuild the expected block using the SAME algorithm the inliner uses, so
    // the two cannot disagree about how the source is delimited. Any edit that
    // the inliner would carry into client.js is therefore caught here.
    const expected = buildExpectedBlock(tabCode)
    check('could rebuild the expected block from avatar-tab.js', Boolean(expected))

    if (expected) {
      const normalise = (s) => s.split('\n').map((line) => line.replace(/\s+$/u, '')).join('\n').trim()
      check('generated block matches avatar-tab.js (run: node scripts/inline-avatar-tab.mjs)',
        normalise(embedded) === normalise(expected))
    }
  }
}

/**
 * The inliner's contract, duplicated deliberately in a testable form.
 * `avatar-tab.js` must contain exactly one exported builder whose parameter
 * list is carried verbatim into the generated copy and whose body runs to the
 * file's final closing brace.
 */
function buildExpectedBlock(tabCode) {
  const BEGIN = '/* --- avatar-tab:begin (generated from avatar-tab.js — do not edit here) --- */'
  const END = '/* --- avatar-tab:end --- */'

  const headerMatch = tabCode.match(/^export function buildAvatarTab\(\{([^}]*)\}\) \{/m)
  if (!headerMatch) return null

  const params = headerMatch[1].replace(/\s+/g, ' ').trim()
  const headerAt = tabCode.indexOf(headerMatch[0])
  if (headerAt === -1) return null

  const lastBrace = tabCode.lastIndexOf('\n}')
  if (lastBrace === -1 || lastBrace < headerAt) return null

  const body = tabCode.slice(headerAt + headerMatch[0].length, lastBrace).replace(/^\s*\n/, '')
  return [
    BEGIN,
    `    const buildAvatarTab = ({ ${params} }) => {`,
    body.replace(/\n+$/, ''),
    '    }',
    '    ' + END,
  ].join('\n')
}

/* ------------------------------------------------------------------ *
 * Avatar persistence
 *
 * Snapshots survive reloads, so they must never be trusted. These checks pin
 * the validation contract: stale versions, unknown scenes and out-of-range
 * choices are dropped, and a broken store degrades to "no persistence".
 * ------------------------------------------------------------------ */
group('avatar persistence')

{
  const { SNAPSHOT_VERSION, buildSnapshot, validateSnapshot, loadSnapshot,
    saveSnapshot, clearSnapshot, snapshotKey } = storage

  /** A Map-backed store with the same shape as localStorage. */
  const memoryStore = () => {
    const map = new Map()
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => { map.set(k, String(v)) },
      removeItem: (k) => { map.delete(k) },
      size: () => map.size,
    }
  }

  const frodo = engine.avatarJourney('frodo')
  check('journey fixture loads', Boolean(frodo && frodo.scenes.length >= 3))

  // --- round trip ---
  const store = memoryStore()
  const state = { picks: { [frodo.scenes[0].id]: 0, [frodo.scenes[1].id]: 1 }, step: 1, tier: 2 }
  check('saveSnapshot reports success', saveSnapshot(store, 'frodo', state) === true)

  const restored = loadSnapshot(store, 'frodo', frodo)
  check('round trip restores picks', restored && restored.picks[frodo.scenes[0].id] === 0)
  check('round trip restores step', restored && restored.step === 1)
  check('round trip restores tier', restored && restored.tier === 2)

  check('snapshot key is versioned', snapshotKey('frodo').includes('v' + SNAPSHOT_VERSION))
  check('snapshot key names the avatar', snapshotKey('frodo').endsWith('frodo'))

  // --- clear ---
  check('clearSnapshot reports success', clearSnapshot(store, 'frodo') === true)
  check('cleared snapshot loads as null', loadSnapshot(store, 'frodo', frodo) === null)

  // --- validation: bad inputs never throw, never return junk ---
  check('null snapshot is rejected', validateSnapshot(null, frodo) === null)
  check('non-object snapshot is rejected', validateSnapshot('nope', frodo) === null)
  check('wrong version is rejected', validateSnapshot({ v: 999, picks: {}, step: 0 }, frodo) === null)
  check('missing journey is rejected', validateSnapshot({ v: SNAPSHOT_VERSION, picks: {} }, null) === null)
  check('empty journey is rejected',
    validateSnapshot({ v: SNAPSHOT_VERSION, picks: {} }, { id: 'x', scenes: [] }) === null)

  // Unknown scene ids are dropped but valid ones survive.
  const mixed = validateSnapshot({
    v: SNAPSHOT_VERSION,
    picks: { [frodo.scenes[0].id]: 0, 'scene-that-does-not-exist': 2 },
    step: 0,
    tier: 1,
  }, frodo)
  check('unknown scene is dropped', mixed && !('scene-that-does-not-exist' in mixed.picks))
  check('valid scene survives alongside an unknown one',
    mixed && mixed.picks[frodo.scenes[0].id] === 0)

  // Out-of-range choice indexes are dropped.
  const firstScene = frodo.scenes[0]
  const outOfRange = validateSnapshot({
    v: SNAPSHOT_VERSION,
    picks: { [firstScene.id]: firstScene.choices.length + 5 },
    step: 1,
    tier: 1,
  }, frodo)
  check('out-of-range choice is dropped', outOfRange === null || !(firstScene.id in outOfRange.picks))

  const negative = validateSnapshot({
    v: SNAPSHOT_VERSION,
    picks: { [firstScene.id]: -1 },
    step: 1,
  }, frodo)
  check('negative choice is dropped', negative === null || !(firstScene.id in negative.picks))

  // Step is clamped into range.
  const clampedHigh = validateSnapshot({
    v: SNAPSHOT_VERSION,
    picks: { [firstScene.id]: 0 },
    step: 9999,
    tier: 1,
  }, frodo)
  check('step clamps to the last scene',
    clampedHigh && clampedHigh.step === frodo.scenes.length - 1)

  const clampedNeg = validateSnapshot({
    v: SNAPSHOT_VERSION,
    picks: { [firstScene.id]: 0 },
    step: -5,
    tier: 1,
  }, frodo)
  check('negative step clamps to zero', clampedNeg && clampedNeg.step === 0)

  // Invalid tier falls back to 1.
  const badTier = validateSnapshot({
    v: SNAPSHOT_VERSION,
    picks: { [firstScene.id]: 0 },
    step: 0,
    tier: 42,
  }, frodo)
  check('invalid tier falls back to 1', badTier && badTier.tier === 1)

  // --- degradation: a throwing store must not break gameplay ---
  const hostile = {
    getItem() { throw new Error('denied') },
    setItem() { throw new Error('quota') },
    removeItem() { throw new Error('denied') },
  }
  check('loadSnapshot survives a throwing store', loadSnapshot(hostile, 'frodo', frodo) === null)
  check('saveSnapshot reports false on a throwing store', saveSnapshot(hostile, 'frodo', state) === false)
  check('clearSnapshot reports false on a throwing store', clearSnapshot(hostile, 'frodo') === false)
  check('a null store is tolerated', loadSnapshot(null, 'frodo', frodo) === null
    && saveSnapshot(null, 'frodo', state) === false)

  // Corrupt JSON in storage must not throw.
  const corrupt = memoryStore()
  corrupt.setItem(snapshotKey('frodo'), '{not json')
  check('corrupt JSON loads as null', loadSnapshot(corrupt, 'frodo', frodo) === null)

  // --- buildSnapshot sanitises ---
  const built = buildSnapshot({ picks: { a: 0, b: -1, c: 'x' }, step: -3, tier: 9 })
  check('buildSnapshot keeps valid picks only', Object.keys(built.picks).length === 1 && built.picks.a === 0)
  check('buildSnapshot clamps step', built.step === 0)
  check('buildSnapshot clamps tier', built.tier === 1)
  check('buildSnapshot stamps a version', built.v === SNAPSHOT_VERSION)
  check('buildSnapshot stamps a time', typeof built.savedAt === 'number' && built.savedAt > 0)

  // --- isolation between avatars ---
  const shared = memoryStore()
  saveSnapshot(shared, 'frodo', { picks: { [frodo.scenes[0].id]: 0 }, step: 1, tier: 1 })
  const sam = engine.avatarJourney('sam')
  check('another avatar does not read this snapshot', loadSnapshot(shared, 'sam', sam) === null)
  check('each avatar has its own key', snapshotKey('frodo') !== snapshotKey('sam'))
}

/* ------------------------------------------------------------------ *
 * Atmosphere layer
 *
 * Each scene may carry an optional sensory note. It is a reading aid, so it
 * must never change scoring, never leak into the avatar list, and must stay
 * short enough not to compete with the narration.
 * ------------------------------------------------------------------ */
group('atmosphere layer')

{
  const allScenes = journey.AVATARS.flatMap((a) => a.scenes.map((sc) => ({ avatar: a.id, scene: sc })))
  const withAtmo = allScenes.filter((x) => x.scene.atmosphere)
  const senses = ['sight', 'sound', 'touch', 'smell']

  check('every scene carries an atmosphere note',
    withAtmo.length === allScenes.length,
    withAtmo.length + '/' + allScenes.length)

  for (const { scene } of withAtmo) {
    const a = scene.atmosphere
    check('atmosphere is an object: ' + scene.id, a && typeof a === 'object' && !Array.isArray(a))
    check('atmosphere has sight: ' + scene.id, Boolean(a.sight))
    check('atmosphere has sound: ' + scene.id, Boolean(a.sound))

    // Only known senses, so a typo cannot silently add an unused field.
    for (const key of Object.keys(a)) {
      check('known sense key: ' + scene.id + '.' + key, senses.includes(key), key)
    }

    // Concrete detail, not a bare adjective: a minimum length is a rough proxy.
    for (const key of senses) {
      if (!a[key]) continue
      check('sense text is substantive: ' + scene.id + '.' + key, a[key].length >= 5, String(a[key].length))
      check('sense text is not bloated: ' + scene.id + '.' + key, a[key].length <= 40, String(a[key].length))
    }

    const total = senses.reduce((n, k) => n + (a[k] ? a[k].length : 0), 0)
    check('atmosphere total stays under the narration: ' + scene.id, total <= 110, String(total))
  }

  // The avatar list must stay light: no atmosphere in list payloads.
  const list = engine.avatarList({ maxTier: 3 })
  check('avatarList omits atmosphere', list.every((a) => !('atmosphere' in a)))
  check('avatarList has no scenes payload', list.every((a) => !('scenes' in a)))

  // Journey payload must carry it.
  const one = engine.avatarJourney('frodo')
  const withScene = one.scenes.find((sc) => sc.atmosphere)
  check('avatarJourney carries atmosphere', Boolean(withScene))
  check('journey atmosphere has sight', Boolean(withScene && withScene.atmosphere.sight))

  // Regression: the layer must not move the score.
  const frodoFull = engine.avatarJourney('frodo')
  const canonRun = frodoFull.scenes.map((sc) => ({
    scene: sc.id,
    choice: sc.choices.find((c) => c.canon).index,
  }))
  const perfect = engine.judgeJourney('frodo', canonRun)
  check('atmosphere does not disturb the perfect score', perfect && perfect.ratio === 1, String(perfect && perfect.ratio))
  check('atmosphere does not add divergence', perfect && perfect.diverged.length === 0)

  const shadowRun = frodoFull.scenes.map((sc) => ({
    scene: sc.id,
    choice: sc.choices.find((c) => !c.canon).index,
  }))
  const zero = engine.judgeJourney('frodo', shadowRun)
  check('atmosphere does not disturb the zero score', zero && zero.ratio === 0, String(zero && zero.ratio))

  // The UI must render a native details element with a summary, not a div.
  const tabCode = fs.readFileSync(path.join(root, 'avatar-tab.js'), 'utf8').replace(/\r\n/g, '\n')
  check('atmosphere renders as a details element', tabCode.includes("h('details'"))
  check('atmosphere has a summary', tabCode.includes("h('summary'"))
  check('atmosphere block is collapsed by default', !/h\('details',\s*\{[^}]*open:\s*true/.test(tabCode))

  const clientCode = fs.readFileSync(path.join(root, 'client.js'), 'utf8').replace(/\r\n/g, '\n')
  check('details marker is styled away', clientCode.includes('::-webkit-details-marker'))
  check('summary keeps a visible focus ring',
    /summary:focus-visible[\s\S]{0,120}outline:/.test(clientCode))
  check('atmosphere copy is localised', clientCode.includes('atmoOpen'))
}

/* ------------------------------------------------------------------ *
 * Accessibility & responsive layout
 *
 * CSS fails silently: a mistyped selector simply never applies. These checks
 * pin the handful of structural promises the layout and semantics rely on, so
 * a typo surfaces as a failed check rather than an invisible defect.
 * ------------------------------------------------------------------ */
group('accessibility & responsive')

{
  const clientCode = fs.readFileSync(path.join(root, 'client.js'), 'utf8').replace(/\r\n/g, '\n')
  const tabCode = fs.readFileSync(path.join(root, 'avatar-tab.js'), 'utf8').replace(/\r\n/g, '\n')

  // --- responsive ---
  const mediaQueries = [...clientCode.matchAll(/@media \(max-width: (\d+)px\)/g)].map((m) => Number(m[1]))
  check('at least one responsive breakpoint exists', mediaQueries.length > 0)
  check('breakpoints are in a sane narrow-screen range',
    mediaQueries.every((w) => w >= 360 && w <= 800),
    mediaQueries.join(', '))

  // Every selector inside a media block must exist outside it, otherwise the
  // rule silently does nothing.
  const mediaBlocks = [...clientCode.matchAll(/@media \(max-width: \d+px\) \{([\s\S]*?)\n        \}/g)].map((m) => m[1])
  check('media blocks are parseable', mediaBlocks.length > 0, String(mediaBlocks.length))

  for (const block2 of mediaBlocks) {
    const selectors = [...block2.matchAll(/^\s*([.#][\w\-,.\s>#:()\[\]="']+?)\{/gm)]
      .flatMap((m) => m[1].split(','))
      .map((sel) => sel.trim())
      .filter(Boolean)
    for (const sel of selectors) {
      // Compare only the leading class token; the media rule may add or omit
      // descendant parts that legitimately differ.
      const cls = sel.match(/^\.([\w-]+)/)
      if (!cls) continue
      check('responsive selector targets an existing class: .' + cls[1],
        clientCode.includes('.' + cls[1]))
    }
  }

  // The drawer must be allowed to go full width on narrow screens.
  check('drawer becomes full width on narrow screens',
    /@media[\s\S]{0,600}\.mea-drawer\{[^}]*width:100%/.test(clientCode))

  // The tab strip must scroll rather than wrap when space is tight.
  check('tab strip scrolls horizontally on narrow screens',
    /@media[\s\S]{0,600}\.mea-tabs\{[^}]*overflow-x:auto/.test(clientCode))

  // --- focus visibility ---
  check('focus-visible styling is defined', clientCode.includes(':focus-visible'))
  check('focus ring uses a theme token',
    /:focus-visible[\s\S]{0,200}outline:[^;]*var\(--dsw-alias-brand-primary\)/.test(clientCode))

  // --- ARIA in the avatar journey ---
  check('journey progress exposes progressbar semantics', tabCode.includes("role: 'progressbar'"))
  check('journey progress reports aria-valuenow', tabCode.includes("'aria-valuenow'"))
  check('choice list is a labelled group', tabCode.includes("role: 'group'"))
  check('outcome is announced politely', tabCode.includes("'aria-live': 'polite'"))
  check('decorative spinners are hidden from assistive tech',
    tabCode.includes("'aria-hidden'"))

  // Interactive controls must be real buttons, not divs with onClick.
  // (Native buttons are focusable and Enter-activatable without tabIndex.)
  const divClicks = [...tabCode.matchAll(/h\('div', \{[^}]*onClick/g)]
  check('no div-based click targets in the journey tab', divClicks.length === 0,
    String(divClicks.length))
  check('journey controls are native buttons', tabCode.includes("h('button'"))

  // --- persistence surface ---
  check('client exposes a storage adapter', clientCode.includes('buildAvatarStorage'))
  check('storage access is guarded', clientCode.includes('function safeStorage'))
  check('client tolerates a missing localStorage',
    /safeStorage[\s\S]{0,400}catch/.test(clientCode))
}

group('manifest')

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
check('package exports client', Boolean(pkg.exports && pkg.exports['./client']))
check('package exports icon', Boolean(pkg.exports && pkg.exports['./icon']))
check('package declares bundle patch', Boolean(pkg.dsh && pkg.dsh.bundle && pkg.dsh.bundle.patch))
check('package declares client platform', Boolean(pkg.dsh && pkg.dsh.client && pkg.dsh.client.platform === 'web'))
for (const file of pkg.files) {
  if (file.includes('*')) continue
  check('packaged file exists: ' + file, fs.existsSync(path.join(root, file)))
}
for (const localeFile of ['locale/zh.json', 'locale/en.json']) {
  const parsed = JSON.parse(fs.readFileSync(path.join(root, localeFile), 'utf8'))
  check(localeFile + ' has meta.title', Boolean(parsed.meta && parsed.meta.title))
  check(localeFile + ' has meta.description', Boolean(parsed.meta && parsed.meta.description))
  check(localeFile + ' has meta.detail', Boolean(parsed.meta && parsed.meta.detail))
}
const iconPath = path.join(root, 'icon.svg')
if (fs.existsSync(iconPath)) {
  const icon = fs.readFileSync(iconPath, 'utf8')
  check('icon is SVG', icon.includes('<svg'))
  check('icon has no scripts', !/<script/i.test(icon))
  check('icon has no foreignObject', !/foreignObject/i.test(icon))
  check('icon size under 256 KiB', fs.statSync(iconPath).size < 256 * 1024)
}

/* ------------------------------------------------------------------ *
 * Summary
 * ------------------------------------------------------------------ */
console.log()
if (failures === 0) {
  console.log('All ' + checks + ' checks passed.')
  console.log('Dataset: '
    + characters.length + ' characters, '
    + faces(characters, 'relations') + ' relations, '
    + places.length + ' places, '
    + artifacts.length + ' artifacts, '
    + events.length + ' events, '
    + quotes.length + ' quotes, '
    + glossary.length + ' glossary terms.')
  console.log('Playable: '
    + avatars.length + ' avatars, '
    + totalScenes + ' scenes, '
    + totalChoices + ' choices.')
  process.exit(0)
} else {
  console.log(failures + ' of ' + checks + ' checks FAILED.')
  process.exit(1)
}

function faces(rows, field) {
  return rows.reduce((n, row) => n + (row[field] || []).length, 0)
}
