import { LogType, type Character, type Scene, type ScriptLine, type Asset, type StorySetting } from './types';

export const MOCK_CHARACTERS: Character[] = [
  {
    id: 'char_a',
    name: '林深',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop',
    description: '顶流爱豆，外冷内热，正处于事业巅峰期。',
    personality: '极其克制，习惯用反讽掩饰真心。',
    status: 'idle',
    creator: '站姐001',
    voiceName: 'Charon'
  },
  {
    id: 'char_b',
    name: '苏然',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
    description: '独立摄影师，曾与林深有过一段未果的往事。',
    personality: '清冷从容，追求艺术的纯粹。',
    status: 'idle',
    creator: '同人写手A',
    voiceName: 'Kore'
  },
  {
    id: 'char_c',
    name: '陈经纪',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop',
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
    url: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?q=80&w=1920&auto=format&fit=crop',
    description: '昏黄的灯光照在湿漉漉的地面上。',
    isPublic: true
  },
  {
    id: 'scene_002',
    name: '演唱会后台',
    url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1920&auto=format&fit=crop',
    description: '嘈杂的呼喊声隐约传来。',
    isPublic: true
  }
];

export const MOCK_ASSETS: Asset[] = [
  {
    id: 'asset_1',
    type: 'character',
    title: '少年感林深',
    url: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800',
    tags: ['林深', '巡演', '银发'],
    description: '2026年夏季巡演造型，适合落寞剧情。',
    createdAt: Date.now() - 86400000
  },
  {
    id: 'asset_2',
    type: 'background',
    title: '冬日车窗',
    url: 'https://images.unsplash.com/photo-1516738901171-8eb4fc13bd20?w=800',
    tags: ['氛围', '忧郁', '雪'],
    description: '结满冰花的汽车后座，绝佳的离别场景。',
    createdAt: Date.now() - 172800000
  },
  {
    id: 'asset_3',
    type: 'character',
    title: '宿醉苏然',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800',
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
    coverImage: 'https://images.unsplash.com/photo-1516738901171-8eb4fc13bd20?w=800',
    tags: ['现代', '遗憾', '治愈'],
    isPublic: true
  },
  {
    id: 'story_2',
    title: '霓虹深处',
    description: '赛博朋克风的都市丛林，权力、金钱与底层挣扎交织。',
    coverImage: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=800',
    tags: ['科幻', '硬核', '多线'],
    isPublic: true
  }
];

export const MOCK_MARKET_CHARACTERS: Character[] = [
  ...MOCK_CHARACTERS,
  {
    id: 'char_my_published_1',
    name: '沈梦星',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop',
    description: '我创作的第一位科幻英雄。',
    personality: '勇敢，果断，内心深处有一处柔软。',
    status: 'idle',
    isPublic: true,
    creator: 'Me'
  },
  {
    id: 'char_market_1',
    name: '月见',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop',
    description: '神秘的神社巫女，拥有感知过去的能力。',
    personality: '话语简练，自带一种疏离感。',
    status: 'idle',
    isPublic: true,
    creator: '幻梦馆'
  }
];

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
        action: '声音低哑，几乎被雨声盖过',
        content: '你终于还是对我用了“导演”的权力。既然这是你想看的结局……'
      };
    }
    
    return {
      id: Math.random().toString(36).substr(2, 9),
      type: LogType.DIRECTOR,
      content: '远处的车灯闪过，瞬间照亮了便利店门口紧绷的氛围。'
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
      avatar: char.avatar || 'https://i.pravatar.cc/300',
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
