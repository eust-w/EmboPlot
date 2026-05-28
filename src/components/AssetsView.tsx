import React, { useEffect, useState } from 'react';
import { ArchiveX, ChevronLeft, Edit3, Globe2, Grid, List as ListIcon, LockKeyhole, Plus, Trash2 } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { Character, CharacterDraftInput, CharacterImageInput, ImageEditInput, StoryDraftInput, StoryImageInput, StorySetting } from '../types';
import { DetailModal } from './DetailModal';

interface AssetsViewProps {
  onBack: () => void;
  initialCharacters: Character[];
  initialStories: StorySetting[];
  onSaveCharacter: (character: Character) => Promise<Character>;
  onSaveStory: (story: StorySetting) => Promise<StorySetting>;
  onPublishCharacter: (id: string) => Promise<Character>;
  onUnpublishCharacter: (id: string) => Promise<Character>;
  onPublishStory: (id: string) => Promise<StorySetting>;
  onUnpublishStory: (id: string) => Promise<StorySetting>;
  onParseCharacterFile: (file: File) => Promise<Character>;
  onGenerateCharacter: (input: CharacterDraftInput) => Promise<Character>;
  onGenerateCharacterImage: (input: CharacterImageInput) => Promise<string>;
  onGenerateStory: (input: StoryDraftInput) => Promise<StorySetting>;
  onGenerateStoryImage: (input: StoryImageInput) => Promise<string>;
  onEditImage: (input: ImageEditInput) => Promise<string>;
}

type PublishableAsset = { isPublic?: boolean; publishedAt?: string };

const isPublishedLocked = (asset: PublishableAsset) => Boolean(asset.isPublic || asset.publishedAt);

const visibilityStatus = (asset: PublishableAsset) => {
  if (asset.isPublic) {
    return {
      label: '公开',
      className: 'bg-amber-500/15 text-amber-300 border border-amber-500/25',
    };
  }
  if (asset.publishedAt) {
    return {
      label: '已下线',
      className: 'bg-zinc-800 text-zinc-400 border border-white/10',
    };
  }
  return {
    label: '草稿',
    className: 'bg-zinc-800 text-zinc-400 border border-white/5',
  };
};

const visibilityButtonLabel = (asset: PublishableAsset) => asset.isPublic ? '下线' : '公开';

const visibilityConfirmText = (asset: PublishableAsset, title: string) => {
  if (asset.isPublic) return `确认下线《${title}》？下线后不会出现在市场，但内容仍保持冻结。`;
  if (asset.publishedAt) return `确认重新公开《${title}》？公开版本会沿用已冻结内容。`;
  return `确认公开《${title}》？公开后这张卡片将无法再编辑，只能下线或重新公开。`;
};

const errorMessage = (error: unknown) => error instanceof Error ? error.message : '操作失败';

