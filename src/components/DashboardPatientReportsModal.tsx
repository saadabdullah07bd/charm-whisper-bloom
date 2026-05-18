import React, { useMemo, useState } from 'react';
import { CalendarDays, Users } from 'lucide-react';
import { type Patient } from '@/types/medical';
import ModalShell from '@/components/ModalShell';

type ReportRange = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface Props {
  open: boolean;
  patients: Patient[];
  onClose: () => void;
}

const RANGE_LABELS: Record<ReportRange, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

const getRangeStart = (range: ReportRange, now: Date) => {
  const start = new Date(now);

  if (range === 'daily') {
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (range === 'weekly') {
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (range === 'monthly') {
    return new Date(start.getFullYear(), start.getMonth(), 1);
  }

  return new Date(start.getFullYear(), 0, 1);
};

const DashboardPatientReportsModal: React.FC<Props> = ({ open, patients, onClose }) => {
  const [range, setRange] = useState<ReportRange>('daily');
  const now = useMemo(() => new Date(), []);

  const summaryCounts = useMemo(() => {
    return (['daily', 'weekly', 'monthly', 'yearly'] as ReportRange[]).reduce<Record<ReportRange, number>>((acc, currentRange) => {
      const start = getRangeStart(currentRange, now).getTime();
      const end = now.getTime();
      acc[currentRange] = patients.filter(patient => {
        const createdAt = new Date(patient.createdAt).getTime();
        return createdAt >= start && createdAt <= end;
      }).length;
      return acc;
    }, { daily: 0, weekly: 0, monthly: 0, yearly: 0 });
  }, [now, patients]);

  const filteredPatients = useMemo(() => {
    const start = getRangeStart(range, now).getTime();
    const end = now.getTime();

    return patients
      .filter(patient => {
        const createdAt = new Date(patient.createdAt).getTime();
        return createdAt >= start && createdAt <= end;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [now, patients, range]);

  return (
    <ModalShell open={open} onClose={onClose} title="Patient Reports">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(Object.keys(RANGE_LABELS) as ReportRange[]).map(item => (
            <button
              key={item}
              type="button"
              onClick={() => setRange(item)}
              className={`rounded-xl border px-4 py-3 text-left transition-all btn-press ${
                range === item
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <div className="text-xs font-medium uppercase tracking-wide">{RANGE_LABELS[item]}</div>
              <div className="mt-1 text-2xl font-bold text-foreground">{summaryCounts[item]}</div>
              <div className="text-xs text-muted-foreground">patients added</div>
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-primary" />
              <h3 className="text-sm font-semibold">{RANGE_LABELS[range]} registrations</h3>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays size={14} /> {summaryCounts[range]} total
            </div>
          </div>

          {filteredPatients.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No patient registrations in this period.</p>
          ) : (
            <div className="divide-y divide-border">
              {filteredPatients.map(patient => (
                <div key={patient.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{patient.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {patient.age} years · {patient.gender}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground">
                    {new Date(patient.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
};

export default DashboardPatientReportsModal;