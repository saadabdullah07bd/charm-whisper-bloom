import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { setPageMeta } from "@/lib/pageMeta";
import medhelpLogo from "@/assets/medhelp-logo.png";

interface Props {
  onSwitchToDoctor?: () => void;
}

const PatientAuthPage: React.FC<Props> = (_props) => {
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    setPageMeta({
      title: "Sign In | MedHelp Patient Portal",
      description: "Sign in with Google to access your MedHelp patient portal — appointments, prescriptions and reports.",
      path: "/patient",
    });
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (err: any) {
      console.error("[handleGoogleLogin]", err);
      toast.error(err?.message || t('auth.signInFailed'));
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md" style={{ animation: 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
        <Card className="overflow-hidden">
          <CardHeader className="text-center items-center">
            <img src={medhelpLogo} alt="MedHelp" className="w-16 h-16 rounded-full mb-2" />
            <h1 className="text-2xl font-medium" style={{ fontFamily: "'Poppins', sans-serif" }}>{t('auth.portalTitle')}</h1>
            <CardDescription>{t('auth.portalDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button type="button" variant="outline" className="w-full" onClick={handleGoogleLogin} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <svg className="mr-2 h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.7 6.3 29.1 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.3-3.5z"/>
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.7 6.3 29.1 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"/>
                  <path fill="#4CAF50" d="M24 43.5c5 0 9.6-1.7 13.2-4.7l-6.1-5c-2 1.5-4.5 2.4-7.1 2.4-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.6 39.1 16.2 43.5 24 43.5z"/>
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.1 5c-.4.4 6.8-5 6.8-14.7 0-1.2-.1-2.3-.3-3.5z"/>
                </svg>
              )}
              {t('auth.continueWithGoogle')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PatientAuthPage;
