/**
 * Middle-earth Atlas — snapshot validation rules, as one source of truth.
 *
 * The same validation has to run in two places: on the Host (for tests, via
 * storage.js) and in the browser (for the save/restore path, which cannot
 * import Host ESM). Historically that meant two hand-written copies that
 * happened to agree — a drift waiting to happen.
 *
 * Instead the rules live here as a single source string. `storage.js` compiles
 * it for Node, and `client.js` carries the identical string, compiled at
 * runtime. One source, two executions.
 *
 * The string must stay self-contained: it may reference only its own
 * local variables and the arguments named in the signature below.
 */

/**
 * Pure validation function body. Arguments: `raw` (parsed snapshot or null)
 * and `journey` (the currently loaded journey). Returns a sanitised snapshot
 * or null.
 */
export const VALIDATE_SOURCE = `(raw, journey, version) => {
  if (!raw || typeof raw !== 'object') return null
  if (raw.v !== version) return null
  if (!journey || !Array.isArray(journey.scenes) || journey.scenes.length === 0) return null

  const byId = {}
  for (const scene of journey.scenes) {
    if (scene && typeof scene.id === 'string') byId[scene.id] = scene
  }

  const picks = {}
  const source = raw.picks && typeof raw.picks === 'object' ? raw.picks : {}
  for (const sceneId of Object.keys(source)) {
    const scene = byId[sceneId]
    if (!scene) continue
    const index = source[sceneId]
    if (!Number.isInteger(index)) continue
    const count = Array.isArray(scene.choices) ? scene.choices.length : 0
    if (index < 0 || index >= count) continue
    picks[sceneId] = index
  }

  let step = Number.isInteger(raw.step) ? raw.step : 0
  const sceneCount = journey.scenes.length
  if (step < 0) step = 0
  if (step > sceneCount - 1) step = sceneCount - 1

  if (Object.keys(picks).length === 0 && step === 0) return null

  const tier = [1, 2, 3].includes(raw.tier) ? raw.tier : 1
  return { picks, step, tier }
}`

/** Compile the shared rules. Called once per module load. */
export function compileValidator() {
  // eslint-disable-next-line no-new-func
  return new Function('return ' + VALIDATE_SOURCE)()
}
