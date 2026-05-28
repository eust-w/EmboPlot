import React, { useState } from 'react';
import { Loader2, Lock, Mail, Sparkles, UserRound } from 'lucide-react';
import { motion } from 'motion/react';
import type { AuthUser } from '@/src/types';

interface AuthViewProps {
  onLogin: (input: { email: string; password: string }) => Promise<AuthUser>;
  onRegister: (input: { email: string; password: string; nickname: string }) => Promise<AuthUser>;
  onAuthenticated: (user: AuthUser) => Promise<void>;
}

export const AuthView: React.FC<AuthViewProps> = ({ onLogin, onRegister, onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegister = mode === 'register';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const user = isRegister
        ? await onRegister({ email, password, nickname })
        : await onLogin({ email, password });
      await onAuthenticated(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : '认证失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      <div className="absolute inset-0 opacity-30 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:72px_72px]" />
      <section className="relative min-h-screen grid lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col justify-between p-6 sm:p-10 lg:p-14">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Sparkles size={22} className="text-zinc-950" />
            </div>
            <div>
              <p className="text-xl font-black italic tracking-tighter">PARALLEL</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-[0.24em] font-mono">Theater Engine</p>
            </div>
          </div>

          <div className="max-w-2xl py-16 lg:py-0">
            <p className="text-xs text-amber-400 font-mono uppercase tracking-[0.35em] mb-5">Director Identity</p>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[0.92]">
              建立你的云端导演身份
            </h1>
            <p className="mt-7 max-w-xl text-sm sm:text-base text-zinc-400 leading-7 font-serif">
              角色卡、故事背景、剧场进度与剧情币将绑定到独立账户。后续市场上架、充值和创作者分发都会基于这个身份运行。
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 max-w-xl text-[10px] sm:text-xs text-zinc-500 font-mono uppercase tracking-widest">
            <span className="border-t border-white/10 pt-3">HttpOnly Session</span>
            <span className="border-t border-white/10 pt-3">Mongo Account</span>
            <span className="border-t border-white/10 pt-3">Private Workspace</span>
          </div>
        </div>

        <div className="flex items-center justify-center p-6 sm:p-10 lg:p-14">
          <motion.form
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28 }}
            onSubmit={handleSubmit}
            className="w-full max-w-md bg-white/[0.045] border border-white/10 backdrop-blur-xl rounded-[2rem] p-6 sm:p-8 shadow-2xl"
          >
            <div className="flex bg-zinc-950/70 border border-white/10 rounded-2xl p-1 mb-8">
              {(['login', 'register'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setMode(item);
                    setError('');
                  }}
                  className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${
                    mode === item ? 'bg-amber-500 text-zinc-950' : 'text-zinc-500 hover:text-zinc-100'
                  }`}
                >
                  {item === 'login' ? '登录' : '注册'}
                </button>
              ))}
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-black tracking-tight">{isRegister ? '创建账户' : '欢迎回来'}</h2>
              <p className="text-xs text-zinc-500 mt-2">{isRegister ? '开启你的个人导演资源库' : '继续你的剧场推演'}</p>
            </div>

            <div className="space-y-4">
              {isRegister && (
                <label className="block">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">导演昵称</span>
                  <div className="flex items-center gap-3 bg-zinc-950/80 border border-white/10 rounded-2xl px-4">
                    <UserRound size={17} className="text-zinc-500" />
                    <input
                      value={nickname}
                      onChange={(event) => setNickname(event.target.value)}
                      placeholder="星港导演"
                      className="w-full bg-transparent py-4 text-sm outline-none text-zinc-100 placeholder:text-zinc-700"
                    />
                  </div>
                </label>
              )}

              <label className="block">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">邮箱</span>
                <div className="flex items-center gap-3 bg-zinc-950/80 border border-white/10 rounded-2xl px-4">
                  <Mail size={17} className="text-zinc-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="w-full bg-transparent py-4 text-sm outline-none text-zinc-100 placeholder:text-zinc-700"
                    required
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">密码</span>
                <div className="flex items-center gap-3 bg-zinc-950/80 border border-white/10 rounded-2xl px-4">
                  <Lock size={17} className="text-zinc-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="至少 8 位"
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    minLength={8}
                    className="w-full bg-transparent py-4 text-sm outline-none text-zinc-100 placeholder:text-zinc-700"
                    required
                  />
                </div>
              </label>
            </div>

            {error && (
              <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-8 w-full h-14 bg-amber-500 text-zinc-950 rounded-2xl font-black text-sm shadow-xl shadow-amber-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-60 disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 size={17} className="animate-spin" />}
              {isRegister ? '创建并进入剧场' : '进入剧场'}
            </button>
          </motion.form>
        </div>
      </section>
    </main>
  );
};
