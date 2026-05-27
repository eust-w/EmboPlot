export enum LogType {
  DIRECTOR = 'director',
  CHARACTER = 'character',
  USER = 'user'
}

export type AssetCategory = 'character' | 'background' | 'my-role' | 'story-setting';

export type AppView = 'theater' | 'market' | 'assets' | 'rooms' | 'profile';

export interface Character {
  id: string;
  name: string;
  avatar: string;
  description: string;
  personality?: string;
  memory?: string;
  status: 'idle' | 'speaking' | 'typing';
  isPublic?: boolean;
  creator?: string;
  category?: string; // e.g., "Modern", "Fantasy"
  voiceName?: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
}

export interface StorySetting {
  id: string;
  title: string;
  description: string;
  coverImage: string;
  tags: string[];
  isPublic?: boolean;
  content?: string; 
}

export interface Scene {
  id: string;
  name: string;
  url: string;
  description: string;
  isPublic?: boolean;
}

export interface ScriptLine {
  id: string;
  type: LogType;
  characterId?: string;
  name?: string;
  action?: string;
  content: string;
  isStreaming?: boolean;
  imageUrl?: string;
  audioUrl?: string;
}

export interface GameSettings {
  mood: string;
  pace: 'Fast' | 'Balanced' | 'Slow';
  complexity: 'Simple' | 'Standard' | 'Deep';
  initialPlot?: string;
  language: string;
  playerCharacterId?: string;
}

export interface TheaterState {
  view: AppView;
  gameSettings: GameSettings;
  roomInfo: {
    id: string;
    title: string;
  };
  stage: {
    currentStory: StorySetting;
    activeCharacters: Character[];
  };
  scriptTimeline: ScriptLine[];
  engine: {
    isGenerating: boolean;
    currentTypingId: string | null;
    autoPilot: boolean;
  };
}

export interface Asset {
  id: string;
  type: AssetCategory;
  title: string;
  url: string;
  tags: string[];
  description?: string;
  createdAt: number;
}
