import React, { useEffect } from "react";
import { setPageMeta } from "@/lib/pageMeta";

const TermsOfService: React.FC = () => {
  useEffect(() => {
    setPageMeta({
      title: "Terms of Service | MedHelp",
      description: "The terms that govern your use of MedHelp's secure portal for appointments, prescriptions, and patient records.",
      path: "/terms-of-service",
    });
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1
          className="text-4xl font-semibold mb-2"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          Terms of Service
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
        </p>

        <section className="space-y-6 leading-relaxed">
          <p>
            By accessing <strong>dashboard.drmabari.com</strong> ("MedHelp", "the Service")
            you agree to these Terms of Service. If you do not agree, do not use the Service.
          </p>

          <h2 className="text-xl font-semibold mt-8" style={{ fontFamily: "'Poppins', sans-serif" }}>1. Eligibility</h2>
          <p>You must be 18+ or have a guardian's consent to use the Service.</p>

          <h2 className="text-xl font-semibold mt-8" style={{ fontFamily: "'Poppins', sans-serif" }}>2. Medical disclaimer</h2>
          <p>
            MedHelp is a digital tool for managing appointments and records. It is not a
            substitute for emergency care or in-person medical examination. In case of emergency,
            call your local emergency services immediately.
          </p>

          <h2 className="text-xl font-semibold mt-8" style={{ fontFamily: "'Poppins', sans-serif" }}>3. Account responsibilities</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Provide accurate and complete information.</li>
            <li>Keep your password secure; you are responsible for all activity under your account.</li>
            <li>Do not impersonate any other person.</li>
          </ul>

          <h2 className="text-xl font-semibold mt-8" style={{ fontFamily: "'Poppins', sans-serif" }}>4. Acceptable use</h2>
          <p>You agree not to misuse the Service, including but not limited to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Attempting to access another user's data.</li>
            <li>Uploading malicious code.</li>
            <li>Using the Service for any unlawful purpose.</li>
          </ul>

          <h2 className="text-xl font-semibold mt-8" style={{ fontFamily: "'Poppins', sans-serif" }}>5. Third-party services</h2>
          <p>
            The Service uses Google (Calendar, Meet, Sign-in), Supabase and Resend. Use of those
            services is governed by their respective terms.
          </p>

          <h2 className="text-xl font-semibold mt-8" style={{ fontFamily: "'Poppins', sans-serif" }}>6. Limitation of liability</h2>
          <p>
            The Service is provided "as is" without warranties of any kind. To the maximum extent
            permitted by law, MedHelp is not liable for any indirect, incidental or consequential
            damages arising from your use of the Service.
          </p>

          <h2 className="text-xl font-semibold mt-8" style={{ fontFamily: "'Poppins', sans-serif" }}>7. Termination</h2>
          <p>
            We may suspend or terminate accounts that violate these Terms. You may stop using the
            Service at any time.
          </p>

          <h2 className="text-xl font-semibold mt-8" style={{ fontFamily: "'Poppins', sans-serif" }}>8. Changes</h2>
          <p>
            We may update these Terms. Material changes will be communicated via email or in-app
            notice. Continued use of the Service constitutes acceptance.
          </p>

          <h2 className="text-xl font-semibold mt-8" style={{ fontFamily: "'Poppins', sans-serif" }}>9. Contact</h2>
          <p>
            Questions? Email <a className="text-primary underline" href="mailto:support@drmabari.com">support@drmabari.com</a>.
          </p>
        </section>
      </main>
    </div>
  );
};

export default TermsOfService;