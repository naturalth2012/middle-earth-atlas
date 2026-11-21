/**
 * Middle-earth Atlas — avatar journeys.
 *
 * A deterministic, canon-anchored "play as this character" layer. Each scene
 * is tied to a real timeline event; the player makes a choice at the moment
 * where the character actually faced one, then sees what Tolkien wrote and
 * what their own choice would have cost.
 *
 * Design rule: this is NOT an open-ended chatbot. Every scene, option and
 * outcome is curated and traceable to the dataset, so immersion never comes
 * at the price of getting the story wrong.
 *
 * `tier` is a spoiler ceiling, matching the app's spoiler control:
 *   1 = setup, safe to read before starting the book
 *   2 = mid-plot turns
 *   3 = endings and deaths
 */

export const AVATARS = [
  {
    id: 'frodo',
    character: 'frodo',
    tagline: '你只是个霍比特人。但戒指选中了你。',
    opening: '夏尔，袋底洞。甘道夫把一枚金戒指放进你手心，说：别戴上它。',
    theme: '重负与坚持',
    difficulty: '沉重',
    tier: 1,
    scenes: [
      {
        id: 'fr1',
        title: '告别宴会',
        tier: 1,
        place: 'shire',
        event: 'e11',
        narration: '比尔博的111岁生日宴上，他戴上戒指消失了。宾客哗然，你却看见他悄悄从侧门溜回袋底洞，把一切留给了你——包括那枚戒指。甘道夫在门口盯着你，眼神里有你从未见过的忧虑。',
        stakes: '你可以装作什么都没发生，继续做个普通霍比特人。',
        choices: [
          {
            label: '把戒指锁进抽屉，问甘道夫它到底是什么',
            tone: 'canon',
            canon: true,
            result: '甘道夫沉默了很久，最终说出真话：这是至尊魔戒，索伦在找它。你的平静生活从这一刻结束了，但你也第一次明白了自己手里握着什么。',
            note: '原著中正是这次追问，让弗罗多踏上了离开夏尔的路。',
          },
          {
            label: '戴上它试试，反正比尔博也戴过',
            tone: 'shadow',
            canon: false,
            result: '世界瞬间褪成灰白，你听见远处有沉重的呼吸声——不是耳朵听见的，是戒指"告诉"你的。索伦的眼睛转向了夏尔。你摘下戒指时手在抖，而甘道夫的脸已经白了。',
            note: '原著警告：戴上魔戒会让索伦立刻感知到持有者的位置。',
          },
          {
            label: '什么都不问，把戒指收好，第二天照常生活',
            tone: 'shadow',
            canon: false,
            result: '你多过了十七年平静日子。但戒灵还是来了，来得比甘道夫预料的更早。你在没有准备的情况下被追出夏尔，连一句告别都没能好好说。',
            note: '原著中弗罗多等了17年才出发，代价是戒灵已经逼近。',
          },
        ],
      },
      {
        id: 'fr2',
        title: '瑞文戴尔的会议',
        tier: 2,
        place: 'rivendell',
        event: 'e12',
        narration: '埃尔隆德召集了精灵、矮人、人类与巫师。争论到最后，所有人都在问同一个问题：谁去把魔戒送进末日火山？房间里安静下来，没有人愿意开口。你坐在角落，手指碰到口袋里那枚戒指。',
        stakes: '这是全书最重要的一次举手。',
        choices: [
          {
            label: '站起来说：我去，虽然我不知道路怎么走',
            tone: 'canon',
            canon: true,
            result: '房间里的争论停了。埃尔隆德看着你，说了一句你后来常常想起的话：我相信，这个任务交给你，是命中注定的。八个同伴陆续站到了你身边。',
            note: '原著原句："I will take the Ring, though I do not know the way."',
          },
          {
            label: '沉默。让更有力量的人去承担',
            tone: 'shadow',
            canon: false,
            result: '波罗莫主张用戒指对抗索伦，甘道夫与他争执不下，会议几乎破裂。最后虽仍有人出发，但没有魔戒持有者的自愿，这支队伍从第一天起就是散的。',
            note: '没有持有者的自愿，护戒同盟无法成立——这是原著的逻辑前提。',
          },
        ],
      },
      {
        id: 'fr3',
        title: '阿蒙汉的分裂',
        tier: 2,
        place: 'amon_hen',
        event: 'e16',
        narration: '波罗莫挡在你面前，眼里有某种不属于他的东西。他说：只是借给我，用它救我的城市。他的手伸向戒指。你握着它，感到它在发烫，在引诱你戴上它逃走。',
        stakes: '这一刻决定了护戒同盟的命运。',
        choices: [
          {
            label: '戴上戒指消失，独自离开',
            tone: 'canon',
            canon: true,
            result: '你消失了。波罗莫在惊愕中清醒过来，喊着你的名字追出去，随后为保护梅里与皮平战死在树下。你带着山姆划向对岸，从此护戒同盟分裂。',
            note: '原著中正是这一戴，让弗罗多意识到自己必须独自承担。',
          },
          {
            label: '把戒指交给他，让他去救刚铎',
            tone: 'shadow',
            canon: false,
            result: '波罗莫接过戒指的一瞬间，你看见他的脸扭曲了。他成了第二个伊西铎——而刚铎会迎来第二个被魔戒控制的王。索伦得到了他想要的东西。',
            note: '原著反复强调：魔戒会用持有者最珍视的东西来腐化他。',
          },
          {
            label: '留下来跟他讲道理',
            tone: 'risky',
            canon: false,
            result: '你说了很多，关于刚铎的荣耀、关于他父亲的期待。他听进去了，但戒灵追来，你们在混战中都受了伤。戒指还在你手里，可你失去了独自离开的时机。',
            note: '原著中对话已经无法挽回局势——魔戒的诱惑先于理智。',
          },
        ],
      },
      {
        id: 'fr4',
        title: '末日火山',
        tier: 3,
        place: 'mount_doom',
        event: 'e23',
        narration: '你站在火口的边缘。只要一松手，一切就结束了。山姆在身后喊你的名字。但你看着手中的戒指，第一次清楚地意识到：它有多美。',
        stakes: '全书最后的抉择，也是托尔金最不愿写简单的地方。',
        choices: [
          {
            label: '松手，把它扔下去',
            tone: 'gold',
            canon: false,
            result: '你做到了——比任何人都勇敢。托尔金偏偏没有这么写，因为他相信：一个人独自承受邪恶到最后一刻，已经耗尽了他所有的可能。',
            note: '原著中弗罗多在此刻被魔戒彻底压倒，说不出"我放弃它"。',
          },
          {
            label: '戴上它，宣布它属于自己',
            tone: 'canon',
            canon: true,
            result: '你说：我不放弃它。就在这一刻，咕噜扑上来咬断了你的手指。他在狂喜中失足，与魔戒一同坠入烈焰。任务完成了——但那不是你完成的。',
            note: '原著的核心张力：善意的坚持走到了极限，最后的成败由"意外"完成。',
          },
          {
            label: '挣扎着把山姆推开，让他活着离开',
            tone: 'risky',
            canon: false,
            result: '山姆不肯走。你们两个都留在火山口，而戒指还在你手上。索伦的戒灵正在赶来——这一次的结局，托尔金没有写。',
            note: '原著中山姆始终没有离开，这正是"忠诚"在全书中的分量。',
          },
        ],
      },
    ],
  },
  {
    id: 'sam',
    character: 'sam',
    tagline: '你不是英雄。你只是不肯走开。',
    opening: '夏尔的园丁棚。你听见甘道夫和弗罗多老爷在低声说话，提到了"危险"和"魔多"。',
    theme: '忠诚',
    difficulty: '温暖',
    tier: 1,
    scenes: [
      {
        id: 'sa1',
        title: '偷听的后果',
        tier: 1,
        place: 'shire',
        event: 'e11',
        narration: '你在窗外偷听被甘道夫抓住了。巫师瞪着你，说你该被变成一只什么来惩罚。你吓得说不出话，可心里只有一个念头：弗罗多老爷要一个人去那么远的地方。',
        stakes: '你完全可以退回园子里，继续做你的园丁。',
        choices: [
          {
            label: '请求跟着一起去',
            tone: 'canon',
            canon: true,
            result: '甘道夫笑了，说：那就跟着吧。你成了护戒同盟的第九个成员——不是被选中的，是自己走进去的。',
            note: '原著中山姆的加入源于一次意外，却成了全书最关键的忠诚。',
          },
          {
            label: '闭嘴保命，什么都不说',
            tone: 'shadow',
            canon: false,
            result: '甘道夫没再提这事。弗罗多独自出发，在到达布理之前就迷了路。没有山姆的旅程，从一开始就少了一个会记得给他留干粮的人。',
            note: '原著：山姆的务实与记忆，多次救了弗罗多。',
          },
        ],
      },
      {
        id: 'sa2',
        title: '西力斯昂哥的蜘蛛',
        tier: 2,
        place: 'cirith_ungol',
        event: 'e21',
        narration: '尸罗的毒牙刺中了弗罗多。他倒在地上，脸色灰白。咕噜在旁边兴奋地念叨着"宝贝"。半兽人的鼓声越来越近，你只有几秒钟。',
        stakes: '你手里有刺针剑和凯兰崔尔的水晶瓶。',
        choices: [
          {
            label: '冲上去用剑和精灵之光大喝，击退尸罗',
            tone: 'canon',
            canon: true,
            result: '你举着水晶瓶大喊——那道光让尸罗退缩了。你挡在弗罗多前面，说了此生最不像园丁的一句话：你不能碰他。',
            note: '原著中山姆用精灵之光逼退尸罗，这是他最英雄的一刻。',
          },
          {
            label: '先逃，保命要紧',
            tone: 'shadow',
            canon: false,
            result: '你跑出几十步就停下了，因为你想起弗罗多老爷睡觉时会打轻鼾，而现在听不到了。你回去时，半兽人已经把他抬走了。',
            note: '原著中山姆确实短暂地想逃，但立刻回头——这才是他。',
          },
        ],
      },
      {
        id: 'sa3',
        title: '背他上山',
        tier: 3,
        place: 'mount_doom',
        event: 'e23',
        narration: '末日火山的坡道上，弗罗多再也站不起来了。他说：我背不动它了，山姆。火口就在上面，而你连自己的腿都在发抖。',
        stakes: '你可以把他放下，自己活着回去。',
        choices: [
          {
            label: '把他背起来',
            tone: 'canon',
            canon: true,
            result: '你说：那我背你，也背它。然后你真的背起来了。原著用一句话写完这段路，但那是全书最重的一段。',
            note: '原著："I can\'t carry it for you, but I can carry you."',
          },
          {
            label: '把戒指从他脖子上取下来，自己戴上',
            tone: 'shadow',
            canon: false,
            result: '戒指到了你手上。你突然明白为什么弗罗多老爷变得那么奇怪了。那一刻你只想把它藏起来，谁都别想找到——包括山上那个人。',
            note: '原著中山姆确实短暂地替弗罗多保管过戒指，并且主动还了回去。',
          },
        ],
      },
    ],
  },
  {
    id: 'gandalf',
    character: 'gandalf',
    tagline: '你有力量，但不被允许使用它。',
    opening: '灰色海港。你被派往中土，任务是唤醒，不是征服。',
    theme: '智慧与克制',
    difficulty: '深沉',
    tier: 1,
    scenes: [
      {
        id: 'ga1',
        title: '摩瑞亚的桥',
        tier: 2,
        place: 'moria',
        event: 'e14',
        narration: '炎魔站在桥上，火焰映在你们每个人的脸上。你身后的八个人都还活着，但只要你退一步，它就会追上来。你知道自己可以一战——也知道代价。',
        stakes: '你可以带着所有人撤退，赌一把速度。',
        choices: [
          {
            label: '独自站上桥，挡住它',
            tone: 'canon',
            canon: true,
            result: '你转身喊：快走！然后站定，说出那句后来被无数人记住的话。桥断了，你和炎魔一起坠入深渊。你会回来——但要以另一种样子。',
            note: '原著中甘道夫选择独自断后，这是他从灰袍到白袍的转折。',
          },
          {
            label: '和阿拉贡一起留下来夹击',
            tone: 'risky',
            canon: false,
            result: '阿拉贡的剑对炎魔几乎无用。你们两人都受了伤，队伍在混乱中有人没能跑出去。甘道夫的力量不该被分摊，而这是他用几千年学会的克制。',
            note: '甘道夫的力量被刻意限制——他不能替别人战斗。',
          },
        ],
      },
      {
        id: 'ga2',
        title: '萨鲁曼的邀请',
        tier: 1,
        place: 'isengard',
        event: 'e17',
        narration: '欧尔桑克塔顶，萨鲁曼俯视着你。他说：我们不必对抗，我们可以引导这个时代。加入我，我们一起统治。他的声音里有你熟悉的、属于迈雅的威严。',
        stakes: '他是你的同门，也是你曾经敬重的人。',
        choices: [
          {
            label: '拒绝，并宣告他被剥夺白袍之名',
            tone: 'canon',
            canon: true,
            result: '你说了那句话。萨鲁曼的权杖碎裂了——但那一刻你也明白，白袍的位置空了出来，而这正是你要去补上的。',
            note: '原著中甘道夫在艾森加德宣告萨鲁曼失位。',
          },
          {
            label: '假意答应，先拿到情报',
            tone: 'shadow',
            canon: false,
            result: '你骗过了他，但萨鲁曼比你更懂迈雅的语词。真话与假话之间的界线一旦模糊，回来的人就不再完全是原来的你了。',
            note: '萨鲁曼原本也是以"善意"开场的——这正是他的堕落方式。',
          },
        ],
      },
      {
        id: 'ga3',
        title: '被禁止的捷径',
        tier: 2,
        place: 'minas_tirith',
        event: 'e20',
        narration: '刚铎快要撑不住了。你骑着影疾，可以立刻召回洛汗的骑兵，甚至可以用更强的力量直接击退魔多大军。但你不是被派来当征服者的。',
        stakes: '你拥有足以改变战局的力量，却被规则束缚。',
        choices: [
          {
            label: '只做能做的那部分：点燃烽火，召唤援军',
            tone: 'canon',
            canon: true,
            result: '烽火一座接一座亮起。洛汗的骑兵来了——这是人类自己的援军，不是巫师的魔法。你遵守了限制，也守住了这场战争的意义。',
            note: '原著中甘道夫始终以"提示"而非"代打"的方式介入。',
          },
          {
            label: '直接动用迈雅之力碾压敌军',
            tone: 'shadow',
            canon: false,
            result: '你确实能办到。但一旦你以力量统治中土，你就不再是甘道夫，而是另一个萨鲁曼——甚至另一个索伦。维拉派你来，不是让你重复上一次的错误。',
            note: '这正是伊斯塔力被限制力量的根因。',
          },
        ],
      },
    ],
  },
  {
    id: 'gollum',
    character: 'gollum',
    tagline: '你有两个声音。它们都想活下去。',
    opening: '安都因河的泥底。你摸到了一枚金色的圆环。',
    theme: '欲望与分裂',
    difficulty: '黑暗',
    tier: 2,
    scenes: [
      {
        id: 'go1',
        title: '河底的那枚戒指',
        tier: 2,
        place: 'anduin',
        event: 'e7',
        narration: '德戈先摸到了它。他举起来，说：好漂亮，送给你的生日礼物吧。阳光照在戒指上，你听见它在你耳边低声说话——不，也许是你自己在说。',
        stakes: '你们是表亲。他从小跟你一起钓鱼。',
        choices: [
          {
            label: '从背后掐住他的喉咙',
            tone: 'canon',
            canon: true,
            result: '你杀了他，把戒指藏进腰间的皮袋。你告诉自己这是你的生日礼物，而你的生日就是今天。此后五百年，你再也没能忘记河底那具尸体。',
            note: '原著中斯米戈尔为魔戒杀了表亲德戈，这是他堕落的起点。',
          },
          {
            label: '放手，把戒指还给他',
            tone: 'gold',
            canon: false,
            result: '你松开了手。那一刻戒指失去了你——但你保住了自己。托尔金的故事里没有这样一个人，可这正是他笔下"怜悯"所指向的可能。',
            note: '托尔金让甘道夫和弗罗多都对咕噜保有怜悯，正因如此才有了结局。',
          },
        ],
      },
      {
        id: 'go2',
        title: '两个声音',
        tier: 2,
        place: 'dead_marshes',
        event: null,
        narration: '山姆睡着了。弗罗多老爷醒着，看着你。你心里有个声音说：他对我好，他叫我斯米戈尔，他值得信任。另一个声音说：他抢走了你的宝贝，杀掉他。',
        stakes: '你开始叫它"我的宝贝"，也开始叫自己"我们"。',
        choices: [
          {
            label: '伏在弗罗多膝上，答应带他找到入口',
            tone: 'canon',
            canon: true,
            result: '他说你叫什么名字，你说斯米戈尔。他叫你斯米戈尔，而不是咕噜。那一刻，两个声音短暂地合成一个。',
            note: '原著中弗罗多的怜悯让斯米戈尔短暂地复活过。',
          },
          {
            label: '趁他睡着，抢回戒指',
            tone: 'shadow',
            canon: false,
            result: '你伸出手，却被山姆发现。你被捆起来的那个晚上，对着月亮叫了很久。此后你再也没能接近戒指，直到它落入别人手里。',
            note: '原著中咕噜确实两次试图夺戒，都被阻止。',
          },
        ],
      },
      {
        id: 'go3',
        title: '火口边缘',
        tier: 3,
        place: 'mount_doom',
        event: 'e23',
        narration: '弗罗多站在火口，把戒指戴上了手指。它就在那里，离你只有几步。你一生恨他，也一生需要一个不被恨填满的理由。',
        stakes: '你已经一无所有。',
        choices: [
          {
            label: '扑上去，咬断他的手指夺回戒指',
            tone: 'canon',
            canon: true,
            result: '你做到了。你狂喜地举起它，喊出"宝贝"——然后在火焰中失去了平衡。你与戒指一同坠入末日火山。魔多崩塌了，作者说这算是"意外"。',
            note: '没有咕噜，魔戒不会被销毁。托尔金让他亲手完成了这件事。',
          },
          {
            label: '用最后的理智，把弗罗多推下火口',
            tone: 'shadow',
            canon: false,
            result: '你毁掉了戒指，也毁掉了唯一真心叫过你名字的人。此后没有人再叫你斯米戈尔。你活下来了，但活着的只是咕噜。',
            note: '原著中咕噜已经无法分辨自己是谁——这正是魔戒的终点形态。',
          },
        ],
      },
    ],
  },
  {
    id: 'eowyn',
    character: 'eowyn',
    tagline: '他们说你该守着家。你说我不惧任何阴影。',
    opening: '伊多拉斯的黄金厅。你说：我想去打仗。他回答：那不是一个公主该做的事。',
    theme: '勇气与身份',
    difficulty: '明亮',
    tier: 2,
    scenes: [
      {
        id: 'eo1',
        title: '隐藏身份上战场',
        tier: 2,
        place: 'edoras',
        event: 'e17',
        narration: '洛汗的骑兵集结，希优顿王要驰援刚铎。你被留下守城，理由是"你是个女子"。梅里也被留下，理由是"他太小"。你们对看一眼，都明白彼此在想什么。',
        stakes: '违命意味着失去王族的身份与信任。',
        choices: [
          {
            label: '换上盔甲，以男装随军出发',
            tone: 'canon',
            canon: true,
            result: '你以"德恩海姆"之名上了战场。你的头盔遮住了所有人的目光，却遮不住你自己终于能战斗的那一刻。',
            note: '原著中伊欧玟与梅里秘密同行，成为扭转战局的关键。',
          },
          {
            label: '服从命令，留在伊多拉斯',
            tone: 'shadow',
            canon: false,
            result: '你在城中等消息。等来的是希优顿王的尸体、洛汗的溃兵，以及一个你再也无法回答的问题：如果那天我去了呢？',
            note: '原著用伊欧玟的选择打破了"谁该守家"的规则。',
          },
        ],
      },
      {
        id: 'eo2',
        title: '帕兰诺的原野',
        tier: 3,
        place: 'pelennor',
        event: 'e20',
        narration: '希优顿王被飞兽压死。你挡在尸体前，安格玛巫王俯视着你。他说：没有人能杀死我。他的声音让空气都冷了。梅里倒在一旁。',
        stakes: '预言说巫王不会死于男人之手。',
        choices: [
          {
            label: '摘下头盔，说：我不是活着的男人',
            tone: 'canon',
            canon: true,
            result: '你报上自己的名字——伊欧玟·伊蒙特。梅里的匕首与你的剑同时刺入。预言被破解了，不是靠力量，而是靠他从未想过的一个事实。',
            note: '原著原句："I am no man."这是全书最著名的反转之一。',
          },
          {
            label: '转身去救梅里',
            tone: 'shadow',
            canon: false,
            result: '你救下了梅里，但巫王杀死了希优顿的遗体护卫，随后重整阵型。你做了正确的事，却也错失了唯一能杀死它的时刻。',
            note: '原著中伊欧玟先杀飞兽，再对付巫王。',
          },
        ],
      },
      {
        id: 'eo3',
        title: '战后的疗愈',
        tier: 3,
        place: 'minas_tirith',
        event: 'e24',
        narration: '你活了下来，但伤口让你冷到骨子里，连胜利的欢呼都像是从很远的地方传来。法拉米尔也在疗养院——他也带着一身伤。',
        stakes: '你曾以为荣耀能治愈一切，现在你不确定了。',
        choices: [
          {
            label: '接受他的陪伴，承认自己不想再打仗了',
            tone: 'gold',
            canon: true,
            result: '你终于说出：我曾想通过战争获得荣耀，现在我只想活下来，也让他活下来。托尔金给你的不是战死，而是痊愈。',
            note: '原著中伊欧玟与法拉米尔在疗愈中相爱，她主动放下了战场。',
          },
          {
            label: '拒绝任何安慰，继续追索下一场战斗',
            tone: 'shadow',
            canon: false,
            result: '你还能骑马，还能举剑。但没有一场胜仗能填满那个洞——因为你要的从来不是胜利，而是被承认值得。',
            note: '原著点明她的症结是"被轻视"，而非单纯的勇气。',
          },
        ],
      },
    ],
  },
  {
    id: 'aragorn',
    character: 'aragorn',
    tagline: '你被预言是王，却被现实当成流浪汉。',
    opening: '布理的跃马客栈。一个霍比特人叫你"斯特莱德"，还说你看着可疑。',
    theme: '责任与忍耐',
    difficulty: '厚重',
    tier: 1,
    scenes: [
      {
        id: 'ar1',
        title: '王位的重量',
        tier: 1,
        place: 'bree',
        event: null,
        narration: '你手里握着半截纳希尔圣剑。只要走进米那斯提力斯，亮明身份，刚铎的人会看见王。但索伦也会看见你。你父亲曾说过：先学会走路，再想着当国王。',
        stakes: '忍还是出手，这是你一生的考题。',
        choices: [
          {
            label: '继续以游侠身份守护，等时机成熟',
            tone: 'canon',
            canon: true,
            result: '你护着霍比特人一路到瑞文戴尔，没有人知道他们身边走着一个国王。慢，但你保住了他们，也保住了自己。',
            note: '原著中阿拉贡以"斯特莱德"之名隐姓埋名八十余年。',
          },
          {
            label: '立刻亮明身份，召集刚铎',
            tone: 'shadow',
            canon: false,
            result: '旧都的贵族不会认一个北方游侠，迪耐瑟更不会让位。你引发了内乱，而索伦看着这一切发笑——他最喜欢人类自己分裂。',
            note: '刚铎此时已被真知晶石渗透，贸然现身只会加速崩盘。',
          },
        ],
      },
      {
        id: 'ar2',
        title: '亡者之路',
        tier: 2,
        place: 'paths_of_the_dead',
        event: 'e20',
        narration: '山门之下，死者在你面前集结。他们曾背弃誓言，如今被诅咒，无人能安息。你可以召唤他们替你打仗，条件是替他们解除诅咒。',
        stakes: '一支不会死的军队，代价是一个古老的承诺。',
        choices: [
          {
            label: '承诺为他们解除诅咒，换取他们的军力',
            tone: 'canon',
            canon: true,
            result: '他们跟随你到了帕兰诺。战后你兑现了诺言——不是利用完就丢掉。这正是"王者"与"军阀"的区别。',
            note: '原著中阿拉贡以合法的王者身份召集亡者。',
          },
          {
            label: '用更直接的方式：以恐惧驱使他们',
            tone: 'shadow',
            canon: false,
            result: '他们服从了，但诅咒未解。你赢得了一场战斗，却欠下一笔永远还不清的债。刚铎的王座从此坐得不太安稳。',
            note: '誓言的兑现是阿拉贡合法性的核心，不是可选项。',
          },
        ],
      },
      {
        id: 'ar3',
        title: '黑门之前',
        tier: 3,
        place: 'black_gate',
        event: 'e22',
        narration: '你带着不到七千人站在黑门前，唯一的任务是让索伦把目光集中在这里。这样山上那两个人可能还有机会。也就是说，你是去送死的。',
        stakes: '你知道这是诱饵。你的部下不知道。',
        choices: [
          {
            label: '带他们正面叫阵，然后死战',
            tone: 'canon',
            canon: true,
            result: '你说了：为了那些还在远方的、小小的希望。然后你打了，一直撑到魔戒在火中融化。这是全书最像"王者"的一场战斗。',
            note: '原著原句："For the ones we love, and the hope that lies beyond."',
          },
          {
            label: '据守隘口，保存实力',
            tone: 'shadow',
            canon: false,
            result: '你守住了，但索伦没有分心。他的目光还在别处，而山上那两个人被尸罗、被半兽人、被整座魔多拦住了。',
            note: '黑门之战的全部意义就在于"转移注意力"。',
          },
        ],
      },
    ],
  },
]

/** Characters you can play, in display order. */
export const PLAYABLE_IDS = AVATARS.map((a) => a.id)

export const TONE_LABELS = {
  canon: '原著的选择',
  gold: '理想的选择',
  shadow: '黑暗的选择',
  risky: '冒险的选择',
}

export const AVATAR_BY_ID = Object.fromEntries(AVATARS.map((a) => [a.id, a]))
