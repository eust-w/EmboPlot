import React, { useEffect, useState } from 'react';
import { Plus, ArrowRight, Pencil, Trash2, Copy, X, Save, MoreHorizontal } from 'lucide-react';
import { Room, StorySetting } from '@/src/types';
import { AnimatePresence, motion } from 'motion/react';

export const RoomsView: React.FC<{
  rooms: Room[],
  stories: StorySetting[],
  onSelectRoom: (roomId: string) => void,
  onGoMarket: () => void,
  onGoAssets: () => void,
  onNewTheater: () => void,
  onUpdateRoom: (room: Room) => Promise<Room>,
  onDeleteRoom: (roomId: string) => Promise<boolean>,
  onDuplicateRoom: (room: Room) => Promise<Room>,
}> = ({ rooms, stories, onSelectRoom, onGoMarket, onNewTheater, onUpdateRoom, onDeleteRoom, onDuplicateRoom }) => {
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [editForm, setEditForm] = useState({ title: '', status: 'running', mood: '' });
  const [busyRoomId, setBusyRoomId] = useState<string | null>(null);
  const [confirmDeleteRoom, setConfirmDeleteRoom] = useState<Room | null>(null);

  useEffect(() => {
    if (!editingRoom) return;
    setEditForm({
      title: editingRoom.title,
      status: editingRoom.status || 'running',
      mood: editingRoom.gameSettings.mood || '戏剧冲突',
    });
  }, [editingRoom]);

  const submitEdit = async () => {
    if (!editingRoom || !editForm.title.trim()) return;
    setBusyRoomId(editingRoom.id);
    try {
      await onUpdateRoom({
        ...editingRoom,
        title: editForm.title.trim(),
        status: editForm.status,
        gameSettings: {
          ...editingRoom.gameSettings,
          mood: editForm.mood.trim() || editingRoom.gameSettings.mood,
        },
      });
      setEditingRoom(null);
    } finally {
      setBusyRoomId(null);
    }
  };

  const deleteRoom = async () => {
    if (!confirmDeleteRoom) return;
    setBusyRoomId(confirmDeleteRoom.id);
    try {
      const ok = await onDeleteRoom(confirmDeleteRoom.id);
      if (ok) setConfirmDeleteRoom(null);
    } finally {
      setBusyRoomId(null);
    }
  };

  const duplicateRoom = async (room: Room) => {
    setBusyRoomId(room.id);
    try {
      await onDuplicateRoom(room);
    } finally {
      setBusyRoomId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 lg:p-12 overflow-y-auto custom-scrollbar">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-12 lg:mb-16">
            <div>
               <h1 className="text-2xl lg:text-4xl font-bold tracking-tight mb-2">剧场大厅</h1>
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
                  {rooms.map((room, index) => (
                    <motion.div
                      key={room.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => onSelectRoom(room.id)}
                      className="group relative h-56 lg:h-64 rounded-2xl overflow-hidden border border-white/5 cursor-pointer shadow-2xl bg-zinc-900/70"
                    >
                       <img src={room.currentStory.coverImage} className="w-full h-full object-cover grayscale-[0.45] group-hover:grayscale-0 transition-all duration-700" alt="" />
                       <div className="absolute right-4 top-4 z-20 flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setEditingRoom(room);
                            }}
                            className="p-2 rounded-full bg-black/45 backdrop-blur-md text-zinc-300 hover:text-amber-400 hover:bg-black/70 border border-white/10"
                            title="编辑剧场"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              void duplicateRoom(room);
                            }}
                            disabled={busyRoomId === room.id}
                            className="p-2 rounded-full bg-black/45 backdrop-blur-md text-zinc-300 hover:text-amber-400 hover:bg-black/70 border border-white/10 disabled:opacity-50"
                            title="复制剧场"
                          >
                            {busyRoomId === room.id ? <MoreHorizontal size={14} /> : <Copy size={14} />}
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setConfirmDeleteRoom(room);
                            }}
                            className="p-2 rounded-full bg-black/45 backdrop-blur-md text-zinc-300 hover:text-red-300 hover:bg-red-500/10 border border-white/10"
                            title="删除剧场"
                          >
                            <Trash2 size={14} />
                          </button>
                       </div>
                       <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent p-6 lg:p-8 flex flex-col justify-end">
                          <p className="text-[9px] font-mono text-amber-500 mb-1 lg:mb-2 tracking-[0.2em] uppercase">剧本编号 #{String(index + 1).padStart(3, '0')}</p>
                          <h3 className="text-xl lg:text-2xl font-bold mb-1 tracking-tight truncate pr-24">{room.title}</h3>
                          <p className="text-[10px] text-zinc-400 line-clamp-2">{room.currentStory.description}</p>
                          <div className="flex items-center justify-between mt-4 lg:mt-6">
                             <div className="flex -space-x-1.5 lg:-space-x-2">
                                {room.activeCharacters.slice(0, 3).map(char => <div key={char.id} className="w-6 h-6 lg:w-8 lg:h-8 rounded-full border-2 border-zinc-950 bg-zinc-800 overflow-hidden"><img src={char.avatar} alt="" className="h-full w-full object-cover" /></div>)}
                             </div>
                             <span className="text-[10px] lg:text-xs font-bold px-3 lg:px-4 py-1.5 lg:py-2 bg-white/10 backdrop-blur-md rounded-full text-zinc-100 group-hover:bg-amber-500 group-hover:text-zinc-950 transition-all">进入剧场</span>
                          </div>
                       </div>
                    </motion.div>
                  ))}
                  {rooms.length === 0 && (
                    <div className="col-span-full min-h-56 rounded-2xl border border-dashed border-white/10 bg-white/[0.025] flex flex-col items-center justify-center text-center p-8">
                      <p className="text-sm font-bold text-zinc-300 mb-2">还没有正在上演的剧场</p>
                      <p className="text-xs text-zinc-500 mb-5">从一个故事背景和角色阵容开始创建。</p>
                      <button onClick={onNewTheater} className="px-5 py-3 rounded-full bg-amber-500 text-zinc-950 text-xs font-black">
                        创建第一个剧场
                      </button>
                    </div>
                  )}
               </div>
            </section>

            <section className="col-span-12 xl:col-span-4 mt-8 xl:mt-0">
               <h2 className="text-lg lg:text-xl font-bold mb-6 lg:mb-8">精选故事背景</h2>
               <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4">
                  {stories.map(setting => (
                    <div key={setting.id} onClick={onNewTheater} className="group flex gap-4 p-4 bg-zinc-900/80 border border-white/5 rounded-2xl hover:border-amber-500/30 transition-all cursor-pointer">
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
      <AnimatePresence>
        {editingRoom && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-zinc-900 p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-black">编辑剧场</h3>
                  <p className="text-xs text-zinc-500 mt-1">调整大厅展示和推演状态</p>
                </div>
                <button onClick={() => setEditingRoom(null)} className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-5">
                <label className="block">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">剧场名称</span>
                  <input
                    value={editForm.title}
                    onChange={(event) => setEditForm(prev => ({ ...prev, title: event.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-amber-500/60"
                  />
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">推演状态</span>
                    <select
                      value={editForm.status}
                      onChange={(event) => setEditForm(prev => ({ ...prev, status: event.target.value }))}
                      className="w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-amber-500/60"
                    >
                      <option value="running">推演中</option>
                      <option value="paused">暂停</option>
                      <option value="archived">归档</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">叙法风格</span>
                    <input
                      value={editForm.mood}
                      onChange={(event) => setEditForm(prev => ({ ...prev, mood: event.target.value }))}
                      className="w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-amber-500/60"
                    />
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button onClick={() => setEditingRoom(null)} className="flex-1 rounded-2xl bg-white/5 py-3 text-sm font-bold text-zinc-400 hover:text-white">
                  取消
                </button>
                <button onClick={submitEdit} disabled={busyRoomId === editingRoom.id || !editForm.title.trim()} className="flex-1 rounded-2xl bg-amber-500 py-3 text-sm font-black text-zinc-950 disabled:opacity-50 flex items-center justify-center gap-2">
                  <Save size={15} /> 保存
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {confirmDeleteRoom && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-md rounded-[2rem] border border-red-500/20 bg-zinc-900 p-6 shadow-2xl"
            >
              <h3 className="text-xl font-black mb-2">删除剧场？</h3>
              <p className="text-sm text-zinc-400 leading-6">这会删除「{confirmDeleteRoom.title}」以及当前保存的剧本时间线。</p>
              <div className="flex gap-3 mt-8">
                <button onClick={() => setConfirmDeleteRoom(null)} className="flex-1 rounded-2xl bg-white/5 py-3 text-sm font-bold text-zinc-400 hover:text-white">
                  取消
                </button>
                <button onClick={deleteRoom} disabled={busyRoomId === confirmDeleteRoom.id} className="flex-1 rounded-2xl bg-red-500 py-3 text-sm font-black text-white disabled:opacity-50">
                  删除
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
