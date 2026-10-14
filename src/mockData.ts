import { LogType, type Character, type Scene, type ScriptLine, type Asset, type StorySetting } from './types';

export const MOCK_CHARACTERS: Character[] = [
  {
    id: 'char_a',
    name: '林深',
    avatar: '/demo/sample-95252ac6.svg',
    description: '顶流爱豆，外冷内热，正处于事业巅峰期。',
    personality: '极其克制，习惯用反讽掩饰真心。',
    status: 'idle',
    creator: '站姐001',
    voiceName: 'Charon'
  },
  {
    id: 'char_b',
    name: '苏然',
    avatar: '/demo/sample-67edaee9.svg',
    description: '独立摄影师，曾与林深有过一段未果的往事。',
    personality: '清冷从容，追求艺术的纯粹。',
    status: 'idle',
    creator: '同人写手A',
    voiceName: 'Kore'
  },
  {
    id: 'char_c',
    name: '陈经纪',
    avatar: '/demo/sample-29d10da6.svg',
    description: '精明干练的王牌经纪人。',
    personality: '利益至上，随时准备应对公关危机。',
    status: 'idle',
    isPublic: true,
    voiceName: 'Zephyr'
  }
];

export const MOCK_SCENES: Scene[] = [
  {
    id: 'scene_001',
    name: '雨夜便利店',
    url: '/demo/sample-75d72129.svg',
    description: '昏黄的灯光照在湿漉漉的地面上。',
    isPublic: true
  },
  {
    id: 'scene_002',
    name: '演唱会后台',
    url: '/demo/sample-d6817431.svg',
    description: '嘈杂的呼喊声隐约传来。',
    isPublic: true
  }
];

export const MOCK_ASSETS: Asset[] = [
  {
    id: 'asset_1',
    type: 'character',
    title: '少年感林深',
    url: '/demo/sample-1f130cf7.svg',
    tags: ['林深', '巡演', '银发'],
    description: '2026年夏季巡演造型，适合落寞剧情。',
    createdAt: Date.now() - 86400000
  },
  {
    id: 'asset_2',
    type: 'background',
    title: '冬日车窗',
    url: '/demo/sample-756bbb60.svg',
    tags: ['氛围', '忧郁', '雪'],
    description: '结满冰花的汽车后座，绝佳的离别场景。',
    createdAt: Date.now() - 172800000
  },
  {
    id: 'asset_3',
    type: 'character',
    title: '宿醉苏然',
    url: '/demo/sample-ae622a39.svg',
    tags: ['苏然', '现代', '清冷'],
    description: '酒后的疲惫感，捕捉了最脆弱的一瞬。',
    createdAt: Date.now() - 500000
  }
];

export const MOCK_STORY_SETTINGS: StorySetting[] = [
  {
    id: 'story_1',
    title: '青涩的回响',
    description: '一个关于重逢与遗憾的故事背景，设定在潮湿的南方小城，充满了怀旧与隐忍的情绪基调。',
    coverImage: '/demo/sample-756bbb60.svg',
    tags: ['现代', '遗憾', '治愈'],
    isPublic: true
  },
  {
    id: 'story_2',
    title: '霓虹深处',
    description: '赛博朋克风的都市丛林，权力、金钱与底层挣扎交织。',
    coverImage: '/demo/sample-a1f92103.svg',
    tags: ['科幻', '硬核', '多线'],
    isPublic: true
  }
];

export const MOCK_MARKET_CHARACTERS: Character[] = [
  ...MOCK_CHARACTERS,
  {
    id: 'char_my_published_1',
    name: '沈梦星',
    avatar: '/demo/sample-0e0f5d84.svg',
    description: '我创作的第一位科幻英雄。',
    personality: '勇敢，果断，内心深处有一处柔软。',
    status: 'idle',
    isPublic: true,
    creator: 'Me'
  },
  {
    id: 'char_market_1',
    name: '月见',
    avatar: '/demo/sample-27b7c05c.svg',
    description: '神秘的神社巫女，拥有感知过去的能力。',
    personality: '话语简练，自带一种疏离感。',
    status: 'idle',
    isPublic: true,
    creator: '幻梦馆'
  }
];

const MOCK_DIRECTOR_FALLBACKS = [
  '雨声沿着玻璃门往下压，便利店里的沉默开始变得更窄。',
  '收银台的灯闪了一下，把每个人未出口的反应都照得清清楚楚。',
  '门外的积水被车轮碾开，刚才那句话留下的余震还贴在空气里。',
  '货架深处传来轻微响动，现场的注意力被迫从旧句子移向新的细节。',
  '冷柜的电流声拖长一拍，谁都知道下一句话不能再绕回原地。'
];

const normalizeMockScriptContent = (value: string) =>
  value.replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase();

const pickMockDirectorLine = (history: ScriptLine[]) => {
  const recent = history.slice(-6).map((line) => normalizeMockScriptContent(line.content));
  const start = history.length % MOCK_DIRECTOR_FALLBACKS.length;
  for (let offset = 0; offset < MOCK_DIRECTOR_FALLBACKS.length; offset += 1) {
    const candidate = MOCK_DIRECTOR_FALLBACKS[(start + offset) % MOCK_DIRECTOR_FALLBACKS.length];
    if (!recent.includes(normalizeMockScriptContent(candidate))) {
      return candidate;
    }
  }
  return `第 ${history.length + 1} 个推演节点里，便利店现场出现了新的细节。`;
};

export const mockService = {
  fetchNextScriptLine: async (history: ScriptLine[]): Promise<Partial<ScriptLine>> => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    const lastLine = history[history.length - 1];
    
    if (lastLine?.type === LogType.USER) {
      return {
        id: Math.random().toString(36).substr(2, 9),
        type: LogType.CHARACTER,
        characterId: 'char_a',
        name: '林深',
        targetType: 'everyone',
        targetName: '对大家',
        action: '声音低哑，几乎被雨声盖过',
        content: '你终于还是对我用了“导演”的权力。既然这是你想看的结局……'
      };
    }
    
    return {
      id: Math.random().toString(36).substr(2, 9),
      type: LogType.DIRECTOR,
      content: pickMockDirectorLine(history)
    };
  },

  getMyCharacters: async (): Promise<Character[]> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return MOCK_CHARACTERS;
  },

  getMyStories: async (): Promise<StorySetting[]> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return MOCK_STORY_SETTINGS;
  },

  getMarketCharacters: async (): Promise<Character[]> => {
    await new Promise(resolve => setTimeout(resolve, 800));
    return MOCK_MARKET_CHARACTERS;
  },

  getMarketStories: async (): Promise<StorySetting[]> => {
    await new Promise(resolve => setTimeout(resolve, 800));
    return MOCK_STORY_SETTINGS;
  },

  createCharacter: async (char: Partial<Character>): Promise<Character> => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      id: Math.random().toString(36).substr(2, 9),
      name: char.name || '新角色',
      avatar: char.avatar || '/demo/sample-1799a760.svg',
      description: char.description || '',
      status: 'idle',
      ...char
    } as Character;
  },

  importAsset: async (id: string, type: 'character' | 'story'): Promise<boolean> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log(`Importing ${type} with id ${id}`);
    return true;
  }
};
