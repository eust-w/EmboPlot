import React, { useEffect, useState } from 'react';
import { ChevronLeft, Coins, CreditCard, Edit2, Camera, X, LogOut, Image as ImageIcon, Loader2, Sparkles, Upload, History, RefreshCw, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PointTransaction, Profile, RechargeOrder, RechargePlan } from '@/src/types';

interface ProfileViewProps {
  profile: Profile;
  transactions: PointTransaction[];
  rechargePlans: RechargePlan[];
  onBack: () => void;
  onRefreshTransactions: () => Promise<PointTransaction[]>;
  onCreateRechargeOrder: (planId: string) => Promise<RechargeOrder>;
  onSaveProfile: (profile: Profile) => Promise<Profile>;
  onGenerateProfileAvatar: (input: { nickname: string; signature: string; tags: string[]; prompt?: string }) => Promise<string>;
  onLogout: () => Promise<void>;
}

const fileToAvatarDataURL = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('头像读取失败'));
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => reject(new Error('头像解析失败'));
    image.onload = () => {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('当前浏览器无法处理头像'));
        return;
      }
      const scale = Math.max(size / image.width, size / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      ctx.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.86));
    };
    image.src = String(reader.result || '');
  };
  reader.readAsDataURL(file);
});

const POINT_REASON_LABELS: Record<string, string> = {
  'ai:script_generate': '剧本推演',
  'ai:character_parse': 'AI 解析角色',
  'ai:character_generate': '生成角色卡',
  'ai:story_generate': '生成故事背景',
  'ai:image_generate': '生成图片',
  'ai:character_image': '生成角色图',
  'ai:story_image': '生成背景封面',
  'ai:image_edit': '图像微调',
  'ai:scene_image': '生成场景图',
  'ai:speech': '角色配音',
  'ai:audio_export': '整剧音频导出',
  'ai:transcribe': '音频转写',
  'ai:embed': '记忆向量化',
  'ai:moderate': '内容安全审核',
  'ai:vision': '图片理解',
  'payment:hupijiao': '虎皮椒充值',
};

const transactionLabel = (reason: string) => {
  if (reason.startsWith('refund:')) {
    const source = reason.slice('refund:'.length);
    return `${POINT_REASON_LABELS[source] || source}退款`;
  }
  return POINT_REASON_LABELS[reason] || reason;
};

const formatTransactionTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const transactionMetaText = (transaction: PointTransaction) => {
  const metadata = transaction.metadata || {};
  const parts = [
    metadata.roomId ? `剧场 ${metadata.roomId}` : '',
    metadata.lines ? `${metadata.lines} 行` : '',
    metadata.texts ? `${metadata.texts} 条文本` : '',
    metadata.filename ? metadata.filename : '',
    metadata.tradeOrderId ? `订单 ${metadata.tradeOrderId}` : '',
    metadata.planId ? `套餐 ${metadata.planId}` : '',
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : metadata.path || 'AI 能力调用';
};

const formatPrice = (amountCents: number) => {
  if (!Number.isFinite(amountCents)) return '--';
  return (amountCents / 100).toFixed(amountCents % 100 === 0 ? 0 : 2);
};

export const ProfileView: React.FC<ProfileViewProps> = ({ profile: profileProp, transactions, rechargePlans, onBack, onRefreshTransactions, onCreateRechargeOrder, onSaveProfile, onGenerateProfileAvatar, onLogout }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<Profile>(profileProp);
  const [avatarPrompt, setAvatarPrompt] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [rechargeError, setRechargeError] = useState('');
  const [rechargeStatus, setRechargeStatus] = useState('');
  const [lastPaymentLink, setLastPaymentLink] = useState('');
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isRefreshingTransactions, setIsRefreshingTransactions] = useState(false);

  const [editForm, setEditForm] = useState({ ...profile });

  useEffect(() => {
    setProfile(profileProp);
    setEditForm(profileProp);
  }, [profileProp]);

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    setAvatarError('');
    try {
      const updated = await onSaveProfile(editForm);
      setProfile(updated);
      setEditForm(updated);
      setIsEditing(false);
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : '资料保存失败');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setIsUploadingAvatar(true);
    setAvatarError('');
    try {
      const avatarUrl = await fileToAvatarDataURL(file);
      setEditForm(prev => ({ ...prev, avatarUrl }));
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : '头像上传失败');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleGenerateAvatar = async () => {
    setIsGeneratingAvatar(true);
    setAvatarError('');
    try {
      const avatarUrl = await onGenerateProfileAvatar({
        nickname: editForm.nickname,
        signature: editForm.signature,
        tags: editForm.tags,
        prompt: avatarPrompt,
      });
      setEditForm(prev => ({ ...prev, avatarUrl }));
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'AI 头像生成失败');
    } finally {
      setIsGeneratingAvatar(false);
    }
  };

  const handleRefreshTransactions = async () => {
    setIsRefreshingTransactions(true);
    try {
      await onRefreshTransactions();
    } finally {
      setIsRefreshingTransactions(false);
    }
  };

  const handleRecharge = async (planId: string) => {
    setPendingPlanId(planId);
    setRechargeError('');
    setRechargeStatus('');
    setLastPaymentLink('');
    try {
      const order = await onCreateRechargeOrder(planId);
      const target = order.payUrl || order.qrCodeUrl;
      if (!target) {
        throw new Error('支付链接生成失败');
      }
      setLastPaymentLink(target);
      const popup = window.open(target, '_blank', 'noopener,noreferrer');
      setRechargeStatus(popup ? `订单 ${order.tradeOrderId} 已创建` : `订单 ${order.tradeOrderId} 已创建，请打开支付链接`);
    } catch (error) {
      setRechargeError(error instanceof Error ? error.message : '支付订单创建失败');
    } finally {
      setPendingPlanId(null);
    }
  };

  const renderAvatar = (item: Profile, className: string, textClassName: string) => {
    if (item.avatarUrl) {
      return <img src={item.avatarUrl} alt="" className={`${className} object-cover border border-white/10`} />;
    }
    return (
      <div className={`${className} bg-amber-500 flex items-center justify-center shadow-2xl shadow-amber-500/20`}>
        <span className={`${textClassName} font-black text-zinc-950`}>{item.avatarChar}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 p-6 lg:p-12 overflow-y-auto custom-scrollbar relative">
      <header className="flex items-center justify-between gap-4 lg:gap-6 mb-12 lg:mb-16">
        <div className="flex items-center gap-4 lg:gap-6 min-w-0">
          <button onClick={onBack} className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-500">
            <ChevronLeft size={24} />
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl lg:text-4xl font-bold tracking-tight">账户中心</h1>
            <p className="text-xs lg:text-sm text-zinc-500 font-serif">管理您的导演身份与剧场资产</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="shrink-0 flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/5 text-xs font-bold transition-colors"
        >
          <LogOut size={15} />
          <span className="hidden sm:inline">退出</span>
        </button>
      </header>

      <div className="grid grid-cols-12 gap-8 lg:gap-12">
        {/* User Identity Card */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-zinc-900 border border-white/5 rounded-[2rem] lg:rounded-[2.5rem] p-6 lg:p-10 overflow-hidden relative group">
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-6">
                {renderAvatar(profile, 'w-20 h-20 lg:w-24 lg:h-24 rounded-[2rem] lg:rounded-[2.5rem]', 'text-3xl lg:text-4xl')}
                <button 
                  onClick={() => setIsEditing(true)}
                  className="absolute -bottom-1 -right-1 lg:-bottom-2 lg:-right-2 p-2 bg-zinc-800 border border-white/10 rounded-full text-zinc-400 hover:text-white transition-colors"
                >
                  <Camera size={14} className="lg:hidden" />
                  <Camera size={16} className="hidden lg:block" />
                </button>
              </div>
              
              <h3 className="text-xl lg:text-2xl font-bold mb-1">{profile.nickname}</h3>
              <p className="text-zinc-500 text-[10px] font-mono mb-4 uppercase tracking-widest">{profile.uid}</p>
              
              <p className="text-xs lg:text-sm text-zinc-400 leading-relaxed italic mb-6 px-2 lg:px-0">
                "{profile.signature}"
              </p>

              <div className="flex flex-wrap justify-center gap-1.5 lg:gap-2 mb-8">
                {profile.tags.map(tag => (
                  <span key={tag} className="px-2.5 py-1 bg-white/5 border border-white/5 rounded-full text-[9px] text-zinc-500 font-bold uppercase">
                    {tag}
                  </span>
                ))}
              </div>

              <button 
                onClick={() => setIsEditing(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 lg:py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-xl lg:rounded-2xl text-xs font-bold transition-all border border-white/5"
              >
                <Edit2 size={14} /> 编辑导演资料
              </button>
            </div>
          </div>

          {/* Token Card */}
          <div className="bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/10 rounded-[1.5rem] lg:rounded-[2rem] p-6 lg:p-8">
            <div className="flex items-center gap-2 text-amber-500/80 text-[9px] lg:text-[10px] font-mono uppercase tracking-widest mb-3">
              <Coins size={12} /> 剧场剧情币
            </div>
            <div className="flex items-end gap-1.5 lg:gap-2 mb-2">
              <p className="text-4xl lg:text-5xl font-black text-white tracking-tighter">{profile.points.toLocaleString()}</p>
              <p className="text-amber-500 text-[10px] font-bold mb-1.5 lg:mb-2 uppercase">Points</p>
            </div>
            <p className="text-zinc-500 text-[9px] lg:text-[10px] leading-relaxed">剧情币可用于加速推演、生成高质量视觉素材与解锁高级剧本模型。</p>
          </div>
        </div>

        {/* Recharge Area */}
        <div className="col-span-12 lg:col-span-8 space-y-12">
          <section>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                获取剧情币 <span className="text-xs font-normal text-zinc-500 bg-white/5 px-3 py-1 rounded-full uppercase tracking-widest">Add Funds</span>
              </h2>
            </div>
            
            {(rechargeError || rechargeStatus) && (
              <div className={`mb-5 rounded-2xl border px-4 py-3 text-xs ${rechargeError ? 'border-red-500/20 bg-red-500/10 text-red-200' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'}`}>
                <span>{rechargeError || rechargeStatus}</span>
                {lastPaymentLink && (
                  <a href={lastPaymentLink} target="_blank" rel="noreferrer" className="ml-3 font-black text-amber-300 hover:text-amber-200">
                    打开支付
                  </a>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
              {rechargePlans.map(plan => (
                <motion.div 
                  key={plan.id}
                  whileHover={{ y: -4 }}
                  className="bg-zinc-900 border border-white/5 rounded-[2rem] p-6 lg:p-8 flex flex-col items-center text-center relative"
                >
                  <div className="w-12 h-12 lg:w-16 lg:h-16 bg-amber-500/10 text-amber-500 rounded-2xl lg:rounded-3xl flex items-center justify-center mb-4 lg:mb-6">
                    <CreditCard size={24} className="lg:hidden" />
                    <CreditCard size={32} className="hidden lg:block" />
                  </div>
                  <h4 className="text-lg lg:text-xl font-black mb-1">{plan.points} 剧情币</h4>
                  <p className="text-[10px] text-zinc-500 mb-6 lg:mb-8 font-mono">{plan.label}流量包</p>
                  <div className="mt-auto w-full">
                    <p className="text-2xl lg:text-3xl font-black mb-4 lg:mb-6 tracking-tighter">¥{formatPrice(plan.amountCents)}</p>
                    <button
                      type="button"
                      onClick={() => handleRecharge(plan.id)}
                      disabled={pendingPlanId !== null}
                      className="w-full py-3 lg:py-4 bg-zinc-100 text-zinc-950 rounded-xl lg:rounded-2xl font-black text-sm hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-60 disabled:hover:scale-100"
                    >
                      {pendingPlanId === plan.id ? '生成订单...' : '立即获取'}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between gap-4 mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                积分流水 <span className="text-xs font-normal text-zinc-500 bg-white/5 px-3 py-1 rounded-full uppercase tracking-widest">Ledger</span>
              </h2>
              <button
                type="button"
                onClick={handleRefreshTransactions}
                disabled={isRefreshingTransactions}
                className="shrink-0 flex items-center gap-2 rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-[10px] font-bold text-zinc-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-60"
              >
                <RefreshCw size={13} className={isRefreshingTransactions ? 'animate-spin' : ''} />
                刷新
              </button>
            </div>

            <div className="overflow-hidden rounded-3xl border border-white/5 bg-zinc-900">
              {transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-zinc-500">
                    <History size={22} />
                  </div>
                  <p className="text-sm font-bold text-zinc-300">暂无积分变动</p>
                  <p className="mt-1 text-xs text-zinc-500">AI 推演、图片、配音和解析调用后会记录在这里。</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {transactions.map((transaction) => {
                    const isCredit = transaction.delta > 0;
                    return (
                      <div key={transaction.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4 lg:px-6">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${isCredit ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'}`}>
                          {isCredit ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <p className="text-sm font-bold text-zinc-100">{transactionLabel(transaction.reason)}</p>
                            <span className="text-[10px] font-mono text-zinc-600">{formatTransactionTime(transaction.createdAt)}</span>
                          </div>
                          <p className="mt-1 truncate text-[11px] text-zinc-500">{transactionMetaText(transaction)}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-black ${isCredit ? 'text-emerald-300' : 'text-amber-300'}`}>
                            {isCredit ? '+' : ''}{transaction.delta}
                          </p>
                          <p className="mt-1 text-[10px] font-mono text-zinc-600">余额 {transaction.balanceAfter}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-lg bg-zinc-900 border border-white/10 rounded-[2.5rem] p-10 relative shadow-2xl"
            >
              <button onClick={() => setIsEditing(false)} className="absolute top-8 right-8 text-zinc-500 hover:text-white">
                <X size={20} />
              </button>

              <h3 className="text-2xl font-bold mb-8">编辑资料</h3>
              
              <div className="space-y-6">
                <div className="flex items-center gap-6 mb-8">
                  <div className="relative shrink-0">
                    {renderAvatar(editForm, 'w-20 h-20 rounded-3xl', 'text-3xl')}
                    {(isUploadingAvatar || isGeneratingAvatar) && (
                      <div className="absolute inset-0 rounded-3xl bg-black/60 flex items-center justify-center">
                        <Loader2 size={20} className="animate-spin text-amber-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">头像标识 (Single Char)</label>
                    <input 
                      type="text" 
                      maxLength={1}
                      value={editForm.avatarChar}
                      onChange={(e) => setEditForm({...editForm, avatarChar: e.target.value})}
                      className="w-full bg-zinc-800 border-white/10 rounded-xl px-4 py-2 text-white focus:ring-1 ring-amber-500 outline-none"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-zinc-950/50 p-4">
                  <div className="flex flex-col sm:flex-row gap-2 mb-3">
                    <label className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-zinc-800 px-4 py-2.5 text-xs font-bold text-zinc-200 hover:bg-zinc-700 transition-colors cursor-pointer border border-white/5">
                      {isUploadingAvatar ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      上传头像
                      <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateAvatar}
                      disabled={isGeneratingAvatar || isUploadingAvatar}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black text-zinc-950 hover:bg-amber-400 transition-colors disabled:opacity-60"
                    >
                      {isGeneratingAvatar ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      AI 生成
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
                    <ImageIcon size={12} /> 头像提示词
                  </div>
                  <textarea
                    rows={2}
                    value={avatarPrompt}
                    onChange={(event) => setAvatarPrompt(event.target.value)}
                    placeholder="例如：黑金科技感、电影级侧脸、安静的导演气质..."
                    className="w-full resize-none rounded-xl border border-white/5 bg-zinc-800 px-4 py-3 text-xs text-white outline-none ring-amber-500/20 focus:ring-1"
                  />
                  {avatarError && (
                    <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                      {avatarError}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">导演昵称</label>
                  <input 
                    type="text" 
                    value={editForm.nickname}
                    onChange={(e) => setEditForm({...editForm, nickname: e.target.value})}
                    className="w-full bg-zinc-800 border-white/10 rounded-xl px-4 py-3 text-white focus:ring-1 ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">个人签名</label>
                  <textarea 
                    value={editForm.signature}
                    onChange={(e) => setEditForm({...editForm, signature: e.target.value})}
                    className="w-full bg-zinc-800 border-white/10 rounded-xl px-4 py-3 text-white focus:ring-1 ring-amber-500 outline-none h-24 resize-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">导演标签 (逗号分割)</label>
                  <input 
                    type="text" 
                    value={editForm.tags.join(', ')}
                    onChange={(e) => setEditForm({...editForm, tags: e.target.value.split(',').map(t => t.trim())})}
                    className="w-full bg-zinc-800 border-white/10 rounded-xl px-4 py-3 text-white focus:ring-1 ring-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="mt-10 flex gap-4">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-4 bg-zinc-800 text-zinc-400 rounded-2xl font-bold hover:bg-zinc-700 transition-all border border-white/5"
                >
                  取消
                </button>
                <button 
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile || isUploadingAvatar || isGeneratingAvatar}
                  className="flex-1 py-4 bg-amber-500 text-zinc-950 rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all shadow-xl shadow-amber-500/20 disabled:opacity-60 disabled:hover:scale-100"
                >
                  {isSavingProfile ? '保存中...' : '保存设置'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
