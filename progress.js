/**
 * Reading progress and character journeys.
 *
 * Modelled on three-body-atlas's pathGuide / characterJourney, but using this
 * plugin's richer spoiler gate. The key ideas borrowed:
 *   - cast is looked up from c.works[workId], never hand-listed
 *   - a scene's importance is inferred by matching the name in title/desc
 *     (focus / named / present) instead of adding a new annotation
 *
 * Nothing here creates a second reading-progress setting: callers pass the
 * same tier the panel already uses.
 */

import {
  WORKS, WORK_BY_ID, CHARACTERS, CHARACTER_BY_ID,
  EVENTS, FACTIONS_BY_ID,
} from './data.js'
import { normalizeTier, RECORD_TIER } from './spoiler.js'

const norm = (v) => String(v == null ? '' : v).trim().toLowerCase()

/** Reading order of原著. Film/TV are grouped with the book they follow. */
const READING_ORDER = ['hobbit-book', 'lotr-book', 'silmarillion']

/**
 * Which works does a reader at this tier have "covered"?
 * Tier 1 → The Hobbit, tier 2 → + LOTR, tier 3 → everything.
 */
function coveredWorks(cap) {
  if (cap >= 3) return READING_ORDER
  if (cap === 2) return ['hobbit-book', 'lotr-book']
  return ['hobbit-book']
}

/**
 * "Reading this far, whom have you met?"
 * Cast is derived from `c.works[workId]`, exactly as three-body does it.
 */
export function readingProgress(maxTier) {
  const cap = normalizeTier(maxTier)
  const covered = coveredWorks(cap)

  return {
    maxTier: cap,
    coveredWorks: covered,
    works: READING_ORDER.map((workId, index) => {
      const work = WORK_BY_ID[workId]
      const cast = CHARACTERS
        .filter((c) => (c.works || {})[workId])
        .map((c) => ({
          id: c.id,
          name: c.name,
          role: c.works[workId],
          relations: (c.relations || []).length,
        }))
        // The most connected characters are the ones a reader meets first.
        .sort((a, b) => b.relations - a.relations || a.name.localeCompare(b.name))

      const events = EVENTS.filter((e) => (e.works || []).includes(workId))
      // Locked works keep only counts: their event titles are the spoilers
      // the tier system exists to hide (RECORD_TIER gates several of them).
      const locked = !covered.includes(workId)
      // A visible work still hides individual gated events: titles like
      // 「伊西铎之死与魔戒失落」(RECORD_TIER 3) must not show at tier 2.
      const eventTitles = locked
        ? []
        : events
          .filter((e) => {
            const recordCap = RECORD_TIER[e.id]
            return !(typeof recordCap === 'number' && recordCap > cap)
          })
          .slice(0, 5)
          .map((e) => e.title)
      return {
        index: index + 1,
        work: workId,
        title: work ? work.title : workId,
        kind: work ? work.kind : '',
        canon: work ? work.canon : '',
        tier: workId === 'silmarillion' ? 3 : workId === 'lotr-book' ? 2 : 1,
        locked,
        castCount: cast.length,
        cast: locked ? [] : cast.slice(0, 8),
        eventCount: events.length,
        eventTitles,
      }
    }),
    totalWorks: READING_ORDER.length,
  }
}

/** Infer how strongly a character drives a scene, from the text itself. */
function sceneRole(title, desc, character) {
  const names = [character.name, character.nameEn, ...(character.alias || [])]
    .filter((n) => n && n.length >= 2)
    .map(norm)
  const head = norm(title || '')
  const body = norm(desc || '')
  if (names.some((n) => head.includes(n))) return 'focus'
  if (names.some((n) => body.includes(n))) return 'named'
  return 'present'
}

/**
 * Everything one character lives through, in chronological order.
 *
 * Above the cap, events are locked rather than dropped: the reader can see
 * that something happens later without being told what it is.
 */
export function characterJourney(idOrName, maxTier) {
  const key = norm(idOrName)
  const c = CHARACTER_BY_ID[key]
    || CHARACTERS.find((x) => norm(x.name) === key || norm(x.nameEn) === key
      || (x.alias || []).some((a) => norm(a) === key))
    || CHARACTERS.find((x) => norm(x.name).includes(key) || norm(x.nameEn).includes(key))
  if (!c) return null

  const cap = normalizeTier(maxTier)
  const relevant = EVENTS
    .filter((e) => (e.characters || []).includes(c.id))
    .slice()
    .sort((a, b) => (a.order || 999) - (b.order || 999))

  const beats = relevant.map((e) => {
    // Same field-whitelist semantics as the dossier layer: a field is visible
    // when the reader's ceiling reaches the tier the FIELD_SAFETY whitelist
    // assigns it (event title/desc are tier 3). A record whose RECORD_TIER
    // override is lower unlocks early; events without an override need tier 3.
    const recordCap = typeof RECORD_TIER[e.id] === 'number' ? RECORD_TIER[e.id] : 3
    const locked = recordCap > cap
    const showText = cap >= 3 && !locked
    // Text matching alone would label almost every event 'present', because
    // many Chinese event titles name the outcome rather than the people. Use
    // the curated characters[] position as a second signal: the first listed
    // character is normally the one the event is about.
    const listedAt = (e.characters || []).indexOf(c.id)
    const textualRole = sceneRole(e.title, e.desc, c)
    const role = textualRole === 'present' && listedAt === 0 ? 'focus'
      : textualRole === 'present' && listedAt > 0 ? 'named'
        : textualRole
    return {
      id: e.id,
      order: e.order,
      age: e.age,
      year: e.year,
      tier: recordCap,
      locked,
      role,
      title: showText ? e.title : null,
      description: showText ? e.desc : null,
      people: showText ? (e.characters || [])
        .map((pid) => CHARACTER_BY_ID[pid] && CHARACTER_BY_ID[pid].name)
        .filter(Boolean) : [],
      works: showText ? (e.works || [])
        .map((wid) => WORK_BY_ID[wid] && WORK_BY_ID[wid].title).filter(Boolean) : [],
    }
  })

  const unlocked = beats.filter((b) => !b.locked)
  return {
    id: c.id,
    name: c.name,
    nameEn: c.nameEn,
    faction: c.faction,
    factionLabel: c.factionLabel,
    total: beats.length,
    visible: unlocked.length,
    locked: beats.length - unlocked.length,
    maxTier: cap,
    beats,
    firstAppearance: unlocked.length ? unlocked[0] : null,
  }
}

/** Short human-readable summary, for the agent tool. */
export function journeyText(journey) {
  if (!journey) return '没有找到这个角色。'
  const lines = [
    `**${journey.name}** 的故事线：共 ${journey.total} 个节点，当前剧透范围内可见 ${journey.visible} 个`,
    '',
  ]
  for (const b of journey.beats) {
    if (b.locked || !b.title) {
      lines.push(`${b.order}. ${b.age} · ${b.year} — 🔒 后续事件（已隐藏）`)
      continue
    }
    const mark = b.role === 'focus' ? '★' : b.role === 'named' ? '·' : '○'
    lines.push(`${b.order}. ${mark} ${b.age} · ${b.year} — ${b.title}`)
    if (b.description) lines.push('   ' + b.description)
  }
  return lines.join('\n')
}
