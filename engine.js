/**
 * Middle-earth Atlas — pure query & graph engine.
 *
 * No I/O: the Host routes and the agent tools both call into this module, so
 * the browser view and the conversational answers share one source of truth.
 */

import {
  WORKS, WORK_BY_ID, FACTIONS, FACTIONS_BY_ID, CHARACTERS, CHARACTER_BY_ID,
  EVENTS, PATHS, DIFFERENCES, RELATION_TYPES,
} from './data.js'
import {
  PLACES, PLACE_BY_ID, ARTIFACTS, ARTIFACT_BY_ID, GLOSSARY, QUOTES, PLOT, JOURNEYS,
} from './lore.js'
import { AVATARS, AVATAR_BY_ID, TONE_LABELS } from './journey.js'
import { normalizeTier, maskRecord, maskList, TIER_LABELS, RECORD_TIER, MAX_TIER } from './spoiler.js'

const norm = (s) => String(s == null ? '' : s).trim().toLowerCase()

/** Build a lookup of every searchable entity with its kind. */
function entityIndex() {
  const rows = []
  for (const c of CHARACTERS) {
    rows.push({
      kind: 'character', id: c.id, name: c.name, nameEn: c.nameEn,
      hay: [c.name, c.nameEn, ...(c.alias || []), c.factionLabel, c.kind, c.canon, c.summary, c.details, ...(c.tags || [])].join(' '),
    })
  }
  for (const p of PLACES) {
    rows.push({
      kind: 'place', id: p.id, name: p.name, nameEn: p.nameEn,
      hay: [p.name, p.nameEn, p.region, p.type, p.canon, p.summary, p.desc].join(' '),
    })
  }
  for (const a of ARTIFACTS) {
    rows.push({
      kind: 'artifact', id: a.id, name: a.name, nameEn: a.nameEn,
      hay: [a.name, a.nameEn, a.type, a.canon, a.summary, a.desc].join(' '),
    })
  }
  for (const g of GLOSSARY) {
    rows.push({
      kind: 'glossary', id: g.id, name: g.term, nameEn: g.termEn,
      hay: [g.term, g.termEn, g.category, g.definition, g.detail].join(' '),
    })
  }
  for (const w of WORKS) {
    rows.push({
      kind: 'work', id: w.id, name: w.title, nameEn: w.titleEn,
      hay: [w.title, w.titleEn, String(w.year), w.author, w.canon, w.summary, w.tone].join(' '),
    })
  }
  return rows.map((r) => ({ ...r, hay: norm(r.hay) }))
}
const INDEX = entityIndex()

/* ------------------------------------------------------------------ *
 * Search
 * ------------------------------------------------------------------ */

/** Search characters by name, alias, faction, tag or summary. */
export function searchCharacters(query = '', options = {}) {
  const maxTier = normalizeTier(options.maxTier)
  const q = norm(query)
  let list = CHARACTERS
  if (options.faction) list = list.filter((c) => c.faction === options.faction)
  if (options.work) list = list.filter((c) => c.works && c.works[options.work])
  if (options.kind) list = list.filter((c) => c.kind === options.kind)
  if (q) {
    list = list.filter((c) => {
      const haystack = [c.name, c.nameEn, ...(c.alias || []), c.factionLabel, c.summary, c.details, ...(c.tags || [])].join(' ')
      return norm(haystack).includes(q)
    })
  }
  return maskList('character', list.map(toCard), maxTier)
}

function toCard(c) {
  return {
    id: c.id, name: c.name, nameEn: c.nameEn, alias: c.alias || [],
    faction: c.faction, factionLabel: c.factionLabel, kind: c.kind,
    canon: c.canon, summary: c.summary, fate: c.fate, tags: c.tags || [],
    // Work ids travel with the card so the browser can filter by work without
    // a second round trip.
    works: c.works || {},
  }
}

/**
 * Universal search across characters, places, artifacts, glossary and works.
 * Returns grouped results so the UI can show one list with kind badges.
 */
export function searchAll(query = '', options = {}) {
  const maxTier = normalizeTier(options.maxTier)
  const q = norm(query)
  if (!q) return { groups: [], total: 0 }
  const hits = INDEX.filter((r) => r.hay.includes(q))
  const byKind = {}
  for (const hit of hits) {
    const described = describe(kindOf(hit.kind), hit.id)
    if (!described) continue
    // Map the internal kind name onto the gating vocabulary.
    const gateKind = hit.kind === 'character' ? 'character'
      : hit.kind === 'place' ? 'place'
        : hit.kind === 'artifact' ? 'artifact'
          : hit.kind === 'glossary' ? 'glossary' : null
    const payload = gateKind ? maskRecord(gateKind, described, maxTier) : described
    byKind[hit.kind] = byKind[hit.kind] || []
    byKind[hit.kind].push(payload)
  }
  const order = ['character', 'place', 'artifact', 'glossary', 'work']
  const labels = { character: '人物', place: '地点', artifact: '物品', glossary: '术语', work: '作品' }
  const groups = order.filter((k) => byKind[k]).map((k) => ({ kind: k, label: labels[k], items: byKind[k] }))
  return { groups, total: hits.length }
}

