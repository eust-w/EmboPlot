import React, { useState } from 'react';
import { Send, AtSign, Play, Square, Download, LayoutGrid, ArrowLeft, Users, Plus, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { LogType, type Character, type ScriptLine, type TheaterState, type AssetCategory } from '@/src/types';
import { MOCK_CHARACTERS, MOCK_STORY_SETTINGS } from '@/src/mockData';
import { geminiService } from '@/src/services/geminiService';
import TypewriterText from './TypewriterText';

interface TheaterViewProps {
  state: TheaterState;
  setState: React.Dispatch<React.SetStateAction<TheaterState>>;
  input: string;
  setInput: (val: string) => void;
  showMentions: boolean;
  setShowMentions: (val: boolean) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (val: boolean) => void;
  activeTab: AssetCategory;
  setActiveTab: (val: AssetCategory) => void;
  setIsCreatorOpen: (val: boolean) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  theaterRef: React.RefObject<HTMLDivElement | null>;
  onBack: () => void;
  handleSend: () => void;
  generateNext: () => void;
  handleExport: (format: 'png' | 'md') => void;
}

export const TheaterView: React.FC<TheaterViewProps> = (props) => {
  const { state, setState, input, setInput, showMentions, setShowMentions, sidebarOpen, setSidebarOpen, activeTab, setActiveTab, setIsCreatorOpen, scrollRef, theaterRef, onBack, handleSend, generateNext, handleExport } = props;

  const [generatingImages, setGeneratingImages] = useState<Set<string>>(new Set());
  const [generatingVoices, setGeneratingVoices] = useState<Set<string>>(new Set());

  const handleGenerateImage = async (lineId: string) => {
    const line = state.scriptTimeline.find(l => l.id === lineId);
    if (!line) return;

    setGeneratingImages(prev => new Set(prev).add(lineId));
    try {
      const prompt = `A cinematic visualize for a script scene. Context: ${state.stage.currentStory.description}. Script line: "${line.content}". Character: ${line.name || 'Narrator'}. Style: epic concept art.`;
      const imageUrl = await geminiService.generateImage(prompt);
      
      setState(prev => ({
        ...prev,
        scriptTimeline: prev.scriptTimeline.map(l => l.id === lineId ? { ...l, imageUrl } : l)
      }));
    } catch (error) {
      alert('图片生成失败');
    } finally {
      setGeneratingImages(prev => {
        const next = new Set(prev);
        next.delete(lineId);
        return next;
      });
    }
  };

  const handlePlayVoice = async (lineId: string) => {
    const line = state.scriptTimeline.find(l => l.id === lineId);
    if (!line) return;

    // Reset audioUrl to trigger autoPlay if it already exists
    if (line.audioUrl) {
      setState(prev => ({
        ...prev,
        scriptTimeline: prev.scriptTimeline.map(l => l.id === lineId ? { ...l, audioUrl: undefined } : l)
      }));
      setTimeout(() => {
        setState(prev => ({
          ...prev,
          scriptTimeline: prev.scriptTimeline.map(l => l.id === lineId ? { ...l, audioUrl: line.audioUrl } : l)
        }));
      }, 50);
      return;
    }

    setGeneratingVoices(prev => new Set(prev).add(lineId));
    try {
      const character = state.stage.activeCharacters.find(c => c.id === line.characterId);
      const voiceName = character?.voiceName || 'Kore';
      const audioUrl = await geminiService.generateSpeech(line.content, voiceName);
      
      setState(prev => ({
        ...prev,
        scriptTimeline: prev.scriptTimeline.map(l => l.id === lineId ? { ...l, audioUrl } : l)
      }));
    } catch (error) {
      alert('语音合成失败');
    } finally {
      setGeneratingVoices(prev => {
        const next = new Set(prev);
        next.delete(lineId);
        return next;
      });
    }
  };

  return (
    <div className="flex h-full w-full relative">
      {/* 侧边栏：分类资产管理 */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: sidebarOpen ? (window.innerWidth < 1024 ? '100%' : 320) : 0, 
          opacity: sidebarOpen ? 1 : 0,
          zIndex: 50
        }}
        className={cn(
          "flex flex-col border-r border-zinc-900 bg-zinc-900 shadow-xl overflow-hidden",
          window.innerWidth < 1024 ? "fixed inset-y-0 left-0" : "relative"
        )}
      >
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-8">
            <button onClick={onBack} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 flex items-center gap-2">
              <ArrowLeft size={18} />
              <span className="text-xs font-bold uppercase tracking-widest">返回大厅</span>
            </button>
            <button 
              onClick={() => setSidebarOpen(false)} 
              className="lg:hidden p-2 hover:bg-zinc-800 rounded-full text-zinc-500"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex gap-2 p-1 bg-zinc-800 rounded-xl mb-6">
            <button 
              onClick={() => setActiveTab('character')}
              className={cn(
                "flex-1 py-1.5 text-xs font-medium rounded-lg transition-all",
                activeTab === 'character' ? "bg-zinc-700 text-zinc-100 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              人物
            </button>
            <button 
              onClick={() => setActiveTab('story-setting')}
              className={cn(
                "flex-1 py-1.5 text-xs font-medium rounded-lg transition-all",
                activeTab === 'story-setting' ? "bg-zinc-700 text-zinc-100 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              背景
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
            <div className="mb-8 p-4 bg-zinc-800/30 rounded-2xl border border-white/5">
              <h3 className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2">
                <Sparkles size={12} className="text-amber-500" /> 推演当前设定
              </h3>
              <div className="space-y-2 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-zinc-500">叙法风格:</span>
                  <span className="text-zinc-200">{state.gameSettings.mood}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">演出速率:</span>
                  <span className="text-zinc-200">{state.gameSettings.pace}</span>
                </div>
                {state.gameSettings.initialPlot && (
                  <div className="pt-2 italic text-zinc-400 leading-relaxed border-t border-white/5 mt-2">
                    "{state.gameSettings.initialPlot}"
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                {activeTab === 'character' ? '人物编年史' : '故事背景录'}
              </h3>
              <div className="flex gap-2">
                {activeTab === 'character' && (
                   <button 
                    onClick={() => {
                        const newPlayer: Character = {
                            id: `player_${Date.now()}`,
                            name: `玩家_${Math.floor(Math.random() * 1000)}`,
                            avatar: `https://i.pravatar.cc/100?img=${Math.floor(Math.random() * 70)}`,
                            description: '真人玩家加入剧场',
                            status: 'idle'
                        };
                        setState(prev => ({
                            ...prev,
                            stage: {
                                ...prev.stage,
                                activeCharacters: [...prev.stage.activeCharacters, newPlayer]
                            }
                        }));
                    }}
                    className="text-zinc-500 hover:text-blue-400 transition-colors"
                    title="真人加入"
                  >
                    <Users size={16} />
                  </button>
                )}
                <button 
                  onClick={() => activeTab === 'character' && setIsCreatorOpen(true)}
                  className="text-amber-500 hover:text-amber-400 transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div className="grid gap-3 mb-8">
              {activeTab === 'character' ? (
                MOCK_CHARACTERS.map(char => (
                  <div 
                    key={char.id} 
                    onClick={() => {
                        const isAlreadyActive = state.stage.activeCharacters.some(c => c.id === char.id);
                        if (!isAlreadyActive) {
                            setState(prev => ({
                                ...prev,
                                stage: {
                                    ...prev.stage,
                                    activeCharacters: [...prev.stage.activeCharacters, char]
                                }
                            }));
                        }
                        setInput(input + `@${char.name} `);
                    }}
                    className="group bg-zinc-800/50 hover:bg-zinc-800 border border-white/5 hover:border-amber-500/30 p-3 rounded-xl cursor-pointer transition-all flex items-center gap-4"
                  >
                    <img src={char.avatar} alt={char.name} className="w-12 h-12 rounded-lg object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate group-hover:text-amber-500">{char.name}</p>
                      <p className="text-[10px] text-zinc-500 truncate">{char.description}</p>
                    </div>
                  </div>
                ))
              ) : (
                MOCK_STORY_SETTINGS.map(story => (
                  <div 
                    key={story.id}
                    onClick={() => setState(prev => ({ ...prev, stage: { ...prev.stage, currentStory: story } }))}
                    className="group relative h-24 rounded-xl overflow-hidden cursor-pointer border border-transparent hover:border-amber-500 transition-all"
                  >
                    <img src={story.coverImage} alt={story.title} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-3">
                       <p className="text-xs font-bold">{story.title}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </motion.aside>

      {/* 主屏幕：沙盒剧场 */}
      <main className="flex-1 relative flex flex-col">
        <header className="h-16 lg:h-20 flex items-center justify-between px-4 lg:px-8 z-20 bg-zinc-950/50 backdrop-blur-md border-b border-white/5">
          <div className="flex items-center gap-4 lg:gap-8">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500">
              <LayoutGrid size={20} />
            </button>
            <div className="flex flex-col">
              <span className="text-[9px] lg:text-[10px] font-mono tracking-widest text-zinc-500 uppercase">当前剧目</span>
              <p className="text-sm lg:text-lg font-serif font-bold tracking-wide truncate max-w-[150px] lg:max-w-none">{state.roomInfo.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-6">
             <div className="hidden sm:flex -space-x-2">
               {state.stage.activeCharacters.map(char => (
                 <div key={char.id} className="relative group">
                   <img src={char.avatar} alt={char.name} className={cn("w-8 h-8 lg:w-10 lg:h-10 rounded-full border-2 border-zinc-950 object-cover transition-all", char.status === 'speaking' ? "ring-2 ring-amber-400 scale-110 z-10" : "opacity-40")} />
                 </div>
               ))}
             </div>
             <div className="flex items-center bg-zinc-800 rounded-full p-1 border border-white/5 scale-90 lg:scale-100">
               <button 
                onClick={() => handleExport('png')} 
                className="px-3 lg:px-4 py-1.5 hover:bg-zinc-700 rounded-full text-[10px] lg:text-xs font-bold transition-all flex items-center gap-2"
                title="导出长图"
               >
                  <Download size={14} /> PNG
               </button>
               <div className="w-[1px] h-4 bg-white/10 mx-1" />
               <button 
                onClick={() => handleExport('md')} 
                className="px-3 lg:px-4 py-1.5 hover:bg-zinc-700 rounded-full text-[10px] lg:text-xs font-bold transition-all flex items-center gap-2"
                title="导出剧本"
               >
                  <Download size={14} /> MD
               </button>
             </div>
          </div>
        </header>

        <div ref={theaterRef} className="flex-1 relative overflow-hidden flex flex-col">
          <div className="absolute inset-0 z-0">
             <img src={state.stage.currentStory.coverImage} className="w-full h-full object-cover filter blur-[2px] brightness-[0.25]" alt="" />
          </div>

          <div ref={scrollRef} className="flex-1 relative z-10 overflow-y-auto custom-scrollbar px-6 md:px-24 py-12">
            <div className="max-w-3xl mx-auto">
              {state.scriptTimeline.map((line, idx) => (
                <TypewriterText 
                  key={line.id} 
                  line={line} 
                  isNew={idx === state.scriptTimeline.length - 1 && (line.type !== LogType.USER)} 
                  onGenerateImage={handleGenerateImage}
                  onPlayVoice={handlePlayVoice}
                  isGeneratingImage={generatingImages.has(line.id)}
                  isGeneratingVoice={generatingVoices.has(line.id)}
                />
              ))}
              {state.engine.isGenerating && (
                <div className="flex justify-center my-8">
                   <div className="flex gap-2">
                      {[0, 1, 2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />)}
                   </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="absolute bottom-6 lg:bottom-8 left-1/2 -translate-x-1/2 w-full max-w-3xl px-4 lg:px-6 z-40">
          <div className="relative flex flex-col gap-3">
            <AnimatePresence>
              {showMentions && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-full left-0 mb-4 w-72 bg-zinc-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-2 ring-1 ring-black/50"
                >
                  <p className="text-[10px] font-mono text-zinc-500 px-3 py-2 uppercase tracking-widest">登场人物列表</p>
                  {state.stage.activeCharacters
                    .filter(c => {
                      const lastAtIndex = input.lastIndexOf('@');
                      if (lastAtIndex === -1) return false;
                      const query = input.slice(lastAtIndex + 1).toLowerCase();
                      // If query has spaces, we assume the user is done with the name or referring to someone else
                      if (query.includes(' ')) return false;
                      return c.name.toLowerCase().includes(query);
                    })
                    .map(char => (
                    <button
                      key={char.id}
                      onClick={() => {
                        const lastAtIndex = input.lastIndexOf('@');
                        const beforeAt = input.substring(0, lastAtIndex);
                        setInput(beforeAt + "@" + char.name + " ");
                        setShowMentions(false);
                      }}
                      className="w-full flex items-center gap-3 p-2 hover:bg-amber-500/10 rounded-xl transition-all group"
                    >
                      <img src={char.avatar} alt={char.name} className="w-10 h-10 rounded-lg object-cover ring-1 ring-white/5" />
                      <div className="text-left">
                        <p className="text-sm font-bold group-hover:text-amber-500">{char.name}</p>
                        <p className="text-[10px] text-zinc-500 truncate w-40">{char.description}</p>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="bg-zinc-900/60 backdrop-blur-3xl border border-white/10 rounded-2xl lg:rounded-3xl p-2 lg:p-3 shadow-2xl flex items-center gap-2 lg:gap-4 transition-all focus-within:ring-2 ring-amber-500/20">
              <button 
                onClick={() => setState(prev => ({ ...prev, engine: { ...prev.engine, autoPilot: !prev.engine.autoPilot } }))}
                className={cn(
                  "relative w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl flex items-center justify-center transition-all overflow-hidden group shrink-0",
                  state.engine.autoPilot ? "bg-amber-500 text-zinc-950" : "bg-white/5 text-zinc-400 hover:bg-white/10"
                )}
              >
                {state.engine.autoPilot ? <Play size={18} fill="currentColor" className="lg:hidden" /> : <Square size={18} className="lg:hidden" />}
                {state.engine.autoPilot ? <Play size={22} fill="currentColor" className="hidden lg:block" /> : <Square size={22} className="hidden lg:block" />}
                {state.engine.autoPilot && (
                  <div className="absolute inset-0 bg-white/20 animate-pulse pointer-events-none" />
                )}
              </button>

              <div className="flex-1 relative">
                 <input 
                  value={input}
                  onChange={(e) => {
                    const val = e.target.value;
                    setInput(val);
                    
                    const lastAt = val.lastIndexOf('@');
                    if (lastAt !== -1) {
                      const textAfterAt = val.substring(lastAt + 1);
                      const textBeforeAt = val.substring(0, lastAt);
                      
                      // Show mentions if "@" is at start or after a space, and no space after it yet
                      if ((textBeforeAt === "" || textBeforeAt.endsWith(" ")) && !textAfterAt.includes(" ")) {
                        setShowMentions(true);
                        return;
                      }
                    }
                    setShowMentions(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                       if (showMentions) {
                          const filtered = state.stage.activeCharacters.filter(c => {
                            const lastAtIndex = input.lastIndexOf('@');
                            if (lastAtIndex === -1) return false;
                            const query = input.slice(lastAtIndex + 1).toLowerCase();
                            return c.name.toLowerCase().includes(query);
                          });
                          if (filtered.length > 0) {
                             e.preventDefault();
                             const char = filtered[0];
                             const lastAtIndex = input.lastIndexOf('@');
                             const beforeAt = input.substring(0, lastAtIndex);
                             setInput(beforeAt + "@" + char.name + " ");
                             setShowMentions(false);
                             return;
                          }
                       }
                       handleSend();
                    }
                  }}
                  placeholder={
                    window.innerWidth < 640 
                    ? "输入并召唤 @角色"
                    : (state.gameSettings.playerCharacterId 
                      ? `正在以“${state.stage.activeCharacters.find(c => c.id === state.gameSettings.playerCharacterId)?.name}”身份对话...`
                      : "作为“上帝”干预剧情：输入动作或召唤 @角色")
                  }
                  className="w-full bg-transparent border-none focus:ring-0 text-zinc-100 placeholder:text-zinc-600 text-sm lg:text-base font-medium"
                 />
              </div>

              <div className="flex items-center gap-1 lg:gap-2">
                <button 
                  onClick={() => setShowMentions(!showMentions)}
                  className={cn("p-1.5 lg:p-2 transition-colors", showMentions ? "text-amber-500" : "text-zinc-500 hover:text-zinc-300")}
                >
                  <AtSign size={18} />
                </button>
                <button 
                  onClick={handleSend}
                  disabled={!input.trim() || state.engine.isGenerating}
                  className="p-2.5 lg:p-3 bg-amber-500 text-zinc-950 rounded-xl lg:rounded-2xl hover:scale-105 active:scale-95 disabled:grayscale disabled:opacity-50 transition-all flex items-center justify-center shadow-lg shadow-amber-500/20"
                >
                  {state.engine.isGenerating ? (
                    <div className="w-5 h-5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send size={18} className="lg:hidden" />
                  )}
                  {(!state.engine.isGenerating && (
                    <Send size={20} className="hidden lg:block" />
                  ))}
                </button>
              </div>
            </div>
            
            <div className="flex justify-between px-6">
               <p className="text-[10px] text-zinc-600 font-mono tracking-widest uppercase flex items-center gap-2">
                 <span className="w-1.5 h-1.5 rounded-full bg-green-500/80 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                 引擎状态: 推演中
               </p>
               <div className="flex gap-4">
                 <button onClick={generateNext} className="text-[10px] font-bold text-amber-500/60 hover:text-amber-500 uppercase tracking-widest transition-colors">
                   下个台词 →
                 </button>
               </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
