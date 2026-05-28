import React, { useState, useRef, useEffect } from 'react';
import { LogType, type TheaterState, type AppView, type AssetCategory, type ScriptLine, type BootstrapData, type Room, type Character, type StorySetting, type Profile, type AuthUser, type SpeechTarget } from '@/src/types';
import { MOCK_CHARACTERS, MOCK_STORY_SETTINGS } from '@/src/mockData';
import { RoomsView } from '@/src/components/RoomsView';
import { MarketView } from '@/src/components/MarketView';
import { AssetsView } from '@/src/components/AssetsView';
import { TheaterView } from '@/src/components/TheaterView';
import { SetupView } from '@/src/components/SetupView';
import { ProfileView } from '@/src/components/ProfileView';
import { Sidebar } from '@/src/components/Sidebar';
import { AuthView } from '@/src/components/AuthView';
import { apiService, fallbackBootstrap } from '@/src/services/api';
import { domToPng } from 'modern-screenshot';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Menu } from 'lucide-react';

const stateFromRoom = (room: Room): TheaterState => ({
  view: 'theater',
  gameSettings: room.gameSettings,
  roomInfo: { id: room.id, title: room.title },
  stage: {
    currentStory: room.currentStory,
    activeCharacters: room.activeCharacters,
  },
  scriptTimeline: room.scriptTimeline,
  engine: {
    isGenerating: false,
    currentTypingId: null,
    autoPilot: false,
  },
});

const roomFromState = (snapshot: TheaterState, existing?: Room): Room => ({
  id: snapshot.roomInfo.id,
  userId: existing?.userId,
  title: snapshot.roomInfo.title,
  storyId: snapshot.stage.currentStory.id,
  characterIds: snapshot.stage.activeCharacters.map((char) => char.id),
  currentStory: snapshot.stage.currentStory,
  activeCharacters: snapshot.stage.activeCharacters,
  gameSettings: snapshot.gameSettings,
  scriptTimeline: snapshot.scriptTimeline,
  status: existing?.status || 'running',
  createdAt: existing?.createdAt,
  updatedAt: existing?.updatedAt,
});

const normalizeScriptContentForRepeat = (value: string) =>
  value.replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase();

const isRecentDuplicateScriptContent = (content: string, timeline: ScriptLine[]) => {
  const normalized = normalizeScriptContentForRepeat(content);
  if (!normalized) return false;
  return timeline.slice(-8).some((line) => normalizeScriptContentForRepeat(line.content) === normalized);
};

const initialState = (): TheaterState => ({
  view: 'rooms',
  gameSettings: {
    mood: 'Dramatic',
    pace: 'Balanced',
    complexity: 'Standard',
    language: 'Chinese (Simplified)'
  },
  roomInfo: { id: 'room_1', title: '便利店的宿命重逢' },
  stage: {
    currentStory: MOCK_STORY_SETTINGS[0],
    activeCharacters: MOCK_CHARACTERS.slice(0, 2),
  },
  scriptTimeline: [
    { id: 'initial_1', type: LogType.DIRECTOR, content: '午夜三点，雨势突然转急。街角的便利店成了方圆一公里内唯一的亮色。' },
    { id: 'initial_2', type: LogType.CHARACTER, name: '林深', targetType: 'air', targetName: '对空气', action: '抖开雨伞上的积水', content: '还是老样子，一股快过期的便当味。', characterId: 'char_a' }
  ],
  engine: {
    isGenerating: false,
    currentTypingId: null,
    autoPilot: false,
  },
});