function kindOf(kind) {
  return kind
}

function describe(kind, id) {
  if (kind === 'character') { const c = CHARACTER_BY_ID[id]; return c ? toCard(c) : null }
  if (kind === 'place') {
    const p = PLACE_BY_ID[id]
    return p ? { id: p.id, name: p.name, nameEn: p.nameEn, kind: '地点', type: p.type, summary: p.summary } : null
  }
  if (kind === 'artifact') {
    const a = ARTIFACT_BY_ID[id]
    return a ? { id: a.id, name: a.name, nameEn: a.nameEn, kind: '物品', type: a.type, summary: a.summary } : null
  }
  if (kind === 'glossary') {
    const g = GLOSSARY.find((x) => x.id === id)
    return g ? { id: g.id, name: g.term, nameEn: g.termEn, kind: '术语', type: g.category, summary: g.definition } : null
  }
  if (kind === 'work') {
    const w = WORK_BY_ID[id]
    return w ? { id: w.id, name: w.title, nameEn: w.titleEn, kind: w.kind, type: String(w.year), summary: w.summary } : null
  }
  return null
}

/* ------------------------------------------------------------------ *
 * Graph
 * ------------------------------------------------------------------ */

/** Adjacency over curated relations, both directions. */
function adjacency() {
  const adj = {}
  CHARACTERS.forEach((c) => { adj[c.id] = [] })
  CHARACTERS.forEach((c) => {
    for (const rel of c.relations || []) {
      if (!CHARACTER_BY_ID[rel.to]) continue
      if (!adj[c.id]) adj[c.id] = []
      if (!adj[rel.to]) adj[rel.to] = []
      adj[c.id].push({ to: rel.to, from: c.id, type: rel.type, label: rel.label })
      adj[rel.to].push({ to: c.id, from: rel.to, type: rel.type, label: rel.label })
    }
  })
  return adj
}

/**
 * Relationship graph. Only curated, explicit relations appear — no automatic
 * co-membership edges — so the picture stays readable and fact-checked.
 */
export function buildGraph(options = {}) {
  const focus = options.focus
  const ids = Array.isArray(options.ids) && options.ids.length
    ? new Set(options.ids.filter((id) => CHARACTER_BY_ID[id]))
    : null

  const allEdges = []
  const seen = new Set()
  for (const c of CHARACTERS) {
    for (const rel of c.relations || []) {
      if (!CHARACTER_BY_ID[rel.to]) continue
      const key = [c.id, rel.to].sort().join('::') + '::' + rel.type
      if (seen.has(key)) continue
      seen.add(key)
      allEdges.push({
        source: c.id, target: rel.to, type: rel.type,
        label: rel.label || (RELATION_TYPES[rel.type] && RELATION_TYPES[rel.type].label) || rel.type,
        color: RELATION_TYPES[rel.type] ? RELATION_TYPES[rel.type].color : '#888',
      })
    }
  }

  let edges = allEdges
  if (ids) edges = edges.filter((e) => ids.has(e.source) && ids.has(e.target))
  else if (focus && CHARACTER_BY_ID[focus]) edges = edges.filter((e) => e.source === focus || e.target === focus)

  // Optional faction narrowing, applied after focus/ids so it only trims.
  if (options.faction) {
    const allowed = new Set(CHARACTERS.filter((c) => c.faction === options.faction).map((c) => c.id))
    edges = edges.filter((e) => allowed.has(e.source) && allowed.has(e.target))
  }

  const used = new Set()
  edges.forEach((e) => { used.add(e.source); used.add(e.target) })
  if (!used.size && focus && CHARACTER_BY_ID[focus]) used.add(focus)

  const nodes = CHARACTERS.filter((c) => used.has(c.id)).map((c) => ({
    id: c.id, label: c.name, nameEn: c.nameEn, faction: c.faction,
    factionColor: FACTIONS_BY_ID[c.faction] ? FACTIONS_BY_ID[c.faction].color : '#888',
    kind: c.kind, canon: c.canon, summary: c.summary,
    degree: edges.filter((e) => e.source === c.id || e.target === c.id).length,
  }))

  return {
    nodes, edges,
    relationTypes: RELATION_TYPES,
    focus: focus || null,
    factions: FACTIONS,
    generatedAt: new Date().toISOString(),
  }
}

