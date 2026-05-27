import React, { useState, useEffect } from 'react';
import { ChevronLeft, Search, Sparkles, User, Image as ImageIcon, Map, ShoppingBag } from 'lucide-react';
import { mockService } from '@/src/mockData';
import { Character, StorySetting } from '@/src/types';
import { motion, AnimatePresence } from 'motion/react';
import { DetailModal } from './DetailModal';

export const MarketView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [stories, setStories] = useState<StorySetting[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedAsset, setSelectedAsset] = useState<{ type: 'character' | 'story', data: any } | null>(null);

  const handleOffline = (id: string) => {
    if (confirm('确认将此角色卡下线吗？下线后其他导演将无法在市场看到它。')) {
      setCharacters(prev => prev.filter(c => c.id !== id));
      alert('角色已成功下线');
    }
  };

  const myPublishedCharacters = characters.filter(c => c.creator === 'Me');
  const otherCharacters = characters.filter(c => c.creator !== 'Me');

  useEffect(() => {
    const fetchData = async () => {
      const [chars, stors] = await Promise.all([
        mockService.getMarketCharacters(),
        mockService.getMarketStories()
      ]);
      setCharacters(chars);
      setStories(stors);
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) {
     return (
       <div className="h-full flex items-center justify-center bg-zinc-950">
          <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
       </div>
     );
  }

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
                      <div className="w-6 h-6 rounded-full bg-zinc-800" />
                      <span className="text-xs text-zinc-400">官方出品</span>
                   </div>
                   <button 
                    onClick={(e) => { e.stopPropagation(); alert('此背景已加入你的剧本库'); }}
                    className="text-amber-500 font-bold text-sm hover:underline"
                   >
                     免费获取
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

        {myPublishedCharacters.length > 0 && (
          <div className="mb-12">
            <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <User size={12} /> 我上线的角色
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4 lg:gap-6">
              {myPublishedCharacters.map(char => (
                 <motion.div 
                  key={char.id}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => setSelectedAsset({ type: 'character', data: char })}
                  className="group bg-zinc-900 border border-amber-500/20 rounded-2xl p-3 lg:p-4 cursor-pointer relative"
                 >
                    <div className="aspect-square rounded-xl overflow-hidden mb-3 lg:mb-4 relative">
                      <img src={char.avatar} className="w-full h-full object-cover" alt="" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleOffline(char.id); }}
                          className="px-3 py-1.5 bg-red-500 text-white rounded-full text-[9px] font-black uppercase tracking-tighter hover:scale-110 transition-transform"
                        >
                          下线
                        </button>
                      </div>
                    </div>
                    <h4 className="font-bold text-xs lg:text-sm mb-1 truncate">{char.name}</h4>
                    <p className="text-[9px] lg:text-[10px] text-zinc-500 leading-tight mb-3 h-8 line-clamp-2">{char.description}</p>
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                       <span className="text-[9px] text-amber-500 font-mono italic">我的创作</span>
                    </div>
                 </motion.div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4 lg:gap-6">
          {otherCharacters.map(char => (
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
                <div className="flex items-center justify-between pt-2 lg:pt-3 border-t border-white/5">
                   <span className="text-[9px] text-zinc-600 font-mono">by {char.creator || 'User'}</span>
                   <span className="hidden sm:block text-[9px] font-bold text-amber-500">12.5k 收藏</span>
                </div>
             </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
};
