import React, { useState, useEffect, useCallback, useRef, TouchEvent as ReactTouchEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { LogOut, User, Stethoscope, FileText, FlaskConical, Upload, Download, Eye, EyeOff, Loader2, Sun, Moon, Monitor, CalendarPlus, Calendar, Clock, X, RefreshCw, ChevronRight, Plus, Bell, Printer, ArrowLeft, Share2, FolderOpen, Pill, KeyRound, Save, Settings as SettingsIcon, LayoutGrid, Globe, Check } from 'lucide-react';
import MobileBottomTabs from '@/components/MobileBottomTabs';
import PatientUserManual from '@/components/PatientUserManual';
import AvatarCropperModal from '@/components/AvatarCropperModal';
import { Camera } from 'lucide-react';
import PatientRegistrationForm from '@/components/PatientRegistrationForm';
import BrandedSpinner from '@/components/BrandedSpinner';
// PrescriptionPreview removed — replaced by uploaded-PDF list.
import { useTheme } from '@/hooks/useTheme';
import { toast } from 'sonner';
import { requestNotificationPermission, showBrowserNotification } from '@/lib/notifications';
import { setPageMeta } from '@/lib/pageMeta';
import { VISIT_STAGE_LABELS, VISIT_STAGE_COLORS } from '@/types/medical';
import type { Patient, Prescription, DoctorSettings, Chamber } from '@/types/medical';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format, addDays, isBefore, isAfter, startOfDay } from 'date-fns';
import { bn as bnLocale, enUS as enLocale } from 'date-fns/locale';
import { sendAppointmentEmail, getDoctorEmail } from '@/lib/appointmentEmail';
import { notifyUser, getDoctorUserId } from '@/lib/push';
import { useThemeFull } from '@/lib/theme';
import { getJoinWindowState, ALWAYS_JOIN_PATIENT_IDS } from '@/lib/appointmentWindow';
import { canPatientBookSlot, canPatientModifyAppointment, getClinicTodayDateString, getEffectiveAppointmentStatus, shouldAutoCompleteAppointment } from '@/lib/appointmentRules';
// downloadPrescriptionImage removed — patients now download the uploaded PDF directly.

type Tab = 'profile' | 'appointments' | 'visits' | 'prescriptions' | 'files' | 'account' | 'more' | 'settings' | 'manual';

interface PatientRecord {
  id: string; name: string; age: number; gender: string; phone?: string; address?: string;
  occupation?: string; maritalStatus?: string; weight?: number; heightFeet?: number; heightInches?: number;
  heightCm?: number; chiefComplaint?: string; medicalConditions?: string[]; allergies?: string[];
  profileLocked?: boolean;
  avatarUrl?: string;
  dateOfBirth?: string;
}

interface AppointmentRecord {
  id: string; appointment_date: string; time_slot: string; status: string;
  chief_complaint: string | null; created_at: string;
  cancel_reason: string | null; reschedule_date: string | null; reschedule_time_slot: string | null;
  google_meet_link?: string | null;
  patient_id?: string | null;
}

interface VisitRecord {
  id: string; date: string; stage: string; chiefComplaint?: string; examinationFindings?: string;
  investigations?: string; finalDiagnosis?: string; advice?: string; medicines?: any[];
  createdAt: string;
}

interface PrescriptionRecord {
  id: string; symptoms: string; diagnosis: string; medicines?: any[]; advice?: string;
  tests?: string; followUpDays?: string; createdAt: string; examinationFindings?: string;
  consultationType?: string; isProvisional?: boolean; provisionalMedicines?: any[];
  chamberId?: string; language?: string; patientId: string;
}

interface ReportRecord {
  id: string; fileName: string; filePath: string; fileType?: string; createdAt: string;
  category: 'report' | 'prescription';
}

const VALID_SLOTS = ['9:00 PM', '9:30 PM', '10:00 PM', '10:30 PM'];

const parseAppointmentDateTime = (date: string, time: string) => {
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3].toUpperCase();

  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  const value = new Date(`${date}T00:00:00`);
  value.setHours(hours, minutes, 0, 0);
  return value;
};

