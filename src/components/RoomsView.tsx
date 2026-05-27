import React, { useState, useEffect } from 'react';
import { Play, Plus, Clock, Users, ArrowRight } from 'lucide-react';
import { mockService } from '@/src/mockData';
import { StorySetting } from '@/src/types';
import { motion } from 'motion/react';

export const RoomsView: React.FC<{ 
  onSelectRoom: (roomId: string) => void,
  onGoMarket: () => void,
  onGoAssets: () => void,
  onNewTheater: () => void
}> = ({ onSelectRoom, onGoMarket, onGoAssets, onNewTheater }) => {
  const [stories, setStories] = useState<StorySetting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mockService.getMyStories().then(res => {
      setStories(res);
      setLoading(false);
    });
  }, []);

  if (loading) return null;

  return (
    <div className="flex-1 flex flex-col p-6 lg:p-12 overflow-y-auto custom-scrollbar">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-12 lg:mb-16">
            <div>
               <h1 className="text-2xl lg:text-4xl font-bold tracking-tight mb-2">欢迎回来，导演</h1>
               <p className="text-xs lg:text-sm text-zinc-500 font-serif">今天想让平行时空发生怎样的奇迹？</p>
            </div>
            <button 
              onClick={onNewTheater}
              className="w-full md:w-auto flex items-center justify-center gap-3 px-6 lg:px-8 py-3 lg:py-4 bg-zinc-100 text-zinc-950 rounded-full font-bold hover:bg-white transition-all shadow-xl shadow-white/5 group text-sm lg:text-base"
            >
               <Plus size={20} />
               开启新剧场
               <ArrowRight size={18} className="translate-x-0 group-hover:translate-x-1 transition-transform" />
            </button>
         </header>

         <div className="grid grid-cols-12 gap-8 lg:gap-12">
            <section className="col-span-12 xl:col-span-8">
               <h2 className="text-lg lg:text-xl font-bold mb-6 lg:mb-8 flex items-center gap-3">
                  正在上演的剧场 <span className="bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded text-[9px] lg:text-[10px] font-mono">推演中</span>
               </h2>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
                  {[1, 2].map(i => (
                    <motion.div 
                      key={i} 
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => onSelectRoom(`room_${i}`)}
                      className="group relative h-56 lg:h-64 rounded-[1.5rem] lg:rounded-[2rem] overflow-hidden border border-white/5 cursor-pointer shadow-2xl"
                    >
                       <img src={i === 1 ? 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=800' : 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800'} className="w-full h-full object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all duration-700" alt="" />
                       <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent p-6 lg:p-8 flex flex-col justify-end">
                          <p className="text-[9px] font-mono text-amber-500 mb-1 lg:mb-2 tracking-[0.2em] lg:tracking-[0.3em] uppercase">剧本编号 #00{i}</p>
                          <h3 className="text-xl lg:text-2xl font-bold mb-1 tracking-tight truncate">{i === 1 ? '便利店的宿命重逢' : '巡演后台：最后的告别'}</h3>
                          <div className="flex items-center justify-between mt-4 lg:mt-6">
                             <div className="flex -space-x-1.5 lg:-space-x-2">
                                {[1, 2, 3].map(j => <div key={j} className="w-6 h-6 lg:w-8 lg:h-8 rounded-full border-2 border-zinc-950 bg-zinc-800 overflow-hidden"><img src={`https://i.pravatar.cc/100?img=${j + i * 10}`} alt="" /></div>)}
                             </div>
                             <span className="text-[10px] lg:text-xs font-bold px-3 lg:px-4 py-1.5 lg:py-2 bg-white/10 backdrop-blur-md rounded-full text-zinc-100 group-hover:bg-amber-500 group-hover:text-zinc-950 transition-all">进入剧场</span>
                          </div>
                       </div>
                    </motion.div>
                  ))}
               </div>
            </section>

            <section className="col-span-12 xl:col-span-4 mt-8 xl:mt-0">
               <h2 className="text-lg lg:text-xl font-bold mb-6 lg:mb-8">精选故事背景</h2>
               <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4">
                  {stories.map(setting => (
                    <div key={setting.id} className="group flex gap-4 p-4 bg-zinc-900 border border-white/5 rounded-2xl hover:border-amber-500/30 transition-all cursor-pointer">
                       <img src={setting.coverImage} className="w-16 h-16 lg:w-20 lg:h-20 rounded-xl object-cover shrink-0" alt="" />
                       <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-xs lg:text-sm mb-1 truncate">{setting.title}</h4>
                          <p className="text-[9px] lg:text-[10px] text-zinc-500 leading-relaxed line-clamp-2">{setting.description}</p>
                          <div className="mt-2 flex gap-1">
                             {setting.tags.slice(0, 2).map(tag => <span key={tag} className="text-[8px] px-1.5 py-0.5 bg-zinc-800 rounded uppercase font-bold text-amber-500/80">{tag}</span>)}
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
               <button onClick={onGoMarket} className="w-full mt-6 py-3 border border-zinc-800 rounded-xl lg:rounded-2xl text-[10px] lg:text-xs font-bold text-zinc-500 hover:text-zinc-200 hover:border-zinc-700 transition-all">
                  浏览更多故事背景 →
               </button>
            </section>
         </div>
    </div>
  );
};
