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
  avatarList, avatarJourney, judgeJourney,
} from './engine.js'
import { TIER_LABELS, MAX_TIER, RECORD_TIER, maskList } from './spoiler.js'
import { THEMES } from './themes.js'
import { networkSummary } from './analysis.js'
import { readingProgress, characterJourney, journeyText } from './progress.js'

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
export const AVATARS_PATH = BASE + '/avatars'
export const AVATAR_PATH = BASE + '/avatar'
export const AVATAR_JUDGE_PATH = BASE + '/avatar-judge'
export const SPOILER_PATH = BASE + '/spoiler-tiers'
export const CLIENT_ERROR_PATH = BASE + '/client-error'
export const THEMES_PATH = BASE + '/themes'
export const ANALYSIS_PATH = BASE + '/analysis'
export const PROGRESS_PATH = BASE + '/progress'
export const JOURNEY_PATH = BASE + '/character-journey'

const textOutput = {
  schema: { type: 'object', properties: { text: { type: 'string' } }, additionalProperties: true },
  render(args, value) {
    return [{ type: 'text', text: (value && value.text) || '没有结果。' }]
  },
}


/** In-memory ring of client-side errors, for diagnosis of blank panels. */
const clientErrors = []
function recordClientError(entry) {
  try {
    clientErrors.push({ at: Date.now(), ...entry })
    if (clientErrors.length > 50) clientErrors.shift()
  } catch { /* diagnostic data must never break a route */ }
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
      // Keep internals out of the response body: log to the server console,
      // the client only needs the fact.
      console.error('[middle-earth-atlas] route ' + path + ' failed:', error)
      json(res, 500, { error: 'internal error' })
    }
  }
}

const list = (value) => (value ? value.split(',').map((s) => s.trim()).filter(Boolean) : undefined)

/** A spoiler ceiling from a query string: 1–3, defaulting to everything. */
const optionalTier = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return 3
  return Math.max(1, Math.min(3, Math.round(n)))
}