export default function App() {
  const [state, setState] = useState<TheaterState>(initialState);
  const [bootstrap, setBootstrap] = useState<BootstrapData>(fallbackBootstrap);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authStatus, setAuthStatus] = useState<'loading' | 'ready'>('loading');

  const [input, setInput] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [speechTarget, setSpeechTarget] = useState<SpeechTarget>({ type: 'everyone' });
  const [voicePlaybackBusy, setVoicePlaybackBusy] = useState(false);
  const [voiceBacklogCount, setVoiceBacklogCount] = useState(0);
  const [exportingFormat, setExportingFormat] = useState<'png' | 'md' | 'audio' | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile sidebar toggle
  const [activeTab, setActiveTab] = useState<AssetCategory>('character');
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const theaterRef = useRef<HTMLDivElement>(null);
  const generationInFlightRef = useRef(false);

  const loadBootstrap = async () => {
    const data = await apiService.getBootstrap();
    setBootstrap(data);
    setState((prev) => {
      const currentRoom = data.rooms.find((room) => room.id === prev.roomInfo.id) || data.rooms[0];
      if (!currentRoom || prev.view !== 'rooms') return prev;
      return {
        ...prev,
        roomInfo: { id: currentRoom.id, title: currentRoom.title },
        stage: {
          currentStory: currentRoom.currentStory,
          activeCharacters: currentRoom.activeCharacters,
        },
        gameSettings: currentRoom.gameSettings,
        scriptTimeline: currentRoom.scriptTimeline,
      };
    });
    return data;
  };

  useEffect(() => {
    let cancelled = false;
    apiService.getCurrentUser()
      .then(async (user) => {
        if (cancelled) return;
        if (!user) {
          setAuthStatus('ready');
          return;
        }
        setAuthUser(user);
        await loadBootstrap();
        if (!cancelled) setAuthStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setAuthStatus('ready');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
       scrollRef.current.scrollTo({
         top: scrollRef.current.scrollHeight,
         behavior: 'smooth'
       });
    }
  }, [state.scriptTimeline, state.view]);

  const applySpeechTarget = (line: ScriptLine): ScriptLine => {
    if (line.type !== LogType.CHARACTER) return line;

    if (speechTarget.type === 'character') {
      const target = state.stage.activeCharacters.find((char) => char.id === speechTarget.characterId);
      if (!target || target.id === line.characterId) {
        return { ...line, targetType: 'self', targetId: undefined, targetName: '自言自语' };
      }
      return { ...line, targetType: 'character', targetId: target.id, targetName: target.name };
    }

    if (speechTarget.type === 'self') {
      return { ...line, targetType: 'self', targetId: undefined, targetName: '自言自语' };
    }
    if (speechTarget.type === 'air') {
      return { ...line, targetType: 'air', targetId: undefined, targetName: '对空气' };
    }
    return { ...line, targetType: 'everyone', targetId: undefined, targetName: '对大家' };
  };

  const handleSend = async () => {
    if (!input.trim() || state.engine.isGenerating) return;

    let userLine: ScriptLine;

    let mentionFound = false;
    for (const char of state.stage.activeCharacters) {
      const prefix = `@${char.name}`;
      if (input.startsWith(prefix)) {
        const remainingContent = input.slice(prefix.length).trim();
        userLine = {
          id: Date.now().toString(),
          type: LogType.CHARACTER,
          name: char.name,
          characterId: char.id,
          content: remainingContent || '进入了场景。',
          isStreaming: false
        };
        mentionFound = true;
        break;
      }
    }

    if (!mentionFound) {
      if (state.gameSettings.playerCharacterId) {
        const playerChar = state.stage.activeCharacters.find(c => c.id === state.gameSettings.playerCharacterId);
        if (playerChar) {
          userLine = {
            id: Date.now().toString(),
            type: LogType.CHARACTER,
            name: playerChar.name,
            characterId: playerChar.id,
            content: input,
            isStreaming: false
          };
        } else {
          userLine = { id: Date.now().toString(), type: LogType.USER, content: input };
        }
      } else {
        userLine = { id: Date.now().toString(), type: LogType.USER, content: input };
      }
    }

    const addressedLine = applySpeechTarget(userLine);
    const nextTimeline = [...state.scriptTimeline, addressedLine];

    setState(prev => ({
      ...prev,
      scriptTimeline: nextTimeline
    }));
    setInput('');
    void apiService.appendScriptLine(state.roomInfo.id, addressedLine);
  };

  const generateNext = async (historyOverride?: ScriptLine[]) => {
    if (generationInFlightRef.current || state.engine.isGenerating) return;
    generationInFlightRef.current = true;
    setState(prev => ({ ...prev, engine: { ...prev.engine, isGenerating: true } }));

    try {
      const existingRoom = bootstrap.rooms.find((room) => room.id === state.roomInfo.id);
      const roomSnapshot = roomFromState({
        ...state,
        scriptTimeline: historyOverride || state.scriptTimeline,
      }, existingRoom);
      const newLineData = await apiService.generateNextScriptLine(state.roomInfo.id, roomSnapshot);
      const newLine: ScriptLine = {
        id: Math.random().toString(),
        type: newLineData.type as LogType,
        ...newLineData,
        content: newLineData.content || ''
      };

      setState(prev => {
        if (isRecentDuplicateScriptContent(newLine.content, prev.scriptTimeline)) {
          console.warn('Blocked duplicate generated script line:', newLine.content);
          return { ...prev, engine: { ...prev.engine, autoPilot: false } };
        }
        return {
          ...prev,
          scriptTimeline: [...prev.scriptTimeline, newLine],
        };
      });
    } catch (error) {
      console.error(error);
      setState(prev => ({ ...prev, engine: { ...prev.engine, autoPilot: false } }));
    } finally {
      generationInFlightRef.current = false;
      setState(prev => ({ ...prev, engine: { ...prev.engine, isGenerating: false } }));
    }
  };

  useEffect(() => {
    const voiceLeadLimitReached = voiceBacklogCount >= 2;
    if (state.view !== 'theater' || !state.engine.autoPilot || state.engine.isGenerating || voiceLeadLimitReached) return;
    const delay = state.gameSettings.pace === 'Fast' ? 900 : state.gameSettings.pace === 'Slow' ? 3200 : 1800;
    const timer = window.setTimeout(() => {
      void generateNext();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [state.view, state.engine.autoPilot, state.engine.isGenerating, state.scriptTimeline.length, state.gameSettings.pace, voiceBacklogCount]);

  const handleExport = async (format: 'png' | 'md' | 'audio' = 'png') => {
    if (exportingFormat) return;
    setExportingFormat(format);
    try {
      if (format === 'md') {
        const content = await apiService.exportMarkdown(state.roomInfo.title, state.scriptTimeline);

        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `script-${state.roomInfo.title}-${Date.now()}.md`;
        link.click();
        URL.revokeObjectURL(url);
        return;
      }

      if (format === 'audio') {
        const blob = await apiService.exportAudio(state.roomInfo.title, state.scriptTimeline, state.stage.activeCharacters);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `script-${state.roomInfo.title}-${Date.now()}.wav`;
        link.click();
        URL.revokeObjectURL(url);
        return;
      }

      if (!theaterRef.current) return;
      const dataUrl = await domToPng(theaterRef.current, { backgroundColor: '#09090b', scale: 2 });
      const link = document.createElement('a');
      link.download = `emboplot-script-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed', err);
      alert(format === 'audio' ? '音频导出失败，请稍后重试' : '导出失败，请稍后重试');
    } finally {
      setExportingFormat(null);
    }
  };

  const handleSelectRoom = (roomId: string) => {
    const room = bootstrap.rooms.find((item) => item.id === roomId);
    if (!room) {
      setState(prev => ({ ...prev, view: 'theater' }));
      return;
    }
    setState(stateFromRoom(room));
    setSidebarOpen(false);
  };

  const handleStartTheater = async (config: { story: StorySetting; characters: Character[]; gameSettings: TheaterState['gameSettings']; theaterName: string }) => {
    const room = await apiService.createRoom({
      title: config.theaterName || config.story.title,
      storyId: config.story.id,
      characterIds: config.characters.map((char) => char.id),
      gameSettings: config.gameSettings,
    });
    setBootstrap(prev => ({
      ...prev,
      rooms: [room, ...prev.rooms.filter((item) => item.id !== room.id)],
    }));
    setState(stateFromRoom(room));
    setSidebarOpen(false);
  };

  const handleUpdateRoom = async (room: Room) => {
    const saved = await apiService.updateRoom(room);
    setBootstrap(prev => ({
      ...prev,
      rooms: prev.rooms.map((item) => item.id === saved.id ? saved : item),
    }));
    setState(prev => prev.roomInfo.id === saved.id ? {
      ...prev,
      roomInfo: { id: saved.id, title: saved.title },
      stage: {
        currentStory: saved.currentStory,
        activeCharacters: saved.activeCharacters,
      },
      gameSettings: saved.gameSettings,
      scriptTimeline: saved.scriptTimeline,
    } : prev);
    return saved;
  };

  const persistCurrentRoomState = async (snapshot: TheaterState) => {
    const existingRoom = bootstrap.rooms.find((room) => room.id === snapshot.roomInfo.id);
    const room = roomFromState(snapshot, existingRoom);
    setBootstrap(prev => ({
      ...prev,
      rooms: prev.rooms.some((item) => item.id === room.id)
        ? prev.rooms.map((item) => item.id === room.id ? room : item)
        : [room, ...prev.rooms],
    }));
    try {
      const saved = await apiService.updateRoom(room);
      setBootstrap(prev => ({
        ...prev,
        rooms: prev.rooms.map((item) => item.id === saved.id ? saved : item),
      }));
    } catch (error) {
      console.error('Failed to persist room roster:', error);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    const ok = await apiService.deleteRoom(roomId);
    if (!ok) return false;
    setBootstrap(prev => ({
      ...prev,
      rooms: prev.rooms.filter((item) => item.id !== roomId),
    }));
    setState(prev => prev.roomInfo.id === roomId ? { ...prev, view: 'rooms' } : prev);
    return true;
  };

  const handleDuplicateRoom = async (room: Room) => {
    const duplicated = await apiService.createRoom({
      title: `${room.title} 副本`,
      storyId: room.storyId,
      characterIds: room.characterIds,
      gameSettings: {
        ...room.gameSettings,
        initialPlot: room.scriptTimeline.slice(-4).map(line => line.content).filter(Boolean).join('\n'),
      },
    });
    setBootstrap(prev => ({
      ...prev,
      rooms: [duplicated, ...prev.rooms],
    }));
    return duplicated;
  };

  const handleSaveCharacter = async (character: Character) => {
    const saved = await apiService.saveCharacter(character);
    setBootstrap(prev => ({
      ...prev,
      characters: [saved, ...prev.characters.filter((item) => item.id !== saved.id)],
    }));
    return saved;
  };

  const handleSaveStory = async (story: StorySetting) => {
    const saved = await apiService.saveStory(story);
    setBootstrap(prev => ({
      ...prev,
      stories: [saved, ...prev.stories.filter((item) => item.id !== saved.id)],
    }));
    return saved;
  };

  const handlePublishCharacter = async (id: string) => {
    const saved = await apiService.publishCharacter(id);
    setBootstrap(prev => ({
      ...prev,
      characters: prev.characters.map((item) => item.id === saved.id ? saved : item),
      marketCharacters: [saved, ...prev.marketCharacters.filter((item) => item.id !== saved.id)],
    }));
    return saved;
  };

  const handleUnpublishCharacter = async (id: string) => {
    const saved = await apiService.unpublishCharacter(id);
    setBootstrap(prev => ({
      ...prev,
      characters: prev.characters.map((item) => item.id === saved.id ? saved : item),
      marketCharacters: prev.marketCharacters.filter((item) => item.id !== saved.id),
    }));
    return saved;
  };

  const handlePublishStory = async (id: string) => {
    const saved = await apiService.publishStory(id);
    setBootstrap(prev => ({
      ...prev,
      stories: prev.stories.map((item) => item.id === saved.id ? saved : item),
      marketStories: [saved, ...prev.marketStories.filter((item) => item.id !== saved.id)],
    }));
    return saved;
  };

  const handleUnpublishStory = async (id: string) => {
    const saved = await apiService.unpublishStory(id);
    setBootstrap(prev => ({
      ...prev,
      stories: prev.stories.map((item) => item.id === saved.id ? saved : item),
      marketStories: prev.marketStories.filter((item) => item.id !== saved.id),
    }));
    return saved;
  };

  const handleAcquireCharacter = async (id: string) => {
    const saved = await apiService.acquireCharacter(id);
    setBootstrap(prev => ({
      ...prev,
      characters: [saved, ...prev.characters.filter((item) => item.id !== saved.id)],
    }));
    return saved;
  };

  const handleAcquireStory = async (id: string) => {
    const saved = await apiService.acquireStory(id);
    setBootstrap(prev => ({
      ...prev,
      stories: [saved, ...prev.stories.filter((item) => item.id !== saved.id)],
    }));
    return saved;
  };

  const handleUpdateProfile = async (profile: Profile) => {
    const updated = await apiService.updateProfile(profile);
    setBootstrap(prev => ({ ...prev, profile: updated }));
    setAuthUser(prev => prev ? {
      ...prev,
      nickname: updated.nickname,
      avatarChar: updated.avatarChar,
      avatarUrl: updated.avatarUrl,
      signature: updated.signature,
      tags: updated.tags,
      points: updated.points,
      updatedAt: updated.updatedAt,
    } : prev);
    return updated;
  };

  const handleAuthenticated = async (user: AuthUser) => {
    setAuthUser(user);
    await loadBootstrap();
    setState(prev => ({ ...prev, view: 'rooms' }));
  };

  const handleLogout = async () => {
    await apiService.logout();
    setAuthUser(null);
    setBootstrap(fallbackBootstrap);
    setState(initialState());
  };

  const renderView = () => {
    switch (state.view) {
      case 'market':
        return (
          <MarketView
            onBack={() => setState(prev => ({ ...prev, view: 'rooms' }))}
            initialCharacters={bootstrap.marketCharacters}
            initialStories={bootstrap.marketStories}
            onAcquireCharacter={handleAcquireCharacter}
            onAcquireStory={handleAcquireStory}
          />
        );
      case 'assets':
        return (
          <AssetsView
            onBack={() => setState(prev => ({ ...prev, view: 'rooms' }))}
            initialCharacters={bootstrap.characters}
            initialStories={bootstrap.stories}
            onSaveCharacter={handleSaveCharacter}
            onSaveStory={handleSaveStory}
            onPublishCharacter={handlePublishCharacter}
            onUnpublishCharacter={handleUnpublishCharacter}
            onPublishStory={handlePublishStory}
            onUnpublishStory={handleUnpublishStory}
            onParseCharacterFile={apiService.parseCharacterFile}
            onGenerateCharacter={apiService.generateCharacter}
            onGenerateCharacterImage={apiService.generateCharacterImage}
            onGenerateStory={apiService.generateStory}
            onGenerateStoryImage={apiService.generateStoryImage}
            onEditImage={apiService.editImage}
          />
        );
      case 'profile':
        return (
          <ProfileView
            profile={bootstrap.profile}
            onSaveProfile={handleUpdateProfile}
            onGenerateProfileAvatar={apiService.generateProfileAvatar}
            onLogout={handleLogout}
            onBack={() => setState(prev => ({ ...prev, view: 'rooms' }))}
          />
        );
      case 'setup':
        return (
          <SetupView
            onBack={() => setState(prev => ({ ...prev, view: 'rooms' }))}
            stories={bootstrap.stories}
            characters={bootstrap.characters}
            onStart={handleStartTheater}
          />
        );
      case 'theater':
        return (
          <TheaterView
            state={state}
            setState={setState}
            input={input}
            setInput={setInput}
            showMentions={showMentions}
            setShowMentions={setShowMentions}
            sidebarOpen={true}
            setSidebarOpen={() => {}}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            setIsCreatorOpen={setIsCreatorOpen}
            libraryCharacters={bootstrap.characters}
            libraryStories={bootstrap.stories}
            persistRoomState={persistCurrentRoomState}
            scrollRef={scrollRef}
            theaterRef={theaterRef}
            onBack={() => setState(prev => ({ ...prev, view: 'rooms' }))}
            handleSend={handleSend}
            generateNext={generateNext}
            handleExport={handleExport}
            exportingFormat={exportingFormat}
            speechTarget={speechTarget}
            setSpeechTarget={setSpeechTarget}
            voicePlaybackBusy={voicePlaybackBusy}
            setVoicePlaybackBusy={setVoicePlaybackBusy}
            voiceBacklogCount={voiceBacklogCount}
            setVoiceBacklogCount={setVoiceBacklogCount}
          />
        );
      default:
        return (
          <RoomsView
            rooms={bootstrap.rooms}
            stories={bootstrap.stories}
            onSelectRoom={handleSelectRoom}
            onGoMarket={() => setState(prev => ({ ...prev, view: 'market' }))}
            onGoAssets={() => setState(prev => ({ ...prev, view: 'assets' }))}
            onNewTheater={() => setState(prev => ({ ...prev, view: 'setup' }))}
            onUpdateRoom={handleUpdateRoom}
            onDeleteRoom={handleDeleteRoom}
            onDuplicateRoom={handleDuplicateRoom}
          />
        );
    }
  };

  const requiresSidebar = ['rooms', 'market', 'assets', 'profile'].includes(state.view);

  if (authStatus === 'loading') {
    return (
      <div className="h-screen w-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-500 text-sm font-bold">
          <Loader2 size={18} className="animate-spin text-amber-500" />
          正在恢复导演会话
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <AuthView
        onLogin={apiService.login}
        onRegister={apiService.register}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  return (
    <div className="cosmic-shell h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans flex flex-col lg:flex-row">
      {requiresSidebar && (
        <>
          <Sidebar
            currentView={state.view}
            onViewChange={(view) => setState(prev => ({ ...prev, view }))}
            isOpen={sidebarOpen}
            onToggle={() => setSidebarOpen(!sidebarOpen)}
            user={authUser}
            onLogout={handleLogout}
          />
          {/* Mobile Header */}
          <header className="lg:hidden flex items-center justify-between p-4 border-b border-white/5 bg-zinc-950 sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center">
                <span className="text-zinc-950 font-black text-xs">P</span>
              </div>
              <h1 className="font-black italic tracking-tighter text-sm uppercase">Parallel</h1>
            </div>
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="打开导航"
              className="p-2 text-zinc-400 hover:text-white"
            >
              <Menu size={20} />
            </button>
          </header>
        </>
      )}

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={state.view}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="h-full w-full"
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Noto+Serif+SC:wght@400;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        .font-sans { font-family: 'Outfit', sans-serif; }
        .font-serif { font-family: 'Noto Serif SC', serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
}
