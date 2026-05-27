import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Volume2, ImageIcon, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { LogType, type ScriptLine } from '@/src/types';

interface TypewriterProps {
  line: ScriptLine;
  isNew?: boolean;
  onGenerateImage?: (lineId: string) => void;
  onPlayVoice?: (lineId: string) => void;
  isGeneratingImage?: boolean;
  isGeneratingVoice?: boolean;
}

const TypewriterText: React.FC<TypewriterProps> = ({ 
  line, 
  isNew, 
  onGenerateImage, 
  onPlayVoice,
  isGeneratingImage,
  isGeneratingVoice
}) => {
  const [displayedContent, setDisplayedContent] = useState(isNew ? '' : (line.content || ''));
  const fullContent = line.content || '';
  const index = useRef(isNew ? 0 : fullContent.length);

  useEffect(() => {
    if (!isNew) return;
    
    const interval = setInterval(() => {
      if (index.current < fullContent.length) {
        setDisplayedContent(prev => prev + fullContent[index.current]);
        index.current += 1;
      } else {
        clearInterval(interval);
      }
    }, 40); // 40ms per char

    return () => clearInterval(interval);
  }, [fullContent, isNew]);

  if (line.type === LogType.DIRECTOR) {
    return (
      <div className="flex flex-col items-center my-8 px-12 group">
        <p className="font-serif italic text-zinc-500 text-sm tracking-widest leading-relaxed text-center max-w-2xl">
          {displayedContent}
        </p>
        <div className="flex gap-4 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={() => onGenerateImage?.(line.id)}
            disabled={isGeneratingImage}
            className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-zinc-500 hover:text-amber-500 transition-colors"
          >
            {isGeneratingImage ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />}
            生成宏观背景
          </button>
        </div>
        {line.imageUrl && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-6 rounded-3xl overflow-hidden border border-white/10 shadow-2xl max-w-xl w-full"
          >
            <img src={line.imageUrl} alt="Scene" className="w-full h-auto aspect-video object-cover" referrerPolicy="no-referrer" />
          </motion.div>
        )}
      </div>
    );
  }

  if (line.type === LogType.USER) {
    return (
      <div className="flex justify-end my-4 pr-4">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-full px-4 py-1.5 backdrop-blur-sm">
           <span className="text-amber-400 text-xs font-mono mr-2">◇ 注入因果</span>
           <span className="text-zinc-200 text-sm whitespace-pre-wrap">{displayedContent}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex flex-col my-6 px-8 border-l-2 border-transparent hover:border-amber-500/50 transition-colors relative">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <span className="font-sans font-bold text-zinc-400 text-xs tracking-tighter uppercase">
            {line.name}
          </span>
          {line.action && (
            <span className="text-zinc-500 text-[10px] italic font-serif">
              ({line.action})
            </span>
          )}
        </div>
        
        <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={() => onPlayVoice?.(line.id)}
            disabled={isGeneratingVoice}
            className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-amber-500 transition-colors"
            title="播放语音"
          >
            {isGeneratingVoice ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
          </button>
          <button 
            onClick={() => onGenerateImage?.(line.id)}
            disabled={isGeneratingImage}
            className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-amber-500 transition-colors"
            title="可视化此段落"
          >
            {isGeneratingImage ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          </button>
        </div>
      </div>
      
      <div className="font-sans text-lg text-zinc-100 leading-relaxed tracking-wide mb-2">
        <span className="text-amber-500/50 mr-1 text-xl font-serif">“</span>
        {displayedContent}
        <span className="text-amber-500/50 ml-1 text-xl font-serif">”</span>
      </div>

      {line.imageUrl && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-4 rounded-2xl overflow-hidden border border-white/5 shadow-xl max-w-lg"
        >
          <img src={line.imageUrl} alt="Scene" className="w-full h-auto aspect-video object-cover" referrerPolicy="no-referrer" />
        </motion.div>
      )}

      {line.audioUrl && (
        <audio src={line.audioUrl} autoPlay className="hidden" />
      )}
    </div>
  );
};

export default TypewriterText;
