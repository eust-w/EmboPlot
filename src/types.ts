export enum LogType {
  DIRECTOR = 'director',
  CHARACTER = 'character',
  USER = 'user'
}

export type SpeechTargetType = 'character' | 'everyone' | 'self' | 'air';

export interface SpeechTarget {
  type: SpeechTargetType;
  characterId?: string;
}

export type AssetCategory = 'character' | 'background' | 'my-role' | 'story-setting';

export type AppView = 'theater' | 'market' | 'assets' | 'rooms' | 'profile' | 'setup';

export interface Character {
  id: string;
  userId?: string;
  name: string;
  avatar: string;
  description: string;
  personality?: string;
  memory?: string;
  status: 'idle' | 'speaking' | 'typing';
  isPublic?: boolean;
  publishedAt?: string;
  creator?: string;
  category?: string; // e.g., "Modern", "Fantasy"
  voiceName?: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr' | 'Cherry' | 'Serena' | 'Ethan' | 'Chelsie' | 'Dylan' | 'Jada' | 'Andre';
  createdAt?: string;
  updatedAt?: string;
}

export interface StorySetting {
  id: string;
  userId?: string;
  title: string;
  description: string;
  coverImage: string;
  tags: string[];
  isPublic?: boolean;
  publishedAt?: string;
  content?: string; 
  creator?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Scene {
  id: string;
  userId?: string;
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
  targetType?: SpeechTargetType;
  targetId?: string;
  targetName?: string;
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

export interface Room {
  id: string;
  userId?: string;
  title: string;
  storyId: string;
  characterIds: string[];
  currentStory: StorySetting;
  activeCharacters: Character[];
  gameSettings: GameSettings;
  scriptTimeline: ScriptLine[];
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Profile {
  id: string;
  userId?: string;
  email?: string;
  uid: string;
  nickname: string;
  avatarChar: string;
  avatarUrl?: string;
  signature: string;
  tags: string[];
  points: number;
  updatedAt?: string;
}

export interface PointTransaction {
  id: string;
  userId: string;
  delta: number;
  balanceAfter: number;
  reason: string;
  metadata?: Record<string, string>;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  uid: string;
  nickname: string;
  avatarChar: string;
  avatarUrl?: string;
  signature: string;
  tags: string[];
  points: number;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export interface AuthResponse {
  user: AuthUser;
}

export interface AuthSessionResponse {
  user: AuthUser | null;
}

export interface BootstrapData {
  profile: Profile;
  characters: Character[];
  marketCharacters: Character[];
  stories: StorySetting[];
  marketStories: StorySetting[];
  assets: Asset[];
  rooms: Room[];
}

export interface ModelMediaResult {
  url: string;
  taskId?: string;
  provider: string;
  model: string;
}

export interface SceneImageInput {
  roomTitle: string;
  storyTitle: string;
  storyDescription: string;
  mood: string;
  lines: ScriptLine[];
}

export interface CharacterDraftInput {
  prompt: string;
  name?: string;
  description?: string;
  personality?: string;
  memory?: string;
  voiceName?: Character['voiceName'];
}

export interface CharacterImageInput {
  name: string;
  description: string;
  personality?: string;
  memory?: string;
  prompt?: string;
}

export interface StoryDraftInput {
  prompt: string;
  title?: string;
  description?: string;
  content?: string;
  tags?: string[];
}

export interface StoryImageInput {
  title: string;
  description: string;
  content?: string;
  tags?: string[];
  prompt?: string;
}

export interface ImageEditInput {
  prompt: string;
  imageUrls: string[];
}

export interface ModelCapabilities {
  provider: string;
  mode: 'live' | 'fallback' | 'test' | string;
  models: Record<string, string>;
}
