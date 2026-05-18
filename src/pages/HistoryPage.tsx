import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Calendar, User, ChevronRight, Clock } from 'lucide-react';
import { type Patient } from '@/types/medical';
import { supabase } from '@/integrations/supabase/client';

interface AppointmentRow {
  id: string;
  patient_id: string | null;
  patient_name: string;
  appointment_date: string;
  time_slot: string;
  status: string;
  chief_complaint: string | null;
  created_at: string;
}

interface Props {
  patients: Patient[];
  /** Kept for backward-compatibility with the parent (unused). */
  prescriptions?: unknown;
  onSelectPatient: (p: Patient) => void;
  onDeleteHistory?: (patientId: string) => void;
}

const STATUS_STYLES: Record<string, string> = {
  confirmed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  completed: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  cancelled: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  reschedule_requested: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
};

const HistoryPage: React.FC<Props> = ({ patients, onSelectPatient }) => {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState('');
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('appointments')
        .select('id, patient_id, patient_name, appointment_date, time_slot, status, chief_complaint, created_at')
        .order('appointment_date', { ascending: false })
        .order('time_slot', { ascending: false });
      if (!cancelled) {
        setAppointments((data as AppointmentRow[]) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return appointments;
    const q = search.toLowerCase();
    return appointments.filter(a => a.patient_name.toLowerCase().includes(q));
  }, [appointments, search]);

  const handleSelect = (apt: AppointmentRow) => {
    if (!apt.patient_id) return;
    const pat = patients.find(p => p.id === apt.patient_id);
    if (pat) onSelectPatient(pat);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 page-transition">
      <h1 className="text-xl font-display font-extrabold flex items-center gap-2">
        <Calendar size={20} /> {t('history.title')}
      </h1>

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('history.searchByName')} className="medical-input w-full pl-10" />
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground text-sm py-12">{t('history.loading')}</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground text-sm py-12">{t('history.none')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          {filtered.map(apt => {
            const statusClass = STATUS_STYLES[apt.status] || 'bg-muted text-muted-foreground';
            return (
              <button
                key={apt.id}
                onClick={() => handleSelect(apt)}
                disabled={!apt.patient_id}
                className="glass-card p-4 flex items-center gap-3.5 text-left btn-press disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User size={16} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-sm truncate">{apt.patient_name}</div>
                    <span className={`text-[10px] font-medium uppercase tracking-wide rounded-full px-2 py-0.5 ${statusClass}`}>
                      {t(`appointments.status.${apt.status}` as any, { defaultValue: apt.status.replace('_', ' ') })}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Clock size={11} />
                    {new Date(apt.appointment_date).toLocaleDateString(i18n.language?.startsWith('bn') ? 'bn-BD' : 'en-US')} · {apt.time_slot}
                  </div>
                  {apt.chief_complaint && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{apt.chief_complaint}</div>
                  )}
                </div>
                <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
