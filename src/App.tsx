import React, { useState, useRef, useEffect } from 'react';
import { LogType, type TheaterState, type AppView, type AssetCategory, type ScriptLine } from '@/src/types';
import { MOCK_CHARACTERS, MOCK_SCENES, MOCK_STORY_SETTINGS, mockService } from '@/src/mockData';
import { RoomsView } from '@/src/components/RoomsView';
import { MarketView } from '@/src/components/MarketView';
import { AssetsView } from '@/src/components/AssetsView';
import { TheaterView } from '@/src/components/TheaterView';
import { SetupView } from '@/src/components/SetupView';
import { ProfileView } from '@/src/components/ProfileView';
import { Sidebar } from '@/src/components/Sidebar';
import { domToPng } from 'modern-screenshot';
import { motion, AnimatePresence } from 'motion/react';
import { Menu } from 'lucide-react';

export default function App() {
  const [state, setState] = useState<TheaterState>({
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
      { id: 'initial_2', type: LogType.CHARACTER, name: '林深', action: '抖开雨伞上的积水', content: '还是老样子，一股快过期的便当味。', characterId: 'char_a' }
    ],
    engine: {
      isGenerating: false,
      currentTypingId: null,
      autoPilot: false,
    },
  });

  const [input, setInput] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile sidebar toggle
  const [activeTab, setActiveTab] = useState<AssetCategory>('character');
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const theaterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
       scrollRef.current.scrollTo({
         top: scrollRef.current.scrollHeight,
         behavior: 'smooth'
       });
    }
  }, [state.scriptTimeline, state.view]);

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

    setState(prev => ({
      ...prev,
      scriptTimeline: [...prev.scriptTimeline, userLine]
    }));
    setInput('');
    
    if (state.engine.autoPilot) {
      await generateNext();
    }
  };

  const generateNext = async () => {
    if (state.engine.isGenerating) return;
    setState(prev => ({ ...prev, engine: { ...prev.engine, isGenerating: true } }));
    
    try {
      const newLineData = await mockService.fetchNextScriptLine(state.scriptTimeline);
      const newLine: ScriptLine = {
        id: Math.random().toString(),
        type: newLineData.type as LogType,
        ...newLineData,
        content: newLineData.content || ''
      };

      setState(prev => ({
        ...prev,
        scriptTimeline: [...prev.scriptTimeline, newLine],
        engine: { ...prev.engine, isGenerating: false }
      }));
    } catch (error) {
      console.error(error);
      setState(prev => ({ ...prev, engine: { ...prev.engine, isGenerating: false } }));
    }
  };

  const handleExport = async (format: 'png' | 'md' = 'png') => {
    if (format === 'md') {
      const content = state.scriptTimeline.map(line => {
        if (line.type === LogType.DIRECTOR) return `*${line.content}*`;
        if (line.type === LogType.CHARACTER) return `**${line.name}**: ${line.content}${line.action ? ` (${line.action})` : ''}`;
        return `> **You**: ${line.content}`;
      }).join('\n\n');

      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `script-${state.roomInfo.title}-${Date.now()}.md`;
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (!theaterRef.current) return;
    try {
      const dataUrl = await domToPng(theaterRef.current, { backgroundColor: '#09090b', scale: 2 });
      const link = document.createElement('a');
      link.download = `emboplot-script-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed', err);
    }
  };

  const renderView = () => {
    switch (state.view) {
      case 'market':
        return <MarketView />;
      case 'assets':
        return <AssetsView />;
      case 'profile':
        return <ProfileView onBack={() => setState(prev => ({ ...prev, view: 'rooms' }))} />;
      case 'setup':
        return (
          <SetupView 
            onBack={() => setState(prev => ({ ...prev, view: 'rooms' }))}
            onStart={(config) => setState(prev => ({
              ...prev,
              view: 'theater',
              gameSettings: config.gameSettings,
              roomInfo: { ...prev.roomInfo, title: config.theaterName || config.story.title },
              stage: { currentStory: config.story, activeCharacters: config.characters },
              scriptTimeline: [
                { id: 'init_start', type: LogType.DIRECTOR, content: `【${config.story.title}】的故事拉开了帷幕。` },
                ...(config.gameSettings.initialPlot ? [{ id: 'init_plot', type: LogType.DIRECTOR, content: config.gameSettings.initialPlot }] : [])
              ]
            }))}
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
            scrollRef={scrollRef} 
            theaterRef={theaterRef} 
            onBack={() => setState(prev => ({ ...prev, view: 'rooms' }))} 
            handleSend={handleSend} 
            generateNext={generateNext} 
            handleExport={handleExport} 
          />
        );
      default:
        return (
          <RoomsView 
            onSelectRoom={(roomId) => setState(prev => ({ ...prev, view: 'theater' }))} 
            onGoMarket={() => setState(prev => ({ ...prev, view: 'market' }))} 
            onGoAssets={() => setState(prev => ({ ...prev, view: 'assets' }))}
            onNewTheater={() => setState(prev => ({ ...prev, view: 'setup' }))}
          />
        );
    }
  };

  const requiresSidebar = ['rooms', 'market', 'assets', 'profile'].includes(state.view);

  return (
    <div className="h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans flex flex-col lg:flex-row">
      {requiresSidebar && (
        <>
          <Sidebar 
            currentView={state.view} 
            onViewChange={(view) => setState(prev => ({ ...prev, view }))} 
            isOpen={sidebarOpen}
            onToggle={() => setSidebarOpen(!sidebarOpen)}
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
