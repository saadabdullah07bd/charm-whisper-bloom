import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { useUserRole } from "@/hooks/useUserRole";
import PatientAuthPage from "@/pages/PatientAuthPage";
import PatientDashboard from "@/pages/PatientDashboard";
import WelcomeOnboarding from "@/components/WelcomeOnboarding";
import { isWelcomeDone } from "@/lib/welcomePrefs";
import BrandedSpinner from "@/components/BrandedSpinner";


interface Props {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<Props> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [welcomeDone, setWelcomeDoneState] = useState<boolean>(() => isWelcomeDone());
  const { role, loading: roleLoading } = useUserRole();
  const location = useLocation();
  const isCallRoute = location.pathname.startsWith('/call/');
  
  

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
    return <BrandedSpinner fullscreen label="Loading…" />;
  }

  if (!session) {
    return <PatientAuthPage />;
  }

  if (!welcomeDone) {
    return <WelcomeOnboarding onDone={() => setWelcomeDoneState(true)} />;
  }

  // The /call route is shared by patients & doctors — don't redirect patients
  // to their dashboard when navigating there.
  if (role === 'patient' && !isCallRoute) {
    return <PatientDashboard />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
