/**
 * Middle-earth Atlas — Client half.
 *
 * A `sidebar.panellist` row opens a `main` panel with a rich, friendly tour of
 * Middle-earth: an overview dashboard, a searchable encyclopedia, an
 * interactive relationship graph, the timeline, places & artifacts, glossary &
 * quotes, plot beats & journeys, reading paths, book-vs-screen differences,
 * and a question box.
 *
 * Data lives in the Host; this module renders and nothing else.
 */

window.__ModuleLoader__.load({
  id: '@naturalth2012/middle-earth-atlas',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'middle-earth-atlas'
    const PANEL_ID = 'middle-earth-atlas'
    const BASE = '/plugins/middle-earth-atlas'
    const BUNDLE_PATH = BASE + '/bundle'
    const DETAIL_PATH = BASE + '/detail'
    const PLACE_PATH = BASE + '/place'
    const ARTIFACT_PATH = BASE + '/artifact'
    const GLOSSARY_PATH = BASE + '/glossary'
    const GRAPH_PATH = BASE + '/graph'
    const PATH_PATH = BASE + '/path'
    const ASK_PATH = BASE + '/ask'
    const AVATARS_PATH = BASE + '/avatars'
    const AVATAR_PATH = BASE + '/avatar'
    const AVATAR_JUDGE_PATH = BASE + '/avatar-judge'
    /* --- avatar-tab:begin (generated from avatar-tab.js — do not edit here) --- */
    const buildAvatarTab = ({ h, React, t, paths, storage }) => {
  const { AVATARS_PATH, AVATAR_PATH, AVATAR_JUDGE_PATH } = paths

  // The storage adapter is injected; when the host cannot persist (private
  // mode, disabled storage) it is a null-safe no-op and the journey still runs.
  const store = storage || {
    restore: () => null,
    persist: () => false,
    clear: () => false,
    rememberedTier: () => null,
  }

  /**
   * The atmosphere layer: an optional, collapsed sensory note per scene.
   *
   * Native <details> gives keyboard support and screen-reader semantics for
   * free. It is collapsed by default so it never competes with the decision.
   */
  const renderAtmosphere = (scene, tr) => {
    const a = scene && scene.atmosphere
    if (!a) return null
    const rows = [
      ['sight', '👁', tr('atmoSight')],
      ['sound', '👂', tr('atmoSound')],
      ['touch', '✋', tr('atmoTouch')],
      ['smell', '👃', tr('atmoSmell')],
    ]
      .filter(([key]) => a[key])
      .map(([key, icon, label]) => h('div', { key, className: 'mea-atmo-row' },
        h('span', { className: 'mea-atmo-icon', 'aria-hidden': 'true' }, icon),
        h('span', { className: 'mea-atmo-label' }, label),
        h('span', { className: 'mea-atmo-text' }, a[key])))

    return h('details', { className: 'mea-atmosphere' },
      h('summary', null, tr('atmoOpen')),
      ...rows,
      scene.atmosphereNote
        ? h('p', { className: 'mea-atmo-note' }, scene.atmosphereNote)
        : null)
  }

  const getJSON = async (url) => {
    const res = await fetch(url)
    if (!res.ok) throw new Error('HTTP ' + res.status)
    return res.json()
  }

  /* ---------------------------------------------------------------- *
   * One journey player
   * ---------------------------------------------------------------- */
  const Player = ({ avatar, tier, onExit }) => {
    const [journey, setJourney] = React.useState(null)
    const [failed, setFailed] = React.useState(false)
    const [step, setStep] = React.useState(0)
    const [picks, setPicks] = React.useState({})
    const [revealed, setRevealed] = React.useState({})
    const [judgement, setJudgement] = React.useState(null)

    React.useEffect(() => {
      let alive = true
      setJourney(null); setFailed(false); setStep(0); setPicks({}); setRevealed({}); setJudgement(null)
      getJSON(AVATAR_PATH + '?id=' + encodeURIComponent(avatar.id) + '&maxTier=' + tier)
        .then((d) => {
          if (!alive) return
          if (!d || d.error) { setFailed(true); return }
          // Restore a previous session before the first paint of the journey.
          // The snapshot is validated against the payload we just received, so
          // a save from an older dataset is trimmed rather than trusted.
          const saved = store.restore(avatar.id, d)
          if (saved) {
            setPicks(saved.picks)
            setStep(saved.step)
            // Mark restored scenes as revealed so the outcome stays visible.
            const revealedNow = {}
            for (const sceneId of Object.keys(saved.picks)) revealedNow[sceneId] = true
            setRevealed(revealedNow)
          }
          setJourney(d)
        })
        .catch(() => { if (alive) setFailed(true) })
      return () => { alive = false }
    }, [avatar.id, tier])

    if (failed) {
      return h('div', { className: 'mea-avatar-card' },
        h('div', { className: 'mea-kicker' }, t('avatarLoadFail')),
        h('button', { className: 'mea-btn', onClick: onExit }, t('avatarBack')))
    }
    if (!journey) {
      return h('div', { className: 'mea-avatar-card mea-avatar-loading' },
        h('div', { className: 'mea-spin', 'aria-hidden': 'true' }, '💍'), h('div', null, t('loading')))
    }

    const scenes = journey.scenes
    const scene = scenes[step]
    const picked = picks[scene.id]
    const showResult = revealed[scene.id]
    const isLast = step === scenes.length - 1

    const pick = (index) => {
      if (picked !== undefined) return
      const nextPicks = { ...picks, [scene.id]: index }
      setPicks(nextPicks)
      setRevealed((prev) => ({ ...prev, [scene.id]: true }))
      // Persist immediately: a reload mid-scene should resume here.
      store.persist(avatar.id, { picks: nextPicks, step, tier })
    }

    const finish = async () => {
      const choices = scenes
        .filter((s) => picks[s.id] !== undefined)
        .map((s) => ({ scene: s.id, choice: picks[s.id] }))
      try {
        const result = await getJSON(
          AVATAR_JUDGE_PATH + '?id=' + encodeURIComponent(journey.id)
          + '&choices=' + encodeURIComponent(JSON.stringify(choices)))
        setJudgement(result && !result.error ? result : null)
        // The journey is over: drop the save so replaying starts from scene 1.
        store.clear(avatar.id)
      } catch {
        setJudgement(null)
      }
    }

    /* --- result screen --- */
    if (judgement) {
      const rows = judgement.decisions.map((d, i) => {
        const mark = d.followedBook ? '✓' : d.chosen ? '✗' : '—'
        const cls = d.followedBook ? 'mea-jd-good' : d.chosen ? 'mea-jd-bad' : 'mea-jd-none'
        return h('div', { key: d.sceneId, className: 'mea-jd-row' },
          h('span', { className: 'mea-jd-mark ' + cls }, mark),
          h('div', null,
            h('b', null, (i + 1) + '. ' + d.sceneTitle),
            d.chosen ? h('small', null, t('avatarYourPick') + '：' + d.chosen.label) : null,
            (d.chosen && !d.followedBook && d.canonChoice)
              ? h('small', { className: 'mea-jd-canon' }, t('avatarCanonWas') + '：' + d.canonChoice.label)
              : null))
      })
      return h('div', { className: 'mea-avatar-card' },
        h('div', { className: 'mea-av-header' },
          h('div', { className: 'mea-av-badge' }, journey.nameEn ? journey.nameEn.slice(0, 1) : '★'),
          h('div', null,
            h('h2', null, t('avatarResultTitle')),
            h('div', { className: 'mea-kicker' }, journey.name + ' · ' + journey.theme))),
        h('div', { className: 'mea-verdict', 'aria-live': 'polite' },
          h('div', { className: 'mea-verdict-label' }, judgement.verdict),
          h('div', {
            className: 'mea-verdict-bar',
            role: 'progressbar',
            'aria-valuenow': Math.round(judgement.ratio * 100),
            'aria-valuemin': 0,
            'aria-valuemax': 100,
            'aria-label': t('avatarScore'),
          }, h('i', { style: { width: Math.round(judgement.ratio * 100) + '%' } })),
          h('div', { className: 'mea-kicker' }, judgement.summary)),
        h('div', { className: 'mea-jd-list' }, ...rows),
        h('div', { className: 'mea-avatar-actions' },
          h('button', {
            className: 'mea-btn mea-primary',
            onClick: () => { setJudgement(null); setPicks({}); setRevealed({}); setStep(0) },
          }, t('avatarReplay')),
          h('button', { className: 'mea-btn', onClick: onExit }, t('avatarBack'))))
    }

    /* --- scene screen --- */
    const choices = scene.choices.map((c) => {
      const isPicked = picked === c.index
      const dimmed = picked !== undefined && !isPicked
      const cls = 'mea-choice' + (isPicked ? ' mea-choice-picked' : '') + (dimmed ? ' mea-choice-dim' : '')
        + (c.canon ? ' mea-choice-canon' : '')
      return h('button', {
        key: c.index,
        className: cls,
        onClick: () => pick(c.index),
        disabled: picked !== undefined,
        'aria-pressed': isPicked ? 'true' : 'false',
      },
        h('span', { className: 'mea-choice-label' }, c.label),
        h('span', { className: 'mea-choice-tone' }, c.toneLabel))
    })

    let outcome = null
    if (showResult) {
      const chosen = scene.choices.find((c) => c.index === picked)
      const canonChoice = scene.choices.find((c) => c.canon)
      outcome = h('div', { className: 'mea-outcome', 'aria-live': 'polite' },
        h('div', { className: 'mea-outcome-head' },
          h('span', { className: 'mea-outcome-tag' }, chosen.toneLabel),
          chosen.canon ? h('span', { className: 'mea-outcome-canon' }, t('avatarFollowedBook')) : null),
        h('p', { className: 'mea-outcome-text' }, chosen.result),
        chosen.note ? h('p', { className: 'mea-outcome-note' }, chosen.note) : null,
        (!chosen.canon && canonChoice) ? h('div', { className: 'mea-canon-box' },
          h('div', { className: 'mea-kicker' }, t('avatarCanonWas')),
          h('div', null, canonChoice.label),
          canonChoice.note ? h('p', { className: 'mea-outcome-note' }, canonChoice.note) : null) : null)
    }

    const progress = Math.round(((step + (showResult ? 1 : 0)) / scenes.length) * 100)

    return h('div', { className: 'mea-avatar-card' },
      h('div', { className: 'mea-av-header' },
        h('div', { className: 'mea-av-badge' }, journey.nameEn ? journey.nameEn.slice(0, 1) : '★'),
        h('div', { style: { flex: 1 } },
          h('h2', null, journey.name),
          h('div', { className: 'mea-kicker' }, journey.theme + ' · ' + journey.difficulty)),
        h('button', { className: 'mea-btn', onClick: onExit }, t('avatarBack'))),
      h('div', {
        className: 'mea-progress',
        role: 'progressbar',
        'aria-valuenow': progress,
        'aria-valuemin': 0,
        'aria-valuemax': 100,
        'aria-label': t('avatarProgress'),
      }, h('i', { style: { width: progress + '%' } })),
      h('div', { className: 'mea-kicker', style: { marginTop: 8 } },
        t('avatarSceneOf', { n: step + 1, total: scenes.length })),
      h('h3', { className: 'mea-scene-title' }, scene.title),
      h('div', { className: 'mea-scene-meta' },
        scene.place ? h('span', { className: 'mea-tag' }, '📍 ' + scene.place.name) : null,
        scene.event ? h('span', { className: 'mea-tag' }, '🕰️ ' + scene.event.year + ' ' + scene.event.title) : null),
      h('p', { className: 'mea-narration' }, scene.narration),
      renderAtmosphere(scene, t),
      h('p', { className: 'mea-stakes' }, scene.stakes),
      h('div', { className: 'mea-choices', role: 'group', 'aria-label': t('avatarChoices') }, ...choices),
      outcome,
      showResult ? h('div', { className: 'mea-avatar-actions' },
        isLast
          ? h('button', { className: 'mea-btn mea-primary', onClick: finish }, t('avatarSeeVerdict'))
          : h('button', {
            className: 'mea-btn mea-primary',
            onClick: () => {
              const nextStep = Math.min(scenes.length - 1, step + 1)
              setStep(nextStep)
              store.persist(avatar.id, { picks, step: nextStep, tier })
            },
          }, t('avatarNext'))) : null,
      (journey.hiddenScenes > 0) ? h('p', { className: 'mea-kicker', style: { marginTop: 10 } },
        t('avatarHidden', { n: journey.hiddenScenes })) : null)
  }

  /* ---------------------------------------------------------------- *
   * The tab: avatar picker + spoiler control + player
   * ---------------------------------------------------------------- */
  return function AvatarJourneyTab({ data, t: tt }) {
    const tr = tt || t
    const [tier, setTier] = React.useState(1)
    const [active, setActive] = React.useState(null)

    // 恢复上次的剧透等级：在父组件完成，避免与 Player 的 effect 依赖打架。
    const openAvatar = (avatar) => {
      const remembered = store.rememberedTier(avatar.id)
      if (remembered) setTier(remembered)
      setActive(avatar)
    }

    if (active) {
      return h(Player, { avatar: active, tier, onExit: () => setActive(null) })
    }

    const tierButton = (value, label) => h('button', {
      key: value,
      className: 'mea-chip' + (tier === value ? ' mea-on' : ''),
      onClick: () => setTier(value),
    }, label)

    const avatars = data.avatars || []
    const cards = avatars.map((avatar) => {
      const blocked = avatar.sceneCount === 0
      return h('button', {
        key: avatar.id,
        className: 'mea-avatar-tile' + (blocked ? ' mea-avatar-blocked' : ''),
        disabled: blocked,
        onClick: () => openAvatar(avatar),
      },
        h('div', { className: 'mea-av-tile-top' },
          h('div', { className: 'mea-av-badge', 'aria-hidden': 'true' },
            avatar.nameEn ? avatar.nameEn.slice(0, 1) : '★'),
          h('div', { style: { flex: 1, textAlign: 'left' } },
            h('b', null, avatar.name),
            h('small', null, avatar.factionLabel + ' · ' + avatar.difficulty))),
        h('div', { className: 'mea-av-tagline' }, avatar.tagline),
        avatar.voice ? h('div', { className: 'mea-av-voice' }, '🗣 ' + avatar.voice) : null,
        h('div', { className: 'mea-av-meta' },
          h('span', { className: 'mea-tag' }, avatar.theme),
          h('span', { className: 'mea-tag' },
            blocked ? tr('avatarLocked')
              : tr('avatarScenes', { n: avatar.sceneCount, total: avatar.totalScenes }))))
    })

    return h(React.Fragment, null,
      h('div', { className: 'mea-avatar-intro' },
        h('h3', null, '🎭 ' + tr('avatarTitle')),
        h('p', null, tr('avatarIntro')),
        h('div', { className: 'mea-tier-row' },
          h('span', { className: 'mea-kicker', style: { margin: 0 } }, tr('avatarSpoiler')),
          tierButton(1, tr('avatarTier1')),
          tierButton(2, tr('avatarTier2')),
          tierButton(3, tr('avatarTier3')))),
      avatars.length === 0
        ? h('div', { className: 'mea-empty' }, tr('avatarNone'))
        : h('div', { className: 'mea-avatar-grid' }, ...cards))
  }
    }
    /* --- avatar-tab:end --- */
/* ------------------------------------------------------------------ *
     * Storage adapter for avatar journeys.
     *
     * Kept outside the generated avatar-tab block so re-inlining cannot remove
     * it. Every access is wrapped: a storage failure must never break a journey.
     * ------------------------------------------------------------------ */
    // Snapshot validation rules, identical to validate-source.js. Kept as a
    // source string so the browser compiles the same logic the Host tests
    // exercise, instead of a second hand-written copy that could drift.
    const AVATAR_VALIDATE_SOURCE = `(raw, journey, version) => {
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
    const validateSnapshotShared = new Function('return ' + AVATAR_VALIDATE_SOURCE)()

    const SNAPSHOT_VERSION = 1
    const SNAPSHOT_PREFIX = 'mea:avatar:v' + SNAPSHOT_VERSION + ':'
    const TIER_PREFIX = 'mea:avatar:tier:'

    function safeStorage() {
      try {
        const probe = '__mea_probe__'
        window.localStorage.setItem(probe, '1')
        window.localStorage.removeItem(probe)
        return window.localStorage
      } catch {
        return null
      }
    }

    function buildAvatarStorage() {
      const media = safeStorage()

      const read = (key) => {
        if (!media) return null
        try { return media.getItem(key) } catch { return null }
      }
      const write = (key, value) => {
        if (!media) return false
        try { media.setItem(key, value); return true } catch { return false }
      }
      const drop = (key) => {
        if (!media) return false
        try { media.removeItem(key); return true } catch { return false }
      }

      return {
        /** Validate a stored snapshot against the journey just loaded. */
        restore(avatarId, journey) {
          const raw = read(SNAPSHOT_PREFIX + avatarId)
          if (!raw) return null
          let parsed
          try { parsed = JSON.parse(raw) } catch { return null }
          // Same rules the Host tests: one source, two executions.
          return validateSnapshotShared(parsed, journey, SNAPSHOT_VERSION)
        },

        /** Persist the current decisions. Never throws. */
        persist(avatarId, state) {
          const picks = {}
          const source = state && state.picks
          if (source && typeof source === 'object') {
            for (const sceneId of Object.keys(source)) {
              const index = source[sceneId]
              if (!Number.isInteger(index) || index < 0) continue
              picks[sceneId] = index
            }
          }
          const step = Number.isInteger(state && state.step) && state.step > 0 ? state.step : 0
          const tier = [1, 2, 3].includes(state && state.tier) ? state.tier : 1
          const payload = JSON.stringify({ v: SNAPSHOT_VERSION, picks, step, tier, savedAt: Date.now() })
          write(SNAPSHOT_PREFIX + avatarId, payload)
          // The spoiler level outlives a finished journey on purpose.
          write(TIER_PREFIX + avatarId, String(tier))
          return true
        },

        /** Forget a finished journey. */
        clear(avatarId) {
          return drop(SNAPSHOT_PREFIX + avatarId)
        },

        /** The spoiler level last used for this avatar, if any. */
        rememberedTier(avatarId) {
          const raw = read(TIER_PREFIX + avatarId)
          const value = Number(raw)
          return [1, 2, 3].includes(value) ? value : null
        },
      }
    }

/* ------------------------------------------------------------------ *
     * Copy
     * ------------------------------------------------------------------ */
    const ZH = {
      nav: '中土图鉴',
      title: '中土图鉴',
      subtitle: '指环王人物、地点、宝物与剧情，一图理清',
      back: '返回对话',
      loading: '正在展开中土地图…',
      errorTitle: '地图加载失败',
      errorHint: '宿主端没有返回数据，插件可能刚重载。',
      retry: '重试',
      close: '关闭',
      // tabs
      tabOverview: '总览',
      tabCharacters: '人物图鉴',
      tabGraph: '关系图谱',
      tabTimeline: '时间线',
      tabPlaces: '地点与宝物',
      tabLore: '术语与名句',
      tabPlot: '剧情与旅程',
      tabPaths: '入门路线',
      tabDiff: '原著 vs 改编',
      tabAsk: '随手问',
      tabAvatar: '化身之旅',
      // avatar journey
      avatarTitle: '化身之旅 · 走进故事里',
      avatarIntro: '选一个角色，回到他或她真正面对抉择的那一刻。你会看到自己会怎么选，也会看到托尔金实际写了什么——这正是原著最难被替代的部分。',
      avatarSpoiler: '剧透范围',
      avatarTier1: '只看开端',
      avatarTier2: '含中段转折',
      avatarTier3: '全部（含结局）',
      avatarScenes: '{n}/{total} 幕',
      avatarLocked: '此范围内不可玩',
      avatarNone: '这个剧透范围下没有可扮演的角色，试试放宽范围。',
      avatarSceneOf: '第 {n} / {total} 幕',
      avatarNext: '继续',
      avatarSeeVerdict: '看看结局',
      avatarBack: '换个角色',
      avatarReplay: '再走一次',
      avatarResultTitle: '你的旅程评分',
      avatarYourPick: '你的选择',
      avatarCanonWas: '原著里是这样',
      avatarFollowedBook: '✓ 与原著一致',
      avatarHidden: '还有 {n} 幕因剧透范围被隐藏。',
      avatarLoadFail: '这一段旅程没能加载出来，请返回重试。',
      avatarProgress: '旅程进度',
      avatarScore: '与原著的一致程度',
      avatarChoices: '这一幕的选项',
      atmoOpen: '细看这一幕',
      atmoSight: '看见',
      atmoSound: '听见',
      atmoTouch: '触到',
      atmoSmell: '闻到',
      // overview
      ovWelcome: '欢迎来到中土',
      ovIntro: '这不是一份资料列表，而是一张可以走进去的地图。你可以从任何一位人物出发，顺着关系走，或者按时间线把故事串起来。',
      ovStartHere: '从这里开始',
      ovQuick: '快速入口',
      ovCharacters: '人物',
      ovRelations: '条关系',
      ovPlaces: '地点',
      ovArtifacts: '件宝物',
      ovQuotes: '句名句',
      ovEvents: '个事件',
      ovFactions: '阵营分布',
      ovCanon: '来源层级',
      ovCanonNote: '改编不等于原著。本应用把内容分为三层：托尔金原著、电影改编、剧集演绎。',
      // characters
      searchPlaceholder: '搜索人物、地点、宝物、术语… 试试「弗罗多」「末日火山」「至尊魔戒」',
      allFactions: '全部阵营',
      allWorks: '全部作品',
      allKinds: '全部身份',
      resultCount: '找到 {n} 条',
      clearFilters: '清空筛选',
      empty: '没有找到符合条件的内容',
      emptyHint: '换个关键词或清空筛选试试。',
      viewDetail: '查看档案',
      noResults: '暂无结果',
      // dossier
      dossier: '人物档案',
      relations: '主要关系',
      works: '出场作品',
      appearances: '相关事件',
      placesOf: '相关地点',
      artifactsOf: '相关物品',
      quotesOf: '关联名句',
      fate: '结局',
      canon: '来源',
      noRelations: '暂无已收录的关系。',
      noWorks: '暂无作品记录。',
      // graph
      graphHint: '拖动节点可固定位置，滚轮缩放，点击人物聚焦其关系。',
      graphAll: '全部人物',
      graphFocus: '聚焦人物',
      graphReset: '重置视图',
      graphHighlight: '按阵营高亮',
      graphEmpty: '这里还没有关系数据',
      pathTool: '关系路径查询',
      pathFrom: '起点',
      pathTo: '终点',
      pathFind: '查找路径',
      pathPlaceholder: '输入姓名，如「阿拉贡」',
      pathHint: '例如：弗罗多 → 凯兰崔尔，看他们怎么连起来。',
      pathHops: '相距 {n} 跳',
      pathNotFound: '两者之间没有已收录的关系路径。',
      pathSame: '这是同一个人物。',
      // timeline
      timelineHint: '从第一纪元到第四纪元，把关键事件串成一条线。',
      allAges: '全部纪元',
      // places
      placesTitle: '地点',
      artifactsTitle: '宝物与造物',
      placesHint: '中土的地理，也是故事的骨架。',
      // lore
      glossaryTitle: '术语表',
      quotesTitle: '名句',
      loreHint: '理解这些词，才算真正读懂中土。',
      // plot
      plotTitle: '剧情脉络',
      journeyTitle: '旅程路线',
      plotHint: '每部作品的主线，一眼看完。',
      // paths
      pathsHint: '按你的喜好选一条路线，从合适的作品开始。',
      // diff
      diffHint: '改编不等于原著——这些差异值得知道。',
      book: '原著',
      screen: '影视',
      impact: '影响',
      // ask
      askTitle: '随手问一问',
      askPlaceholder: '问一个中土问题，如「索伦是谁」「末日火山在哪里」',
      askButton: '提问',
      askThinking: '正在思考…',
      askFail: '没有拿到答案，请稍后再试。',
      askTryThese: '可以试试：',
      footer: '数据为人工整理的导读资料；细节请以原著与官方作品为准。',
    }

    const EN = {
      nav: 'Middle-earth Atlas', title: 'Middle-earth Atlas',
      subtitle: 'Characters, places, artifacts and plot, all in one map',
      back: 'Back to chat', loading: 'Unfolding the map of Middle-earth…',
      errorTitle: 'Map failed to load', errorHint: 'No data from the host; the plugin may have just reloaded.',
      retry: 'Retry', close: 'Close',
      tabOverview: 'Overview', tabCharacters: 'Characters', tabGraph: 'Relationships',
      tabTimeline: 'Timeline', tabPlaces: 'Places & relics', tabLore: 'Lore & quotes',
      tabPlot: 'Plot & journeys', tabPaths: 'Start here', tabDiff: 'Book vs screen',
      tabAsk: 'Ask',
      tabAvatar: 'Play as',
      avatarTitle: 'Play as a character',
      avatarIntro: 'Pick a character and return to the moment they actually faced a choice. You will see what you would do — and what Tolkien actually wrote. That gap is the point.',
      avatarSpoiler: 'Spoiler range',
      avatarTier1: 'Setup only',
      avatarTier2: 'Include turns',
      avatarTier3: 'Everything',
      avatarScenes: '{n}/{total} scenes',
      avatarLocked: 'Locked at this level',
      avatarNone: 'No playable character at this spoiler level; try widening it.',
      avatarSceneOf: 'Scene {n} of {total}',
      avatarNext: 'Continue',
      avatarSeeVerdict: 'See the verdict',
      avatarBack: 'Pick another',
      avatarReplay: 'Walk it again',
      avatarResultTitle: 'Your journey',
      avatarYourPick: 'You chose',
      avatarCanonWas: 'In the book',
      avatarFollowedBook: '✓ Follows the book',
      avatarHidden: '{n} more scenes are hidden at this spoiler level.',
      avatarLoadFail: 'This journey could not load; go back and retry.',
      avatarProgress: 'Journey progress',
      avatarScore: 'How closely you followed the book',
      avatarChoices: 'Choices for this scene',
      atmoOpen: 'Look closer',
      atmoSight: 'Sight',
      atmoSound: 'Sound',
      atmoTouch: 'Touch',
      atmoSmell: 'Smell',
      ovWelcome: 'Welcome to Middle-earth', ovIntro: 'Not a list of facts but a map you can walk through. Start from any character and follow the relations, or follow the timeline.',
      ovStartHere: 'Start here', ovQuick: 'Quick links',
      ovCharacters: 'characters', ovRelations: 'relations', ovPlaces: 'places',
      ovArtifacts: 'artifacts', ovQuotes: 'quotes', ovEvents: 'events',
      ovFactions: 'Factions', ovCanon: 'Source layers',
      ovCanonNote: 'Adaptation is not canon. Content is grouped into Tolkien, film adaptation, and series interpretation.',
      searchPlaceholder: 'Search characters, places, artifacts, terms… try "Frodo" or "Mount Doom"',
      allFactions: 'All factions', allWorks: 'All works', allKinds: 'All roles',
      resultCount: '{n} results', clearFilters: 'Clear filters',
      empty: 'Nothing matched', emptyHint: 'Try another keyword or clear the filters.',
      viewDetail: 'View profile', noResults: 'No results',
      dossier: 'Character profile', relations: 'Key relationships', works: 'Appearances',
      appearances: 'Related events', placesOf: 'Places', artifactsOf: 'Artifacts',
      quotesOf: 'Quotes', fate: 'Fate', canon: 'Source',
      noRelations: 'No curated relationships yet.', noWorks: 'No works recorded.',
      graphHint: 'Drag nodes to pin, scroll to zoom, click a character to focus.',
      graphAll: 'All characters', graphFocus: 'Focus', graphReset: 'Reset view',
      graphHighlight: 'Highlight faction', graphEmpty: 'No relations to show',
      pathTool: 'Relationship path', pathFrom: 'From', pathTo: 'To', pathFind: 'Find path',
      pathPlaceholder: 'Enter a name, e.g. Aragorn',
      pathHint: 'Try Frodo → Galadriel and see how they connect.',
      pathHops: '{n} hops', pathNotFound: 'No curated path connects these two.',
      pathSame: 'Same character.',
      timelineHint: 'Key events from the First to the Fourth Age.',
      allAges: 'All ages',
      placesTitle: 'Places', artifactsTitle: 'Artifacts & relics',
      placesHint: 'The geography of Middle-earth is the skeleton of the story.',
      glossaryTitle: 'Glossary', quotesTitle: 'Quotes',
      loreHint: 'Know these words and you know Middle-earth.',
      plotTitle: 'Plot arcs', journeyTitle: 'Journeys', plotHint: 'The main storyline of each work at a glance.',
      pathsHint: 'Pick a path and start with the right work.',
      diffHint: 'Adaptation is not canon — here is what changed.',
      book: 'Book', screen: 'Screen', impact: 'Impact',
      askTitle: 'Ask Middle-earth', askPlaceholder: 'Ask a question, e.g. "Who is Sauron?"',
      askButton: 'Ask', askThinking: 'Thinking…', askFail: 'No answer received; please retry.',
      askTryThese: 'Try:', footer: 'A hand-curated study guide; defer to the original texts.',
    }

    const isEnglish = (locale) => {
      const id = typeof locale === 'string' ? locale
        : locale && typeof locale.locale === 'string' ? locale.locale
          : locale && typeof locale.language === 'string' ? locale.language : ''
      return /^en/i.test(id)
    }

    const makeTranslator = (locale, fallback) => (key, vars) => {
      let text = fallback[key]
      if (locale && typeof locale.t === 'function') {
        try {
          const translated = locale.t(NS + '.' + key, vars)
          if (typeof translated === 'string' && translated.indexOf(NS + '.') !== 0) text = translated
        } catch { /* keep the fallback */ }
      }
      if (vars && text) Object.keys(vars).forEach((k) => {
        text = text.replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k]))
      })
      return text === undefined ? key : text
    }

    const getJSON = async (url) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error('HTTP ' + res.status)
      return res.json()
    }

    /* ------------------------------------------------------------------ *
     * Styles — host theme tokens only
     * ------------------------------------------------------------------ */
    function installStyleSheet() {
      if (typeof document === 'undefined' || !document.createElement) return () => {}
      const style = document.createElement('style')
      style.setAttribute('data-plugin', NS)
      style.textContent = `
        .mea-root{display:flex;flex-direction:column;height:100%;min-height:0;color:var(--dsw-alias-label-primary);font-size:14px;line-height:1.6}
        .mea-scroll{flex:1;min-height:0;overflow:auto;padding:22px 26px 36px}
        .mea-head{display:flex;align-items:flex-start;gap:14px;margin-bottom:16px}
        .mea-head h1{margin:0;font-size:25px;font-weight:650;letter-spacing:.3px}
        .mea-head .mea-sub{color:var(--dsw-alias-label-secondary);font-size:13px;margin-top:3px}
        .mea-crest{width:46px;height:46px;flex:0 0 46px;border-radius:13px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);display:flex;align-items:center;justify-content:center;font-size:25px}
        .mea-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:8px;margin:14px 0 18px}
        .mea-stat{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:10px 14px}
        .mea-stat b{display:block;font-size:19px;font-weight:650;line-height:1.2}
        .mea-stat span{color:var(--dsw-alias-label-secondary);font-size:12px}
        .mea-tabs{display:flex;flex-wrap:wrap;gap:4px;border-bottom:1px solid var(--dsw-alias-border-l1);margin-bottom:18px}
        .mea-tab{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary);padding:8px 12px;border-radius:8px 8px 0 0;cursor:pointer;font-size:13.5px;font-weight:500;border-bottom:2px solid transparent;font-family:inherit}
        .mea-tab:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1)}
        .mea-tab.mea-active{color:var(--dsw-alias-brand-primary);border-bottom-color:var(--dsw-alias-brand-primary);font-weight:650}
        .mea-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}
        .mea-input,.mea-select{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;color:var(--dsw-alias-label-primary);padding:8px 11px;font-size:13px;outline:none;font-family:inherit}
        .mea-input:focus,.mea-select:focus{border-color:var(--dsw-alias-brand-primary)}
        .mea-input.mea-grow{flex:1;min-width:200px}
        .mea-btn{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:8px;padding:7px 13px;font-size:13px;cursor:pointer;font-family:inherit}
        .mea-btn:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
        .mea-btn:disabled{opacity:.55;cursor:default}
        .mea-btn.mea-primary{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);font-weight:600}
        .mea-btn.mea-primary:hover:not(:disabled){opacity:.9;color:var(--dsw-alias-bg-base)}
        .mea-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;align-items:center}
        .mea-chip{appearance:none;border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);border-radius:999px;padding:4px 11px;font-size:12px;cursor:pointer;font-family:inherit}
        .mea-chip:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}
        .mea-chip.mea-on{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-1)}
        .mea-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(252px,1fr));gap:11px}
        .mea-card{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:14px;cursor:pointer;transition:transform .12s,border-color .12s;display:flex;flex-direction:column;gap:7px}
        .mea-card:hover{transform:translateY(-2px);border-color:var(--dsw-alias-brand-primary)}
        .mea-card-top{display:flex;align-items:center;gap:9px}
        .mea-dot{width:10px;height:10px;border-radius:50%;flex:0 0 10px}
        .mea-card h3{margin:0;font-size:15px;font-weight:650;line-height:1.35}
        .mea-card .mea-en{color:var(--dsw-alias-label-secondary);font-size:12px}
        .mea-card p{margin:0;color:var(--dsw-alias-label-secondary);font-size:12.8px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
        .mea-tagrow{display:flex;flex-wrap:wrap;gap:5px;margin-top:auto;padding-top:4px}
        .mea-tag{font-size:11px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border-radius:6px;padding:2px 7px}
        .mea-badge{font-size:11px;padding:2px 7px;border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);white-space:nowrap}
        .mea-badge.mea-canon-book{color:var(--dsw-alias-state-success-primary)}
        .mea-badge.mea-canon-screen{color:var(--dsw-alias-brand-primary)}
        .mea-empty{text-align:center;color:var(--dsw-alias-label-secondary);padding:56px 20px}
        .mea-empty .mea-eicon{font-size:38px;margin-bottom:10px}
        .mea-drawer-back{position:fixed;inset:0;background:rgba(0,0,0,.38);z-index:60;display:flex;justify-content:flex-end}
        .mea-drawer{width:min(580px,94vw);height:100%;overflow:auto;background:var(--dsw-alias-bg-base);border-left:1px solid var(--dsw-alias-border-l1);padding:26px 28px 44px;box-shadow:-8px 0 30px rgba(0,0,0,.2)}
        .mea-drawer h2{margin:8px 0 2px;font-size:23px}
        .mea-drawer .mea-den{color:var(--dsw-alias-label-secondary);margin-bottom:14px;font-size:13px}
        .mea-section{margin-top:20px}
        .mea-section h4{margin:0 0 9px;font-size:13.5px;font-weight:650;display:flex;align-items:center;gap:7px}
        .mea-section h4:before{content:'';width:3px;height:13px;border-radius:2px;background:var(--dsw-alias-brand-primary)}
        .mea-p{color:var(--dsw-alias-label-secondary);font-size:13.4px;margin:0}
        .mea-relitem,.mea-workitem,.mea-eventitem,.mea-miniitem{display:flex;gap:10px;align-items:flex-start;padding:9px 11px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:9px;margin-bottom:7px;font-size:13px}
        .mea-miniitem{cursor:pointer}
        .mea-miniitem:hover{border-color:var(--dsw-alias-brand-primary)}
        .mea-reltype{font-size:11px;padding:2px 7px;border-radius:6px;white-space:nowrap;color:var(--dsw-alias-bg-base);font-weight:600}
        .mea-relitem b,.mea-workitem b,.mea-eventitem b,.mea-miniitem b{font-weight:650}
        .mea-relitem small,.mea-workitem small,.mea-eventitem small,.mea-miniitem small{color:var(--dsw-alias-label-secondary);display:block;font-size:12px}
        .mea-quote{border-left:3px solid var(--dsw-alias-brand-primary);padding:6px 0 6px 13px;margin-bottom:13px;font-size:13.6px;font-style:italic;color:var(--dsw-alias-label-primary)}
        .mea-quote cite{display:block;font-style:normal;font-size:11.5px;color:var(--dsw-alias-label-secondary);margin-top:5px}
        .mea-graphwrap{position:relative;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;overflow:hidden;height:540px}
        .mea-graphwrap svg{display:block;width:100%;height:100%;cursor:grab;touch-action:none}
        .mea-graphwrap svg.mea-drag{cursor:grabbing}
        .mea-node{cursor:pointer}
        .mea-node text{font-size:10.5px;fill:var(--dsw-alias-label-primary);pointer-events:none;paint-order:stroke}
        .mea-legend{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}
        .mea-legend span{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--dsw-alias-label-secondary)}
        .mea-legend i{width:9px;height:9px;border-radius:50%;display:inline-block}
        .mea-pathbox{margin-top:16px;padding:15px 16px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px}
        .mea-pathbox h4{margin:0 0 10px;font-size:15px}
        .mea-pathrow{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
        .mea-pathresult{margin-top:12px;padding:12px;background:var(--dsw-alias-bg-layer-2);border-radius:9px;font-size:13px}
        .mea-hop{display:block;margin:4px 0}
        .mea-arrow{color:var(--dsw-alias-brand-primary);font-weight:700;margin:0 4px}
        .mea-timeline{position:relative;padding-left:26px;margin-top:8px}
        .mea-timeline:before{content:'';position:absolute;left:7px;top:4px;bottom:4px;width:2px;background:var(--dsw-alias-border-l2)}
        .mea-ev{position:relative;margin-bottom:14px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:11px;padding:13px 16px}
        .mea-ev:before{content:'';position:absolute;left:-24px;top:18px;width:11px;height:11px;border-radius:50%;background:var(--dsw-alias-brand-primary);border:2px solid var(--dsw-alias-bg-base)}
        .mea-ev.mea-major:before{background:#d9a441;width:14px;height:14px;left:-25.5px}
        .mea-evhead{display:flex;flex-wrap:wrap;gap:9px;align-items:center;margin-bottom:4px}
        .mea-age{font-size:11px;color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2);padding:2px 8px;border-radius:6px}
        .mea-year{font-size:12px;color:var(--dsw-alias-label-secondary)}
        .mea-ev h3{margin:0;font-size:14.5px}
        .mea-ev p{margin:5px 0 0;color:var(--dsw-alias-label-secondary);font-size:12.8px}
        .mea-people{font-size:12px;color:var(--dsw-alias-label-secondary);margin-top:7px}
        .mea-two{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px}
        .mea-pathcard{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:13px;padding:17px}
        .mea-pathcard h3{margin:0 0 4px;font-size:16.5px}
        .mea-pathcard .mea-blurb{color:var(--dsw-alias-label-secondary);font-size:12.8px;margin-bottom:13px}
        .mea-steps{list-style:none;padding:0;margin:0}
        .mea-steps li{position:relative;padding:0 0 13px 30px;border-left:2px solid var(--dsw-alias-border-l1);margin-left:9px}
        .mea-steps li:last-child{border-left-color:transparent;padding-bottom:0}
        .mea-steps li:before{content:attr(data-step);position:absolute;left:-11px;top:0;width:20px;height:20px;border-radius:50%;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center}
        .mea-steps b{font-size:13.5px}
        .mea-steps p{margin:3px 0 0;color:var(--dsw-alias-label-secondary);font-size:12.4px}
        .mea-diffcard{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:15px}
        .mea-diffcard h3{margin:0 0 11px;font-size:15px}
        .mea-drow{display:grid;grid-template-columns:48px 1fr;gap:8px;margin-bottom:8px;font-size:12.8px}
        .mea-dkey{font-size:11px;font-weight:700;color:var(--dsw-alias-brand-primary);padding-top:2px}
        .mea-dval{color:var(--dsw-alias-label-secondary)}
        .mea-askbox{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:17px}
        .mea-askbox h3{margin:0 0 11px;font-size:17px}
        .mea-answer{margin-top:12px;padding:13px 14px;background:var(--dsw-alias-bg-layer-2);border-radius:9px;font-size:13.2px;white-space:pre-wrap;line-height:1.75}
        .mea-bar{height:7px;border-radius:4px;background:var(--dsw-alias-bg-layer-2);overflow:hidden;display:flex}
        .mea-bar i{display:block;height:100%}
        .mea-barrow{display:flex;align-items:center;gap:9px;font-size:12.5px;margin-bottom:7px}
        .mea-barrow span:first-child{width:96px;flex:0 0 96px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .mea-barrow .mea-track{flex:1}
        .mea-barrow span:last-child{width:34px;text-align:right;color:var(--dsw-alias-label-secondary)}
        .mea-intro{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:16px 18px;margin-bottom:18px;font-size:13.5px;color:var(--dsw-alias-label-secondary);line-height:1.75}
        .mea-quick{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:9px}
        .mea-qbtn{appearance:none;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:10px;padding:12px 13px;cursor:pointer;text-align:left;font-family:inherit;color:var(--dsw-alias-label-primary);transition:border-color .12s}
        .mea-qbtn:hover{border-color:var(--dsw-alias-brand-primary)}
        .mea-qbtn b{display:block;font-size:13.5px;font-weight:600}
        .mea-qbtn small{color:var(--dsw-alias-label-secondary);font-size:11.5px}
        .mea-footer{margin-top:26px;padding-top:14px;border-top:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);font-size:11.5px}
        .mea-loading,.mea-error{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;color:var(--dsw-alias-label-secondary)}
        .mea-loading .mea-spin{font-size:30px;animation:mea-spin 1.8s linear infinite}
        @keyframes mea-spin{to{transform:rotate(360deg)}}
        .mea-drawer-close{float:right;appearance:none;border:0;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:16px}
        .mea-drawer-close:hover{background:var(--dsw-alias-bg-layer-2)}
        .mea-kicker{font-size:12px;color:var(--dsw-alias-label-secondary);margin:0 0 8px}
        .mea-h3sm{margin:0 0 10px;font-size:15px;font-weight:650}

        .mea-avatar-intro{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:16px 18px;margin-bottom:16px}
        .mea-avatar-intro h3{margin:0 0 6px;font-size:16px}
        .mea-avatar-intro p{margin:0 0 12px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.7}
        .mea-tier-row{display:flex;flex-wrap:wrap;gap:7px;align-items:center}
        .mea-avatar-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
        .mea-avatar-tile{appearance:none;text-align:left;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:15px;cursor:pointer;color:var(--dsw-alias-label-primary);font-family:inherit;transition:transform .12s,border-color .12s;display:flex;flex-direction:column;gap:9px}
        .mea-avatar-tile:hover:not(:disabled){transform:translateY(-2px);border-color:var(--dsw-alias-brand-primary)}
        .mea-avatar-tile:disabled{opacity:.45;cursor:not-allowed}
        .mea-av-tile-top{display:flex;align-items:center;gap:9px}
        .mea-av-tile-top b{display:block;font-size:14.5px}
        .mea-av-tile-top small{color:var(--dsw-alias-label-secondary);font-size:11.5px}
        .mea-av-badge{width:32px;height:32px;flex:0 0 32px;border-radius:9px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:var(--dsw-alias-brand-primary)}
        .mea-av-tagline{font-size:13px;color:var(--dsw-alias-label-secondary);font-style:italic;line-height:1.6}
        .mea-av-voice{font-size:12px;color:var(--dsw-alias-brand-primary);opacity:.85;line-height:1.5}

        /* Atmosphere: a collapsed sensory note. The native marker is replaced
           with one that matches the theme, and the summary keeps its built-in
           keyboard and screen-reader behaviour. */
        .mea-atmosphere{margin:0 0 12px;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:0 13px}
        .mea-atmosphere[open]{padding-bottom:11px}
        .mea-atmosphere summary{cursor:pointer;list-style:none;padding:10px 0;font-size:12.5px;color:var(--dsw-alias-brand-primary);user-select:none}
        .mea-atmosphere summary::-webkit-details-marker{display:none}
        .mea-atmosphere summary::before{content:'▸';display:inline-block;margin-right:7px;transition:transform .15s}
        .mea-atmosphere[open] summary::before{transform:rotate(90deg)}
        .mea-atmosphere summary:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:3px;border-radius:6px}
        .mea-atmo-row{display:flex;gap:9px;align-items:flex-start;margin:7px 0;font-size:13px;line-height:1.75}
        .mea-atmo-icon{flex:0 0 18px;text-align:center;opacity:.7;font-size:12px}
        .mea-atmo-label{flex:0 0 34px;color:var(--dsw-alias-label-secondary);font-size:11.5px;padding-top:3px}
        .mea-atmo-text{color:var(--dsw-alias-label-primary)}
        .mea-atmo-note{margin:9px 0 0;font-size:11.5px;color:var(--dsw-alias-label-secondary);font-style:italic}
        .mea-av-meta{display:flex;flex-wrap:wrap;gap:5px;margin-top:auto}
        .mea-avatar-card{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:13px;padding:20px 22px 24px;max-width:820px}
        .mea-avatar-loading{display:flex;align-items:center;gap:12px;color:var(--dsw-alias-label-secondary)}
        .mea-av-header{display:flex;align-items:center;gap:11px;margin-bottom:14px}
        .mea-av-header h2{margin:0;font-size:19px}
        .mea-av-header .mea-av-badge{width:40px;height:40px;flex:0 0 40px;font-size:17px;border-radius:11px}
        .mea-progress{height:5px;border-radius:3px;background:var(--dsw-alias-bg-layer-2);overflow:hidden;margin:6px 0 4px}
        .mea-progress i{display:block;height:100%;background:var(--dsw-alias-brand-primary);transition:width .25s}
        .mea-scene-title{margin:6px 0 8px;font-size:17px}
        .mea-scene-meta{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
        .mea-narration{font-size:14px;line-height:1.85;margin:0 0 12px;white-space:pre-wrap}
        .mea-stakes{margin:0 0 14px;padding:9px 12px;border-left:3px solid var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2);border-radius:0 8px 8px 0;font-size:13px;color:var(--dsw-alias-label-secondary)}
        .mea-choices{display:flex;flex-direction:column;gap:9px}
        .mea-choice{appearance:none;text-align:left;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:12px 14px;cursor:pointer;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13.5px;line-height:1.6;transition:border-color .12s,background .12s;display:flex;flex-direction:column;gap:5px}
        .mea-choice:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}
        .mea-choice:disabled{cursor:default}
        .mea-choice-picked{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}
        .mea-choice-dim{opacity:.42}
        .mea-choice-label{display:block}
        .mea-choice-tone{font-size:11px;color:var(--dsw-alias-label-secondary);letter-spacing:.3px}
        .mea-outcome{margin-top:16px;padding:15px 16px;border-radius:11px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1)}
        .mea-outcome-head{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:9px}
        .mea-outcome-tag{font-size:11px;font-weight:700;color:var(--dsw-alias-brand-primary)}
        .mea-outcome-canon{font-size:11px;color:var(--dsw-alias-state-success-primary);font-weight:600}
        .mea-outcome-text{margin:0;font-size:13.5px;line-height:1.8}
        .mea-outcome-note{margin:8px 0 0;font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.7}
        .mea-canon-box{margin-top:13px;padding:11px 13px;border-radius:9px;background:var(--dsw-alias-bg-layer-1);border:1px dashed var(--dsw-alias-border-l2);font-size:13px}
        .mea-avatar-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:16px}
        .mea-verdict{padding:14px 0 4px}
        .mea-verdict-label{font-size:20px;font-weight:650;margin-bottom:8px}
        .mea-verdict-bar{height:8px;border-radius:4px;background:var(--dsw-alias-bg-layer-2);overflow:hidden;margin-bottom:9px}
        .mea-verdict-bar i{display:block;height:100%;background:var(--dsw-alias-brand-primary)}
        .mea-jd-list{display:flex;flex-direction:column;gap:8px;margin-top:6px}
        .mea-jd-row{display:flex;gap:10px;align-items:flex-start;padding:9px 11px;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:9px;font-size:13px}
        .mea-jd-mark{width:18px;flex:0 0 18px;text-align:center;font-weight:700}
        .mea-jd-good{color:var(--dsw-alias-state-success-primary)}
        .mea-jd-bad{color:var(--dsw-alias-state-error-primary)}
        .mea-jd-none{color:var(--dsw-alias-label-secondary)}
        .mea-jd-row small{display:block;color:var(--dsw-alias-label-secondary);font-size:11.5px;margin-top:2px}
        .mea-jd-row small.mea-jd-canon{color:var(--dsw-alias-brand-primary)}

        /* Focus visibility: the browser default can vanish against the dark
           theme, and these controls are all keyboard reachable. */
        .mea-btn:focus-visible,
        .mea-choice:focus-visible,
        .mea-tab:focus-visible,
        .mea-chip:focus-visible,
        .mea-card:focus-visible,
        .mea-avatar-tile:focus-visible,
        .mea-qbtn:focus-visible,
        .mea-input:focus-visible,
        .mea-select:focus-visible,
        .mea-drawer-close:focus-visible {
          outline: 2px solid var(--dsw-alias-brand-primary);
          outline-offset: 2px;
        }

        /* One breakpoint is enough for a text-first panel. Below this width the
           multi-column grids and the 580px drawer stop fitting; the tab strip
           scrolls instead of wrapping so it cannot eat half the viewport. */
        @media (max-width: 720px) {
          .mea-scroll{padding:16px 14px 28px}
          .mea-head h1{font-size:21px}
          .mea-stats{grid-template-columns:repeat(2,1fr)}
          .mea-grid,.mea-avatar-grid,.mea-quick,.mea-two,.mea-diff{grid-template-columns:1fr}
          .mea-tabs{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:thin}
          .mea-tab{flex:0 0 auto}
          .mea-drawer{width:100%;max-width:100%;border-left:0;padding:20px 16px 36px}
          .mea-avatar-card{padding:16px 14px 20px}
          .mea-barrow span:first-child{width:72px;flex:0 0 72px}
          .mea-graphwrap{height:400px}
          .mea-pathrow{gap:6px}
          .mea-input,.mea-select{font-size:14px}
        }

        /* Narrower still: keep tap targets comfortable and stop the stat tiles
           from squeezing the label. */
        @media (max-width: 400px) {
          .mea-stats{grid-template-columns:1fr 1fr}
          .mea-stat{padding:8px 10px}
          .mea-choice{padding:11px 12px}
          .mea-avatar-actions .mea-btn{flex:1 1 auto}
        }
      `
      document.head.appendChild(style)
      return () => {
        if (style.parentNode) style.parentNode.removeChild(style)
      }
    }

    /* ------------------------------------------------------------------ *
     * Shared bits
     * ------------------------------------------------------------------ */
    const Crest = () => h('div', { className: 'mea-crest', title: 'Middle-earth' }, '💍')
    const Stat = ({ n, label }) => h('div', { className: 'mea-stat' }, h('b', null, String(n)), h('span', null, label))
    const FactionDot = ({ id, factions }) => {
      const f = (factions || []).find((x) => x.id === id)
      return h('span', { className: 'mea-dot', style: { background: f ? f.color : '#888' } })
    }
    const Empty = ({ t, icon }) => h('div', { className: 'mea-empty' },
      h('div', { className: 'mea-eicon' }, icon || '🧭'),
      h('div', null, t('empty')),
      h('div', { style: { fontSize: 12, marginTop: 6 } }, t('emptyHint')))
    const Bar = ({ items, total }) => h('div', null, items.map((it) => h('div', { key: it.id || it.name, className: 'mea-barrow' },
      h('span', { title: it.name }, it.name),
      h('div', { className: 'mea-track' },
        h('div', { className: 'mea-bar' },
          h('i', { style: { width: Math.round((it.n / Math.max(1, total)) * 100) + '%', background: it.color || 'var(--dsw-alias-brand-primary)' } }))),
      h('span', null, String(it.n)))))

    const canonClass = (canon) => {
      if (/剧集/.test(canon)) return 'mea-badge mea-canon-screen'
      if (/电影/.test(canon)) return 'mea-badge mea-canon-screen'
      return 'mea-badge mea-canon-book'
    }

    /* ------------------------------------------------------------------ *
     * Drawer body — pure function so every dossier shape is renderable
     * without a live fetch (the Drawer component only owns loading state).
     * ------------------------------------------------------------------ */
    const renderDossierBody = ({ kind, payload: d, data, t, onOpen }) => {
      const miniList = (items, subOf) =>
        items.map((it) => h('div', {
          key: it.id,
          className: 'mea-miniitem',
          onClick: () => onOpen('character', it.id),
        },
          h(FactionDot, { id: it.faction, factions: data.factions }),
          h('div', null, h('b', null, it.name), h('small', null, subOf(it)))))

      if (kind === 'place') {
        return h(React.Fragment, null,
          h('div', { style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' } },
            h('span', { className: canonClass(d.canon) }, d.canon),
            h('span', { className: 'mea-badge' }, d.type)),
          h('h2', null, d.name),
          h('div', { className: 'mea-den' }, d.nameEn + ' · ' + d.region),
          h('div', { className: 'mea-section' },
            h('h4', null, t('dossier')),
            h('p', { className: 'mea-p' }, d.summary),
            h('p', { className: 'mea-p', style: { marginTop: 8 } }, d.desc)),
          h('div', { className: 'mea-section' },
            h('h4', null, t('relations')),
            ...miniList(d.characters, (it) => it.factionLabel + ' · ' + it.kind)))
      }

      if (kind === 'artifact') {
        return h(React.Fragment, null,
          h('div', { style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' } },
            h('span', { className: canonClass(d.canon) }, d.canon),
            h('span', { className: 'mea-badge' }, d.type)),
          h('h2', null, d.name),
          h('div', { className: 'mea-den' }, d.nameEn),
          h('div', { className: 'mea-section' },
            h('h4', null, t('dossier')),
            h('p', { className: 'mea-p' }, d.summary),
            h('p', { className: 'mea-p', style: { marginTop: 8 } }, d.desc)),
          h('div', { className: 'mea-section' },
            h('h4', null, t('relations')),
            ...miniList(d.owners, (it) => it.factionLabel + ' · ' + it.kind)))
      }

      if (kind === 'glossary') {
        return h(React.Fragment, null,
          h('span', { className: 'mea-badge' }, d.category),
          h('h2', null, d.term),
          h('div', { className: 'mea-den' }, d.termEn),
          h('div', { className: 'mea-section' },
            h('h4', null, t('dossier')),
            h('p', { className: 'mea-p' }, d.definition),
            h('p', { className: 'mea-p', style: { marginTop: 8 } }, d.detail)),
          (d.related && d.related.length > 0)
            ? h('div', { className: 'mea-section' },
              h('h4', null, t('relations')),
              ...miniList(d.related, (it) => it.summary))
            : null)
      }

      // Character dossier.
      const relations = d.relations.length
        ? d.relations.map((r) => h('div', {
          key: r.to + r.type,
          className: 'mea-relitem',
          style: { cursor: 'pointer' },
          onClick: () => onOpen('character', r.to),
        },
          h('span', { className: 'mea-reltype', style: { background: r.color } }, r.typeLabel),
          h('div', null, h('b', null, r.name), h('small', null, r.label))))
        : [h('p', { key: 'none', className: 'mea-p' }, t('noRelations'))]

      const works = d.works.length
        ? d.works.map((w) => h('div', { key: w.id, className: 'mea-workitem' },
          h('div', null, h('b', null, w.title), h('small', null, w.role + ' · ' + w.canon))))
        : [h('p', { key: 'none', className: 'mea-p' }, t('noWorks'))]

      const places = d.places && d.places.length
        ? h('div', { className: 'mea-section' },
          h('h4', null, t('placesOf')),
          ...d.places.map((p) => h('div', {
            key: p.id,
            className: 'mea-miniitem',
            onClick: () => onOpen('place', p.id),
          }, h('div', null, h('b', null, p.name), h('small', null, p.type + ' · ' + p.summary)))))
        : null

      const artifacts = d.artifacts && d.artifacts.length
        ? h('div', { className: 'mea-section' },
          h('h4', null, t('artifactsOf')),
          ...d.artifacts.map((a) => h('div', {
            key: a.id,
            className: 'mea-miniitem',
            onClick: () => onOpen('artifact', a.id),
          }, h('div', null, h('b', null, a.name), h('small', null, a.type + ' · ' + a.summary)))))
        : null

      const quotes = d.quotes && d.quotes.length
        ? h('div', { className: 'mea-section' },
          h('h4', null, t('quotesOf')),
          ...d.quotes.map((q) => h('div', { key: q.id, className: 'mea-quote' },
            '“' + q.text + '”', h('cite', null, q.context))))
        : null

      const appearances = d.appearances.length
        ? h('div', { className: 'mea-section' },
          h('h4', null, t('appearances')),
          ...d.appearances.map((e) => h('div', { key: e.id, className: 'mea-eventitem' },
            h('div', null, h('b', null, e.title), h('small', null, e.age + ' · ' + e.year)))))
        : null

      const alias = d.alias && d.alias.length ? ' · 别名：' + d.alias.join('、') : ''

      return h(React.Fragment, null,
        h('div', { style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' } },
          h(FactionDot, { id: d.faction, factions: data.factions }),
          h('span', { className: 'mea-badge' }, d.factionLabel),
          h('span', { className: 'mea-badge' }, d.kind),
          h('span', { className: canonClass(d.canon) }, d.canon)),
        h('h2', null, d.name),
        h('div', { className: 'mea-den' }, d.nameEn + alias),
        h('div', { className: 'mea-section' },
          h('h4', null, t('dossier')),
          h('p', { className: 'mea-p' }, d.summary),
          d.details ? h('p', { className: 'mea-p', style: { marginTop: 8 } }, d.details) : null,
          d.fate ? h('p', { className: 'mea-p', style: { marginTop: 8 } },
            h('b', null, t('fate') + '：'), d.fate) : null),
        h('div', { className: 'mea-section' }, h('h4', null, t('relations')), ...relations),
        h('div', { className: 'mea-section' }, h('h4', null, t('works')), ...works),
        places,
        artifacts,
        quotes,
        appearances)
    }

    /* ------------------------------------------------------------------ *
     * Drawer — loads one dossier and shows it in a side sheet
     * ------------------------------------------------------------------ */
    const Drawer = ({ kind, id, data, t, onClose, onOpen }) => {
      const [payload, setPayload] = React.useState(null)
      const [failed, setFailed] = React.useState(false)

      React.useEffect(() => {
        let alive = true
        setPayload(null); setFailed(false)
        const path = kind === 'place' ? PLACE_PATH : kind === 'artifact' ? ARTIFACT_PATH
          : kind === 'glossary' ? GLOSSARY_PATH : DETAIL_PATH
        getJSON(path + '?id=' + encodeURIComponent(id))
          .then((d) => { if (alive) { if (d && d.error) setFailed(true); else setPayload(d) } })
          .catch(() => { if (alive) setFailed(true) })
        return () => { alive = false }
      }, [kind, id])

      React.useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [onClose])

      let body
      if (failed) {
        body = h('div', { className: 'mea-error', style: { height: 'auto', paddingTop: 40 } }, t('errorTitle'))
      } else if (!payload) {
        body = h('div', { className: 'mea-loading', style: { height: 'auto', paddingTop: 40 } },
          h('div', { className: 'mea-spin' }, '💍'), h('div', null, t('loading')))
      } else {
        body = renderDossierBody({ kind, payload, data, t, onOpen })
      }

      return h('div', { className: 'mea-drawer-back', onClick: onClose },
        h('div', { className: 'mea-drawer', onClick: (e) => e.stopPropagation() },
          h('button', { className: 'mea-drawer-close', onClick: onClose, 'aria-label': t('close') }, '×'),
          body))
    }

    /* ------------------------------------------------------------------ *
     * Overview tab
     * ------------------------------------------------------------------ */
    /* ------------------------------------------------------------------ *
     * Overview tab
     * ------------------------------------------------------------------ */
    const OverviewTab = ({ data, t, go, open }) => {
      const c = data.counts
      const factionBar = h(Bar, { items: c.byFaction, total: c.characters })
      const canonBar = h(Bar, {
        items: [
          { id: 'book', name: t('book'), n: c.byCanon.原著, color: 'var(--dsw-alias-state-success-primary)' },
          { id: 'film', name: t('screen'), n: c.byCanon.电影 + c.byCanon.剧集, color: 'var(--dsw-alias-brand-primary)' },
        ],
        total: c.characters,
      })
      const quick = (tab, emoji, label, detail) => h('button', {
        className: 'mea-qbtn', onClick: () => go(tab),
      }, h('b', null, emoji + ' ' + label), h('small', null, detail))

      const intro = h('div', { className: 'mea-intro' },
        h('div', {
          style: { fontSize: 16, fontWeight: 650, color: 'var(--dsw-alias-label-primary)', marginBottom: 6 },
        }, t('ovWelcome')),
        t('ovIntro'))

      const stats = h('div', { className: 'mea-stats' },
        h(Stat, { n: c.characters, label: t('ovCharacters') }),
        h(Stat, { n: c.relations, label: t('ovRelations') }),
        h(Stat, { n: c.places, label: t('ovPlaces') }),
        h(Stat, { n: c.artifacts, label: t('ovArtifacts') }),
        h(Stat, { n: c.events, label: t('ovEvents') }),
        h(Stat, { n: c.quotes, label: t('ovQuotes') }))

      const dist = h('div', { className: 'mea-two' },
        h('div', null,
          h('h3', { className: 'mea-h3sm' }, '⚔️ ' + t('ovFactions')),
          factionBar),
        h('div', null,
          h('h3', { className: 'mea-h3sm' }, '🕰️ ' + t('ovCanon')),
          canonBar,
          h('p', { className: 'mea-kicker', style: { marginTop: 10 } }, t('ovCanonNote'))))

      const quickLinks = h('div', { style: { marginTop: 22 } },
        h('h3', { className: 'mea-h3sm' }, '🧭 ' + t('ovStartHere')),
        h('div', { className: 'mea-quick' },
          quick('characters', '👤', t('tabCharacters'), t('ovCharacters') + '：' + c.characters),
          quick('graph', '🕸️', t('tabGraph'), t('ovRelations') + '：' + c.relations),
          quick('timeline', '📜', t('tabTimeline'), t('ovEvents') + '：' + c.events),
          quick('places', '🏔️', t('tabPlaces'), t('ovPlaces') + '：' + c.places),
          quick('ask', '💬', t('tabAsk'), t('askTitle'))))

      const quoteCards = data.quotes.slice(0, 3).map((q) => {
        const sp = data.characters.find((x) => x.id === q.speaker)
        return h('div', { key: q.id, className: 'mea-quote' },
          '“' + q.text + '”',
          h('cite', {
            style: { cursor: sp ? 'pointer' : 'default' },
            onClick: () => { if (sp) open('character', sp.id) },
          }, '— ' + (sp ? sp.name : q.speaker) + ' · ' + q.context))
      })
      const quotes = h('div', { style: { marginTop: 24 } },
        h('h3', { className: 'mea-h3sm' }, '✨ ' + t('quotesTitle')),
        ...quoteCards)

      return h(React.Fragment, null, intro, stats, dist, quickLinks, quotes)
    }

    /* ------------------------------------------------------------------ *
     * Characters tab
     * ------------------------------------------------------------------ */
    const CharactersTab = ({ data, t, open }) => {
      const [query, setQuery] = React.useState('')
      const [faction, setFaction] = React.useState('')
      const [work, setWork] = React.useState('')
      const [kind, setKind] = React.useState('')
      const [remote, setRemote] = React.useState(null)
      const [busy, setBusy] = React.useState(false)

      // A non-empty query also asks the Host, so place / artifact / glossary
      // hits can appear beside the character results.
      React.useEffect(() => {
        let alive = true
        const q = query.trim()
        if (!q) { setRemote(null); setBusy(false); return undefined }
        setBusy(true)
        getJSON(BASE + '/search-all?q=' + encodeURIComponent(q))
          .then((r) => { if (alive) { setRemote(r); setBusy(false) } })
          .catch(() => { if (alive) { setRemote(null); setBusy(false) } })
        return () => { alive = false }
      }, [query])

      const characters = React.useMemo(() => {
        const q = query.trim().toLowerCase()
        return data.characters.filter((c) => {
          if (faction && c.faction !== faction) return false
          if (work && !(c.works && c.works[work])) return false
          if (kind && c.kind !== kind) return false
          if (q) {
            const hay = [c.name, c.nameEn, ...(c.alias || []), c.factionLabel, c.summary, ...(c.tags || [])]
              .join(' ').toLowerCase()
            if (!hay.includes(q)) return false
          }
          return true
        })
      }, [data.characters, query, faction, work, kind])

      const kinds = React.useMemo(
        () => [...new Set(data.characters.map((c) => c.kind))],
        [data.characters],
      )
      const clear = () => { setQuery(''); setFaction(''); setWork(''); setKind('') }
      const hasFilter = Boolean(query || faction || work || kind)

      const cards = characters.map((c) => h('div', {
        key: c.id, className: 'mea-card', onClick: () => open('character', c.id),
      },
        h('div', { className: 'mea-card-top' },
          h(FactionDot, { id: c.faction, factions: data.factions }),
          h('h3', null, c.name)),
        h('div', { className: 'mea-en' }, c.nameEn + ' · ' + c.factionLabel),
        h('p', null, c.summary),
        h('div', { className: 'mea-tagrow' },
          h('span', { className: 'mea-badge' }, c.kind),
          ...(c.tags || []).slice(0, 2).map((tag) => h('span', { key: tag, className: 'mea-tag' }, tag)))))

      const otherGroups = remote && remote.groups
        ? remote.groups.filter((g) => g.kind !== 'character')
        : []
      const otherBlocks = otherGroups.map((g) => {
        const openOf = (it) => {
          if (g.kind === 'place') open('place', it.id)
          else if (g.kind === 'artifact') open('artifact', it.id)
          else if (g.kind === 'glossary') open('glossary', it.id)
        }
        const items = g.items.map((it) => h('div', {
          key: it.id, className: 'mea-card', onClick: () => openOf(it),
        },
          h('h3', null, it.name),
          h('div', { className: 'mea-en' }, it.nameEn + (it.type ? ' · ' + it.type : '')),
          h('p', null, it.summary)))
        return h('div', { key: g.kind, style: { marginBottom: 16 } },
          h('h3', { className: 'mea-h3sm' }, g.label + '（' + g.items.length + '）'),
          h('div', { className: 'mea-grid' }, ...items))
      })

      const toolbar = h('div', { className: 'mea-toolbar' },
        h('input', {
          className: 'mea-input mea-grow', value: query, placeholder: t('searchPlaceholder'),
          onChange: (e) => setQuery(e.target.value),
        }),
        h('select', { className: 'mea-select', value: faction, onChange: (e) => setFaction(e.target.value) },
          h('option', { value: '' }, t('allFactions')),
          ...data.factions.map((f) => h('option', { key: f.id, value: f.id }, f.name))),
        h('select', { className: 'mea-select', value: work, onChange: (e) => setWork(e.target.value) },
          h('option', { value: '' }, t('allWorks')),
          ...data.works.map((w) => h('option', { key: w.id, value: w.id }, w.title))),
        h('select', { className: 'mea-select', value: kind, onChange: (e) => setKind(e.target.value) },
          h('option', { value: '' }, t('allKinds')),
          ...kinds.map((k) => h('option', { key: k, value: k }, k))))

      const chips = h('div', { className: 'mea-chips' },
        h('span', { className: 'mea-badge' }, t('resultCount', { n: characters.length })),
        busy ? h('span', { className: 'mea-badge' }, '…') : null,
        hasFilter ? h('button', { className: 'mea-chip', onClick: clear }, t('clearFilters')) : null)

      return h(React.Fragment, null,
        toolbar,
        chips,
        characters.length === 0 ? h(Empty, { t }) : h('div', { className: 'mea-grid' }, ...cards),
        otherGroups.length > 0
          ? h('div', { style: { marginTop: 22 } }, ...otherBlocks)
          : null)
    }

    /* ------------------------------------------------------------------ *
     * Graph tab — force layout with drag, zoom, focus and path finding
     * ------------------------------------------------------------------ */
    const GraphTab = ({ data, t, open }) => {
      const [focus, setFocus] = React.useState('')
      const [graph, setGraph] = React.useState(null)
      const [faction, setFaction] = React.useState('')
      const [view, setView] = React.useState({ x: 0, y: 0, k: 1 })
      const [hover, setHover] = React.useState(null)
      const [tick, bump] = React.useReducer((v) => v + 1, 0)
      const drag = React.useRef(null)
      const pan = React.useRef(null)

      React.useEffect(() => {
        let alive = true
        setGraph(null)
        const params = []
        if (focus) params.push('focus=' + encodeURIComponent(focus))
        if (faction) params.push('faction=' + encodeURIComponent(faction))
        getJSON(GRAPH_PATH + (params.length ? '?' + params.join('&') : ''))
          .then((g) => { if (alive) { setGraph(g); setView({ x: 0, y: 0, k: 1 }) } })
          .catch(() => { if (alive) setGraph(null) })
        return () => { alive = false }
      }, [focus, faction])

      // Deterministic layout: seed on a circle, then relax repulsion + springs.
      // It runs once per graph payload so dragging does not fight the physics.
      const layout = React.useMemo(() => {
        if (!graph || !graph.nodes.length) return { nodes: [], edges: [] }
        const W = 960
        const H = 560
        const n = graph.nodes.length
        const nodes = graph.nodes.map((node, i) => {
          const angle = (i / Math.max(1, n)) * Math.PI * 2
          const r = Math.min(W, H) * 0.34
          return {
            ...node,
            x: W / 2 + Math.cos(angle) * r,
            y: H / 2 + Math.sin(angle) * r,
            vx: 0,
            vy: 0,
          }
        })
        const byId = {}
        nodes.forEach((node) => { byId[node.id] = node })
        const edges = graph.edges
          .map((e) => ({ ...e, a: byId[e.source], b: byId[e.target] }))
          .filter((e) => e.a && e.b)

        for (let step = 0; step < 200; step++) {
          for (let i = 0; i < nodes.length; i++) {
            const a = nodes[i]
            for (let j = i + 1; j < nodes.length; j++) {
              const b = nodes[j]
              let dx = a.x - b.x
              let dy = a.y - b.y
              let d2 = dx * dx + dy * dy
              if (d2 < 1) { dx = 1; dy = 1; d2 = 2 }
              const d = Math.sqrt(d2)
              const rep = Math.min(30, 5400 / d2)
              const fx = (dx / d) * rep
              const fy = (dy / d) * rep
              a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy
            }
          }
          for (const e of edges) {
            const dx = e.b.x - e.a.x
            const dy = e.b.y - e.a.y
            const d = Math.max(1, Math.sqrt(dx * dx + dy * dy))
            const force = (d - 108) * 0.012
            const fx = (dx / d) * force
            const fy = (dy / d) * force
            e.a.vx += fx; e.a.vy += fy; e.b.vx -= fx; e.b.vy -= fy
          }
          for (const node of nodes) {
            node.vx += (W / 2 - node.x) * 0.002
            node.vy += (H / 2 - node.y) * 0.002
            node.vx *= 0.84; node.vy *= 0.84
            node.x = Math.max(46, Math.min(W - 46, node.x + node.vx))
            node.y = Math.max(40, Math.min(H - 40, node.y + node.vy))
          }
        }
        return { nodes, edges }
      }, [graph])

      const onDown = (e, node) => {
        e.stopPropagation()
        drag.current = { node, sx: e.clientX, sy: e.clientY, ox: node.x, oy: node.y }
      }
      const onMove = (e) => {
        if (drag.current) {
          const d = drag.current
          d.node.x = d.ox + (e.clientX - d.sx) / view.k
          d.node.y = d.oy + (e.clientY - d.sy) / view.k
          bump()
        } else if (pan.current) {
          const p = pan.current
          setView((v) => ({ ...v, x: p.x + (e.clientX - p.sx), y: p.y + (e.clientY - p.sy) }))
        }
      }
      const onUp = () => { drag.current = null; pan.current = null }
      const onBg = (e) => {
        pan.current = { sx: e.clientX, sy: e.clientY, x: view.x, y: view.y }
        drag.current = null
      }
      const onWheel = (e) => {
        e.preventDefault()
        const factor = e.deltaY < 0 ? 1.12 : 0.89
        setView((v) => ({ ...v, k: Math.max(0.3, Math.min(2.6, v.k * factor)) }))
      }

      const dim = (node) => Boolean(faction) && node.faction !== faction

      const toolbar = h('div', { className: 'mea-toolbar' },
        h('select', { className: 'mea-select', value: focus, onChange: (e) => setFocus(e.target.value) },
          h('option', { value: '' }, t('graphAll')),
          ...data.characters.map((c) => h('option', { key: c.id, value: c.id }, c.name))),
        h('select', { className: 'mea-select', value: faction, onChange: (e) => setFaction(e.target.value) },
          h('option', { value: '' }, t('graphHighlight')),
          ...data.factions.map((f) => h('option', { key: f.id, value: f.id }, f.name))),
        h('button', {
          className: 'mea-btn',
          onClick: () => { setFocus(''); setFaction(''); setView({ x: 0, y: 0, k: 1 }) },
        }, t('graphReset')))

      let canvas
      if (!graph) {
        canvas = h('div', { className: 'mea-graphwrap' },
          h('div', { className: 'mea-empty' }, t('loading')))
      } else if (!layout.nodes.length) {
        canvas = h('div', { className: 'mea-graphwrap' },
          h('div', { className: 'mea-empty' }, t('graphEmpty')))
      } else {
        const edgeEls = layout.edges.map((e, i) => h('line', {
          key: 'e' + i,
          x1: e.a.x, y1: e.a.y, x2: e.b.x, y2: e.b.y,
          stroke: e.color,
          strokeOpacity: dim(e.a) || dim(e.b) ? 0.06 : 0.42,
          strokeWidth: 1.4,
        }))
        const nodeEls = layout.nodes.map((node) => {
          const isFocus = focus === node.id
          const radius = isFocus ? 15 : hover && hover.id === node.id ? 13 : 9 + Math.min(4, node.degree / 4)
          return h('g', {
            key: node.id,
            className: 'mea-node',
            transform: 'translate(' + node.x + ',' + node.y + ')',
            opacity: dim(node) ? 0.16 : 1,
            onMouseDown: (e) => onDown(e, node),
            onMouseEnter: () => setHover(node),
            onMouseLeave: () => setHover(null),
            onClick: () => setFocus(node.id),
            onDoubleClick: () => open('character', node.id),
          },
            h('circle', {
              r: radius,
              fill: node.factionColor,
              stroke: isFocus ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-bg-base)',
              strokeWidth: isFocus ? 3 : 1.8,
            }),
            h('text', { x: 0, y: -17, textAnchor: 'middle' }, node.label))
        })
        canvas = h('div', { className: 'mea-graphwrap' },
          h('svg', {
            viewBox: '0 0 960 560',
            onMouseDown: onBg,
            onMouseMove: onMove,
            onMouseUp: onUp,
            onMouseLeave: onUp,
            onWheel,
          },
            h('g', { transform: 'translate(' + view.x + ',' + view.y + ') scale(' + view.k + ')' },
              ...edgeEls,
              ...nodeEls)))
      }

      const legend = h('div', { className: 'mea-legend' },
        ...data.factions.map((f) => h('span', { key: f.id },
          h('i', { style: { background: f.color } }), f.name)))

      const hoverInfo = hover
        ? h('div', {
          style: { marginTop: 10, fontSize: 12.5, color: 'var(--dsw-alias-label-secondary)' },
        },
          h('b', { style: { color: 'var(--dsw-alias-label-primary)' } }, hover.label),
          ' · ' + hover.degree + ' 条关系 · ' + hover.summary)
        : null

      return h(React.Fragment, null,
        toolbar,
        h('p', {
          style: { color: 'var(--dsw-alias-label-secondary)', fontSize: 12, marginTop: 0 },
        }, t('graphHint')),
        canvas,
        legend,
        hoverInfo,
        h(PathFinder, { t }))
    }

    /* ------------------------------------------------------------------ *
     * Relationship path finder
     * ------------------------------------------------------------------ */
    const PathFinder = ({ t }) => {
      const [from, setFrom] = React.useState('')
      const [to, setTo] = React.useState('')
      const [result, setResult] = React.useState(null)
      const [busy, setBusy] = React.useState(false)

      const find = async () => {
        if (!from.trim() || !to.trim()) return
        setBusy(true)
        setResult(null)
        try {
          const r = await getJSON(PATH_PATH + '?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to))
          setResult(r)
        } catch {
          setResult({ ok: false, error: t('askFail') })
        } finally {
          setBusy(false)
        }
      }

      let body = null
      if (result) {
        if (!result.ok) {
          body = h('div', null, result.error || t('pathNotFound'))
        } else if (result.hops === 0) {
          body = h('div', null, t('pathSame'))
        } else {
          const hops = result.steps.map((s, i) => h('div', { key: i, className: 'mea-hop' },
            h('b', null, s.from),
            h('span', { className: 'mea-arrow' }, '—[' + s.label + ']→'),
            h('b', null, s.to)))
          body = h(React.Fragment, null,
            h('div', { style: { fontWeight: 600, marginBottom: 6 } }, t('pathHops', { n: result.hops })),
            ...hops)
        }
      }

      return h('div', { className: 'mea-pathbox' },
        h('h4', null, '🔗 ' + t('pathTool')),
        h('div', { className: 'mea-pathrow' },
          h('input', {
            className: 'mea-input', value: from, placeholder: t('pathPlaceholder'),
            onChange: (e) => setFrom(e.target.value),
          }),
          h('span', { className: 'mea-arrow' }, '→'),
          h('input', {
            className: 'mea-input', value: to, placeholder: t('pathPlaceholder'),
            onChange: (e) => setTo(e.target.value),
          }),
          h('button', {
            className: 'mea-btn mea-primary', onClick: find, disabled: busy,
          }, busy ? t('askThinking') : t('pathFind'))),
        h('div', {
          style: { color: 'var(--dsw-alias-label-secondary)', fontSize: 12, marginTop: 7 },
        }, t('pathHint')),
        body ? h('div', { className: 'mea-pathresult' }, body) : null)
    }

    /* ------------------------------------------------------------------ *
     * Timeline tab
     * ------------------------------------------------------------------ */
    const TimelineTab = ({ data, t }) => {
      const [age, setAge] = React.useState('')
      const events = age ? data.events.filter((e) => e.age === age) : data.events
      const ages = [...new Set(data.events.map((e) => e.age))]
      const nameOf = (id) => {
        const c = data.characters.find((x) => x.id === id)
        return c ? c.name : id
      }

      const chips = h('div', { className: 'mea-chips' },
        h('button', {
          className: 'mea-chip' + (age === '' ? ' mea-on' : ''),
          onClick: () => setAge(''),
        }, t('allAges')),
        ...ages.map((a) => h('button', {
          key: a,
          className: 'mea-chip' + (age === a ? ' mea-on' : ''),
          onClick: () => setAge(a),
        }, a)))

      const rows = events.map((e) => {
        const major = (e.importance || 0) >= 3
        const people = (e.characters || []).map(nameOf).join(' · ')
        return h('div', { key: e.id, className: 'mea-ev' + (major ? ' mea-major' : '') },
          h('div', { className: 'mea-evhead' },
            h('span', { className: 'mea-age' }, e.age),
            h('span', { className: 'mea-year' }, e.year),
            major ? h('span', { className: 'mea-badge' }, '★ 关键') : null),
          h('h3', null, e.title),
          h('p', null, e.desc),
          people ? h('div', { className: 'mea-people' }, '👥 ' + people) : null)
      })

      return h(React.Fragment, null,
        h('p', {
          style: { color: 'var(--dsw-alias-label-secondary)', fontSize: 13, marginTop: 0 },
        }, t('timelineHint')),
        chips,
        h('div', { className: 'mea-timeline' }, ...rows))
    }

    /* ------------------------------------------------------------------ *
     * Places & artifacts tab
     * ------------------------------------------------------------------ */
    const PlacesTab = ({ data, t, open }) => {
      const [tab, setTab] = React.useState('places')

      const placeCards = data.places.map((p) => h('div', {
        key: p.id, className: 'mea-card', onClick: () => open('place', p.id),
      },
        h('h3', null, p.name),
        h('div', { className: 'mea-en' }, p.nameEn + ' · ' + p.region),
        h('p', null, p.summary),
        h('div', { className: 'mea-tagrow' },
          h('span', { className: 'mea-badge' }, p.type),
          h('span', { className: canonClass(p.canon) }, p.canon))))

      const artifactCards = data.artifacts.map((a) => h('div', {
        key: a.id, className: 'mea-card', onClick: () => open('artifact', a.id),
      },
        h('h3', null, a.name),
        h('div', { className: 'mea-en' }, a.nameEn),
        h('p', null, a.summary),
        h('div', { className: 'mea-tagrow' },
          h('span', { className: 'mea-badge' }, a.type),
          h('span', { className: canonClass(a.canon) }, a.canon))))

      const tabs = h('div', { className: 'mea-chips' },
        h('button', {
          className: 'mea-chip' + (tab === 'places' ? ' mea-on' : ''),
          onClick: () => setTab('places'),
        }, '🏔️ ' + t('placesTitle') + ' ' + data.places.length),
        h('button', {
          className: 'mea-chip' + (tab === 'artifacts' ? ' mea-on' : ''),
          onClick: () => setTab('artifacts'),
        }, '💎 ' + t('artifactsTitle') + ' ' + data.artifacts.length))

      let body
      if (tab === 'places') {
        body = h(React.Fragment, null,
          h('p', { className: 'mea-kicker' }, t('placesHint')),
          h('div', { className: 'mea-grid' }, ...placeCards))
      } else {
        body = h('div', { className: 'mea-grid' }, ...artifactCards)
      }

      return h(React.Fragment, null, tabs, body)
    }

    /* ------------------------------------------------------------------ *
     * Lore tab (glossary + quotes)
     * ------------------------------------------------------------------ */
    const LoreTab = ({ data, t, open }) => {
      const glossaryCards = data.glossary.map((g) => h('div', {
        key: g.id, className: 'mea-card', onClick: () => open('glossary', g.id),
      },
        h('h3', null, g.term),
        h('div', { className: 'mea-en' }, g.termEn + ' · ' + g.category),
        h('p', null, g.definition)))

      const quoteCards = data.quotes.map((q) => {
        const sp = data.characters.find((x) => x.id === q.speaker)
        return h('div', {
          key: q.id,
          style: {
            background: 'var(--dsw-alias-bg-layer-1)',
            border: '1px solid var(--dsw-alias-border-l1)',
            borderRadius: 11,
            padding: '13px 15px',
          },
        },
          h('div', { style: { fontSize: 13.6, fontStyle: 'italic', marginBottom: 6 } }, '“' + q.text + '”'),
          q.textEn
            ? h('div', {
              style: { fontSize: 11.5, color: 'var(--dsw-alias-label-secondary)', marginBottom: 7 },
            }, q.textEn)
            : null,
          h('div', { style: { fontSize: 11.5, color: 'var(--dsw-alias-label-secondary)' } },
            h('span', {
              style: { cursor: sp ? 'pointer' : 'default', color: 'var(--dsw-alias-brand-primary)' },
              onClick: () => { if (sp) open('character', sp.id) },
            }, '— ' + (sp ? sp.name : q.speaker)),
            ' · ' + q.context + ' · ' + q.canon))
      })

      return h(React.Fragment, null,
        h('p', { className: 'mea-kicker' }, t('loreHint')),
        h('h3', { className: 'mea-h3sm', style: { marginTop: 4 } }, '📖 ' + t('glossaryTitle')),
        h('div', { className: 'mea-grid' }, ...glossaryCards),
        h('h3', { className: 'mea-h3sm', style: { marginTop: 24 } }, '✨ ' + t('quotesTitle')),
        h('div', { className: 'mea-two' }, ...quoteCards))
    }

    /* ------------------------------------------------------------------ *
     * Plot & journeys tab
     * ------------------------------------------------------------------ */
    const PlotTab = ({ data, t }) => {
      const [work, setWork] = React.useState('')
      const plots = work ? data.plot.filter((p) => p.work === work) : data.plot
      const journeys = work ? data.journeys.filter((j) => (j.works || []).includes(work)) : data.journeys

      const chips = h('div', { className: 'mea-chips' },
        h('button', {
          className: 'mea-chip' + (work === '' ? ' mea-on' : ''),
          onClick: () => setWork(''),
        }, t('allWorks')),
        ...data.works.map((w) => h('button', {
          key: w.id,
          className: 'mea-chip' + (work === w.id ? ' mea-on' : ''),
          onClick: () => setWork(w.id),
        }, w.title)))

      const plotBlocks = plots.map((p) => {
        const beats = p.beats.map((b, i) => {
          const when = b.event
            ? h('p', {
              style: { color: 'var(--dsw-alias-brand-primary)', fontSize: 11.5, marginTop: 3 },
            }, b.event.age + ' · ' + b.event.year)
            : null
          return h('li', { key: b.id, 'data-step': i + 1 },
            h('b', null, b.title), h('p', null, b.desc), when)
        })
        return h('div', { key: p.work, style: { marginBottom: 20 } },
          h('h3', { className: 'mea-h3sm' }, p.name),
          h('ol', { className: 'mea-steps' }, ...beats))
      })

      const journeyCards = journeys.map((j) => {
        const stops = []
        j.stops.forEach((s, i) => {
          stops.push(h('span', { key: 's' + i, className: 'mea-tag' }, s))
          if (i < j.stops.length - 1) {
            stops.push(h('span', {
              key: 'a' + i,
              style: { color: 'var(--dsw-alias-brand-primary)', fontSize: 11 },
            }, '→'))
          }
        })
        return h('div', { key: j.id, className: 'mea-pathcard' },
          h('h3', null, j.icon + ' ' + j.name),
          h('div', { className: 'mea-blurb' }, j.desc),
          h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6 } }, ...stops))
      })

      return h(React.Fragment, null,
        chips,
        h('p', { className: 'mea-kicker' }, t('plotHint')),
        ...plotBlocks,
        h('h3', { className: 'mea-h3sm', style: { marginTop: 22 } }, '🗺️ ' + t('journeyTitle')),
        h('div', { className: 'mea-two' }, ...journeyCards))
    }

    /* ------------------------------------------------------------------ *
     * Paths tab
     * ------------------------------------------------------------------ */
    const PathsTab = ({ data, t }) => {
      const workMap = {}
      data.works.forEach((w) => { workMap[w.id] = w })
      const cards = data.paths.map((p) => {
        const steps = p.steps.map((s, i) => {
          const w = workMap[s.work]
          return h('li', { key: s.work, 'data-step': i + 1 },
            h('b', null, w ? w.title : s.work),
            h('p', null, s.why),
            w ? h('p', {
              style: { fontSize: 11.5, color: 'var(--dsw-alias-brand-primary)', marginTop: 2 },
            }, w.canon) : null)
        })
        return h('div', { key: p.id, className: 'mea-pathcard' },
          h('h3', null, p.icon + ' ' + p.name),
          h('div', { className: 'mea-blurb' }, p.blurb),
          h('ol', { className: 'mea-steps' }, ...steps))
      })
      return h(React.Fragment, null,
        h('p', { className: 'mea-kicker' }, t('pathsHint')),
        h('div', { className: 'mea-two' }, ...cards))
    }

    /* ------------------------------------------------------------------ *
     * Differences tab
     * ------------------------------------------------------------------ */
    const DiffTab = ({ data, t }) => {
      const cards = data.differences.map((d) => h('div', { key: d.id, className: 'mea-diffcard' },
        h('h3', null, d.topic),
        h('div', { className: 'mea-drow' },
          h('span', { className: 'mea-dkey' }, t('book')),
          h('span', { className: 'mea-dval' }, d.book)),
        h('div', { className: 'mea-drow' },
          h('span', { className: 'mea-dkey' }, t('screen')),
          h('span', { className: 'mea-dval' }, d.screen)),
        h('div', { className: 'mea-drow' },
          h('span', { className: 'mea-dkey' }, t('impact')),
          h('span', { className: 'mea-dval' }, d.impact))))
      return h(React.Fragment, null,
        h('p', { className: 'mea-kicker' }, t('diffHint')),
        h('div', { className: 'mea-two' }, ...cards))
    }

    /* ------------------------------------------------------------------ *
     * Ask tab
     * ------------------------------------------------------------------ */
    const AskTab = ({ t }) => {
      const [q, setQ] = React.useState('')
      const [answer, setAnswer] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const [chips, setChips] = React.useState([])

      React.useEffect(() => {
        let alive = true
        getJSON(ASK_PATH + '?q=')
          .then((r) => { if (alive && r && r.suggestions) setChips(r.suggestions) })
          .catch(() => { /* suggestions are optional */ })
        return () => { alive = false }
      }, [])

      const ask = async (question) => {
        const text = (question === undefined ? q : question).trim()
        if (!text) return
        if (question !== undefined) setQ(question)
        setBusy(true)
        setAnswer('')
        try {
          const r = await getJSON(ASK_PATH + '?q=' + encodeURIComponent(text))
          setAnswer(r.answer || t('askFail'))
        } catch {
          setAnswer(t('askFail'))
        } finally {
          setBusy(false)
        }
      }

      const suggest = chips.length
        ? h('div', { className: 'mea-chips', style: { marginTop: 12 } },
          h('span', { className: 'mea-badge' }, t('askTryThese')),
          ...chips.map((c) => h('button', {
            key: c, className: 'mea-chip', onClick: () => ask(c),
          }, c)))
        : null

      return h('div', { className: 'mea-askbox' },
        h('h3', null, '💬 ' + t('askTitle')),
        h('div', { className: 'mea-pathrow' },
          h('input', {
            className: 'mea-input mea-grow',
            value: q,
            placeholder: t('askPlaceholder'),
            onChange: (e) => setQ(e.target.value),
            onKeyDown: (e) => { if (e.key === 'Enter') ask() },
          }),
          h('button', {
            className: 'mea-btn mea-primary', onClick: () => ask(), disabled: busy,
          }, busy ? t('askThinking') : t('askButton'))),
        suggest,
        answer ? h('div', { className: 'mea-answer' }, answer) : null)
    }

    const AtlasPage = ({ t, onBack }) => {
      const [data, setData] = React.useState(null)
      const [error, setError] = React.useState(false)
      const [tab, setTab] = React.useState('overview')
      const [drawer, setDrawer] = React.useState(null)

      const load = () => {
        setError(false); setData(null)
        getJSON(BUNDLE_PATH).then(setData).catch(() => setError(true))
      }
      React.useEffect(load, [])

      const open = (kind, id) => setDrawer({ kind, id })

      if (error) {
        return h('div', { className: 'mea-error' },
          h('div', { style: { fontSize: 36 } }, '🧭'),
          h('div', { style: { fontSize: 16, fontWeight: 600 } }, t('errorTitle')),
          h('div', null, t('errorHint')),
          h('button', { className: 'mea-btn mea-primary', onClick: load }, t('retry')))
      }
      if (!data) {
        return h('div', { className: 'mea-loading' },
          h('div', { className: 'mea-spin' }, '💍'), h('div', null, t('loading')))
      }

      // Built once per translator identity so the player keeps its state
      // across parent re-renders.
      const avatarStorage = React.useMemo(() => buildAvatarStorage(), [])
      const AvatarTabView = React.useMemo(
        () => buildAvatarTab({
          h, React, t,
          paths: { AVATARS_PATH, AVATAR_PATH, AVATAR_JUDGE_PATH },
          storage: avatarStorage,
        }),
        [t],
      )

      const tabs = [
        ['overview', '🧭 ' + t('tabOverview')],
        ['avatar', '🎭 ' + t('tabAvatar')],
        ['characters', '👤 ' + t('tabCharacters')],
        ['graph', '🕸️ ' + t('tabGraph')],
        ['timeline', '📜 ' + t('tabTimeline')],
        ['places', '🏔️ ' + t('tabPlaces')],
        ['lore', '📖 ' + t('tabLore')],
        ['plot', '🗺️ ' + t('tabPlot')],
        ['paths', '🌱 ' + t('tabPaths')],
        ['diff', '🎬 ' + t('tabDiff')],
        ['ask', '💬 ' + t('tabAsk')],
      ]

      return h('div', { className: 'mea-root' },
        h('div', { className: 'mea-scroll' },
          h('div', { className: 'mea-head' },
            h(Crest),
            h('div', null,
              h('h1', null, t('title')),
              h('div', { className: 'mea-sub' }, t('subtitle')),
              h('button', { className: 'mea-chip', style: { marginTop: 8 }, onClick: onBack }, '← ' + t('back')))),
          h('div', { className: 'mea-tabs' }, tabs.map(([id, label]) =>
            h('button', {
              key: id, className: 'mea-tab' + (tab === id ? ' mea-active' : ''), onClick: () => setTab(id),
            }, label))),
          tab === 'overview' && h(OverviewTab, { data, t, go: setTab, open }),
          tab === 'avatar' && h(AvatarTabView, { data, t }),
          tab === 'characters' && h(CharactersTab, { data, t, open }),
          tab === 'graph' && h(GraphTab, { data, t, open }),
          tab === 'timeline' && h(TimelineTab, { data, t }),
          tab === 'places' && h(PlacesTab, { data, t, open }),
          tab === 'lore' && h(LoreTab, { data, t, open }),
          tab === 'plot' && h(PlotTab, { data, t }),
          tab === 'paths' && h(PathsTab, { data, t }),
          tab === 'diff' && h(DiffTab, { data, t }),
          tab === 'ask' && h(AskTab, { t }),
          h('div', { className: 'mea-footer' }, t('footer'))),
        drawer && h(Drawer, {
          kind: drawer.kind, id: drawer.id, data, t,
          onClose: () => setDrawer(null),
          onOpen: (kind, id) => setDrawer({ kind, id }),
        }))
    }

    /* ------------------------------------------------------------------ *
     * Registration
     * ------------------------------------------------------------------ */
    return {
      inject: ['slots'],
      apply(ctx) {
        const locale = ctx.get('locale')
        const currentMessages = () => (isEnglish(locale) ? EN : ZH)
        const t = () => makeTranslator(locale, currentMessages())

        ctx.effect(() => {
          if (!locale || typeof locale.register !== 'function') return undefined
          try { return locale.register(NS, { zh: ZH, en: EN }) } catch { return undefined }
        }, NS + ': locale')

        ctx.effect(() => installStyleSheet(), NS + ': styles')

        function useLocaleVersion() {
          const [, bump] = React.useReducer((v) => v + 1, 0)
          React.useEffect(() => {
            if (!locale || typeof locale.subscribe !== 'function') return undefined
            return locale.subscribe(() => bump())
          }, [locale])
        }

        const backToConversation = () => {
          const layout = ctx.get('layout')
          if (layout && typeof layout.selectPanel === 'function') layout.selectPanel(null)
        }

        const Page = () => {
          useLocaleVersion()
          return h(AtlasPage, { t: t(), onBack: backToConversation })
        }
        const PanelIcon = () => h('span', { style: { fontSize: 16 } }, '💍')

        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register({
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 33,
            label: () => t()('nav'),
          }, PanelIcon))

        ctx.slots.inject('main', () =>
          ctx.slots.register({ name: 'main', key: PANEL_ID }, Page))
      },
    }
  },
})
