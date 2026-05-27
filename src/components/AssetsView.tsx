import React, { useState, useEffect } from 'react';
import { ChevronLeft, Plus, Trash2, Edit3, Grid, List as ListIcon, ShoppingBag } from 'lucide-react';
import { mockService } from '@/src/mockData';
import { motion, AnimatePresence } from 'motion/react';
import { Character, StorySetting } from '../types';
import { DetailModal } from './DetailModal';

export const AssetsView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [stories, setStories] = useState<StorySetting[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeAsset, setActiveAsset] = useState<{ type: 'character' | 'story', data: any, mode: 'view' | 'edit' } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [chars, stors] = await Promise.all([
        mockService.getMyCharacters(),
        mockService.getMyStories()
      ]);
      setCharacters(chars);
      setStories(stors);
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleUpdate = (updatedData: any) => {
    if (activeAsset?.type === 'character') {
      setCharacters(prev => prev.map(c => c.id === updatedData.id ? updatedData : c));
    } else {
      setStories(prev => prev.map(s => s.id === updatedData.id ? updatedData : s));
    }
  };

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
        {activeAsset && (
          <DetailModal 
            type={activeAsset.type}
            data={activeAsset.data}
            mode={activeAsset.mode}
            onClose={() => setActiveAsset(null)}
            onSave={handleUpdate}
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
            <h1 className="text-xl lg:text-3xl font-bold tracking-tight">我的资产</h1>
            <p className="text-[10px] lg:text-sm text-zinc-500 font-serif">管理你的个人角色卡、背景与剧场素材</p>
          </div>
        </div>
        <div className="flex gap-2 bg-zinc-900 p-1 rounded-xl shrink-0">
           <button className="p-1.5 lg:p-2 bg-zinc-800 rounded-lg text-zinc-100">
             <>
               <Grid size={16} className="lg:hidden" />
               <Grid size={18} className="hidden lg:block" />
             </>
           </button>
           <button className="p-1.5 lg:p-2 text-zinc-500 hover:text-zinc-300">
             <>
               <ListIcon size={16} className="lg:hidden" />
               <ListIcon size={18} className="hidden lg:block" />
             </>
           </button>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6 lg:gap-12">
        <div className="col-span-12 xl:col-span-8 flex flex-col gap-12">
           <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">我的人物卡</h2>
                <button 
                  onClick={() => setActiveAsset({ type: 'character', data: { id: `new_${Date.now()}`, name: '新角色', avatar: 'https://i.pravatar.cc/300', description: '', status: 'idle' }, mode: 'edit' })}
                  className="text-sm font-bold text-amber-500 flex items-center gap-1 hover:underline"
                >
                  <Plus size={16} /> 创建新角色
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {characters.map(char => (
                  <div key={char.id} className="bg-zinc-900 border border-white/5 rounded-2xl p-4 flex gap-4 group">
                    <img src={char.avatar} className="w-16 h-16 lg:w-20 lg:h-20 rounded-xl object-cover cursor-pointer shrink-0" onClick={() => setActiveAsset({ type: 'character', data: char, mode: 'view' })} alt="" />
                    <div className="flex-1 min-w-0">
                       <div className="flex items-center justify-between mb-1">
                          <h4 className="font-bold cursor-pointer hover:text-amber-500 transition-colors truncate" onClick={() => setActiveAsset({ type: 'character', data: char, mode: 'view' })}>{char.name}</h4>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => setActiveAsset({ type: 'character', data: char, mode: 'edit' })} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-300" title="编辑人设"><Edit3 size={14} /></button>
                             <button className="p-1.5 hover:bg-red-500/20 rounded text-zinc-500 hover:text-red-500" title="删除"><Trash2 size={14} /></button>
                          </div>
                       </div>
                       <p className="text-[11px] text-zinc-500 leading-relaxed mb-3 line-clamp-2">{char.description}</p>
                       <div className="flex gap-2">
                          <span className="text-[9px] px-2 py-0.5 bg-zinc-800 rounded-full text-zinc-400">公开</span>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
           </section>

           <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">我的故事背景</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
                {stories.map(setting => (
                  <div 
                    key={setting.id} 
                    className="group relative h-36 lg:h-40 rounded-2xl overflow-hidden border border-white/5 cursor-pointer"
                  >
                    <img src={setting.coverImage} className="w-full h-full object-cover transition-transform group-hover:scale-105" onClick={() => setActiveAsset({ type: 'story', data: setting, mode: 'view' })} alt="" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4 flex flex-col justify-end pointer-events-none">
                       <h4 className="font-bold text-sm lg:text-base mb-1 pointer-events-auto hover:text-amber-500 transition-colors" onClick={() => setActiveAsset({ type: 'story', data: setting, mode: 'view' })}>{setting.title}</h4>
                       <div className="flex gap-3 pointer-events-auto">
                          <button onClick={() => setActiveAsset({ type: 'story', data: setting, mode: 'edit' })} className="text-[10px] text-zinc-400 hover:text-zinc-100 flex items-center gap-1">
                             <Edit3 size={10} /> 编辑
                          </button>
                          <button className="text-[10px] text-zinc-400 hover:text-red-500 flex items-center gap-1">
                             <Trash2 size={10} /> 删除
                          </button>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
           </section>
        </div>

        <div className="col-span-12 xl:col-span-4 mt-8 lg:mt-0">
           <div className="bg-zinc-900/50 border border-white/5 rounded-3xl p-6 lg:p-8">
              <h3 className="text-lg font-bold mb-6">市场动态</h3>
              <div className="space-y-6">
                 {[1,2,3].map(i => (
                   <div key={i} className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 shrink-0" />
                      <div className="flex-1">
                         <p className="text-xs font-medium italic text-zinc-300 leading-relaxed">"你的《林深》角色卡被 12 人收藏了"</p>
                         <p className="text-[10px] text-zinc-600 mt-1">2小时前</p>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
