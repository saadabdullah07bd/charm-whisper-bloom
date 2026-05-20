import React, { useEffect } from "react";
import { setPageMeta } from "@/lib/pageMeta";

const PrivacyPolicy: React.FC = () => {
  useEffect(() => {
    setPageMeta({
      title: "Privacy Policy | Shifora",
      description: "How Shifora collects, uses, and safeguards patient and doctor information across appointments, prescriptions, and records.",
      path: "/privacy-policy",
    });
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1
          className="text-4xl font-semibold mb-2"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          Privacy Policy
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
        </p>

        <section className="space-y-6 leading-relaxed">
          <p>
            Shifora ("we", "our", or "us") operates the dashboard at
            <strong> dashboard.drmabari.com</strong> (the "Service"). This Privacy Policy
            explains how we collect, use and safeguard information when you use the
            Service.
          </p>

          <h2 className="text-xl font-semibold mt-8" style={{ fontFamily: "'Poppins', sans-serif" }}>1. Information we collect</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Account information:</strong> name, email, phone, role (patient/doctor).</li>
            <li><strong>Medical information:</strong> only data you or your clinician enter (visits, prescriptions, reports).</li>
            <li><strong>Authentication data:</strong> when you sign in with Google we receive your email, name and profile picture.</li>
            <li><strong>Calendar data:</strong> if you connect Google Calendar, we create events for confirmed appointments only. We never read other events.</li>
            <li><strong>Technical data:</strong> IP address, browser type, and basic usage logs for security.</li>
          </ul>

          <h2 className="text-xl font-semibold mt-8" style={{ fontFamily: "'Poppins', sans-serif" }}>2. How we use information</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>To operate the appointment, prescription and patient-record features.</li>
            <li>To send transactional emails (booking confirmations, password resets) via Resend.</li>
            <li>To create Google Meet links and calendar events for confirmed consultations.</li>
            <li>To secure the Service and prevent abuse.</li>
          </ul>

          <h2 className="text-xl font-semibold mt-8" style={{ fontFamily: "'Poppins', sans-serif" }}>3. Google API Services User Data</h2>
          <p>
            Shifora's use and transfer of information received from Google APIs adheres to the
            <a className="text-primary underline mx-1" href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
              Google API Services User Data Policy
            </a>
            including the Limited Use requirements. We do not sell, share or use Google user data for advertising, and we never train AI models on it.
          </p>

          <h2 className="text-xl font-semibold mt-8" style={{ fontFamily: "'Poppins', sans-serif" }}>4. Data sharing</h2>
          <p>We do not sell personal data. We share data only with:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Supabase (database & auth hosting).</li>
            <li>Google (Calendar / Meet, only when you explicitly connect).</li>
            <li>Resend (transactional email delivery).</li>
          </ul>

          <h2 className="text-xl font-semibold mt-8" style={{ fontFamily: "'Poppins', sans-serif" }}>5. Data retention & deletion</h2>
          <p>
            You may request deletion of your account and associated data at any time by emailing
            <a className="text-primary underline mx-1" href="mailto:support@drmabari.com">support@drmabari.com</a>.
            We will remove your data within 30 days, except where retention is legally required.
          </p>

          <h2 className="text-xl font-semibold mt-8" style={{ fontFamily: "'Poppins', sans-serif" }}>6. Security</h2>
          <p>
            All data is transmitted over HTTPS. Database access is protected by Row-Level Security policies. Passwords are hashed by Supabase Auth.
          </p>

          <h2 className="text-xl font-semibold mt-8" style={{ fontFamily: "'Poppins', sans-serif" }}>7. Contact</h2>
          <p>
            For privacy questions, contact <a className="text-primary underline" href="mailto:support@drmabari.com">support@drmabari.com</a>.
          </p>
        </section>
      </main>
    </div>
  );
};

export default PrivacyPolicy;