/** Neighbours of one character, grouped by relation type. */
export function neighbors(idOrName, options = {}) {
  const maxTier = normalizeTier(options.maxTier)
  const c = resolveCharacter(idOrName)
  if (!c) return null
  const groups = {}
  for (const rel of c.relations || []) {
    const other = CHARACTER_BY_ID[rel.to]
    if (!other) continue
    groups[rel.type] = groups[rel.type] || []
    groups[rel.type].push({
      id: other.id, name: other.name, nameEn: other.nameEn,
      label: rel.label, typeLabel: RELATION_TYPES[rel.type] ? RELATION_TYPES[rel.type].label : rel.type,
      color: RELATION_TYPES[rel.type] ? RELATION_TYPES[rel.type].color : '#888',
    })
  }
  return { character: maskRecord('character', toCard(c), maxTier), groups }
}

/* ------------------------------------------------------------------ *
 * Dossiers
 * ------------------------------------------------------------------ */

function resolveCharacter(idOrName) {
  const key = norm(idOrName)
  if (!key) return null
  return CHARACTER_BY_ID[key]
    || CHARACTERS.find((x) => norm(x.name) === key || norm(x.nameEn) === key)
    || CHARACTERS.find((x) => (x.alias || []).some((a) => norm(a) === key))
    || CHARACTERS.find((x) => norm(x.name).includes(key) || norm(x.nameEn).includes(key)
      || (x.alias || []).some((a) => norm(a).includes(key)))
    || null
}

/** One character's complete dossier, including places, artifacts and quotes. */
export function characterDetail(idOrName, options = {}) {
  const maxTier = normalizeTier(options.maxTier)
  const c = resolveCharacter(idOrName)
  if (!c) return null
  const relations = (c.relations || []).map((rel) => {
    const other = CHARACTER_BY_ID[rel.to]
    return {
      ...rel,
      name: other ? other.name : rel.to,
      nameEn: other ? other.nameEn : '',
      factionLabel: other ? other.factionLabel : '',
      typeLabel: RELATION_TYPES[rel.type] ? RELATION_TYPES[rel.type].label : rel.type,
      color: RELATION_TYPES[rel.type] ? RELATION_TYPES[rel.type].color : '#888',
    }
  })
  const works = Object.entries(c.works || {}).map(([id, role]) => ({
    id, role,
    title: WORK_BY_ID[id] ? WORK_BY_ID[id].title : id,
    canon: WORK_BY_ID[id] ? WORK_BY_ID[id].canon : '',
  }))
  const appearances = EVENTS.filter((e) => (e.characters || []).includes(c.id))
    .map((e) => ({ id: e.id, title: e.title, age: e.age, year: e.year, importance: e.importance }))
  const places = PLACES.filter((p) => (p.characters || []).includes(c.id))
    .map((p) => ({ id: p.id, name: p.name, type: p.type, summary: p.summary }))
  const artifacts = ARTIFACTS.filter((a) => (a.owners || []).includes(c.id))
    .map((a) => ({ id: a.id, name: a.name, type: a.type, summary: a.summary }))
  const quotes = QUOTES.filter((q) => q.speaker === c.id)
    .map((q) => ({ id: q.id, text: q.text, textEn: q.textEn, context: q.context, work: q.work }))
  const detail = { ...toCard(c), details: c.details, relations, works, appearances, places, artifacts, quotes }
  return maskRecord('character', detail, maxTier)
}

export function placeDetail(idOrName, options = {}) {
  const maxTier = normalizeTier(options.maxTier)
  const key = norm(idOrName)
  const p = PLACE_BY_ID[key] || PLACES.find((x) => norm(x.name) === key || norm(x.nameEn) === key)
    || PLACES.find((x) => norm(x.name).includes(key) || norm(x.nameEn).includes(key))
  if (!p) return null
  const detail = {
    ...p,
    characters: (p.characters || []).map((id) => CHARACTER_BY_ID[id] && toCard(CHARACTER_BY_ID[id])).filter(Boolean),
    workTitles: (p.works || []).map((id) => WORK_BY_ID[id] && WORK_BY_ID[id].title).filter(Boolean),
  }
  return maskRecord('place', detail, maxTier)
}

export function artifactDetail(idOrName, options = {}) {
  const maxTier = normalizeTier(options.maxTier)
  const key = norm(idOrName)
  const a = ARTIFACT_BY_ID[key] || ARTIFACTS.find((x) => norm(x.name) === key || norm(x.nameEn) === key)
    || ARTIFACTS.find((x) => norm(x.name).includes(key) || norm(x.nameEn).includes(key))
  if (!a) return null
  const detail = {
    ...a,
    owners: (a.owners || []).map((id) => CHARACTER_BY_ID[id] && toCard(CHARACTER_BY_ID[id])).filter(Boolean),
    workTitles: (a.works || []).map((id) => WORK_BY_ID[id] && WORK_BY_ID[id].title).filter(Boolean),
  }
  return maskRecord('artifact', detail, maxTier)
}