const PatientDashboard: React.FC = () => {
  const { t } = useTranslation();
  // Section is synced with the URL: /patient/<tab>. Refreshing or sharing the
  // link lands on the same section.
  const navigate = useNavigate();
  const params = useParams<{ tab?: string }>();
  const VALID_TABS: Tab[] = ['profile', 'appointments', 'visits', 'prescriptions', 'files', 'account', 'more', 'settings', 'manual'];
  const tab: Tab = (VALID_TABS.includes(params.tab as Tab) ? (params.tab as Tab) : 'profile');
  const setTab = (t: Tab) => {
    if (t === 'profile') navigate('/patient');
    else navigate(`/patient/${t}`);
  };

  // Update document title per active section
  useEffect(() => {
    const labelMap: Record<Tab, string> = {
      profile: 'Profile',
      appointments: 'Appointments',
      visits: 'Visits',
      prescriptions: 'Rx',
      files: 'Files',
      account: 'Account',
      more: 'Hub',
      settings: 'Settings',
      manual: 'User Manual',
    };
    document.title = `${labelMap[tab]} — Patient Dashboard`;
  }, [tab]);
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionRecord[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [theme, setTheme] = useTheme();
  const [viewingReport, setViewingReport] = useState<{ name: string; url: string; type: string } | null>(null);
  const [doctorSettings, setDoctorSettings] = useState<any>(null);
  const [viewingRx, setViewingRx] = useState<PrescriptionRecord | null>(null);
  const [showRegForm, setShowRegForm] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');

  const scrollContainerRef = useRef<HTMLDivElement>(null);


  // Booking form state
  const [bookingDate, setBookingDate] = useState('');
  const [bookingSlot, setBookingSlot] = useState('');
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [bookingComplaint, setBookingComplaint] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [showBooking, setShowBooking] = useState(false);

  // Cancel state for patients
  const [cancellingAptId, setCancellingAptId] = useState<string | null>(null);
  const [patientCancelReason, setPatientCancelReason] = useState('');

  // Reschedule state
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlot, setRescheduleSlot] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduleBookedSlots, setRescheduleBookedSlots] = useState<string[]>([]);

  // Tab slider ref
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  const signOut = async () => { await supabase.auth.signOut(); };
  const themeIcon = theme === 'dark' ? <Moon size={16} /> : theme === 'light' ? <Sun size={16} /> : <Monitor size={16} />;
  const cycleTheme = () => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light');

  // Full tab set — used for desktop sidebar.
  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'profile', label: t('nav.profile'), icon: <User size={16} /> },
    { key: 'appointments', label: t('nav.appts'), icon: <Calendar size={16} /> },
    { key: 'visits', label: t('nav.visits'), icon: <Stethoscope size={16} /> },
    { key: 'prescriptions', label: t('nav.rx'), icon: <FileText size={16} /> },
    { key: 'files', label: t('nav.files'), icon: <FolderOpen size={16} /> },
    { key: 'account', label: t('nav.account'), icon: <KeyRound size={16} /> },
    { key: 'settings', label: t('nav.settings'), icon: <SettingsIcon size={16} /> },
  ];

  // Mobile bottom bar — 4 items only; rest live behind "Hub".
  const mobileTabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'profile', label: t('nav.profile'), icon: <User size={18} /> },
    { key: 'prescriptions', label: t('nav.rx'), icon: <FileText size={18} /> },
    { key: 'appointments', label: t('nav.appts'), icon: <Calendar size={18} /> },
    { key: 'more', label: t('nav.hub'), icon: <LayoutGrid size={18} /> },
  ];

  // When user lands on a section not in the bottom bar, keep "More" active.
  const moreKeys: Tab[] = ['visits', 'files', 'account', 'settings', 'more', 'manual'];
  const activeBottomKey: Tab = moreKeys.includes(tab) ? 'more' : tab;

  // Update indicator position
  useEffect(() => {
    const idx = tabs.findIndex(t => t.key === tab);
    const el = tabsRef.current[idx];
    if (el) {
      setIndicatorStyle({ left: el.offsetLeft, width: el.offsetWidth });
    }
  }, [tab]);

  const handleTabChange = (newTab: Tab) => {
    const oldIdx = tabs.findIndex(t => t.key === tab);
    const newIdx = tabs.findIndex(t => t.key === newTab);
    setSlideDirection(newIdx > oldIdx ? 'right' : 'left');
    setTab(newTab);
  };

  // ── Swipe gesture support — follows the mobile bottom tab order ──
  // Hub sub-tabs (visits/files/account/settings/manual) are folded onto 'more'
  // for swipe positioning so they behave like sub-pages of Hub.
  const swipeOrder: Tab[] = ['profile', 'prescriptions', 'appointments', 'more'];
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const onTouchStart = (e: ReactTouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const onTouchEnd = (e: ReactTouchEvent) => {
    const start = touchStartRef.current;
    if (!start) return;
    touchStartRef.current = null;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const dt = Date.now() - start.t;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2 || dt > 900) return;
    // Map any hub sub-tab to 'more' so right-swipe from there lands on appointments.
    const hubKeys: Tab[] = ['visits', 'files', 'account', 'settings', 'manual', 'more'];
    const effective: Tab = hubKeys.includes(tab) ? 'more' : tab;
    const cur = swipeOrder.indexOf(effective);
    if (cur < 0) return;
    const next = dx < 0 ? cur + 1 : cur - 1;
    if (next < 0 || next >= swipeOrder.length) return;
    handleTabChange(swipeOrder[next]);
  };

  // Sub-tabs reached via Hub — show in-app back button on mobile.
  const isHubSubTab = (['visits', 'files', 'account', 'settings', 'manual'] as Tab[]).includes(tab);
  const hubSubLabel: Partial<Record<Tab, string>> = {
    visits: t('nav.visits'), files: t('nav.files'), account: t('nav.account'), settings: t('nav.settings'), manual: t('nav.manual'),
  };

  /** Bottom-tab click handler — if user taps "Hub" while inside a Hub sub-tab,
   * route back to the Hub grid instead of doing nothing. */
  const handleBottomTabChange = (key: Tab) => {
    if (key === 'more' && isHubSubTab) {
      handleTabChange('more');
      return;
    }
    handleTabChange(key);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: patientData } = await supabase.from('patients').select('*').eq('user_id', user.id).limit(1).single();
    if (patientData) {
      const p: PatientRecord = {
        id: patientData.id, name: patientData.name, age: patientData.age, gender: patientData.gender,
        phone: patientData.phone ?? undefined, address: patientData.address ?? undefined,
        occupation: patientData.occupation ?? undefined, maritalStatus: patientData.marital_status,
        weight: patientData.weight ? Number(patientData.weight) : undefined,
        heightFeet: patientData.height_feet ?? undefined, heightInches: patientData.height_inches ?? undefined,
        heightCm: patientData.height_cm ? Number(patientData.height_cm) : undefined,
        chiefComplaint: patientData.chief_complaint ?? undefined,
        medicalConditions: patientData.medical_conditions ?? [],
        allergies: patientData.allergies ?? [],
        profileLocked: (patientData as any).profile_locked ?? false,
        avatarUrl: (patientData as any).avatar_url ?? undefined,
        dateOfBirth: (patientData as any).date_of_birth ?? undefined,
      };
      setPatient(p);

      const { data: aptData } = await supabase.from('appointments').select('*').eq('patient_id', patientData.id).order('appointment_date', { ascending: false });
      if (aptData) {
        const normalizedAppointments = aptData.map((a: any) => ({
          id: a.id, appointment_date: a.appointment_date, time_slot: a.time_slot,
          status: getEffectiveAppointmentStatus(a), chief_complaint: a.chief_complaint,
          created_at: a.created_at,
          cancel_reason: a.cancel_reason, reschedule_date: a.reschedule_date,
          reschedule_time_slot: a.reschedule_time_slot,
          google_meet_link: a.google_meet_link,
        }));
        setAppointments(normalizedAppointments);

        const autoCompleteIds = aptData.filter((a: any) => shouldAutoCompleteAppointment(a)).map((a: any) => a.id);
        if (autoCompleteIds.length > 0) {
          await supabase.from('appointments').update({ status: 'completed', updated_at: new Date().toISOString() } as any).in('id', autoCompleteIds);
        }
      }

      const { data: visitData } = await supabase.from('visits').select('*').eq('patient_id', patientData.id).order('created_at', { ascending: false });
      if (visitData) {
        setVisits(visitData.map((v: any) => ({
          id: v.id, date: v.date, stage: v.stage, chiefComplaint: v.chief_complaint,
          examinationFindings: v.examination_findings, investigations: v.investigations,
          finalDiagnosis: v.final_diagnosis, advice: v.advice, medicines: v.medicines as any[],
          createdAt: v.created_at,
        })));
      }

      const { data: rxData } = await supabase.from('prescriptions').select('*').eq('patient_id', patientData.id).order('created_at', { ascending: false });
      if (rxData) {
        setPrescriptions(rxData.map((r: any) => ({
          id: r.id, symptoms: r.symptoms, diagnosis: r.diagnosis, medicines: r.medicines as any[],
          advice: r.advice, tests: r.tests, followUpDays: r.follow_up_days, createdAt: r.created_at,
          examinationFindings: r.examination_findings, consultationType: r.consultation_type,
          isProvisional: r.is_provisional, provisionalMedicines: r.provisional_medicines as any[],
          chamberId: r.chamber_id, language: r.language, patientId: r.patient_id,
        })));
      }

      const { data: reportData } = await (supabase as any).from('patient_reports').select('*').eq('patient_id', patientData.id).order('created_at', { ascending: false });
      if (reportData) {
        setReports(reportData.map((r: any) => ({
          id: r.id, fileName: r.file_name, filePath: r.file_path, fileType: r.file_type, createdAt: r.created_at,
          category: (r.category === 'prescription' ? 'prescription' : 'report'),
        })));
      }

      // Fetch safe public doctor info for prescription preview
      const { data: docData } = await supabase.from('doctor_public_info').select('*').limit(1).maybeSingle();
      if (docData) setDoctorSettings(docData);
    } else {
      setShowRegForm(true);
    }
    setLoading(false);
  }, []);


  useEffect(() => { fetchData(); }, [fetchData]);

  // Per-tab SEO metadata (unique titles + self-canonical for /patient).
  useEffect(() => {
    const labels: Record<string, { title: string; desc: string }> = {
      profile:       { title: 'Health Snapshot | MedHelp Patient Portal', desc: 'Your vitals, allergies, upcoming visits and recent prescriptions.' },
      appointments:  { title: 'Appointments | MedHelp Patient Portal',    desc: 'Book, reschedule and join video visits with your doctor.' },
      visits:        { title: 'Visit History | MedHelp Patient Portal',   desc: 'Past consultations, diagnoses and clinical notes.' },
      prescriptions: { title: 'Prescriptions | MedHelp Patient Portal',   desc: 'Download and review prescriptions from your doctor.' },
      files:         { title: 'Reports & Files | MedHelp Patient Portal', desc: 'Upload investigation reports and access your medical files.' },
      account:       { title: 'Account | MedHelp Patient Portal',         desc: 'Update your personal details, photo and sign-in information.' },
      settings:      { title: 'Settings | MedHelp Patient Portal',        desc: 'Notification and appearance preferences for this device.' },
      more:          { title: 'Patient Portal | MedHelp',                 desc: 'Your medical records, visits and prescriptions in one place.' },
      manual:        { title: 'User Manual | MedHelp Patient Portal',     desc: 'Step-by-step Bangla & English guide to using the patient portal.' },
    };
    const m = labels[tab] ?? labels.more;
    setPageMeta({ title: m.title, description: m.desc, path: '/patient' });
  }, [tab]);


  // Listen for the cross-component "go to appointments" event (fired when call notif arrives).
  useEffect(() => {
    const onGoto = () => setTab('appointments');
    const onOpenCall = (e: Event) => {
      const detail = (e as CustomEvent<{ appointmentId?: string }>).detail;
      setTab('appointments');
      if (detail?.appointmentId) {
        // Defer dispatching until the appointments tab is rendered.
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('app:focus-appointment', { detail }));
        }, 50);
      }
    };
    window.addEventListener('app:goto-appointments', onGoto);
    window.addEventListener('app:open-call', onOpenCall as EventListener);
    return () => {
      window.removeEventListener('app:goto-appointments', onGoto);
      window.removeEventListener('app:open-call', onOpenCall as EventListener);
    };
  }, []);

  // Tick every 30s so Join button appears automatically at appointment time.
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  // Schedule a notification at appointment time for each confirmed appointment.
  useEffect(() => {
    const timeouts: number[] = [];
    appointments.forEach(apt => {
      if (apt.status !== 'confirmed' && apt.status !== 'in_call') return;
      const m = apt.time_slot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (!m) return;
      let h = parseInt(m[1], 10); const mi = parseInt(m[2], 10);
      if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
      if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
      // Interpret slot as Asia/Dhaka (UTC+6) wall clock.
      const [y, mo, d] = apt.appointment_date.split('-').map(Number);
      const aptMs = Date.UTC(y, (mo || 1) - 1, d || 1, h, mi, 0, 0) - 6 * 60 * 60 * 1000;
      const delay = aptMs - Date.now();
      if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
        const id = window.setTimeout(() => {
          showBrowserNotification('📞 Video call ready', 'Your appointment is starting now. Tap to join.');
          window.dispatchEvent(new CustomEvent('app:open-call', { detail: { appointmentId: apt.id } }));
        }, delay);
        timeouts.push(id);
      }
    });
    return () => { timeouts.forEach(clearTimeout); };
  }, [appointments]);

  useEffect(() => {
    if (!patient) return;
    const channel = supabase
      .channel('patient-appointments')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'appointments', filter: `patient_id=eq.${patient.id}` }, (payload) => {
        const newStatus = (payload.new as any)?.status;
        if (newStatus === 'confirmed') {
          showBrowserNotification('Appointment Confirmed ✓', `Your appointment has been confirmed by the doctor.`);
        } else if (newStatus === 'cancelled') {
          showBrowserNotification('Appointment Cancelled', `Your appointment has been cancelled.`);
        } else if (newStatus === 'reschedule_requested') {
          showBrowserNotification('Reschedule Update', `Your reschedule request is being processed.`);
        }
        fetchData();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'appointments', filter: `patient_id=eq.${patient.id}` }, () => { fetchData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [patient?.id, fetchData]);

  const loadSlots = async (date: string, target: 'booking' | 'reschedule') => {
    const { data } = await supabase.rpc('get_booked_slots', { target_date: date });
    const slots = (data || []).map((r: any) => r.time_slot);
    if (target === 'booking') setBookedSlots(slots);
    else setRescheduleBookedSlots(slots);
  };

  const handleBook = async () => {
    if (!patient || !bookingDate || !bookingSlot) { toast.error('Select date and time slot'); return; }
    if (!canPatientBookSlot(bookingDate, bookingSlot)) { toast.error('Appointments must be booked at least 4 hours আগে.'); return; }

    // Check if patient already has an active appointment on this date
    const existingOnDate = appointments.find(a =>
      a.appointment_date === bookingDate &&
      (a.status === 'pending' || a.status === 'confirmed')
    );
    if (existingOnDate) {
      toast.error('You already have an appointment on this date. Please choose a different date.');
      return;
    }

    setBookingSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    const patientEmail = user?.email || '';
    const { data: insertedApt, error } = await supabase.from('appointments').insert({
      patient_id: patient.id, patient_name: patient.name, patient_phone: patient.phone || null,
      patient_email: patientEmail, appointment_date: bookingDate, time_slot: bookingSlot,
      chief_complaint: bookingComplaint.trim() || null, status: 'pending',
    }).select('id').single();
    if (error) { toast.error(error.message || 'Booking failed'); }
    else {
      toast.success('Appointment requested!');
      setShowBooking(false); setBookingDate(''); setBookingSlot(''); setBookingComplaint('');
      fetchData();
      if (patientEmail) {
        sendAppointmentEmail({ type: 'booking_received', to: patientEmail, patientName: patient.name, date: bookingDate, time: bookingSlot });
      }
      // Push to patient (own device) — confirms request was received even offline later
      const { data: { user: bookUser } } = await supabase.auth.getUser();
      notifyUser(bookUser?.id, 'Appointment requested', `${bookingDate} • ${bookingSlot} — awaiting doctor approval`, { aptId: insertedApt?.id ?? '' });
      // Notify doctor about new appointment request with action buttons
      const doctorEmail = await getDoctorEmail();
      if (doctorEmail && insertedApt) {
        sendAppointmentEmail({ type: 'new_appointment_request', to: doctorEmail, patientName: patient.name, date: bookingDate, time: bookingSlot, appointmentId: insertedApt.id });
      }
      const doctorUid = await getDoctorUserId();
      notifyUser(doctorUid, 'New appointment request', `${patient.name} — ${bookingDate} ${bookingSlot}`, { aptId: insertedApt?.id ?? '' });
    }
    setBookingSubmitting(false);
  };

  const startCancelAppointment = (apt: AppointmentRecord) => {
    if (!canPatientModifyAppointment(apt)) { toast.error('You can cancel only up to 2 hours before the appointment.'); return; }
    setCancellingAptId(apt.id);
    setPatientCancelReason('');
  };

  const confirmCancelAppointment = async (apt: AppointmentRecord) => {
    if (!patientCancelReason.trim()) { toast.error('Please provide a reason for cancellation'); return; }
    const { error } = await supabase.from('appointments').update({ status: 'cancelled', cancel_reason: patientCancelReason.trim(), updated_at: new Date().toISOString() } as any).eq('id', apt.id);
    if (error) { toast.error('Failed to cancel'); return; }
    toast.success('Appointment cancelled');
    setCancellingAptId(null); setPatientCancelReason('');
    fetchData();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) { sendAppointmentEmail({ type: 'appointment_cancelled_by_patient', to: user.email, patientName: patient!.name, date: apt.appointment_date, time: apt.time_slot }); }
    notifyUser(user?.id, 'Appointment cancelled', `${apt.appointment_date} ${apt.time_slot}`, { aptId: apt.id });
    const doctorEmail = await getDoctorEmail();
    if (doctorEmail) { sendAppointmentEmail({ type: 'doctor_notification', to: doctorEmail, patientName: patient!.name, date: apt.appointment_date, time: apt.time_slot, reason: patientCancelReason.trim() }); }
    const doctorUid = await getDoctorUserId();
    notifyUser(doctorUid, 'Appointment cancelled by patient', `${patient!.name} — ${apt.appointment_date} ${apt.time_slot}\nReason: ${patientCancelReason.trim()}`, { aptId: apt.id });
  };

  const startReschedule = (apt: AppointmentRecord) => {
    if (!canPatientModifyAppointment(apt)) { toast.error('You can reschedule only up to 2 hours before the appointment.'); return; }
    setReschedulingId(apt.id); setRescheduleDate(''); setRescheduleSlot(''); setRescheduleReason(''); setCancellingAptId(null);
  };

  const confirmReschedule = async () => {
    if (!reschedulingId || !rescheduleDate || !rescheduleSlot) { toast.error('Select new date and time'); return; }
    if (!rescheduleReason.trim()) { toast.error('Please provide a reason for rescheduling'); return; }
    const apt = appointments.find(a => a.id === reschedulingId);
    const { error } = await supabase.from('appointments').update({ status: 'reschedule_requested', reschedule_date: rescheduleDate, reschedule_time_slot: rescheduleSlot, cancel_reason: rescheduleReason.trim(), updated_at: new Date().toISOString() } as any).eq('id', reschedulingId);
    if (error) { toast.error('Failed to request reschedule'); return; }
    toast.success('Reschedule request sent!'); setReschedulingId(null); setRescheduleReason(''); fetchData();
    // Email to patient - holding status
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      sendAppointmentEmail({ type: 'reschedule_holding', to: user.email, patientName: patient!.name, date: apt?.appointment_date || '', time: apt?.time_slot || '', newDate: rescheduleDate, newTime: rescheduleSlot });
    }
    notifyUser(user?.id, 'Reschedule requested', `New: ${rescheduleDate} ${rescheduleSlot} — awaiting doctor`, { aptId: apt?.id ?? '' });
    // Email to doctor - reschedule request (with reason)
    if (apt) {
      const doctorEmail = await getDoctorEmail();
      if (doctorEmail) { sendAppointmentEmail({ type: 'reschedule_requested', to: doctorEmail, patientName: patient!.name, date: apt.appointment_date, time: apt.time_slot, newDate: rescheduleDate, newTime: rescheduleSlot, reason: rescheduleReason.trim() }); }
      const doctorUid = await getDoctorUserId();
      notifyUser(doctorUid, 'Reschedule request', `${patient!.name} wants ${rescheduleDate} ${rescheduleSlot}\nReason: ${rescheduleReason.trim()}`, { aptId: apt.id });
    }
  };

  const handleUploadReport = async (
    e: React.ChangeEvent<HTMLInputElement>,
    category: 'report' | 'prescription' = 'report',
  ) => {
    const file = e.target.files?.[0]; if (!file || !patient) return;
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    const lower = file.name.toLowerCase();
    const okExt = lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.pdf');
    if (!allowed.includes(file.type) && !okExt) {
      toast.error('Only JPG, PNG, or PDF files are allowed');
      e.target.value = '';
      return;
    }
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('Not authenticated');
      const filePath = `${user.id}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('patient-reports').upload(filePath, file); if (uploadError) throw uploadError;
      const { error: dbError } = await (supabase as any).from('patient_reports').insert({ patient_id: patient.id, file_name: file.name, file_path: filePath, file_type: file.type, uploaded_by: user.id, category }); if (dbError) throw dbError;
      toast.success(category === 'prescription' ? 'Prescription uploaded' : 'Report uploaded'); fetchData();
      // Notify doctor about new report
      const doctorEmail = await getDoctorEmail();
      if (doctorEmail) {
        sendAppointmentEmail({ type: 'report_uploaded', to: doctorEmail, patientName: patient.name, date: new Date().toISOString().split('T')[0], time: '', reportName: file.name });
      }
      const doctorUid = await getDoctorUserId();
      notifyUser(doctorUid, 'New patient report', `${patient.name} uploaded ${file.name}`);
    } catch (err: any) { toast.error(err.message || 'Upload failed'); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const handleViewReport = async (report: ReportRecord) => {
    const { data } = await supabase.storage.from('patient-reports').createSignedUrl(report.filePath, 3600);
    if (data?.signedUrl) setViewingReport({ name: report.fileName, url: data.signedUrl, type: report.fileType || '' });
  };

  const handleDownloadReport = async (report: ReportRecord) => {
    const { data } = await supabase.storage.from('patient-reports').createSignedUrl(report.filePath, 3600);
    if (data?.signedUrl) { const a = document.createElement('a'); a.href = data.signedUrl; a.download = report.fileName; a.click(); }
  };

  const buildSummaryHtml = () => {
    if (!patient) return '';
    const fmt = (d: string) => new Date(d).toLocaleDateString();
    const esc = (s: any) => String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const visitsHtml = visits.length ? visits.map(v => `
      <div style="margin-bottom:14px;padding:12px;border:1px solid #e5e7eb;border-radius:10px">
        <div style="display:flex;justify-content:space-between;font-size:12px;color:#6b7280;margin-bottom:6px">
          <span>${esc(fmt(v.createdAt))}</span><span>${esc(v.stage)}</span>
        </div>
        ${v.chiefComplaint ? `<p style="margin:2px 0;font-size:13px"><b>Complaint:</b> ${esc(v.chiefComplaint)}</p>` : ''}
        ${v.finalDiagnosis ? `<p style="margin:2px 0;font-size:13px"><b>Diagnosis:</b> ${esc(v.finalDiagnosis)}</p>` : ''}
        ${v.advice ? `<p style="margin:2px 0;font-size:13px"><b>Advice:</b> ${esc(v.advice)}</p>` : ''}
      </div>`).join('') : '<p style="color:#6b7280;font-size:13px">No visits recorded.</p>';
    const rxHtml = prescriptions.length ? prescriptions.map(r => `
      <div style="margin-bottom:14px;padding:12px;border:1px solid #e5e7eb;border-radius:10px">
        <div style="font-size:12px;color:#6b7280;margin-bottom:6px">${esc(fmt(r.createdAt))}</div>
        ${r.diagnosis ? `<p style="margin:2px 0;font-size:13px"><b>Dx:</b> ${esc(r.diagnosis)}</p>` : ''}
        ${r.symptoms ? `<p style="margin:2px 0;font-size:13px"><b>Sx:</b> ${esc(r.symptoms)}</p>` : ''}
        ${(r.medicines && (r.medicines as any[]).length) ? `<div style="margin-top:6px"><b style="font-size:13px">Medicines:</b><ul style="margin:4px 0 0 16px;padding:0;font-size:12px">${(r.medicines as any[]).map((m:any)=>`<li>${esc(m.name||'')} — ${esc(m.dosage||'')} ${esc(m.frequency||'')} ${esc(m.duration||'')}</li>`).join('')}</ul></div>` : ''}
        ${r.advice ? `<p style="margin:6px 0 0;font-size:13px"><b>Advice:</b> ${esc(r.advice)}</p>` : ''}
      </div>`).join('') : '<p style="color:#6b7280;font-size:13px">No prescriptions yet.</p>';
    const reportsHtml = reports.length ? `<ul style="margin:0;padding-left:18px;font-size:13px">${reports.map(r=>`<li>${esc(r.fileName)} — ${esc(fmt(r.createdAt))}</li>`).join('')}</ul>` : '<p style="color:#6b7280;font-size:13px">No uploaded reports.</p>';

    return `
      <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111827;padding:32px;width:210mm;box-sizing:border-box;background:#fff">
        <div style="border-bottom:2px solid #111827;padding-bottom:12px;margin-bottom:18px">
          <h1 style="margin:0;font-size:22px">MedHelp — Patient Summary</h1>
          <p style="margin:4px 0 0;font-size:12px;color:#6b7280">Generated ${esc(new Date().toLocaleString())}</p>
        </div>
        <h2 style="font-size:15px;margin:0 0 8px">Patient Information</h2>
        <table style="width:100%;font-size:13px;border-collapse:collapse;margin-bottom:18px">
          <tr><td style="padding:4px 0;color:#6b7280;width:140px">Name</td><td>${esc(patient.name)}</td></tr>
          <tr><td style="padding:4px 0;color:#6b7280">Age / Gender</td><td>${esc(patient.age)} · ${esc(patient.gender)}</td></tr>
          ${patient.phone ? `<tr><td style="padding:4px 0;color:#6b7280">Phone</td><td>${esc(patient.phone)}</td></tr>` : ''}
          ${patient.weight ? `<tr><td style="padding:4px 0;color:#6b7280">Weight</td><td>${esc(patient.weight)} kg</td></tr>` : ''}
          ${patient.medicalConditions?.length ? `<tr><td style="padding:4px 0;color:#6b7280">Conditions</td><td>${esc(patient.medicalConditions.join(', '))}</td></tr>` : ''}
          ${patient.allergies?.length ? `<tr><td style="padding:4px 0;color:#6b7280">Allergies</td><td>${esc(patient.allergies.join(', '))}</td></tr>` : ''}
        </table>
        <h2 style="font-size:15px;margin:18px 0 8px">Visits</h2>
        ${visitsHtml}
        <h2 style="font-size:15px;margin:18px 0 8px">Prescriptions</h2>
        ${rxHtml}
        <h2 style="font-size:15px;margin:18px 0 8px">Uploaded Reports</h2>
        ${reportsHtml}
      </div>`;
  };

  const generateSummaryPdfBlob = async (): Promise<Blob> => {
    const html = buildSummaryHtml();
    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.left = '-10000px';
    wrapper.style.top = '0';
    wrapper.innerHTML = html;
    document.body.appendChild(wrapper);
    try {
      throw new Error('PDF summary export has been removed. Please use the prescription PDF upload flow.');
    } finally {
      wrapper.remove();
    }
  };

  const handleDownloadSummary = async () => {
    if (!patient) return;
    try {
      const blob = await generateSummaryPdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${patient.name}_summary.pdf`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('Summary downloaded');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate PDF');
    }
  };

  const handleShareSummary = async () => {
    if (!patient) return;
    try {
      const blob = await generateSummaryPdfBlob();
      const file = new File([blob], `${patient.name}_summary.pdf`, { type: 'application/pdf' });
      const navAny = navigator as any;
      if (navAny.canShare && navAny.canShare({ files: [file] })) {
        await navAny.share({ files: [file], title: 'MedHelp Summary', text: `${patient.name} — Patient Summary` });
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${patient.name}_summary.pdf`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast.message('Sharing not supported — file downloaded instead');
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') toast.error(err?.message || 'Share failed');
    }
  };

  const today = new Date();
  const todayStr = getClinicTodayDateString(today);
  const maxDateStr = new Date(today.getTime() + 12 * 86400000).toISOString().split('T')[0];

  if (loading) {
    return <BrandedSpinner fullscreen label="Loading…" />;
  }

  if (showRegForm || !patient) {
    return <PatientRegistrationForm onComplete={() => { setShowRegForm(false); fetchData(); }} />;
  }

  const upcomingApts = appointments.filter(a => ['pending', 'confirmed', 'in_call', 'reschedule_requested'].includes(a.status));

  return (
    <div
      ref={scrollContainerRef}
      className="min-h-screen relative"
      style={{
        fontFamily: "'Poppins', sans-serif",
        background: 'linear-gradient(135deg, hsl(var(--muted)/0.18) 0%, hsl(var(--background)) 52%, hsl(var(--primary)/0.03) 100%)',
      }}
    >
      {/* Decorative orbs */}
      <div className="fixed top-[-120px] right-[-80px] w-[300px] h-[300px] rounded-full opacity-[0.04] pointer-events-none" style={{ background: 'radial-gradient(circle, hsl(var(--primary)), transparent 70%)' }} />
      <div className="fixed bottom-[-100px] left-[-60px] w-[250px] h-[250px] rounded-full opacity-[0.03] pointer-events-none" style={{ background: 'radial-gradient(circle, hsl(var(--primary)), transparent 70%)' }} />


      <div className="flex">
        {/* ── Desktop Sidebar (md+) ── */}
        <aside className="hidden md:flex flex-col w-64 h-screen sticky top-0 border-r border-border/30" style={{ background: 'hsl(var(--card)/0.5)', backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)' }}>
          <div className="p-5 pb-3">
            <h1 className="text-lg font-medium tracking-tight" style={{ fontFamily: "'Poppins', sans-serif" }}>MedHelp</h1>
          </div>

          <nav className="flex-1 px-3 py-1 relative">
            <div className="relative">
              <div
                className="absolute left-0 right-0 h-11 rounded-xl bg-primary shadow-lg will-change-transform"
                style={{
                  transform: `translateY(${tabs.findIndex(t => t.key === tab) * 46}px)`,
                  transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              />
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => handleTabChange(t.key)}
                  className={cn(
                    "relative z-10 w-full flex items-center gap-3 px-3 h-11 mb-[2px] rounded-xl text-sm transition-colors duration-200",
                    tab === t.key ? 'text-primary-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
                  )}
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </nav>

          <div className="p-3 space-y-1">
            <div className="flex items-center gap-3 px-3 py-3 rounded-xl border border-border/20" style={{ background: 'hsl(var(--card)/0.5)' }}>
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                {patient.avatarUrl ? (
                  <img src={patient.avatarUrl} alt={patient.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-primary">{patient.name.charAt(0)}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{patient.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{patient.age} yrs · <span className="capitalize">{patient.gender}</span></p>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
      {/* ── Mobile Glass Header ── */}
      <header className="md:hidden sticky top-0 z-30 border-b border-border/20" style={{ background: 'hsl(var(--background)/0.6)', backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)', paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-lg mx-auto px-5 py-2.5 flex items-center min-h-[60px]">
          <div className="min-w-0">
            <h1 className="text-base font-semibold tracking-tight leading-tight" style={{ fontFamily: "'Poppins', sans-serif" }}>MedHelp</h1>
            <p className="text-[11px] text-muted-foreground truncate leading-tight">{patient.name}</p>
          </div>
        </div>
      </header>

      {/* ── Tab Content ── */}
      <div className="max-w-lg mx-auto px-5 py-7 pb-28 md:pb-7" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{ touchAction: 'pan-y' }}>
        {isHubSubTab && (
          <div className="md:hidden mb-4 flex items-center justify-between">
            <button
              onClick={() => handleTabChange('more')}
              className="inline-flex items-center gap-2 rounded-2xl border border-border/30 px-3.5 py-2 text-sm font-medium hover:bg-foreground/5 transition-colors"
              style={{ background: 'hsl(var(--muted)/0.3)' }}
              aria-label={t('common.back')}
            >
              <ArrowLeft size={16} />
              <span>{t('common.back')}</span>
            </button>
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{hubSubLabel[tab]}</span>
          </div>
        )}
        <div
          key={tab}
          className={cn("animate-in duration-300 ease-out fill-mode-both", slideDirection === 'right' ? 'slide-in-from-right-4 fade-in' : 'slide-in-from-left-4 fade-in')}
        >
          {tab === 'profile' && (
            <OverviewTab patient={patient} visits={visits} prescriptions={prescriptions} appointments={appointments} onNavigate={handleTabChange} />
          )}
          {tab === 'appointments' && (
            <AppointmentsSection
              patient={patient} appointments={appointments}
              showBooking={showBooking} setShowBooking={setShowBooking}
              bookingDate={bookingDate} setBookingDate={(d) => { setBookingDate(d); loadSlots(d, 'booking'); }}
              bookingSlot={bookingSlot} setBookingSlot={setBookingSlot} bookedSlots={bookedSlots}
              bookingComplaint={bookingComplaint} setBookingComplaint={setBookingComplaint}
              bookingSubmitting={bookingSubmitting} onBook={handleBook}
              onStartCancel={startCancelAppointment} onConfirmCancel={confirmCancelAppointment}
              cancellingAptId={cancellingAptId} setCancellingAptId={setCancellingAptId}
              patientCancelReason={patientCancelReason} setPatientCancelReason={setPatientCancelReason}
              onStartReschedule={startReschedule}
              reschedulingId={reschedulingId}
              rescheduleDate={rescheduleDate} setRescheduleDate={(d) => { setRescheduleDate(d); loadSlots(d, 'reschedule'); }}
              rescheduleSlot={rescheduleSlot} setRescheduleSlot={setRescheduleSlot}
              rescheduleReason={rescheduleReason} setRescheduleReason={setRescheduleReason}
              rescheduleBookedSlots={rescheduleBookedSlots}
              onConfirmReschedule={confirmReschedule} onCancelReschedule={() => { setReschedulingId(null); setRescheduleReason(''); }}
              todayStr={todayStr} maxDateStr={maxDateStr}
            />
          )}
          {tab === 'visits' && <VisitsTab visits={visits} />}
          {tab === 'prescriptions' && <PrescriptionsTab prescriptions={prescriptions} onView={setViewingRx} />}
          {tab === 'files' && <FilesTab reports={reports} uploading={uploading} onUpload={handleUploadReport} onView={handleViewReport} onDownload={handleDownloadReport} onDownloadSummary={handleDownloadSummary} onShareSummary={handleShareSummary} />}
          {tab === 'account' && <AccountTab patient={patient} onPatientUpdated={fetchData} onSignOut={signOut} />}
          {tab === 'settings' && <PatientSettingsTab />}
          {tab === 'manual' && (
            <PatientUserManual onNavigate={(k) => handleTabChange(k as Tab)} />
          )}
          {tab === 'more' && (
            <MoreMenu
              onPick={(k) => handleTabChange(k)}
              onSignOut={signOut}
            />
          )}
        </div>
      </div>

      {/* ── Mobile bottom tabs — Apple glass with sliding magnifier ── */}
      <MobileBottomTabs
        tabs={mobileTabs}
        activeKey={activeBottomKey}
        onChange={(k) => handleBottomTabChange(k as Tab)}
      />


      {/* ── Report Viewer Modal ── */}
      {viewingReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'hsl(var(--background)/0.5)', backdropFilter: 'blur(24px)' }} onClick={() => setViewingReport(null)}>
          <div className="max-w-2xl w-full max-h-[85vh] overflow-auto animate-in zoom-in-95 fade-in duration-200 rounded-3xl border border-border/30 shadow-2xl" style={{ background: 'hsl(var(--card)/0.85)', backdropFilter: 'blur(40px)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border/20">
              <p className="text-sm font-semibold truncate">{viewingReport.name}</p>
              <button onClick={() => setViewingReport(null)} className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors" style={{ background: 'hsl(var(--muted)/0.3)' }}>
                <X size={14} />
              </button>
            </div>
            <div className="p-5">
              {viewingReport.type.startsWith('image/') ? (
                <img src={viewingReport.url} alt={viewingReport.name} className="w-full rounded-2xl" />
              ) : (
                <iframe src={viewingReport.url} className="w-full h-[65vh] rounded-2xl border border-border/30" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Prescription preview modal removed — patients now download uploaded PDFs directly from the Prescriptions tab. */}

      {/* ── Floating Action Button — only on Appointments tab, lifted above bottom nav ── */}
      {tab === 'appointments' && (
        <button
          onClick={() => setShowBooking(true)}
          className="fixed right-5 md:right-7 bottom-24 md:bottom-7 z-40 w-[56px] h-[56px] rounded-2xl text-primary-foreground shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary)/0.85))',
            boxShadow: '0 8px 32px hsl(var(--primary) / 0.35), 0 2px 8px hsl(var(--primary) / 0.2)',
          }}
          aria-label="Book Appointment"
        >
          <Plus size={24} />
        </button>
      )}
        </div>
      </div>
    </div>
  );
};

// Glass card utility
const GlassCard: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties }> = ({ children, className, style }) => (
  <div
    className={cn("rounded-3xl border border-border/20 overflow-hidden", className)}
    style={{ background: 'hsl(var(--card)/0.6)', backdropFilter: 'saturate(150%) blur(20px)', WebkitBackdropFilter: 'saturate(150%) blur(20px)', boxShadow: '0 2px 16px hsl(var(--foreground)/0.03), 0 0 0 1px hsl(var(--border)/0.05)', ...style }}
  >
    {children}
  </div>
);

// ── Overview Tab (health snapshot focused) ──
const OverviewTab: React.FC<{
  patient: PatientRecord;
  visits: VisitRecord[];
  prescriptions: PrescriptionRecord[];
  appointments: AppointmentRecord[];
  onNavigate?: (k: Tab) => void;
}> = ({ patient, visits, prescriptions, appointments, onNavigate }) => {
  const upcomingApts = appointments.filter(a => a.status === 'pending' || a.status === 'confirmed' || a.status === 'in_call');
  const latestVisit = visits[0];
  const nextApt = upcomingApts[0];

  // BMI from height/weight if both present.
  const heightMeters = patient.heightCm
    ? patient.heightCm / 100
    : patient.heightFeet
      ? (patient.heightFeet * 12 + (patient.heightInches || 0)) * 0.0254
      : null;
  const bmi = heightMeters && patient.weight ? (patient.weight / (heightMeters * heightMeters)) : null;
  const bmiLabel = bmi
    ? bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese'
    : null;

  return (
    <div className="space-y-5">
      {/* Profile + greeting */}
      <GlassCard>
        <div className="p-6 flex items-start gap-4">
          <div className="w-[56px] h-[56px] rounded-2xl flex items-center justify-center shrink-0 overflow-hidden" style={{ background: 'linear-gradient(135deg, hsl(var(--primary)/0.18), hsl(var(--primary)/0.05))' }}>
            {patient.avatarUrl ? (
              <img src={patient.avatarUrl} alt={patient.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-primary">{patient.name.charAt(0)}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Welcome back</p>
            <h2 className="text-lg font-semibold tracking-[-0.01em]">{patient.name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {patient.age} yrs · <span className="capitalize">{patient.gender}</span>
              {patient.phone && ` · ${patient.phone}`}
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Next appointment hero */}
      {nextApt && (
        <button
          onClick={() => onNavigate?.('appointments')}
          className="w-full text-left rounded-3xl p-5 border border-primary/20 transition-all hover:border-primary/40"
          style={{ background: 'linear-gradient(135deg, hsl(var(--primary)/0.10), hsl(var(--primary)/0.02))' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">Next Appointment</p>
              <p className="text-lg font-semibold mt-1">
                {new Date(nextApt.appointment_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {nextApt.time_slot}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 capitalize">{nextApt.status.replace('_', ' ')}</p>
            </div>
            <ChevronRight size={20} className="text-primary" />
          </div>
        </button>
      )}

      {/* Vitals strip */}
      {(patient.weight || heightMeters || bmi) && (
        <GlassCard className="p-5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.1em] mb-3">Vitals</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[11px] text-muted-foreground">Height</p>
              <p className="text-base font-semibold">
                {patient.heightFeet ? `${patient.heightFeet}'${patient.heightInches || 0}"` : patient.heightCm ? `${patient.heightCm} cm` : '—'}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Weight</p>
              <p className="text-base font-semibold">{patient.weight ? `${patient.weight} kg` : '—'}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">BMI</p>
              <p className="text-base font-semibold">
                {bmi ? bmi.toFixed(1) : '—'}
                {bmiLabel && <span className="text-[10px] text-muted-foreground font-normal ml-1">· {bmiLabel}</span>}
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Conditions & allergies */}
      {(patient.medicalConditions?.length || patient.allergies?.length) ? (
        <GlassCard className="p-5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.1em] mb-3">Health Profile</p>
          <div className="flex flex-wrap gap-2">
            {patient.medicalConditions?.map(c => (
              <span key={c} className="text-xs font-medium px-3 py-1.5 rounded-full" style={{ background: 'hsl(var(--secondary)/0.5)', color: 'hsl(var(--secondary-foreground))' }}>{c}</span>
            ))}
            {patient.allergies?.map(a => (
              <span key={a} className="text-xs font-medium px-3 py-1.5 rounded-full" style={{ background: 'hsl(var(--destructive)/0.1)', color: 'hsl(var(--destructive))' }}>⚠ {a}</span>
            ))}
          </div>
        </GlassCard>
      ) : null}

      {/* Stats row — clickable, navigates to the matching tab */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { key: 'appointments' as Tab, value: upcomingApts.length, label: 'Upcoming', icon: <Calendar size={18} className="text-primary" /> },
          { key: 'visits' as Tab, value: visits.length, label: 'Visits', icon: <Stethoscope size={18} className="text-primary" /> },
          { key: 'prescriptions' as Tab, value: prescriptions.length, label: 'Rx', icon: <FileText size={18} className="text-primary" /> },
        ].map(s => (
          <button
            key={s.label}
            onClick={() => onNavigate?.(s.key)}
            className="rounded-3xl border border-border/20 overflow-hidden p-4 text-center transition-all hover:border-primary/30 hover:-translate-y-0.5 btn-press"
            style={{ background: 'hsl(var(--card)/0.6)', backdropFilter: 'saturate(150%) blur(20px)', WebkitBackdropFilter: 'saturate(150%) blur(20px)' }}
          >
            <div className="flex justify-center mb-2">{s.icon}</div>
            <p className="text-2xl font-bold leading-none tracking-tight">{s.value}</p>
            <p className="text-[11px] text-muted-foreground mt-1.5 uppercase tracking-wider">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Latest Visit */}
      {latestVisit && (
        <GlassCard className="p-5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.1em] mb-3">Latest Visit</p>
          <div className="flex items-center justify-between">
            <p className="text-base font-medium">{new Date(latestVisit.createdAt).toLocaleDateString()}</p>
            <span className={cn("text-xs px-3 py-1 rounded-full font-medium",
              VISIT_STAGE_COLORS[latestVisit.stage as keyof typeof VISIT_STAGE_COLORS] || 'bg-muted text-muted-foreground'
            )}>
              {VISIT_STAGE_LABELS[latestVisit.stage as keyof typeof VISIT_STAGE_LABELS] || latestVisit.stage}
            </span>
          </div>
          {latestVisit.finalDiagnosis && <p className="text-sm text-muted-foreground mt-2">{latestVisit.finalDiagnosis}</p>}
        </GlassCard>
      )}
    </div>
  );
};

// ── Appointments Section ──
const AppointmentsSection: React.FC<{
  patient: PatientRecord; appointments: AppointmentRecord[];
  showBooking: boolean; setShowBooking: (v: boolean) => void;
  bookingDate: string; setBookingDate: (v: string) => void;
  bookingSlot: string; setBookingSlot: (v: string) => void; bookedSlots: string[];
  bookingComplaint: string; setBookingComplaint: (v: string) => void;
  bookingSubmitting: boolean; onBook: () => void;
  onStartCancel: (apt: AppointmentRecord) => void;
  onConfirmCancel: (apt: AppointmentRecord) => void;
  cancellingAptId: string | null; setCancellingAptId: (v: string | null) => void;
  patientCancelReason: string; setPatientCancelReason: (v: string) => void;
  onStartReschedule: (apt: AppointmentRecord) => void;
  reschedulingId: string | null;
  rescheduleDate: string; setRescheduleDate: (v: string) => void;
  rescheduleSlot: string; setRescheduleSlot: (v: string) => void; rescheduleBookedSlots: string[];
  rescheduleReason: string; setRescheduleReason: (v: string) => void;
  onConfirmReschedule: () => void; onCancelReschedule: () => void;
  todayStr: string; maxDateStr: string;
}> = (props) => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isBn = (i18n.language || '').startsWith('bn');
  const calLocale = isBn ? bnLocale : enLocale;
  const handleJoinCall = (apt: AppointmentRecord) => {
    navigate(`/call/${apt.id}`);
  };
  const statusStyle: Record<string, { bg: string; text: string }> = {
    pending: { bg: 'hsl(38 92% 50% / 0.1)', text: 'hsl(38 92% 40%)' },
    confirmed: { bg: 'hsl(var(--primary) / 0.08)', text: 'hsl(var(--primary))' },
    in_call: { bg: 'hsl(152 69% 31% / 0.15)', text: 'hsl(152 69% 31%)' },
    awaiting_prescription: { bg: 'hsl(239 84% 60% / 0.10)', text: 'hsl(239 84% 55%)' },
    cancelled: { bg: 'hsl(var(--destructive) / 0.08)', text: 'hsl(var(--destructive))' },
    completed: { bg: 'hsl(152 69% 31% / 0.1)', text: 'hsl(152 69% 31%)' },
    reschedule_requested: { bg: 'hsl(271 81% 56% / 0.1)', text: 'hsl(271 81% 56%)' },
  };
  const statusLabel: Record<string, string> = {
    pending: 'Pending', confirmed: 'Confirmed', in_call: 'In Call',
    awaiting_prescription: 'Awaiting Rx', cancelled: 'Cancelled',
    completed: 'Completed', reschedule_requested: 'Reschedule Pending',
  };


  return (
    <div className="space-y-4">
      {/* Book Button */}
      <button
        onClick={() => props.setShowBooking(!props.showBooking)}
        className="w-full flex items-center justify-between rounded-2xl p-4 text-sm font-medium text-primary transition-all duration-200"
        style={{ background: 'hsl(var(--primary)/0.06)', border: '1px solid hsl(var(--primary)/0.12)' }}
      >
        <span className="flex items-center gap-2"><CalendarPlus size={16} /> Book Appointment</span>
        <ChevronRight size={16} className={cn("transition-transform duration-200", props.showBooking && "rotate-90")} />
      </button>

      {/* Booking Form */}
      {props.showBooking && (
        <GlassCard className="p-5 space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
          <div>
            <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Select Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-2 h-11 rounded-xl border-border/30", !props.bookingDate && "text-muted-foreground")}>
                  <Calendar className="mr-2 h-4 w-4 text-primary" />
                  {props.bookingDate ? format(new Date(props.bookingDate + 'T00:00:00'), 'PPP', { locale: calLocale }) : (isBn ? 'তারিখ নির্বাচন করুন' : 'Pick a date')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker locale={calLocale} mode="single" selected={props.bookingDate ? new Date(props.bookingDate + 'T00:00:00') : undefined} onSelect={(date) => { if (date) props.setBookingDate(format(date, 'yyyy-MM-dd')); }} disabled={(date) => isBefore(date, startOfDay(new Date())) || isAfter(date, addDays(new Date(), 12))} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Time Slot</Label>
            <div className="flex gap-2 mt-2">
              {VALID_SLOTS.map(slot => {
                const isBooked = props.bookedSlots.includes(slot);
                return (
                  <button key={slot} disabled={isBooked || !props.bookingDate}
                    onClick={() => props.setBookingSlot(slot)}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-xs font-medium transition-all duration-200",
                      props.bookingSlot === slot
                        ? 'text-primary-foreground shadow-sm'
                        : isBooked
                        ? 'text-muted-foreground line-through cursor-not-allowed'
                        : 'text-foreground hover:border-primary/30'
                    )}
                    style={props.bookingSlot === slot
                      ? { background: 'hsl(var(--primary))' }
                      : isBooked
                      ? { background: 'hsl(var(--muted)/0.3)', border: '1px solid hsl(var(--border)/0.2)' }
                      : { background: 'hsl(var(--card)/0.5)', border: '1px solid hsl(var(--border)/0.3)' }
                    }>
                    {slot}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Complaint (optional)</Label>
            <Textarea value={props.bookingComplaint} onChange={e => props.setBookingComplaint(e.target.value)} rows={2} className="mt-2 resize-none rounded-xl border-border/30" placeholder="Describe your symptoms..." />
          </div>

          <div className="flex gap-2 pt-1">
            <Button onClick={props.onBook} disabled={props.bookingSubmitting || !props.bookingDate || !props.bookingSlot} className="flex-1 rounded-xl h-11">
              {props.bookingSubmitting && <Loader2 className="animate-spin mr-1.5" size={14} />}
              Submit Request
            </Button>
            <Button variant="ghost" onClick={() => props.setShowBooking(false)} className="text-muted-foreground rounded-xl h-11">Cancel</Button>
          </div>
        </GlassCard>
      )}

      {/* Appointments List */}
      {props.appointments.length === 0 ? (
        <div className="text-center py-20">
          <Calendar size={32} className="mx-auto mb-3 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">No appointments yet</p>
        </div>
      ) : props.appointments.map(apt => (
        <GlassCard key={apt.id} className="p-5 space-y-3">
          {(() => {
            const st = statusStyle[apt.status] || { bg: 'hsl(var(--muted)/0.1)', text: 'hsl(var(--muted-foreground))' };
            return (
              <>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[15px] font-medium tracking-[-0.01em]">
                {new Date(apt.appointment_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Clock size={11} /> {apt.time_slot}
              </p>
            </div>
            <span className="text-[10px] px-3 py-1.5 rounded-full font-semibold" style={{ background: st.bg, color: st.text }}>
              {statusLabel[apt.status] || apt.status}
            </span>
          </div>

          {apt.chief_complaint && <p className="text-xs text-muted-foreground">{apt.chief_complaint}</p>}

          {apt.status === 'reschedule_requested' && (
            <div className="p-3 rounded-2xl" style={{ background: 'hsl(271 81% 56% / 0.06)', border: '1px solid hsl(271 81% 56% / 0.1)' }}>
              <p className="text-[11px] font-medium flex items-center gap-1" style={{ color: 'hsl(271 81% 56%)' }}>
                <RefreshCw size={11} /> Awaiting doctor approval
              </p>
              {apt.reschedule_date && (
                <p className="text-[11px] mt-0.5" style={{ color: 'hsl(271 81% 46%)' }}>
                  New: {new Date(apt.reschedule_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at {apt.reschedule_time_slot}
                </p>
              )}
            </div>
          )}

          {apt.status === 'cancelled' && apt.cancel_reason && (
            <div className="p-3 rounded-2xl" style={{ background: 'hsl(var(--destructive)/0.05)', border: '1px solid hsl(var(--destructive)/0.1)' }}>
              <p className="text-[11px] text-destructive"><span className="font-medium">Reason:</span> {apt.cancel_reason}</p>
            </div>
          )}

          {(['pending', 'confirmed', 'in_call', 'awaiting_prescription'].includes(apt.status) || ALWAYS_JOIN_PATIENT_IDS.has(apt.patient_id || '')) && props.cancellingAptId !== apt.id && (
            <div className="flex flex-wrap gap-2 pt-0.5">
              {(['confirmed', 'in_call', 'awaiting_prescription', 'pending'].includes(apt.status) || ALWAYS_JOIN_PATIENT_IDS.has(apt.patient_id || '')) && (() => {
                const w = getJoinWindowState(apt.appointment_date, apt.time_slot, new Date(), { status: apt.status, patientId: apt.patient_id });
                if (w.canJoin) {
                  return (
                    <button
                      onClick={() => handleJoinCall(apt)}
                      className="text-[11px] px-4 py-2 rounded-xl font-medium transition-all text-white shadow-sm"
                      style={{ background: 'linear-gradient(135deg, hsl(152 69% 35%), hsl(174 72% 38%))' }}>
                      📹 {apt.status === 'confirmed' ? 'Join your appointment' : 'Rejoin your appointment'}
                    </button>
                  );
                }
                return null;
              })()}
              {canPatientModifyAppointment(apt) && (
                <>
                  <button onClick={() => props.onStartCancel(apt)}
                    className="text-[11px] px-4 py-2 rounded-xl text-destructive font-medium transition-all" style={{ background: 'hsl(var(--destructive)/0.06)' }}>
                    Cancel
                  </button>
                  <button onClick={() => props.onStartReschedule(apt)}
                    className="text-[11px] px-4 py-2 rounded-xl text-primary font-medium transition-all" style={{ background: 'hsl(var(--primary)/0.06)' }}>
                    Reschedule
                  </button>
                </>
              )}
            </div>
          )}

          {/* Patient cancellation reason input */}
          {props.cancellingAptId === apt.id && (
            <div className="pt-3 border-t border-border/20 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Why are you cancelling? <span className="text-destructive">*</span></Label>
                <Textarea value={props.patientCancelReason} onChange={e => props.setPatientCancelReason(e.target.value)} rows={2} className="mt-2 resize-none rounded-xl border-border/30" placeholder="Please provide a reason..." />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={() => props.onConfirmCancel(apt)} disabled={!props.patientCancelReason.trim()} className="rounded-xl">Confirm Cancel</Button>
                <Button size="sm" variant="ghost" onClick={() => props.setCancellingAptId(null)} className="text-muted-foreground rounded-xl">Back</Button>
              </div>
            </div>
          )}

          {props.reschedulingId === apt.id && (
            <div className="pt-3 border-t border-border/20 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">New Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-2 rounded-xl border-border/30", !props.rescheduleDate && "text-muted-foreground")} size="sm">
                      <Calendar className="mr-2 h-3 w-3" />
                      {props.rescheduleDate ? format(new Date(props.rescheduleDate + 'T00:00:00'), 'PPP', { locale: calLocale }) : (isBn ? 'তারিখ' : 'Pick date')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarPicker locale={calLocale} mode="single" selected={props.rescheduleDate ? new Date(props.rescheduleDate + 'T00:00:00') : undefined} onSelect={(date) => { if (date) props.setRescheduleDate(format(date, 'yyyy-MM-dd')); }} disabled={(date) => isBefore(date, startOfDay(new Date())) || isAfter(date, addDays(new Date(), 12))} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">New Time</Label>
                <div className="flex gap-1.5 mt-2">
                  {VALID_SLOTS.map(slot => {
                    const isBooked = props.rescheduleBookedSlots.includes(slot);
                    return (
                      <button key={slot} disabled={isBooked || !props.rescheduleDate}
                        onClick={() => props.setRescheduleSlot(slot)}
                        className={cn(
                          "flex-1 py-2 rounded-xl text-[11px] font-medium transition-all",
                          props.rescheduleSlot === slot ? 'text-primary-foreground' :
                          isBooked ? 'text-muted-foreground line-through cursor-not-allowed' :
                          'text-foreground'
                        )}
                        style={props.rescheduleSlot === slot
                          ? { background: 'hsl(var(--primary))' }
                          : isBooked
                          ? { background: 'hsl(var(--muted)/0.3)', border: '1px solid hsl(var(--border)/0.2)' }
                          : { background: 'hsl(var(--card)/0.5)', border: '1px solid hsl(var(--border)/0.3)' }
                        }>
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Reason for rescheduling <span className="text-destructive">*</span></Label>
                <Textarea value={props.rescheduleReason} onChange={e => props.setRescheduleReason(e.target.value)} rows={2} className="mt-2 resize-none rounded-xl border-border/30" placeholder="Please tell the doctor why you need to reschedule..." />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={props.onConfirmReschedule} disabled={!props.rescheduleReason.trim() || !props.rescheduleDate || !props.rescheduleSlot} className="flex-1 rounded-xl">Confirm</Button>
                <Button size="sm" variant="ghost" onClick={props.onCancelReschedule} className="text-muted-foreground rounded-xl">Cancel</Button>
              </div>
            </div>
          )}
              </>
            );
          })()}
        </GlassCard>
      ))}
    </div>
  );
};

// ── Visits Tab ──
const VisitsTab: React.FC<{ visits: VisitRecord[] }> = ({ visits }) => {
  const { t } = useTranslation();
  return (
  <div className="space-y-4">
    {visits.length === 0 ? (
      <div className="text-center py-20">
        <Stethoscope size={32} className="mx-auto mb-3 text-muted-foreground/20" />
        <p className="text-sm text-muted-foreground">{t('patient.noVisits')}</p>
      </div>
    ) : visits.map(v => (
      <GlassCard key={v.id} className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-medium tracking-[-0.01em]">{new Date(v.createdAt).toLocaleDateString()}</span>
          <span className={cn("text-xs font-medium px-3 py-1 rounded-full",
            VISIT_STAGE_COLORS[v.stage as keyof typeof VISIT_STAGE_COLORS] || 'bg-muted text-muted-foreground'
          )}>
            {VISIT_STAGE_LABELS[v.stage as keyof typeof VISIT_STAGE_LABELS] || v.stage}
          </span>
        </div>
        {v.chiefComplaint && <p className="text-sm"><span className="text-muted-foreground">Complaint:</span> {v.chiefComplaint}</p>}
        {v.finalDiagnosis && <p className="text-sm"><span className="text-muted-foreground">Diagnosis:</span> {v.finalDiagnosis}</p>}
        {v.advice && <p className="text-sm"><span className="text-muted-foreground">Advice:</span> {v.advice}</p>}
        {v.medicines && (v.medicines as any[]).length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {(v.medicines as any[]).map((m: any, i: number) => (
              <span key={i} className="text-xs px-3 py-1.5 rounded-full font-medium" style={{ background: 'hsl(var(--secondary)/0.5)', color: 'hsl(var(--secondary-foreground))' }}>{m.name}</span>
            ))}
          </div>
        )}
      </GlassCard>
    ))}
  </div>
  );
};

// ── Prescriptions Tab ──
const PrescriptionsTab: React.FC<{ prescriptions: PrescriptionRecord[]; onView: (rx: PrescriptionRecord) => void }> = () => {
  const { t } = useTranslation();
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data: pat } = await supabase.from('patients').select('id').eq('user_id', userData.user.id).maybeSingle();
      if (!pat) { if (mounted) setLoading(false); return; }
      const { data } = await supabase.from('prescription_files')
        .select('*').eq('patient_id', pat.id).order('created_at', { ascending: false });
      if (mounted) { setFiles(data ?? []); setLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  const handleDownload = async (f: any) => {
    const { data, error } = await supabase.storage.from('prescriptions').createSignedUrl(f.file_path, 3600);
    if (error || !data) { toast.error('Cannot open file'); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading) return <div className="text-center py-20 text-sm text-muted-foreground">Loading…</div>;
  if (files.length === 0) return (
    <div className="text-center py-20">
      <FileText size={32} className="mx-auto mb-3 text-muted-foreground/20" />
      <p className="text-sm text-muted-foreground">{t("patient.noPrescriptions")}</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {files.map(f => (
        <GlassCard key={f.id} className="p-4 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium truncate">{f.file_name}</p>
            <p className="text-xs text-muted-foreground">{new Date(f.created_at).toLocaleString()}</p>
          </div>
          <button onClick={() => handleDownload(f)} className="w-10 h-10 rounded-xl flex items-center justify-center text-primary hover:bg-primary/10 transition-all">
            <Download size={16} />
          </button>
        </GlassCard>
      ))}
    </div>
  );
};

// ── Files Tab (Reports + Previous Prescriptions) ──
const FileSection: React.FC<{
  title: string; emptyText: string; uploadLabel: string; icon: React.ReactNode;
  files: ReportRecord[]; uploading: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onView: (r: ReportRecord) => void; onDownload: (r: ReportRecord) => void;
}> = ({ title, emptyText, uploadLabel, icon, files, uploading, onUpload, onView, onDownload }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 px-1">
      {icon}
      <h3 className="text-sm font-semibold">{title}</h3>
      <span className="ml-auto text-xs text-muted-foreground">{files.length}</span>
    </div>
    <label className="flex items-center justify-center gap-2.5 rounded-2xl p-5 cursor-pointer transition-all duration-200" style={{ background: 'hsl(var(--primary)/0.04)', border: '2px dashed hsl(var(--primary)/0.15)' }}>
      <Upload size={16} className="text-primary" />
      <span className="text-sm font-medium text-primary">{uploading ? 'Uploading...' : uploadLabel}</span>
      <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" onChange={onUpload} disabled={uploading} />
    </label>
    {files.length === 0 ? (
      <p className="text-center text-xs text-muted-foreground py-6">{emptyText}</p>
    ) : files.map(r => (
      <GlassCard key={r.id} className="p-4 flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium truncate tracking-[-0.01em]">{r.fileName}</p>
          <p className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button onClick={() => onView(r)} className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground transition-all" style={{ background: 'hsl(var(--muted)/0.2)' }}>
            <Eye size={16} />
          </button>
          <button onClick={() => onDownload(r)} className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground transition-all" style={{ background: 'hsl(var(--muted)/0.2)' }}>
            <Download size={16} />
          </button>
        </div>
      </GlassCard>
    ))}
  </div>
);

const FilesTab: React.FC<{
  reports: ReportRecord[]; uploading: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>, category: 'report' | 'prescription') => void;
  onView: (r: ReportRecord) => void; onDownload: (r: ReportRecord) => void;
  onDownloadSummary: () => void; onShareSummary: () => void;
}> = ({ reports, uploading, onUpload, onView, onDownload, onDownloadSummary }) => {
  const reportFiles = reports.filter(r => r.category !== 'prescription');
  const prescriptionFiles = reports.filter(r => r.category === 'prescription');
  return (
    <div className="space-y-6">
      <button onClick={onDownloadSummary} className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 px-4 text-sm font-medium text-primary-foreground transition-all" style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary)/0.85))', boxShadow: '0 4px 16px hsl(var(--primary)/0.25)' }}>
        <Download size={16} /> Download Patient Summary
      </button>

      <FileSection
        title="Reports"
        emptyText="No reports uploaded yet"
        uploadLabel="Upload Report (lab, scan, etc.)"
        icon={<FlaskConical size={16} className="text-primary" />}
        files={reportFiles}
        uploading={uploading}
        onUpload={(e) => onUpload(e, 'report')}
        onView={onView}
        onDownload={onDownload}
      />

      <FileSection
        title="Previous Prescriptions"
        emptyText="No previous prescriptions uploaded yet"
        uploadLabel="Upload Previous Prescription"
        icon={<Pill size={16} className="text-primary" />}
        files={prescriptionFiles}
        uploading={uploading}
        onUpload={(e) => onUpload(e, 'prescription')}
        onView={onView}
        onDownload={onDownload}
      />
    </div>
  );
};

// ── Account Tab (edit name/age/DOB, view email — no avatar, no password) ──
const AccountTab: React.FC<{ patient: PatientRecord; onPatientUpdated: () => void; onSignOut: () => void }> = ({ patient, onPatientUpdated, onSignOut }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState<string>('');
  const [name, setName] = useState(patient.name);
  const [age, setAge] = useState<string>(String(patient.age ?? ''));
  const [dob, setDob] = useState<string>(patient.dateOfBirth ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(patient.avatarUrl);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) setEmail(user.email);
    })();
  }, []);

  useEffect(() => {
    setName(patient.name);
    setAge(String(patient.age ?? ''));
    setDob(patient.dateOfBirth ?? '');
    setAvatarUrl(patient.avatarUrl);
  }, [patient.id, patient.name, patient.age, patient.dateOfBirth]);

  const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast.error('Image must be under 8 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const handleCroppedSave = async (blob: Blob) => {
    setUploadingAvatar(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const path = `${user.id}/avatar.jpg`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const cacheBusted = `${pub.publicUrl}?v=${Date.now()}`;
      const { error: updErr } = await (supabase as any).from('patients').update({ avatar_url: cacheBusted, updated_at: new Date().toISOString() }).eq('id', patient.id);
      if (updErr) throw updErr;
      setAvatarUrl(cacheBusted);
      toast.success('Profile picture updated');
      onPatientUpdated();
      setCropSrc(null);
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const removeAvatar = async () => {
    await (supabase as any).from('patients').update({ avatar_url: null, updated_at: new Date().toISOString() }).eq('id', patient.id);
    setAvatarUrl(undefined);
    onPatientUpdated();
  };

  const saveProfile = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    const ageNum = parseInt(age, 10);
    if (!ageNum || ageNum < 0 || ageNum > 150) { toast.error('Enter a valid age'); return; }
    setSavingProfile(true);
    const { error } = await (supabase as any).from('patients')
      .update({ name: name.trim(), age: ageNum, date_of_birth: dob || null, updated_at: new Date().toISOString() })
      .eq('id', patient.id);
    setSavingProfile(false);
    if (error) { toast.error(error.message || 'Failed to update profile'); return; }
    toast.success('Profile updated');
    onPatientUpdated();
  };

  return (
    <div className="space-y-5">
      {cropSrc && (
        <AvatarCropperModal
          imageSrc={cropSrc}
          onCancel={() => setCropSrc(null)}
          onSave={handleCroppedSave}
        />
      )}
      <GlassCard className="p-5 space-y-4">
        <div className="flex items-center gap-4 pb-2 border-b border-border/20">
          <div className="relative shrink-0">
            <div className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center ring-2 ring-primary/15" style={{ background: 'hsl(var(--primary)/0.1)' }}>
              {avatarUrl ? <img src={avatarUrl} alt={patient.name} className="w-full h-full object-cover" /> : <User size={32} className="text-primary/60" />}
            </div>
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              aria-label="Change profile photo"
              className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg ring-2 ring-card btn-press disabled:opacity-50"
            >
              {uploadingAvatar ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            </button>
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <p className="text-sm font-semibold truncate">{patient.name}</p>
            <p className="text-xs text-muted-foreground">Tap the camera icon to update your photo.</p>
            {avatarUrl && <button onClick={removeAvatar} className="text-xs text-destructive hover:underline">Remove photo</button>}
            <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePickFile} className="hidden" />
          </div>
        </div>

        <div className="flex items-center gap-2 mb-1">
          <User size={16} className="text-primary" />
          <h3 className="text-sm font-semibold">Personal Details</h3>
        </div>

        <div>
          <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Full Name</Label>
          <Input value={name} onChange={e => setName(e.target.value)} className="mt-2 rounded-xl border-border/30 h-11" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Age</Label>
            <Input type="number" min={0} max={150} value={age} onChange={e => setAge(e.target.value)} className="mt-2 rounded-xl border-border/30 h-11" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Date of Birth</Label>
            <Input type="date" min="1900-01-01" max={new Date().toISOString().split('T')[0]} value={dob} onChange={e => setDob(e.target.value)} className="mt-2 rounded-xl border-border/30 h-11" />
          </div>
        </div>

        <div>
          <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Email</Label>
          <Input value={email} readOnly disabled className="mt-2 rounded-xl border-border/30 h-11 bg-muted/30 cursor-not-allowed" />
        </div>

        <Button onClick={saveProfile} disabled={savingProfile} className="w-full rounded-xl h-11">
          {savingProfile ? <Loader2 className="animate-spin mr-1.5" size={14} /> : <Save size={14} className="mr-1.5" />}
          {t('common.save')}
        </Button>
        <Button type="button" variant="outline" onClick={onSignOut} className="w-full rounded-xl h-11 text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive">
          <LogOut size={14} className="mr-1.5" />
          {t('common.signOut')}
        </Button>
      </GlassCard>
    </div>
  );
};

// ── More menu (mobile) — links to Visits, Files, Account, Settings ──
const MoreMenu: React.FC<{ onPick: (k: Tab) => void; onSignOut: () => void }> = ({ onPick, onSignOut }) => {
  const { t } = useTranslation();
  const items: { key: Tab; label: string; icon: React.ReactNode; hint: string }[] = [
    { key: 'visits', label: t('nav.visits'), icon: <Stethoscope size={18} className="text-primary" />, hint: t('patient.visitHistory') },
    { key: 'files', label: t('nav.files'), icon: <FolderOpen size={18} className="text-primary" />, hint: t('patient.reportsUploads') },
    { key: 'account', label: t('nav.account'), icon: <User size={18} className="text-primary" />, hint: t('patient.personalDetailsHint') },
    { key: 'settings', label: t('nav.settings'), icon: <SettingsIcon size={18} className="text-primary" />, hint: t('patient.appearanceMore') },
  ];
  return (
    <div className="space-y-3">
      {/* Prominent User Manual card — bilingual (Bn/En) help for elderly users */}
      <button
        type="button"
        onClick={() => onPick('manual')}
        className="w-full rounded-3xl p-5 text-left border border-border/20 flex items-center gap-4 transition-all hover:scale-[1.01] active:scale-[0.99]"
        style={{
          background: 'linear-gradient(135deg, hsl(var(--primary)/0.10), hsl(var(--primary)/0.02))',
          backdropFilter: 'saturate(150%) blur(20px)',
          boxShadow: '0 2px 16px hsl(var(--primary)/0.08)',
        }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: 'hsl(var(--primary)/0.15)', color: 'hsl(var(--primary))' }}
        >
          <FileText size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">User Manual / সহায়িকা</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            বাংলা ও English-এ step-by-step guide
          </p>
        </div>
        <ChevronRight size={16} className="text-primary" />
      </button>

      <GlassCard className="overflow-hidden">
        <ul className="divide-y divide-border/15">
          {items.map(it => (
            <li key={it.key}>
              <button
                onClick={() => onPick(it.key)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-foreground/5 transition-colors"
              >
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'hsl(var(--primary)/0.08)' }}>
                  {it.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{it.label}</p>
                  <p className="text-[11px] text-muted-foreground">{it.hint}</p>
                </div>
                <ChevronRight size={16} className="text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      </GlassCard>

      <GlassCard className="overflow-hidden">
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-5 py-4 text-left text-destructive hover:bg-destructive/5 transition-colors"
        >
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'hsl(var(--destructive)/0.08)' }}>
            <LogOut size={18} />
          </div>
          <p className="text-sm font-medium">{t("common.signOut")}</p>
        </button>
      </GlassCard>
    </div>
  );
};

// ── Patient Settings tab — full appearance controls ──
const P_MODES: { id: 'system' | 'light' | 'dark'; label: string; icon: typeof Sun; desc: string }[] = [
  { id: 'system', label: 'System', icon: Monitor, desc: 'Follow device' },
  { id: 'light', label: 'Light', icon: Sun, desc: 'Always light' },
  { id: 'dark', label: 'Dark', icon: Moon, desc: 'Always dark' },
];
const P_ACCENTS: { id: 'slate' | 'blue' | 'emerald' | 'violet' | 'rose' | 'amber' | 'teal' | 'sky' | 'pink' | 'lime' | 'indigo'; label: string; swatch: string }[] = [
  { id: 'slate', label: 'Slate', swatch: '#334155' },
  { id: 'blue', label: 'Blue', swatch: '#2563eb' },
  { id: 'emerald', label: 'Emerald', swatch: '#10b981' },
  { id: 'violet', label: 'Violet', swatch: '#7c3aed' },
  { id: 'rose', label: 'Rose', swatch: '#e11d48' },
  { id: 'amber', label: 'Amber', swatch: '#f59e0b' },
  { id: 'teal', label: 'Teal', swatch: '#0d9488' },
  { id: 'sky', label: 'Sky', swatch: '#0ea5e9' },
  { id: 'pink', label: 'Pink', swatch: '#ec4899' },
  { id: 'lime', label: 'Lime', swatch: '#84cc16' },
  { id: 'indigo', label: 'Indigo', swatch: '#4f46e5' },
];
const P_GRADIENTS: { id: 'aurora' | 'sunset' | 'ocean' | 'lavender' | 'peach' | 'forest' | 'midnight' | 'none'; label: string; preview: string }[] = [
  { id: 'aurora', label: 'Aurora', preview: 'linear-gradient(135deg, #c4b5fd, #a5b4fc, #f9a8d4)' },
  { id: 'sunset', label: 'Sunset', preview: 'linear-gradient(135deg, #fdba74, #fb7185, #fde68a)' },
  { id: 'ocean', label: 'Ocean', preview: 'linear-gradient(135deg, #93c5fd, #67e8f9, #a5b4fc)' },
  { id: 'lavender', label: 'Lavender', preview: 'linear-gradient(135deg, #d8b4fe, #c4b5fd, #f5d0fe)' },
  { id: 'peach', label: 'Peach', preview: 'linear-gradient(135deg, #fed7aa, #fda4af, #fef08a)' },
  { id: 'forest', label: 'Forest', preview: 'linear-gradient(135deg, #86efac, #a7f3d0, #bef264)' },
  { id: 'midnight', label: 'Midnight', preview: 'linear-gradient(135deg, #818cf8, #6366f1, #a78bfa)' },
  { id: 'none', label: 'None', preview: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)' },
];
const P_SCALES: { id: 'sm' | 'md' | 'lg'; label: string }[] = [
  { id: 'sm', label: 'Small' }, { id: 'md', label: 'Default' }, { id: 'lg', label: 'Large' },
];

const PatientSettingsTab: React.FC = () => {
  const { mode, setMode, accent, setAccent, gradient, setGradient, fontScale, setFontScale } = useThemeFull();
  const { i18n } = useTranslation();
  const currentLang = (i18n.language?.startsWith('en') ? 'en' : 'bn') as 'bn' | 'en';
  const setLang = (l: 'bn' | 'en') => {
    i18n.changeLanguage(l);
    try { localStorage.setItem('medhelp.lang', l); } catch { /* ignore */ }
  };
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  return (
    <div className="space-y-5">
      {/* Quick controls — Language */}
      <GlassCard className="p-5 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Globe size={16} className="text-primary" /> Language / ভাষা
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {(['bn', 'en'] as const).map((l) => {
            const active = currentLang === l;
            return (
              <button key={l} onClick={() => setLang(l)}
                className={cn('flex items-center justify-between rounded-xl border p-3 text-left transition btn-press',
                  active ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-border/30 hover:border-foreground/30')}>
                <span className="text-sm font-semibold">{l === 'bn' ? 'বাংলা' : 'English'}</span>
                {active && <Check size={14} className="text-primary" />}
              </button>
            );
          })}
        </div>
      </GlassCard>

      {/* Quick controls — Color mode */}
      <GlassCard className="p-5 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Sun size={16} className="text-primary" /> Color mode
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {P_MODES.map((m) => {
            const active = mode === m.id;
            const Icon = m.icon;
            return (
              <button key={m.id} onClick={() => setMode(m.id)}
                className={cn('flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition btn-press',
                  active ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-border/30 hover:border-foreground/30')}>
                <Icon size={18} />
                <span className="text-xs font-medium">{m.label}</span>
              </button>
            );
          })}
        </div>
      </GlassCard>

      {/* Quick controls — Text size */}
      <GlassCard className="p-5 space-y-3">
        <h3 className="text-sm font-semibold">Text size</h3>
        <div className="inline-flex rounded-xl border border-border/30 p-1">
          {P_SCALES.map((s) => (
            <button key={s.id} onClick={() => setFontScale(s.id)}
              className={cn('rounded-lg px-4 py-1.5 text-sm transition btn-press',
                fontScale === s.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {s.label}
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Appearance — collapsible */}
      <GlassCard className="p-5">
        <button
          type="button"
          onClick={() => setAppearanceOpen(v => !v)}
          className="w-full flex items-center justify-between text-left btn-press"
          aria-expanded={appearanceOpen}
        >
          <span className="flex items-center gap-2">
            <SettingsIcon size={16} className="text-primary" />
            <h3 className="text-sm font-semibold">Appearance</h3>
          </span>
          <ChevronRight size={16} className={cn('text-muted-foreground transition-transform', appearanceOpen && 'rotate-90')} />
        </button>

        {appearanceOpen && (
          <div className="space-y-6 mt-5 animate-in fade-in slide-in-from-top-1 duration-200">
            <p className="text-[12px] text-muted-foreground">Personalise how the dashboard looks. Saved on this device.</p>

            <section className="space-y-3">
              <h4 className="text-xs font-medium text-muted-foreground">Color mode</h4>
              <div className="grid gap-3 sm:grid-cols-3">
                {P_MODES.map((m) => {
                  const active = mode === m.id;
                  const Icon = m.icon;
                  return (
                    <button key={m.id} onClick={() => setMode(m.id)}
                      className={cn('flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition btn-press',
                        active ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-border/30 hover:border-foreground/30')}>
                      <Icon size={18} />
                      <div>
                        <div className="text-sm font-medium">{m.label}</div>
                        <div className="text-xs text-muted-foreground">{m.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-xs font-medium text-muted-foreground">Accent color</h4>
              <div className="flex flex-wrap gap-2">
                {P_ACCENTS.map((a) => {
                  const active = accent === a.id;
                  return (
                    <button key={a.id} onClick={() => setAccent(a.id)}
                      className={cn('flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition btn-press',
                        active ? 'border-primary ring-2 ring-primary/30' : 'border-border/30 hover:border-foreground/30')}>
                      <span className="h-4 w-4 rounded-full ring-1 ring-border" style={{ background: a.swatch }} />
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-xs font-medium text-muted-foreground">Background gradient</h4>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                {P_GRADIENTS.map((g) => {
                  const active = gradient === g.id;
                  return (
                    <button key={g.id} onClick={() => setGradient(g.id)}
                      className={cn('overflow-hidden rounded-2xl border p-2 text-left transition btn-press',
                        active ? 'border-primary ring-2 ring-primary/30' : 'border-border/30 hover:border-foreground/30')}>
                      <div className="h-12 w-full rounded-md ring-1 ring-border" style={{ background: g.preview }} />
                      <div className="mt-2 text-xs font-medium">{g.label}</div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-xs font-medium text-muted-foreground">Text size</h4>
              <div className="inline-flex rounded-xl border border-border/30 p-1">
                {P_SCALES.map((s) => (
                  <button key={s.id} onClick={() => setFontScale(s.id)}
                    className={cn('rounded-lg px-3 py-1.5 text-sm transition btn-press',
                      fontScale === s.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                    {s.label}
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}
      </GlassCard>

      <p className="text-center text-[11px] text-muted-foreground pt-2">MedHelp · v1.0.0</p>
    </div>
  );
};


// ── Notification settings card ──
const NotificationSettingsCard: React.FC = () => {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  );
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return true;
    return localStorage.getItem('notif_enabled') !== '0';
  });

  const toggle = async () => {
    if (permission === 'unsupported') { toast.error('Notifications not supported on this device'); return; }
    const next = !enabled;
    if (next && permission !== 'granted') {
      const ok = await requestNotificationPermission();
      setPermission(Notification.permission);
      if (!ok) { toast.error('Permission denied'); return; }
      showBrowserNotification('Notifications on', 'You\'ll be notified about appointments and calls.');
    }
    localStorage.setItem('notif_enabled', next ? '1' : '0');
    setEnabled(next);
    toast.success(next ? 'Notifications enabled' : 'Notifications muted');
  };

  return (
    <GlassCard className="p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Bell size={16} className="text-primary" />
        <h3 className="text-sm font-semibold">Notifications</h3>
      </div>
      <p className="text-[12px] text-muted-foreground">
        Control browser pop-up notifications on this device for reminders, call invites, and updates.
      </p>
      <div className="flex items-center justify-between rounded-2xl border border-border/30 p-3.5" style={{ background: 'hsl(var(--muted)/0.25)' }}>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Browser notifications</p>
          <p className="text-[11px] text-muted-foreground capitalize">
            {permission === 'unsupported' ? 'Not supported' : `Permission: ${permission}`}
          </p>
        </div>
        <button
          onClick={toggle}
          role="switch"
          aria-checked={enabled && permission === 'granted'}
          className={cn(
            'relative w-11 h-6 rounded-full transition-colors btn-press',
            enabled && permission === 'granted' ? 'bg-primary' : 'bg-muted'
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
              enabled && permission === 'granted' && 'translate-x-5'
            )}
          />
        </button>
      </div>
    </GlassCard>
  );
};


export default PatientDashboard;