export const AssetsView: React.FC<AssetsViewProps> = ({ onBack, initialCharacters, initialStories, onSaveCharacter, onSaveStory, onPublishCharacter, onUnpublishCharacter, onPublishStory, onUnpublishStory, onParseCharacterFile, onGenerateCharacter, onGenerateCharacterImage, onGenerateStory, onGenerateStoryImage, onEditImage }) => {
  const [characters, setCharacters] = useState<Character[]>(initialCharacters);
  const [stories, setStories] = useState<StorySetting[]>(initialStories);
  const [saving, setSaving] = useState(false);
  const [assetError, setAssetError] = useState('');

  const [activeAsset, setActiveAsset] = useState<{ type: 'character' | 'story', data: any, mode: 'view' | 'edit' } | null>(null);

  useEffect(() => {
    setCharacters(initialCharacters);
  }, [initialCharacters]);

  useEffect(() => {
    setStories(initialStories);
  }, [initialStories]);

  const handleUpdate = async (updatedData: Character | StorySetting) => {
    setSaving(true);
    setAssetError('');
    try {
      if (activeAsset?.type === 'character') {
        const saved = await onSaveCharacter(updatedData as Character);
        setCharacters(prev => [saved, ...prev.filter(c => c.id !== saved.id)]);
        setActiveAsset(prev => prev ? { ...prev, data: saved, mode: 'view' } : prev);
      } else {
        const saved = await onSaveStory(updatedData as StorySetting);
        setStories(prev => [saved, ...prev.filter(s => s.id !== saved.id)]);
        setActiveAsset(prev => prev ? { ...prev, data: saved, mode: 'view' } : prev);
      }
    } catch (error) {
      setAssetError(errorMessage(error));
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const openAsset = (type: 'character' | 'story', data: Character | StorySetting, mode: 'view' | 'edit') => {
    setActiveAsset({ type, data, mode: mode === 'edit' && isPublishedLocked(data) ? 'view' : mode });
  };

  const handleCharacterVisibility = async (char: Character, event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!window.confirm(visibilityConfirmText(char, char.name))) return;
    setSaving(true);
    setAssetError('');
    try {
      const saved = char.isPublic ? await onUnpublishCharacter(char.id) : await onPublishCharacter(char.id);
      setCharacters(prev => prev.map(item => item.id === saved.id ? saved : item));
    } catch (error) {
      setAssetError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleStoryVisibility = async (story: StorySetting, event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!window.confirm(visibilityConfirmText(story, story.title))) return;
    setSaving(true);
    setAssetError('');
    try {
      const saved = story.isPublic ? await onUnpublishStory(story.id) : await onPublishStory(story.id);
      setStories(prev => prev.map(item => item.id === saved.id ? saved : item));
    } catch (error) {
      setAssetError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

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
            onParseCharacterFile={onParseCharacterFile}
            onGenerateCharacter={onGenerateCharacter}
            onGenerateCharacterImage={onGenerateCharacterImage}
            onGenerateStory={onGenerateStory}
            onGenerateStoryImage={onGenerateStoryImage}
            onEditImage={onEditImage}
            readOnly={isPublishedLocked(activeAsset.data)}
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
            {saving && <p className="text-[10px] text-amber-500 mt-1 font-mono uppercase">正在同步云端剧本库...</p>}
            {assetError && <p className="text-[10px] text-red-300 mt-1 font-mono uppercase">{assetError}</p>}
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
                  onClick={() => openAsset('character', { id: `new_${Date.now()}`, name: '新角色', avatar: 'https://i.pravatar.cc/300', description: '', status: 'idle' }, 'edit')}
                  className="text-sm font-bold text-amber-500 flex items-center gap-1 hover:underline"
                >
                  <Plus size={16} /> 创建新角色
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {characters.map(char => (
                  <div key={char.id} className="bg-zinc-900 border border-white/5 rounded-2xl p-4 flex gap-4 group">
                    <img src={char.avatar} className="w-16 h-16 lg:w-20 lg:h-20 rounded-xl object-cover cursor-pointer shrink-0" onClick={() => openAsset('character', char, 'view')} alt="" />
                    <div className="flex-1 min-w-0">
                       <div className="flex items-center justify-between mb-1">
                          <h4 className="font-bold cursor-pointer hover:text-amber-500 transition-colors truncate" onClick={() => openAsset('character', char, 'view')}>{char.name}</h4>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             {!isPublishedLocked(char) && (
                               <button onClick={() => openAsset('character', char, 'edit')} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-300" title="编辑人设"><Edit3 size={14} /></button>
                             )}
                             <button className="p-1.5 hover:bg-red-500/20 rounded text-zinc-500 hover:text-red-500" title="删除"><Trash2 size={14} /></button>
                          </div>
                       </div>
                       <p className="text-[11px] text-zinc-500 leading-relaxed mb-3 line-clamp-2">{char.description}</p>
                       <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full ${visibilityStatus(char).className}`}>
                            {isPublishedLocked(char) && <LockKeyhole size={9} />}
                            {visibilityStatus(char).label}
                          </span>
                          <button
                            type="button"
                            onClick={(event) => handleCharacterVisibility(char, event)}
                            disabled={saving}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold transition-colors disabled:opacity-50 ${char.isPublic ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-amber-500 text-zinc-950 hover:bg-amber-400'}`}
                          >
                            {char.isPublic ? <ArchiveX size={10} /> : <Globe2 size={10} />}
                            {visibilityButtonLabel(char)}
                          </button>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
           </section>

           <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">我的故事背景</h2>
                <button
                  onClick={() => openAsset('story', { id: `new_${Date.now()}`, title: '新故事背景', coverImage: 'https://images.unsplash.com/photo-1516738901171-8eb4fc13bd20?w=800', description: '', tags: [], content: '' }, 'edit')}
                  className="text-sm font-bold text-amber-500 flex items-center gap-1 hover:underline"
                >
                  <Plus size={16} /> 创建新背景
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
                {stories.map(setting => (
                  <div
                    key={setting.id}
                    className="group relative h-36 lg:h-40 rounded-2xl overflow-hidden border border-white/5 cursor-pointer"
                  >
                    <img src={setting.coverImage} className="w-full h-full object-cover transition-transform group-hover:scale-105" onClick={() => openAsset('story', setting, 'view')} alt="" />
                    <div className="absolute left-3 top-3 flex gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold backdrop-blur-md ${visibilityStatus(setting).className}`}>
                        {isPublishedLocked(setting) && <LockKeyhole size={9} />}
                        {visibilityStatus(setting).label}
                      </span>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4 flex flex-col justify-end pointer-events-none">
                       <h4 className="font-bold text-sm lg:text-base mb-1 pointer-events-auto hover:text-amber-500 transition-colors" onClick={() => openAsset('story', setting, 'view')}>{setting.title}</h4>
                       <div className="flex flex-wrap gap-3 pointer-events-auto">
                          {!isPublishedLocked(setting) && (
                            <button onClick={() => openAsset('story', setting, 'edit')} className="text-[10px] text-zinc-400 hover:text-zinc-100 flex items-center gap-1">
                               <Edit3 size={10} /> 编辑
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(event) => handleStoryVisibility(setting, event)}
                            disabled={saving}
                            className={`text-[10px] flex items-center gap-1 disabled:opacity-50 ${setting.isPublic ? 'text-zinc-300 hover:text-white' : 'text-amber-400 hover:text-amber-300'}`}
                          >
                            {setting.isPublic ? <ArchiveX size={10} /> : <Globe2 size={10} />}
                            {visibilityButtonLabel(setting)}
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
              <div className="rounded-2xl border border-white/5 bg-zinc-950/50 px-4 py-6">
                <p className="text-xs text-zinc-500 leading-relaxed">暂无市场动态</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