export function glossaryDetail(idOrName, options = {}) {
  const maxTier = normalizeTier(options.maxTier)
  const key = norm(idOrName)
  const g = GLOSSARY.find((x) => x.id === key || norm(x.term) === key || norm(x.termEn) === key
    || norm(x.term).includes(key) || norm(x.termEn).includes(key))
  if (!g) return null
  const detail = {
    ...g,
    related: (g.related || []).map((id) => CHARACTER_BY_ID[id] && toCard(CHARACTER_BY_ID[id])).filter(Boolean),
  }
  return maskRecord('glossary', detail, maxTier)
}

/* ------------------------------------------------------------------ *
 * Relation path
 * ------------------------------------------------------------------ */

function edgeLabelBetween(a, b, adj) {
  const from = CHARACTER_BY_ID[a]
  const rel = (from.relations || []).find((r) => r.to === b)
  if (rel) return rel.label
  const to = CHARACTER_BY_ID[b]
  const rev = (to.relations || []).find((r) => r.to === a)
  return rev ? rev.label : '关联'
}

/** Shortest relation path between two characters (BFS over explicit edges). */
export function relationPath(from, to) {
  const start = resolveCharacter(from)
  const end = resolveCharacter(to)
  if (!start || !end) {
    return { ok: false, error: '角色不存在：' + (!start ? String(from) : String(to)), from, to }
  }
  if (start.id === end.id) return { ok: true, path: [start.id], hops: 0, steps: [], people: [toCard(start)] }

  const adj = adjacency()
  const queue = [[start.id]]
  const visited = new Set([start.id])
  while (queue.length) {
    const path = queue.shift()
    const last = path[path.length - 1]
    for (const edge of adj[last] || []) {
      if (visited.has(edge.to)) continue
      visited.add(edge.to)
      const next = [...path, edge.to]
      if (edge.to === end.id) {
        const steps = []
        for (let i = 0; i < next.length - 1; i++) {
          const a = CHARACTER_BY_ID[next[i]]
          const b = CHARACTER_BY_ID[next[i + 1]]
          steps.push({ from: a.name, to: b.name, fromId: a.id, toId: b.id, label: edgeLabelBetween(a.id, b.id, adj) })
        }
        return {
          ok: true, path: next, hops: next.length - 1, steps,
          people: next.map((id) => toCard(CHARACTER_BY_ID[id])),
        }
      }
      queue.push(next)
    }
  }
  return { ok: false, error: '两者之间没有已收录的关系路径', from: start.name, to: end.name }
}

/* ------------------------------------------------------------------ *
 * Timeline / plot / journeys
 * ------------------------------------------------------------------ */

export function timeline(options = {}) {
  let events = EVENTS
  if (options.work) events = events.filter((e) => (e.works || []).includes(options.work))
  if (options.character) {
    const c = resolveCharacter(options.character)
    events = c ? events.filter((e) => (e.characters || []).includes(c.id)) : []
  }
  if (options.age) events = events.filter((e) => e.age === options.age)
  const maxTier = normalizeTier(options.maxTier)
  const enriched = events.map((e) => maskRecord('event', {
    ...e,
    characterNames: (e.characters || []).map((id) => CHARACTER_BY_ID[id] && CHARACTER_BY_ID[id].name).filter(Boolean),
    workTitles: (e.works || []).map((id) => WORK_BY_ID[id] && WORK_BY_ID[id].title).filter(Boolean),
  }, maxTier))
  return {
    events: enriched,
    ages: [...new Set(EVENTS.map((e) => e.age))],
    counts: {
      total: EVENTS.length,
      byAge: [...new Set(EVENTS.map((e) => e.age))].map((age) => ({ age, n: EVENTS.filter((e) => e.age === age).length })),
    },
    generatedAt: new Date().toISOString(),
  }
}

export function plot(options = {}) {
  const list = options.work ? PLOT.filter((p) => p.work === options.work) : PLOT
  return list.map((p) => ({
    ...p,
    workTitle: WORK_BY_ID[p.work] ? WORK_BY_ID[p.work].title : p.work,
    beats: p.beats.map((b) => ({
      ...b,
      event: b.event && EVENTS.find((e) => e.id === b.event) ? EVENTS.find((e) => e.id === b.event) : null,
    })),
  }))
}

export function journeys(options = {}) {
  let list = JOURNEYS
  if (options.work) list = list.filter((j) => (j.works || []).includes(options.work))
  return list.map((j) => ({
    ...j,
    workTitles: (j.works || []).map((id) => WORK_BY_ID[id] && WORK_BY_ID[id].title).filter(Boolean),
  }))
}

/* ------------------------------------------------------------------ *
 * Avatar journeys — play as a character, then see what the book did
 * ------------------------------------------------------------------ */

/**
 * List the playable avatars, honouring a spoiler ceiling.
 * `maxTier` filters scenes; an avatar with no scenes at or below the ceiling
 * is omitted rather than shown empty.
 */
