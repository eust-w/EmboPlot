// Original, prewritten fiction. This is not a recording of model-generated output.
export const story = {
  title: '最后一段信号',
  description: '凌晨两点，废弃天文台收到一段来自明天的求救信号。暴雨封山，留下的人必须决定是否回应。',
  content: '近未来的南方山城。天文台即将关停，观测员沈星与无线电工程师陆川在最后一个夜班收到来自明天的录音。信号里提到了尚未断裂的天线。所有线索必须从收音机、维护记录与当晚的天气中推导，不引入超能力。核心冲突：保护彼此与完成最后一次观测。',
  coverImage: '/docs/media/observatory.jpg',
  tags: ['原创', '科幻', '悬疑'],
};

export const characters = [
  {
    name: '沈星', avatar: '/docs/media/astronomer.jpg', status: 'idle', voiceName: 'Kore',
    description: '天文台最后一位观测员。相信证据，却认出了求救信号里自己的声音。',
    personality: '冷静、敏锐、责任感强。先核实事实，再表达情绪；习惯用具体的观测细节说话。',
    memory: '今晚两点交接班；西侧天线三天前维修过，记录上有陆川的签名。',
  },
  {
    name: '陆川', avatar: '/docs/media/engineer.jpg', status: 'idle', voiceName: 'Charon',
    description: '留下检修的无线电工程师。知道旧设备的每一次异响，也藏着一次未完成的告别。',
    personality: '务实、寡言、保护欲强。用行动回应冲突，紧张时会开一句克制的玩笑。',
    memory: '刚刚关闭了自动发射模块。西侧天线的避雷线仍需复查。',
  },
];

export function timeline(cast) {
  return [
    { id: 'showcase_1', type: 'director', content: '02:17。暴雨敲着玻璃，收音机在断电后又亮了一次。那段求救录音结束时，窗外的西侧天线还完整地立着。' },
    { id: 'showcase_2', type: 'character', characterId: cast[0].id, name: cast[0].name, targetType: 'character', targetId: cast[1].id, targetName: cast[1].name, action: '按住重播键，把维护记录推到桌子中央', content: '录音说天线会在两点二十分断裂。还有三分钟。你修过它，告诉我现在该关掉什么。' },
    { id: 'showcase_3', type: 'character', characterId: cast[1].id, name: cast[1].name, targetType: 'character', targetId: cast[0].id, targetName: cast[0].name, action: '拔下发射线，拿起绝缘手套', content: '发射机已经关了，但避雷线还连着西塔。你留在这里计时，我去断开它。别把求救录音当成结局。' },
    { id: 'showcase_4', type: 'director', content: '沈星把手电递给他。门打开的一瞬间，风裹着雨水冲进控制室；接收机上的倒计时跳到了 02:18。', imageUrl: '/docs/media/observatory.jpg' },
  ].map((line, index) => ({ ...line, createdAt: Date.UTC(2026, 0, 1, 2, 17, index) }));
}
