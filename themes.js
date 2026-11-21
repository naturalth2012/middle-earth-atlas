/**
 * Middle-earth Atlas — thematic dialectics.
 *
 * Some questions in Tolkien have no verdict, and pretending otherwise would
 * misrepresent the book. Each theme therefore states a question, gives three
 * positions that each sound defensible, and closes with an open discussion
 * rather than an answer.
 *
 * `tier` follows spoiler.js: 1 = safe after The Hobbit, 2 = after LOTR,
 * 3 = needs the Silmarillion / endings.
 */

export const THEMES = [
  {
    id: 'mercy-vs-prudence',
    title: '怜悯与决断',
    question: '对咕噜的怜悯，是智慧，还是软弱的借口？',
    summary: '甘道夫说不要轻易判处死亡，连最卑劣的生灵也牵动命运的线。山姆只看见一个该被丢下的累赘。托尔金没有裁判，他只是让怜悯的代价和收益都发生在同一趟路上。',
    tier: 2,
    sides: [
      { name: '甘道夫的答案', view: '不要急于判处死亡。你无法知道，一个生灵在结局里被安排了什么位置——连咕噜也不是例外。' },
      { name: '山姆的答案', view: '他是个杀人犯，跟着我们是为了戒指。怜悯是老爷才有资格做的事，我只想让弗罗多活着回到夏尔。' },
      { name: '弗罗多的答案', view: '我怜悯他，不是因为他值得，而是因为我开始明白他为什么会变成这样——而这让我害怕。' },
    ],
    related: ['gandalf', 'sam', 'frodo', 'gollum'],
    discussion: '如果当初杀了咕噜，魔戒会不会就永远留在末日火山里？怜悯救了世界，还是差点毁了它？',
  },
  {
    id: 'fate-vs-choice',
    title: '命运与自由',
    question: '预言是约束，还是你用来逃避选择的借口？',
    summary: '阿拉贡相信血脉与预言，却等了八十年才走进去。伊欧玟被"女子不该上战场"的规矩困住，直到她自己不认了。埃尔隆德看得最远，也最不相信女儿能改变结局。',
    tier: 2,
    sides: [
      { name: '埃尔隆德的答案', view: '我见过太多被预言许诺过的人，最后都死在预言兑现之前。命运是一种长线，不是通行证。' },
      { name: '阿拉贡的答案', view: '我知道自己是谁，但我不想以那个身份出现——直到我能配得上它。预言的实现需要有人真的走过去。' },
      { name: '伊欧玟的答案', view: '他们说我"不该"，从来不是"不能"。所谓命运，多半是别人替你写好的剧本。' },
    ],
    related: ['elrond', 'aragorn', 'eowyn'],
    discussion: '如果阿拉贡没有走进亡者之路，预言会不会自动兑现？所谓命中注定，究竟有多少是他自己挣来的？',
  },
  {
    id: 'power-vs-corruption',
    title: '权力与腐化',
    question: '力量本身有善恶，还是只有使用它的人有？',
    summary: '凯兰崔尔被递上魔戒而没有伸手，萨鲁曼以"研究"为名一步步合作，波罗莫只想用它救自己的城。三个人都不是恶人，三个人的答案是同一个东西。',
    tier: 2,
    sides: [
      { name: '凯兰崔尔的答案', view: '我若接受它，就会变成一位美丽而可怖的女王。善意的开端并不保证善意的结局——所以我选择消失。' },
      { name: '萨鲁曼的答案', view: '力量只是工具，关键在于谁掌握它。与其让黑暗魔君用它，不如让懂它的人用它。' },
      { name: '波罗莫的答案', view: '我的城市在被围困，你们却在讨论抽象的道德。武器就是拿来用的，用完了再说它的代价。' },
    ],
    related: ['galadriel', 'saruman', 'boromir'],
    discussion: '如果波罗莫真的把魔戒带回刚铎，他会变成第二个索伦，还是第二个伊西铎？两者的结局有区别吗？',
  },
  {
    id: 'endurance-vs-resistance',
    title: '苟活与抵抗',
    question: '洛汗该守着城墙，还是该冲出去送死？',
    summary: '希优顿选择了冲锋，代价是当场战死。格里马选择了苟活，代价是被人记住成叛徒。伊欧墨服从王的决定，而王自己没能在做出决定前完全清醒。',
    tier: 2,
    sides: [
      { name: '希优顿的答案', view: '骠骑之王的意义在于冲锋本身，不在于活下来数战果。一个不敢出战的王，保住的只是一座慢慢腐烂的城。' },
      { name: '格里马的答案', view: '打不赢的仗不值得打。活人才能重建，贞洁的尸首堆不出一个国家。' },
      { name: '伊欧墨的答案', view: '我服从王，但我也必须活着把洛汗的骑兵带回来。冲锋是王的荣耀，收兵是元帅的责任。' },
    ],
    related: ['theoden', 'grima', 'eomer'],
    discussion: '如果希优顿留在后方指挥，洛汗会失去什么？如果他战死，又失去了什么？哪一种代价更难承受？',
  },
  {
    id: 'home-vs-departure',
    title: '归乡与远行',
    question: '拯救了世界，还能回到原来的生活吗？',
    summary: '山姆回去了，当了市长、生了孩子，把故事讲给孩子听。弗罗多也回去了，但伤口没有好，最后上了船。比尔博走得更早，回来时已不是同一个人。',
    tier: 3,
    sides: [
      { name: '山姆的答案', view: '世界救回来了，我就该回去种树。英雄不需要一直当英雄，园子还在等我。' },
      { name: '弗罗多的答案', view: '我回不去了。不是因为夏尔变了，是因为我变了——有些伤口在中土治不好。' },
      { name: '比尔博的答案', view: '我年轻时想冒险，老了就想写下来。归乡不是回到原地，是终于有资格讲故事。' },
    ],
    related: ['sam', 'frodo', 'bilbo'],
    discussion: '弗罗多的结局算胜利还是失败？如果他留在夏尔活到老，会不会比西渡更痛苦？',
  },
  {
    id: 'wisdom-vs-knowledge',
    title: '智慧与知识',
    question: '知道得越多，是否越容易做错决定？',
    summary: '萨鲁曼研究了魔戒的每一处刻痕，最终成为它的同谋。凯勒布林博是最高明的工匠，被欺骗铸出了自己的毁灭。甘道夫知道得少，但知道什么时候不该动手。',
    tier: 3,
    sides: [
      { name: '萨鲁曼的答案', view: '无知才会恐惧，知识带来掌控。我看得比谁都清楚，所以我才是那个该做决定的人。' },
      { name: '甘道夫的答案', view: '我知道很多，但我更清楚哪些不是我的位置。力量用对了地方是智慧，用错了地方只是能力。' },
      { name: '凯勒布林博的答案', view: '我只想着把工艺做到极致，没想过谁会用它——这可能是我此生最大的疏忽。' },
    ],
    related: ['saruman', 'gandalf', 'celebrimbor'],
    discussion: '萨鲁曼和甘道夫同为迈雅，同样博学于中土。区别究竟在知识，还是在克制？',
  },
  {
    id: 'loyalty-vs-obedience',
    title: '忠诚与服从',
    question: '当命令与良知冲突，该听谁的？',
    summary: '山姆违命跟上船，救了整个任务。哈玛违心服从，放甘道夫带杖入殿——既守了规矩，也守了人情。迪耐瑟的儿子们面对同一个父亲，一个战死，一个被逼到边缘。',
    tier: 2,
    sides: [
      { name: '山姆的答案', view: '我答应过要跟着他。规矩是给不走夜路的人定的，我得跟着去。' },
      { name: '哈玛的答案', view: '我是守门人，规矩就是规矩。但我可以在我能决定的那个地方，给人留一点余地。' },
      { name: '法拉米尔的答案', view: '我服从父亲，但我不服从那个会让我送掉所有人命的命令。忠诚的对象是国家，不是某个人的情绪。' },
    ],
    related: ['sam', 'hama', 'faramir', 'denethor'],
    discussion: '山姆的违命与法拉米尔的抗命，是同一种品质还是两种？如果他们的判断错了呢？',
  },
]

export const THEME_BY_ID = Object.fromEntries(THEMES.map((t) => [t.id, t]))
