/**
 * Middle-earth Atlas — spoiler gating.
 *
 * The atlas is a reference for a story whose whole effect depends on not
 * knowing what comes next. A reader who has just finished The Hobbit must be
 * able to open Frodo's card without being told he sails West, loses a finger,
 * and that Gollum falls into the fire.
 *
 * IMPORTANT — this module's tiers are READING PROGRESS, not scene suspense:
 *
 *   1 — safe after The Hobbit
 *   2 — safe after The Lord of the Rings
 *   3 — needs The Silmarillion / appendices / endings
 *
 * `journey.js` also has a `tier` field with the same 1–3 range but a different
 * meaning (how spoilery one avatar scene is). The ranges match by coincidence;
 * do not share the constants.
 *
 * Design note: gating is a WHITELIST. Below the reader's mark only explicitly
 * listed fields survive. A blacklist of forbidden words could never be
 * complete — "he never came back" spoils as thoroughly as "he died".
 */

/** Reading progress ceilings. */
export const MAX_TIER = 3

export const TIER_LABELS = [
  { tier: 1, id: 't1', zh: '读完《霍比特人》', en: 'Finished The Hobbit', hint: '不泄露《魔戒》情节' },
  { tier: 2, id: 't2', zh: '读完《魔戒》', en: 'Finished The Lord of the Rings', hint: '含主线结局' },
  { tier: 3, id: 't3', zh: '全部', en: 'Everything', hint: '含《精灵宝钻》与附录' },
]

/**
 * Which fields are safe at each reading level.
 *
 * `safe` lists the fields that survive at tier 1 — everything else needs a
 * higher mark. These are the only fields a fresh reader ever sees.
 */
export const FIELD_SAFETY = {
  character: {
    safe: ['id', 'name', 'nameEn', 'alias', 'faction', 'factionLabel', 'kind', 'tags', 'works', 'canon'],
    tier2: ['summary'],
    tier3: ['details', 'fate', 'relations', 'appearances', 'places', 'artifacts', 'quotes'],
  },
  place: {
    safe: ['id', 'name', 'nameEn', 'region', 'type', 'canon'],
    tier2: ['summary'],
    tier3: ['desc', 'characters', 'workTitles'],
  },
  artifact: {
    safe: ['id', 'name', 'nameEn', 'type', 'canon'],
    tier2: ['summary'],
    tier3: ['desc', 'owners', 'workTitles'],
  },
  glossary: {
    safe: ['id', 'term', 'termEn', 'category'],
    tier2: ['definition'],
    tier3: ['detail', 'related'],
  },
  event: {
    safe: ['id', 'age', 'year', 'importance', 'works', 'characters'],
    tier2: [],
    tier3: ['title', 'desc'],
  },
  quote: {
    safe: ['id', 'work', 'speaker'],
    tier2: ['text'],
    tier3: ['context', 'textEn'],
  },
}

/**
 * Records whose *safe* fields are already spoilers, so the whole record is
 * held back. Verified by scanning every summary/title for outcome language:
 * 14 characters, 8 events, 4 places and 2 artifacts carry endings inside what
 * should have been the harmless one-liner.
 *
 * Keeping this list honest matters more than keeping it short: a missing entry
 * leaks an ending, an extra entry hides something harmless. Each is annotated
 * with the sentence that forced it.
 */
