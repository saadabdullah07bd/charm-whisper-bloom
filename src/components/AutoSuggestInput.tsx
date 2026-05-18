import React, { useState, useRef, useEffect, useCallback } from 'react';

interface Props {
  label: string;
  placeholder: string;
  suggestions: string[];
  value: string;
  onChange: (val: string) => void;
  multiLine?: boolean;
}

const AutoSuggestInput: React.FC<Props> = ({ label, placeholder, suggestions, value, onChange, multiLine }) => {
  const [filtered, setFiltered] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [show, setShow] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Get the current "active segment" for searching
  const getCurrentQuery = useCallback((text: string): string => {
    if (multiLine) {
      const lines = text.split('\n');
      return lines[lines.length - 1].trim();
    }
    // For single-line with comma separation, get text after last comma
    const parts = text.split(',');
    return parts[parts.length - 1].trim();
  }, [multiLine]);

  const search = useCallback((q: string) => {
    if (!q.trim()) { setFiltered([]); setShow(false); return; }
    const lower = q.toLowerCase();
    // Exclude already-added items
    const existingItems = multiLine
      ? value.split('\n').map(l => l.trim().toLowerCase()).filter(Boolean)
      : value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const results = suggestions.filter(s =>
      s.toLowerCase().includes(lower) && !existingItems.includes(s.toLowerCase())
    ).slice(0, 8);
    setFiltered(results);
    setActiveIndex(0);
    setShow(results.length > 0);
  }, [suggestions, value, multiLine]);

  const handleChange = (text: string) => {
    onChange(text);
    const q = getCurrentQuery(text);
    search(q);
  };

  const selectItem = (item: string) => {
    if (multiLine) {
      const lines = value.split('\n');
      lines[lines.length - 1] = item;
      // Add empty line for next entry
      onChange(lines.join('\n') + '\n');
    } else {
      // Replace the last comma-segment with selected item
      const parts = value.split(',').map(s => s.trim()).filter(Boolean);
      // Remove the partial query (last part)
      if (parts.length > 0) {
        parts[parts.length - 1] = item;
      } else {
        parts.push(item);
      }
      onChange(parts.join(', ') + ', ');
    }
    setShow(false);
    // Re-focus for next entry
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!show) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Tab' || e.key === 'Enter') {
      if (filtered[activeIndex]) { e.preventDefault(); selectItem(filtered[activeIndex]); }
    }
    else if (e.key === 'Escape') setShow(false);
  };

  useEffect(() => {
    if (listRef.current) {
      const active = listRef.current.children[activeIndex] as HTMLElement;
      active?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const InputEl = multiLine ? 'textarea' : 'input';

  return (
    <div className="relative">
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <InputEl
        ref={inputRef as any}
        value={value}
        onChange={e => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          const q = getCurrentQuery(value);
          if (q) search(q);
        }}
        onBlur={() => setTimeout(() => setShow(false), 150)}
        placeholder={placeholder}
        className={`medical-input w-full ${multiLine ? 'min-h-[60px] resize-none' : ''}`}
        autoComplete="off"
      />
      {show && (
        <div
          ref={listRef}
          className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border rounded-lg shadow-lg max-h-48 overflow-y-auto"
        >
          {filtered.map((item, i) => (
            <div
              key={item}
              className={`suggestion-item ${i === activeIndex ? 'suggestion-item-active' : 'hover:bg-muted'}`}
              onMouseDown={() => selectItem(item)}
              onMouseEnter={() => setActiveIndex(i)}
            >
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AutoSuggestInput;
