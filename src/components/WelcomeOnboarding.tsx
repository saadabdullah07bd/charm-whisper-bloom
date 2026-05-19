import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sun, Moon, Monitor, Check, Globe, Type, BookOpen, ChevronRight } from 'lucide-react';
import { useThemeFull, type ThemeMode, type FontScale } from '@/lib/theme';
import { setWelcomeDone } from '@/lib/welcomePrefs';
import i18n, { LANG_STORAGE_KEY } from '@/lib/i18n';
import medhelpLogo from '@/assets/medhelp-logo.png';
import PatientUserManual from '@/components/PatientUserManual';

interface Props {
  onDone: () => void;
}

const WelcomeOnboarding: React.FC<Props> = ({ onDone }) => {
  const { t } = useTranslation();
  const { mode, setMode, fontScale, setFontScale } = useThemeFull();
  const [lang, setLang] = useState<'bn' | 'en'>((i18n.language?.startsWith('bn') ? 'bn' : i18n.language?.startsWith('en') ? 'en' : 'bn'));
  const [showManual, setShowManual] = useState(false);

  const pickLang = (l: 'bn' | 'en') => {
    setLang(l);
    i18n.changeLanguage(l);
    try { localStorage.setItem(LANG_STORAGE_KEY, l); } catch { /* ignore */ }
  };

  const themes: { id: ThemeMode; label: string; Icon: typeof Sun }[] = [
    { id: 'light', label: t('welcome.light'), Icon: Sun },
    { id: 'dark', label: t('welcome.dark'), Icon: Moon },
    { id: 'system', label: t('welcome.system'), Icon: Monitor },
  ];

  const scales: { id: FontScale; label: string; sample: string }[] = [
    { id: 'sm', label: lang === 'bn' ? 'ছোট' : 'Small', sample: 'A' },
    { id: 'md', label: lang === 'bn' ? 'মাঝারি' : 'Default', sample: 'A' },
    { id: 'lg', label: lang === 'bn' ? 'বড়' : 'Large', sample: 'A' },
  ];

  const handleContinue = () => {
    setWelcomeDone();
    onDone();
  };

  if (showManual) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <div className="sticky top-0 z-10 backdrop-blur bg-background/80 border-b border-border/30 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setShowManual(false)} className="text-sm text-primary font-medium">
            ← {lang === 'bn' ? 'ফিরে যান' : 'Back'}
          </button>
        </div>
        <PatientUserManual />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-lg glass-card p-6 md:p-8 space-y-7 rounded-3xl">
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-full overflow-hidden flex items-center justify-center bg-background shadow-md">
            <img src={medhelpLogo} alt="MedHelp" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">{t('welcome.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('welcome.subtitle')}</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Globe size={16} /> {t('welcome.chooseLanguage')}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {(['bn', 'en'] as const).map((l) => {
              const active = lang === l;
              return (
                <button key={l} onClick={() => pickLang(l)}
                  className={`relative rounded-xl border p-4 text-left transition btn-press ${active ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-border/50 hover:border-foreground/30'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-base font-semibold">{l === 'bn' ? 'বাংলা' : 'English'}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{l === 'bn' ? 'Bangla' : 'English'}</div>
                    </div>
                    {active && <Check size={16} className="text-primary" />}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">{t('welcome.chooseTheme')}</h2>
          <div className="grid grid-cols-3 gap-3">
            {themes.map(({ id, label, Icon }) => {
              const active = mode === id;
              return (
                <button key={id} onClick={() => setMode(id)}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition btn-press ${active ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-border/50 hover:border-foreground/30'}`}>
                  <Icon size={20} />
                  <span className="text-xs font-medium">{label}</span>
                  {active && <Check size={12} className="text-primary" />}
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Type size={16} /> {lang === 'bn' ? 'লেখার আকার' : 'Text size'}
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {scales.map((s) => {
              const active = fontScale === s.id;
              const fontSize = s.id === 'sm' ? '14px' : s.id === 'lg' ? '22px' : '18px';
              return (
                <button key={s.id} onClick={() => setFontScale(s.id)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border p-4 transition btn-press ${active ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-border/50 hover:border-foreground/30'}`}>
                  <span className="font-bold" style={{ fontSize }}>{s.sample}</span>
                  <span className="text-xs font-medium">{s.label}</span>
                  {active && <Check size={12} className="text-primary" />}
                </button>
              );
            })}
          </div>
        </section>

        {/* User Manual card */}
        <button
          onClick={() => setShowManual(true)}
          className="w-full flex items-center justify-between gap-3 rounded-xl border border-border/50 p-4 text-left transition btn-press hover:border-primary/40 hover:bg-primary/5"
        >
          <span className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <BookOpen size={18} />
            </span>
            <span>
              <span className="block text-sm font-semibold">{lang === 'bn' ? 'ব্যবহার নির্দেশিকা' : 'User Manual'}</span>
              <span className="block text-xs text-muted-foreground">{lang === 'bn' ? 'অ্যাপ কীভাবে ব্যবহার করবেন জেনে নিন' : 'Learn how to use the app'}</span>
            </span>
          </span>
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>

        <button
          onClick={handleContinue}
          className="w-full rounded-xl py-3 font-medium text-sm bg-primary text-primary-foreground hover:opacity-90 transition-all btn-press">
          {t('welcome.continue')}
        </button>
      </div>
    </div>
  );
};

export default WelcomeOnboarding;
