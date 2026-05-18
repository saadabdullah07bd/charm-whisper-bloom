import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Patient, type PhysicalActivity, COMMON_CONDITIONS, ACTIVITY_LABELS, ACTIVITY_MULTIPLIERS, calculateBMI, getBMIStatus, calculateBMR } from '@/types/medical';
import { Activity } from 'lucide-react';

interface Props {
  onSave: (patient: Patient) => void;
  onCancel: () => void;
  initial?: Patient;
}

const PatientForm: React.FC<Props> = ({ onSave, onCancel, initial }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    age: initial?.age ?? '' as string | number,
    gender: initial?.gender ?? 'male' as Patient['gender'],
    occupation: initial?.occupation ?? '',
    weight: initial?.weight ?? '' as string | number,
    heightFeet: initial?.heightFeet ?? '' as string | number,
    heightInches: initial?.heightInches ?? '' as string | number,
    phone: initial?.phone ?? '',
    maritalStatus: initial?.maritalStatus ?? 'single' as Patient['maritalStatus'],
    address: initial?.address ?? '',
    nationality: initial?.nationality ?? 'Bangladesh',
    chiefComplaint: initial?.chiefComplaint ?? '',
    historyOfPresentIllness: initial?.historyOfPresentIllness ?? '',
    medicalConditions: initial?.medicalConditions ?? [] as string[],
    allergies: initial?.allergies?.join(', ') ?? '',
    pregnancyStatus: initial?.pregnancyStatus ?? 'na' as Patient['pregnancyStatus'],
    previousChildbirths: initial?.previousChildbirths ?? '' as string | number,
    physicalActivity: initial?.physicalActivity ?? 'sedentary' as PhysicalActivity,
    // Detailed info
    pastIllnessHistory: initial?.detailedInfo?.pastIllnessHistory ?? '',
    treatmentHistory: initial?.detailedInfo?.treatmentHistory ?? '',
    personalHistory: initial?.detailedInfo?.personalHistory ?? '',
    obGynHistory: initial?.detailedInfo?.obGynHistory ?? '',
    immunizationHistory: initial?.detailedInfo?.immunizationHistory ?? '',
    drugHistory: initial?.detailedInfo?.drugHistory ?? '',
    socioEconomicStatus: initial?.detailedInfo?.socioEconomicStatus ?? '',
    
  });
  const [conditionInput, setConditionInput] = useState('');

  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

  const addCondition = (c: string) => {
    if (c && !form.medicalConditions.includes(c)) {
      set('medicalConditions', [...form.medicalConditions, c]);
    }
    setConditionInput('');
  };

  const removeCondition = (c: string) => {
    set('medicalConditions', form.medicalConditions.filter(x => x !== c));
  };

  const getHeightCm = (): number | undefined => {
    const ft = Number(form.heightFeet) || 0;
    const inch = Number(form.heightInches) || 0;
    if (ft === 0 && inch === 0) return undefined;
    return Math.round(ft * 30.48 + inch * 2.54);
  };

  const getWeightKg = (): number => Number(form.weight) || 0;

  const heightCm = getHeightCm();
  const weightKg = getWeightKg();
  const ageNum = Number(form.age) || 0;
  const bmi = weightKg > 0 && heightCm && heightCm > 0 ? calculateBMI(weightKg, heightCm) : null;
  const bmiStatus = bmi ? getBMIStatus(bmi) : null;
  const bmr = weightKg > 0 && heightCm && heightCm > 0 && ageNum > 0 ? calculateBMR(weightKg, heightCm, ageNum, form.gender) : null;
  const tdee = bmr ? Math.round(bmr * ACTIVITY_MULTIPLIERS[form.physicalActivity]) : null;

  const filteredConditions = COMMON_CONDITIONS.filter(
    c => c.toLowerCase().includes(conditionInput.toLowerCase()) && !form.medicalConditions.includes(c)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    const finalHeightCm = getHeightCm();
    const finalWeightKg = getWeightKg();

    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: form.name,
      age: Number(form.age),
      gender: form.gender,
      occupation: form.occupation || undefined,
      weight: finalWeightKg > 0 ? Math.round(finalWeightKg * 10) / 10 : undefined,
      height: finalHeightCm,
      heightUnit: 'ft',
      heightFeet: Number(form.heightFeet) || undefined,
      heightInches: Number(form.heightInches) || undefined,
      phone: form.phone || undefined,
      maritalStatus: form.maritalStatus,
      address: form.address,
      nationality: form.nationality,
      chiefComplaint: form.chiefComplaint || undefined,
      historyOfPresentIllness: form.historyOfPresentIllness || undefined,
      detailedInfo: {
        pastIllnessHistory: form.pastIllnessHistory || undefined,
        treatmentHistory: form.treatmentHistory || undefined,
        personalHistory: form.personalHistory || undefined,
        obGynHistory: form.gender === 'female' ? (form.obGynHistory || undefined) : undefined,
        immunizationHistory: form.immunizationHistory || undefined,
        drugHistory: form.drugHistory || undefined,
        socioEconomicStatus: form.socioEconomicStatus || undefined,
      },
      medicalConditions: form.medicalConditions,
      allergies: form.allergies ? form.allergies.split(',').map(a => a.trim()).filter(Boolean) : [],
      pregnancyStatus: form.gender === 'female' ? form.pregnancyStatus : undefined,
      previousChildbirths: form.gender === 'female' && form.previousChildbirths ? Number(form.previousChildbirths) : undefined,
      physicalActivity: form.physicalActivity,
      
      reports: initial?.reports ?? [],
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-display font-semibold">{initial ? t('form.edit') : t('form.new')}</h2>
        <button type="button" onClick={onCancel} className="text-sm text-muted-foreground hover:text-foreground">{t('common.cancel')}</button>
      </div>

      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t('form.fullName')} *</label>
          <input required value={form.name} onChange={e => set('name', e.target.value)} className="medical-input w-full" placeholder="e.g., Mohammad Rahman" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t('form.age')} *</label>
          <input required type="number" min="0" max="150" value={form.age} onChange={e => set('age', e.target.value)} className="medical-input w-full" placeholder={t('form.age')} />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t('form.sex')} *</label>
          <select value={form.gender} onChange={e => set('gender', e.target.value)} className="medical-input w-full">
            <option value="male">{t('form.male')}</option>
            <option value="female">{t('form.female')}</option>
            <option value="other">{t('form.other')}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t('form.occupation')}</label>
          <input value={form.occupation} onChange={e => set('occupation', e.target.value)} className="medical-input w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t('form.maritalStatus')}</label>
          <select value={form.maritalStatus} onChange={e => set('maritalStatus', e.target.value)} className="medical-input w-full">
            <option value="single">{t('form.single')}</option>
            <option value="married">{t('form.married')}</option>
            <option value="divorced">{t('form.divorced')}</option>
            <option value="widowed">{t('form.widowed')}</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t('form.address')}</label>
          <input value={form.address} onChange={e => set('address', e.target.value)} className="medical-input w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t('form.phone')}</label>
          <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} className="medical-input w-full" placeholder="+880..." />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t('form.weightKg')}</label>
          <input type="number" value={form.weight} onChange={e => set('weight', e.target.value)} className="medical-input w-full" placeholder="kg" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t('form.heightFtIn')}</label>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min="0" max="8" value={form.heightFeet} onChange={e => set('heightFeet', e.target.value)} className="medical-input w-full" placeholder={t('form.feet')} />
            <input type="number" min="0" max="11" value={form.heightInches} onChange={e => set('heightInches', e.target.value)} className="medical-input w-full" placeholder={t('form.inches')} />
          </div>
        </div>
      </div>

      {/* Initial Medical Info */}
      <div className="space-y-3 p-3 border border-border rounded-lg">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('form.initialMedical')}</h3>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t('form.chiefComplaint')}</label>
          <textarea value={form.chiefComplaint} onChange={e => set('chiefComplaint', e.target.value)}
            className="medical-input w-full min-h-[50px] resize-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t('form.hpi')}</label>
          <textarea value={form.historyOfPresentIllness} onChange={e => set('historyOfPresentIllness', e.target.value)}
            className="medical-input w-full min-h-[50px] resize-none" />
        </div>
      </div>

      {/* Physical Activity */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
          <Activity size={12} /> {t('form.physicalActivity')}
        </label>
        <select value={form.physicalActivity} onChange={e => set('physicalActivity', e.target.value)} className="medical-input w-full">
          {(Object.entries(ACTIVITY_LABELS) as [PhysicalActivity, string][]).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* BMI / BMR Card */}
      {(bmi || bmr) && (
        <div className="glass-card p-4 space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('form.healthMetrics')}</h3>
          <div className="grid grid-cols-2 gap-3">
            {bmi && bmiStatus && (
              <div>
                <p className="text-xs text-muted-foreground">BMI</p>
                <p className="text-lg font-bold">{bmi.toFixed(1)}</p>
                <p className={`text-xs font-semibold ${bmiStatus.color}`}>{bmiStatus.label}</p>
              </div>
            )}
            {bmr && (
              <div>
                <p className="text-xs text-muted-foreground">BMR</p>
                <p className="text-lg font-bold">{Math.round(bmr)}</p>
                <p className="text-xs text-muted-foreground">{t('form.kcalDay')}</p>
              </div>
            )}
            {tdee && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">TDEE</p>
                <p className="text-lg font-bold">{tdee} <span className="text-xs font-normal text-muted-foreground">{t('form.kcalDay')}</span></p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Medical Conditions */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">{t('form.medicalConditions')}</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {form.medicalConditions.map(c => (
            <span key={c} className="inline-flex items-center gap-1 bg-accent text-accent-foreground text-xs px-2 py-1 rounded-full">
              {c}
              <button type="button" onClick={() => removeCondition(c)} className="hover:text-destructive">×</button>
            </span>
          ))}
        </div>
        <div className="relative">
          <input
            value={conditionInput}
            onChange={e => setConditionInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCondition(conditionInput); } }}
            className="medical-input w-full"
            placeholder={t('form.typeOrSelectCondition')}
          />
          {conditionInput && filteredConditions.length > 0 && (
            <div className="absolute z-40 top-full left-0 right-0 mt-1 bg-card border rounded-lg shadow-lg max-h-32 overflow-y-auto">
              {filteredConditions.slice(0, 5).map(c => (
                <div key={c} className="suggestion-item hover:bg-muted" onMouseDown={() => addCondition(c)}>{c}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Allergies */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">{t('form.allergies')}</label>
        <input value={form.allergies} onChange={e => set('allergies', e.target.value)} className="medical-input w-full" placeholder="e.g., Penicillin, Aspirin" />
      </div>

      {/* Female-specific fields */}
      {form.gender === 'female' && (
        <div className="grid grid-cols-2 gap-3 p-3 bg-accent/50 rounded-lg">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t('form.pregnancyStatus')}</label>
            <select value={form.pregnancyStatus} onChange={e => set('pregnancyStatus', e.target.value)} className="medical-input w-full">
              <option value="na">{t('form.na')}</option>
              <option value="pregnant">{t('form.pregnant')}</option>
              <option value="not_pregnant">{t('form.notPregnant')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t('form.previousChildbirths')}</label>
            <input type="number" min="0" value={form.previousChildbirths} onChange={e => set('previousChildbirths', e.target.value)} className="medical-input w-full" placeholder="0" />
          </div>
        </div>
      )}

      {/* Detailed Info */}
      <div className="space-y-3 p-3 border border-border rounded-lg">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('form.detailedHistory')}</h3>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t('form.pastIllness')}</label>
          <textarea value={form.pastIllnessHistory} onChange={e => set('pastIllnessHistory', e.target.value)}
            className="medical-input w-full min-h-[50px] resize-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t('form.treatmentHistory')}</label>
          <textarea value={form.treatmentHistory} onChange={e => set('treatmentHistory', e.target.value)}
            className="medical-input w-full min-h-[50px] resize-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t('form.personalHistory')}</label>
          <textarea value={form.personalHistory} onChange={e => set('personalHistory', e.target.value)}
            className="medical-input w-full min-h-[50px] resize-none" />
        </div>
        {form.gender === 'female' && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t('form.obGyn')}</label>
            <textarea value={form.obGynHistory} onChange={e => set('obGynHistory', e.target.value)}
              className="medical-input w-full min-h-[50px] resize-none" />
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t('form.immunization')}</label>
          <textarea value={form.immunizationHistory} onChange={e => set('immunizationHistory', e.target.value)}
            className="medical-input w-full min-h-[50px] resize-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t('form.drugHistory')}</label>
          <textarea value={form.drugHistory} onChange={e => set('drugHistory', e.target.value)}
            className="medical-input w-full min-h-[50px] resize-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t('form.socioEconomic')}</label>
          <textarea value={form.socioEconomicStatus} onChange={e => set('socioEconomicStatus', e.target.value)}
            className="medical-input w-full min-h-[50px] resize-none" />
        </div>
      </div>

      <button type="submit" className="w-full bg-primary text-primary-foreground rounded-lg py-3 font-medium hover:opacity-90 transition-colors btn-press">
        {initial ? t('form.updatePatient') : t('form.savePatient')}
      </button>
    </form>
  );
};

export default PatientForm;
