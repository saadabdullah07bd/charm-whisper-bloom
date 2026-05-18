import React, { useState } from 'react';
import {
  BookOpen, CalendarPlus, Video, FileText, FolderOpen, User as UserIcon,
  Upload, Download, ChevronDown, CheckCircle2, AlertCircle,
  Bell,
} from 'lucide-react';

type Lang = 'bn' | 'en';

interface PatientUserManualProps {
  /** Jump to a tab inside the dashboard from a manual CTA. */
  onNavigate: (tab: 'appointments' | 'files' | 'account' | 'profile' | 'prescriptions') => void;
}

interface Section {
  id: string;
  icon: React.ReactNode;
  title: { bn: string; en: string };
  steps: { bn: string; en: string }[];
  tips?: { bn: string; en: string }[];
  cta?: {
    label: { bn: string; en: string };
    onClick: () => void;
    icon: React.ReactNode;
  };
}

const PatientUserManual: React.FC<PatientUserManualProps> = ({ onNavigate }) => {
  const [lang, setLang] = useState<Lang>('bn');
  const [openId, setOpenId] = useState<string | null>('account');

  const t = (s: { bn: string; en: string }) => s[lang];

  const sections: Section[] = [
    {
      id: 'account',
      icon: <UserIcon size={20} />,
      title: {
        bn: '১. Account তৈরি ও Profile সম্পূর্ণ করা',
        en: '1. Create Account & Complete Profile',
      },
      steps: [
        {
          bn: 'প্রথমে "Continue with Google" বোতামে ক্লিক করে আপনার Gmail দিয়ে Sign in করুন।',
          en: 'Click "Continue with Google" and sign in with your Gmail account.',
        },
        {
          bn: 'Sign in করার পর Profile form আসবে — সেখানে আপনার নাম, বয়স, lিঙ্গ, ফোন নম্বর, ঠিকানা সহ সমস্ত তথ্য পূরণ করুন।',
          en: 'After sign-in, fill out the profile form — name, age, gender, phone, address and other details.',
        },
        {
          bn: 'উচ্চতা, ওজন, পুরনো রোগ এবং allergy থাকলে অবশ্যই লিখুন। এই তথ্যগুলো ডাক্তারকে সঠিক চিকিৎসা দিতে সাহায্য করবে।',
          en: 'Be sure to add height, weight, existing conditions, and allergies. This helps the doctor treat you correctly.',
        },
        {
          bn: '"Save" বোতামে ক্লিক করে profile সংরক্ষণ করুন।',
          en: 'Click "Save" to store your profile.',
        },
      ],
      tips: [
        {
          bn: 'একবার Profile lock হয়ে গেলে নিজে পরিবর্তন করতে পারবেন না — ডাক্তারের সাথে যোগাযোগ করতে হবে।',
          en: 'Once your profile is locked, only the doctor can change it for you.',
        },
      ],
      cta: {
        label: { bn: 'Profile তে যান', en: 'Go to Profile' },
        onClick: () => onNavigate('account'),
        icon: <UserIcon size={14} />,
      },
    },
    {
      id: 'booking',
      icon: <CalendarPlus size={20} />,
      title: {
        bn: '২. Appointment Booking করার নিয়ম',
        en: '2. How to Book an Appointment',
      },
      steps: [
        {
          bn: 'নিচের menu থেকে "Appts" (Appointments) tab-এ যান।',
          en: 'Tap the "Appts" tab from the bottom navigation.',
        },
        {
          bn: 'ডান পাশের নিচে "+" বোতাম অথবা উপরের "Book Appointment" এ ক্লিক করুন।',
          en: 'Tap the "+" floating button or "Book Appointment" at the top.',
        },
        {
          bn: 'Calendar থেকে তারিখ নির্বাচন করুন (আজ থেকে পরের ১২ দিনের মধ্যে)।',
          en: 'Pick a date from the calendar (within the next 12 days).',
        },
        {
          bn: 'সময় slot বেছে নিন: রাত ৯:০০, ৯:৩০, ১০:০০ বা ১০:৩০ এর মধ্যে যেটি ফাঁকা।',
          en: 'Choose an available time slot: 9:00 PM, 9:30 PM, 10:00 PM, or 10:30 PM.',
        },
        {
          bn: 'আপনার সমস্যা (chief complaint) সংক্ষেপে লিখে "Submit Request" এ ক্লিক করুন।',
          en: 'Briefly describe your complaint and click "Submit Request".',
        },
        {
          bn: 'ডাক্তার approve করলে status "Confirmed" হবে এবং আপনার email-এ জানানো হবে।',
          en: 'Once the doctor approves, status becomes "Confirmed" and you receive an email.',
        },
      ],
      tips: [
        {
          bn: 'কমপক্ষে ৪ ঘণ্টা আগে appointment book করতে হবে।',
          en: 'Appointments must be booked at least 4 hours in advance.',
        },
        {
          bn: 'Appointment-এর ২ ঘণ্টা আগে পর্যন্ত cancel বা reschedule করতে পারবেন।',
          en: 'You can cancel or reschedule up to 2 hours before the appointment.',
        },
      ],
      cta: {
        label: { bn: 'এখনই Book করুন', en: 'Book Now' },
        onClick: () => onNavigate('appointments'),
        icon: <CalendarPlus size={14} />,
      },
    },
    {
      id: 'video',
      icon: <Video size={20} />,
      title: {
        bn: '৩. Video Call-এ Join করার নিয়ম',
        en: '3. How to Join the Video Call',
      },
      steps: [
        {
          bn: 'আপনার appointment-এর নির্ধারিত সময়ে "Appts" tab খুলুন।',
          en: 'At your appointment time, open the "Appts" tab.',
        },
        {
          bn: 'সবুজ রঙের "📹 Join Video Call" বোতাম আপনার appointment card-এ দেখা যাবে — সেটিতে ক্লিক করুন।',
          en: 'A green "📹 Join Video Call" button will appear on your appointment — tap it.',
        },
        {
          bn: 'Browser আপনার camera এবং microphone-এর permission চাইবে — "Allow" দিন।',
          en: 'Your browser will ask for camera and microphone permission — tap "Allow".',
        },
        {
          bn: '"Join Meeting" এ ক্লিক করে কলে প্রবেশ করুন।',
          en: 'Click "Join Meeting" to enter the call.',
        },
        {
          bn: 'কল শেষে নিচের লাল "Leave" বোতামে ক্লিক করে বের হয়ে আসুন।',
          en: 'When the call ends, tap the red "Leave" button at the bottom.',
        },
      ],
      tips: [
        {
          bn: 'Network সমস্যায় কল কেটে গেলে চিন্তা করবেন না — ৩০ মিনিটের মধ্যে আবার "Rejoin Call" বোতামে ক্লিক করতে পারবেন।',
          en: 'If the call drops due to network issues, you can "Rejoin Call" within 30 minutes.',
        },
        {
          bn: 'কলের সময়ের আগে Join বোতাম দেখা যাবে না।',
          en: 'The Join button only appears at your scheduled time, not before.',
        },
        {
          bn: 'ভালো network এবং headphone ব্যবহার করুন।',
          en: 'Use a good network and headphones for best quality.',
        },
      ],
      cta: {
        label: { bn: 'Appointments দেখুন', en: 'View Appointments' },
        onClick: () => onNavigate('appointments'),
        icon: <Video size={14} />,
      },
    },
    {
      id: 'reports',
      icon: <Upload size={20} />,
      title: {
        bn: '৪. Report বা Test Result Upload করা',
        en: '4. Upload Reports or Test Results',
      },
      steps: [
        {
          bn: 'Menu থেকে "Hub" → "Files" এ যান।',
          en: 'Open "Hub" → "Files" from the menu.',
        },
        {
          bn: '"Upload Report" বোতামে ক্লিক করুন।',
          en: 'Click "Upload Report".',
        },
        {
          bn: 'আপনার মোবাইল বা কম্পিউটার থেকে PDF বা ছবি (JPG/PNG) নির্বাচন করুন।',
          en: 'Select a PDF or image (JPG/PNG) from your device.',
        },
        {
          bn: 'Upload সম্পন্ন হলে file-টি তালিকায় দেখা যাবে। ডাক্তার এটি দেখতে পারবেন।',
          en: 'Once uploaded, the file appears in the list — your doctor can view it.',
        },
      ],
      tips: [
        {
          bn: 'Appointment-এর আগে report upload করলে ডাক্তার আগে থেকে দেখে নিতে পারবেন।',
          en: 'Upload reports before your appointment so the doctor can review them in advance.',
        },
        {
          bn: 'File size সর্বোচ্চ ২০ MB রাখুন।',
          en: 'Keep file size under 20 MB.',
        },
      ],
      cta: {
        label: { bn: 'Files-এ যান', en: 'Go to Files' },
        onClick: () => onNavigate('files'),
        icon: <FolderOpen size={14} />,
      },
    },
    {
      id: 'prescriptions',
      icon: <Download size={20} />,
      title: {
        bn: '৫. Prescription Download করার নিয়ম',
        en: '5. How to Download Your Prescription',
      },
      steps: [
        {
          bn: 'Menu-এর "Rx" (Prescriptions) tab-এ যান।',
          en: 'Open the "Rx" (Prescriptions) tab.',
        },
        {
          bn: 'আপনার সমস্ত prescription তারিখ অনুযায়ী তালিকাভুক্ত থাকবে।',
          en: 'All your prescriptions are listed by date.',
        },
        {
          bn: 'যেকোনো prescription-এ ক্লিক করে preview দেখুন।',
          en: 'Tap any prescription to preview it.',
        },
        {
          bn: '"Download" বোতামে ক্লিক করে PDF ফাইলটি আপনার device-এ সংরক্ষণ করুন।',
          en: 'Click "Download" to save the PDF to your device.',
        },
        {
          bn: 'এই PDF যেকোনো ওষুধের দোকানে দেখাতে পারবেন।',
          en: 'You can show this PDF at any pharmacy.',
        },
      ],
      cta: {
        label: { bn: 'Prescriptions দেখুন', en: 'View Prescriptions' },
        onClick: () => onNavigate('prescriptions'),
        icon: <FileText size={14} />,
      },
    },
    {
      id: 'notifications',
      icon: <Bell size={20} />,
      title: {
        bn: '৬. Notification চালু করা',
        en: '6. Enable Notifications',
      },
      steps: [
        {
          bn: 'Browser প্রথমবার notification-এর permission চাইলে "Allow" দিন।',
          en: 'When your browser asks for notification permission, tap "Allow".',
        },
        {
          bn: 'Appointment-এর সময় হলে আপনাকে notification পাঠানো হবে।',
          en: 'You will be notified when your appointment time arrives.',
        },
        {
          bn: 'বন্ধ করতে চাইলে Hub → Settings → Notifications থেকে নিয়ন্ত্রণ করুন।',
          en: 'To manage, go to Hub → Settings → Notifications.',
        },
      ],
    },
  ];

  const quickActions = [
    {
      label: { bn: 'Appointment Book করুন', en: 'Book Appointment' },
      icon: <CalendarPlus size={18} />,
      onClick: () => onNavigate('appointments'),
      color: 'hsl(var(--primary))',
    },
    {
      label: { bn: 'Report Upload করুন', en: 'Upload Report' },
      icon: <Upload size={18} />,
      onClick: () => onNavigate('files'),
      color: 'hsl(152 69% 31%)',
    },
    {
      label: { bn: 'Prescription দেখুন', en: 'View Prescriptions' },
      icon: <FileText size={18} />,
      onClick: () => onNavigate('prescriptions'),
      color: 'hsl(239 84% 60%)',
    },
    {
      label: { bn: 'Profile সম্পাদনা', en: 'Edit Profile' },
      icon: <UserIcon size={18} />,
      onClick: () => onNavigate('account'),
      color: 'hsl(271 81% 56%)',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header with Language Toggle */}
      <div
        className="rounded-3xl p-6 border border-border/20"
        style={{
          background: 'linear-gradient(135deg, hsl(var(--primary)/0.08), hsl(var(--primary)/0.02))',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'hsl(var(--primary)/0.15)', color: 'hsl(var(--primary))' }}
            >
              <BookOpen size={22} />
            </div>
            <div>
              <h2 className="text-lg font-display font-bold tracking-tight">
                {lang === 'bn' ? 'User Manual / সহায়িকা' : 'User Manual'}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {lang === 'bn'
                  ? 'App কীভাবে ব্যবহার করবেন তা ধাপে ধাপে জানুন'
                  : 'Step-by-step guide to using the app'}
              </p>
            </div>
          </div>

          {/* Lang toggle */}
          <div
            className="flex items-center gap-0.5 p-0.5 rounded-full shrink-0"
            style={{ background: 'hsl(var(--card)/0.7)', border: '1px solid hsl(var(--border)/0.2)' }}
          >
            <button
              type="button"
              onClick={() => setLang('bn')}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
                lang === 'bn' ? 'text-primary-foreground' : 'text-muted-foreground'
              }`}
              style={lang === 'bn' ? { background: 'hsl(var(--primary))' } : {}}
            >
              বাংলা
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
                lang === 'en' ? 'text-primary-foreground' : 'text-muted-foreground'
              }`}
              style={lang === 'en' ? { background: 'hsl(var(--primary))' } : {}}
            >
              English
            </button>
          </div>
        </div>

        {/* Quick action buttons embedded in manual */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          {quickActions.map((a, i) => (
            <button
              key={i}
              onClick={a.onClick}
              className="flex items-center gap-2 px-3 py-2.5 rounded-2xl text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: 'hsl(var(--card)/0.8)',
                border: '1px solid hsl(var(--border)/0.25)',
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${a.color}/0.12`, color: a.color }}
              >
                {a.icon}
              </div>
              <span className="text-[12px] font-medium leading-tight">{t(a.label)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Sections - Accordion */}
      <div className="space-y-2.5">
        {sections.map((section) => {
          const isOpen = openId === section.id;
          return (
            <div
              key={section.id}
              className="rounded-3xl overflow-hidden border border-border/20"
              style={{
                background: 'hsl(var(--card)/0.6)',
                backdropFilter: 'blur(20px)',
              }}
            >
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : section.id)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-foreground/3 transition-colors"
              >
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: 'hsl(var(--primary)/0.1)', color: 'hsl(var(--primary))' }}
                >
                  {section.icon}
                </div>
                <h3 className="flex-1 text-sm font-semibold">{t(section.title)}</h3>
                <ChevronDown
                  size={18}
                  className={`text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isOpen && (
                <div className="px-5 pb-5 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                  {/* Steps */}
                  <ol className="space-y-3 pt-1">
                    {section.steps.map((step, idx) => (
                      <li key={idx} className="flex gap-3">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold mt-0.5"
                          style={{
                            background: 'hsl(var(--primary)/0.12)',
                            color: 'hsl(var(--primary))',
                          }}
                        >
                          {idx + 1}
                        </div>
                        <p className="text-[13px] leading-relaxed text-foreground/90 flex-1">
                          {t(step)}
                        </p>
                      </li>
                    ))}
                  </ol>

                  {/* Tips */}
                  {section.tips && section.tips.length > 0 && (
                    <div
                      className="rounded-2xl p-3.5 space-y-2"
                      style={{
                        background: 'hsl(38 92% 50% / 0.06)',
                        border: '1px solid hsl(38 92% 50% / 0.15)',
                      }}
                    >
                      <p
                        className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5"
                        style={{ color: 'hsl(38 92% 40%)' }}
                      >
                        <AlertCircle size={12} />
                        {lang === 'bn' ? 'গুরুত্বপূর্ণ' : 'Important'}
                      </p>
                      {section.tips.map((tip, i) => (
                        <p
                          key={i}
                          className="text-[12px] leading-relaxed"
                          style={{ color: 'hsl(38 92% 30%)' }}
                        >
                          • {t(tip)}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* CTA */}
                  {section.cta && (
                    <button
                      onClick={section.cta.onClick}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
                      style={{
                        background:
                          'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary)/0.85))',
                        boxShadow: '0 4px 16px hsl(var(--primary) / 0.25)',
                      }}
                    >
                      {section.cta.icon}
                      {t(section.cta.label)}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer help */}
      <div
        className="rounded-3xl p-5 border border-border/20 flex items-start gap-3"
        style={{ background: 'hsl(var(--card)/0.5)' }}
      >
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: 'hsl(152 69% 31% / 0.12)', color: 'hsl(152 69% 31%)' }}
        >
          <CheckCircle2 size={18} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold mb-1">
            {lang === 'bn' ? 'আরও সাহায্য দরকার?' : 'Need more help?'}
          </p>
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            {lang === 'bn'
              ? 'কোনো সমস্যা হলে আপনার পরিবারের কাউকে দেখান অথবা পরবর্তী appointment-এ ডাক্তারকে জিজ্ঞেস করুন।'
              : 'If you face any issue, ask a family member or your doctor at the next appointment.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PatientUserManual;
