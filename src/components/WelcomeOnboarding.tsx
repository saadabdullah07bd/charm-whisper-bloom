import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sun, Moon, Monitor, Check, Globe } from 'lucide-react';
import { useThemeFull, type ThemeMode } from '@/lib/theme';
import { setWelcomeDone } from '@/lib/welcomePrefs';
import i18n, { LANG_STORAGE_KEY } from '@/lib/i18n';
import medhelpLogo from '@/assets/medhelp-logo.png';

interface Props {
  onDone: () => void;
}

const WelcomeOnboarding: React.FC<Props> = ({ onDone }) => {
  const { t } = useTranslation();
  const { mode, setMode } = useThemeFull();
  const [lang, setLang] = useState<'bn' | 'en'>((i18n.language?.startsWith('bn') ? 'bn' : i18n.language?.startsWith('en') ? 'en' : 'bn'));

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

  const handleContinue = () => {
    setWelcomeDone();
    onDone();
  };

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
                      <div className="text-base font-semibold">
                        {l === 'bn' ? 'বাংলা' : 'English'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {l === 'bn' ? 'Bangla' : 'English'}
                      </div>
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
