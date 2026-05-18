import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { useUserRole } from "@/hooks/useUserRole";
import PatientAuthPage from "@/pages/PatientAuthPage";
import PatientDashboard from "@/pages/PatientDashboard";
import WelcomeOnboarding from "@/components/WelcomeOnboarding";
import { isWelcomeDone } from "@/lib/welcomePrefs";
import BrandedSpinner from "@/components/BrandedSpinner";
import { useLocation } from "react-router-dom";

interface Props {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<Props> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [welcomeDone, setWelcomeDoneState] = useState<boolean>(() => isWelcomeDone());
  const { role, loading: roleLoading } = useUserRole();
  const location = useLocation();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading || (session && roleLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return <PatientAuthPage />;
  }

  if (!welcomeDone && !location.pathname.startsWith('/call/')) {
    return <WelcomeOnboarding onDone={() => setWelcomeDoneState(true)} />;
  }

  if (role === 'patient') {
    if (location.pathname.startsWith('/call/')) {
      return <>{children}</>;
    }

    return <PatientDashboard />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
