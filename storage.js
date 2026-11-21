/**
 * Middle-earth Atlas — avatar journey snapshot storage.
 *
 * Persists "what the player chose" so an interrupted journey survives a page
 * reload. Deliberately small and dependency-free:
 *
 * - The storage medium is injected (`store` needs only getItem/setItem/
 *   removeItem), so the logic is testable in plain Node without a DOM.
 * - Only user decisions are stored. The journey payload and the score are
 *   derived on the Host and rebuilt on load, following the same principle as
 *   the rest of this plugin: derive, do not duplicate.
 * - Loading validates against the *current* journey. Data evolves; a snapshot
 *   that no longer matches is trimmed, never trusted. A stale save is a
 *   convenience lost, not an error worth showing.
 */

/** Bumped only when the snapshot shape changes incompatibly. */
export const SNAPSHOT_VERSION = 1

const KEY_PREFIX = 'mea:avatar:v' + SNAPSHOT_VERSION + ':'

/** Maximum scenes we will ever honour, guarding against a hostile snapshot. */
const MAX_STEP_GUARD = 10_000

export function snapshotKey(avatarId) {
  return KEY_PREFIX + String(avatarId)
}

/**
 * Build the snapshot to persist.
 * @param {{ picks: Record<string, number>, step: number, tier: number }} state
 */
export function buildSnapshot(state) {
  const picks = {}
  const source = state && state.picks
  if (source && typeof source === 'object') {
    for (const [sceneId, index] of Object.entries(source)) {
      if (typeof sceneId !== 'string' || !sceneId) continue
      if (!Number.isInteger(index) || index < 0) continue
      picks[sceneId] = index
    }
  }
  const step = Number.isInteger(state && state.step) && state.step > 0 ? state.step : 0
  const tier = [1, 2, 3].includes(state && state.tier) ? state.tier : 1
  return { v: SNAPSHOT_VERSION, picks, step, tier, savedAt: Date.now() }
}

/**
 * Validate a raw snapshot against the journey currently loaded.
 *
 * Returns null when nothing usable survives, so the caller starts fresh rather
 * than rendering a half-restored journey. Unknown scenes and out-of-range
 * choice indexes are dropped individually; the rest of the progress is kept.
 *
 * @param {unknown} raw parsed JSON from storage
 * @param {{ id: string, scenes: Array<{ id: string, choices: unknown[] }> }} journey
 */
export function validateSnapshot(raw, journey) {
  if (!raw || typeof raw !== 'object') return null
  if (raw.v !== SNAPSHOT_VERSION) return null
  if (!journey || !Array.isArray(journey.scenes) || journey.scenes.length === 0) return null

  const byId = new Map()
  for (const scene of journey.scenes) {
    if (scene && typeof scene.id === 'string') byId.set(scene.id, scene)
  }

  const picks = {}
  const rawPicks = raw.picks && typeof raw.picks === 'object' ? raw.picks : {}
  for (const [sceneId, index] of Object.entries(rawPicks)) {
    const scene = byId.get(sceneId)
    if (!scene) continue
    if (!Number.isInteger(index)) continue
    const choiceCount = Array.isArray(scene.choices) ? scene.choices.length : 0
    if (index < 0 || index >= choiceCount) continue
    picks[sceneId] = index
  }

  const sceneCount = journey.scenes.length
  let step = Number.isInteger(raw.step) ? raw.step : 0
  if (step < 0) step = 0
  if (step >= MAX_STEP_GUARD) step = 0
  if (step > sceneCount - 1) step = sceneCount - 1

  // Nothing usable: let the caller start from the beginning.
  if (Object.keys(picks).length === 0 && step === 0) return null

  const tier = [1, 2, 3].includes(raw.tier) ? raw.tier : 1
  return { picks, step, tier }
}

/** A store backed by localStorage, degrading to a no-op when unavailable. */
export function browserStore() {
  try {
    const probe = '__mea_probe__'
    globalThis.localStorage.setItem(probe, '1')
    globalThis.localStorage.removeItem(probe)
    return globalThis.localStorage
  } catch {
    // Private mode, disabled storage, or a quota of zero: stay silent and run
    // without persistence rather than degrade the journey.
    return null
  }
}

/** Read and validate. Returns null on any failure. */
export function loadSnapshot(store, avatarId, journey) {
  if (!store) return null
  try {
    const raw = store.getItem(snapshotKey(avatarId))
    if (!raw) return null
    return validateSnapshot(JSON.parse(raw), journey)
  } catch {
    return null
  }
}

/** Write a snapshot. Returns true when it was stored. */
export function saveSnapshot(store, avatarId, state) {
  if (!store) return false
  try {
    store.setItem(snapshotKey(avatarId), JSON.stringify(buildSnapshot(state)))
    return true
  } catch {
    return false
  }
}

/** Drop a snapshot, e.g. once the journey is finished. */
export function clearSnapshot(store, avatarId) {
  if (!store) return false
  try {
    store.removeItem(snapshotKey(avatarId))
    return true
  } catch {
    return false
  }
}
