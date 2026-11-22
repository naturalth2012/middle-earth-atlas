/**
 * Out-of-process runtime verification: boots the plugin's web routes inside a
 * minimal cordis webServer stub (no DSH host needed) and runs the full
 * spoiler-leak regression matrix over real HTTP.
 * Usage: node scripts/_verify-runtime.mjs
 */
import http from 'node:http'

let patches
try {
  const mod = await import('../index.js')
  patches = mod.default || mod
} catch (e) {
  console.error('IMPORT FAILED:', e.message)
  process.exit(2)
}

const routes = new Map()
const webServer = {
  register: (def) => routes.set(def.path, def.handler),
}
await patches.apply({ inject: (key, fn) => fn({
  tools: { register: () => {} },
  effect: (f) => f(),
  webServer,
  webCtx: { effect: (f) => f(), webServer },
}) })
console.log(`routes registered: ${routes.size}`)
if (!routes.size) {
  console.error('No routes registered — inspect module exports:', Object.keys(patches || {}))
  process.exit(2)
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  const handler = routes.get(url.pathname)
  if (!handler) { res.writeHead(404); res.end('not found'); return }
  // Plugin handlers are (req, res) pairs; readQuery only uses req.url.
  // Case paths must arrive pre-encoded exactly once; no re-encoding here.
  await handler({ method: 'GET', url: url.search ? url.search : req.url }, res)
    .catch((e) => {
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'internal error' }))
    })
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const port = server.address().port
const base = `http://127.0.0.1:${port}`

const cases = [
  // [name, path, mustLeakPatterns, mustContainPatterns]
  ['bundle t1 work-summary', '/plugins/middle-earth-atlas/bundle?maxTier=1', ['最终被恩特大军摧毁'], []],
  ['bundle t1 differences', '/plugins/middle-earth-atlas/bundle?maxTier=1', ['迪耐瑟的结局'], []],
  ['bundle t1 plot-beat-title', '/plugins/middle-earth-atlas/bundle?maxTier=1', ['王者的归来', '五军之战与索林之死'], []],
  ['bundle t3 has-content', '/plugins/middle-earth-atlas/bundle?maxTier=3', [], ['最终被恩特大军摧毁', '迪耐瑟的结局']],
  ['graph t1 node-summary', '/plugins/middle-earth-atlas/graph?maxTier=1', ['最终被恩特大军摧毁', '精灵宝钻封存了双圣树的光'], []],
  ['graph t1 edge-label', '/plugins/middle-earth-atlas/graph?maxTier=1', ['被其杀害夺戒'], []],
  ['graph t3 label-ok', '/plugins/middle-earth-atlas/graph?maxTier=3', [], ['被其杀害夺戒']],
  ['ask t1 mount-doom', '/plugins/middle-earth-atlas/ask?q=末日火山在哪&maxTier=1', ['最终被恩特大军摧毁', '索伦在此铸造'], []],
  ['plot t1 beat-title', '/plugins/middle-earth-atlas/plot?maxTier=1', ['王者的归来'], []],
  ['plot t3 title-ok', '/plugins/middle-earth-atlas/plot?maxTier=3', [], ['王者的归来']],
  ['journeys t1 locked-desc', '/plugins/middle-earth-atlas/journeys?maxTier=1', ['从宁静的夏尔到黑门'], []],
  ['progress t1 locked-titles', '/plugins/middle-earth-atlas/progress?maxTier=1', ['安格班的围困'], []],
  ['progress t2 lotr-visible', '/plugins/middle-earth-atlas/progress?maxTier=2', ['伊西铎之死与魔戒失落'], ['比尔博的告别宴']],
  // "" is the CORRECT gated shape: empty means hidden, not leaked.
  ['avatar t1 fate', '/plugins/middle-earth-atlas/avatar?id=frodo&maxTier=1', ['"fate":"重'], []],
  ['avatar t1 summary', '/plugins/middle-earth-atlas/avatar?id=frodo&maxTier=1', ['"summary":"魔戒持有者'], []],
  ['avatar t3 fate-ok', '/plugins/middle-earth-atlas/avatar?id=frodo&maxTier=3', [], ['重伤后于第四纪元随精灵西渡']],
  ['avatar t1 embedded-event-title', '/plugins/middle-earth-atlas/avatar?id=gandalf&maxTier=1', ['帕兰诺平原之战', '魔戒毁灭'], []],
  // judge: canonChoice IS by design visible for tier<=1 scenes; the leak
  // pattern must be tier-3-specific content (Gollum's bite / the Sammath Naur).
  ['judge t1 canon-note', '/plugins/middle-earth-atlas/avatar-judge?id=frodo&choices=%5B%5D&maxTier=1', ['咕噜咬断手指', '末日裂缝'], []],
  ['judge t3 canon-note-ok', '/plugins/middle-earth-atlas/avatar-judge?id=frodo&choices=%5B%5D&maxTier=3', [], ['"canonChoice":{"label"']],
  ['search-all t1 work-summary', '/plugins/middle-earth-atlas/search-all?q=魔戒&maxTier=1', ['护戒同盟中途分裂'], []],
  ['search-all t3 work-ok', '/plugins/middle-earth-atlas/search-all?q=魔戒&maxTier=3', [], ['护戒同盟中途分裂']],
  ['neighbors t1 label', '/plugins/middle-earth-atlas/neighbors?id=deagol&maxTier=1', ['被其杀害夺戒'], []],
  ['neighbors t3 label-ok', '/plugins/middle-earth-atlas/neighbors?id=deagol&maxTier=3', [], ['被其杀害夺戒']],
  ['path t1 label', '/plugins/middle-earth-atlas/path?from=frodo&to=gollum&maxTier=1', ['被其杀害夺戒'], []],
  ['path t3 label-ok', '/plugins/middle-earth-atlas/path?from=frodo&to=gollum&maxTier=3', [], ['魔戒的共同承载者']],
  ['timeline t1', '/plugins/middle-earth-atlas/timeline?maxTier=1', ['帕兰诺平原之战'], []],
  ['detail t1 fate', '/plugins/middle-earth-atlas/detail?id=boromir&maxTier=1', ['牺牲'], []],
  ['detail t1 name-ok', '/plugins/middle-earth-atlas/detail?id=boromir&maxTier=1', [], ['波罗莫']],
]

let leaks = 0, errs = 0
for (const [name, path, leakPatterns, mustPatterns] of cases) {
  let body
  try {
    // Case paths are written with raw CJK; WHATWG URL encodes them exactly
    // once on fetch. Never call encodeURI on an already-escaped path.
    const res = await fetch(base + path)
    body = await res.text()
    if (res.status !== 200) { console.log(`ERR  ${name} -> HTTP ${res.status} ${body.slice(0, 120)}`); errs++; continue }
  } catch (e) { console.log(`ERR  ${name} -> ${e.message}`); errs++; continue }
  if (body.length < 20) { console.log(`ERR  ${name} -> short body`); errs++; continue }
  const hit = leakPatterns.filter((p) => body.includes(p))
  const missing = mustPatterns.filter((p) => !body.includes(p))
  if (hit.length === 0 && missing.length === 0) console.log(`PASS ${name}`)
  else if (hit.length) { console.log(`LEAK ${name} -> ${hit.join(' | ')}`); leaks++ }
  else { console.log(`MISS ${name} -> expected: ${missing.join(' | ')}`); leaks++ }
}
server.close()
console.log(`\n${cases.length - leaks - errs}/${cases.length} runtime probes green, ${leaks} leaks/missing, ${errs} errors`)
process.exit(leaks + errs ? 1 : 0)
