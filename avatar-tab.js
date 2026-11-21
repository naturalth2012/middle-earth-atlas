/**
 * AvatarJourneyTab — "play as a character" for the Middle-earth Atlas.
 *
 * Kept in its own module for readability; the main client imports neither JSX
 * nor any Harness Client package, matching the rest of this plugin.
 *
 * The component is a pure factory: `buildAvatarTab({ h, React, t })` returns the
 * tab component, so the parent keeps ownership of copy, styling and data.
 */

export function buildAvatarTab({ h, React, t, paths, storage }) {
  const { AVATARS_PATH, AVATAR_PATH, AVATAR_JUDGE_PATH } = paths

  // The storage adapter is injected; when the host cannot persist (private
  // mode, disabled storage) it is a null-safe no-op and the journey still runs.
  const store = storage || {
    restore: () => null,
    persist: () => false,
    clear: () => false,
    rememberedTier: () => null,
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
