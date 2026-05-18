import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, LogOut, Sun, Moon, Monitor, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

interface Props {
  onComplete: () => void;
}

type Lang = 'bn' | 'en';

const TIME_SLOTS = ['9:00 PM', '9:30 PM', '10:00 PM', '10:30 PM'];

const labels: Record<string, Record<Lang, string>> = {
  subtitle: { bn: 'আপনার তথ্য পূরণ করুন', en: 'Fill in your information' },
  secAppointment: { bn: '📅 অ্যাপয়েন্টমেন্ট তারিখ ও সময়', en: '📅 Appointment Date & Time' },
  lblDate: { bn: 'তারিখ নির্বাচন করুন *', en: 'Select Date *' },
  lblTime: { bn: 'সময় নির্বাচন করুন *', en: 'Select Time Slot *' },
  secPersonal: { bn: 'ব্যক্তিগত তথ্য', en: 'Personal Information' },
  lblName: { bn: 'পূর্ণ নাম *', en: 'Full Name *' },
  lblAge: { bn: 'বয়স *', en: 'Age *' },
  lblGender: { bn: 'লিঙ্গ *', en: 'Gender *' },
  lblPhone: { bn: 'মোবাইল নম্বর', en: 'Phone Number' },
  lblOccupation: { bn: 'পেশা', en: 'Occupation' },
  lblMarital: { bn: 'বৈবাহিক অবস্থা', en: 'Marital Status' },
  lblAddress: { bn: 'ঠিকানা (গ্রাম/শহর, জেলা)', en: 'Address (Village/City, District)' },
  secVitals: { bn: 'শারীরিক তথ্য', en: 'Physical Information' },
  lblWeight: { bn: 'ওজন (কেজি)', en: 'Weight (kg)' },
  lblHeightFt: { bn: 'উচ্চতা (ফুট)', en: 'Height (ft)' },
  lblHeightIn: { bn: 'উচ্চতা (ইঞ্চি)', en: 'Height (in)' },
  secMedical: { bn: 'বর্তমান অসুস্থতার তথ্য', en: 'Current Illness Information' },
  lblComplaint: { bn: 'মূল সমস্যা / প্রধান অভিযোগ', en: 'Chief Complaint' },
  lblHpi: { bn: 'অসুখ শুরু হওয়ার বিবরণ', en: 'History of Present Illness' },
  lblAllergies: { bn: 'অ্যালার্জি (কমা দিয়ে আলাদা করুন)', en: 'Allergies (comma separated)' },
  lblConditions: { bn: 'বর্তমান বা পুরনো রোগ (কমা দিয়ে আলাদা করুন)', en: 'Medical Conditions (comma separated)' },
  secObgyn: { bn: 'মহিলাদের জন্য (প্রসূতি/স্ত্রীরোগ)', en: "Women's Health (OB/GYN)" },
  lblPregnancy: { bn: 'গর্ভাবস্থার অবস্থা', en: 'Pregnancy Status' },
  lblChildbirths: { bn: 'পূর্বে কতবার সন্তান হয়েছে', en: 'Previous Childbirths' },
  lblObgynHistory: { bn: 'প্রসূতি/স্ত্রীরোগ সংক্রান্ত ইতিহাস', en: 'OB/GYN History' },
  secDetailed: { bn: 'পূর্ববর্তী স্বাস্থ্য ইতিহাস', en: 'Past Health History' },
  lblPastIllness: { bn: 'অতীতের অসুস্থতা ও অপারেশন', en: 'Past Illnesses & Surgeries' },
  lblTreatment: { bn: 'পূর্বের চিকিৎসা', en: 'Previous Treatments' },
  lblDrug: { bn: 'বর্তমানে যে ওষুধ খাচ্ছেন', en: 'Current Medications' },
  lblPersonal: { bn: 'ব্যক্তিগত অভ্যাস', en: 'Personal Habits' },
  lblImmunization: { bn: 'টিকাদানের ইতিহাস', en: 'Immunization History' },
  submitBtn: { bn: 'প্রোফাইল সংরক্ষণ ও অ্যাপয়েন্টমেন্ট বুক করুন', en: 'Save Profile & Book Appointment' },
  saveOnlyBtn: { bn: 'শুধু প্রোফাইল সংরক্ষণ করুন', en: 'Save Profile Only' },
  optMale: { bn: 'পুরুষ', en: 'Male' },
  optFemale: { bn: 'মহিলা', en: 'Female' },
  optOther: { bn: 'অন্যান্য', en: 'Other' },
  optSingle: { bn: 'অবিবাহিত', en: 'Single' },
  optMarried: { bn: 'বিবাহিত', en: 'Married' },
  optDivorced: { bn: 'তালাকপ্রাপ্ত', en: 'Divorced' },
  optWidowed: { bn: 'বিধবা/বিপত্নীক', en: 'Widowed' },
  optNA: { bn: 'প্রযোজ্য নয়', en: 'Not Applicable' },
  optPregnant: { bn: 'গর্ভবতী', en: 'Pregnant' },
  optNotPregnant: { bn: 'গর্ভবতী নয়', en: 'Not Pregnant' },
  available: { bn: 'খালি', en: 'Available' },
  booked: { bn: 'বুকড', en: 'Booked' },
};

