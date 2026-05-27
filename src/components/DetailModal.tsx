import React, { useState } from 'react';
import { X, Save, Share2, Eye, Edit3, Sparkles, Upload, FileText, Image as ImageIcon, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Character, StorySetting } from '../types';

interface DetailModalProps {
  type: 'character' | 'story';
  data: Character | StorySetting;
  mode: 'view' | 'edit';
  onClose: () => void;
  onSave?: (updatedData: any) => void;
  readOnly?: boolean;
}

export const DetailModal: React.FC<DetailModalProps> = ({ type, data, mode: initialMode, onClose, onSave, readOnly }) => {
  const [mode, setMode] = useState<'view' | 'edit'>(initialMode);
  const [formData, setFormData] = useState(data);
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const isCharacter = type === 'character';
  const char = formData as Character;
  const story = formData as StorySetting;

  const handleSave = () => {
    onSave?.(formData);
    setMode('view');
  };

  const handleFileParse = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    // Simulate AI parsing
    setTimeout(() => {
      setFormData(prev => ({
        ...prev,
        description: `从文件《${file.name}》中解析出的核心背景。`,
        ...(isCharacter ? {
          personality: '解析出的人格特征：忠诚、内敛、带有某种不可告人的秘密。',
          memory: '提取出的关键记忆点：儿时的避难所、第一次拿起武器的时刻。'
        } : {})
      }));
      setIsParsing(false);
    }, 2000);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    // Simulate upload
    const reader = new FileReader();
    reader.onload = (event) => {
      setTimeout(() => {
        setFormData(prev => (isCharacter ? { ...prev, avatar: event.target?.result as string } : { ...prev, coverImage: event.target?.result as string }));
        setIsUploading(false);
      }, 1000);
    };
    reader.readAsDataURL(file);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-4xl bg-zinc-900 border border-white/10 rounded-[2rem] lg:rounded-[2.5rem] overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col lg:flex-row h-[90vh] lg:h-[80vh]">
          {/* 左侧预览图 */}
          <div className="w-full lg:w-2/5 relative h-48 lg:h-full bg-zinc-800 shrink-0">
            <img 
              src={isCharacter ? char.avatar : story.coverImage} 
              className={`w-full h-full object-cover transition-all ${isUploading ? 'opacity-50 blur-sm' : 'opacity-100'}`} 
              alt="" 
            />
            
            {mode === 'edit' && (
              <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity cursor-pointer group">
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-full bg-amber-500 flex items-center justify-center text-zinc-950 scale-90 group-hover:scale-100 transition-transform">
                  {isUploading ? <Loader2 className="animate-spin" /> : (
                    <>
                      <ImageIcon size={20} className="lg:hidden" />
                      <ImageIcon size={24} className="hidden lg:block" />
                    </>
                  )}
                </div>
                <span className="mt-2 lg:mt-4 text-[10px] lg:text-xs font-bold text-white uppercase tracking-widest bg-zinc-950/50 px-2 lg:px-3 py-1 rounded-full backdrop-blur-md">更改封面图</span>
              </label>
            )}

            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
            <div className="absolute bottom-4 lg:bottom-8 left-6 lg:left-8 right-6 lg:right-8">
               <h2 className="text-2xl lg:text-4xl font-black italic tracking-tighter mb-1 lg:mb-2 line-clamp-1">
                 {isCharacter ? char.name : story.title}
               </h2>
               <div className="flex gap-2">
                  {(isCharacter ? [] : story.tags || []).map(tag => (
                    <span key={tag} className="px-1.5 lg:px-2 py-0.5 lg:py-1 bg-white/10 backdrop-blur-md rounded text-[9px] lg:text-[10px] font-bold uppercase tracking-wider">{tag}</span>
                  ))}
               </div>
            </div>
          </div>

          {/* 右侧详情 */}
          <div className="flex-1 flex flex-col p-6 lg:p-12 overflow-y-auto custom-scrollbar">
            <header className="flex items-center justify-between mb-8 lg:mb-12">
              <div className="flex gap-2 lg:gap-4">
                {!readOnly && (
                  <>
                    <button 
                      onClick={() => setMode('view')}
                      className={`flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg lg:rounded-xl text-[10px] lg:text-xs font-bold transition-all ${mode === 'view' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      <Eye size={14} className="lg:hidden" /><Eye size={16} className="hidden lg:block" /> 预览模式
                    </button>
                    <button 
                      onClick={() => setMode('edit')}
                      className={`flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg lg:rounded-xl text-[10px] lg:text-xs font-bold transition-all ${mode === 'edit' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      <Edit3 size={14} className="lg:hidden" /><Edit3 size={16} className="hidden lg:block" /> 编辑属性
                    </button>
                  </>
                )}
                {readOnly && (
                  <div className="flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-1.5 lg:py-2 bg-zinc-800 text-zinc-100 rounded-lg lg:rounded-xl text-[10px] lg:text-xs font-bold">
                    <Eye size={14} className="lg:hidden" /><Eye size={16} className="hidden lg:block" /> 剧本库详情
                  </div>
                )}
              </div>
              <button onClick={onClose} className="p-1.5 lg:p-2 hover:bg-zinc-800 rounded-full transition-colors">
                <X size={20} className="lg:hidden" /><X size={24} className="hidden lg:block" />
              </button>
            </header>

            <div className="flex-1 space-y-6 lg:space-y-8">
              {mode === 'view' ? (
                <div className="space-y-8 lg:space-y-10">
                  <section>
                    <label className="text-[9px] lg:text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2 lg:mb-3 block">核心描述</label>
                    <p className="text-base lg:text-lg font-serif leading-relaxed text-zinc-300">
                      {isCharacter ? char.description : story.description}
                    </p>
                  </section>

                  {isCharacter && (
                    <>
                      <section>
                        <label className="text-[9px] lg:text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2 lg:mb-3 block">性格人设</label>
                        <p className="p-4 lg:p-6 bg-zinc-800/50 rounded-xl lg:rounded-2xl border border-white/5 text-xs lg:text-sm leading-relaxed italic">
                          {char.personality || '暂无详细设定'}
                        </p>
                      </section>
                      <section>
                         <label className="text-[9px] lg:text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2 lg:mb-3 block">关联记忆数据</label>
                         <p className="text-xs lg:text-sm text-zinc-500 leading-relaxed">
                           {char.memory || '未开启初始记忆数据'}
                         </p>
                      </section>
                    </>
                  )}

                  {!isCharacter && story.content && (
                    <section>
                      <label className="text-[9px] lg:text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2 lg:mb-3 block">故事详述</label>
                      <p className="text-xs lg:text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap">{story.content}</p>
                    </section>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {isCharacter && (
                    <div className="p-4 lg:p-6 bg-amber-500/5 border border-amber-500/20 rounded-[1.5rem] lg:rounded-[2rem] relative overflow-hidden group">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                        <div>
                          <h4 className="text-xs lg:text-sm font-bold text-amber-500 flex items-center gap-2">
                            <Sparkles size={14} className="lg:hidden" /><Sparkles size={16} className="hidden lg:block" /> AI 智能解析
                          </h4>
                          <p className="text-[9px] lg:text-[10px] text-zinc-500 mt-1 uppercase tracking-widest">支持上传 PDF/TXT/DOC 格式的人物小传</p>
                        </div>
                        {isParsing ? (
                          <div className="flex items-center gap-2 text-[10px] lg:text-xs text-amber-500 font-bold">
                            <Loader2 size={14} className="animate-spin" /> 推演中...
                          </div>
                        ) : (
                          <label className="w-fit px-3 lg:px-4 py-1.5 lg:py-2 bg-amber-500 text-zinc-950 rounded-full text-[10px] lg:text-xs font-bold cursor-pointer hover:scale-105 transition-all shadow-lg shadow-amber-500/20">
                            上传并解析
                            <input type="file" className="hidden" onChange={handleFileParse} accept=".txt,.pdf,.doc,.docx" />
                          </label>
                        )}
                      </div>
                      <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ x: '-100%' }}
                          animate={isParsing ? { x: '100%' } : { x: '-100%' }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                          className="h-full w-1/3 bg-amber-500"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5 lg:space-y-2">
                    <label className="text-[10px] lg:text-xs font-bold text-zinc-400">名称 / 标题</label>
                    <input 
                      type="text" 
                      value={isCharacter ? char.name : story.title}
                      onChange={(e) => setFormData(isCharacter ? {...char, name: e.target.value} : {...story, title: e.target.value})}
                      className="w-full bg-zinc-800 border border-white/5 rounded-lg lg:rounded-xl px-4 py-2 lg:py-3 focus:ring-2 ring-amber-500/20 outline-none text-xs lg:text-sm"
                    />
                  </div>

                  <div className="space-y-1.5 lg:space-y-2">
                    <label className="text-[10px] lg:text-xs font-bold text-zinc-400">简单介绍</label>
                    <textarea 
                      rows={2}
                      value={isCharacter ? char.description : story.description}
                      onChange={(e) => setFormData(isCharacter ? {...char, description: e.target.value} : {...story, description: e.target.value})}
                      className="w-full bg-zinc-800 border border-white/5 rounded-lg lg:rounded-xl px-4 py-2 lg:py-3 focus:ring-2 ring-amber-500/20 outline-none resize-none text-[11px] lg:text-sm"
                    />
                  </div>

                  {isCharacter && (
                    <>
                      <div className="space-y-1.5 lg:space-y-2">
                        <label className="text-[10px] lg:text-xs font-bold text-zinc-400 italic flex items-center gap-2">
                          性格 Prompt <Sparkles size={12} className="text-amber-500" />
                        </label>
                        <textarea 
                          rows={3}
                          placeholder="描述人物的语气、行为逻辑和核心人设..."
                          value={char.personality || ''}
                          onChange={(e) => setFormData({...char, personality: e.target.value})}
                          className="w-full bg-zinc-800 border border-white/5 rounded-lg lg:rounded-xl px-4 py-2 lg:py-3 focus:ring-2 ring-amber-500/20 outline-none resize-none text-[11px] lg:text-sm"
                        />
                      </div>

                      <div className="space-y-1.5 lg:space-y-2">
                        <label className="text-[10px] lg:text-xs font-bold text-zinc-400">音色选择</label>
                        <div className="grid grid-cols-3 gap-1.5 lg:gap-2">
                          {['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'].map((v) => (
                            <button
                              key={v}
                              onClick={() => setFormData({ ...char, voiceName: v as any })}
                              className={`px-2 lg:px-4 py-1.5 lg:py-2 rounded-lg lg:rounded-xl text-[10px] lg:text-xs font-bold border transition-all ${
                                char.voiceName === v 
                                  ? 'bg-amber-500 border-amber-500 text-zinc-950' 
                                  : 'bg-zinc-800 border-white/5 text-zinc-400 hover:border-white/20'
                              }`}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {!isCharacter && (
                    <div className="space-y-1.5 lg:space-y-2">
                      <label className="text-[10px] lg:text-xs font-bold text-zinc-400">故事背景详情 (剧本设定)</label>
                      <textarea 
                        rows={4}
                        placeholder="详细描述在这个背景下，时间、地点和主要冲突..."
                        value={story.content || ''}
                        onChange={(e) => setFormData({...story, content: e.target.value})}
                        className="w-full bg-zinc-800 border border-white/5 rounded-lg lg:rounded-xl px-4 py-2 lg:py-3 focus:ring-2 ring-amber-500/20 outline-none resize-none text-[11px] lg:text-sm"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <footer className="mt-8 lg:mt-12 pt-6 lg:pt-8 border-t border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
               {mode === 'edit' ? (
                 <>
                   <p className="text-[9px] lg:text-[10px] text-zinc-500 max-w-xs leading-relaxed">
                     更改将即时同步至云端剧本库，上架市场后版本将冻结
                   </p>
                   <div className="flex w-full sm:w-auto gap-2 lg:gap-3">
                     <button onClick={() => setMode('view')} className="flex-1 sm:flex-none px-4 lg:px-6 py-2 rounded-lg lg:rounded-xl text-[10px] lg:text-xs font-bold text-zinc-400 hover:bg-zinc-800 transition-colors">取消</button>
                     <button onClick={handleSave} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 lg:gap-2 px-6 lg:px-8 py-2 bg-amber-500 text-zinc-950 rounded-lg lg:rounded-xl text-[10px] lg:text-xs font-bold shadow-lg shadow-amber-500/20 active:scale-95 transition-all">
                       <Save size={14} className="lg:hidden" /><Save size={16} className="hidden lg:block" /> 保存修改
                     </button>
                   </div>
                 </>
               ) : (
                 <>
                   <div className="flex items-center gap-3 lg:gap-4 text-zinc-500 text-[10px] lg:text-xs">
                     <span className="flex items-center gap-1"><Share2 size={12} className="lg:hidden" /><Share2 size={14} className="hidden lg:block" /> 2.4k 转发</span>
                     <span className="flex items-center gap-1 font-mono uppercase tracking-tight">V2.1.0</span>
                   </div>
                   <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 lg:px-8 py-2.5 lg:py-3 bg-zinc-100 text-zinc-950 rounded-xl lg:rounded-2xl text-[10px] lg:text-xs font-black shadow-xl active:scale-95 transition-all">
                      以此为底本开启剧场
                   </button>
                 </>
               )}
            </footer>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
