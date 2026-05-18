import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, FileText, Activity, TrendingUp, Calendar, Plus, ChevronRight, Stethoscope, FlaskConical, ClipboardCheck } from 'lucide-react';
import { type Patient, type Prescription, type Visit, VISIT_STAGE_LABELS, VISIT_STAGE_COLORS } from '@/types/medical';
import PatientForm from '@/components/PatientForm';
import DashboardPatientReportsModal from '@/components/DashboardPatientReportsModal';
import { supabase } from '@/integrations/supabase/client';
import { requestNotificationPermission, showBrowserNotification } from '@/lib/notifications';

interface Props {
  patients: Patient[];
  prescriptions: Prescription[];
  visits: Visit[];
  onSavePatient: (p: Patient) => void;
  onSelectPatient: (p: Patient) => void;
}

const DashboardPage: React.FC<Props> = ({ patients, prescriptions, visits, onSavePatient, onSelectPatient }) => {
  const { t, i18n } = useTranslation();
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [showPatientReports, setShowPatientReports] = useState(false);
  const [pendingAppointments, setPendingAppointments] = useState(0);

  useEffect(() => {
    requestNotificationPermission();
    const fetchPending = async () => {
      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .gte('appointment_date', today);
      setPendingAppointments(count || 0);
    };
    fetchPending();
    const channel = supabase
      .channel('appointments-badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'appointments' }, (payload) => {
        const name = (payload.new as any)?.patient_name || (i18n.language?.startsWith('bn') ? 'একজন রোগী' : 'A patient');
        showBrowserNotification(t('dashboard.newAppointmentRequest'), t('dashboard.requestedAppointment', { name }));
        fetchPending();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'appointments' }, () => { fetchPending(); })
      .subscribe();

    // Listen for new report uploads
    const reportsChannel = supabase
      .channel('reports-notify')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'patient_reports' }, (payload) => {
        const fileName = (payload.new as any)?.file_name || (i18n.language?.startsWith('bn') ? 'একটি রিপোর্ট' : 'a report');
        showBrowserNotification(t('dashboard.newReportUploaded'), t('dashboard.patientUploaded', { file: fileName }));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); supabase.removeChannel(reportsChannel); };
  }, [t, i18n.language]);

  const today = new Date().toDateString();
  const todayPrescriptions = prescriptions.filter(rx => new Date(rx.createdAt).toDateString() === today);
  const todayPatientIds = new Set(todayPrescriptions.map(rx => rx.patientId));

  // Also count today's visits
  const todayVisits = visits.filter(v => new Date(v.createdAt).toDateString() === today);
  todayVisits.forEach(v => todayPatientIds.add(v.patientId));

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekPrescriptions = prescriptions.filter(rx => new Date(rx.createdAt).getTime() > weekAgo);

  // Pending investigations
  const pendingInvestigations = visits.filter(v => v.stage === 'investigation');

  const diagCounts: Record<string, number> = {};
  prescriptions.forEach(rx => {
    diagCounts[rx.diagnosis] = (diagCounts[rx.diagnosis] || 0) + 1;
  });
  const topDiagnoses = Object.entries(diagCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const medCounts: Record<string, number> = {};
  prescriptions.forEach(rx => {
    rx.medicines.forEach(m => {
      medCounts[m.name] = (medCounts[m.name] || 0) + 1;
    });
  });
  const topMedicines = Object.entries(medCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const todayPatients = patients.filter(p => todayPatientIds.has(p.id));

  const stats = [
    { label: t('dashboard.todaysPatients'), value: todayPatientIds.size, icon: Users },
    { label: t('dashboard.todaysRx'), value: todayPrescriptions.length, icon: FileText },
    { label: t('dashboard.totalPatients'), value: patients.length, icon: Activity, onClick: () => setShowPatientReports(true) },
    { label: t('dashboard.newAppointments'), value: pendingAppointments, icon: Calendar },
    { label: t('dashboard.pending'), value: pendingInvestigations.length, icon: FlaskConical },
  ];

  if (showAddPatient) {
    return (
      <div className="p-4 md:p-6 xl:p-8 page-transition">
        <PatientForm onSave={p => { onSavePatient(p); setShowAddPatient(false); onSelectPatient(p); }} onCancel={() => setShowAddPatient(false)} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 xl:p-8 space-y-5 page-transition">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium" style={{ fontFamily: "'Poppins', sans-serif" }}>{t('dashboard.title')}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            <Calendar size={11} className="inline mr-1" />
            {new Date().toLocaleDateString(i18n.language?.startsWith('bn') ? 'bn-BD' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      <button onClick={() => setShowAddPatient(true)}
        className="w-full glass-card p-4 flex items-center gap-3 text-left hover:shadow-md transition-all duration-200 btn-press">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
          <Plus size={20} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">{t('dashboard.addNewPatient')}</p>
          <p className="text-xs text-muted-foreground">{t('dashboard.registerQuickly')}</p>
        </div>
        <ChevronRight size={16} className="text-muted-foreground" />
      </button>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(s => (
          s.onClick ? (
            <button key={s.label} type="button" onClick={s.onClick} className="glass-card p-4 text-left hover:shadow-md btn-press">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <s.icon size={15} />
                </div>
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-2xl font-extrabold">{s.value}</p>
            </button>
          ) : (
            <div key={s.label} className="glass-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <s.icon size={15} />
                </div>
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-2xl font-extrabold">{s.value}</p>
            </div>
          )
        ))}
      </div>

      {/* Pending Investigations */}
      {pendingInvestigations.length > 0 && (
        <div className="glass-card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <FlaskConical size={14} /> {t('dashboard.pendingInvestigations')}
          </h2>
          <div className="space-y-2">
            {pendingInvestigations.slice(0, 5).map(v => {
              const pat = patients.find(p => p.id === v.patientId);
              if (!pat) return null;
              return (
                <button key={v.id} onClick={() => onSelectPatient(pat)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-all duration-200 btn-press text-left">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <FlaskConical size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block">{pat.name}</span>
                    <span className="text-xs text-muted-foreground">{v.investigations?.split('\n')[0] || t('dashboard.pending')}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(v.date).toLocaleDateString()}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          {todayPatients.length > 0 && (
            <div className="glass-card p-4">
              <h2 className="text-sm font-semibold mb-3">{t('dashboard.todaysPatients')}</h2>
              <div className="space-y-2">
                {todayPatients.map(p => (
                  <button key={p.id} onClick={() => onSelectPatient(p)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-all duration-200 btn-press text-left">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-xs font-bold">{p.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{p.age}y · {p.gender}</span>
                    </div>
                    <ChevronRight size={14} className="text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="glass-card p-4">
            <h2 className="text-sm font-semibold mb-3">{t('dashboard.commonDiagnoses')}</h2>
            {topDiagnoses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t('dashboard.noData')}</p>
            ) : (
              <div className="space-y-2">
                {topDiagnoses.map(([diag, count]) => (
                  <div key={diag} className="flex items-center justify-between">
                    <span className="text-sm truncate flex-1 mr-2">{diag}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 rounded-full bg-muted w-20">
                        <div className="h-full rounded-full bg-foreground transition-all duration-500"
                          style={{ width: `${(count / (topDiagnoses[0]?.[1] || 1)) * 100}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground w-6 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass-card p-4 h-full">
            <h2 className="text-sm font-semibold mb-3">{t('dashboard.mostPrescribed')}</h2>
            {topMedicines.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t('dashboard.noPrescriptionsYet')}</p>
            ) : (
              <div className="space-y-2">
                {topMedicines.map(([med, count]) => (
                  <div key={med} className="flex items-center justify-between">
                    <span className="text-sm truncate flex-1 mr-2">{med}</span>
                    <span className="text-xs glass-card px-2 py-0.5">{count}×</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <DashboardPatientReportsModal open={showPatientReports} onClose={() => setShowPatientReports(false)} patients={patients} />
    </div>
  );
};

export default DashboardPage;
