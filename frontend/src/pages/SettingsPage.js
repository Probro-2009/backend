import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import api, { compressImage } from '@/lib/api';
import { Sun, Moon, Shield, Lock, User, Camera } from 'lucide-react';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [form, setForm] = useState({
    display_name: user?.display_name || '',
    bio: user?.bio || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/users/profile', form);
      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    finally { setSaving(false); }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file, 400, 0.8);
    try {
      await api.put('/users/profile', { avatar_url: compressed });
      await refreshUser();
    } catch {}
  };

  return (
    <div className="max-w-2xl mx-auto p-6 lg:p-8" data-testid="settings-page">
      <h1 className="font-heading text-2xl font-medium text-foreground mb-8">Settings</h1>

      <section className="mb-8">
        <h3 className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-bold mb-4 flex items-center gap-2">
          <Sun size={14} /> Appearance
        </h3>
        <div className="bg-surface border border-border rounded-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Theme</p>
              <p className="text-xs text-muted-foreground mt-0.5">Choose between dark and light mode</p>
            </div>
            <button onClick={toggleTheme} data-testid="settings-theme-toggle"
              className="flex items-center gap-2 px-4 py-2 bg-surface-elevated border border-border rounded-sm text-sm text-foreground hover:bg-muted transition-all">
              {theme === 'dark' ? <><Sun size={16} /> Light</> : <><Moon size={16} /> Dark</>}
            </button>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-bold mb-4 flex items-center gap-2">
          <User size={14} /> Profile
        </h3>
        <div className="bg-surface border border-border rounded-md p-4 space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-surface-elevated">
                {user?.avatar_url ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" /> :
                  <div className="w-full h-full flex items-center justify-center text-xl font-medium text-foreground">
                    {user?.username?.[0]?.toUpperCase()}
                  </div>}
              </div>
              <label className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#0055FF] rounded-full flex items-center justify-center cursor-pointer hover:bg-[#0044CC] transition-colors">
                <Camera size={14} className="text-white" />
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} data-testid="avatar-upload" />
              </label>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">@{user?.username}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.15em] text-muted-foreground block mb-2">Display Name</label>
            <input value={form.display_name} onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))}
              data-testid="settings-display-name"
              className="w-full bg-background border border-border rounded-sm px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#0055FF] transition-colors" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.15em] text-muted-foreground block mb-2">Bio</label>
            <textarea value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} rows={3}
              data-testid="settings-bio"
              className="w-full bg-background border border-border rounded-sm px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#0055FF] transition-colors resize-none" />
          </div>
          <button onClick={handleSave} disabled={saving} data-testid="settings-save-btn"
            className="px-6 py-2.5 bg-[#0055FF] hover:bg-[#0044CC] text-white text-sm font-medium rounded-sm transition-all disabled:opacity-50">
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </section>

      <section>
        <h3 className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-bold mb-4 flex items-center gap-2">
          <Shield size={14} /> Security & Privacy
        </h3>
        <div className="bg-surface border border-border rounded-md p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Lock size={16} className="text-[#0055FF] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">End-to-End Encryption</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                All your direct messages are encrypted before they leave your device. Only you and the recipient can read them.
                T.P servers never see the plain text content of your messages.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Shield size={16} className="text-[#0055FF] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Privacy First</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                We don't sell your data. We don't track your behavior. Your privacy is our mission, not a marketing slogan.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
