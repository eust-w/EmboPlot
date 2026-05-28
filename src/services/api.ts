import { LogType, type AuthResponse, type AuthSessionResponse, type AuthUser, type BootstrapData, type Character, type CharacterDraftInput, type CharacterImageInput, type GameSettings, type ImageEditInput, type ModelCapabilities, type ModelMediaResult, type Profile, type Room, type SceneImageInput, type ScriptLine, type StoryDraftInput, type StoryImageInput, type StorySetting } from '@/src/types';
import { MOCK_CHARACTERS, MOCK_MARKET_CHARACTERS, MOCK_STORY_SETTINGS, mockService } from '@/src/mockData';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function errorMessageFromResponse(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return `Request failed with ${response.status}`;

  try {
    const parsed = JSON.parse(text) as { error?: unknown };
    if (typeof parsed.error === 'string' && parsed.error.trim()) {
      return parsed.error;
    }
  } catch {
    // Non-JSON error bodies are still useful for local debugging.
  }
  return text;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    throw new ApiError(response.status, await errorMessageFromResponse(response));
  }
  return response.json() as Promise<T>;
}

function fallbackProfile(): Profile {
  return {
    id: 'profile_default',
    uid: 'ID: 88591240',
    nickname: '平行演播者 E',
    avatarChar: 'E',
    signature: '用文字编织平行时空的导演。',
    tags: ['科幻迷', '赛博朋克', '叙事大师'],
    points: 2560,
  };
}

function fallbackRooms(): Room[] {
  return [
    {
      id: 'room_1',
      title: '便利店的宿命重逢',
      storyId: MOCK_STORY_SETTINGS[0].id,
      characterIds: MOCK_CHARACTERS.slice(0, 2).map((c) => c.id),
      currentStory: MOCK_STORY_SETTINGS[0],
      activeCharacters: MOCK_CHARACTERS.slice(0, 2),
      gameSettings: {
        mood: '戏剧冲突',
        pace: 'Balanced',
        complexity: 'Standard',
        language: 'Chinese (Simplified)',
      },
      scriptTimeline: [
        { id: 'initial_1', type: LogType.DIRECTOR, content: '午夜三点，雨势突然转急。街角的便利店成了方圆一公里内唯一的亮色。' },
        { id: 'initial_2', type: LogType.CHARACTER, name: '林深', targetType: 'air', targetName: '对空气', action: '抖开雨伞上的积水', content: '还是老样子，一股快过期的便当味。', characterId: 'char_a' },
      ],
      status: 'running',
    },
  ];
}

export const fallbackBootstrap: BootstrapData = {
  profile: fallbackProfile(),
  characters: MOCK_CHARACTERS,
  marketCharacters: MOCK_MARKET_CHARACTERS,
  stories: MOCK_STORY_SETTINGS,
  marketStories: MOCK_STORY_SETTINGS,
  assets: [],
  rooms: fallbackRooms(),
};

