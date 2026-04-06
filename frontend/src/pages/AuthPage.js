import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { formatError } from '@/lib/api';
import { Lock, Eye, EyeOff, Shield } from 'lucide-react';

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  const [loginForm, setLoginForm] = useState({ identifier: '', password: '' });
  const [regForm, setRegForm] = useState({ username: '', email: '', password: '', display_name: '' });
  const [showPw, setShowPw] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(loginForm.identifier, loginForm.password);
    } catch (err) { setError(formatError(err)); }
    finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await register(regForm.username, regForm.email, regForm.password, regForm.display_name || undefined);
    } catch (err) { setError(formatError(err)); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex" data-testid="auth-page">
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0055FF]/10 to-transparent" />
        <div className="relative z-10 px-16 max-w-lg">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-sm bg-[#0055FF] flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h1 className="font-heading text-5xl font-light tracking-tight text-white">T.P</h1>
          </div>
          <p className="text-white/60 text-lg leading-relaxed font-body">
            <span className="text-white font-medium">Totally Private.</span> The social media platform where your conversations stay yours. End-to-end encrypted. No compromises.
          </p>
          <div className="mt-12 flex gap-8">
            <div><p className="text-3xl font-heading font-light text-white">E2E</p><p className="text-xs uppercase tracking-[0.2em] text-white/40 mt-1">Encrypted</p></div>
            <div><p className="text-3xl font-heading font-light text-white">0</p><p className="text-xs uppercase tracking-[0.2em] text-white/40 mt-1">Data Sold</p></div>
            <div><p className="text-3xl font-heading font-light text-white">100%</p><p className="text-xs uppercase tracking-[0.2em] text-white/40 mt-1">Private</p></div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-sm bg-[#0055FF] flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-heading text-3xl font-light text-white">T.P</h1>
          </div>

          <div className="flex gap-1 mb-8 bg-[#121212] rounded-sm p-1" data-testid="auth-tabs">
            <button onClick={() => { setMode('login'); setError(''); }} data-testid="login-tab"
              className={`flex-1 py-2.5 text-sm font-medium rounded-sm transition-all ${mode === 'login' ? 'bg-[#0055FF] text-white' : 'text-white/50 hover:text-white'}`}>
              Sign In
            </button>
            <button onClick={() => { setMode('register'); setError(''); }} data-testid="register-tab"
              className={`flex-1 py-2.5 text-sm font-medium rounded-sm transition-all ${mode === 'register' ? 'bg-[#0055FF] text-white' : 'text-white/50 hover:text-white'}`}>
              Create Account
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-sm text-red-400 text-sm" data-testid="auth-error">
              {error}
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4" data-testid="login-form">
              <div>
                <label className="text-xs uppercase tracking-[0.15em] text-white/40 mb-2 block">Username or Email</label>
                <input type="text" value={loginForm.identifier} data-testid="login-identifier-input"
                  onChange={e => setLoginForm(p => ({ ...p, identifier: e.target.value }))}
                  className="w-full bg-[#121212] border border-white/10 rounded-sm px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-[#0055FF] transition-colors"
                  placeholder="username or email" required />
              </div>
              <div className="relative">
                <label className="text-xs uppercase tracking-[0.15em] text-white/40 mb-2 block">Password</label>
                <input type={showPw ? 'text' : 'password'} value={loginForm.password} data-testid="login-password-input"
                  onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))}
                  className="w-full bg-[#121212] border border-white/10 rounded-sm px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-[#0055FF] transition-colors pr-12"
                  placeholder="password" required />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 bottom-3 text-white/30 hover:text-white/60">
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <button type="submit" disabled={loading} data-testid="login-submit-btn"
                className="w-full bg-[#0055FF] hover:bg-[#0044CC] text-white py-3 rounded-sm font-medium text-sm transition-all disabled:opacity-50 mt-2">
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
              <div className="flex items-center gap-2 justify-center mt-4 text-white/30 text-xs">
                <Lock size={12} /> <span>End-to-end encrypted platform</span>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4" data-testid="register-form">
              <div>
                <label className="text-xs uppercase tracking-[0.15em] text-white/40 mb-2 block">Username</label>
                <input type="text" value={regForm.username} data-testid="register-username-input"
                  onChange={e => setRegForm(p => ({ ...p, username: e.target.value }))}
                  className="w-full bg-[#121212] border border-white/10 rounded-sm px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-[#0055FF] transition-colors"
                  placeholder="choose a unique username" required />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.15em] text-white/40 mb-2 block">Display Name</label>
                <input type="text" value={regForm.display_name} data-testid="register-displayname-input"
                  onChange={e => setRegForm(p => ({ ...p, display_name: e.target.value }))}
                  className="w-full bg-[#121212] border border-white/10 rounded-sm px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-[#0055FF] transition-colors"
                  placeholder="how should we call you?" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.15em] text-white/40 mb-2 block">Email</label>
                <input type="email" value={regForm.email} data-testid="register-email-input"
                  onChange={e => setRegForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full bg-[#121212] border border-white/10 rounded-sm px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-[#0055FF] transition-colors"
                  placeholder="your@email.com" required />
              </div>
              <div className="relative">
                <label className="text-xs uppercase tracking-[0.15em] text-white/40 mb-2 block">Password</label>
                <input type={showPw ? 'text' : 'password'} value={regForm.password} data-testid="register-password-input"
                  onChange={e => setRegForm(p => ({ ...p, password: e.target.value }))}
                  className="w-full bg-[#121212] border border-white/10 rounded-sm px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-[#0055FF] transition-colors pr-12"
                  placeholder="min 6 characters" required />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 bottom-3 text-white/30 hover:text-white/60">
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <button type="submit" disabled={loading} data-testid="register-submit-btn"
                className="w-full bg-[#0055FF] hover:bg-[#0044CC] text-white py-3 rounded-sm font-medium text-sm transition-all disabled:opacity-50 mt-2">
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
              <div className="flex items-center gap-2 justify-center mt-4 text-white/30 text-xs">
                <Lock size={12} /> <span>Your data is encrypted from day one</span>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
