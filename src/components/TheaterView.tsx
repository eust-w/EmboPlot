import React, { useEffect, useRef, useState } from 'react';
import { Send, AtSign, Play, Pause, Download, LayoutGrid, ArrowLeft, Users, Plus, Sparkles, X, Images, Loader2, SkipForward, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { LogType, type Character, type TheaterState, type AssetCategory, type StorySetting, type SpeechTarget } from '@/src/types';
import { modelService } from '@/src/services/modelService';
import { isInsufficientPointsError } from '@/src/services/api';
import { useMediaQuery } from '@/src/hooks/useMediaQuery';
import TypewriterText from './TypewriterText';

type ScriptLineMediaPatch = Partial<Pick<TheaterState['scriptTimeline'][number], 'imageUrl' | 'audioUrl'>>;
type TheaterNotice = {
  tone: 'warning' | 'error';
  title: string;
  message: string;
  action?: 'profile';
};
const IMAGE_GENERATE_COST_POINTS = 30;

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
  libraryCharacters: Character[];
  libraryStories: StorySetting[];
  currentPoints: number;
  persistRoomState: (state: TheaterState) => void;
  persistScriptLinePatch: (lineId: string, patch: ScriptLineMediaPatch) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  theaterRef: React.RefObject<HTMLDivElement | null>;
  onBack: () => void;
  handleSend: () => void;
  generateNext: () => void;
  handleExport: (format: 'png' | 'md' | 'audio') => void;
  exportingFormat: 'png' | 'md' | 'audio' | null;
  speechTarget: SpeechTarget;
  setSpeechTarget: (target: SpeechTarget) => void;
  voicePlaybackBusy: boolean;
  setVoicePlaybackBusy: (busy: boolean) => void;
  voiceBacklogCount: number;
  setVoiceBacklogCount: (count: number) => void;
}