export function avatarList(options = {}) {
  const maxTier = Number(options.maxTier) || 3
  const list = []
  for (const avatar of AVATARS) {
    const scenes = avatar.scenes.filter((s) => (s.tier || 3) <= maxTier)
    if (!scenes.length) continue
    const character = CHARACTER_BY_ID[avatar.character]
    list.push({
      id: avatar.id,
      character: avatar.character,
      name: character ? character.name : avatar.character,
      nameEn: character ? character.nameEn : '',
      faction: character ? character.faction : '',
      factionLabel: character ? character.factionLabel : '',
      tagline: avatar.tagline,
      opening: avatar.opening,
      theme: avatar.theme,
      difficulty: avatar.difficulty,
      voice: avatar.voice || '',
      sceneCount: scenes.length,
      totalScenes: avatar.scenes.length,
    })
  }
  return list
}

/**
 * One avatar's full journey, filtered to a spoiler ceiling.
 * The response is self-contained so the browser can play it without extra
 * round trips; scene details never leak beyond the requested tier.
 */
export function avatarJourney(idOrName, options = {}) {
  const maxTier = Number(options.maxTier) || 3
  const key = norm(idOrName)
  const avatar = AVATAR_BY_ID[key]
    || AVATARS.find((a) => norm(a.id) === key
      || norm(CHARACTER_BY_ID[a.character] && CHARACTER_BY_ID[a.character].name) === key
      || norm(a.character) === key)
    || AVATARS.find((a) => {
      const c = CHARACTER_BY_ID[a.character]
      return c && (norm(c.name).includes(key) || norm(c.nameEn).includes(key))
    })
  if (!avatar) return null

  const character = CHARACTER_BY_ID[avatar.character]
  const scenes = avatar.scenes
    .filter((s) => (s.tier || 3) <= maxTier)
    .map((scene) => {
      const event = scene.event ? EVENTS.find((e) => e.id === scene.event) : null
      const place = scene.place ? PLACE_BY_ID[scene.place] : null
      return {
        id: scene.id,
        title: scene.title,
        tier: scene.tier || 3,
        narration: scene.narration,
        stakes: scene.stakes,
        atmosphere: scene.atmosphere || null,
        event: event ? { id: event.id, title: event.title, age: event.age, year: event.year, desc: event.desc } : null,
        place: place ? { id: place.id, name: place.name, region: place.region, type: place.type } : null,
        choices: scene.choices.map((c, index) => ({
          index,
          label: c.label,
          tone: c.tone,
          toneLabel: TONE_LABELS[c.tone] || c.tone,
          canon: Boolean(c.canon),
          result: c.result,
          note: c.note || '',
        })),
      }
    })

  return {
    id: avatar.id,
    character: avatar.character,
    name: character ? character.name : avatar.character,
    nameEn: character ? character.nameEn : '',
    faction: character ? character.faction : '',
    factionLabel: character ? character.factionLabel : '',
    summary: character ? character.summary : '',
    fate: character ? character.fate : '',
    tagline: avatar.tagline,
    opening: avatar.opening,
    theme: avatar.theme,
    difficulty: avatar.difficulty,
    voice: avatar.voice || '',
    maxTier,
    scenes,
    totalScenes: avatar.scenes.length,
    hiddenScenes: avatar.scenes.length - scenes.length,
    toneLabels: TONE_LABELS,
  }
}

/**
 * Score a completed journey from the choices the player made.
 * Deterministic and explanatory: it names how much of the path followed the
 * book, and which moments diverged.
 */
export function judgeJourney(idOrName, choices = []) {
  const journey = avatarJourney(idOrName, { maxTier: 3 })
  if (!journey) return null

  const picked = new Map()
  if (Array.isArray(choices)) {
    for (const entry of choices) {
      if (!entry || typeof entry !== 'object') continue
      const sceneId = String(entry.scene || entry.sceneId || '')
      const choiceIndex = Number(entry.choice)
      if (!sceneId || !Number.isInteger(choiceIndex)) continue
      picked.set(sceneId, choiceIndex)
    }
  }

  const decisions = []
  let canonCount = 0
  for (const scene of journey.scenes) {
    const choiceIndex = picked.has(scene.id) ? picked.get(scene.id) : null
    const choice = choiceIndex === null ? null : scene.choices[choiceIndex] || null
    const canonChoice = scene.choices.find((c) => c.canon) || null
    if (choice && choice.canon) canonCount++
    decisions.push({
      sceneId: scene.id,
      sceneTitle: scene.title,
      tier: scene.tier,
      chosen: choice ? { label: choice.label, toneLabel: choice.toneLabel, canon: choice.canon } : null,
      canonChoice: canonChoice ? { label: canonChoice.label, note: canonChoice.note } : null,
      followedBook: Boolean(choice && choice.canon),
    })
  }

  const answered = decisions.filter((d) => d.chosen).length
  const total = decisions.length
  const ratio = total ? canonCount / total : 0

  let verdict
  if (answered < total) verdict = '未完成'
  else if (ratio === 1) verdict = '与原著完全一致'
  else if (ratio >= 0.6) verdict = '大体忠于原著'
  else if (ratio > 0) verdict = '走向了另一条路'
  else verdict = '完全偏离原著'

  const diverged = decisions.filter((d) => d.chosen && !d.chosen.canon)

  return {
    avatar: journey.id,
    name: journey.name,
    answered,
    total,
    canonCount,
    ratio: Number(ratio.toFixed(2)),
    verdict,
    decisions,
    diverged,
    summary: answered === 0
      ? '还没有做出任何选择。'
      : `在 ${total} 个抉择中，你有 ${canonCount} 次与原著一致，${diverged.length} 次走向了别的方向。`,
  }
}

