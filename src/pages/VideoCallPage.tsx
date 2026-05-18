import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import DailyIframe, { type DailyCall } from '@daily-co/daily-js';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { getDailyJoin } from '@/lib/dailyRoom';

function getFallbackPath(role: 'doctor' | 'patient' | null) {
  return role === 'patient' ? '/patient/appointments' : '/dashboard/appointments';
}

export default function VideoCallPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { role, loading: roleLoading } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<DailyCall | null>(null);

  const closeToAppointments = useCallback(() => {
    navigate(getFallbackPath(role), { replace: true });
  }, [navigate, role]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.documentElement.classList.add('video-call-page');
    document.body.classList.add('video-call-page');
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.classList.remove('video-call-page');
      document.body.classList.remove('video-call-page');
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    document.title = `${t('video.title')} — MedHelp`;
  }, [t]);

  useEffect(() => {
    if (!appointmentId || roleLoading || !role || !containerRef.current) {
      return;
    }

    let cancelled = false;

    const startCall = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { user } } = await supabase.auth.getUser();
        const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || (role === 'doctor' ? 'Doctor' : 'Patient');
        const join = await getDailyJoin(appointmentId, displayName);

        if (cancelled) return;

        if (!join || !containerRef.current) {
          setError(t('video.couldNotStart'));
          setLoading(false);
          return;
        }

        const call = DailyIframe.createFrame(containerRef.current, {
          showLeaveButton: true,
          iframeStyle: {
            position: 'absolute',
            inset: '0',
            width: '100%',
            height: '100%',
            border: '0',
          },
        });

        callRef.current = call;

        call.on('joined-meeting', async () => {
          if (role === 'doctor') {
            await supabase.from('appointments').update({
              status: 'in_call',
              updated_at: new Date().toISOString(),
            } as never).eq('id', appointmentId);
          }
        });

        call.on('left-meeting', async () => {
          if (role === 'doctor') {
            await supabase.from('appointments').update({
              status: 'awaiting_prescription',
              updated_at: new Date().toISOString(),
            } as never).eq('id', appointmentId);
          }
          closeToAppointments();
        });

        call.on('error', (event: unknown) => {
          console.error('Daily call error:', event);
          if (!cancelled) {
            setError(t('video.havingIssues'));
            setLoading(false);
          }
        });

        await call.join({ url: join.url, token: join.token ?? undefined });

        if (!cancelled) {
          setLoading(false);
        }
      } catch (err) {
        console.error('Daily join failed:', err);
        if (!cancelled) {
          setError(t('video.couldNotConnect'));
          setLoading(false);
        }
      }
    };

    startCall();

    return () => {
      cancelled = true;
      const call = callRef.current;
      callRef.current = null;
      if (call) {
        try {
          call.destroy();
        } catch {
          // noop
        }
      }
    };
  }, [appointmentId, closeToAppointments, role, roleLoading, t]);

  if (!appointmentId) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-6 text-center">
        <div className="glass-card max-w-md p-6">
          <p className="text-sm text-muted-foreground">Appointment পাওয়া যায়নি।</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] h-[100dvh] w-screen overflow-hidden bg-background">
      <div ref={containerRef} className="relative h-full w-full overflow-hidden">
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/90">
            <div className="glass-card flex items-center gap-3 px-5 py-4 text-sm text-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span>{t('video.starting')}</span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background px-6">
            <div className="glass-card w-full max-w-md space-y-4 p-6 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <button
                type="button"
                onClick={closeToAppointments}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                {t('video.backToAppointments')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}