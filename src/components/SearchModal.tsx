import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, User, ArrowRight } from 'lucide-react';
import { type Patient } from '@/types/medical';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  onSelect: (patient: Patient) => void;
}

const SearchModal: React.FC<Props> = ({ isOpen, onClose, patients, onSelect }) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = query.length >= 1
    ? patients.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        (p.phone && p.phone.includes(query))
      ).slice(0, 8)
    : [];

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && results[activeIndex]) { onSelect(results[activeIndex]); onClose(); }
    else if (e.key === 'Escape') onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] px-4">
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-card border rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
        <div className="p-4 border-b flex items-center gap-3">
          <Search size={16} className="text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('search.placeholder')}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          <button onClick={onClose} aria-label={t('search.closeAria')} className="text-muted-foreground hover:text-foreground p-1">
            <X size={16} />
          </button>
        </div>

        {results.length > 0 && (
          <div className="max-h-64 overflow-y-auto p-2">
            {results.map((p, i) => (
              <button
                key={p.id}
                onClick={() => { onSelect(p); onClose(); }}
                onMouseEnter={() => setActiveIndex(i)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  i === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User size={14} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.age}y · {p.gender}{p.phone ? ` · ${p.phone}` : ''}</div>
                </div>
                <ArrowRight size={14} className="text-muted-foreground flex-shrink-0" />
              </button>
            ))}
          </div>
        )}

        {query.length >= 1 && results.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">{t('search.noPatients')}</div>
        )}

        <div className="px-4 py-2 border-t text-[10px] text-muted-foreground flex items-center gap-3">
          <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">↑↓</kbd> {t('search.navigate')}</span>
          <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Enter</kbd> {t('search.select')}</span>
          <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Esc</kbd> {t('search.close')}</span>
        </div>
      </div>
    </div>
  );
};

export default SearchModal;
