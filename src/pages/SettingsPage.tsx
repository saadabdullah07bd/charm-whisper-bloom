import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { type DoctorSettings, type Patient, type Prescription } from '@/types/medical';
import { Settings, User, Upload, Image as ImageIcon, Trash2, Palette, Sun, Moon, Monitor, Check, ChevronDown, LogOut, Globe, KeyRound } from 'lucide-react';
import { useThemeFull, type ThemeMode, type ThemeAccent, type ThemeGradient, type FontScale } from '@/lib/theme';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { LANG_STORAGE_KEY } from '@/lib/i18n';
import { useUserRole } from '@/hooks/useUserRole';

interface Props {
  settings: DoctorSettings;
  onSave: (s: DoctorSettings) => void;
  patients: Patient[];
  prescriptions: Prescription[];
}

interface ExtendedDoctorSettings extends DoctorSettings {
  letterheadUrl?: string;
}

const MODES: { id: ThemeMode; label: string; icon: typeof Sun; desc: string }[] = [
  { id: 'system', label: 'System', icon: Monitor, desc: 'Follow device' },
  { id: 'light', label: 'Light', icon: Sun, desc: 'Always light' },
  { id: 'dark', label: 'Dark', icon: Moon, desc: 'Always dark' },
];

const ACCENTS: { id: ThemeAccent; label: string; swatch: string }[] = [
  { id: 'slate', label: 'Slate', swatch: '#334155' },
  { id: 'blue', label: 'Blue', swatch: '#2563eb' },
  { id: 'emerald', label: 'Emerald', swatch: '#10b981' },
  { id: 'violet', label: 'Violet', swatch: '#7c3aed' },
  { id: 'rose', label: 'Rose', swatch: '#e11d48' },
];

const GRADIENTS: { id: ThemeGradient; label: string; preview: string }[] = [
  { id: 'aurora', label: 'Aurora', preview: 'linear-gradient(135deg, #c4b5fd, #a5b4fc, #f9a8d4)' },
  { id: 'sunset', label: 'Sunset', preview: 'linear-gradient(135deg, #fdba74, #fb7185, #fde68a)' },
  { id: 'ocean', label: 'Ocean', preview: 'linear-gradient(135deg, #93c5fd, #67e8f9, #a5b4fc)' },
  { id: 'lavender', label: 'Lavender', preview: 'linear-gradient(135deg, #d8b4fe, #c4b5fd, #f5d0fe)' },
  { id: 'peach', label: 'Peach', preview: 'linear-gradient(135deg, #fed7aa, #fda4af, #fef08a)' },
  { id: 'forest', label: 'Forest', preview: 'linear-gradient(135deg, #86efac, #a7f3d0, #bef264)' },
  { id: 'midnight', label: 'Midnight', preview: 'linear-gradient(135deg, #818cf8, #6366f1, #a78bfa)' },
  { id: 'none', label: 'None', preview: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)' },
];

const SCALES: { id: FontScale; label: string }[] = [
  { id: 'sm', label: 'Small' },
  { id: 'md', label: 'Default' },
  { id: 'lg', label: 'Large' },
];

