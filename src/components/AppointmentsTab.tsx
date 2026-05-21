import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, Check, X, CheckCircle2, Clock, Filter, RefreshCw, CalendarClock, ChevronDown, ChevronUp, User, Phone, MapPin, Briefcase, Heart, Activity, AlertCircle, Video } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { sendAppointmentEmail } from '@/lib/appointmentEmail';
import { notifyUser, getPatientUserId } from '@/lib/push';
import { getJoinWindowState, ALWAYS_JOIN_PATIENT_IDS } from '@/lib/appointmentWindow';
import { showBrowserNotification } from '@/lib/notifications';
import { canDoctorModifyAppointment, getClinicTodayDateString, getEffectiveAppointmentStatus, shouldAutoCompleteAppointment } from '@/lib/appointmentRules';
interface Appointment {
  id: string;
  patient_id: string | null;
  patient_name: string;
  patient_phone: string | null;
  patient_email: string | null;
  appointment_date: string;
  time_slot: string;
  chief_complaint: string | null;
  status: string;
  created_at: string;
  cancel_reason: string | null;
  reschedule_date: string | null;
  reschedule_time_slot: string | null;
  google_meet_link?: string | null;
}

type FilterType = 'today' | 'week' | 'all';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  in_call: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 animate-pulse',
  awaiting_prescription: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  reschedule_requested: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  in_call: 'In Call',
  awaiting_prescription: 'Awaiting Rx',
  cancelled: 'Cancelled',
  completed: 'Completed',
  reschedule_requested: 'Reschedule Requested',
};

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

