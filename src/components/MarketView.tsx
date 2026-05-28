import React, { useEffect, useState } from 'react';
import { Check, ChevronLeft, Loader2, Map, Search, Sparkles, ShoppingBag } from 'lucide-react';
import { Character, StorySetting } from '@/src/types';
import { motion, AnimatePresence } from 'motion/react';
import { DetailModal } from './DetailModal';

interface MarketViewProps {
  onBack: () => void;
  initialCharacters: Character[];
  initialStories: StorySetting[];
  onAcquireCharacter: (id: string) => Promise<Character>;
  onAcquireStory: (id: string) => Promise<StorySetting>;
}

const creatorLabel = (creator?: string) => creator?.trim() || '匿名导演';

const creatorInitial = (creator?: string) => creatorLabel(creator).slice(0, 1).toUpperCase();

const assetKey = (type: 'character' | 'story', id: string) => `${type}:${id}`;

export const MarketView: React.FC<MarketViewProps> = ({ onBack, initialCharacters, initialStories, onAcquireCharacter, onAcquireStory }) => {
  const [characters, setCharacters] = useState<Character[]>(initialCharacters);
  const [stories, setStories] = useState<StorySetting[]>(initialStories);
  const [acquiredAssets, setAcquiredAssets] = useState<Set<string>>(new Set());
  const [acquiringId, setAcquiringId] = useState<string | null>(null);
  const [marketError, setMarketError] = useState('');
  
  const [selectedAsset, setSelectedAsset] = useState<{ type: 'character' | 'story', data: any } | null>(null);

  useEffect(() => {
    setCharacters(initialCharacters);
  }, [initialCharacters]);

  useEffect(() => {
    setStories(initialStories);
  }, [initialStories]);

  const handleAcquireCharacter = async (event: React.MouseEvent<HTMLButtonElement>, character: Character) => {
    event.stopPropagation();
    const key = assetKey('character', character.id);
    if (acquiredAssets.has(key) || acquiringId) return;
    setAcquiringId(key);
    setMarketError('');
    try {
      await onAcquireCharacter(character.id);
      setAcquiredAssets(prev => new Set(prev).add(key));
    } catch (error) {
      setMarketError(error instanceof Error ? error.message : '获取失败');
    } finally {
      setAcquiringId(null);
    }
  };

  const handleAcquireStory = async (event: React.MouseEvent<HTMLButtonElement>, story: StorySetting) => {
    event.stopPropagation();
    const key = assetKey('story', story.id);
    if (acquiredAssets.has(key) || acquiringId) return;
    setAcquiringId(key);
    setMarketError('');
    try {
      await onAcquireStory(story.id);
      setAcquiredAssets(prev => new Set(prev).add(key));
    } catch (error) {
      setMarketError(error instanceof Error ? error.message : '获取失败');
    } finally {
      setAcquiringId(null);
    }
  };

  const acquireButtonContent = (key: string) => {
    if (acquiringId === key) {
      return (
        <>
          <Loader2 size={13} className="animate-spin" />
          获取中
        </>
      );
    }
    if (acquiredAssets.has(key)) {
      return (
        <>
          <Check size={13} />
          已加入
        </>
      );
    }
    return '免费获取';
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 p-4 sm:p-6 lg:p-8 overflow-y-auto custom-scrollbar relative">
      <AnimatePresence>
        {selectedAsset && (
          <DetailModal 
            type={selectedAsset.type}
            data={selectedAsset.data}
            mode="view"
            readOnly={true}
            onClose={() => setSelectedAsset(null)}
          />
        )}
      </AnimatePresence>
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10 lg:mb-12">
        <div className="flex items-center gap-3 lg:gap-6">
          <button onClick={onBack} className="p-1.5 lg:p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-500">
            <>
              <ChevronLeft size={20} className="lg:hidden" />
              <ChevronLeft size={24} className="hidden lg:block" />
            </>
          </button>
          <div>
            <h1 className="text-xl lg:text-3xl font-bold tracking-tight">内容市场</h1>
            <p className="text-[10px] lg:text-sm text-zinc-500 font-serif">发现灵感，开启新的平行时空</p>
            {marketError && <p className="mt-1 text-[10px] font-mono uppercase text-red-300">{marketError}</p>}
          </div>
        </div>
        <div className="flex items-center w-full md:w-auto gap-4">
           <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
              <input 
                type="text" 
                placeholder="搜索角色或背景..." 
                className="bg-zinc-900 border border-white/5 rounded-full pl-9 lg:pl-10 pr-6 py-2 text-xs lg:text-sm focus:ring-2 ring-amber-500/20 outline-none w-full"
              />
           </div>
        </div>
      </header>

      <section className="mb-16">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
            <Map size={18} />
          </div>
          <h2 className="text-xl font-bold">推荐故事背景</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stories.map(setting => (
            <motion.div 
              key={setting.id}
              whileHover={{ y: -5 }}
              onClick={() => setSelectedAsset({ type: 'story', data: setting })}
              className="group bg-zinc-900 rounded-3xl border border-white/5 overflow-hidden cursor-pointer"
            >
              <div className="h-48 relative">
                <img src={setting.coverImage} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="" />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-6 flex gap-2">
                  {setting.tags.map(tag => (
                    <span key={tag} className="px-2 py-1 bg-white/10 backdrop-blur-md rounded-md text-[10px] font-bold">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-lg font-bold mb-2 group-hover:text-amber-500 transition-colors">{setting.title}</h3>
                <p className="text-sm text-zinc-500 line-clamp-2 leading-relaxed h-10">{setting.description}</p>
                <div className="mt-4 flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-zinc-800 text-[10px] font-black text-zinc-400 flex items-center justify-center">
                        {creatorInitial(setting.creator)}
                      </div>
                      <span className="text-xs text-zinc-400">by {creatorLabel(setting.creator)}</span>
                   </div>
                   <button 
                    onClick={(event) => handleAcquireStory(event, setting)}
                    disabled={acquiringId !== null || acquiredAssets.has(assetKey('story', setting.id))}
                    className="flex items-center gap-1.5 text-amber-500 font-bold text-sm hover:underline disabled:text-zinc-500 disabled:no-underline"
                   >
                     {acquireButtonContent(assetKey('story', setting.id))}
                   </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-500">
            <ShoppingBag size={18} />
          </div>
          <h2 className="text-xl font-bold">精选角色卡</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4 lg:gap-6">
          {characters.map(char => (
             <motion.div 
              key={char.id}
              whileHover={{ scale: 1.02 }}
              onClick={() => setSelectedAsset({ type: 'character', data: char })}
              className="group bg-zinc-900 border border-white/5 rounded-2xl p-3 lg:p-4 cursor-pointer"
             >
                <div className="aspect-square rounded-xl overflow-hidden mb-3 lg:mb-4 relative">
                  <img src={char.avatar} className="w-full h-full object-cover" alt="" />
                  <div className="absolute top-2 right-2 bg-amber-500 text-zinc-950 p-1 rounded lg:p-1.5 lg:rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <Sparkles size={12} className="lg:hidden" />
                    <Sparkles size={14} className="hidden lg:block" />
                  </div>
                </div>
                <h4 className="font-bold text-xs lg:text-sm mb-1 truncate">{char.name}</h4>
                <p className="text-[9px] lg:text-[10px] text-zinc-500 leading-tight mb-3 h-8 line-clamp-2">{char.description}</p>
                <div className="flex items-center justify-between gap-3 pt-2 lg:pt-3 border-t border-white/5">
                   <span className="min-w-0 truncate text-[9px] text-zinc-600 font-mono">by {creatorLabel(char.creator)}</span>
                   <button
                    type="button"
                    onClick={(event) => handleAcquireCharacter(event, char)}
                    disabled={acquiringId !== null || acquiredAssets.has(assetKey('character', char.id))}
                    className="shrink-0 flex items-center gap-1 text-[9px] font-bold text-amber-500 hover:text-amber-300 disabled:text-zinc-500"
                   >
                    {acquireButtonContent(assetKey('character', char.id))}
                   </button>
                </div>
             </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
};