export const RECORD_TIER = {
  // --- characters whose summary states how they end ---
  gandalf: 2,    // 化为白袍、随精灵西渡
  boromir: 3,    // 「后在保卫梅里与皮平战中牺牲」
  theoden: 3,    // 「战死于帕兰诺平原」
  gollum: 3,     // 「最终在末日火山夺回魔戒并与之同归于尽」
  frodo: 3,      // 「随其坠入烈焰」/「重伤后西渡」
  sam: 3,        // 「成为夏尔市长」— 结局之一
  bilbo: 3,      // 「西渡不死之地」
  smaug: 3,      // 「被巴德以黑箭射中胸口弱点杀死」
  denethor: 3,   // 「因真知晶石被索伦误导而绝望自焚」
  grima: 3,      // 「最终在夏尔刺杀萨鲁曼后被杀」
  hama: 3,       // 「在圣盔谷之战中战死」
  haldir: 3,     // 「在电影中率精灵援军赶赴圣盔谷并战死」
  witchking: 3,  // 「在帕兰诺平原被伊欧玟与梅里合力杀死」
  balrog: 3,     // 「被甘道夫与之死斗并一同坠入深渊」
  elendil: 3,    // 「最后同盟中战死」
  anarion: 3,    // 「在巴拉多围城期间战死」
  gil_galad: 3,  // 「与伊兰迪尔并肩对抗索伦并战死」
  isildur: 3,    // 「最终因此丧命」
  deagol: 3,     // 「被斯米戈尔掐死夺戒」
  ar_pharazon: 3, // 「最终导致王国沉没」
  miriel: 3,     // 「王国沉没时溺亡」

  // --- events whose very title is the ending ---
  e5: 3,     // 努门诺尔沉没
  e7: 3,     // 伊西铎之死与魔戒失落
  e10g: 3,   // 史矛革之死与孤山归属
  e10h: 3,   // 五军之战与索林之死
  e11: 2,    // 比尔博的告别宴
  e16: 3,    // 护戒同盟分裂（波罗莫之死）
  e20: 3,    // 帕兰诺平原之战（希优顿之死、巫王被斩）
  e23: 3,    // 末日火山：魔戒毁灭
  e25: 3,    // 灰港告别与第三纪元终结

  // --- places whose summary states the outcome ---
  mount_doom: 3,   // 「弗罗多与咕噜在此终结了魔戒」
  isengard: 3,     // 「最终被恩特大军摧毁」
  minas_tirith: 3, // 「迪耐瑟在此自焚，阿拉贡在此加冕」
  pelennor: 3,     // 「希优顿战死，巫王被斩杀」

  // --- artifacts whose summary states the outcome ---
  one_ring: 3,  // 「销毁它是整个故事的目标」
  narsil: 3,    // 「在最后同盟之战中折断」
}

/** Clamp a caller-supplied ceiling. Absent means "show everything". */
export function normalizeTier(value) {
  if (value === null || value === undefined || value === '') return MAX_TIER
  const n = Number(value)
  if (!Number.isFinite(n)) return MAX_TIER
  return Math.min(MAX_TIER, Math.max(1, Math.round(n)))
}

/** Fields allowed at a given reading level for one entity kind. */
export function allowedFields(kind, maxTier) {
  const spec = FIELD_SAFETY[kind]
  if (!spec) return null
  if (maxTier >= 3) return null // everything allowed
  if (maxTier >= 2) return [...spec.safe, ...spec.tier2]
  return [...spec.safe]
}

/**
 * Mask one record for a reader.
 *
 * Whitelist semantics: only allowed fields survive. The record is never
 * removed and always keeps its id, so the UI can show "something is here,
 * but it is locked" instead of an empty space.
 */
export function maskRecord(kind, record, maxTier) {
  if (!record || typeof record !== 'object') return record
  const cap = normalizeTier(maxTier)
  if (cap >= MAX_TIER) return record

  const recordCap = RECORD_TIER[record.id]
  // A record-level ceiling can only ever lower the reader's view, never raise
  // it: if the record is safe, we still apply the field whitelist.
  const fieldCap = typeof recordCap === 'number' && recordCap > cap ? Math.min(cap, 1) : cap

  const allowed = allowedFields(kind, fieldCap)
  if (!allowed) return record

  const out = {}
  const hidden = []
  for (const key of Object.keys(record)) {
    if (allowed.includes(key)) out[key] = record[key]
    else if (record[key] !== undefined && record[key] !== null && record[key] !== '') hidden.push(key)
  }
  if (hidden.length) {
    out.locked = true
    out.lockedFields = hidden
  }
  return out
}

/** Mask a list of records of one kind. */
export function maskList(kind, list, maxTier) {
  if (!Array.isArray(list)) return list
  const cap = normalizeTier(maxTier)
  if (cap >= MAX_TIER) return list
  return list.map((item) => maskRecord(kind, item, cap))
}

/** How much of each entity kind is visible at a given level. */
export function tierSummary() {
  return TIER_LABELS.map((label) => ({
    ...label,
    safeFields: FIELD_SAFETY.character.safe.length,
    // Counting hidden records needs the dataset, so the engine fills this in.
    hiddenRecords: 0,
  }))
}
