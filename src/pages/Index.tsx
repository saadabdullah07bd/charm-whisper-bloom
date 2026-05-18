import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Users, Clock, Settings, Search, LayoutDashboard, Sun, Moon, Monitor, LogOut, Calendar } from 'lucide-react';
import { requestNotificationPermission } from '@/lib/notifications';
import { setPageMeta } from '@/lib/pageMeta';

import { type Patient, type Prescription, type Visit, type DoctorSettings } from '@/types/medical';
import { usePatients, usePrescriptions, useVisits, useDoctorSettings } from '@/hooks/useSupabaseStorage';
import { useTheme, useColorScheme } from '@/hooks/useTheme';
import DashboardPage from './DashboardPage';
import PatientsPage from './PatientsPage';
import PatientProfilePage from './PatientProfilePage';
import HistoryPage from './HistoryPage';
import SettingsPage from './SettingsPage';
import SearchModal from '@/components/SearchModal';
import AppointmentsTab from '@/components/AppointmentsTab';
import MobileBottomTabs from '@/components/MobileBottomTabs';

type Tab = 'dashboard' | 'patients' | 'history' | 'appointments' | 'settings';

const DEFAULT_SETTINGS: DoctorSettings = {
  name: '', degrees: '', mobile: '', email: '', website: '', chambers: []
};

