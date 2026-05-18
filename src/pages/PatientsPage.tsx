import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Plus, User, ChevronRight, Filter } from 'lucide-react';
import { type Patient, type Visit, type VisitStage, VISIT_STAGE_LABELS, VISIT_STAGE_COLORS } from '@/types/medical';
import PatientForm from '@/components/PatientForm';

interface Props {
  patients: Patient[];
  visits: Visit[];
  onSave: (p: Patient) => void;
  onSelect: (p: Patient) => void;
  onFilterByStage?: (stage: string) => void;
}

const PatientsPage: React.FC<Props> = ({ patients, visits, onSave, onSelect, onFilterByStage }) => {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [stageFilter, setStageFilter] = useState<string>('all');

  // Get latest visit stage for each patient
  const patientStages = useMemo(() => {
    const map: Record<string, VisitStage> = {};
    visits.forEach(v => {
      if (!map[v.patientId] || new Date(v.createdAt) > new Date(visits.find(x => x.patientId === v.patientId && map[v.patientId] === x.stage)?.createdAt || 0)) {
        map[v.patientId] = v.stage;
      }
    });
    return map;
  }, [visits]);

  const filtered = useMemo(() => {
    let list = [...patients].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    if (stageFilter !== 'all') {
      list = list.filter(p => patientStages[p.id] === stageFilter);
    }
    return list;
  }, [patients, search, stageFilter, patientStages]);

  if (showForm) {
    return (
      <div className="p-4 page-transition">
        <PatientForm onSave={(p) => { onSave(p); setShowForm(false); onSelect(p); }} onCancel={() => setShowForm(false)} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 xl:p-8 space-y-4 page-transition">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-display font-bold">{t('patients.title')}</h1>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition-all duration-300 btn-press">
          <Plus size={16} /> {t('patients.new')}
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={t('patients.searchPlaceholder')} className="medical-input w-full pl-10" />
      </div>

      {/* Stage Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter size={14} className="text-muted-foreground flex-shrink-0" />
        {['all', 'initial', 'investigation', 'final'].map(stage => (
          <button
            key={stage}
            onClick={() => setStageFilter(stage)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 btn-press ${
              stageFilter === stage
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {stage === 'all' ? t('patients.all') : VISIT_STAGE_LABELS[stage as VisitStage]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        {filtered.length === 0 &&
          <div className="text-center py-12 text-muted-foreground lg:col-span-2">
            <User size={40} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">{patients.length === 0 ? t('patients.noneYet') : t('patients.noneMatching')}</p>
          </div>
        }
        {filtered.map((p) => {
          const latestStage = patientStages[p.id];
          return (
            <button key={p.id} onClick={() => onSelect(p)}
              className="w-full glass-card p-4 flex items-center gap-3.5 text-left hover:shadow-md transition-all duration-200 btn-press">
              <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {p.avatarUrl ? (
                  <img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-primary">{p.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  {p.age}y · {p.gender === 'male' ? 'M' : p.gender === 'female' ? 'F' : 'O'}
                  {p.occupation && ` · ${p.occupation}`}
                </div>
              </div>
              <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                {latestStage && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${VISIT_STAGE_COLORS[latestStage]}`}>
                    {VISIT_STAGE_LABELS[latestStage]}
                  </span>
                )}
                <div className="text-[10px] text-muted-foreground">{new Date(p.createdAt).toLocaleDateString(i18n.language?.startsWith('bn') ? 'bn-BD' : 'en-US')}</div>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PatientsPage;