const AppointmentsTab: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<'date' | 'status'>('date');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [patientDetails, setPatientDetails] = useState<Record<string, any>>({});
  const [patientAvatars, setPatientAvatars] = useState<Record<string, string | null>>({});
  const [loadingPatient, setLoadingPatient] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());

  // Re-evaluate join windows every 30s so buttons enable/disable on time.
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const handleJoinCall = (apt: Appointment) => {
    navigate(`/call/${apt.id}`);
  };

  // Doctor manually ends a session early — closes the re-join window so the
  // patient can't rejoin within the remaining 30-min slot. Sets session_ended_at
  // so getJoinWindowState() will hide the Join button instantly for everyone.
  const handleEndSession = async (apt: Appointment) => {
    if (!window.confirm(t('apptTab.endSessionConfirm'))) return;
    const { error } = await supabase.from('appointments').update({
      status: 'completed',
      session_ended_at: new Date().toISOString(),
      session_ended_by: 'doctor',
      updated_at: new Date().toISOString(),
    } as any).eq('id', apt.id);
    if (error) { toast.error(t('apptTab.sessionEndFailed')); return; }
    toast.success(t('apptTab.sessionEnded'));
    fetchAppointments();
  };

  // Cancel flow
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Doctor reschedule flow
  const [doctorReschedulingId, setDoctorReschedulingId] = useState<string | null>(null);
  const [doctorRescheduleDate, setDoctorRescheduleDate] = useState('');
  const [doctorRescheduleSlot, setDoctorRescheduleSlot] = useState('');
  const VALID_SLOTS = ['9:00 PM', '9:30 PM', '10:00 PM', '10:30 PM'];

  const handleDoctorReschedule = (id: string) => {
    setDoctorReschedulingId(id);
    setDoctorRescheduleDate('');
    setDoctorRescheduleSlot('');
    setCancellingId(null);
  };

  // Toggle expanded patient detail panel; lazy-load patient row.
  const toggleExpand = async (apt: Appointment) => {
    if (expandedId === apt.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(apt.id);
    if (apt.patient_id && !patientDetails[apt.patient_id]) {
      setLoadingPatient(apt.patient_id);
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', apt.patient_id)
        .maybeSingle();
      if (!error && data) {
        setPatientDetails(prev => ({ ...prev, [apt.patient_id!]: data }));
      }
      setLoadingPatient(null);
    }
  };

  const confirmDoctorReschedule = async (apt: Appointment) => {
    if (!doctorRescheduleDate || !doctorRescheduleSlot) { toast.error('Select date and time'); return; }
    // Clear any prior calendar event so a fresh one is created for the new slot
    const { error } = await supabase.from('appointments').update({
      appointment_date: doctorRescheduleDate,
      time_slot: doctorRescheduleSlot,
      status: 'confirmed',
      google_event_id: null,
      google_meet_link: null,
      updated_at: new Date().toISOString(),
    } as any).eq('id', apt.id);
    if (error) { toast.error('Failed to reschedule'); return; }
    toast.success('Appointment rescheduled');
    setDoctorReschedulingId(null);


    if (apt.patient_email) {
      sendAppointmentEmail({
        type: 'reschedule_approved',
        to: apt.patient_email,
        patientName: apt.patient_name,
        date: apt.appointment_date,
        time: apt.time_slot,
        newDate: doctorRescheduleDate,
        newTime: doctorRescheduleSlot,
      });
    }
    getPatientUserId(apt.patient_id).then(uid => notifyUser(uid, 'Appointment rescheduled', `New time: ${doctorRescheduleDate} ${doctorRescheduleSlot}`, { aptId: apt.id }));
    fetchAppointments();
  };

  const fetchAppointments = useCallback(async () => {
    const today = getClinicTodayDateString();
    let query = supabase.from('appointments').select('*').order('appointment_date', { ascending: true });

    if (filter === 'today') {
      query = query.eq('appointment_date', today);
    } else if (filter === 'week') {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      query = query.gte('appointment_date', today).lte('appointment_date', nextWeek.toISOString().split('T')[0]);
    } else {
      query = query.gte('appointment_date', today);
    }

    const { data, error } = await query;
    if (error) { console.error(error); return; }
    const normalized = (data ?? []).map((apt: any) => ({ ...apt, status: getEffectiveAppointmentStatus(apt) })) as Appointment[];
    setAppointments(normalized);
    const autoCompleteIds = (data ?? []).filter((apt: any) => shouldAutoCompleteAppointment(apt)).map((apt: any) => apt.id);
    if (autoCompleteIds.length > 0) {
      await supabase.from('appointments').update({ status: 'completed', updated_at: new Date().toISOString() } as any).in('id', autoCompleteIds);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  // Fetch avatars for all patients shown in the list (bulk lookup).
  useEffect(() => {
    const ids = Array.from(new Set(appointments.map(a => a.patient_id).filter((x): x is string => !!x && !(x in patientAvatars))));
    if (ids.length === 0) return;
    (async () => {
      const { data } = await (supabase as any).from('patients').select('id, n').in('id', ids);
      if (!data) return;
      setPatientAvatars(prev => {
        const next = { ...prev };
        for (const row of data) next[row.id] = row.n ?? null;
        return next;
      });
    })();
  }, [appointments, patientAvatars]);

  // Schedule a browser notification at appointment time for confirmed appts.
  useEffect(() => {
    const timeouts: number[] = [];
    appointments.forEach(apt => {
      if (apt.status !== 'confirmed') return;
      const start = (() => {
        const m = apt.time_slot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (!m) return null;
        let h = parseInt(m[1], 10); const mi = parseInt(m[2], 10);
        if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
        if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
        const d = new Date(`${apt.appointment_date}T00:00:00`); d.setHours(h, mi, 0, 0); return d;
      })();
      if (!start) return;
      const delay = start.getTime() - Date.now();
      if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
        const id = window.setTimeout(() => {
          showBrowserNotification(
            '📞 Video call ready',
            `${apt.patient_name}'s appointment is starting now. Tap to join.`,
          );
          // Auto-jump to Appointments tab if we're elsewhere.
          window.dispatchEvent(new CustomEvent('app:goto-appointments'));
        }, delay);
        timeouts.push(id);
      }
    });
    return () => { timeouts.forEach(clearTimeout); };
  }, [appointments]);

  useEffect(() => {
    const channel = supabase
      .channel('appointments-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => { fetchAppointments(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAppointments]);

  // ── Doctor approves appointment (single-click, no confirmation) ──
  const handleApprove = async (apt: Appointment) => {
    setCancellingId(null);
    const { error } = await supabase.from('appointments').update({
      status: 'confirmed',
      updated_at: new Date().toISOString(),
    } as any).eq('id', apt.id);
    if (error) { toast.error('Failed to approve'); return; }

    toast.success('Appointment confirmed');


    if (apt.patient_email) {
      sendAppointmentEmail({
        type: 'appointment_approved',
        to: apt.patient_email,
        patientName: apt.patient_name,
        date: apt.appointment_date,
        time: apt.time_slot,
      });
    }
    getPatientUserId(apt.patient_id).then(uid => notifyUser(uid, 'Appointment confirmed ✅', `${apt.appointment_date} • ${apt.time_slot}`, { aptId: apt.id }));

    fetchAppointments();
  };

  // ── Doctor cancels appointment ──
  const handleCancelClick = (id: string) => {
    setCancellingId(id);
    setCancelReason('');
  };

  const confirmCancel = async (apt: Appointment) => {
    const { error } = await supabase.from('appointments').update({
      status: 'cancelled',
      cancel_reason: cancelReason.trim() || null,
      updated_at: new Date().toISOString(),
    } as any).eq('id', apt.id);
    if (error) { toast.error('Failed to cancel'); return; }

    toast.success('Appointment cancelled');
    setCancellingId(null);
    setCancelReason('');

    if (apt.patient_email) {
      sendAppointmentEmail({
        type: 'appointment_cancelled_by_doctor',
        to: apt.patient_email,
        patientName: apt.patient_name,
        date: apt.appointment_date,
        time: apt.time_slot,
        reason: cancelReason.trim() || undefined,
      });
    }
    getPatientUserId(apt.patient_id).then(uid => notifyUser(uid, 'Appointment cancelled by doctor', `${apt.appointment_date} ${apt.time_slot}${cancelReason.trim() ? `\nReason: ${cancelReason.trim()}` : ''}`, { aptId: apt.id }));
    fetchAppointments();
  };

  // ── Doctor approves reschedule ──
  const approveReschedule = async (apt: Appointment) => {
    if (!apt.reschedule_date || !apt.reschedule_time_slot) return;
    const { error } = await supabase.from('appointments').update({
      appointment_date: apt.reschedule_date,
      time_slot: apt.reschedule_time_slot,
      status: 'confirmed',
      reschedule_date: null,
      reschedule_time_slot: null,
      google_event_id: null,
      google_meet_link: null,
      updated_at: new Date().toISOString(),
    } as any).eq('id', apt.id);
    if (error) { toast.error('Failed to approve reschedule'); return; }
    toast.success('Reschedule approved');


    if (apt.patient_email) {
      sendAppointmentEmail({
        type: 'reschedule_approved',
        to: apt.patient_email,
        patientName: apt.patient_name,
        date: apt.appointment_date,
        time: apt.time_slot,
        newDate: apt.reschedule_date,
        newTime: apt.reschedule_time_slot,
      });
    }
    getPatientUserId(apt.patient_id).then(uid => notifyUser(uid, 'Reschedule approved ✅', `New: ${apt.reschedule_date} ${apt.reschedule_time_slot}`, { aptId: apt.id }));
    fetchAppointments();
  };

  // ── Doctor declines reschedule (keep original) ──
  const declineReschedule = async (apt: Appointment) => {
    const { error } = await supabase.from('appointments').update({
      status: 'confirmed',
      reschedule_date: null,
      reschedule_time_slot: null,
      updated_at: new Date().toISOString(),
    } as any).eq('id', apt.id);
    if (error) { toast.error('Failed'); return; }
    toast.success('Reschedule declined, original appointment kept');

    // Send rejection email to patient
    if (apt.patient_email) {
      sendAppointmentEmail({
        type: 'reschedule_rejected',
        to: apt.patient_email,
        patientName: apt.patient_name,
        date: apt.appointment_date,
        time: apt.time_slot,
        newDate: apt.reschedule_date || undefined,
        newTime: apt.reschedule_time_slot || undefined,
      });
    }
    getPatientUserId(apt.patient_id).then(uid => notifyUser(uid, 'Reschedule declined', `Original time kept: ${apt.appointment_date} ${apt.time_slot}`, { aptId: apt.id }));
    fetchAppointments();
  };

  const sorted = [...appointments].sort((a, b) => {
    if (sortBy === 'status') return a.status.localeCompare(b.status);
    const dateCompare = a.appointment_date.localeCompare(b.appointment_date);
    if (dateCompare !== 0) return dateCompare;
    return a.time_slot.localeCompare(b.time_slot);
  });

  const today = new Date().toISOString().split('T')[0];
  const pendingCount = appointments.filter(a => a.status === 'pending' || a.status === 'reschedule_requested').length;

  const filters: { key: FilterType; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Next 7 Days' },
    { key: 'all', label: 'All Upcoming' },
  ];

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex items-center justify-between flex-wrap gap-2 min-w-0">
        <h2 className="text-lg font-display font-bold flex items-center gap-2 min-w-0">
          <Calendar size={18} className="shrink-0" /> <span className="truncate">Appointments</span>
          {pendingCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center w-6 h-6 text-xs font-bold rounded-full bg-destructive text-destructive-foreground shrink-0">
              {pendingCount}
            </span>
          )}
        </h2>
        <div className="flex gap-1 flex-wrap">
          {filters.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 btn-press ${filter === f.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <Filter size={14} className="text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Sort:</span>
        <button onClick={() => setSortBy('date')} className={`text-xs px-2 py-1 rounded ${sortBy === 'date' ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground'}`}>Date</button>
        <button onClick={() => setSortBy('status')} className={`text-xs px-2 py-1 rounded ${sortBy === 'status' ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground'}`}>Status</button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
      ) : sorted.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Calendar size={32} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No appointments found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(apt => {
            const isToday = apt.appointment_date === today;
            const appointmentDateTime = parseAppointmentDateTime(apt.appointment_date, apt.time_slot);
            return (
              <div key={apt.id} className={`glass-card p-4 ${isToday ? 'ring-2 ring-primary/30' : ''}`}>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => toggleExpand(apt)}
                    className="flex-1 min-w-0 text-left cursor-pointer flex items-start gap-3"
                    aria-expanded={expandedId === apt.id}
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center shrink-0 ring-1 ring-border/50">
                      {apt.patient_id && patientAvatars[apt.patient_id] ? (
                        <img src={patientAvatars[apt.patient_id]!} alt={apt.patient_name} className="w-full h-full object-cover" />
                      ) : (
                        <User size={18} className="text-primary/60" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-semibold truncate">{apt.patient_name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[apt.status] || 'bg-muted text-muted-foreground'}`}>
                        {STATUS_LABELS[apt.status] || apt.status}
                      </span>
                      {isToday && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Today</span>}
                      {expandedId === apt.id
                        ? <ChevronUp size={14} className="text-muted-foreground ml-auto" />
                        : <ChevronDown size={14} className="text-muted-foreground ml-auto" />}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><Calendar size={12} />{new Date(apt.appointment_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span className="flex items-center gap-1"><Clock size={12} />{apt.time_slot}</span>
                      {apt.patient_phone && <span>📞 {apt.patient_phone}</span>}
                      {apt.patient_email && <span>✉ {apt.patient_email}</span>}
                    </div>
                    {apt.chief_complaint && <p className="text-xs text-muted-foreground mt-1 truncate">💬 {apt.chief_complaint}</p>}
                    {/* Reschedule request info */}
                    {apt.status === 'reschedule_requested' && apt.reschedule_date && (
                      <div className="mt-2 p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                        <p className="text-xs font-medium text-purple-800 dark:text-purple-300 flex items-center gap-1">
                          <RefreshCw size={12} /> Requested: {new Date(apt.reschedule_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at {apt.reschedule_time_slot}
                        </p>
                      </div>
                    )}
                    </div>
                  </button>

                  <div className="flex gap-1 flex-wrap sm:shrink-0 sm:justify-end" onClick={(e) => e.stopPropagation()}>
                    {apt.status === 'pending' && canDoctorModifyAppointment(apt) && (
                      <>
                        <button onClick={() => handleApprove(apt)} title="Approve"
                          className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 flex items-center justify-center hover:bg-emerald-200 dark:hover:bg-emerald-900/50 btn-press">
                          <Check size={16} />
                        </button>
                        <button onClick={() => handleCancelClick(apt.id)} title="Cancel"
                          className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 flex items-center justify-center hover:bg-red-200 dark:hover:bg-red-900/50 btn-press">
                          <X size={16} />
                        </button>
                      </>
                    )}
                    {apt.status === 'reschedule_requested' && canDoctorModifyAppointment(apt) && (
                      <>
                        <button onClick={() => approveReschedule(apt)} title="Approve Reschedule"
                          className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 flex items-center justify-center hover:bg-emerald-200 dark:hover:bg-emerald-900/50 btn-press">
                          <Check size={16} />
                        </button>
                        <button onClick={() => declineReschedule(apt)} title="Decline Reschedule"
                          className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 flex items-center justify-center hover:bg-red-200 dark:hover:bg-red-900/50 btn-press">
                          <X size={16} />
                        </button>
                      </>
                    )}
                     {(['confirmed', 'in_call', 'awaiting_prescription', 'pending'].includes(apt.status) || ALWAYS_JOIN_PATIENT_IDS.has(apt.patient_id || '')) && (() => {
                       const w = getJoinWindowState(apt.appointment_date, apt.time_slot, new Date(nowTick), { status: apt.status, patientId: apt.patient_id });
                       if (!w.canJoin) return null;
                       return (
                         <button onClick={() => handleJoinCall(apt)}
                           title="Start your appointment"
                           className="h-8 px-3 rounded-lg flex items-center gap-1.5 btn-press text-white shadow-sm"
                           style={{ background: 'linear-gradient(135deg, hsl(152 69% 35%), hsl(174 72% 38%))' }}>
                           <Video size={14} /> <span className="text-[11px] font-semibold whitespace-nowrap">Start appointment</span>
                         </button>
                       );
                     })()}
                    {['confirmed', 'in_call', 'awaiting_prescription'].includes(apt.status) && (() => {
                      const w = getJoinWindowState(apt.appointment_date, apt.time_slot, new Date(nowTick), { status: apt.status, patientId: apt.patient_id });
                      // End Session only visible while the 30-min window is open.
                      if (!w.canJoin) return null;
                      return (
                        <button onClick={() => handleEndSession(apt)} title="End session (close re-join window)"
                          className="h-8 px-2 rounded-lg flex items-center gap-1 btn-press bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600">
                          <X size={14} /> <span className="text-[11px] font-medium">End session</span>
                        </button>
                      );
                    })()}
                    {apt.status === 'confirmed' && canDoctorModifyAppointment(apt) && (
                      <>
                        <button onClick={() => handleDoctorReschedule(apt.id)} title="Reschedule"
                          className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 flex items-center justify-center hover:bg-purple-200 dark:hover:bg-purple-900/50 btn-press">
                          <CalendarClock size={16} />
                        </button>
                        <button onClick={() => handleCancelClick(apt.id)} title="Cancel"
                          className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 flex items-center justify-center hover:bg-red-200 dark:hover:bg-red-900/50 btn-press">
                          <X size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded patient detail panel */}
                {expandedId === apt.id && (
                  <div className="mt-3 pt-3 border-t border-border">
                    {!apt.patient_id ? (
                      <p className="text-xs text-muted-foreground italic">Walk-in / guest booking — no patient record on file.</p>
                    ) : loadingPatient === apt.patient_id ? (
                      <p className="text-xs text-muted-foreground">Loading patient details…</p>
                    ) : patientDetails[apt.patient_id] ? (
                      (() => {
                        const p = patientDetails[apt.patient_id!];
                        const Row = ({ icon: Icon, label, value }: any) => value ? (
                          <div className="flex items-start gap-2 text-xs">
                            <Icon size={12} className="text-muted-foreground mt-0.5 shrink-0" />
                            <span className="text-muted-foreground w-28 shrink-0">{label}:</span>
                            <span className="text-foreground break-words">{value}</span>
                          </div>
                        ) : null;
                        const heightStr = p.height_feet || p.height_inches
                          ? `${p.height_feet || 0}' ${p.height_inches || 0}"`
                          : p.height_cm ? `${p.height_cm} cm` : null;
                        return (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <Row icon={User} label="Name" value={p.name} />
                              <Row icon={User} label="Age / Gender" value={`${p.age} • ${p.gender}`} />
                              <Row icon={Phone} label="Phone" value={p.phone} />
                              <Row icon={Briefcase} label="Occupation" value={p.occupation} />
                              <Row icon={Heart} label="Marital" value={p.marital_status} />
                              <Row icon={Activity} label="Weight / Height" value={[p.weight ? `${p.weight} kg` : null, heightStr].filter(Boolean).join(' • ') || null} />
                              <Row icon={MapPin} label="Address" value={p.address} />
                              <Row icon={Activity} label="Activity" value={p.physical_activity} />
                            </div>
                            {(p.medical_conditions?.length || p.allergies?.length) && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 border-t border-border/50">
                                {p.medical_conditions?.length > 0 && (
                                  <Row icon={AlertCircle} label="Conditions" value={p.medical_conditions.join(', ')} />
                                )}
                                {p.allergies?.length > 0 && (
                                  <Row icon={AlertCircle} label="Allergies" value={p.allergies.join(', ')} />
                                )}
                              </div>
                            )}
                            {(p.chief_complaint || p.history_of_present_illness || p.past_illness_history || p.drug_history || p.personal_history || p.ob_gyn_history || p.immunization_history || p.treatment_history) && (
                              <div className="space-y-2 pt-2 border-t border-border/50">
                                <Row icon={AlertCircle} label="Chief complaint" value={p.chief_complaint} />
                                <Row icon={AlertCircle} label="Present illness" value={p.history_of_present_illness} />
                                <Row icon={AlertCircle} label="Past illness" value={p.past_illness_history} />
                                <Row icon={AlertCircle} label="Drug history" value={p.drug_history} />
                                <Row icon={AlertCircle} label="Personal" value={p.personal_history} />
                                <Row icon={AlertCircle} label="OB/GYN" value={p.ob_gyn_history} />
                                <Row icon={AlertCircle} label="Immunization" value={p.immunization_history} />
                                <Row icon={AlertCircle} label="Treatment" value={p.treatment_history} />
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ) : (
                      <p className="text-xs text-muted-foreground">Patient record not found.</p>
                    )}
                  </div>
                )}

                {/* Cancel reason input */}
                {cancellingId === apt.id && (
                  <div className="mt-3 pt-3 border-t border-border space-y-2">
                    <label className="text-xs text-muted-foreground">Cancellation reason (optional):</label>
                    <div className="flex gap-2">
                      <Textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Reason for cancellation..." rows={2} className="text-sm" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" onClick={() => confirmCancel(apt)}>Confirm Cancel</Button>
                      <Button size="sm" variant="outline" onClick={() => setCancellingId(null)}>Back</Button>
                    </div>
                  </div>
                )}

                {/* Doctor reschedule form */}
                {doctorReschedulingId === apt.id && (
                  <div className="mt-3 pt-3 border-t border-border space-y-2">
                    <label className="text-xs text-muted-foreground font-medium">Reschedule to new date & time:</label>
                    <div className="flex gap-2">
                      <Input type="date" value={doctorRescheduleDate} onChange={e => setDoctorRescheduleDate(e.target.value)} className="text-sm h-9" />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {VALID_SLOTS.map(slot => (
                        <button key={slot} onClick={() => setDoctorRescheduleSlot(slot)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${doctorRescheduleSlot === slot ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:border-primary/50'}`}>
                          {slot}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => confirmDoctorReschedule(apt)} disabled={!doctorRescheduleDate || !doctorRescheduleSlot}>Confirm Reschedule</Button>
                      <Button size="sm" variant="outline" onClick={() => setDoctorReschedulingId(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AppointmentsTab;