const monthNames: Record<Lang, string[]> = {
  bn: ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'],
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
};

const dayNames: Record<Lang, string[]> = {
  bn: ['রবি','সোম','মঙ্গল','বুধ','বৃহঃ','শুক্র','শনি'],
  en: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
};

const PatientRegistrationForm: React.FC<Props> = ({ onComplete }) => {
  const [lang, setLang] = useState<Lang>('bn');
  const [theme, setTheme] = useTheme();
  const [submitting, setSubmitting] = useState(false);

  // Calendar state
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today); maxDate.setDate(maxDate.getDate() + 11);
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);

  // Form state
  const [form, setForm] = useState({
    name: '', age: '', gender: 'male', phone: '', occupation: '',
    maritalStatus: 'single', address: '', weight: '', heightFeet: '', heightInches: '',
    chiefComplaint: '', hpi: '', allergies: '', conditions: '',
    pregnancyStatus: '', childbirths: '', obgynHistory: '',
    pastIllness: '', treatmentHistory: '', drugHistory: '', personalHistory: '', immunization: '',
  });

  const t = (key: string) => labels[key]?.[lang] || key;

  const signOut = async () => { await supabase.auth.signOut(); window.location.reload(); };
  const themeIcon = theme === 'dark' ? <Moon size={16} /> : theme === 'light' ? <Sun size={16} /> : <Monitor size={16} />;
  const cycleTheme = () => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light');

  // Load booked slots when date changes
  const loadSlots = useCallback(async (dateStr: string) => {
    const { data } = await supabase.rpc('get_booked_slots', { target_date: dateStr });
    setBookedSlots((data || []).map((r: any) => r.time_slot));
  }, []);

  useEffect(() => {
    if (selectedDate) loadSlots(selectedDate);
  }, [selectedDate, loadSlots]);

  const selectDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    setSelectedTime(null);
  };

  const handlePrevMonth = () => {
    let m = calMonth - 1, y = calYear;
    if (m < 0) { m = 11; y--; }
    setCalMonth(m); setCalYear(y);
  };

  const handleNextMonth = () => {
    let m = calMonth + 1, y = calYear;
    if (m > 11) { m = 0; y++; }
    setCalMonth(m); setCalYear(y);
  };

  // Calendar rendering
  const renderCalendarDays = () => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: React.ReactNode[] = [];

    // Day headers
    dayNames[lang].forEach((d, i) => (
      cells.push(<div key={`h-${i}`} className="py-2 text-[11px] font-semibold text-muted-foreground bg-muted/50 text-center">{d}</div>)
    ));

    // Empty cells
    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`e-${i}`} className="py-2.5" />);
    }

    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(calYear, calMonth, d); date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];
      const isToday = date.getTime() === today.getTime();
      const isSelectable = date >= today && date <= maxDate;
      const isSelected = selectedDate === dateStr;

      cells.push(
        <div
          key={d}
          onClick={isSelectable ? () => selectDate(dateStr) : undefined}
          className={`relative py-2.5 text-sm text-center transition-all duration-200 cursor-pointer
            ${isSelected ? 'bg-foreground text-background font-semibold' : ''}
            ${!isSelected && isSelectable ? 'hover:bg-muted' : ''}
            ${!isSelectable ? 'text-muted-foreground/30 cursor-not-allowed' : ''}
            ${isToday && !isSelected ? 'font-bold' : ''}
          `}
        >
          {d}
          {isToday && (
            <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isSelected ? 'bg-background' : 'bg-foreground'}`} />
          )}
        </div>
      );
    }

    return cells;
  };

  const prevMonthDate = new Date(calYear, calMonth, 0);
  const nextMonthDate = new Date(calYear, calMonth + 1, 1);
  const showPrev = !(prevMonthDate < today && calMonth <= today.getMonth() && calYear <= today.getFullYear());
  const showNext = nextMonthDate <= maxDate;

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const savePatient = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const heightFeet = form.heightFeet ? Number(form.heightFeet) : null;
    const heightInches = form.heightInches ? Number(form.heightInches) : null;
    let heightCm: number | null = null;
    if (heightFeet) heightCm = Math.round((heightFeet * 30.48) + ((heightInches || 0) * 2.54));

    const { data: patientData, error: patientError } = await supabase.from('patients').insert({
      user_id: user.id,
      name: form.name.trim(),
      age: Math.floor(Number(form.age)),
      gender: form.gender,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      occupation: form.occupation.trim() || null,
      marital_status: form.maritalStatus,
      weight: form.weight ? Number(form.weight) : null,
      height_feet: heightFeet,
      height_inches: heightInches,
      height_cm: heightCm,
      chief_complaint: form.chiefComplaint.trim() || null,
      history_of_present_illness: form.hpi.trim() || null,
      medical_conditions: form.conditions ? form.conditions.split(',').map(s => s.trim()).filter(Boolean) : [],
      allergies: form.allergies ? form.allergies.split(',').map(s => s.trim()).filter(Boolean) : [],
      pregnancy_status: form.pregnancyStatus || null,
      previous_childbirths: form.childbirths ? Number(form.childbirths) : null,
      ob_gyn_history: form.obgynHistory.trim() || null,
      past_illness_history: form.pastIllness.trim() || null,
      treatment_history: form.treatmentHistory.trim() || null,
      drug_history: form.drugHistory.trim() || null,
      personal_history: form.personalHistory.trim() || null,
      immunization_history: form.immunization.trim() || null,
      profile_locked: true,
    } as any).select().single();

    if (patientError) {
      toast.error(patientError.message);
      return null;
    }
    return { patientData, user };
  };

  const handleSaveOnly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.age || !form.gender) {
      toast.error(lang === 'bn' ? 'অনুগ্রহ করে সমস্ত প্রয়োজনীয় ক্ষেত্র পূরণ করুন' : 'Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    const result = await savePatient();
    if (result) {
      toast.success(lang === 'bn' ? 'প্রোফাইল সংরক্ষিত!' : 'Profile saved!');
      onComplete();
    }
    setSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.age || !form.gender) {
      toast.error(lang === 'bn' ? 'অনুগ্রহ করে সমস্ত প্রয়োজনীয় ক্ষেত্র পূরণ করুন' : 'Please fill in all required fields');
      return;
    }
    if (!selectedDate || !selectedTime) {
      toast.error(lang === 'bn' ? 'তারিখ ও সময় নির্বাচন করুন' : 'Please select date and time');
      return;
    }

    setSubmitting(true);
    const result = await savePatient();
    if (!result) { setSubmitting(false); return; }

    const { patientData, user } = result;
    if (patientData) {
      await supabase.from('appointments').insert({
        patient_id: patientData.id,
        patient_name: form.name.trim(),
        patient_phone: form.phone.trim() || null,
        patient_email: user.email || null,
        appointment_date: selectedDate,
        time_slot: selectedTime,
        chief_complaint: form.chiefComplaint.trim() || null,
        status: 'pending',
      });
    }

    toast.success(lang === 'bn' ? 'প্রোফাইল ও অ্যাপয়েন্টমেন্ট সংরক্ষিত!' : 'Profile & appointment saved!');
    setSubmitting(false);
    onComplete();
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, hsl(var(--muted)) 0%, hsl(var(--background)) 100%)' }}>
      {/* Header */}
      <div className="flex items-center justify-between max-w-[720px] mx-auto px-4 pt-6 pb-2">
        <button onClick={cycleTheme} className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">{themeIcon}</button>
        <button onClick={signOut} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
          <LogOut size={14} /> Sign Out
        </button>
      </div>

      {/* Logo */}
      <div className="text-center pt-4 pb-1">
        <h1 className="text-3xl font-bold tracking-wide" style={{ fontFamily: "'Poppins', sans-serif" }}>
          <span className="bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent">MedHelp</span>
        </h1>
      </div>
      <p className="text-center text-sm text-muted-foreground mb-3" style={{ fontFamily: "'Poppins', sans-serif" }}>{t('subtitle')}</p>

      {/* Language slider */}
      <div className="flex justify-center mb-7">
        <div className="relative flex bg-muted rounded-full p-1 w-[200px] cursor-pointer select-none" style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}>
          <div
            className="absolute top-1 left-1 h-[calc(100%-8px)] rounded-full bg-foreground transition-transform duration-300 ease-out"
            style={{ width: 'calc(50% - 4px)', transform: lang === 'en' ? 'translateX(100%)' : 'translateX(0)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
          />
          <span
            onClick={() => setLang('bn')}
            className={`flex-1 text-center text-sm py-2 relative z-10 font-medium transition-colors duration-300 cursor-pointer ${lang === 'bn' ? 'text-background' : 'text-muted-foreground'}`}
            style={{ fontFamily: "'Noto Sans Bengali', 'Poppins', sans-serif" }}
          >বাংলা</span>
          <span
            onClick={() => setLang('en')}
            className={`flex-1 text-center text-sm py-2 relative z-10 font-medium transition-colors duration-300 cursor-pointer ${lang === 'en' ? 'text-background' : 'text-muted-foreground'}`}
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >English</span>
        </div>
      </div>

      {/* Form card */}
      <form
        onSubmit={handleSubmit}
        className="max-w-[720px] mx-auto mb-10 bg-card rounded-[20px] p-6 sm:p-10 border border-border"
        style={{ boxShadow: '0 4px 6px rgba(0,0,0,0.04), 0 12px 40px rgba(0,0,0,0.08)', animation: 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both' }}
      >
        {/* ── Appointment Date & Time ── */}
        <SectionTitle>{t('secAppointment')}</SectionTitle>
        <FieldLabel>{t('lblDate')}</FieldLabel>
        <div className="mb-3.5 rounded-xl border border-border overflow-hidden bg-muted/30">
          <div className="flex items-center justify-between px-4 py-3 bg-foreground text-background">
            <button type="button" onClick={handlePrevMonth} className={`p-1 rounded-md hover:bg-background/15 transition-colors ${!showPrev ? 'invisible' : ''}`}>
              <ChevronLeft size={18} />
            </button>
            <span className="font-semibold text-[15px]" style={{ fontFamily: "'Poppins', sans-serif" }}>{monthNames[lang][calMonth]} {calYear}</span>
            <button type="button" onClick={handleNextMonth} className={`p-1 rounded-md hover:bg-background/15 transition-colors ${!showNext ? 'invisible' : ''}`}>
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="grid grid-cols-7">
            {renderCalendarDays()}
          </div>
        </div>
        {selectedDate && (
          <div className="mb-3.5 px-3.5 py-2 bg-muted rounded-lg text-sm text-muted-foreground" style={{ animation: 'fadeSlide 0.3s ease-out both' }}>
            📅 {lang === 'bn' ? 'নির্বাচিত' : 'Selected'}: {selectedDate}
          </div>
        )}

        <FieldLabel>{t('lblTime')}</FieldLabel>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3.5">
          {TIME_SLOTS.map(slot => {
            const isBooked = bookedSlots.includes(slot);
            const isSelected = selectedTime === slot;
            return (
              <button
                key={slot}
                type="button"
                disabled={isBooked || !selectedDate}
                onClick={() => setSelectedTime(slot)}
                className={`py-3 px-2 rounded-[10px] border text-sm font-medium transition-all duration-200 text-center
                  ${isSelected ? 'bg-foreground text-background border-foreground' : ''}
                  ${!isSelected && !isBooked ? 'border-border bg-muted/30 hover:border-foreground hover:bg-muted/60' : ''}
                  ${isBooked ? 'opacity-40 cursor-not-allowed bg-muted line-through' : ''}
                  ${!selectedDate ? 'opacity-40 cursor-not-allowed' : ''}
                `}
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                {slot}
                <span className={`block text-[10px] mt-0.5 ${isBooked ? 'text-destructive no-underline' : ''}`}>
                  {isBooked ? t('booked') : t('available')}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Personal Information ── */}
        <SectionTitle>{t('secPersonal')}</SectionTitle>
        <div className="space-y-3.5">
          <Field label={t('lblName')}>
            <FormInput value={form.name} onChange={set('name')} required placeholder={lang === 'bn' ? 'আপনার পূর্ণ নাম' : 'Your full name'} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('lblAge')}>
              <FormInput type="number" value={form.age} onChange={set('age')} min="0" max="150" required placeholder={lang === 'bn' ? 'বয়স' : 'Age'} />
            </Field>
            <Field label={t('lblGender')}>
              <FormSelect value={form.gender} onChange={set('gender')}>
                <option value="male">{t('optMale')}</option>
                <option value="female">{t('optFemale')}</option>
                <option value="other">{t('optOther')}</option>
              </FormSelect>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('lblPhone')}>
              <FormInput value={form.phone} onChange={set('phone')} placeholder={lang === 'bn' ? '০১XXXXXXXXX' : '01XXXXXXXXX'} />
            </Field>
            <Field label={t('lblOccupation')}>
              <FormInput value={form.occupation} onChange={set('occupation')} placeholder={lang === 'bn' ? 'পেশা' : 'Occupation'} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('lblMarital')}>
              <FormSelect value={form.maritalStatus} onChange={set('maritalStatus')}>
                <option value="single">{t('optSingle')}</option>
                <option value="married">{t('optMarried')}</option>
                <option value="divorced">{t('optDivorced')}</option>
                <option value="widowed">{t('optWidowed')}</option>
              </FormSelect>
            </Field>
          </div>
          <Field label={t('lblAddress')}>
            <FormInput value={form.address} onChange={set('address')} placeholder={lang === 'bn' ? 'গ্রাম/শহর, জেলা' : 'Village/City, District'} />
          </Field>
        </div>

        {/* ── Vitals ── */}
        <SectionTitle>{t('secVitals')}</SectionTitle>
        <div className="grid grid-cols-3 gap-3">
          <Field label={t('lblWeight')}>
            <FormInput type="number" step="0.1" value={form.weight} onChange={set('weight')} placeholder={lang === 'bn' ? 'কেজি' : 'kg'} />
          </Field>
          <Field label={t('lblHeightFt')}>
            <FormInput type="number" min="0" max="8" value={form.heightFeet} onChange={set('heightFeet')} placeholder={lang === 'bn' ? 'ফুট' : 'ft'} />
          </Field>
          <Field label={t('lblHeightIn')}>
            <FormInput type="number" min="0" max="11" value={form.heightInches} onChange={set('heightInches')} placeholder={lang === 'bn' ? 'ইঞ্চি' : 'in'} />
          </Field>
        </div>

        {/* ── Medical ── */}
        <SectionTitle>{t('secMedical')}</SectionTitle>
        <div className="space-y-3.5">
          <Field label={t('lblComplaint')}>
            <FormTextarea value={form.chiefComplaint} onChange={set('chiefComplaint')} rows={2} placeholder={lang === 'bn' ? 'যেমন: জ্বর, মাথাব্যথা, পেটব্যথা' : 'e.g. Fever, headache, stomach pain'} />
          </Field>
          <Field label={t('lblHpi')}>
            <FormTextarea value={form.hpi} onChange={set('hpi')} rows={3} placeholder={lang === 'bn' ? 'কখন থেকে শুরু, কেমন অনুভব হচ্ছে' : 'When it started, how it feels'} />
          </Field>
          <Field label={t('lblAllergies')}>
            <FormInput value={form.allergies} onChange={set('allergies')} placeholder={lang === 'bn' ? 'যেমন: পেনিসিলিন, ডিম, ধুলা' : 'e.g. Penicillin, eggs, dust'} />
          </Field>
          <Field label={t('lblConditions')}>
            <FormInput value={form.conditions} onChange={set('conditions')} placeholder={lang === 'bn' ? 'যেমন: ডায়াবেটিস, উচ্চ রক্তচাপ' : 'e.g. Diabetes, Hypertension'} />
          </Field>
        </div>

        {/* ── Female fields ── */}
        {form.gender === 'female' && (
          <>
            <SectionTitle>{t('secObgyn')}</SectionTitle>
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('lblPregnancy')}>
                  <FormSelect value={form.pregnancyStatus} onChange={set('pregnancyStatus')}>
                    <option value="">{t('optNA')}</option>
                    <option value="pregnant">{t('optPregnant')}</option>
                    <option value="not_pregnant">{t('optNotPregnant')}</option>
                  </FormSelect>
                </Field>
                <Field label={t('lblChildbirths')}>
                  <FormInput type="number" min="0" value={form.childbirths} onChange={set('childbirths')} placeholder={lang === 'bn' ? 'সংখ্যা' : 'Number'} />
                </Field>
              </div>
              <Field label={t('lblObgynHistory')}>
                <FormTextarea value={form.obgynHistory} onChange={set('obgynHistory')} rows={2} placeholder={lang === 'bn' ? 'বিস্তারিত লিখুন' : 'Details'} />
              </Field>
            </div>
          </>
        )}

        {/* ── Past Health History ── */}
        <SectionTitle>{t('secDetailed')}</SectionTitle>
        <div className="space-y-3.5">
          <Field label={t('lblPastIllness')}>
            <FormTextarea value={form.pastIllness} onChange={set('pastIllness')} rows={2} placeholder={lang === 'bn' ? 'যেমন: টাইফয়েড, অপারেশন' : 'e.g. Typhoid, surgeries'} />
          </Field>
          <Field label={t('lblTreatment')}>
            <FormTextarea value={form.treatmentHistory} onChange={set('treatmentHistory')} rows={2} placeholder={lang === 'bn' ? 'পূর্বে কী কী চিকিৎসা নিয়েছেন' : 'Previous treatments received'} />
          </Field>
          <Field label={t('lblDrug')}>
            <FormTextarea value={form.drugHistory} onChange={set('drugHistory')} rows={2} placeholder={lang === 'bn' ? 'ওষুধের নাম ও ডোজ' : 'Medicine names & doses'} />
          </Field>
          <Field label={t('lblPersonal')}>
            <FormTextarea value={form.personalHistory} onChange={set('personalHistory')} rows={2} placeholder={lang === 'bn' ? 'ধূমপান, মদ্যপান, খাদ্যাভ্যাস' : 'Smoking, alcohol, diet habits'} />
          </Field>
          <Field label={t('lblImmunization')}>
            <FormTextarea value={form.immunization} onChange={set('immunization')} rows={2} placeholder={lang === 'bn' ? 'যেমন: কোভিড, টিটেনাস' : 'e.g. COVID, Tetanus'} />
          </Field>
        </div>

        {/* Submit buttons */}
        <div className="flex flex-col gap-3 mt-7">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !selectedDate || !selectedTime}
            className="w-full py-4 rounded-xl font-semibold text-base text-background bg-gradient-to-br from-foreground to-foreground/80 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.2)', fontFamily: "'Poppins', 'Noto Sans Bengali', sans-serif" }}
          >
            {submitting ? <Loader2 className="inline animate-spin mr-2" size={18} /> : null}
            {t('submitBtn')}
          </button>
          <button
            type="button"
            onClick={handleSaveOnly}
            disabled={submitting}
            className="w-full py-4 rounded-xl font-semibold text-base text-foreground border-2 border-border bg-card hover:bg-muted hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            style={{ fontFamily: "'Poppins', 'Noto Sans Bengali', sans-serif" }}
          >
            {submitting ? <Loader2 className="inline animate-spin mr-2" size={18} /> : null}
            {t('saveOnlyBtn')}
          </button>
        </div>
      </form>
    </div>
  );
};

// ── Reusable sub-components ──
const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-base font-semibold text-foreground mt-7 mb-3.5 pb-2 border-b-2 border-border tracking-wide first:mt-0"
    style={{ fontFamily: "'Poppins', 'Noto Sans Bengali', sans-serif" }}>
    {children}
  </h2>
);

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-[13px] font-medium text-muted-foreground mb-1.5"
    style={{ fontFamily: "'Poppins', 'Noto Sans Bengali', sans-serif" }}>
    {children}
  </label>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <FieldLabel>{label}</FieldLabel>
    {children}
  </div>
);

const inputClasses = "w-full py-3 px-3.5 border-[1.5px] border-border rounded-[10px] bg-muted/30 text-sm text-foreground placeholder:text-muted-foreground/50 placeholder:text-[13px] transition-all duration-200 focus:outline-none focus:border-foreground focus:bg-card focus:ring-[3px] focus:ring-foreground/8";

const FormInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input {...props} className={inputClasses} style={{ fontFamily: "'Poppins', 'Noto Sans Bengali', sans-serif" }} />
);

const FormSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ children, ...props }) => (
  <select {...props} className={inputClasses} style={{ fontFamily: "'Poppins', 'Noto Sans Bengali', sans-serif" }}>
    {children}
  </select>
);

const FormTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => (
  <textarea {...props} className={`${inputClasses} resize-y min-h-[70px]`} style={{ fontFamily: "'Poppins', 'Noto Sans Bengali', sans-serif" }} />
);

export default PatientRegistrationForm;
