/**
 * Middle-earth Atlas — network analysis over the curated relationship graph.
 *
 * The atlas already *shows* 200+ relationships. This module makes them
 * answerable: who is structurally central, how far apart two characters
 * really are, and which single people hold two factions together.
 *
 * Pure graph maths over the same explicit relations the graph view draws —
 * no inferred or probabilistic edges, so every result is traceable to a
 * curated fact.
 */

import { CHARACTERS, CHARACTER_BY_ID, FACTIONS, FACTIONS_BY_ID } from './data.js'

/** Undirected adjacency over curated relations. */
function buildAdjacency() {
  const adj = new Map()
  for (const c of CHARACTERS) adj.set(c.id, new Set())
  for (const c of CHARACTERS) {
    for (const rel of c.relations || []) {
      if (!CHARACTER_BY_ID[rel.to]) continue
      adj.get(c.id).add(rel.to)
      if (adj.has(rel.to)) adj.get(rel.to).add(c.id)
    }
  }
  return adj
}

/**
 * Degree centrality: how many distinct characters someone is linked to.
 * Excludes duplicates (two relations with the same person count once).
 */
export function degreeCentrality(options = {}) {
  const adj = buildAdjacency()
  const rows = []
  for (const [id, neighbours] of adj.entries()) {
    const c = CHARACTER_BY_ID[id]
    if (!c) continue
    rows.push({
      id,
      name: c.name,
      faction: c.faction,
      factionLabel: c.factionLabel,
      degree: neighbours.size,
    })
  }
  rows.sort((a, b) => b.degree - a.degree || a.name.localeCompare(b.name))
  const limit = Math.max(1, Math.min(56, Number(options.limit) || 12))
  return {
    top: rows.slice(0, limit),
    total: rows.length,
    // A "hub" here means a character touching more than a quarter of the cast.
    hubs: rows.filter((r) => r.degree >= rows.length * 0.25).map((r) => r.name),
  }
}

/**
 * Betweenness centrality (Brandes) — how often a character sits on the
 * shortest path between two others. High values mark the people who hold the
 * network together; remove them and distances grow.
 */
export function betweennessCentrality(options = {}) {
  const adj = buildAdjacency()
  const nodes = [...adj.keys()]
  const bc = new Map(nodes.map((n) => [n, 0]))

  for (const source of nodes) {
    const stack = []
    const pred = new Map(nodes.map((n) => [n, []]))
    const sigma = new Map(nodes.map((n) => [n, 0]))
    const dist = new Map(nodes.map((n) => [n, -1]))
    sigma.set(source, 1)
    dist.set(source, 0)

    const queue = [source]
    while (queue.length) {
      const v = queue.shift()
      stack.push(v)
      for (const w of adj.get(v)) {
        if (dist.get(w) < 0) {
          dist.set(w, dist.get(v) + 1)
          queue.push(w)
        }
        if (dist.get(w) === dist.get(v) + 1) {
          sigma.set(w, sigma.get(w) + sigma.get(v))
          pred.get(w).push(v)
        }
      }
    }

    const delta = new Map(nodes.map((n) => [n, 0]))
    while (stack.length) {
      const w = stack.pop()
      for (const v of pred.get(w)) {
        if (sigma.get(w) > 0) {
          delta.set(v, delta.get(v) + (sigma.get(v) / sigma.get(w)) * (1 + delta.get(w)))
        }
      }
      if (w !== source) bc.set(w, bc.get(w) + delta.get(w))
    }
  }

  // Undirected graph: each pair counted twice.
  const rows = []
  for (const [id, value] of bc.entries()) {
    const c = CHARACTER_BY_ID[id]
    if (!c) continue
    rows.push({
      id,
      name: c.name,
      faction: c.faction,
      factionLabel: c.factionLabel,
      betweenness: Number((value / 2).toFixed(2)),
    })
  }
  rows.sort((a, b) => b.betweenness - a.betweenness || a.name.localeCompare(b.name))
  const limit = Math.max(1, Math.min(56, Number(options.limit) || 10))
  return { top: rows.slice(0, limit), total: rows.length }
}

/**
 * Average shortest-path length over all connected pairs, plus the diameter.
 * Reported as a real number because "about three hops apart" is the useful
 * fact, not a rounded one.
 */
export function pathStats() {
  const adj = buildAdjacency()
  const nodes = [...adj.keys()]
  let sum = 0
  let pairs = 0
  let diameter = 0
  let reachablePairs = 0

  for (const source of nodes) {
    const dist = new Map([[source, 0]])
    const queue = [source]
    while (queue.length) {
      const v = queue.shift()
      for (const w of adj.get(v)) {
        if (dist.has(w)) continue
        dist.set(w, dist.get(v) + 1)
        queue.push(w)
      }
    }
    for (const [target, d] of dist.entries()) {
      if (target <= source) continue // count each unordered pair once
      sum += d
      pairs++
      if (d > 0) reachablePairs++
      if (d > diameter) diameter = d
    }
  }

  const nodeCount = nodes.length
  const possiblePairs = (nodeCount * (nodeCount - 1)) / 2
  return {
    characters: nodeCount,
    averageDistance: pairs ? Number((sum / pairs).toFixed(2)) : 0,
    diameter,
    connectedPairs: reachablePairs,
    unreachablePairs: possiblePairs - reachablePairs,
    connected: reachablePairs === possiblePairs,
  }
}

/**
 * Faction bridges: characters whose relations cross into two or more
 * factions. These are the people whose removal would split the network
 * along faction lines.
 */
export function factionBridges(options = {}) {
  const adj = buildAdjacency()
  const rows = []
  for (const [id, neighbours] of adj.entries()) {
    const c = CHARACTER_BY_ID[id]
    if (!c) continue
    const reached = new Set()
    for (const n of neighbours) {
      const other = CHARACTER_BY_ID[n]
      if (other && other.faction !== c.faction) reached.add(other.faction)
    }
    if (reached.size === 0) continue
    rows.push({
      id,
      name: c.name,
      faction: c.faction,
      factionLabel: c.factionLabel,
      bridgesTo: [...reached].map((f) => ({
        id: f,
        name: FACTIONS_BY_ID[f] ? FACTIONS_BY_ID[f].name : f,
        color: FACTIONS_BY_ID[f] ? FACTIONS_BY_ID[f].color : null,
      })),
      bridgeCount: reached.size,
    })
  }
  rows.sort((a, b) => b.bridgeCount - a.bridgeCount || a.name.localeCompare(b.name))
  const limit = Math.max(1, Math.min(56, Number(options.limit) || 10))
  return {
    top: rows.slice(0, limit),
    factions: FACTIONS.length,
    // Factions with no cross-faction link at all are worth naming.
    isolatedFactions: FACTIONS.filter((f) => !rows.some((r) => r.faction === f.id)).map((f) => f.name),
  }
}

/** Everything in one call, for the panel and the tool. */
export function networkSummary(options = {}) {
  const degree = degreeCentrality(options)
  const between = betweennessCentrality(options)
  const paths = pathStats()
  const bridges = factionBridges(options)
  const relations = CHARACTERS.reduce((n, c) => n + (c.relations || []).length, 0)
  const edges = relations / 2
  const nodes = paths.characters
  return {
    nodes,
    relations,
    edges: Number(edges.toFixed(1)),
    density: nodes > 1 ? Number(((2 * edges) / (nodes * (nodes - 1))).toFixed(3)) : 0,
    degree,
    betweenness: between,
    paths,
    bridges,
    generatedAt: new Date().toISOString(),
  }
}