export const apiService = {
  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const payload = await request<AuthSessionResponse>('/api/auth/session');
      return payload.user;
    } catch {
      return null;
    }
  },

  async register(input: { email: string; password: string; nickname: string }): Promise<AuthUser> {
    const payload = await request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return payload.user;
  },

  async login(input: { email: string; password: string }): Promise<AuthUser> {
    const payload = await request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return payload.user;
  },

  async logout(): Promise<void> {
    await request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
  },

  async getBootstrap(): Promise<BootstrapData> {
    try {
      return await request<BootstrapData>('/api/bootstrap');
    } catch (error) {
      console.warn('Using local mock bootstrap because API is unavailable:', error);
      return fallbackBootstrap;
    }
  },

  async getMyCharacters(): Promise<Character[]> {
    try {
      return await request<Character[]>('/api/characters');
    } catch {
      return mockService.getMyCharacters();
    }
  },

  async getMyStories(): Promise<StorySetting[]> {
    try {
      return await request<StorySetting[]>('/api/stories');
    } catch {
      return mockService.getMyStories();
    }
  },

  async getMarketCharacters(): Promise<Character[]> {
    try {
      return await request<Character[]>('/api/characters?scope=market');
    } catch {
      return mockService.getMarketCharacters();
    }
  },

  async getMarketStories(): Promise<StorySetting[]> {
    try {
      return await request<StorySetting[]>('/api/stories?scope=market');
    } catch {
      return mockService.getMarketStories();
    }
  },

  async createRoom(input: { title: string; storyId: string; characterIds: string[]; gameSettings: GameSettings }): Promise<Room> {
    try {
      return await request<Room>('/api/rooms', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    } catch (error) {
      console.warn('Falling back to local room creation:', error);
      const story = MOCK_STORY_SETTINGS.find((item) => item.id === input.storyId) || MOCK_STORY_SETTINGS[0];
      const activeCharacters = MOCK_CHARACTERS.filter((item) => input.characterIds.includes(item.id));
      return {
        id: `room_${Date.now()}`,
        title: input.title || story.title,
        storyId: story.id,
        characterIds: activeCharacters.map((item) => item.id),
        currentStory: story,
        activeCharacters,
        gameSettings: input.gameSettings,
        scriptTimeline: [
          { id: `line_${Date.now()}`, type: LogType.DIRECTOR, content: `【${story.title}】的故事拉开了帷幕。` },
          ...(input.gameSettings.initialPlot ? [{ id: `line_${Date.now()}_plot`, type: LogType.DIRECTOR, content: input.gameSettings.initialPlot }] : []),
        ],
        status: 'running',
      };
    }
  },

  async updateRoom(room: Room): Promise<Room> {
    try {
      return await request<Room>(`/api/rooms/${room.id}`, {
        method: 'PUT',
        body: JSON.stringify(room),
      });
    } catch {
      return room;
    }
  },

  async deleteRoom(roomId: string): Promise<boolean> {
    try {
      await request<{ ok: boolean }>(`/api/rooms/${roomId}`, { method: 'DELETE' });
      return true;
    } catch {
      return false;
    }
  },

  async appendScriptLine(roomId: string, line: ScriptLine): Promise<Room | null> {
    try {
      return await request<Room>(`/api/rooms/${roomId}/lines`, {
        method: 'POST',
        body: JSON.stringify(line),
      });
    } catch {
      return null;
    }
  },

  async generateNextScriptLine(roomId: string, history: ScriptLine[]): Promise<ScriptLine> {
    try {
      return await request<ScriptLine>(`/api/rooms/${roomId}/generate`, {
        method: 'POST',
        body: JSON.stringify({ scriptTimeline: history }),
      });
    } catch {
      const line = await mockService.fetchNextScriptLine(history);
      return {
        id: line.id || Math.random().toString(36).slice(2),
        type: (line.type as LogType) || LogType.DIRECTOR,
        content: line.content || '',
        ...line,
      };
    }
  },

  async saveCharacter(character: Character): Promise<Character> {
    const isNew = character.id.startsWith('new_');
    const payload = isNew ? { ...character, id: '' } : character;
    try {
      return await request<Character>(isNew ? '/api/characters' : `/api/characters/${character.id}`, {
        method: isNew ? 'POST' : 'PUT',
        body: JSON.stringify(payload),
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      return character;
    }
  },

  async saveStory(story: StorySetting): Promise<StorySetting> {
    const isNew = story.id.startsWith('new_');
    const payload = isNew ? { ...story, id: '' } : story;
    try {
      return await request<StorySetting>('/api/stories', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      return story;
    }
  },

  async publishCharacter(id: string): Promise<Character> {
    try {
      return await request<Character>(`/api/characters/${id}/publish`, { method: 'POST' });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new Error('API unavailable');
    }
  },

  async unpublishCharacter(id: string): Promise<Character> {
    try {
      return await request<Character>(`/api/characters/${id}/unpublish`, { method: 'POST' });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new Error('API unavailable');
    }
  },

  async publishStory(id: string): Promise<StorySetting> {
    try {
      return await request<StorySetting>(`/api/stories/${id}/publish`, { method: 'POST' });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new Error('API unavailable');
    }
  },

  async unpublishStory(id: string): Promise<StorySetting> {
    try {
      return await request<StorySetting>(`/api/stories/${id}/unpublish`, { method: 'POST' });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new Error('API unavailable');
    }
  },

  async acquireCharacter(id: string): Promise<Character> {
    return await request<Character>(`/api/characters/${id}/acquire`, { method: 'POST' });
  },

  async acquireStory(id: string): Promise<StorySetting> {
    return await request<StorySetting>(`/api/stories/${id}/acquire`, { method: 'POST' });
  },

  async parseCharacterFile(file: File): Promise<Character> {
    const form = new FormData();
    form.append('file', file);
    try {
      return await request<Character>('/api/onboarding/parse-character', {
        method: 'POST',
        body: form,
      });
    } catch {
      const content = file.type.includes('text') ? await file.text() : '';
      return {
        id: `char_${Date.now()}`,
        name: file.name.replace(/\.[^.]+$/, '') || '新角色',
        avatar: 'https://i.pravatar.cc/300',
        description: `从文件《${file.name}》中解析出的核心背景。${content.slice(0, 40)}`,
        personality: '解析出的人格特征：忠诚、内敛、带有某种不可告人的秘密。',
        memory: '提取出的关键记忆点会在后端可用时写入云端记忆区。',
        status: 'idle',
        creator: 'Me',
        voiceName: 'Kore',
      };
    }
  },

  async generateCharacter(input: CharacterDraftInput): Promise<Character> {
    return await request<Character>('/api/models/character', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async generateCharacterImage(input: CharacterImageInput): Promise<string> {
    const result = await request<ModelMediaResult>('/api/models/character-image', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (!result.url) {
      throw new Error(result.taskId ? `Image task is pending: ${result.taskId}` : 'No image URL returned');
    }
    return result.url;
  },

  async generateStory(input: StoryDraftInput): Promise<StorySetting> {
    return await request<StorySetting>('/api/models/story', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async generateStoryImage(input: StoryImageInput): Promise<string> {
    const result = await request<ModelMediaResult>('/api/models/story-image', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (!result.url) {
      throw new Error(result.taskId ? `Image task is pending: ${result.taskId}` : 'No image URL returned');
    }
    return result.url;
  },

  async editImage(input: ImageEditInput): Promise<string> {
    const result = await request<ModelMediaResult>('/api/models/image-edit', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (!result.url) {
      throw new Error(result.taskId ? `Image task is pending: ${result.taskId}` : 'No image URL returned');
    }
    return result.url;
  },

  async updateProfile(profile: Profile): Promise<Profile> {
    try {
      return await request<Profile>('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify(profile),
      });
    } catch {
      return profile;
    }
  },

  async generateProfileAvatar(input: { nickname: string; signature: string; tags: string[]; prompt?: string }): Promise<string> {
    const prompt = [
      'Create a square cinematic profile avatar for a 2C interactive story director.',
      `Director nickname: ${input.nickname || '新导演'}.`,
      input.signature ? `Personal bio: ${input.signature}.` : '',
      input.tags?.length ? `Identity tags: ${input.tags.join(', ')}.` : '',
      input.prompt ? `Extra visual direction: ${input.prompt}.` : '',
      'Style: cosmic dark slate, black and amber accent light, refined editorial portrait, clean face silhouette, premium app avatar, no text, no logo, centered composition.',
    ].filter(Boolean).join('\n');
    const result = await request<ModelMediaResult>('/api/models/image', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
    if (!result.url) {
      throw new Error(result.taskId ? `Image task is pending: ${result.taskId}` : 'No image URL returned');
    }
    return result.url;
  },

  async exportMarkdown(title: string, scriptTimeline: ScriptLine[]): Promise<string> {
    try {
      const payload = await request<{ markdown: string }>('/api/exports/markdown', {
        method: 'POST',
        body: JSON.stringify({ title, scriptTimeline }),
      });
      return payload.markdown;
    } catch {
      return scriptTimeline.map((line) => {
        if (line.type === LogType.DIRECTOR) return `*${line.content}*`;
        if (line.type === LogType.CHARACTER) {
          const target = line.targetType === 'character' ? ` → 对 ${line.targetName || '对方'}`
            : line.targetType === 'everyone' ? ' → 对大家'
              : line.targetType === 'self' ? ' → 自言自语'
                : line.targetType === 'air' ? ' → 对空气'
                  : '';
          return `**${line.name}**${target}: ${line.content}${line.action ? ` (${line.action})` : ''}`;
        }
        return `> **导演指令**: ${line.content}`;
      }).join('\n\n');
    }
  },

  async exportAudio(title: string, scriptTimeline: ScriptLine[], activeCharacters: Character[]): Promise<Blob> {
    const response = await fetch(`${API_BASE}/api/exports/audio`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, scriptTimeline, activeCharacters }),
    });
    if (!response.ok) {
      throw new ApiError(response.status, await errorMessageFromResponse(response));
    }
    return response.blob();
  },

  async getModelCapabilities(): Promise<ModelCapabilities | null> {
    try {
      return await request<ModelCapabilities>('/api/models/capabilities');
    } catch {
      return null;
    }
  },

  async generateSceneImage(prompt: string): Promise<string> {
    const result = await request<ModelMediaResult>('/api/models/image', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
    if (!result.url) {
      throw new Error(result.taskId ? `Image task is pending: ${result.taskId}` : 'No image URL returned');
    }
    return result.url;
  },

  async generateImageFromLines(input: SceneImageInput): Promise<string> {
    const result = await request<ModelMediaResult>('/api/models/scene-image', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (!result.url) {
      throw new Error(result.taskId ? `Image task is pending: ${result.taskId}` : 'No image URL returned');
    }
    return result.url;
  },

  async generateSpeech(text: string, voiceName: string): Promise<string> {
    const result = await request<ModelMediaResult>('/api/models/speech', {
      method: 'POST',
      body: JSON.stringify({ text, voiceName }),
    });
    if (!result.url || result.url === 'data:audio/wav;base64,') {
      throw new Error('No audio URL returned');
    }
    return result.url;
  },
};
