import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'doctor' | 'patient' | null;

// Role resolution is server-driven. The doctor role can only be assigned by an
// administrator via a server-side path (a DB trigger blocks self-assignment).
// New users self-assign the 'patient' role; everyone else gets whatever the DB
// confirms is in user_roles.

export function useUserRole() {
  const [role, setRole] = useState<AppRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) { setLoading(false); return; }

      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      let resolved: AppRole = null;
      const roles = (data ?? []).map((r) => r.role as 'doctor' | 'patient');
      if (roles.includes('doctor')) resolved = 'doctor';
      else if (roles.includes('patient')) resolved = 'patient';

      if (!resolved) {
        // Self-assign patient role. DB trigger blocks any attempt to insert 'doctor'.
        const { error: insertErr } = await supabase
          .from('user_roles')
          .insert({ user_id: user.id, role: 'patient' });
        if (!insertErr) resolved = 'patient';
        else console.error('role insert failed', insertErr);
      }

      if (!cancelled) {
        setRole(resolved);
        setLoading(false);
      }
    };

    fetchRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchRole();
    });

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  return { role, loading };
}
