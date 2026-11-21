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
 * `avatar-tab.js` must contain exactly one exported builder whose body runs to
 * the file's final closing brace; everything between is the generated block.
 */
function buildExpectedBlock(tabCode) {
  const BEGIN = '/* --- avatar-tab:begin (generated from avatar-tab.js — do not edit here) --- */'
  const END = '/* --- avatar-tab:end --- */'
  const header = 'export function buildAvatarTab({ h, React, t, paths }) {'

  const headerAt = tabCode.indexOf(header)
  if (headerAt === -1) return null

  const lastBrace = tabCode.lastIndexOf('\n}')
  if (lastBrace === -1 || lastBrace < headerAt) return null

  const body = tabCode.slice(headerAt + header.length, lastBrace).replace(/^\s*\n/, '')
  return [
    BEGIN,
    '    const buildAvatarTab = ({ h, React, t, paths }) => {',
    body.replace(/\n+$/, ''),
    '    }',
    '    ' + END,
  ].join('\n')
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