/* ------------------------------------------------------------------ *
 * Aggregate views
 * ------------------------------------------------------------------ */

/**
 * Everything the browser page needs on first load.
 *
 * Takes a spoiler ceiling, and applies it on the server: the client must never
 * receive content it is supposed to hide. Hiding in the browser would leave the
 * full text one DevTools request away.
 */
export function bundle(options = {}) {
  const maxTier = normalizeTier(options.maxTier)
  return {
    works: WORKS,
    factions: FACTIONS,
    characters: maskList('character', CHARACTERS.map(toCard), maxTier),
    events: maskList('event', EVENTS.map((e) => ({ ...e })), maxTier),
    maxTier,
    paths: PATHS,
    differences: DIFFERENCES,
    relationTypes: RELATION_TYPES,
    places: PLACES.map((p) => ({
      id: p.id, name: p.name, nameEn: p.nameEn, region: p.region, type: p.type,
      canon: p.canon, summary: p.summary,
    })),
    artifacts: ARTIFACTS.map((a) => ({
      id: a.id, name: a.name, nameEn: a.nameEn, type: a.type, canon: a.canon, summary: a.summary,
    })),
    glossary: GLOSSARY.map((g) => ({
      id: g.id, term: g.term, termEn: g.termEn, category: g.category, definition: g.definition,
    })),
    quotes: QUOTES,
    plot: plot(),
    journeys: journeys(),
    avatars: avatarList(),
    counts: counts(),
    generatedAt: new Date().toISOString(),
  }
}

export function counts() {
  const relationCount = CHARACTERS.reduce((n, c) => n + (c.relations || []).length, 0)
  const factionCount = {}
  for (const c of CHARACTERS) factionCount[c.faction] = (factionCount[c.faction] || 0) + 1
  const canonCount = { 原著: 0, 电影: 0, 剧集: 0 }
  for (const c of CHARACTERS) {
    if (/剧集/.test(c.canon)) canonCount.剧集++
    else if (/电影/.test(c.canon)) canonCount.电影++
    else canonCount.原著++
  }
  return {
    works: WORKS.length,
    characters: CHARACTERS.length,
    factions: FACTIONS.length,
    events: EVENTS.length,
    relations: relationCount,
    places: PLACES.length,
    artifacts: ARTIFACTS.length,
    glossary: GLOSSARY.length,
    quotes: QUOTES.length,
    journeys: JOURNEYS.length,
    avatars: AVATARS.length,
    avatarScenes: AVATARS.reduce((n, a) => n + a.scenes.length, 0),
    avatarChoices: AVATARS.reduce((n, a) => n + a.scenes.reduce((m, s) => m + s.choices.length, 0), 0),
    byFaction: FACTIONS.map((f) => ({ id: f.id, name: f.name, n: factionCount[f.id] || 0, color: f.color })),
    byCanon: canonCount,
    byAge: [...new Set(EVENTS.map((e) => e.age))].map((age) => ({ age, n: EVENTS.filter((e) => e.age === age).length })),
  }
}

/* ------------------------------------------------------------------ *
 * Question answering
 * ------------------------------------------------------------------ */