const Index: React.FC = () => {
  const { t } = useTranslation();
  const signOut = async () => { await (await import('@/integrations/supabase/client')).supabase.auth.signOut(); window.location.reload(); };
  const navigate = useNavigate();
  const params = useParams<{ tab?: string }>();
  const VALID_TABS: Tab[] = ['dashboard', 'patients', 'appointments', 'history', 'settings'];
  const tab: Tab = (VALID_TABS.includes(params.tab as Tab) ? (params.tab as Tab) : 'dashboard');
  const setTab = (t: Tab) => {
    if (t === 'dashboard') navigate('/dashboard');
    else navigate(`/dashboard/${t}`);
  };
  const { data: patients, save: savePatient, remove: removePatientFromDb } = usePatients();
  const { data: prescriptions, save: savePrescription, remove: removePrescriptionFromDb, removeByPatient } = usePrescriptions();
  const { data: visits, save: saveVisit, remove: removeVisit, removeByPatient: removeVisitsByPatient } = useVisits();
  const { data: doctorSettings, save: saveDoctorSettings } = useDoctorSettings(DEFAULT_SETTINGS);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [theme, setTheme] = useTheme();
  const [stageFilter, setStageFilter] = useState<string>('');

  useEffect(() => {
    const labels: Record<string, { title: string; desc: string; path: string }> = {
      dashboard:    { title: 'Dashboard | MedHelp — Doctor Console',           desc: 'Daily patient queue, visits and appointment overview for clinicians.', path: '/' },
      patients:     { title: 'Patients | MedHelp — Doctor Console',            desc: 'Search, review and manage your patient roster.',                       path: '/' },
      history:      { title: 'Visit History | MedHelp — Doctor Console',       desc: 'Review past visits, diagnoses and prescriptions across patients.',    path: '/' },
      appointments: { title: 'Appointments | MedHelp — Doctor Console',        desc: 'Manage upcoming and past patient appointments.',                       path: '/' },
      settings:     { title: 'Settings | MedHelp — Doctor Console',            desc: 'Configure clinic, letterhead and account preferences.',                path: '/' },
    };
    const meta = selectedPatient
      ? { title: `${selectedPatient.name} — Patient Record | MedHelp`, desc: `Clinical record, visits and prescriptions for ${selectedPatient.name}.`, path: '/' }
      : labels[tab] ?? labels.dashboard;
    setPageMeta({ title: meta.title, description: meta.desc, path: meta.path });
  }, [tab, selectedPatient]);

  useEffect(() => {
    requestNotificationPermission();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape') setIsSearchOpen(false);
    };
    const onGotoAppointments = () => { setSelectedPatient(null); setTab('appointments'); };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('app:goto-appointments', onGotoAppointments as EventListener);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('app:goto-appointments', onGotoAppointments as EventListener);
    };
  }, []);

  useEffect(() => {
    if (selectedPatient) {
      const updated = patients.find((p) => p.id === selectedPatient.id);
      if (updated) setSelectedPatient(updated);
    }
  }, [patients]);

  const handleSavePatient = (p: Patient) => {
    savePatient(p);
    if (selectedPatient && selectedPatient.id === p.id) {
      setSelectedPatient(p);
    }
  };

  const deletePatient = (patientId: string) => {
    removePatientFromDb(patientId);
    removeByPatient(patientId);
    removeVisitsByPatient(patientId);
    if (selectedPatient?.id === patientId) {
      setSelectedPatient(null);
    }
  };

  const deletePrescription = (prescriptionId: string) => {
    removePrescriptionFromDb(prescriptionId);
  };

  const deletePatientHistory = (patientId: string) => {
    removeByPatient(patientId);
  };

  const handleSearchSelect = (p: Patient) => {
    setSelectedPatient(p);
    setTab('patients');
  };

  const handleSelectPatient = (p: Patient) => {
    setSelectedPatient(p);
    setTab('patients');
  };

  const handleGoToDashboard = () => {
    setSelectedPatient(null);
    setTab('dashboard');
  };

  const themeIcon = theme === 'dark' ? <Moon size={16} /> : theme === 'light' ? <Sun size={16} /> : <Monitor size={16} />;
  const cycleTheme = () => {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(next);
  };

  const tabs: {key: Tab; icon: React.ReactNode; label: string;}[] = [
    { key: 'dashboard', icon: <LayoutDashboard size={20} />, label: t('nav.dashboard') },
    { key: 'patients', icon: <Users size={20} />, label: t('nav.patients') },
    { key: 'appointments', icon: <Calendar size={20} />, label: t('nav.appointments') },
    { key: 'history', icon: <Clock size={20} />, label: t('nav.history') },
    { key: 'settings', icon: <Settings size={20} />, label: t('nav.settings') },
  ];

  const renderContent = () => {
    if (selectedPatient) {
      return (
        <PatientProfilePage
          patient={selectedPatient}
          prescriptions={prescriptions}
          visits={visits}
          patients={patients}
          doctorSettings={doctorSettings}
          onBack={() => setSelectedPatient(null)}
          onSavePrescription={savePrescription}
          onSaveVisit={saveVisit}
          onUpdatePatient={handleSavePatient}
          onDeletePatient={deletePatient}
          onDeletePrescription={deletePrescription}
          onDeleteHistory={deletePatientHistory}
          onDeleteVisit={removeVisit}
          onGoToDashboard={handleGoToDashboard}
          stageFilter={stageFilter}
        />
      );
    }
    switch (tab) {
      case 'dashboard':
        return <DashboardPage patients={patients} prescriptions={prescriptions} visits={visits} onSavePatient={handleSavePatient} onSelectPatient={handleSelectPatient} />;
      case 'patients':
        return <PatientsPage patients={patients} visits={visits} onSave={handleSavePatient} onSelect={(p) => setSelectedPatient(p)} onFilterByStage={(stage) => { setStageFilter(stage); }} />;
      case 'appointments':
        return <div className="p-4 md:p-6 xl:p-8 page-transition"><AppointmentsTab /></div>;
      case 'history':
        return <HistoryPage patients={patients} prescriptions={prescriptions} onSelectPatient={handleSelectPatient} onDeleteHistory={deletePatientHistory} />;
      case 'settings':
        return <SettingsPage settings={doctorSettings} onSave={saveDoctorSettings} patients={patients} prescriptions={prescriptions} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-transparent">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 h-screen sticky top-0 glass-sidebar border-r border-border/30">
        <div className="p-5 pb-3">
          <h1 className="text-lg font-medium tracking-tight" style={{ fontFamily: "'Poppins', sans-serif" }}>MedHelp</h1>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {doctorSettings.name || 'Medical Practice Management'}
          </p>
        </div>

        <div className="px-3 pb-2">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl glass-input text-muted-foreground hover:text-foreground transition-all duration-150 text-sm">
            <Search size={15} />
            <span>{t('common.search')}</span>
            <kbd className="ml-auto text-[10px] font-mono px-1.5 py-0.5 bg-background/50 rounded text-muted-foreground">/</kbd>
          </button>
        </div>

        <nav className="flex-1 px-3 py-1 relative">
          <div className="relative">
            {/* Sliding pill indicator */}
            <div
              className="absolute left-0 right-0 h-11 rounded-xl bg-primary shadow-lg will-change-transform"
              style={{
                transform: `translateY(${(selectedPatient ? -1 : tabs.findIndex(t => t.key === tab)) * 46}px)`,
                opacity: selectedPatient ? 0 : 1,
                transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms ease',
              }}
            />
            {tabs.map((t) =>
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setSelectedPatient(null); }}
                className={`relative z-10 w-full flex items-center gap-3 px-3 h-11 mb-[2px] rounded-xl text-sm transition-colors duration-200 btn-press ${
                  tab === t.key && !selectedPatient
                    ? 'text-primary-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground font-normal'
                }`}
                style={{ fontFamily: "'Poppins', sans-serif" }}>
                {t.icon}
                <span>{t.label}</span>
              </button>
            )}
          </div>
        </nav>

        <div className="p-3 space-y-1">
          <button
            onClick={cycleTheme}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-all duration-150 btn-press">
            {themeIcon}
            <span className="capitalize">{theme} mode</span>
          </button>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-150 btn-press">
            <LogOut size={16} />
            <span>{t('common.signOut')}</span>
          </button>
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl glass-card">
            <div className="w-9 h-9 rounded-full bg-foreground/10 flex items-center justify-center">
              <span className="text-sm font-bold">
                {doctorSettings.name ? doctorSettings.name.charAt(0) : '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{doctorSettings.name || 'Doctor'}</p>
              <p className="text-[11px] text-muted-foreground truncate">{doctorSettings.degrees || 'Configure in Settings'}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-30 glass-header border-b border-border/50 px-4 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-base font-semibold truncate" style={{ fontFamily: "'Poppins', sans-serif" }}>MedHelp</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {doctorSettings.name || 'Medical Practice Management'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={cycleTheme}
              aria-label={`Switch theme (currently ${theme})`}
              className="w-9 h-9 rounded-full glass-button flex items-center justify-center text-muted-foreground hover:text-foreground transition-all duration-150 btn-press">
              {themeIcon}
            </button>
            <button
              onClick={() => setIsSearchOpen(true)}
              aria-label="Search patients"
              className="w-9 h-9 rounded-full glass-button flex items-center justify-center text-muted-foreground hover:text-foreground transition-all duration-150 btn-press">
              <Search size={16} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-20 md:pb-8">
          <div className="mx-auto w-full max-w-[1520px]">
            {renderContent()}
          </div>
        </main>

        {/* Mobile Bottom tabs — Apple-style glass with sliding magnifier */}
        <MobileBottomTabs
          tabs={tabs}
          activeKey={selectedPatient ? 'dashboard' : tab}
          onChange={(k) => { setTab(k); setSelectedPatient(null); }}
        />
      </div>

      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        patients={patients}
        onSelect={handleSearchSelect}
      />
    </div>
  );
};

export default Index;
