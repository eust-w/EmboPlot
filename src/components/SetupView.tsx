import React, { useState } from 'react';
import { ChevronLeft, Play, Sparkles, User, Users, Globe, BookOpen, Clock, Zap, MessageSquare, Check } from 'lucide-react';
import { MOCK_STORY_SETTINGS, MOCK_CHARACTERS } from '@/src/mockData';
import { Character, StorySetting, GameSettings } from '@/src/types';
import { motion, AnimatePresence } from 'motion/react';
import { DetailModal } from './DetailModal';

interface SetupViewProps {
  onStart: (settings: { story: StorySetting, characters: Character[], gameSettings: GameSettings, theaterName: string }) => void;
  onBack: () => void;
}

export const SetupView: React.FC<SetupViewProps> = ({ onStart, onBack }) => {
  const [theaterName, setTheaterName] = useState('未命名推演剧目');
  const [selectedStory, setSelectedStory] = useState<StorySetting>(MOCK_STORY_SETTINGS[0]);
  const [selectedChars, setSelectedChars] = useState<Character[]>([MOCK_CHARACTERS[0]]);
  const [gameSettings, setGameSettings] = useState<GameSettings>({
    mood: 'Dramatic',
    pace: 'Balanced',
    complexity: 'Standard',
    initialPlot: '',
    language: 'Chinese (Simplified)'
  });
  
  const [detailAsset, setDetailAsset] = useState<{ type: 'character' | 'story', data: any } | null>(null);

  const toggleChar = (char: Character) => {
    if (selectedChars.some(c => c.id === char.id)) {
      if (selectedChars.length > 1) {
        setSelectedChars(selectedChars.filter(c => c.id !== char.id));
      }
    } else {
      setSelectedChars([...selectedChars, char]);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full bg-zinc-950 overflow-hidden">
      <AnimatePresence>
        {detailAsset && (
          <DetailModal 
            type={detailAsset.type}
            data={detailAsset.data}
            mode="view"
            onClose={() => setDetailAsset(null)}
          />
        )}
      </AnimatePresence>

      {/* Scrollable Config Panel */}
      <div className="w-full lg:w-[450px] xl:w-[500px] h-full overflow-y-auto custom-scrollbar border-r border-white/5 p-6 lg:p-12">
        <button onClick={onBack} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-100 mb-8 transition-colors">
          <ChevronLeft size={20} />
          <span className="text-sm font-bold uppercase tracking-widest">返回大厅</span>
        </button>
        
        <h2 className="text-2xl font-bold mb-8 lg:mb-12 italic">开启新剧场</h2>
        
        <div className="space-y-12">
          <section>
            <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-500 px-2 mb-4 flex items-center gap-2">
              <Sparkles size={14} className="text-amber-500" /> 0. 为这场推演起名
            </h3>
            <input 
              type="text" 
              value={theaterName}
              onChange={(e) => setTheaterName(e.target.value)}
              placeholder="例如：夕阳下的最后一次抉择..."
              className="w-full bg-zinc-800/50 border border-white/5 rounded-2xl px-5 py-4 text-sm text-zinc-100 focus:ring-1 ring-amber-500 outline-none placeholder:text-zinc-500 transition-all font-sans"
            />
          </section>

          <section>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-500 px-2 flex items-center gap-2">
                <BookOpen size={14} className="text-amber-500" /> 1. 选择故事背景
              </h3>
              <p className="text-[10px] text-zinc-600 font-bold uppercase">双击查看详情</p>
            </div>
            <div className="grid gap-3">
              {MOCK_STORY_SETTINGS.map(story => (
                <motion.div 
                  key={story.id}
                  whileHover={{ x: 4 }}
                  onClick={() => setSelectedStory(story)}
                  onDoubleClick={() => setDetailAsset({ type: 'story', data: story })}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-4 ${
                    selectedStory.id === story.id ? 'bg-amber-500/10 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.1)] ring-1 ring-amber-500/20' : 'bg-zinc-800/50 border-white/5 hover:border-zinc-700'
                  }`}
                >
                  <img src={story.coverImage} className="w-12 h-12 rounded-lg object-cover shrink-0" alt="" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${selectedStory.id === story.id ? 'text-amber-500' : 'text-zinc-100'}`}>{story.title}</p>
                    <p className="text-[10px] text-zinc-500 truncate leading-relaxed">{story.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-500 px-2 flex items-center gap-2">
                <Users size={14} className="text-amber-500" /> 2. 选择入场人物
              </h3>
              <p className="text-[10px] text-zinc-600 font-bold uppercase">双击查看详情</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3">
              {MOCK_CHARACTERS.map(char => {
                const isSelected = selectedChars.some(c => c.id === char.id);
                return (
                  <motion.div 
                    key={char.id}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => toggleChar(char)}
                    onDoubleClick={() => setDetailAsset({ type: 'character', data: char })}
                    className={`group p-3 rounded-2xl border transition-all cursor-pointer flex flex-col items-center text-center gap-3 relative ${
                      isSelected ? 'bg-amber-500/10 border-amber-500' : 'bg-zinc-800/50 border-white/5 hover:border-zinc-700'
                    }`}
                  >
                    <div className="relative">
                      <img src={char.avatar} className="w-12 h-12 rounded-full object-cover border-2 border-transparent group-hover:scale-110 transition-transform" alt="" />
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 bg-amber-500 rounded-full p-0.5">
                          <Check size={10} className="text-zinc-950" />
                        </div>
                      )}
                    </div>
                    <p className={`text-xs font-bold truncate w-full ${isSelected ? 'text-amber-500' : 'text-zinc-100'}`}>{char.name}</p>
                  </motion.div>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-500 px-2 mb-6 flex items-center gap-2">
              <Sparkles size={14} className="text-amber-500" /> 3. 推演规则设定
            </h3>
            
            <div className="space-y-8">
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter block mb-3 px-2">叙事偏好 (STYLE)</label>
                <div className="grid grid-cols-2 gap-3">
                  {['戏剧冲突', '悬疑惊悚', '浪漫治愈', '暴力美学'].map(m => (
                    <button 
                      key={m}
                      onClick={() => setGameSettings({ ...gameSettings, mood: m as any })}
                      className={`px-4 py-3 rounded-xl text-[11px] border transition-all font-bold ${
                        gameSettings.mood === m ? 'bg-amber-500 border-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20' : 'bg-zinc-800 border-white/5 text-zinc-400 hover:border-white/10'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter block mb-3 px-2">您的角色身份 (ROLE)</label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setGameSettings({ ...gameSettings, playerCharacterId: undefined })}
                    className={`px-4 py-4 rounded-xl text-[11px] border transition-all flex items-center justify-center gap-2 font-bold ${
                      !gameSettings.playerCharacterId ? 'bg-amber-500 border-amber-500 text-zinc-950' : 'bg-zinc-800 border-white/5 text-zinc-400 hover:border-white/10'
                    }`}
                  >
                    <Zap size={14} /> 上帝视角
                  </button>
                  {selectedChars.length > 0 && (
                    <button 
                      onClick={() => setGameSettings({ ...gameSettings, playerCharacterId: selectedChars[0].id })}
                      className={`px-4 py-4 rounded-xl text-[11px] border transition-all truncate font-bold ${
                        gameSettings.playerCharacterId === selectedChars[0].id ? 'bg-amber-500 border-amber-500 text-zinc-950' : 'bg-zinc-800 border-white/5 text-zinc-400 hover:border-white/10'
                      }`}
                    >
                      扮演 {selectedChars[0].name}
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter block mb-3 px-2">推进速度 (PACE)</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: 'Fast', label: '极速' },
                    { key: 'Balanced', label: '均衡' },
                    { key: 'Slow', label: '沉浸' }
                  ].map(p => (
                    <button 
                      key={p.key}
                      onClick={() => setGameSettings({ ...gameSettings, pace: p.key as any })}
                      className={`px-3 py-3 rounded-xl text-[11px] border transition-all font-bold ${
                        gameSettings.pace === p.key ? 'bg-amber-500 border-amber-500 text-zinc-950' : 'bg-zinc-800 border-white/5 text-zinc-400 hover:border-white/10'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter block mb-3 px-2">起始剧情 (PLOT)</label>
                <textarea 
                  value={gameSettings.initialPlot}
                  onChange={(e) => setGameSettings({ ...gameSettings, initialPlot: e.target.value })}
                  placeholder="可选：输入一段故事的开端..."
                  className="w-full h-32 bg-zinc-800/50 border border-white/5 rounded-2xl p-4 text-[11px] text-zinc-300 focus:ring-1 ring-amber-500 outline-none resize-none placeholder:text-zinc-600 transition-all font-sans"
                />
              </div>
            </div>
          </section>

          <button 
            onClick={() => onStart({ story: selectedStory, characters: selectedChars, gameSettings, theaterName })}
            className="w-full py-6 bg-white text-zinc-950 rounded-[2.5rem] font-black text-xl hover:scale-[1.02] active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-4 group"
          >
            开启推演之旅
            <Play fill="currentColor" size={24} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {/* Preview Section - Responsive layout */}
      <div className="flex-1 min-h-[400px] lg:h-full relative overflow-hidden bg-zinc-900/10 order-first lg:order-last">
        <div className="absolute inset-0 z-0">
          <AnimatePresence mode="wait">
            <motion.div 
              key={selectedStory.coverImage}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.15 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5 }}
              className="absolute inset-0"
              style={{ 
                backgroundImage: `url(${selectedStory.coverImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'blur(100px)'
              }}
            />
          </AnimatePresence>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-zinc-950/50 to-zinc-950" />
        </div>

        <div className="relative z-10 h-full flex flex-col items-center justify-center p-4 lg:p-12 xl:p-24 overflow-y-auto custom-scrollbar">
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl bg-zinc-900/60 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] lg:rounded-[4rem] p-6 lg:p-16 shadow-2xl my-8"
          >
            <div className="text-center mb-8 lg:mb-12">
              <h2 className="text-2xl lg:text-4xl font-black italic tracking-tight mb-4">准备就绪</h2>
              <p className="text-zinc-400 font-serif italic text-sm lg:text-lg leading-relaxed">
                在这场名为《{theaterName || selectedStory.title}》的推演中，<br />
                {selectedChars.length > 3 ? `${selectedChars.slice(0,3).map(c => c.name).join('、')}等` : selectedChars.map(c => c.name).join('、')} 的命运已经交汇。
              </p>
            </div>

            <div className="flex flex-col md:flex-row gap-4 lg:gap-6 mb-8 lg:mb-12">
              <div className="flex-1 p-6 lg:p-8 bg-white/5 rounded-[2rem] lg:rounded-[3rem] border border-white/5">
                <div className="flex items-center gap-3 mb-4 text-amber-500 font-mono">
                  <Globe size={16} />
                  <span className="text-[9px] lg:text-[10px] font-black tracking-widest uppercase">世界观设定</span>
                </div>
                <p className="text-xs lg:text-sm italic font-serif leading-relaxed text-zinc-300 line-clamp-4 lg:line-clamp-6">{selectedStory.description}</p>
              </div>

              <div className="w-full md:w-48 lg:w-56 p-6 lg:p-8 bg-white/5 rounded-[2rem] lg:rounded-[3rem] border border-white/5 space-y-6 lg:space-y-8">
                 <div>
                    <h5 className="text-[9px] lg:text-[10px] font-black text-blue-500 uppercase tracking-widest mb-3 lg:mb-4 flex items-center gap-2">
                       <Users size={12} /> 推演阵容
                    </h5>
                    <div className="flex flex-wrap gap-1.5 lg:gap-2">
                      {selectedChars.slice(0, 4).map(c => (
                        <span key={c.id} className="px-2 lg:px-3 py-0.5 lg:py-1 bg-zinc-800 rounded-full text-[9px] lg:text-[10px] font-bold border border-white/5">{c.name}</span>
                      ))}
                      {selectedChars.length > 4 && <span className="text-[9px] text-zinc-500 font-bold">...</span>}
                    </div>
                 </div>

                 <div>
                    <h5 className="text-[9px] lg:text-[10px] font-black text-amber-500 uppercase tracking-widest mb-3 lg:mb-4 flex items-center gap-2">
                       <Zap size={12} /> 核心基调
                    </h5>
                    <p className="text-[10px] lg:text-xs font-bold text-zinc-100">{gameSettings.mood} / {
                      gameSettings.pace === 'Fast' ? '极速' : gameSettings.pace === 'Slow' ? '沉浸' : '均衡'
                    }</p>
                 </div>

                 <div>
                    <h5 className="text-[9px] lg:text-[10px] font-black text-purple-500 uppercase tracking-widest mb-3 lg:mb-4 flex items-center gap-2">
                       <User size={12} /> 入场视角
                    </h5>
                    <p className="text-[9px] lg:text-[10px] leading-relaxed text-zinc-400">
                      {gameSettings.playerCharacterId 
                        ? `扮演角色「${selectedChars.find(c => c.id === gameSettings.playerCharacterId)?.name}」` 
                        : '上帝视角控制核心节点'}
                    </p>
                 </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
