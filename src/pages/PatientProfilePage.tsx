import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft, Calendar, Pill, AlertTriangle, Plus, FileText, Eye,
  ChevronRight, Upload, Download, Printer, Trash2, Building2,
  FlaskConical, ClipboardList, Pencil, Home, Stethoscope,
  ClipboardCheck, ChevronDown, ChevronUp, User, Phone, MapPin,
  Briefcase, Heart, Weight, Ruler, Activity, FolderOpen
} from 'lucide-react';
import {
  type Patient, type Prescription, type Visit, type DoctorSettings,
  type PatientReport, ACTIVITY_LABELS, ACTIVITY_MULTIPLIERS,
  calculateBMI, getBMIStatus, calculateBMR,
  VISIT_STAGE_LABELS, VISIT_STAGE_COLORS
} from '@/types/medical';
// Legacy PrescriptionPreview/export removed — visits now use PrescriptionUpload (PDF upload).
import ReportPreviewModal from '@/components/ReportPreviewModal';
import PatientForm from '@/components/PatientForm';
import VisitWorkflow from '@/components/VisitWorkflow';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  patient: Patient;
  prescriptions: Prescription[];
  visits: Visit[];
  patients: Patient[];
  doctorSettings: DoctorSettings;
  onBack: () => void;
  onSavePrescription: (rx: Prescription) => void;
  onSaveVisit: (visit: Visit) => void;
  onUpdatePatient: (p: Patient) => void;
  onDeletePatient: (patientId: string) => void;
  onDeletePrescription: (prescriptionId: string) => void;
  onDeleteHistory: (patientId: string) => void;
  onDeleteVisit: (visitId: string) => void;
  onGoToDashboard?: () => void;
  stageFilter?: string;
}

type ProfileTab = 'overview' | 'visits' | 'prescriptions' | 'files';

interface PatientFileRow {
  id: string;
  fileName: string;
  filePath: string;
  fileType: string;
  createdAt: string;
  category: 'report' | 'prescription';
}

