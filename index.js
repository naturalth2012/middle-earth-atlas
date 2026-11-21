/**
 * Middle-earth Atlas — Host half.
 *
 * 1. Serves the curated dataset to the browser over same-origin routes so the
 *    Client never carries the dataset itself.
 * 2. Registers agent Tools that query the same engine, so the conversational
 *    answers and the visual page stay in sync.
 *
 * @module @naturalth2012/middle-earth-atlas
 */

import {
  bundle, counts, searchCharacters, searchAll, buildGraph, neighbors,
  characterDetail, placeDetail, artifactDetail, glossaryDetail,
  relationPath, timeline, plot, journeys, ask, suggestions,
} from './engine.js'

const BASE = '/plugins/middle-earth-atlas'
export const BUNDLE_PATH = BASE + '/bundle'
export const SEARCH_PATH = BASE + '/search'
export const ALL_PATH = BASE + '/search-all'
export const DETAIL_PATH = BASE + '/detail'
export const PLACE_PATH = BASE + '/place'
export const ARTIFACT_PATH = BASE + '/artifact'
export const GLOSSARY_PATH = BASE + '/glossary'
export const GRAPH_PATH = BASE + '/graph'
export const NEIGHBORS_PATH = BASE + '/neighbors'
export const PATH_PATH = BASE + '/path'
export const TIMELINE_PATH = BASE + '/timeline'
export const PLOT_PATH = BASE + '/plot'
export const JOURNEYS_PATH = BASE + '/journeys'
export const ASK_PATH = BASE + '/ask'

const textOutput = {
  schema: { type: 'object', properties: { text: { type: 'string' } }, additionalProperties: true },
  render(args, value) {
    return [{ type: 'text', text: (value && value.text) || '没有结果。' }]
  },
}