/** @param {import('@deepseek-ai/cordis').Context} ctx */
export function apply(ctx) {
  // ---- Agent tools -------------------------------------------------------
  ctx.inject(['tools'], (toolCtx) => {
    const register = (def, label) => toolCtx.effect(() => toolCtx.tools.register(def), label)


    register({
      name: 'middle_earth_theme',
      description:
        'Read the multi-angle analysis of a Middle-earth theme (mercy vs prudence, fate vs choice, power vs corruption). '
        + 'Returns the question, three defensible positions, and the open discussion. Set list to true to enumerate every theme.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'Theme title or keyword, e.g. 怜悯 / 命运 / 权力' },
          list: { type: 'boolean', description: 'Set true to list every available theme with its question.' },
          maxTier: { type: 'integer', description: 'Reading progress ceiling 1-3; themes above it are withheld.' },
        },
        additionalProperties: false,
      },
      output: textOutput,
      async execute(args) {
        const maxTier = Number((args && args.maxTier)) || MAX_TIER
        const visible = THEMES.filter((x) => (x.tier || MAX_TIER) <= maxTier)
        if (!visible.length) return { text: '当前剧透等级下没有可见的主题。' }

        if (args && args.list) {
          return {
            text: visible.map((x) => '- ' + x.title + '：' + x.question).join('\n'),
          }
        }

        const q = String((args && args.topic) || '').trim().toLowerCase()
        if (!q) {
          return { text: '请给出主题，或设置 list 为 true 列出全部。\n\n' + visible.map((x) => '- ' + x.title).join('\n') }
        }
        const hit = visible.find((x) => x.title.toLowerCase().includes(q) || x.id.includes(q))
          || visible.find((x) => x.summary.toLowerCase().includes(q) || x.question.toLowerCase().includes(q))
        if (!hit) {
          return { text: '没有找到该主题。可用的有：\n' + visible.map((x) => '- ' + x.title).join('\n') }
        }
        const lines = [
          '# ' + hit.title,
          '**问题**：' + hit.question,
          '',
          hit.summary,
          '',
          '## 三种答案',
          ...hit.sides.map((side) => '- **' + side.name + '**：' + side.view),
          '',
          '## 留给读者的问题',
          hit.discussion,
        ]
        return { text: lines.join('\n') }
      },
    }, 'middle-earth-atlas: middle_earth_theme tool')

    register({
      name: 'middle_earth_analysis',
      description:
        'Quantitative analysis of the character relationship network: degree centrality, betweenness centrality, '
        + 'average path length and diameter, and which characters bridge which factions. Use it for '
        + '"谁是中土关系最核心的人" or "任意两人平均相隔几跳".',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'integer', description: 'Rows per ranking, default 10.' },
        },
        additionalProperties: false,
      },
      output: textOutput,
      async execute(args) {
        const a = networkSummary({ limit: Number((args && args.limit)) || 10 })
        const lines = [
          '**关系网络**：' + a.nodes + ' 个角色，' + a.relations + ' 条关系，密度 ' + a.density,
          '',
          '**连接最多（度数中心性）**',
          ...a.degree.top.map((r, i) => (i + 1) + '. ' + r.name + '（' + r.degree + ' 位直接关系·' + r.factionLabel + '）'),
          '',
          '**最关键的桥（中介中心性）**',
          ...a.betweenness.top.map((r, i) => (i + 1) + '. ' + r.name + '（' + r.betweenness + '）'),
          '',
          '**距离**：平均 ' + a.paths.averageDistance + ' 跳，直径 ' + a.paths.diameter + ' 跳'
            + (a.paths.connected ? '，全图连通' : '，有 ' + a.paths.unreachablePairs + ' 对不可达'),
          '',
          '**跨阵营的桥**',
          ...a.bridges.top.map((r) => '- ' + r.name + '：连接 ' + r.bridgesTo.map((f) => f.name).join('、')),
        ]
        return { text: lines.join('\n') }
      },
    }, 'middle-earth-atlas: middle_earth_analysis tool')


    register({
      name: 'middle_earth_progress',
      description:
        'Show what characters a reader has met at a given point in the story. Groups works by '
        + 'reading order and lists the cast of each, with whether it is still locked at the '
        + 'reader spoiler level. Use it for "我读完霍比特人会认识谁".',
      parameters: {
        type: 'object',
        properties: {
          maxTier: { type: 'integer', description: 'Reading progress 1-3: 1 = after The Hobbit, 2 = after LOTR, 3 = everything.' },
        },
        additionalProperties: false,
      },
      output: textOutput,
      async execute(args) {
        const result = readingProgress(args && args.maxTier)
        const lines = ['**阅读进度**（' + result.maxTier + ' 级）：', '']
        for (const w of result.works) {
          lines.push('- ' + (w.locked ? '🔒 ' : '') + w.title + '：' + w.castCount + ' 位角色，'
            + w.eventCount + ' 个事件')
          if (!w.locked) {
            lines.push('  ' + w.cast.slice(0, 6).map((c) => c.name + '(' + c.role + ')').join('、'))
          }
        }
        return { text: lines.join('\n') }
      },
    }, 'middle-earth-atlas: middle_earth_progress tool')

    register({
      name: 'middle_earth_journey',
      description:
        'Walk one character through the story in order: every event they appear in, tagged as '
        + 'driving the scene, named in it, or merely present. Use it to answer "what does this '
        + 'character actually live through" or to follow one thread across the trilogy.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Character name or id, e.g. 弗罗多 / frodo' },
          maxTier: { type: 'integer', description: 'Spoiler ceiling 1-3; events above it are locked rather than described.' },
        },
        required: ['name'],
        additionalProperties: false,
      },
      output: textOutput,
      async execute(args) {
        return { text: journeyText(characterJourney((args && args.name) || '', args && args.maxTier)) }
      },
    }, 'middle-earth-atlas: middle_earth_journey tool')

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
          maxTier: { type: 'integer', description: 'Reading progress ceiling 1-3: 1 = safe after The Hobbit, 2 = after The Lord of the Rings, 3 = everything (default).' },
        },
        additionalProperties: false,
      },
      output: textOutput,
      async execute(args) {
        const query = (args && args.query) || ''
        if (args && args.scope === 'characters') {
          const hits = searchCharacters(query, {
            faction: args.faction, work: args.work, maxTier: args.maxTier,
          })
          if (!hits.length) return { text: '没有找到匹配的角色。' }
          return {
            text: hits.slice(0, 15).map((c) =>
              `- ${c.name}（${c.nameEn}）· ${c.factionLabel} · ${c.kind} · 来源：${c.canon}\n  ${c.summary}`
            ).join('\n'),
          }
        }
        const result = searchAll(query, { maxTier: args && args.maxTier })
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
          maxTier: { type: 'integer', description: 'Reading progress ceiling 1-3: 1 = safe after The Hobbit, 2 = after The Lord of the Rings, 3 = everything (default).' },
        },
        required: ['name'],
        additionalProperties: false,
      },
      output: textOutput,
      async execute(args) {
        const name = (args && args.name) || ''
        const kind = (args && args.kind) || ''
        // The tool schema advertises maxTier — honour the caller's ceiling.
        const tier = { maxTier: (args && args.maxTier) }
        const prefer = (k) => !kind || kind === k

        if (prefer('character')) {
          const d = characterDetail(name, tier)
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
          const p = placeDetail(name, tier)
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
          const a = artifactDetail(name, tier)
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
          const g = glossaryDetail(name, tier)
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
          maxTier: { type: 'integer', description: 'Reading progress ceiling 1-3: 1 = safe after The Hobbit, 2 = after The Lord of the Rings, 3 = everything (default).' },
        },
        additionalProperties: false,
      },
      output: textOutput,
      async execute(args) {
        const result = timeline({
          work: args && args.work, character: args && args.character,
          age: args && args.age, maxTier: args && args.maxTier,
        })
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
          maxTier: { type: 'integer', description: 'Reading progress ceiling 1-3: 1 = safe after The Hobbit, 2 = after The Lord of the Rings, 3 = everything (default).' },
        },
        additionalProperties: false,
      },
      output: textOutput,
      async execute(args) {
        const tier = { maxTier: (args && args.maxTier) }
        if (args && args.from && args.to) {
          const result = relationPath(args.from, args.to, tier)
          if (!result.ok) return { text: result.error || '未找到关系路径。' }
          return {
            text: `关系路径（${result.hops} 跳）：\n`
              + result.steps.map((s, i) => `${i + 1}. ${s.from} —[${s.label || '已隐藏'}]→ ${s.to}`).join('\n'),
          }
        }
        if (args && args.focus) {
          const n = neighbors(args.focus, tier)
          if (!n) return { text: '没有找到这个角色。' }
          const lines = [`**${n.character.name}** 的关系（${Object.values(n.groups).reduce((a, g) => a + g.length, 0)} 条）`]
          for (const [type, items] of Object.entries(n.groups)) {
            const label = items[0] ? items[0].typeLabel : type
            lines.push(`- ${label}：` + items.map((i) => `${i.name}${i.label ? `（${i.label}）` : '（🔒）'}`).join('、'))
          }
          return { text: lines.join('\n') }
        }
        const g = buildGraph({ faction: args && args.faction, maxTier: args && args.maxTier })
        const top = [...g.nodes].sort((a, b) => (b.degree || 0) - (a.degree || 0)).slice(0, 8)
        return {
          text: [
            `关系图谱：${g.nodes.length} 个角色，${g.edges.length} 条关系。`,
            '', '关系最多的角色：',
            ...top.map((n, i) => `${i + 1}. ${n.label}（${n.degree || 0} 条）`),
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
        return { text: ask((args && args.question) || '', { maxTier: args && args.maxTier }) }
      },
    }, 'middle-earth-atlas: middle_earth_ask tool')

    register({
      name: 'middle_earth_play',
      description:
        'Walk one avatar journey: play as a character and face the decisions they actually faced. Each scene is anchored '
        + 'to a real timeline event and offers several choices; exactly one follows the book. Use maxTier to withhold '
        + 'spoilers (1 = setup only, 2 = mid-plot, 3 = endings). With no name, list the playable characters.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Playable character name or id, e.g. 弗罗多 / sam / 伊欧玟. Omit to list them.' },
          maxTier: { type: 'integer', description: 'Spoiler ceiling 1–3; omit for everything.' },
        },
        additionalProperties: false,
      },
      output: textOutput,
      async execute(args) {
        const maxTier = optionalTier(args && args.maxTier)
        const name = (args && args.name) || ''
        if (!name.trim()) {
          const list2 = avatarList({ maxTier })
          if (!list2.length) return { text: '这个剧透等级下没有可扮演的角色。' }
          return {
            text: '可扮演的角色（剧透等级 ≤' + maxTier + '）：\n'
              + list2.map((a) => `- ${a.name}（${a.theme} · ${a.sceneCount}/${a.totalScenes} 幕）— ${a.tagline}`).join('\n')
              + '\n\n用 middle_earth_play 加上 name 开始。',
          }
        }
        const journey = avatarJourney(name, { maxTier })
        if (!journey) return { text: '没有找到这个可扮演的角色。' }
        const lines = [
          `# 化身之旅：${journey.name}（${journey.nameEn}）`,
          `${journey.factionLabel} · 主题：${journey.theme} · 难度：${journey.difficulty}`,
          '', `> ${journey.tagline}`, '',
          `**开场**：${journey.opening}`,
        ]
        if (journey.hiddenScenes > 0) {
          lines.push('', `（剧透等级 ≤${maxTier}，另有 ${journey.hiddenScenes} 幕被隐藏。）`)
        }
        journey.scenes.forEach((scene, i) => {
          lines.push('', `## 第 ${i + 1} 幕 · ${scene.title}（等级 ${scene.tier}）`)
          if (scene.place) lines.push(`地点：${scene.place.name}（${scene.place.region}）`)
          if (scene.event) lines.push(`对应事件：${scene.event.year} ${scene.event.title}`)
          lines.push('', scene.narration, '', `**抉择**：${scene.stakes}`)
          scene.choices.forEach((c) => {
            lines.push(`- [${c.toneLabel}] ${c.label}`)
            lines.push(`  结果：${c.result}`)
            if (c.note) lines.push(`  注：${c.note}`)
          })
        })
        return { text: lines.join('\n') }
      },
    }, 'middle-earth-atlas: middle_earth_play tool')

    register({
      name: 'middle_earth_judge',
      description:
        'Score how closely a player\'s avatar journey followed the book. Pass the character and the choices as '
        + 'scene/choice pairs; returns the verdict, ratio, and which moments diverged from Tolkien.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Playable character name or id' },
          choices: {
            type: 'array',
            description: 'Array of { scene: sceneId, choice: choiceIndex } entries',
            items: {
              type: 'object',
              properties: {
                scene: { type: 'string', description: 'Scene id, e.g. fr1' },
                choice: { type: 'integer', description: 'Zero-based choice index' },
              },
              required: ['scene', 'choice'],
            },
          },
        },
        required: ['name'],
        additionalProperties: false,
      },
      output: textOutput,
      async execute(args) {
        const result = judgeJourney((args && args.name) || '', (args && args.choices) || [], { maxTier: args && args.maxTier })
        if (!result) return { text: '没有找到这个可扮演的角色。' }
        const lines = [
          `**${result.name}** 的旅程评分：${result.verdict}`,
          result.summary,
          '',
        ]
        result.decisions.forEach((d, i) => {
          const mark = d.followedBook ? '✓ 忠于原著' : d.chosen ? '✗ 偏离原著' : '— 未选择'
          lines.push(`${i + 1}. ${d.sceneTitle}：${mark}`)
          if (d.chosen) lines.push(`   你的选择：${d.chosen.label}`)
          if (d.chosen && !d.followedBook && d.canonChoice) lines.push(`   原著是：${d.canonChoice.label}`)
        })
        return { text: lines.join('\n') }
      },
    }, 'middle-earth-atlas: middle_earth_judge tool')
  })

  // ---- Browser routes ----------------------------------------------------
  ctx.inject(['webServer'], (webCtx) => {
    const register = (path, compute, label) =>
      webCtx.effect(() => webCtx.webServer.register({ kind: 'exact', path, handler: routeHandler(path, compute) }), label)

    // Client diagnostic channel: the browser reports render errors here so a
    // blank panel can be diagnosed without access to the browser console.
    webCtx.effect(() => webCtx.webServer.register({
      kind: 'exact',
      path: CLIENT_ERROR_PATH,
      handler: (req, res) => {
        if (req.method === 'GET') {
          json(res, 200, { errors: clientErrors })
          return
        }
        json(res, 405, { error: 'method not allowed' })
      },
    }), 'middle-earth-atlas: client error route')

    webCtx.effect(() => webCtx.webServer.register({
      kind: 'exact',
      path: CLIENT_ERROR_PATH + '/report',
      handler: (req, res) => {
        if (req.method === 'GET') {
          const params = readQuery(req, CLIENT_ERROR_PATH + '/report')
          recordClientError({
            message: (params.get('message') || '').slice(0, 500),
            stack: (params.get('stack') || '').slice(0, 2000),
            context: params.get('context') || 'window.onerror',
          })
          json(res, 200, { ok: true })
          return
        }
        json(res, 405, { error: 'method not allowed' })
      },
    }), 'middle-earth-atlas: client error report route')

    register(BUNDLE_PATH, (p) => bundle({ maxTier: p.get('maxTier') }),
      'middle-earth-atlas: bundle route')

    register(SEARCH_PATH, (p) => ({
      results: searchCharacters(p.get('q') || '', {
        faction: p.get('faction') || undefined,
        work: p.get('work') || undefined,
        kind: p.get('kind') || undefined,
        maxTier: p.get('maxTier'),
      }),
      counts: counts(),
    }), 'middle-earth-atlas: search route')

    register(ALL_PATH, (p) => searchAll(p.get('q') || '', { maxTier: p.get('maxTier') }),
      'middle-earth-atlas: universal search route')

    register(DETAIL_PATH, (p) => characterDetail(p.get('id') || p.get('q') || '', { maxTier: p.get('maxTier') })
      || { error: '没有找到该角色' }, 'middle-earth-atlas: detail route')

    register(PLACE_PATH, (p) => placeDetail(p.get('id') || p.get('q') || '', { maxTier: p.get('maxTier') })
      || { error: '没有找到该地点' }, 'middle-earth-atlas: place route')

    register(ARTIFACT_PATH, (p) => artifactDetail(p.get('id') || p.get('q') || '', { maxTier: p.get('maxTier') })
      || { error: '没有找到该物品' }, 'middle-earth-atlas: artifact route')

    register(GLOSSARY_PATH, (p) => glossaryDetail(p.get('id') || p.get('q') || '', { maxTier: p.get('maxTier') })
      || { error: '没有找到该术语' }, 'middle-earth-atlas: glossary route')

    register(GRAPH_PATH, (p) => buildGraph({
      focus: p.get('focus') || undefined,
      ids: list(p.get('ids')),
      faction: p.get('faction') || undefined,
      age: p.get('age') || undefined,
      maxTier: p.get('maxTier'),
    }), 'middle-earth-atlas: graph route')

    register(NEIGHBORS_PATH, (p) => neighbors(p.get('id') || p.get('q') || '', { maxTier: p.get('maxTier') })
      || { error: '没有找到该角色' }, 'middle-earth-atlas: neighbors route')

    register(PATH_PATH, (p) => relationPath(p.get('from') || '', p.get('to') || '', { maxTier: p.get('maxTier') }),
      'middle-earth-atlas: relation path route')

    register(TIMELINE_PATH, (p) => timeline({
      work: p.get('work') || undefined,
      character: p.get('character') || undefined,
      age: p.get('age') || undefined,
      maxTier: p.get('maxTier'),
    }), 'middle-earth-atlas: timeline route')

    register(PLOT_PATH, (p) => ({ plots: plot({ work: p.get('work') || undefined, maxTier: p.get('maxTier') }) }),
      'middle-earth-atlas: plot route')

    register(JOURNEYS_PATH, (p) => ({ journeys: journeys({ work: p.get('work') || undefined, maxTier: p.get('maxTier') }) }),
      'middle-earth-atlas: journeys route')

    register(PROGRESS_PATH, (p) => readingProgress(p.get('maxTier')),
      'middle-earth-atlas: reading progress route')

    register(JOURNEY_PATH, (p) => {
      const journey = characterJourney(p.get('id') || p.get('q') || '', p.get('maxTier'))
      return journey || { error: '没有找到这个角色' }
    }, 'middle-earth-atlas: character journey route')

    register(THEMES_PATH, (p) => {
      // Clamp through normalizeTier semantics: anything non-numeric / out of
      // range falls back to MAX_TIER, like every other route.
      const raw = Number(p.get('maxTier'))
      const maxTier = Number.isFinite(raw) ? Math.max(1, Math.min(MAX_TIER, Math.round(raw))) : MAX_TIER
      const themes = THEMES.filter((x) => (x.tier || MAX_TIER) <= maxTier)
      return { themes, total: THEMES.length, visible: themes.length, maxTier }
    }, 'middle-earth-atlas: themes route')

    register(ANALYSIS_PATH, (p) => networkSummary({
      limit: Number(p.get('limit')) || 10,
    }), 'middle-earth-atlas: network analysis route')

    register(SPOILER_PATH, () => ({
      maxTier: MAX_TIER,
      tiers: TIER_LABELS,
      overrides: Object.keys(RECORD_TIER).length,
    }), 'middle-earth-atlas: spoiler tiers route')

    register(ASK_PATH, (p) => ({
      answer: ask(p.get('q') || '', { maxTier: p.get('maxTier') }),
      suggestions: suggestions(),
    }), 'middle-earth-atlas: ask route')

    register(AVATARS_PATH, (p) => ({
      avatars: avatarList({ maxTier: optionalTier(p.get('maxTier')) }),
    }), 'middle-earth-atlas: avatar list route')

    register(AVATAR_PATH, (p) => {
      const journey = avatarJourney(p.get('id') || '', { maxTier: optionalTier(p.get('maxTier')) })
      return journey || { error: '没有找到这个可扮演的角色' }
    }, 'middle-earth-atlas: avatar journey route')

    // Scoring reads the whole choice list; GET with a compact query is
    // supported so the browser can link to a result (routeHandler only
    // accepts GET/HEAD).
    register(AVATAR_JUDGE_PATH, (p) => {
      const id = p.get('id') || ''
      let choices = []
      try {
        choices = JSON.parse(p.get('choices') || '[]')
      } catch {
        return { error: 'choices 不是合法的 JSON' }
      }
      const result = judgeJourney(id, choices, { maxTier: p.get('maxTier') })
      return result || { error: '没有找到这个可扮演的角色' }
    }, 'middle-earth-atlas: avatar judge route')
  })
}