export const TheaterView: React.FC<TheaterViewProps> = (props) => {
  const { state, setState, input, setInput, showMentions, setShowMentions, sidebarOpen, setSidebarOpen, activeTab, setActiveTab, setIsCreatorOpen, libraryCharacters, libraryStories, currentPoints, persistRoomState, persistScriptLinePatch, scrollRef, theaterRef, onBack, handleSend, generateNext, handleExport, exportingFormat, speechTarget, setSpeechTarget, voicePlaybackBusy, setVoicePlaybackBusy, voiceBacklogCount, setVoiceBacklogCount } = props;

  const [generatingImages, setGeneratingImages] = useState<Set<string>>(new Set());
  const [generatingVoices, setGeneratingVoices] = useState<Set<string>>(new Set());
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());
  const [isGeneratingSelectionImage, setIsGeneratingSelectionImage] = useState(false);
  const [autoVoice, setAutoVoice] = useState(true);
  const [notice, setNotice] = useState<TheaterNotice | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoVoiceRoomIdRef = useRef<string | null>(null);
  const autoVoiceSeenLineIdsRef = useRef<Set<string>>(new Set());
  const autoVoiceQueuedLineIdsRef = useRef<Set<string>>(new Set());
  const autoVoiceQueueRef = useRef<Array<{ line: TheaterState['scriptTimeline'][number]; silent: boolean }>>([]);
  const autoVoiceProcessingRef = useRef(false);
  const voiceCurrentlyPlayingRef = useRef(false);
  const voiceCacheRef = useRef<Map<string, { audioUrl?: string; promise?: Promise<string> }>>(new Map());
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const sidebarExpanded = !isMobile || sidebarOpen;
  const selectedLines = state.scriptTimeline.filter(line => selectedLineIds.has(line.id) && line.content.trim());
  const speechTargetValue = speechTarget.type === 'character' && speechTarget.characterId ? `character:${speechTarget.characterId}` : speechTarget.type;
  const engineStatus = state.engine.isGenerating ? '生成中' : voicePlaybackBusy ? '播报中' : state.engine.autoPilot ? '自动推演' : '已暂停';

  const applyScriptLinePatch = (lineId: string, patch: ScriptLineMediaPatch) => {
    setState(prev => ({
      ...prev,
      scriptTimeline: prev.scriptTimeline.map(line => line.id === lineId ? { ...line, ...patch } : line)
    }));
    persistScriptLinePatch(lineId, patch);
  };

  const showInsufficientPointsNotice = (required = IMAGE_GENERATE_COST_POINTS, remaining = currentPoints) => {
    setNotice({
      tone: 'warning',
      title: '剧情币不足',
      message: `本次生成场景图需要 ${required} POINTS，当前剩余 ${Math.max(remaining, 0)} POINTS。`,
      action: 'profile',
    });
  };

  const showImageFailureNotice = (title: string, message: string) => {
    setNotice({
      tone: 'error',
      title,
      message,
    });
  };

  const ensureEnoughImagePoints = () => {
    if (currentPoints >= IMAGE_GENERATE_COST_POINTS) return true;
    showInsufficientPointsNotice();
    return false;
  };

  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile, setSidebarOpen]);

  const handleGenerateImage = async (lineId: string) => {
    const line = state.scriptTimeline.find(l => l.id === lineId);
    if (!line) return;
    if (!ensureEnoughImagePoints()) return;

    setGeneratingImages(prev => new Set(prev).add(lineId));
    try {
      const prompt = `A cinematic visualize for a script scene. Context: ${state.stage.currentStory.description}. Script line: "${line.content}". Character: ${line.name || 'Narrator'}. Style: epic concept art.`;
      const imageUrl = await modelService.generateImage(prompt);

      applyScriptLinePatch(lineId, { imageUrl });
    } catch (error) {
      if (isInsufficientPointsError(error)) {
        showInsufficientPointsNotice(error.pointsRequired, error.pointsRemaining);
        return;
      }
      const message = error instanceof Error ? error.message : '未知错误';
      showImageFailureNotice('图片生成失败', message);
    } finally {
      setGeneratingImages(prev => {
        const next = new Set(prev);
        next.delete(lineId);
        return next;
      });
    }
  };

  const toggleLineSelection = (lineId: string) => {
    setSelectedLineIds(prev => {
      const next = new Set(prev);
      if (next.has(lineId)) {
        next.delete(lineId);
      } else {
        next.add(lineId);
      }
      return next;
    });
  };

  const handleGenerateSelectionImage = async () => {
    if (selectedLines.length === 0 || isGeneratingSelectionImage) return;
    if (!ensureEnoughImagePoints()) return;

    setIsGeneratingSelectionImage(true);
    try {
      const imageUrl = await modelService.generateImageFromLines({
        roomTitle: state.roomInfo.title,
        storyTitle: state.stage.currentStory.title,
        storyDescription: state.stage.currentStory.description,
        mood: state.gameSettings.mood,
        lines: selectedLines,
      });
      const targetLineId = selectedLines[selectedLines.length - 1].id;
      applyScriptLinePatch(targetLineId, { imageUrl });
      setSelectedLineIds(new Set());
    } catch (error) {
      if (isInsufficientPointsError(error)) {
        showInsufficientPointsNotice(error.pointsRequired, error.pointsRemaining);
        return;
      }
      const message = error instanceof Error ? error.message : '未知错误';
      showImageFailureNotice('场景图生成失败', message);
    } finally {
      setIsGeneratingSelectionImage(false);
    }
  };

  const playAudioUrl = async (audioUrl: string, options: { waitForEnd?: boolean; interrupt?: boolean } = {}) => {
    if (!audioUrl || audioUrl === 'data:audio/wav;base64,') {
      throw new Error('empty audio url');
    }
    const shouldInterrupt = options.interrupt ?? true;
    if (shouldInterrupt && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    const audio = new Audio(audioUrl);
    audio.preload = 'auto';
    audioRef.current = audio;
    await audio.play();
    if (!options.waitForEnd) return;
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('error', handleError);
        audio.removeEventListener('pause', handlePause);
      };
      const handleEnded = () => {
        cleanup();
        resolve();
      };
      const handleError = () => {
        cleanup();
        reject(new Error('audio playback failed'));
      };
      const handlePause = () => {
        if (!audio.ended) {
          cleanup();
          resolve();
        }
      };
      audio.addEventListener('ended', handleEnded, { once: true });
      audio.addEventListener('error', handleError, { once: true });
      audio.addEventListener('pause', handlePause, { once: true });
    });
  };

  const handleSpeechTargetChange = (value: string) => {
    if (value.startsWith('character:')) {
      setSpeechTarget({ type: 'character', characterId: value.slice('character:'.length) });
      return;
    }
    if (value === 'air' || value === 'self' || value === 'everyone') {
      setSpeechTarget({ type: value });
    }
  };

  const voiceNameForLine = (line: TheaterState['scriptTimeline'][number]) => {
    if (line.type === LogType.DIRECTOR) return 'Cherry';
    const character = state.stage.activeCharacters.find(c => c.id === line.characterId);
    return character?.voiceName || 'Kore';
  };

  const prefetchLineVoice = (line: TheaterState['scriptTimeline'][number]): Promise<string> | null => {
    if (!line.content.trim() || line.type === LogType.USER) return null;
    if (line.audioUrl) {
      voiceCacheRef.current.set(line.id, { audioUrl: line.audioUrl });
      return Promise.resolve(line.audioUrl);
    }

    const cached = voiceCacheRef.current.get(line.id);
    if (cached?.audioUrl) return Promise.resolve(cached.audioUrl);
    if (cached?.promise) return cached.promise;

    setGeneratingVoices(prev => new Set(prev).add(line.id));
    const promise = modelService.generateSpeech(line.content, voiceNameForLine(line))
      .then((audioUrl) => {
        voiceCacheRef.current.set(line.id, { audioUrl });
        applyScriptLinePatch(line.id, { audioUrl });
        return audioUrl;
      })
      .catch((error) => {
        voiceCacheRef.current.delete(line.id);
        throw error;
      })
      .finally(() => {
        setGeneratingVoices(prev => {
          const next = new Set(prev);
          next.delete(line.id);
          return next;
        });
      });
    voiceCacheRef.current.set(line.id, { promise });
    return promise;
  };

  const playLineVoice = async (line: TheaterState['scriptTimeline'][number], options: { silent?: boolean; waitForEnd?: boolean; interrupt?: boolean } = {}) => {
    const audioPromise = prefetchLineVoice(line);
    if (!audioPromise) return;

    try {
      const audioUrl = await audioPromise;
      await playAudioUrl(audioUrl, { waitForEnd: options.waitForEnd, interrupt: options.interrupt });
    } catch (error) {
      if (!options.silent) {
        showImageFailureNotice('语音播放失败', line.audioUrl ? '浏览器未能播放此音频，请稍后再试。' : '语音合成失败，请稍后再试。');
      }
    }
  };

  const handlePlayVoice = async (lineId: string) => {
    const line = state.scriptTimeline.find(l => l.id === lineId);
    if (!line) return;
    enqueueVoiceLine(line, { silent: false });
  };

  const updateVoiceBacklog = () => {
    setVoiceBacklogCount(autoVoiceQueueRef.current.length + (voiceCurrentlyPlayingRef.current ? 1 : 0));
  };

  const processAutoVoiceQueue = async () => {
    if (autoVoiceProcessingRef.current) return;
    autoVoiceProcessingRef.current = true;
    setVoicePlaybackBusy(true);
    updateVoiceBacklog();
    try {
      while (autoVoiceQueueRef.current.length > 0) {
        const nextItem = autoVoiceQueueRef.current.shift();
        if (!nextItem) continue;
        autoVoiceQueuedLineIdsRef.current.delete(nextItem.line.id);
        voiceCurrentlyPlayingRef.current = true;
        updateVoiceBacklog();
        await playLineVoice(nextItem.line, { silent: nextItem.silent, waitForEnd: true, interrupt: false });
        voiceCurrentlyPlayingRef.current = false;
        updateVoiceBacklog();
        await new Promise(resolve => window.setTimeout(resolve, 180));
      }
    } finally {
      autoVoiceProcessingRef.current = false;
      voiceCurrentlyPlayingRef.current = false;
      setVoicePlaybackBusy(false);
      updateVoiceBacklog();
    }
  };

  const enqueueVoiceLine = (line: TheaterState['scriptTimeline'][number], options: { silent: boolean }) => {
    if (!line.content.trim() || line.type === LogType.USER) return;
    if (autoVoiceQueuedLineIdsRef.current.has(line.id)) return;
    autoVoiceQueuedLineIdsRef.current.add(line.id);
    autoVoiceQueueRef.current.push({ line, silent: options.silent });
    void prefetchLineVoice(line)?.catch(() => undefined);
    updateVoiceBacklog();
    void processAutoVoiceQueue();
  };

  useEffect(() => {
    if (autoVoice) return;
    autoVoiceQueueRef.current = [];
    autoVoiceQueuedLineIdsRef.current.clear();
    voiceCurrentlyPlayingRef.current = false;
    voiceCacheRef.current.clear();
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setVoicePlaybackBusy(false);
    updateVoiceBacklog();
  }, [autoVoice, setVoicePlaybackBusy]);

  useEffect(() => {
    if (autoVoiceRoomIdRef.current !== state.roomInfo.id) {
      autoVoiceRoomIdRef.current = state.roomInfo.id;
      autoVoiceSeenLineIdsRef.current = new Set(state.scriptTimeline.map(line => line.id));
      autoVoiceQueuedLineIdsRef.current.clear();
      autoVoiceQueueRef.current = [];
      voiceCurrentlyPlayingRef.current = false;
      voiceCacheRef.current.clear();
      updateVoiceBacklog();
      return;
    }

    const latest = state.scriptTimeline[state.scriptTimeline.length - 1];
    if (!autoVoice || !latest || latest.type === LogType.USER || !latest.content.trim()) return;
    if (autoVoiceSeenLineIdsRef.current.has(latest.id)) return;

    autoVoiceSeenLineIdsRef.current.add(latest.id);
    const timer = window.setTimeout(() => {
      enqueueVoiceLine(latest, { silent: true });
    }, 320);
    return () => window.clearTimeout(timer);
  }, [state.roomInfo.id, state.scriptTimeline, autoVoice]);

  return (
    <div className="flex h-full w-full relative">
      {isMobile && sidebarOpen && (
        <button
          aria-label="关闭资产栏"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        />
      )}

      {/* 侧边栏：分类资产管理 */}
      <motion.aside
        initial={false}
        animate={{
          width: sidebarExpanded ? (isMobile ? 320 : 320) : 0,
          x: sidebarExpanded ? 0 : -320,
          opacity: sidebarExpanded ? 1 : 0,
          zIndex: 50
        }}
        className={cn(
          "flex flex-col border-r border-amber-500/10 bg-zinc-950/95 shadow-xl overflow-hidden backdrop-blur-2xl",
          isMobile ? "fixed inset-y-0 left-0 max-w-[calc(100vw-1.5rem)]" : "relative shrink-0"
        )}
      >
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-8">
            <button onClick={onBack} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 flex items-center gap-2" aria-label="返回大厅">
              <ArrowLeft size={18} />
              <span className="text-xs font-bold uppercase tracking-widest">返回大厅</span>
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="关闭资产栏"
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
                        persistRoomState({
                          ...state,
                          stage: {
                            ...state.stage,
                            activeCharacters: [...state.stage.activeCharacters, newPlayer]
                          }
                        });
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
                libraryCharacters.map(char => (
                  <div
                    key={char.id}
                    onClick={() => {
                        const nextState = state.stage.activeCharacters.some(c => c.id === char.id)
                          ? state
                          : {
                              ...state,
                              stage: {
                                ...state.stage,
                                activeCharacters: [...state.stage.activeCharacters, char]
                              }
                            };
                        if (nextState !== state) {
                          setState(nextState);
                          persistRoomState(nextState);
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
                libraryStories.map(story => (
                  <div
                    key={story.id}
                    onClick={() => {
                      const nextState = { ...state, stage: { ...state.stage, currentStory: story } };
                      setState(nextState);
                      persistRoomState(nextState);
                    }}
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
            <button onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="切换资产栏" className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500">
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
                disabled={!!exportingFormat}
                aria-label="导出 PNG 长图"
                className="px-3 lg:px-4 py-1.5 hover:bg-zinc-700 rounded-full text-[10px] lg:text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-40"
                title="导出长图"
               >
                  {exportingFormat === 'png' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} PNG
               </button>
               <div className="w-[1px] h-4 bg-white/10 mx-1" />
               <button
                onClick={() => handleExport('md')}
                disabled={!!exportingFormat}
                aria-label="导出 Markdown 剧本"
                className="px-3 lg:px-4 py-1.5 hover:bg-zinc-700 rounded-full text-[10px] lg:text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-40"
                title="导出剧本"
               >
                  {exportingFormat === 'md' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} MD
               </button>
               <div className="w-[1px] h-4 bg-white/10 mx-1" />
               <button
                onClick={() => handleExport('audio')}
                disabled={!!exportingFormat}
                aria-label="导出完整音频"
                className="px-3 lg:px-4 py-1.5 hover:bg-zinc-700 rounded-full text-[10px] lg:text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-40"
                title="导出完整音频"
               >
                  {exportingFormat === 'audio' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} WAV
               </button>
             </div>
          </div>
        </header>

        <div ref={theaterRef} className="flex-1 relative overflow-hidden flex flex-col">
          <div className="absolute inset-0 z-0">
             <img src={state.stage.currentStory.coverImage} className="w-full h-full object-cover filter blur-[2px] brightness-[0.25]" alt="" />
          </div>

          <div
            ref={scrollRef}
            data-testid="theater-scroll"
            className="flex-1 relative z-10 overflow-y-auto custom-scrollbar px-6 md:px-24 pt-10 md:pt-12 pb-[22rem] sm:pb-[16rem] lg:pb-[14rem]"
          >
            <div className="max-w-3xl mx-auto">
              <AnimatePresence>
                {selectedLines.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="sticky top-0 z-20 mb-6 flex items-center justify-between gap-3 rounded-2xl border border-amber-500/20 bg-zinc-950/80 px-4 py-3 backdrop-blur-2xl shadow-2xl"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-black text-zinc-100">已选 {selectedLines.length} 句台词</p>
                      <p className="text-[10px] text-zinc-500 truncate">场景图会挂载到最后一句选中台词下方</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setSelectedLineIds(new Set())}
                        className="px-3 py-2 rounded-xl text-[10px] font-bold text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        清空
                      </button>
                      <button
                        onClick={handleGenerateSelectionImage}
                        disabled={isGeneratingSelectionImage}
                        title={`生成场景图将消耗 ${IMAGE_GENERATE_COST_POINTS} POINTS`}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 text-[10px] font-black hover:scale-105 active:scale-95 transition-all disabled:opacity-60 disabled:hover:scale-100"
                      >
                        {isGeneratingSelectionImage ? <Loader2 size={14} className="animate-spin" /> : <Images size={14} />}
                        生成场景图 · {IMAGE_GENERATE_COST_POINTS}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {state.scriptTimeline.map((line, idx) => (
                <TypewriterText
                  key={line.id}
                  line={line}
                  isNew={idx === state.scriptTimeline.length - 1 && (line.type !== LogType.USER)}
                  onGenerateImage={handleGenerateImage}
                  onPlayVoice={handlePlayVoice}
                  isGeneratingImage={generatingImages.has(line.id)}
                  isGeneratingVoice={generatingVoices.has(line.id)}
                  isSelected={selectedLineIds.has(line.id)}
                  onToggleSelect={toggleLineSelection}
                  typingDelayMs={autoVoice ? 62 : 40}
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

        <div data-testid="theater-composer" className="absolute bottom-4 lg:bottom-8 left-1/2 -translate-x-1/2 w-full max-w-4xl px-3 sm:px-5 lg:px-8 z-40">
          <div className="relative flex flex-col gap-3 pb-[env(safe-area-inset-bottom)]">
            <AnimatePresence>
              {notice && (
                <motion.div
                  data-testid="theater-notice"
                  role="status"
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  className={cn(
                    "flex flex-col gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-2xl ring-1 sm:flex-row sm:items-center sm:justify-between",
                    notice.tone === 'warning'
                      ? "border-amber-400/65 bg-zinc-950/95 text-zinc-100 shadow-black/60 ring-amber-400/25"
                      : "border-red-400/55 bg-zinc-950/95 text-zinc-100 shadow-black/60 ring-red-400/25"
                  )}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                      notice.tone === 'warning' ? "bg-amber-500 text-zinc-950" : "bg-red-500/90 text-white"
                    )}>
                      <Sparkles size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className={cn("text-sm font-black", notice.tone === 'warning' ? "text-amber-100" : "text-red-100")}>{notice.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-zinc-100">{notice.message}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {notice.action === 'profile' && (
                      <button
                        type="button"
                        onClick={() => {
                          setNotice(null);
                          setState(prev => ({ ...prev, view: 'profile' }));
                        }}
                        className="h-9 rounded-full bg-amber-400 px-4 text-xs font-black text-zinc-950 shadow-lg shadow-amber-950/30 transition-colors hover:bg-amber-300"
                      >
                        去充值
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label="关闭提示"
                      onClick={() => setNotice(null)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-zinc-950/60 text-zinc-400 transition-colors hover:text-white"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showMentions && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-full left-0 mb-4 w-[min(22rem,calc(100vw-2rem))] bg-zinc-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-2 ring-1 ring-black/50"
                >
                  <p className="px-3 py-2 text-xs font-mono text-zinc-400 uppercase tracking-widest">登场人物列表</p>
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
                        className="w-full flex items-center gap-3 p-3 hover:bg-amber-500/10 rounded-xl transition-all group"
                      >
                        <img src={char.avatar} alt={char.name} className="w-10 h-10 rounded-lg object-cover ring-1 ring-white/5" />
                        <div className="text-left">
                          <p className="text-sm font-bold group-hover:text-amber-500">{char.name}</p>
                          <p className="text-xs text-zinc-500 truncate w-52">{char.description}</p>
                        </div>
                      </button>
                    ))}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="bg-zinc-900/75 backdrop-blur-3xl border border-white/15 rounded-3xl p-2.5 sm:p-3 shadow-2xl shadow-black/40 ring-1 ring-black/40 transition-all focus-within:ring-2 focus-within:ring-amber-500/30">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 lg:gap-4">
                <button
                  type="button"
                  onClick={() => setState(prev => ({ ...prev, engine: { ...prev.engine, autoPilot: !prev.engine.autoPilot } }))}
                  aria-label={state.engine.autoPilot ? '暂停自动推演' : '继续自动推演'}
                  className={cn(
                    "relative h-12 sm:h-14 min-w-12 sm:min-w-[8.75rem] rounded-2xl flex items-center justify-center gap-2 px-4 transition-all overflow-hidden group shrink-0 text-sm font-black",
                    state.engine.autoPilot ? "bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20" : "bg-white/10 text-zinc-200 hover:bg-white/15"
                  )}
                >
                  {state.engine.autoPilot ? <Pause size={20} /> : <Play size={20} fill="currentColor" />}
                  <span className="hidden sm:inline">{state.engine.autoPilot ? '暂停推演' : '自动推演'}</span>
                  {state.engine.autoPilot && (
                    <div className="absolute inset-0 bg-white/20 animate-pulse pointer-events-none" />
                  )}
                </button>

                <select
                  aria-label="说话对象"
                  value={speechTargetValue}
                  onChange={(event) => handleSpeechTargetChange(event.target.value)}
                  className="h-12 sm:h-14 min-w-[7.5rem] sm:min-w-[8.25rem] shrink-0 rounded-2xl border border-white/10 bg-zinc-950/80 px-3 text-sm font-black text-zinc-100 outline-none transition-colors hover:border-amber-500/30 focus:border-amber-500/60"
                >
                  <option value="everyone">对大家</option>
                  <option value="air">对空气</option>
                  <option value="self">自言自语</option>
                  {state.stage.activeCharacters.map(char => (
                    <option key={char.id} value={`character:${char.id}`}>对 {char.name}</option>
                  ))}
                </select>

                <div className="flex-1 relative min-w-0">
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
                    isMobile
                    ? "输入并召唤 @角色"
                    : (state.gameSettings.playerCharacterId
                      ? `正在以“${state.stage.activeCharacters.find(c => c.id === state.gameSettings.playerCharacterId)?.name}”身份对话...`
                      : "作为“上帝”干预剧情：输入动作或召唤 @角色")
                  }
                  className="h-12 sm:h-14 w-full bg-transparent border-none focus:ring-0 text-zinc-100 placeholder:text-zinc-500 text-base lg:text-lg font-semibold"
                 />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowMentions(!showMentions)}
                    aria-label="召唤角色"
                    title="召唤角色"
                    className={cn("h-12 w-12 sm:h-14 sm:w-14 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center transition-colors", showMentions ? "text-amber-400 border-amber-500/40 bg-amber-500/10" : "text-zinc-300 hover:text-white hover:bg-white/10")}
                  >
                    <AtSign size={21} />
                  </button>
                  <button
                    type="button"
                    onClick={handleSend}
                    aria-label="发送导演指令"
                    disabled={!input.trim() || state.engine.isGenerating}
                    className="h-12 sm:h-14 min-w-12 sm:min-w-[6.5rem] px-4 bg-amber-500 text-zinc-950 rounded-2xl hover:scale-[1.03] active:scale-95 disabled:grayscale disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-sm font-black shadow-lg shadow-amber-500/20"
                  >
                    {state.engine.isGenerating ? (
                      <div className="w-5 h-5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send size={20} />
                    )}
                    {!state.engine.isGenerating && <span className="hidden sm:inline">发送</span>}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-1 sm:px-3">
               <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-zinc-950/70 px-3 py-2 text-xs font-bold text-zinc-300 shadow-lg shadow-black/20">
                 <span className={cn(
                   "w-2 h-2 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.35)]",
                   state.engine.isGenerating ? "bg-amber-400 animate-pulse" : state.engine.autoPilot ? "bg-green-500/80" : "bg-zinc-600"
                 )} />
                 引擎状态：{engineStatus}
               </p>
               <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
                 <button
                   type="button"
                   onClick={() => setAutoVoice(prev => !prev)}
                   aria-pressed={autoVoice}
                   className={cn(
                     "flex h-10 items-center justify-center gap-2 rounded-full border px-3 text-xs font-black transition-colors",
                     autoVoice ? "border-amber-500/35 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15" : "border-white/10 bg-zinc-950/70 text-zinc-300 hover:bg-white/10"
                   )}
                 >
                   <Volume2 size={14} />
                   {autoVoice ? '自动语音' : '语音关闭'}
                 </button>
                 <button
                   type="button"
                   onClick={() => setState(prev => ({ ...prev, engine: { ...prev.engine, autoPilot: !prev.engine.autoPilot } }))}
                   disabled={state.engine.isGenerating}
                   className="flex h-10 items-center justify-center rounded-full border border-white/10 bg-zinc-950/70 px-3 text-xs font-black text-zinc-200 transition-colors hover:border-amber-500/35 hover:text-amber-300 disabled:opacity-40"
                 >
                   {state.engine.autoPilot ? '暂停自动' : '继续自动'}
                 </button>
                 <button
                   type="button"
                   onClick={() => generateNext()}
                   disabled={state.engine.isGenerating || voiceBacklogCount >= 2}
                   className="flex h-10 items-center justify-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 text-xs font-black text-amber-300 transition-colors hover:bg-amber-500/15 disabled:opacity-40"
                 >
                   <SkipForward size={14} />
                   手动推演
                 </button>
               </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