const PatientProfilePage: React.FC<Props> = ({
  patient, prescriptions, visits, patients, doctorSettings,
  onBack, onSavePrescription, onSaveVisit, onUpdatePatient,
  onDeletePatient, onDeletePrescription, onDeleteHistory, onDeleteVisit,
  onGoToDashboard, stageFilter,
}) => {
  const patientVisits = visits.filter(v => v.patientId === patient.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const patientRx = prescriptions.filter(p => p.patientId === patient.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const [profileTab, setProfileTab] = useState<ProfileTab>('overview');
  const [viewingRx, setViewingRx] = useState<Prescription | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);
  const [showNewVisit, setShowNewVisit] = useState(false);
  const [showDetailedInfo, setShowDetailedInfo] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [viewingReport, setViewingReport] = useState<PatientReport | null>(null);
  const reportInputRef = useRef<HTMLInputElement>(null);
  const [patientFiles, setPatientFiles] = useState<PatientFileRow[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [isDownloadingSummary, setIsDownloadingSummary] = useState(false);

  // Load patient-uploaded files (Reports + Previous Prescriptions) for doctor view
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setFilesLoading(true);
      const { data } = await (supabase as any)
        .from('patient_reports')
        .select('id, file_name, file_path, file_type, created_at, category')
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      setPatientFiles(((data as any[]) || []).map(r => ({
        id: r.id, fileName: r.file_name, filePath: r.file_path,
        fileType: r.file_type || '', createdAt: r.created_at,
        category: r.category === 'prescription' ? 'prescription' : 'report',
      })));
      setFilesLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [patient.id]);

  const openSignedUrl = async (path: string): Promise<string | null> => {
    const { data } = await supabase.storage.from('patient-reports').createSignedUrl(path, 3600);
    return data?.signedUrl || null;
  };

  const viewPatientFile = async (file: PatientFileRow) => {
    const url = await openSignedUrl(file.filePath);
    if (!url) { toast.error('Could not open file'); return; }
    setViewingReport({ id: file.id, name: file.fileName, date: file.createdAt, dataUrl: url, fileType: file.fileType });
  };

  const downloadPatientFile = async (file: PatientFileRow) => {
    const url = await openSignedUrl(file.filePath);
    if (!url) { toast.error('Could not download file'); return; }
    const a = document.createElement('a'); a.href = url; a.download = file.fileName; a.click();
  };

  const buildSummaryHtml = () => {
    const fmt = (d: string) => new Date(d).toLocaleDateString();
    const esc = (s: any) => String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const visitsHtml = patientVisits.length ? patientVisits.map(v => `
      <div style="margin-bottom:14px;padding:12px;border:1px solid #e5e7eb;border-radius:10px">
        <div style="display:flex;justify-content:space-between;font-size:12px;color:#6b7280;margin-bottom:6px">
          <span>${esc(fmt(v.createdAt))}</span><span>${esc(v.stage)}</span>
        </div>
        ${v.chiefComplaint ? `<p style="margin:2px 0;font-size:13px"><b>Complaint:</b> ${esc(v.chiefComplaint)}</p>` : ''}
        ${v.finalDiagnosis ? `<p style="margin:2px 0;font-size:13px"><b>Diagnosis:</b> ${esc(v.finalDiagnosis)}</p>` : ''}
        ${v.advice ? `<p style="margin:2px 0;font-size:13px"><b>Advice:</b> ${esc(v.advice)}</p>` : ''}
      </div>`).join('') : '<p style="color:#6b7280;font-size:13px">No visits recorded.</p>';
    const rxHtml = patientRx.length ? patientRx.map(r => `
      <div style="margin-bottom:14px;padding:12px;border:1px solid #e5e7eb;border-radius:10px">
        <div style="font-size:12px;color:#6b7280;margin-bottom:6px">${esc(fmt(r.createdAt))}</div>
        ${r.diagnosis ? `<p style="margin:2px 0;font-size:13px"><b>Dx:</b> ${esc(r.diagnosis)}</p>` : ''}
        ${r.symptoms ? `<p style="margin:2px 0;font-size:13px"><b>Sx:</b> ${esc(r.symptoms)}</p>` : ''}
        ${(r.medicines && r.medicines.length) ? `<div style="margin-top:6px"><b style="font-size:13px">Medicines:</b><ul style="margin:4px 0 0 16px;padding:0;font-size:12px">${r.medicines.map((m:any)=>`<li>${esc(m.name||'')} — ${esc(m.dosage||'')} ${esc(m.frequency||'')} ${esc(m.duration||'')}</li>`).join('')}</ul></div>` : ''}
        ${r.advice ? `<p style="margin:6px 0 0;font-size:13px"><b>Advice:</b> ${esc(r.advice)}</p>` : ''}
      </div>`).join('') : '<p style="color:#6b7280;font-size:13px">No prescriptions yet.</p>';
    const filesHtml = patientFiles.length
      ? `<ul style="margin:0;padding-left:18px;font-size:13px">${patientFiles.map(f=>`<li>[${f.category === 'prescription' ? 'Previous Rx' : 'Report'}] ${esc(f.fileName)} — ${esc(fmt(f.createdAt))}</li>`).join('')}</ul>`
      : '<p style="color:#6b7280;font-size:13px">No uploaded files.</p>';

    return `
      <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111827;padding:32px;width:210mm;box-sizing:border-box;background:#fff">
        <div style="border-bottom:2px solid #111827;padding-bottom:12px;margin-bottom:18px">
          <h1 style="margin:0;font-size:22px">Patient Summary</h1>
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
        <h2 style="font-size:15px;margin:18px 0 8px">Uploaded Files</h2>
        ${filesHtml}
      </div>`;
  };

  const handleDownloadSummary = async () => {
    setIsDownloadingSummary(true);
    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed'; wrapper.style.left = '-10000px'; wrapper.style.top = '0';
    wrapper.innerHTML = buildSummaryHtml();
    document.body.appendChild(wrapper);
    try {
      throw new Error('PDF summary export has been removed. Please use the prescription PDF upload flow.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate PDF');
    } finally {
      wrapper.remove();
      setIsDownloadingSummary(false);
    }
  };

  const bmi = patient.weight && patient.height ? calculateBMI(patient.weight, patient.height) : null;
  const bmiStatus = bmi ? getBMIStatus(bmi) : null;
  const bmr = patient.weight && patient.height && patient.age ? calculateBMR(patient.weight, patient.height, patient.age, patient.gender) : null;
  const activityMultiplier = patient.physicalActivity ? ACTIVITY_MULTIPLIERS[patient.physicalActivity] : 1.2;
  const tdee = bmr ? Math.round(bmr * activityMultiplier) : null;

  const handleDownloadPrescription = async (_rx: Prescription, _rxPatient: Patient) => {
    toast.info('Auto-generated prescription PDF has been removed. Upload the PDF from the visit workflow.');
  };

  const handleReportUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const report: PatientReport = { id: crypto.randomUUID(), name: file.name, date: new Date().toISOString(), dataUrl: ev.target?.result as string, fileType: file.type };
      onUpdatePatient({ ...patient, reports: [...(patient.reports || []), report] });
    };
    reader.readAsDataURL(file);
  };

  const removeReport = (reportId: string) => {
    onUpdatePatient({ ...patient, reports: (patient.reports || []).filter(r => r.id !== reportId) });
  };

  const downloadReport = (report: PatientReport) => {
    const a = document.createElement('a'); a.href = report.dataUrl; a.download = report.name; a.click();
  };

  const handleDeletePatient = () => {
    if (window.confirm(`Delete patient ${patient.name} and all related history?`)) {
      onDeletePatient(patient.id);
    }
  };

  const handleDeletePrescription = (prescriptionId: string) => {
    if (window.confirm('Delete this prescription from history?')) {
      onDeletePrescription(prescriptionId);
      if (viewingRx?.id === prescriptionId) setViewingRx(null);
    }
  };

  const handleDeleteHistory = () => {
    if (window.confirm(`Delete all prescription history for ${patient.name}?`)) {
      onDeleteHistory(patient.id);
      setViewingRx(null);
      setProfileTab('overview');
    }
  };

  // Edit patient
  if (isEditing) {
    return (
      <div className="p-4 md:p-6 xl:p-8 page-transition">
        <PatientForm initial={patient} onSave={(updated) => { onUpdatePatient(updated); setIsEditing(false); }} onCancel={() => setIsEditing(false)} />
      </div>
    );
  }

  // Active visit workflow
  if (showNewVisit || activeVisit) {
    return (
      <VisitWorkflow
        patient={patient}
        doctorSettings={doctorSettings}
        existingVisit={activeVisit ?? undefined}
        onSaveVisit={(v) => { onSaveVisit(v); }}
        onSavePrescription={onSavePrescription}
        onBack={() => { setShowNewVisit(false); setActiveVisit(null); }}
        onGoToDashboard={onGoToDashboard}
      />
    );
  }

  // Viewing a prescription
  if (viewingRx) {
    const rxPatient = patients.find(p => p.id === viewingRx.patientId) || patient;
    const chamber = doctorSettings.chambers.find(c => c.id === viewingRx.chamberId);
    return (
      <div className="p-4 md:p-6 xl:p-8 space-y-4 page-transition">
        <div className="flex items-center justify-between">
          <button onClick={() => setViewingRx(null)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={16} /> Back
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mb-2 no-print">
          <button onClick={() => void handleDownloadPrescription(viewingRx, rxPatient)} disabled={isDownloadingPdf}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 btn-press">
            <Download size={14} /> {isDownloadingPdf ? 'Downloading...' : 'Download'}
          </button>
        </div>
        <div className="flex justify-center overflow-hidden w-full">
          <div
            style={{
              width: 'min(96vw, 900px)',
              overflow: 'hidden',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                transform: 'scale(calc(min(96vw, 900px) / 794px))',
                transformOrigin: 'top center',
                width: '210mm',
                flexShrink: 0,
              }}
            >
              <div className="rounded-xl border border-dashed border-border/50 p-10 text-center text-sm text-muted-foreground">
                Auto-generated prescription preview was removed.<br />
                Upload prescription PDFs from the Visit workflow — patients can download them directly.
                <div className="text-[10px] mt-2 opacity-50">Rx for {rxPatient.name} · {new Date(viewingRx.createdAt).toLocaleDateString()}{chamber ? ` · ${chamber.name}` : ''}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const profileTabs: { key: ProfileTab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <ClipboardList size={14} /> },
    { key: 'visits', label: 'Visits', icon: <Stethoscope size={14} /> },
    { key: 'prescriptions', label: 'Rx History', icon: <FileText size={14} /> },
    { key: 'files', label: 'Files', icon: <FolderOpen size={14} /> },
  ];

  const detailedInfo = patient.detailedInfo;
  const hasDetailedInfo = detailedInfo && Object.values(detailedInfo).some(v => v);
  const latestVisit = patientVisits[0];

  return (
    <div className="p-4 md:p-6 xl:p-8 space-y-5 page-transition">
      {/* Top navigation */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={16} /> Back
        </button>
        {onGoToDashboard && (
          <button onClick={onGoToDashboard} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted transition-all duration-200 btn-press">
            <Home size={14} /> Dashboard
          </button>
        )}
      </div>

      {/* ── Patient Hero Card ── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {/* Header band */}
        <div className="bg-primary/5 dark:bg-primary/10 px-5 py-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {patient.avatarUrl ? (
                <img src={patient.avatarUrl} alt={patient.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-primary">{patient.name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-display font-bold truncate">{patient.name}</h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                <span>{patient.age} yrs</span>
                <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                <span className="capitalize">{patient.gender}</span>
                {patient.occupation && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                    <span>{patient.occupation}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-muted btn-press">
              <Pencil size={13} /> Edit
            </button>
            <button onClick={handleDeletePatient}
              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/20 bg-card px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 btn-press">
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Info grid */}
        <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3 text-sm">
          {patient.phone && (
            <div className="flex items-center gap-2">
              <Phone size={13} className="text-muted-foreground flex-shrink-0" />
              <span>{patient.phone}</span>
            </div>
          )}
          {patient.address && (
            <div className="flex items-center gap-2 col-span-2">
              <MapPin size={13} className="text-muted-foreground flex-shrink-0" />
              <span className="truncate">{patient.address}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Heart size={13} className="text-muted-foreground flex-shrink-0" />
            <span className="capitalize">{patient.maritalStatus || 'N/A'}</span>
          </div>
          {patient.weight && (
            <div className="flex items-center gap-2">
              <Weight size={13} className="text-muted-foreground flex-shrink-0" />
              <span>{patient.weight} kg</span>
            </div>
          )}
          {patient.heightFeet && (
            <div className="flex items-center gap-2">
              <Ruler size={13} className="text-muted-foreground flex-shrink-0" />
              <span>{patient.heightFeet}'{patient.heightInches || 0}"</span>
            </div>
          )}
          {patient.physicalActivity && (
            <div className="flex items-center gap-2">
              <Activity size={13} className="text-muted-foreground flex-shrink-0" />
              <span>{ACTIVITY_LABELS[patient.physicalActivity]}</span>
            </div>
          )}
        </div>

        {/* Chief complaint & HPI inline */}
        {(patient.chiefComplaint || patient.historyOfPresentIllness) && (
          <div className="px-5 pb-4 space-y-2">
            {patient.chiefComplaint && (
              <div className="rounded-lg bg-muted/50 p-3">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Chief Complaint</span>
                <p className="text-sm mt-0.5">{patient.chiefComplaint}</p>
              </div>
            )}
            {patient.historyOfPresentIllness && (
              <div className="rounded-lg bg-muted/50 p-3">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">History of Present Illness</span>
                <p className="text-sm mt-0.5">{patient.historyOfPresentIllness}</p>
              </div>
            )}
          </div>
        )}

        {/* Conditions & allergies badges */}
        {(patient.medicalConditions.length > 0 || patient.allergies.length > 0) && (
          <div className="px-5 pb-4 flex flex-wrap gap-1.5">
            {patient.medicalConditions.map(c => (
              <span key={c} className="bg-secondary text-secondary-foreground text-[11px] font-medium px-2.5 py-1 rounded-full">{c}</span>
            ))}
            {patient.allergies.map(a => (
              <span key={a} className="bg-destructive/10 text-destructive text-[11px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1">
                <AlertTriangle size={10} /> {a}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Health Metrics row ── */}
      {(bmi || bmr) && (
        <div className="grid grid-cols-3 gap-3">
          {bmi && bmiStatus && (
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">BMI</p>
              <p className="text-2xl font-bold mt-1">{bmi.toFixed(1)}</p>
              <p className={`text-xs font-semibold mt-0.5 ${bmiStatus.color}`}>{bmiStatus.label}</p>
            </div>
          )}
          {bmr && (
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">BMR</p>
              <p className="text-2xl font-bold mt-1">{Math.round(bmr)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">kcal/day</p>
            </div>
          )}
          {tdee && (
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">TDEE</p>
              <p className="text-2xl font-bold mt-1">{tdee}</p>
              <p className="text-xs text-muted-foreground mt-0.5">kcal/day</p>
            </div>
          )}
        </div>
      )}

      {/* ── Detailed Info Accordion ── */}
      <button onClick={() => setShowDetailedInfo(!showDetailedInfo)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200 btn-press">
        <span>Detailed Medical History</span>
        {showDetailedInfo ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {showDetailedInfo && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4 animate-fade-in">
          {[
            { label: 'Past Illness History', value: detailedInfo?.pastIllnessHistory },
            { label: 'Treatment History', value: detailedInfo?.treatmentHistory },
            { label: 'Personal History', value: detailedInfo?.personalHistory },
            { label: 'OB/GYN History', value: detailedInfo?.obGynHistory },
            { label: 'Immunization History', value: detailedInfo?.immunizationHistory },
            { label: 'Drug History', value: detailedInfo?.drugHistory },
            { label: 'Socio-economic Status', value: detailedInfo?.socioEconomicStatus },
          ].filter(item => item.value).map(item => (
            <div key={item.label}>
              <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{item.label}</h4>
              <p className="text-sm mt-1">{item.value}</p>
            </div>
          ))}
          {!hasDetailedInfo && <p className="text-sm text-muted-foreground italic text-center py-2">No detailed history recorded. Edit patient to add.</p>}
        </div>
      )}

      {/* ── New Visit CTA ── */}
      <button onClick={() => setShowNewVisit(true)}
        className="w-full rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 dark:bg-primary/10 p-4 flex items-center gap-4 text-left hover:border-primary/50 hover:bg-primary/10 transition-all duration-200 btn-press group">
        <div className="w-12 h-12 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
          <Plus size={20} className="text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">Start New Visit</p>
          <p className="text-xs text-muted-foreground">Begin a new clinical visit for this patient</p>
        </div>
        <ChevronRight size={16} className="text-muted-foreground" />
      </button>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 border border-border">
        {profileTabs.map(t => (
          <button key={t.key} onClick={() => setProfileTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 btn-press ${
              profileTab === t.key
                ? 'bg-card text-foreground shadow-sm border border-border/50'
                : 'text-muted-foreground hover:text-foreground'
            }`}>
            {t.icon} <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {profileTab === 'overview' && (
        <div className="space-y-4 page-transition">
          {/* Latest visit summary */}
          {latestVisit && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Latest Visit</h3>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${VISIT_STAGE_COLORS[latestVisit.stage]}`}>
                  {VISIT_STAGE_LABELS[latestVisit.stage]}
                </span>
              </div>
              <button onClick={() => setActiveVisit(latestVisit)} className="w-full text-left btn-press">
                <p className="text-sm">{latestVisit.chiefComplaint || 'No complaint recorded'}</p>
                <p className="text-xs text-muted-foreground mt-1">{new Date(latestVisit.date).toLocaleDateString()}</p>
              </button>
            </div>
          )}

          {/* Visit timeline */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Calendar size={13} /> Visit Timeline ({patientVisits.length})
            </h3>
            {patientVisits.length === 0 ? (
              <div className="text-center py-8">
                <Stethoscope size={32} className="mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No visits yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {patientVisits.slice(0, 6).map(visit => (
                  <button key={visit.id} onClick={() => setActiveVisit(visit)}
                    className="w-full rounded-xl border border-border bg-card p-3.5 text-left btn-press hover:bg-muted/30 transition-all duration-200 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      visit.stage === 'initial' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' :
                      visit.stage === 'investigation' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' :
                      'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
                    }`}>
                      {visit.stage === 'initial' ? <Stethoscope size={15} /> :
                       visit.stage === 'investigation' ? <FlaskConical size={15} /> :
                       <ClipboardCheck size={15} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${VISIT_STAGE_COLORS[visit.stage]}`}>
                          {VISIT_STAGE_LABELS[visit.stage]}
                        </span>
                        {visit.finalDiagnosis && <span className="text-sm font-medium truncate">{visit.finalDiagnosis}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {new Date(visit.date).toLocaleDateString()}
                        {visit.chiefComplaint && ` · ${visit.chiefComplaint.slice(0, 40)}`}
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
                  </button>
                ))}
                {patientVisits.length > 6 && (
                  <button onClick={() => setProfileTab('visits')} className="text-xs font-medium text-primary w-full text-center py-2">
                    View all {patientVisits.length} visits →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Visits Tab ── */}
      {profileTab === 'visits' && (
        <div className="space-y-2 page-transition">
          {patientVisits.length === 0 ? (
            <div className="text-center py-12">
              <Stethoscope size={36} className="mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No visits yet</p>
            </div>
          ) : (
            patientVisits.map(visit => (
              <div key={visit.id} className="rounded-xl border border-border bg-card flex items-center gap-3 overflow-hidden">
                <button onClick={() => setActiveVisit(visit)} className="flex min-w-0 flex-1 items-center gap-3 p-3.5 text-left btn-press">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    visit.stage === 'initial' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' :
                    visit.stage === 'investigation' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' :
                    'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
                  }`}>
                    {visit.stage === 'initial' ? <Stethoscope size={16} /> :
                     visit.stage === 'investigation' ? <FlaskConical size={16} /> :
                     <ClipboardCheck size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${VISIT_STAGE_COLORS[visit.stage]}`}>
                        {VISIT_STAGE_LABELS[visit.stage]}
                      </span>
                      {visit.finalDiagnosis && <span className="text-sm font-medium truncate">{visit.finalDiagnosis}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(visit.date).toLocaleDateString()}
                      {visit.chiefComplaint && ` · C/O: ${visit.chiefComplaint.slice(0, 40)}`}
                    </div>
                    {visit.medicines && visit.medicines.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Pill size={11} /> {visit.medicines.length} medicine{visit.medicines.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
                </button>
                <button type="button" onClick={() => { if (window.confirm('Delete this visit?')) onDeleteVisit(visit.id); }}
                  className="rounded-lg p-2.5 mr-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive btn-press">
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Prescriptions Tab ── */}
      {profileTab === 'prescriptions' && (
        <div className="space-y-2 page-transition">
          {patientRx.length > 0 && (
            <div className="flex items-center justify-between gap-3 mb-1">
              <p className="text-xs text-muted-foreground">{patientRx.length} prescription{patientRx.length !== 1 ? 's' : ''}</p>
              <button type="button" onClick={handleDeleteHistory}
                className="rounded-lg border border-destructive/20 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 btn-press">
                Clear All
              </button>
            </div>
          )}
          {patientRx.length === 0 ? (
            <div className="text-center py-12">
              <FileText size={36} className="mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No prescriptions yet</p>
            </div>
          ) : (
            patientRx.map(rx => (
              <div key={rx.id} className="rounded-xl border border-border bg-card flex items-center gap-3 overflow-hidden">
                <button onClick={() => setViewingRx(rx)} className="flex min-w-0 flex-1 items-center gap-3 p-3.5 text-left btn-press">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <FileText size={16} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{rx.diagnosis || 'Provisional'}</div>
                    <div className="text-xs text-muted-foreground">
                      {rx.medicines.length} medicine{rx.medicines.length !== 1 ? 's' : ''} · {new Date(rx.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
                </button>
                <button type="button" onClick={() => handleDeletePrescription(rx.id)}
                  className="rounded-lg p-2.5 mr-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive btn-press">
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Files Tab (Reports + Previous Prescriptions, view/download only) ── */}
      {profileTab === 'files' && (
        <div className="space-y-6 page-transition">
          <button
            onClick={handleDownloadSummary}
            disabled={isDownloadingSummary}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-50 btn-press"
          >
            <Download size={15} /> {isDownloadingSummary ? 'Generating PDF…' : 'Download Patient Summary PDF'}
          </button>

          {(['report', 'prescription'] as const).map(cat => {
            const items = patientFiles.filter(f => f.category === cat);
            const title = cat === 'report' ? 'Reports' : 'Previous Prescriptions';
            const emptyText = cat === 'report'
              ? 'No reports uploaded by the patient yet'
              : 'No previous prescriptions uploaded by the patient yet';
            const Icon = cat === 'report' ? FlaskConical : Pill;
            return (
              <div key={cat} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <Icon size={14} className="text-primary" />
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <span className="ml-auto text-xs text-muted-foreground">{items.length}</span>
                </div>
                {filesLoading ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Loading…</p>
                ) : items.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">{emptyText}</p>
                ) : items.map(file => (
                  <div key={file.id} className="rounded-xl border border-border bg-card flex items-center gap-3 overflow-hidden">
                    <button onClick={() => viewPatientFile(file)} className="flex min-w-0 flex-1 items-center gap-3 p-3.5 text-left btn-press">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Icon size={16} className="text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{file.fileName}</div>
                        <div className="text-xs text-muted-foreground">{new Date(file.createdAt).toLocaleString()}</div>
                      </div>
                    </button>
                    <div className="flex items-center gap-0.5 mr-2">
                      <button onClick={() => viewPatientFile(file)} className="p-2 rounded-lg hover:bg-muted btn-press" title="View"><Eye size={14} className="text-muted-foreground" /></button>
                      <button onClick={() => downloadPatientFile(file)} className="p-2 rounded-lg hover:bg-muted btn-press" title="Download"><Download size={14} className="text-muted-foreground" /></button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <ReportPreviewModal report={viewingReport} onClose={() => setViewingReport(null)} />
    </div>
  );
};

export default PatientProfilePage;