const SettingsPage: React.FC<Props> = ({ settings, onSave }) => {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language?.startsWith('en') ? 'en' : 'bn') as 'bn' | 'en';
  const setLang = (l: 'bn' | 'en') => {
    i18n.changeLanguage(l);
    try { localStorage.setItem(LANG_STORAGE_KEY, l); } catch { /* ignore */ }
  };
  const [form, setForm] = useState<ExtendedDoctorSettings>({ ...settings });
  const [saved, setSaved] = useState(false);
  const [letterheadUrl, setLetterheadUrl] = useState<string | undefined>(undefined);
  const [uploadingLetterhead, setUploadingLetterhead] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const letterheadInputRef = useRef<HTMLInputElement>(null);
  const { role } = useUserRole();

  // FCM service-account JSON admin
  const [fcmJsonText, setFcmJsonText] = useState('');
  const [fcmSavedAt, setFcmSavedAt] = useState<string | null>(null);
  const [fcmProjectId, setFcmProjectId] = useState<string | null>(null);
  const [fcmSaving, setFcmSaving] = useState(false);

  const { mode, setMode, accent, setAccent, gradient, setGradient, fontScale, setFontScale } = useThemeFull();

  const set = (key: keyof ExtendedDoctorSettings, val: any) =>
    setForm((f) => ({ ...f, [key]: val }));

  // Fetch current letterhead_url
  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data } = await supabase
        .from('doctor_settings')
        .select('letterhead_url')
        .eq('user_id', userData.user.id)
        .maybeSingle();
      if (data?.letterhead_url) setLetterheadUrl(data.letterhead_url);
    })();
  }, []);

  // Load existing FCM JSON metadata (doctor only) — show project_id and last-updated,
  // but never display the private key. User pastes a new JSON to overwrite.
  useEffect(() => {
    if (role !== 'doctor') return;
    (async () => {
      const { data } = await supabase
        .from('app_secrets')
        .select('value, updated_at')
        .eq('key', 'FCM_SERVICE_ACCOUNT_JSON')
        .maybeSingle();
      if (data?.value) {
        try {
          const parsed = JSON.parse(data.value as string);
          setFcmProjectId(parsed.project_id ?? null);
        } catch { setFcmProjectId(null); }
        setFcmSavedAt(data.updated_at as string);
      }
    })();
  }, [role]);

  const handleSaveFcmJson = async () => {
    const text = fcmJsonText.trim();
    if (!text) { toast({ title: 'Paste the JSON first', variant: 'destructive' }); return; }
    let parsed: any;
    try { parsed = JSON.parse(text); }
    catch (e: any) {
      toast({ title: 'Invalid JSON', description: e?.message ?? 'Could not parse', variant: 'destructive' });
      return;
    }
    if (parsed.type !== 'service_account') {
      toast({
        title: 'Wrong file',
        description: `Got type="${parsed.type ?? '—'}". Use Firebase Console → Project Settings → Service accounts → Generate new private key.`,
        variant: 'destructive',
      });
      return;
    }
    const missing = ['project_id', 'client_email', 'private_key'].filter((k) => !parsed[k]);
    if (missing.length) {
      toast({ title: 'Missing fields', description: `JSON missing: ${missing.join(', ')}`, variant: 'destructive' });
      return;
    }
    setFcmSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('app_secrets')
      .upsert({
        key: 'FCM_SERVICE_ACCOUNT_JSON',
        value: text,
        updated_by: userData.user?.id ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });
    setFcmSaving(false);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }
    setFcmProjectId(parsed.project_id);
    setFcmSavedAt(new Date().toISOString());
    setFcmJsonText('');
    toast({ title: 'Saved', description: `FCM service account updated (project: ${parsed.project_id})` });
  };

  const handleSave = () => {
    onSave(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLetterheadUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 5 MB.', variant: 'destructive' });
      return;
    }
    setUploadingLetterhead(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not signed in');
      const ext = file.name.split('.').pop() || 'png';
      const path = `${userData.user.id}/letterhead.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('letterhead')
        .upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('letterhead').getPublicUrl(path);
      await supabase
        .from('doctor_settings')
        .update({ letterhead_url: pub.publicUrl })
        .eq('user_id', userData.user.id);
      setLetterheadUrl(pub.publicUrl);
      toast({ title: 'Letterhead saved' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingLetterhead(false);
      if (letterheadInputRef.current) letterheadInputRef.current.value = '';
    }
  };

  const removeLetterhead = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    await supabase
      .from('doctor_settings')
      .update({ letterhead_url: null })
      .eq('user_id', userData.user.id);
    setLetterheadUrl(undefined);
  };

  return (
    <div className="p-4 md:p-6 xl:p-8 space-y-5 page-transition">
      <h1 className="text-xl font-display font-bold flex items-center gap-2">
        <Settings size={20} /> {t('settings.title')}
      </h1>

      {/* Professional Information — single doctor, bilingual */}
      <div className="glass-card p-5 space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          <User size={14} /> Doctor Information
        </h2>
        <p className="text-xs text-muted-foreground -mt-2">
          Shown on the prescription header and patient portal.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Full Name (English)</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} className="medical-input w-full" placeholder="e.g., Dr. John Smith" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Full Name (বাংলা)</label>
            <input value={form.nameBn || ''} onChange={(e) => set('nameBn', e.target.value)} className="medical-input w-full" placeholder="e.g., ডা. জন স্মিথ" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Degrees (English)</label>
            <input value={form.degrees} onChange={(e) => set('degrees', e.target.value)} className="medical-input w-full" placeholder="e.g., MBBS, MD" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Degrees (বাংলা)</label>
            <input value={form.degreesBn || ''} onChange={(e) => set('degreesBn', e.target.value)} className="medical-input w-full" placeholder="e.g., এম.বি.বি.এস" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Specialization (English)</label>
            <input value={form.specialization || ''} onChange={(e) => set('specialization', e.target.value)} className="medical-input w-full" placeholder="e.g., Cardiology" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Specialization (বাংলা)</label>
            <input value={form.specializationBn || ''} onChange={(e) => set('specializationBn', e.target.value)} className="medical-input w-full" placeholder="e.g., হৃদরোগ বিশেষজ্ঞ" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Title</label>
            <input value={form.title || ''} onChange={(e) => set('title', e.target.value)} className="medical-input w-full" placeholder="e.g., Consultant" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Title (বাংলা)</label>
            <input value={form.titleBn || ''} onChange={(e) => set('titleBn', e.target.value)} className="medical-input w-full" placeholder="e.g., পরামর্শক" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Mobile</label>
            <input value={form.mobile} onChange={(e) => set('mobile', e.target.value)} className="medical-input w-full" placeholder="+880 1XXX XXXXXX" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
            <input value={form.email} onChange={(e) => set('email', e.target.value)} className="medical-input w-full" placeholder="doctor@email.com" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Website</label>
            <input value={form.website} onChange={(e) => set('website', e.target.value)} className="medical-input w-full" placeholder="https://..." />
          </div>
        </div>
      </div>

      {/* Language selector */}
      <div className="glass-card p-5 space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          <Globe size={14} /> {t('settings.language')}
        </h2>
        <p className="text-xs text-muted-foreground -mt-1">{t('settings.languageDesc')}</p>
        <div className="grid grid-cols-2 gap-3">
          {(['bn', 'en'] as const).map((l) => {
            const active = currentLang === l;
            return (
              <button key={l} onClick={() => setLang(l)}
                className={`flex items-center justify-between rounded-xl border p-3 text-left transition btn-press ${active ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-border/50 hover:border-foreground/30'}`}>
                <span className="text-sm font-semibold">
                  {l === 'bn' ? 'বাংলা' : 'English'}
                </span>
                {active && <Check size={14} className="text-primary" />}
              </button>
            );
          })}
        </div>
      </div>


      {/* Letterhead upload */}
      <div className="glass-card p-5 space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          <ImageIcon size={14} /> Prescription Letterhead
        </h2>
        <p className="text-xs text-muted-foreground -mt-1">
          A PNG/JPG image that prints at the top of every prescription PDF. Recommended width 2480 px (A4 @ 300 dpi).
        </p>
        {letterheadUrl ? (
          <div className="space-y-3">
            <div className="border border-border/50 rounded-xl p-4 bg-card/50 flex items-center justify-center">
              <img src={letterheadUrl} alt="Doctor prescription letterhead header" className="max-h-40 object-contain" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => letterheadInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-xl border border-border/50 hover:bg-foreground/5 btn-press">
                <Upload size={14} /> Replace
              </button>
              <button onClick={removeLetterhead} className="flex items-center justify-center gap-1.5 text-xs text-destructive font-medium py-2 px-4 rounded-xl border border-destructive/20 hover:bg-destructive/5 btn-press">
                <Trash2 size={14} /> Remove
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => letterheadInputRef.current?.click()} disabled={uploadingLetterhead} className="w-full border-2 border-dashed border-border/50 rounded-xl p-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-all duration-200 btn-press disabled:opacity-50">
            <Upload size={24} />
            <span className="text-sm font-medium">{uploadingLetterhead ? 'Uploading…' : 'Upload Letterhead'}</span>
            <span className="text-xs">PNG, JPG, PDF (max 5 MB)</span>
          </button>
        )}
        <input ref={letterheadInputRef} type="file" accept="image/png,image/jpeg,application/pdf" onChange={handleLetterheadUpload} className="hidden" />
      </div>

      {/* Appearance — collapsible, placed below Prescription Letterhead */}
      <div className="glass-card p-5">
        <button
          type="button"
          onClick={() => setAppearanceOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 text-left btn-press"
          aria-expanded={appearanceOpen}
        >
          <span className="flex items-center gap-2">
            <Palette size={16} />
            <span className="text-sm font-semibold">{t('settings.appearance')}</span>
          </span>
          <ChevronDown
            size={16}
            className={`text-muted-foreground transition-transform duration-200 ${appearanceOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {appearanceOpen && (
          <div className="space-y-6 mt-5 animate-in fade-in slide-in-from-top-1 duration-200">
            <p className="text-xs text-muted-foreground">
              Choose how the dashboard looks. Saved on this device.
            </p>

            <section className="space-y-3">
              <h3 className="text-xs font-medium text-muted-foreground">{t('settings.colorMode')}</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                {MODES.map((m) => {
                  const active = mode === m.id;
                  const Icon = m.icon;
                  return (
                    <button key={m.id} onClick={() => setMode(m.id)}
                      className={`group flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition btn-press ${active ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-border/50 hover:border-foreground/30'}`}>
                      <div className="flex w-full items-center justify-between">
                        <Icon size={18} />
                        {active && <Check size={14} className="text-primary" />}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{m.label}</div>
                        <div className="text-xs text-muted-foreground">{m.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-medium text-muted-foreground">{t('settings.accentColor')}</h3>
              <div className="flex flex-wrap gap-2">
                {ACCENTS.map((a) => {
                  const active = accent === a.id;
                  return (
                    <button key={a.id} onClick={() => setAccent(a.id)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition btn-press ${active ? 'border-primary ring-2 ring-primary/30' : 'border-border/50 hover:border-foreground/30'}`}>
                      <span className="h-4 w-4 rounded-full ring-1 ring-border" style={{ background: a.swatch }} />
                      {a.label}
                      {active && <Check size={12} className="text-primary" />}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-medium text-muted-foreground">{t('settings.backgroundGradient')}</h3>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                {GRADIENTS.map((g) => {
                  const active = gradient === g.id;
                  return (
                    <button key={g.id} onClick={() => setGradient(g.id)}
                      className={`relative overflow-hidden rounded-xl border p-2 text-left transition btn-press ${active ? 'border-primary ring-2 ring-primary/30' : 'border-border/50 hover:border-foreground/30'}`}>
                      <div className="h-12 w-full rounded-md ring-1 ring-border" style={{ background: g.preview }} />
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs font-medium">{g.label}</span>
                        {active && <Check size={12} className="text-primary" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-medium text-muted-foreground">{t('settings.textSize')}</h3>
              <div className="inline-flex rounded-lg border border-border/50 p-1">
                {SCALES.map((s) => (
                  <button key={s.id} onClick={() => setFontScale(s.id)}
                    className={`rounded-md px-3 py-1.5 text-sm transition btn-press ${fontScale === s.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      <button
        onClick={handleSave}
        className={`w-full rounded-xl py-3 font-medium text-sm transition-all duration-200 btn-press ${
          saved ? 'bg-medical-success text-white' : 'bg-primary text-primary-foreground hover:opacity-90'
        }`}
      >
        {saved ? t('settings.settingsSaved') : t('settings.saveSettings')}
      </button>


      {/* Account section — Sign out at the very bottom */}
      <div className="glass-card p-5 space-y-3 mt-2">
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          <LogOut size={14} /> {t('settings.account')}
        </h2>
        <p className="text-xs text-muted-foreground -mt-1">
          {t('settings.signOutDesc')}
        </p>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
          }}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-medium text-sm text-destructive border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 transition-all btn-press"
        >
          <LogOut size={16} /> {t('common.signOut')}
        </button>
      </div>


      <p className="text-center text-[11px] text-muted-foreground pt-3">Shifora · API v1.0.0</p>
    </div>
  );
};

export default SettingsPage;
