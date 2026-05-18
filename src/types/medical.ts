export type PhysicalActivity = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extra_active';

export const ACTIVITY_LABELS: Record<PhysicalActivity, string> = {
  sedentary: 'Sedentary (little or no exercise)',
  lightly_active: 'Lightly Active (1-3 days/week)',
  moderately_active: 'Moderately Active (3-5 days/week)',
  very_active: 'Very Active (6-7 days/week)',
  extra_active: 'Extra Active (physical job)',
};

export const ACTIVITY_MULTIPLIERS: Record<PhysicalActivity, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
};

export type VisitStage = 'initial' | 'investigation' | 'final';

export const VISIT_STAGE_LABELS: Record<VisitStage, string> = {
  initial: 'Initial Visit',
  investigation: 'Investigation',
  final: 'Final Prescription',
};

export const VISIT_STAGE_COLORS: Record<VisitStage, string> = {
  initial: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  investigation: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  final: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
};

export interface Visit {
  id: string;
  patientId: string;
  date: string;
  stage: VisitStage;
  // Stage 1: Initial
  chiefComplaint?: string;
  examinationFindings?: string;
  // Stage 1 & 2: Provisional Treatment
  provisionalMedicines?: Medicine[];
  // Stage 2: Investigation
  investigations?: string;
  investigationNotes?: string;
  // Stage 3: Final
  finalDiagnosis?: string;
  medicines?: Medicine[];
  advice?: string;
  followUpDays?: string;
  // Prescription reference
  prescriptionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PatientDetailedInfo {
  pastIllnessHistory?: string;
  treatmentHistory?: string;
  personalHistory?: string;
  obGynHistory?: string;
  immunizationHistory?: string;
  drugHistory?: string;
  socioEconomicStatus?: string;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  occupation?: string;
  avatarUrl?: string;
  weight?: number;
  height?: number;
  heightUnit?: 'cm' | 'ft';
  heightFeet?: number;
  heightInches?: number;
  phone?: string;
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed';
  address: string;
  nationality: string;
  
  // Initial medical info
  chiefComplaint?: string;
  historyOfPresentIllness?: string;
  // Detailed info
  detailedInfo?: PatientDetailedInfo;
  medicalConditions: string[];
  allergies: string[];
  pregnancyStatus?: 'pregnant' | 'not_pregnant' | 'na';
  previousChildbirths?: number;
  physicalActivity?: PhysicalActivity;
  reports?: PatientReport[];
  createdAt: string;
  updatedAt: string;
}

export interface PatientReport {
  id: string;
  name: string;
  date: string;
  dataUrl: string;
  fileType: string;
}

export interface Chamber {
  id: string;
  name: string;
  address: string;
  phone?: string;
  visitingHours: string;
}

export interface OnlineConsultation {
  enabled: boolean;
  email?: string;
  phone?: string;
  website?: string;
  scheduleLink?: string;
}

export interface DoctorSettings {
  name: string;
  nameBn?: string;
  degrees: string;
  degreesBn?: string;
  specialization?: string;
  specializationBn?: string;
  title?: string;
  titleBn?: string;
  institution?: string;
  institutionBn?: string;
  mobile: string;
  email: string;
  website: string;
  signatureDataUrl?: string;
  chambers: Chamber[];
  onlineConsultation?: OnlineConsultation;
  
}

export interface Medicine {
  name: string;
  genericName?: string;
  type?: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  chamberId: string;
  consultationType?: 'chamber' | 'online';
  symptoms: string;
  diagnosis: string;
  medicines: Medicine[];
  advice: string;
  tests: string;
  examinationFindings?: string;
  followUpDays?: string;
  language: 'en' | 'bn';
  createdAt: string;
  visitId?: string;
  isProvisional?: boolean;
  provisionalMedicines?: Medicine[];
}

export const FOLLOW_UP_OPTIONS = ['3 days', '5 days', '7 days', '10 days', '14 days', '1 month', '2 months', '3 months', '6 months'];

export const COMMON_DIAGNOSES = [
  "Acute Gastritis", "Acute Pharyngitis", "Acute Bronchitis", "Acute Sinusitis",
  "Acute Tonsillitis", "Acute Rhinitis", "Acute Otitis Media",
  "Viral Fever", "Dengue Fever", "Typhoid Fever", "Malaria",
  "Urinary Tract Infection", "Upper Respiratory Tract Infection", "Lower Respiratory Tract Infection",
  "Pneumonia", "Bronchial Asthma", "COPD Exacerbation",
  "Peptic Ulcer Disease", "Gastroesophageal Reflux Disease", "Irritable Bowel Syndrome",
  "Acute Gastroenteritis", "Dysentery", "Food Poisoning",
  "Hypertension", "Diabetes Mellitus Type 2", "Hyperlipidemia",
  "Ischemic Heart Disease", "Heart Failure", "Atrial Fibrillation",
  "Iron Deficiency Anemia", "Vitamin B12 Deficiency", "Vitamin D Deficiency",
  "Hypothyroidism", "Hyperthyroidism",
  "Osteoarthritis", "Rheumatoid Arthritis", "Gout", "Low Back Pain", "Cervical Spondylosis",
  "Migraine", "Tension Headache", "Vertigo",
  "Major Depressive Disorder", "Generalized Anxiety Disorder", "Insomnia",
  "Allergic Rhinitis", "Allergic Dermatitis", "Urticaria", "Eczema", "Psoriasis",
  "Scabies", "Fungal Infection", "Cellulitis", "Abscess",
  "Chronic Kidney Disease", "Nephrotic Syndrome", "Nephrolithiasis",
  "Hepatitis B", "Hepatitis C", "Fatty Liver Disease",
  "Pregnancy (Normal)", "Gestational Diabetes", "Preeclampsia",
];

export const COMMON_INVESTIGATIONS = [
  "CBC (Complete Blood Count)", "ESR", "CRP",
  "Blood Sugar (Fasting)", "Blood Sugar (2h ABF)", "HbA1c", "OGTT",
  "Lipid Profile", "Liver Function Test", "Renal Function Test",
  "Serum Electrolytes", "Serum Uric Acid", "Serum Calcium",
  "Thyroid Function Test (TSH, FT3, FT4)", "Serum Ferritin", "Serum Iron", "TIBC",
  "Serum Vitamin D", "Serum Vitamin B12", "Serum Folate",
  "Urine R/M/E", "Urine C/S", "Urine for Albumin",
  "Stool R/M/E", "Stool for OBT",
  "Blood Group & Rh Typing", "HBsAg", "Anti-HCV", "HIV Screening",
  "Widal Test", "Dengue NS1 Antigen", "Dengue IgM/IgG", "Malaria ICT",
  "Chest X-Ray P/A View", "X-Ray Lumbosacral Spine", "X-Ray Cervical Spine",
  "ECG (12 Lead)", "Echocardiography", "Holter Monitor",
  "USG of Whole Abdomen", "USG of KUB", "USG of Thyroid",
  "CT Scan Brain", "CT Scan Chest", "MRI Brain", "MRI Spine",
  "Endoscopy (Upper GI)", "Colonoscopy",
  "Pulmonary Function Test (PFT)", "ABG Analysis",
  "Sputum for AFB", "Sputum C/S",
  "RA Factor", "ANA", "Anti-CCP",
  "PSA (Prostate Specific Antigen)", "CEA", "AFP",
  "Peripheral Blood Film", "Reticulocyte Count", "Bone Marrow Study",
  "PT/INR", "APTT", "D-Dimer",
  "Blood C/S", "Procalcitonin",
  "24h Urinary Protein", "GFR Estimation",
];

export { MEDICINE_DATABASE } from '@/data/medicineDatabase';

export const COMMON_CONDITIONS = [
  "Diabetes Mellitus", "Hypertension", "Asthma", "COPD",
  "Coronary Heart Disease", "Thyroid Disorder", "Chronic Kidney Disease",
  "Liver Disease", "Peptic Ulcer", "Arthritis", "Epilepsy",
  "Migraine", "Depression", "Anxiety",
];

export const DOSAGE_OPTIONS = ["1+0+0", "0+0+1", "1+0+1", "1+1+1", "0+1+0", "1+1+0", "0+1+1"];
export const FREQUENCY_OPTIONS = ["Before meal", "After meal", "Empty stomach", "As needed", "At bedtime"];
export const DURATION_OPTIONS = ["3 days", "5 days", "7 days", "10 days", "14 days", "1 month", "2 months", "3 months", "Continuing"];

export function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

export function getBMIStatus(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: 'Underweight', color: 'text-amber-600' };
  if (bmi < 25) return { label: 'Normal', color: 'text-emerald-600' };
  if (bmi < 30) return { label: 'Overweight', color: 'text-amber-600' };
  return { label: 'Obese', color: 'text-destructive' };
}

export function calculateBMR(weightKg: number, heightCm: number, age: number, gender: string): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return gender === 'female' ? base - 161 : base + 5;
}
