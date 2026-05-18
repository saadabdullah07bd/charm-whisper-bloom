import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Home, Send, Save, FileText, Trash2, Stethoscope, FlaskConical, ClipboardCheck, Pill, ChevronRight, Building2 } from 'lucide-react';
import { type Patient, type Visit, type Prescription, type DoctorSettings, type Medicine, type VisitStage,
  COMMON_DIAGNOSES, COMMON_INVESTIGATIONS, FOLLOW_UP_OPTIONS, DOSAGE_OPTIONS, FREQUENCY_OPTIONS, DURATION_OPTIONS } from '@/types/medical';
import MedicineAutoSuggest from '@/components/MedicineAutoSuggest';
import AutoSuggestInput from '@/components/AutoSuggestInput';
import PrescriptionUpload from '@/components/PrescriptionUpload';
import { supabase } from '@/integrations/supabase/client';
import { sendAppointmentEmail } from '@/lib/appointmentEmail';

interface Props {
  patient: Patient;
  doctorSettings: DoctorSettings;
  existingVisit?: Visit;
  onSaveVisit: (visit: Visit) => void;
  onSavePrescription: (rx: Prescription) => void;
  onBack: () => void;
  onGoToDashboard?: () => void;
}

const VisitWorkflow: React.FC<Props> = ({ patient, doctorSettings, existingVisit, onSaveVisit, onSavePrescription, onBack, onGoToDashboard }) => {
  const [stage, setStage] = useState<VisitStage>(existingVisit?.stage ?? 'initial');
  const [chiefComplaint, setChiefComplaint] = useState(existingVisit?.chiefComplaint ?? patient.chiefComplaint ?? '');
  const [examinationFindings, setExaminationFindings] = useState(existingVisit?.examinationFindings ?? '');
  const [provisionalMedicines, setProvisionalMedicines] = useState<Medicine[]>(existingVisit?.provisionalMedicines ?? []);
  const [investigations, setInvestigations] = useState(existingVisit?.investigations ?? '');
  const [investigationNotes, setInvestigationNotes] = useState(existingVisit?.investigationNotes ?? '');
  const [finalDiagnosis, setFinalDiagnosis] = useState(existingVisit?.finalDiagnosis ?? '');
  const [medicines, setMedicines] = useState<Medicine[]>(existingVisit?.medicines ?? []);
  const [advice, setAdvice] = useState(existingVisit?.advice ?? '');
  const [followUpDays, setFollowUpDays] = useState(existingVisit?.followUpDays ?? '');
  const [chamberId, setChamberId] = useState(doctorSettings.chambers[0]?.id ?? '');
  const [consultationType, setConsultationType] = useState<'chamber' | 'online'>('chamber');
  const [showPreview, setShowPreview] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [generateProvisionalRx, setGenerateProvisionalRx] = useState(false);

  // Track the visit ID to prevent duplicates
  const visitIdRef = useRef<string>(existingVisit?.id ?? crypto.randomUUID());
  const [rxFiles, setRxFiles] = useState<any[]>([]);
  const fetchRxFiles = async () => {
    const { data } = await supabase.from('prescription_files')
      .select('*').eq('patient_id', patient.id).order('created_at', { ascending: false });
    setRxFiles(data ?? []);
  };
  useEffect(() => { fetchRxFiles(); /* eslint-disable-next-line */ }, [patient.id]);

  const chamber = doctorSettings.chambers.find(c => c.id === chamberId);

  const stageSteps: { key: VisitStage; label: string; icon: React.ReactNode }[] = [
    { key: 'initial', label: 'Initial', icon: <Stethoscope size={14} /> },
    { key: 'investigation', label: 'Investigation', icon: <FlaskConical size={14} /> },
    { key: 'final', label: 'Final Rx', icon: <ClipboardCheck size={14} /> },
  ];

  const buildVisit = (): Visit => ({
    id: visitIdRef.current,
    patientId: patient.id,
    date: existingVisit?.date ?? new Date().toISOString(),
    stage,
    chiefComplaint, examinationFindings,
    provisionalMedicines,
    investigations, investigationNotes,
    finalDiagnosis, medicines, advice, followUpDays: followUpDays || undefined,
    createdAt: existingVisit?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const buildPrescription = (isProvisional = false): Prescription => ({
    id: crypto.randomUUID(),
    patientId: patient.id,
    chamberId,
    consultationType,
    symptoms: chiefComplaint,
    diagnosis: isProvisional ? '' : finalDiagnosis,
    medicines: isProvisional ? provisionalMedicines : medicines,
    advice: isProvisional ? '' : advice,
    tests: investigations,
    examinationFindings,
    followUpDays: isProvisional ? undefined : (followUpDays || undefined),
    language: 'en',
    createdAt: new Date().toISOString(),
    visitId: visitIdRef.current,
    isProvisional,
    provisionalMedicines: isProvisional ? provisionalMedicines : undefined,
  });

  const previewRx = generateProvisionalRx ? buildPrescription(true) : buildPrescription(false);

  const handleSendForInvestigation = () => {
    const visit = buildVisit();
    visit.stage = 'investigation';
    onSaveVisit(visit);
    setStage('investigation');
  };

  const handleSavePending = () => {
    const visit = buildVisit();
    visit.stage = 'investigation';
    onSaveVisit(visit);
    onBack();
  };

  const handleSavePendingAndContinue = () => {
    const visit = buildVisit();
    visit.stage = 'investigation';
    onSaveVisit(visit);
    setStage('final');
  };

  const handleGenerateProvisionalRx = () => {
    const visit = buildVisit();
    onSaveVisit(visit);
    const rx = buildPrescription(true);
    onSavePrescription(rx);
    setGenerateProvisionalRx(true);
    setShowPreview(true);
  };

  const handleGeneratePrescription = async () => {
    const visit = buildVisit();
    visit.stage = 'final';
    const rx = buildPrescription(false);
    visit.prescriptionId = rx.id;
    onSaveVisit(visit);
    onSavePrescription(rx);
    setGenerateProvisionalRx(false);
    setShowPreview(true);

    // Send prescription email to patient
    try {
      const { data: patientRow } = await supabase.from('patients').select('user_id').eq('id', patient.id).single();
      if (patientRow?.user_id) {
        const { data: { user: patientUser } } = await supabase.auth.admin?.getUserById?.(patientRow.user_id) ?? { data: { user: null } };
        // Fallback: look up email from patients table phone or use user_id lookup
        const { data: aptData } = await supabase.from('appointments').select('patient_email').eq('patient_id', patient.id).not('patient_email', 'is', null).limit(1).single();
        const patientEmail = aptData?.patient_email;
        if (patientEmail) {
          const medList = rx.medicines.map(m => m.name).join(', ');
          sendAppointmentEmail({
            type: 'prescription_ready',
            to: patientEmail,
            patientName: patient.name,
            date: new Date().toISOString().split('T')[0],
            time: '',
            diagnosis: rx.diagnosis,
            medicines: medList,
          });
        }
      }
    } catch (e) {
      console.error('Failed to send prescription email:', e);
    }
  };

  // PDF generation removed — doctors upload prescription PDFs directly in stage 3.

  const removeMedicine = (i: number) => setMedicines(prev => prev.filter((_, idx) => idx !== i));
  const removeProvisionalMedicine = (i: number) => setProvisionalMedicines(prev => prev.filter((_, idx) => idx !== i));

  // Provisional medicine list component (reused in stage 1 & 2)
  const ProvisionalMedicineSection = () => (
    <div className="space-y-3">
      <div className="border border-amber-200 dark:border-amber-800/50 rounded-lg bg-amber-50/50 dark:bg-amber-900/10 p-4" style={{ overflow: 'visible' }}>
        <h3 className="text-sm font-semibold mb-1 flex items-center gap-1.5">
          <Pill size={14} className="text-amber-600" />
          Provisional Treatment (Before Diagnosis)
        </h3>
        <p className="text-[10px] text-muted-foreground mb-3">Optional — Prescribe symptomatic relief before final diagnosis</p>
        <MedicineAutoSuggest onAdd={med => setProvisionalMedicines(prev => [...prev, med])} />
      </div>

      {provisionalMedicines.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-amber-600">Provisional Medicines ({provisionalMedicines.length})</h3>
          {provisionalMedicines.map((med, i) => (
            <div key={i} className="glass-card p-3 space-y-2 border-amber-200/50 dark:border-amber-800/30">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-sm">
                    {med.type && <span className="text-muted-foreground mr-1">{med.type}</span>}
                    {med.name}
                  </div>
                  {med.genericName && <div className="text-[10px] text-muted-foreground">{med.genericName}</div>}
                </div>
                <button onClick={() => removeProvisionalMedicine(i)} className="text-muted-foreground hover:text-destructive p-1 btn-press">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <select value={med.dosage} onChange={e => setProvisionalMedicines(prev => prev.map((m, idx) => idx === i ? { ...m, dosage: e.target.value } : m))} className="medical-input text-xs py-1.5">
                  {DOSAGE_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={med.frequency} onChange={e => setProvisionalMedicines(prev => prev.map((m, idx) => idx === i ? { ...m, frequency: e.target.value } : m))} className="medical-input text-xs py-1.5">
                  {FREQUENCY_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <select value={med.duration} onChange={e => setProvisionalMedicines(prev => prev.map((m, idx) => idx === i ? { ...m, duration: e.target.value } : m))} className="medical-input text-xs py-1.5">
                  {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <input
                value={med.instructions || ''}
                onChange={e => setProvisionalMedicines(prev => prev.map((m, idx) => idx === i ? { ...m, instructions: e.target.value } : m))}
                placeholder="Instructions (optional)"
                className="medical-input w-full text-xs py-1.5"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (showPreview) {
    return (
      <div className="p-4 md:p-6 xl:p-8 space-y-4 page-transition">
        <div className="flex items-center justify-between">
          <button onClick={() => setShowPreview(false)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={16} /> Back
          </button>
          {onGoToDashboard && (
            <button onClick={onGoToDashboard} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted transition-all duration-200 btn-press">
              <Home size={14} /> Dashboard
            </button>
          )}
        </div>
        <div className="rounded-xl border border-dashed border-border/50 p-10 text-center text-sm text-muted-foreground">
          Prescription saved. Upload the prescription PDF from Stage 3 so the patient can download it.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 xl:p-8 space-y-4 page-transition">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={16} /> Back to Profile
        </button>
        {onGoToDashboard && (
          <button onClick={onGoToDashboard} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted transition-all duration-200 btn-press">
            <Home size={14} /> Dashboard
          </button>
        )}
      </div>

      <h2 className="text-lg font-display font-semibold">Visit — {patient.name}</h2>

      {/* Stage Indicator */}
      <div className="flex items-center gap-2">
        {stageSteps.map((s, i) => (
          <React.Fragment key={s.key}>
            <button
              onClick={() => setStage(s.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 btn-press ${
                stage === s.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {s.icon} {s.label}
            </button>
            {i < stageSteps.length - 1 && <div className="w-4 h-0.5 bg-border rounded" />}
          </React.Fragment>
        ))}
      </div>

      {/* Stage 1: Initial */}
      {stage === 'initial' && (
        <div className="space-y-4 animate-fade-in">
          {patient.allergies.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm">
              <strong className="text-destructive">⚠ Allergies:</strong> {patient.allergies.join(', ')}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Chief Complaint (C/O)</label>
            <textarea value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)}
              className="medical-input w-full min-h-[60px] resize-none" placeholder="e.g., Fever for 3 days, headache" />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Examination Findings</label>
            <textarea value={examinationFindings} onChange={e => setExaminationFindings(e.target.value)}
              className="medical-input w-full min-h-[80px] resize-none" placeholder="Physical examination findings..." />
          </div>

          {/* Provisional Treatment */}
          <ProvisionalMedicineSection />

          <div className="flex gap-2">
            <button onClick={handleSendForInvestigation}
              className="flex-1 rounded-lg py-3 font-medium text-sm bg-primary text-primary-foreground hover:opacity-90 transition-all duration-200 btn-press flex items-center justify-center gap-2">
              <Send size={16} /> Send for Investigation
            </button>
            {provisionalMedicines.length > 0 && (
              <button onClick={handleGenerateProvisionalRx}
                className="rounded-lg py-3 px-4 font-medium text-sm border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all duration-200 btn-press flex items-center justify-center gap-2">
                <FileText size={16} /> Provisional Rx
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stage 2: Investigation */}
      {stage === 'investigation' && (
        <div className="space-y-4 animate-fade-in">
          <AutoSuggestInput
            label="Investigations (Tests)"
            placeholder={"e.g., CBC\nBlood Sugar (Fasting)"}
            suggestions={COMMON_INVESTIGATIONS}
            value={investigations}
            onChange={setInvestigations}
            multiLine
          />

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Investigation Notes</label>
            <textarea value={investigationNotes} onChange={e => setInvestigationNotes(e.target.value)}
              className="medical-input w-full min-h-[60px] resize-none" placeholder="Notes about investigation results..." />
          </div>

          {/* Provisional Treatment */}
          <ProvisionalMedicineSection />

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button onClick={handleSavePending}
                className="flex-1 rounded-lg py-3 font-medium text-sm bg-primary text-primary-foreground hover:opacity-90 transition-all duration-200 btn-press flex items-center justify-center gap-2">
                <Save size={16} /> Save as Pending Report
              </button>
              {provisionalMedicines.length > 0 && (
                <button onClick={handleGenerateProvisionalRx}
                  className="rounded-lg py-3 px-4 font-medium text-sm border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all duration-200 btn-press flex items-center justify-center gap-2">
                  <FileText size={16} /> Provisional Rx
                </button>
              )}
            </div>
            <button onClick={handleSavePendingAndContinue}
              className="w-full rounded-lg py-3 font-medium text-sm border border-border text-foreground hover:bg-muted transition-all duration-200 btn-press flex items-center justify-center gap-2">
              <ChevronRight size={16} /> Save & Continue to Prescription
            </button>
          </div>
          <p className="text-xs text-center text-muted-foreground">Final prescription is not generated at this stage</p>
        </div>
      )}

      {/* Stage 3: Final Prescription */}
      {stage === 'final' && (
        <div className="space-y-4 animate-fade-in">
          {/* Consultation Type */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Consultation Type</label>
            <div className="flex gap-2">
              <button onClick={() => setConsultationType('chamber')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 btn-press ${
                  consultationType === 'chamber' ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:bg-muted'
                }`}>🏥 Chamber</button>
              <button onClick={() => setConsultationType('online')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 btn-press ${
                  consultationType === 'online' ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:bg-muted'
                }`}>🌐 Online</button>
            </div>
          </div>

          {consultationType === 'chamber' && doctorSettings.chambers.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <Building2 size={12} /> Chamber
              </label>
              <select value={chamberId} onChange={e => setChamberId(e.target.value)} className="medical-input w-full">
                {doctorSettings.chambers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          <AutoSuggestInput
            label="Final Diagnosis *"
            placeholder="e.g., Acute Gastritis, Viral Fever"
            suggestions={COMMON_DIAGNOSES}
            value={finalDiagnosis}
            onChange={setFinalDiagnosis}
          />

          {/* Prescription PDF upload — primary delivery to patient */}
          <div className="border border-primary/30 rounded-lg bg-primary/5 p-4 space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <FileText size={14} className="text-primary" /> Prescription PDF
            </h3>
            <p className="text-[10px] text-muted-foreground">Upload the signed prescription PDF — the patient will be able to download it from their portal.</p>
            <PrescriptionUpload
              patientId={patient.id}
              visitId={visitIdRef.current}
              files={rxFiles}
              onChange={fetchRxFiles}
            />
          </div>
          {/* Show provisional medicines if any were added */}
          {provisionalMedicines.length > 0 && (
            <div className="border border-amber-200 dark:border-amber-800/50 rounded-lg bg-amber-50/30 dark:bg-amber-900/10 p-3">
              <h3 className="text-xs font-semibold text-amber-600 mb-2 flex items-center gap-1.5">
                <Pill size={12} /> Provisional Treatment ({provisionalMedicines.length} medicines)
              </h3>
              {provisionalMedicines.map((med, i) => (
                <div key={i} className="text-xs text-muted-foreground ml-3">
                  ▸ {med.type && <span className="uppercase mr-1">{med.type}</span>}{med.name} — {med.dosage}, {med.frequency}, {med.duration}
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground mt-2 italic">These will be shown separately in the prescription</p>
            </div>
          )}

          <div className="relative p-4 border border-border rounded-lg bg-card" style={{ overflow: 'visible' }}>
            <h3 className="text-sm font-semibold mb-1">Final Treatment (After Diagnosis)</h3>
            <p className="text-[10px] text-muted-foreground mb-3">These are the definitive medicines based on your diagnosis</p>
            <MedicineAutoSuggest onAdd={med => setMedicines(prev => [...prev, med])} />
          </div>

          {medicines.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground">Final Medicines ({medicines.length})</h3>
              {medicines.map((med, i) => (
                <div key={i} className="glass-card p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-sm">
                        {med.type && <span className="text-muted-foreground mr-1">{med.type}</span>}
                        {med.name}
                      </div>
                      {med.genericName && <div className="text-[10px] text-muted-foreground">{med.genericName}</div>}
                    </div>
                    <button onClick={() => removeMedicine(i)} className="text-muted-foreground hover:text-destructive p-1 btn-press">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <select value={med.dosage} onChange={e => setMedicines(prev => prev.map((m, idx) => idx === i ? { ...m, dosage: e.target.value } : m))} className="medical-input text-xs py-1.5">
                      {DOSAGE_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select value={med.frequency} onChange={e => setMedicines(prev => prev.map((m, idx) => idx === i ? { ...m, frequency: e.target.value } : m))} className="medical-input text-xs py-1.5">
                      {FREQUENCY_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <select value={med.duration} onChange={e => setMedicines(prev => prev.map((m, idx) => idx === i ? { ...m, duration: e.target.value } : m))} className="medical-input text-xs py-1.5">
                      {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <input
                    value={med.instructions || ''}
                    onChange={e => setMedicines(prev => prev.map((m, idx) => idx === i ? { ...m, instructions: e.target.value } : m))}
                    placeholder="Instructions (optional)"
                    className="medical-input w-full text-xs py-1.5"
                  />
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Advice</label>
            <textarea value={advice} onChange={e => setAdvice(e.target.value)}
              className="medical-input w-full min-h-[60px] resize-none" placeholder={"e.g., Avoid spicy food\nTake rest for 3 days"} />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Follow-up</label>
            <select value={followUpDays} onChange={e => setFollowUpDays(e.target.value)} className="medical-input w-full">
              <option value="">No follow-up specified</option>
              {FOLLOW_UP_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <button onClick={handleGeneratePrescription} disabled={!finalDiagnosis.trim() || medicines.length === 0}
            className="w-full rounded-lg py-3 font-medium text-sm bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-all duration-200 btn-press flex items-center justify-center gap-2">
            <FileText size={16} /> Generate Prescription
          </button>
        </div>
      )}
    </div>
  );
};

export default VisitWorkflow;