const STOP = /[?？。，,、；;：:！!“”"'（）()\s的了吗呢吧啊是在和与跟到至]/g

/** Split a question into candidate keywords. */
function keywords(question) {
  const raw = String(question || '')
  const stripped = raw.replace(STOP, ' ').split(/\s+/).filter((w) => w.length >= 2)
  return stripped.length ? stripped : [raw.replace(STOP, '').trim()].filter(Boolean)
}

/** Run the entity index against a question and score matches. */
function matchEntities(question, limit = 5) {
  const raw = String(question || '')
  const q = norm(raw)
  const kws = keywords(question)
  const scored = []
  for (const row of INDEX) {
    let score = 0
    // An exact mention of the row's own name is decisive, so answer about the
    // entity the user actually named rather than something that merely
    // mentions it in its description.
    const name = norm(row.name)
    const nameEn = norm(row.nameEn)
    if (name && q.includes(name)) score = 1000 + name.length
    else if (nameEn && q.includes(nameEn)) score = 900 + nameEn.length
    else {
      let hits = 0
      for (const k of kws) if (row.hay.includes(norm(k))) hits++
      if (hits) score = hits * 3
    }
    if (score) scored.push({ row, score })
  }
  scored.sort((a, b) => b.score - a.score || a.row.kind.localeCompare(b.row.kind))
  return scored.slice(0, limit)
}

/**
 * Answer a free-form question from the curated data.
 * Deliberately deterministic and transparent: it says what it matched and
 * points to the panel rather than inventing prose it cannot support.
 */
export function ask(question, options = {}) {
  const maxTier = normalizeTier(options.maxTier)
  const raw = String(question == null ? '' : question).trim()
  if (!raw) return '问点什么吧：角色关系、地名、宝物、时间线或改编差异都可以。'
  const q = norm(raw)
  const out = []

  // 1) Relationship path: "A 和 B 是什么关系"
  const pairMatch = raw.match(/(.+?)\s*(?:和|与|跟|同|到|至|between|and)\s*(.+)/i)
  if (pairMatch && /关系|联系|关联|path|connect|relation|怎么联系/.test(q)) {
    const a = pairMatch[1].trim().replace(/^.*(?:问|查|看看)/, '')
    const b = pairMatch[2].trim().replace(/(?:是什么关系|什么关系|有什么关系|的关系|怎么联系|怎么关联|关系|呢|吗|[?？])/g, '')
    const result = relationPath(a, b)
    if (result.ok) {
      out.push('**' + result.people[0].name + ' → ' + result.people[result.people.length - 1].name + '：相距 ' + result.hops + ' 跳**')
      result.steps.forEach((s, i) => out.push((i + 1) + '. ' + s.from + ' —[' + s.label + ']→ ' + s.to))
      return out.join('\n')
    }
    if (result.error) return '没能连起来：' + result.error + '。试试用全名，或者到「关系图谱」里直接点选。'
  }

  // 2) Explicit "who is X" / "X 是谁"
  if (/谁|介绍|是谁|什么人|什么来历|who/.test(q)) {
    const hits = matchEntities(raw, 4)
    const best = hits.find((h) => h.row.kind === 'character')
    if (best) {
      const d = characterDetail(best.row.id, { maxTier })
      out.push('**' + d.name + (d.nameEn ? '（' + d.nameEn + '）' : '') + ' · ' + d.factionLabel + ' · ' + d.kind + '**')
      out.push('来源：' + d.canon)
      out.push('')
      out.push(d.summary)
      if (d.details) out.push(d.details)
      if (d.fate) out.push('结局：' + d.fate)
      // A gated dossier may have had `relations` removed; absence means empty.
      const rels = Array.isArray(d.relations) ? d.relations : []
      if (rels.length) {
        out.push('')
        out.push('**主要关系：** ' + rels.map((r) => r.label + '=' + r.name).join('；'))
      }
      return out.join('\n')
    }
  }

  // 3) Place / artifact / glossary direct questions.
  if (/哪里|在哪|地点|场景|where/.test(q)) {
    const hit = matchEntities(raw, 3).find((h) => h.row.kind === 'place')
    if (hit) {
      const p = placeDetail(hit.row.id)
      out.push('**' + p.name + '（' + p.nameEn + '）· ' + p.region + ' · ' + p.type + '**')
      out.push(p.summary)
      out.push(p.desc)
      if (p.characters.length) out.push('相关人物：' + p.characters.map((c) => c.name).join('、'))
      return out.join('\n')
    }
  }
  if (/宝物|物品|武器|戒指|神器|artifact|什么剑/.test(q)) {
    const hit = matchEntities(raw, 3).find((h) => h.row.kind === 'artifact')
    if (hit) {
      const a = artifactDetail(hit.row.id)
      out.push('**' + a.name + '（' + a.nameEn + '）· ' + a.type + '**')
      out.push(a.summary)
      out.push(a.desc)
      if (a.owners.length) out.push('经手人物：' + a.owners.map((c) => c.name).join(' → '))
      return out.join('\n')
    }
  }
  if (/是什么|什么意思|术语|概念|什么是/.test(q)) {
    const hit = matchEntities(raw, 3).find((h) => h.row.kind === 'glossary')
    if (hit) {
      const g = glossaryDetail(hit.row.id)
      out.push('**' + g.term + '（' + g.termEn + '）· ' + g.category + '**')
      out.push(g.definition)
      out.push(g.detail)
      return out.join('\n')
    }
  }

  // 3b) A bare entity name with no question verb: give its card.
  const bare = matchEntities(raw, 3)
  if (bare.length && bare[0].score >= 900) {
    const top = bare[0].row
    if (top.kind === 'artifact') {
      const a = artifactDetail(top.id, { maxTier })
      out.push('**' + a.name + '（' + a.nameEn + '）· ' + a.type + ' · ' + a.canon + '**')
      out.push(a.summary)
      out.push(a.desc)
      if (a.owners.length) out.push('经手人物：' + a.owners.map((c) => c.name).join(' → '))
      return out.join('\n')
    }
    if (top.kind === 'place') {
      const p = placeDetail(top.id, { maxTier })
      out.push('**' + p.name + '（' + p.nameEn + '）· ' + p.region + ' · ' + p.type + '**')
      out.push(p.summary)
      out.push(p.desc)
      if (p.characters.length) out.push('相关人物：' + p.characters.map((c) => c.name).join('、'))
      return out.join('\n')
    }
    if (top.kind === 'glossary') {
      const g = glossaryDetail(top.id, { maxTier })
      out.push('**' + g.term + '（' + g.termEn + '）· ' + g.category + '**')
      out.push(g.definition)
      out.push(g.detail)
      return out.join('\n')
    }
    if (top.kind === 'work') {
      const w = WORK_BY_ID[top.id]
      out.push('**' + w.title + '（' + w.titleEn + '，' + w.year + '）**')
      out.push(w.author + ' · ' + w.canon)
      out.push(w.summary)
      return out.join('\n')
    }
    if (top.kind === 'character') {
      const d = characterDetail(top.id, { maxTier })
      out.push('**' + d.name + (d.nameEn ? '（' + d.nameEn + '）' : '') + ' · ' + d.factionLabel + ' · ' + d.kind + '**')
      out.push('来源：' + d.canon)
      out.push('')
      out.push(d.summary)
      if (d.details) out.push(d.details)
      if (d.fate) out.push('结局：' + d.fate)
      // A gated dossier may have had `relations` removed; absence means empty.
      const rels = Array.isArray(d.relations) ? d.relations : []
      if (rels.length) {
        out.push('')
        out.push('**主要关系：** ' + rels.map((r) => r.label + '=' + r.name).join('；'))
      }
      return out.join('\n')
    }
  }

  // 4) Timeline / plot questions.
  const matchedEvents = matchEntities(raw, 30).filter((h) => h.row.kind === 'character')
  if (/什么时候|时间线|哪一年|何时|timeline|经过/.test(q)) {
    const events = EVENTS.filter((e) => {
      const hay = norm([e.title, e.desc, e.year, e.age, ...(e.characters || []).map((id) => CHARACTER_BY_ID[id] ? CHARACTER_BY_ID[id].name : '')].join(' '))
      return keywords(raw).some((k) => hay.includes(norm(k)))
    })
    if (events.length) {
      out.push('**相关时间线事件：**')
      events.slice(0, 8).forEach((e) => out.push('- ' + e.age + ' · ' + e.year + ' · **' + e.title + '**：' + e.desc))
      return out.join('\n')
    }
  }

  // 5) Plot questions: "魔戒是怎么被毁掉的".
  const kw = keywords(raw)
  const plotBeats = []
  for (const p of PLOT) {
    for (const b of p.beats) {
      const hay = norm(b.title + ' ' + b.desc)
      if (kw.some((k) => hay.includes(norm(k)))) plotBeats.push({ plot: p, beat: b })
    }
  }
  if (plotBeats.length && /剧情|故事|经过|怎么|如何|结局|plot/.test(q)) {
    out.push('**相关剧情节点：**')
    plotBeats.slice(0, 6).forEach(({ plot, beat }) => out.push('- 【' + plot.name + '】' + beat.title + '：' + beat.desc))
    return out.join('\n')
  }

  // 6) Fall back to whatever entities matched.
  const hits = matchEntities(raw, 6)
  if (hits.length) {
    out.push('**与问题相关的内容：**')
    for (const h of hits) {
      const d = describe(h.row.kind, h.row.id)
      if (!d) continue
      out.push('- [' + d.kind + '] ' + d.name + '：' + d.summary)
    }
    out.push('')
    out.push('想更深入的话，可以直接说「XXX 是谁」或「A 和 B 是什么关系」。')
    return out.join('\n')
  }

  // 7) Nothing matched.
  return [
    '我在这套资料里没找到足够对应的内容。',
    '',
    '可以试试这些问法：',
    '- 「弗罗多是谁」',
    '- 「阿拉贡和凯兰崔尔怎么联系」',
    '- 「末日火山在哪里」',
    '- 「至尊魔戒」',
    '- 「魔戒是怎么被毁掉的」',
  ].join('\n')
}

/** Suggestion chips for the ask box. */
export function suggestions() {
  return [
    '弗罗多是谁',
    '阿拉贡和凯兰崔尔怎么联系',
    '至尊魔戒',
    '末日火山在哪里',
    '魔戒是怎么被毁掉的',
    '什么是迈雅',
    '索伦是谁',
    '精灵三戒',
  ]
}
