import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'doctor' | 'patient' | null;

const ADMIN_EMAILS = ['drmabaribd@gmail.com'];

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
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      let resolved: AppRole = (data?.role as AppRole) ?? null;

      if (!resolved) {
        const email = (user.email ?? '').toLowerCase();
        const desired: 'doctor' | 'patient' = ADMIN_EMAILS.includes(email) ? 'doctor' : 'patient';
        const { error: insertErr } = await supabase
          .from('user_roles')
          .insert({ user_id: user.id, role: desired });
        if (insertErr) console.error('role insert failed', insertErr);
        resolved = desired;
      } else {
        // Upgrade existing user to doctor if email matches admin list
        const email = (user.email ?? '').toLowerCase();
        if (ADMIN_EMAILS.includes(email) && resolved !== 'doctor') {
          await supabase.from('user_roles').insert({ user_id: user.id, role: 'doctor' });
          resolved = 'doctor';
        }
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
