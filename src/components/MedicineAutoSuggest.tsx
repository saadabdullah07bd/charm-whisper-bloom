import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MEDICINE_DATABASE } from '@/data/medicineDatabase';
import { type Medicine, DOSAGE_OPTIONS, FREQUENCY_OPTIONS, DURATION_OPTIONS } from '@/types/medical';

interface Props {
  onAdd: (medicine: Medicine) => void;
}

const MedicineAutoSuggest: React.FC<Props> = ({ onAdd }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<typeof MEDICINE_DATABASE>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const search = useCallback((q: string) => {
    if (!q.trim()) { setSuggestions([]); setShowSuggestions(false); return; }
    const lower = q.toLowerCase();
    const results = MEDICINE_DATABASE.filter(
      m => m.name.toLowerCase().includes(lower) || m.genericName.toLowerCase().includes(lower)
    ).slice(0, 8);
    setSuggestions(results);
    setActiveIndex(0);
    setShowSuggestions(results.length > 0);
  }, []);

  useEffect(() => { search(query); }, [query, search]);

  // One-click: selecting a medicine immediately adds it with defaults
  const selectAndAdd = (med: typeof MEDICINE_DATABASE[0]) => {
    onAdd({
      name: med.name,
      genericName: med.genericName,
      type: med.type,
      dosage: DOSAGE_OPTIONS[2], // 1+0+1
      frequency: FREQUENCY_OPTIONS[1], // After meal
      duration: DURATION_OPTIONS[2], // 7 days
    });
    setQuery('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) {
      // If Enter pressed with custom text (no suggestion), add as custom medicine
      if (e.key === 'Enter' && query.trim()) {
        e.preventDefault();
        onAdd({
          name: query.trim(),
          dosage: DOSAGE_OPTIONS[2],
          frequency: FREQUENCY_OPTIONS[1],
          duration: DURATION_OPTIONS[2],
        });
        setQuery('');
        return;
      }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault();
      if (suggestions[activeIndex]) selectAndAdd(suggestions[activeIndex]);
    }
    else if (e.key === 'Escape') setShowSuggestions(false);
  };

  useEffect(() => {
    if (suggestionsRef.current) {
      const active = suggestionsRef.current.children[activeIndex] as HTMLElement;
      active?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  return (
    <div className="relative">
      <label className="block text-xs font-medium text-muted-foreground mb-1">Medicine Name — click to add instantly</label>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => query && search(query)}
        placeholder="Type medicine name... (click suggestion to add)"
        className="medical-input w-full"
        autoComplete="off"
      />
      {showSuggestions && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border rounded-lg shadow-lg max-h-48 overflow-y-auto"
        >
          {suggestions.map((med, i) => (
            <div
              key={med.name + med.genericName}
              className={`suggestion-item ${i === activeIndex ? 'suggestion-item-active' : 'hover:bg-muted'}`}
              onMouseDown={() => selectAndAdd(med)}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <div className="font-medium flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{med.type}</span>
                {med.name}
              </div>
              <div className="text-xs text-muted-foreground">{med.genericName}</div>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground mt-1">Press Enter to add custom medicine. Click suggestion for one-click add with defaults (1+0+1, After meal, 7 days).</p>
    </div>
  );
};

export default MedicineAutoSuggest;
