/**
 * Spoiler-leak regression probes against the live Host routes.
 * Usage: node scripts/_probe-leaks.mjs [port]   (default 13807)
 */
const port = process.argv[2] || '13807'
const base = `http://127.0.0.1:${port}/plugins/middle-earth-atlas`

const cases = [
  ['bundle t1 work-summary', '/bundle?maxTier=1', ['最终被恩特大军摧毁']],
  ['bundle t1 differences', '/bundle?maxTier=1', ['迪耐瑟的结局']],
  ['bundle t1 plot-beat-title', '/bundle?maxTier=1', ['王者的归来', '五军之战与索林之死']],
  ['bundle t3 has-summary', '/bundle?maxTier=3', ['最终被恩特大军摧毁']],
  ['graph t1 node-summary', '/graph?maxTier=1', ['最终被恩特大军摧毁', '精灵宝钻封存了双圣树的光']],
  ['graph t1 edge-label', '/graph?maxTier=1', ['被其杀害夺戒']],
  ['ask t1 mount-doom', '/ask?q=末日火山在哪&maxTier=1', ['最终被恩特大军摧毁', '索伦在此铸造']],
  ['plot t1 beat-title', '/plot?maxTier=1', ['王者的归来']],
  ['journeys t1 locked-desc', '/journeys?maxTier=1', ['从宁静的夏尔到黑门']],
  ['progress t1 locked-titles', '/progress?maxTier=1', ['安格班的围困']],
  ['avatar t1 fate', '/avatar?id=frodo&maxTier=1', ['"fate":"']],
  ['judge t1 canon-note', '/avatar-judge?id=frodo&choices=%5B%5D&maxTier=1', ['"canonChoice":{"label"']],
  ['search-all t1 work-summary', '/search-all?q=魔戒&maxTier=1', ['至尊魔戒的编年史']],
  ['neighbors t1 label', '/neighbors?id=frodo&maxTier=1', ['被其杀害夺戒']],
  ['path t1 label', '/path?from=frodo&to=gollum&maxTier=1', ['被其杀害夺戒']],
  ['path t3 label-ok', '/path?from=frodo&to=gollum&maxTier=3', ['凶咕噜', '接力']],
]

let leaks = 0, errs = 0
for (const [name, path, patterns] of cases) {
  let body
  try {
    const res = await fetch(base + path)
    body = await res.text()
    if (res.status !== 200) { console.log(`ERR  ${name} -> HTTP ${res.status}`); errs++; continue }
  } catch (e) { console.log(`ERR  ${name} -> ${e.message}`); errs++; continue }
  if (body.length < 50) { console.log(`ERR  ${name} -> short body`); errs++; continue }
  const hit = patterns.filter((p) => body.includes(p))
  if (hit.length === 0) console.log(`PASS ${name}`)
  else { console.log(`LEAK ${name} -> ${hit.join(' | ')}`); leaks++ }
}
console.log(`\n${cases.length - leaks - errs}/${cases.length} probes green, ${leaks} leaks, ${errs} errors`)
process.exit(leaks + errs ? 1 : 0)