function json(res, status, body) {
  let payload
  try {
    payload = JSON.stringify(body)
  } catch (error) {
    payload = JSON.stringify({ error: 'response is not serializable: ' + String(error) })
    status = 500
  }
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

function readQuery(req, fallbackPath) {
  try {
    return new URL(req.url === undefined ? fallbackPath : req.url, 'http://localhost').searchParams
  } catch {
    return new URLSearchParams()
  }
}

function routeHandler(path, compute) {
  return async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      json(res, 405, { error: 'method not allowed' })
      return
    }
    try {
      const params = readQuery(req, path)
      const result = await compute(params)
      if (req.method === 'HEAD') {
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end()
        return
      }
      json(res, 200, result)
    } catch (error) {
      json(res, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  }
}

const list = (value) => (value ? value.split(',').map((s) => s.trim()).filter(Boolean) : undefined)

/** @param {import('@deepseek-ai/cordis').Context} ctx */
export function apply(ctx) {
  // ---- Agent tools -------------------------------------------------------
  ctx.inject(['tools'], (toolCtx) => {
    const register = (def, label) => toolCtx.effect(() => toolCtx.tools.register(def), label)

    register({
      name: 'middle_earth_search',
      description:
        'Search the Middle-earth Atlas across characters, places, artifacts, glossary terms and works. '
        + 'Use it to find who someone is, where a place sits, which artifact is meant, or which works mention something.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Name or keyword, e.g. 弗罗多 / Gandalf / 戒灵 / 末日火山' },
          faction: { type: 'string', description: 'Optional faction id: hobbit, ranger, wizard, elf, dwarf, man, sauron, numenor, wild' },
          work: { type: 'string', description: 'Optional work id: hobbit-book, lotr-book, silmarillion, hobbit-films, lotr-films, rop' },
          scope: { type: 'string', enum: ['all', 'characters'], description: 'Search everything (default) or characters only.' },
        },
        additionalProperties: false,
      },
      output: textOutput,
      async execute(args) {
        const query = (args && args.query) || ''
        if (args && args.scope === 'characters') {
          const hits = searchCharacters(query, { faction: args.faction, work: args.work })
          if (!hits.length) return { text: '没有找到匹配的角色。' }
          return {
            text: hits.slice(0, 15).map((c) =>
              `- ${c.name}（${c.nameEn}）· ${c.factionLabel} · ${c.kind} · 来源：${c.canon}\n  ${c.summary}`
            ).join('\n'),
          }
        }
        const result = searchAll(query)
        if (!result.total) return { text: '没有找到匹配的内容。' }
        const lines = result.groups.map((g) =>
          `**${g.label}（${g.items.length}）**\n` + g.items.slice(0, 10).map((it) =>
            `- ${it.name}（${it.nameEn}）${it.type ? ' · ' + it.type : ''}：${it.summary}`
          ).join('\n'))
        return { text: lines.join('\n\n') }
      },
    }, 'middle-earth-atlas: middle_earth_search tool')

    register({
      name: 'middle_earth_detail',
      description:
        'Get a full dossier for one Middle-earth entity: a character (biography, relationships, places, artifacts, quotes), '
        + 'a place, an artifact, a glossary term, or a work.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name, e.g. 阿拉贡 / Frodo / 末日火山 / 至尊魔戒 / 迈雅' },
          kind: {
            type: 'string',
            enum: ['character', 'place', 'artifact', 'glossary', 'work'],
            description: 'Optional explicit entity kind; inferred when omitted.',
          },
        },
        required: ['name'],
        additionalProperties: false,
      },
      output: textOutput,
      async execute(args) {
        const name = (args && args.name) || ''
        const kind = (args && args.kind) || ''
        const prefer = (k) => !kind || kind === k

        if (prefer('character')) {
          const d = characterDetail(name)
          if (d) {
            const lines = [
              `# ${d.name}（${d.nameEn}）`,
              `阵营：${d.factionLabel} · 类型：${d.kind} · 来源：${d.canon}`,
              '', d.summary, '', d.details || '',
            ]
            if (d.fate) lines.push('', '结局：' + d.fate)
            if (d.relations.length) {
              lines.push('', '## 主要关系')
              d.relations.forEach((r) => lines.push(`- [${r.typeLabel}] ${r.name}：${r.label}`))
            }
            lines.push('', '## 出场作品')
            d.works.forEach((w) => lines.push(`- ${w.title}：${w.role}（${w.canon}）`))
            if (d.places.length) {
              lines.push('', '## 相关地点')
              d.places.forEach((p) => lines.push(`- ${p.name}（${p.type}）：${p.summary}`))
            }
            if (d.artifacts.length) {
              lines.push('', '## 相关物品')
              d.artifacts.forEach((a) => lines.push(`- ${a.name}（${a.type}）：${a.summary}`))
            }
            if (d.quotes.length) {
              lines.push('', '## 名句')
              d.quotes.forEach((q) => lines.push(`- “${q.text}” — ${q.context}（${q.work}）`))
            }
            if (d.appearances.length) {
              lines.push('', '## 相关事件')
              d.appearances.forEach((e) => lines.push(`- ${e.age} ${e.year} ${e.title}`))
            }
            return { text: lines.join('\n') }
          }
        }
        if (prefer('place')) {
          const p = placeDetail(name)
          if (p) {
            return {
              text: [
                `# ${p.name}（${p.nameEn}）`, `${p.region} · ${p.type} · 来源：${p.canon}`,
                '', p.summary, '', p.desc,
                '', '## 相关人物', ...p.characters.map((c) => `- ${c.name}（${c.factionLabel}）`),
              ].join('\n'),
            }
          }
        }
        if (prefer('artifact')) {
          const a = artifactDetail(name)
          if (a) {
            return {
              text: [
                `# ${a.name}（${a.nameEn}）`, `${a.type} · 来源：${a.canon}`,
                '', a.summary, '', a.desc,
                '', '## 经手人物', ...a.owners.map((c) => `- ${c.name}`),
              ].join('\n'),
            }
          }
        }
        if (prefer('glossary')) {
          const g = glossaryDetail(name)
          if (g) {
            const lines = [`# ${g.term}（${g.termEn}）`, `${g.category}`, '', g.definition, '', g.detail]
            if (g.related.length) lines.push('', '## 相关人物', ...g.related.map((c) => `- ${c.name}`))
            return { text: lines.join('\n') }
          }
        }
        return { text: '没有找到这个条目。' }
      },
    }, 'middle-earth-atlas: middle_earth_detail tool')

    register({
      name: 'middle_earth_relation',
      description:
        'Find the shortest curated relationship path between two Middle-earth characters, e.g. Frodo and Gollum, '
        + 'Aragorn and Galadriel. Returns every hop with the relation label that connects them.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'First character name' },
          to: { type: 'string', description: 'Second character name' },
        },
        required: ['from', 'to'],
        additionalProperties: false,
      },
      output: textOutput,
      async execute(args) {
        const result = relationPath((args && args.from) || '', (args && args.to) || '')
        if (!result.ok) return { text: (result.error || '未找到关系路径。') }
        if (!result.steps.length) return { text: '这两个是同一个角色。' }
        const lines = [`关系路径（${result.hops} 跳）：`]
        result.steps.forEach((s, i) => lines.push(`${i + 1}. ${s.from} —[${s.label}]→ ${s.to}`))
        return { text: lines.join('\n') }
      },
    }, 'middle-earth-atlas: middle_earth_relation tool')

    register({
      name: 'middle_earth_timeline',
      description:
        'Query the timeline across the First to Fourth Ages. Filter by work, character or age.',
      parameters: {
        type: 'object',
        properties: {
          work: { type: 'string', description: 'Optional work id filter' },
          character: { type: 'string', description: 'Optional character name/id filter' },
          age: { type: 'string', description: 'Optional age, e.g. 第三纪元' },
        },
        additionalProperties: false,
      },
      output: textOutput,
      async execute(args) {
        const result = timeline({ work: args && args.work, character: args && args.character, age: args && args.age })
        if (!result.events.length) return { text: '该筛选条件下没有事件。' }
        return { text: result.events.map((e) => `- ${e.age} · ${e.year} **${e.title}**：${e.desc}`).join('\n') }
      },
    }, 'middle-earth-atlas: middle_earth_timeline tool')

    register({
      name: 'middle_earth_graph',
      description:
        'Inspect the character relationship graph. With `focus`, return that character\'s neighbours; with `from` and `to`, '
        + 'return the shortest path; with neither, return summary statistics of the whole graph.',
      parameters: {
        type: 'object',
        properties: {
          focus: { type: 'string', description: 'Character to focus on' },
          from: { type: 'string', description: 'Path start character' },
          to: { type: 'string', description: 'Path end character' },
          faction: { type: 'string', description: 'Optional faction filter' },
        },
        additionalProperties: false,
      },
      output: textOutput,
      async execute(args) {
        if (args && args.from && args.to) {
          const result = relationPath(args.from, args.to)
          if (!result.ok) return { text: result.error || '未找到关系路径。' }
          return {
            text: `关系路径（${result.hops} 跳）：\n`
              + result.steps.map((s, i) => `${i + 1}. ${s.from} —[${s.label}]→ ${s.to}`).join('\n'),
          }
        }
        if (args && args.focus) {
          const n = neighbors(args.focus)
          if (!n) return { text: '没有找到这个角色。' }
          const lines = [`**${n.character.name}** 的关系（${Object.values(n.groups).reduce((a, g) => a + g.length, 0)} 条）`]
          for (const [type, items] of Object.entries(n.groups)) {
            const label = items[0] ? items[0].typeLabel : type
            lines.push(`- ${label}：` + items.map((i) => `${i.name}（${i.label}）`).join('、'))
          }
          return { text: lines.join('\n') }
        }
        const g = buildGraph({ faction: args && args.faction })
        const top = [...g.nodes].sort((a, b) => b.degree - a.degree).slice(0, 8)
        return {
          text: [
            `关系图谱：${g.nodes.length} 个角色，${g.edges.length} 条关系。`,
            '', '关系最多的角色：',
            ...top.map((n, i) => `${i + 1}. ${n.label}（${n.degree} 条）`),
          ].join('\n'),
        }
      },
    }, 'middle-earth-atlas: middle_earth_graph tool')

    register({
      name: 'middle_earth_ask',
      description:
        'Ask a free-form question about Middle-earth: who someone is, relationships, places, artifacts, glossary terms, '
        + 'timeline events, plot beats and adaptation differences. Returns a concise canon-aware answer.',
      parameters: {
        type: 'object',
        properties: { question: { type: 'string', description: 'Natural-language question in Chinese or English' } },
        required: ['question'],
        additionalProperties: false,
      },
      output: textOutput,
      async execute(args) {
        return { text: ask((args && args.question) || '') }
      },
    }, 'middle-earth-atlas: middle_earth_ask tool')
  })

  // ---- Browser routes ----------------------------------------------------
  ctx.inject(['webServer'], (webCtx) => {
    const register = (path, compute, label) =>
      webCtx.effect(() => webCtx.webServer.register({ kind: 'exact', path, handler: routeHandler(path, compute) }), label)

    register(BUNDLE_PATH, () => bundle(), 'middle-earth-atlas: bundle route')

    register(SEARCH_PATH, (p) => ({
      results: searchCharacters(p.get('q') || '', {
        faction: p.get('faction') || undefined,
        work: p.get('work') || undefined,
        kind: p.get('kind') || undefined,
      }),
      counts: counts(),
    }), 'middle-earth-atlas: search route')

    register(ALL_PATH, (p) => searchAll(p.get('q') || ''), 'middle-earth-atlas: universal search route')

    register(DETAIL_PATH, (p) => characterDetail(p.get('id') || p.get('q') || '')
      || { error: '没有找到该角色' }, 'middle-earth-atlas: detail route')

    register(PLACE_PATH, (p) => placeDetail(p.get('id') || p.get('q') || '')
      || { error: '没有找到该地点' }, 'middle-earth-atlas: place route')

    register(ARTIFACT_PATH, (p) => artifactDetail(p.get('id') || p.get('q') || '')
      || { error: '没有找到该物品' }, 'middle-earth-atlas: artifact route')

    register(GLOSSARY_PATH, (p) => glossaryDetail(p.get('id') || p.get('q') || '')
      || { error: '没有找到该术语' }, 'middle-earth-atlas: glossary route')

    register(GRAPH_PATH, (p) => buildGraph({
      focus: p.get('focus') || undefined,
      ids: list(p.get('ids')),
      faction: p.get('faction') || undefined,
    }), 'middle-earth-atlas: graph route')

    register(NEIGHBORS_PATH, (p) => neighbors(p.get('id') || p.get('q') || '')
      || { error: '没有找到该角色' }, 'middle-earth-atlas: neighbors route')

    register(PATH_PATH, (p) => relationPath(p.get('from') || '', p.get('to') || ''),
      'middle-earth-atlas: relation path route')

    register(TIMELINE_PATH, (p) => timeline({
      work: p.get('work') || undefined,
      character: p.get('character') || undefined,
      age: p.get('age') || undefined,
    }), 'middle-earth-atlas: timeline route')

    register(PLOT_PATH, (p) => ({ plots: plot({ work: p.get('work') || undefined }) }),
      'middle-earth-atlas: plot route')

    register(JOURNEYS_PATH, (p) => ({ journeys: journeys({ work: p.get('work') || undefined }) }),
      'middle-earth-atlas: journeys route')

    register(ASK_PATH, (p) => ({
      answer: ask(p.get('q') || ''),
      suggestions: suggestions(),
    }), 'middle-earth-atlas: ask route')
  })
}
