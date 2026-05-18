import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Patient, Prescription, DoctorSettings, Visit, Medicine, Chamber, OnlineConsultation } from '@/types/medical';
import { toast } from 'sonner';

// ── helpers ──────────────────────────────────────────────

function dbToPatient(r: any): Patient {
  return {
    id: r.id,
    name: r.name,
    age: r.age,
    gender: r.gender,
    occupation: r.occupation ?? undefined,
    avatarUrl: r.avatar_url ?? undefined,
    weight: r.weight ? Number(r.weight) : undefined,
    height: r.height_cm ? Number(r.height_cm) : undefined,
    heightUnit: r.height_cm ? 'cm' : r.height_feet ? 'ft' : undefined,
    heightFeet: r.height_feet ?? undefined,
    heightInches: r.height_inches ?? undefined,
    phone: r.phone ?? undefined,
    maritalStatus: r.marital_status,
    address: r.address ?? '',
    nationality: '',
    
    chiefComplaint: r.chief_complaint ?? undefined,
    historyOfPresentIllness: r.history_of_present_illness ?? undefined,
    detailedInfo: {
      pastIllnessHistory: r.past_illness_history ?? undefined,
      treatmentHistory: r.treatment_history ?? undefined,
      personalHistory: r.personal_history ?? undefined,
      obGynHistory: r.ob_gyn_history ?? undefined,
      immunizationHistory: r.immunization_history ?? undefined,
      drugHistory: r.drug_history ?? undefined,
      socioEconomicStatus: r.socio_economic_status ?? undefined,
    },
    medicalConditions: r.medical_conditions ?? [],
    allergies: r.allergies ?? [],
    pregnancyStatus: r.pregnancy_status ?? undefined,
    previousChildbirths: r.previous_childbirths ?? undefined,
    physicalActivity: r.physical_activity ?? undefined,
    reports: [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function patientToDb(p: Patient) {
  return {
    id: p.id,
    name: p.name,
    age: p.age,
    gender: p.gender,
    occupation: p.occupation ?? null,
    weight: p.weight ?? null,
    height_feet: p.heightFeet ?? null,
    height_inches: p.heightInches ?? null,
    height_cm: p.height && p.heightUnit === 'cm' ? p.height : (p.heightFeet && p.heightInches != null ? Math.round((p.heightFeet * 12 + p.heightInches) * 2.54) : null),
    phone: p.phone ?? null,
    marital_status: p.maritalStatus,
    address: p.address || null,
    
    chief_complaint: p.chiefComplaint ?? null,
    history_of_present_illness: p.historyOfPresentIllness ?? null,
    physical_activity: p.physicalActivity ?? null,
    medical_conditions: p.medicalConditions ?? [],
    allergies: p.allergies ?? [],
    past_illness_history: p.detailedInfo?.pastIllnessHistory ?? null,
    treatment_history: p.detailedInfo?.treatmentHistory ?? null,
    personal_history: p.detailedInfo?.personalHistory ?? null,
    immunization_history: p.detailedInfo?.immunizationHistory ?? null,
    drug_history: p.detailedInfo?.drugHistory ?? null,
    socio_economic_status: p.detailedInfo?.socioEconomicStatus ?? null,
    pregnancy_status: p.pregnancyStatus ?? null,
    previous_childbirths: p.previousChildbirths ?? null,
    ob_gyn_history: p.detailedInfo?.obGynHistory ?? null,
    updated_at: new Date().toISOString(),
  };
}

function dbToVisit(r: any): Visit {
  return {
    id: r.id,
    patientId: r.patient_id,
    date: r.date,
    stage: r.stage,
    chiefComplaint: r.chief_complaint ?? undefined,
    examinationFindings: r.examination_findings ?? undefined,
    provisionalMedicines: r.provisional_medicines as Medicine[] ?? [],
    investigations: r.investigations ?? undefined,
    investigationNotes: r.investigation_notes ?? undefined,
    finalDiagnosis: r.final_diagnosis ?? undefined,
    medicines: r.medicines as Medicine[] ?? [],
    advice: r.advice ?? undefined,
    followUpDays: r.follow_up_days ?? undefined,
    prescriptionId: r.prescription_id ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function visitToDb(v: Visit) {
  return {
    id: v.id,
    patient_id: v.patientId,
    date: v.date,
    stage: v.stage,
    chief_complaint: v.chiefComplaint ?? null,
    examination_findings: v.examinationFindings ?? null,
    provisional_medicines: v.provisionalMedicines ?? [],
    investigations: v.investigations ?? null,
    investigation_notes: v.investigationNotes ?? null,
    final_diagnosis: v.finalDiagnosis ?? null,
    medicines: v.medicines ?? [],
    advice: v.advice ?? null,
    follow_up_days: v.followUpDays ?? null,
    prescription_id: v.prescriptionId ?? null,
    updated_at: new Date().toISOString(),
  };
}

function dbToPrescription(r: any): Prescription {
  return {
    id: r.id,
    patientId: r.patient_id,
    chamberId: r.chamber_id,
    consultationType: r.consultation_type ?? undefined,
    symptoms: r.symptoms,
    diagnosis: r.diagnosis,
    medicines: r.medicines as Medicine[] ?? [],
    advice: r.advice ?? '',
    tests: r.tests ?? '',
    examinationFindings: r.examination_findings ?? undefined,
    followUpDays: r.follow_up_days ?? undefined,
    language: r.language,
    createdAt: r.created_at,
    visitId: r.visit_id ?? undefined,
    isProvisional: r.is_provisional ?? false,
    provisionalMedicines: r.provisional_medicines as Medicine[] ?? [],
  };
}

function prescriptionToDb(p: Prescription) {
  return {
    id: p.id,
    patient_id: p.patientId,
    chamber_id: p.chamberId,
    consultation_type: p.consultationType ?? null,
    symptoms: p.symptoms,
    diagnosis: p.diagnosis,
    medicines: p.medicines ?? [],
    advice: p.advice ?? '',
    tests: p.tests ?? '',
    examination_findings: p.examinationFindings ?? null,
    follow_up_days: p.followUpDays ?? null,
    language: p.language,
    visit_id: p.visitId ?? null,
    is_provisional: p.isProvisional ?? false,
    provisional_medicines: p.provisionalMedicines ?? [],
  };
}

// ── hooks ────────────────────────────────────────────────

export function usePatients() {
  const [data, setData] = useState<Patient[]>([]);

  const fetchAll = useCallback(async () => {
    const { data: rows, error } = await supabase.from('patients').select('*').order('created_at', { ascending: false });
    if (error) { console.error(error); return; }
    setData((rows ?? []).map(dbToPatient));
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('patients-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, () => { fetchAll(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  const save = useCallback(async (patient: Patient) => {
    const row = patientToDb(patient);
    const { error } = await supabase.from('patients').upsert(row as any);
    if (error) { toast.error('Failed to save patient'); console.error(error); return; }
    await fetchAll();
  }, [fetchAll]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('patients').delete().eq('id', id);
    if (error) { toast.error('Failed to delete patient'); console.error(error); return; }
    await fetchAll();
  }, [fetchAll]);

  const removeByPatient = useCallback(async (patientId: string) => {
    await remove(patientId);
  }, [remove]);

  return { data, save, remove, removeByPatient };
}

export function useVisits() {
  const [data, setData] = useState<Visit[]>([]);

  const fetchAll = useCallback(async () => {
    const { data: rows, error } = await supabase.from('visits').select('*').order('created_at', { ascending: false });
    if (error) { console.error(error); return; }
    setData((rows ?? []).map(dbToVisit));
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const channel = supabase
      .channel('visits-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => { fetchAll(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  const save = useCallback(async (visit: Visit) => {
    const row = visitToDb(visit);
    const { error } = await supabase.from('visits').upsert(row as any);
    if (error) { toast.error('Failed to save visit'); console.error(error); return; }
    await fetchAll();
  }, [fetchAll]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('visits').delete().eq('id', id);
    if (error) { toast.error('Failed to delete visit'); console.error(error); return; }
    await fetchAll();
  }, [fetchAll]);

  const removeByPatient = useCallback(async (patientId: string) => {
    const { error } = await supabase.from('visits').delete().eq('patient_id', patientId);
    if (error) { toast.error('Failed to delete visits'); console.error(error); return; }
    await fetchAll();
  }, [fetchAll]);

  return { data, save, remove, removeByPatient };
}

export function usePrescriptions() {
  const [data, setData] = useState<Prescription[]>([]);

  const fetchAll = useCallback(async () => {
    const { data: rows, error } = await supabase.from('prescriptions').select('*').order('created_at', { ascending: false });
    if (error) { console.error(error); return; }
    setData((rows ?? []).map(dbToPrescription));
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const channel = supabase
      .channel('prescriptions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prescriptions' }, () => { fetchAll(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  const save = useCallback(async (prescription: Prescription) => {
    const row = prescriptionToDb(prescription);
    const { error } = await supabase.from('prescriptions').upsert(row as any);
    if (error) { toast.error('Failed to save prescription'); console.error(error); return; }
    await fetchAll();
  }, [fetchAll]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('prescriptions').delete().eq('id', id);
    if (error) { toast.error('Failed to delete prescription'); console.error(error); return; }
    await fetchAll();
  }, [fetchAll]);

  const removeByPatient = useCallback(async (patientId: string) => {
    const { error } = await supabase.from('prescriptions').delete().eq('patient_id', patientId);
    if (error) { toast.error('Failed to delete prescriptions'); console.error(error); return; }
    await fetchAll();
  }, [fetchAll]);

  return { data, save, remove, removeByPatient };
}

export function useDoctorSettings(defaultSettings: DoctorSettings) {
  const [data, setData] = useState<DoctorSettings>(defaultSettings);

  const fetchSettings = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: row, error } = await supabase.from('doctor_settings').select('*').eq('user_id', user.id).maybeSingle();
    if (error) { console.error(error); return; }
    if (row) {
      setData({
        name: row.name,
        nameBn: row.name_bn ?? undefined,
        degrees: row.degrees,
        degreesBn: row.degrees_bn ?? undefined,
        specialization: row.specialization ?? undefined,
        specializationBn: row.specialization_bn ?? undefined,
        title: row.title ?? undefined,
        titleBn: row.title_bn ?? undefined,
        institution: row.institution ?? undefined,
        institutionBn: row.institution_bn ?? undefined,
        mobile: row.mobile,
        email: row.email,
        website: row.website ?? '',
        signatureDataUrl: row.signature_data_url ?? undefined,
        chambers: (row.chambers as unknown as Chamber[]) ?? [],
        onlineConsultation: (row.online_consultation as unknown as OnlineConsultation) ?? undefined,
        
      });
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const save = useCallback(async (settings: DoctorSettings) => {
    setData(settings);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Not authenticated'); return; }
    const row = {
      user_id: user.id,
      name: settings.name,
      name_bn: settings.nameBn ?? null,
      degrees: settings.degrees,
      degrees_bn: settings.degreesBn ?? null,
      specialization: settings.specialization ?? null,
      specialization_bn: settings.specializationBn ?? null,
      title: settings.title ?? null,
      title_bn: settings.titleBn ?? null,
      institution: settings.institution ?? null,
      institution_bn: settings.institutionBn ?? null,
      mobile: settings.mobile,
      email: settings.email,
      website: settings.website ?? '',
      signature_data_url: settings.signatureDataUrl ?? null,
      chambers: settings.chambers ?? [],
      online_consultation: settings.onlineConsultation ?? null,
      
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('doctor_settings').upsert(row as any, { onConflict: 'user_id' });
    if (error) { toast.error('Failed to save settings'); console.error(error); return; }
  }, []);

  return { data, save };
}
