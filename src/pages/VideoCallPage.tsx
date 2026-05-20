import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import DailyIframe, { type DailyCall } from '@daily-co/daily-js';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { getDailyJoin } from '@/lib/dailyRoom';
import { toast } from 'sonner';
import { requestCameraAndMicForVideoCall } from '@/utils/requestPermissions';

function getFallbackPath(role: 'doctor' | 'patient' | null) {
  return role === 'patient' ? '/patient/appointments' : '/dashboard/appointments';
}

/** Internal: classify meeting quality from a duration. */
function classifyMeetingQuality(durationMs: number, bothJoined: boolean): 'completed' | 'short' | 'failed' {
  if (!bothJoined) return 'failed';
  if (durationMs >= 10 * 60 * 1000) return 'completed';
  return 'short';
}

export default function VideoCallPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { role, loading: roleLoading } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDoctorPrompt, setShowDoctorPrompt] = useState(false);
  const [promptBusy, setPromptBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<DailyCall | null>(null);
  const joinedAtRef = useRef<number | null>(null);

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
    document.title = `${t('video.title')} — Shifora`;
  }, [t]);

  // ── Doctor post-call actions ──
  const finishSession = async () => {
    if (!appointmentId) return;
    setPromptBusy(true);
    const durationMs = joinedAtRef.current ? Date.now() - joinedAtRef.current : 0;
    const { data: row } = await supabase
      .from('appointments')
      .select('patient_joined_at')
      .eq('id', appointmentId)
      .maybeSingle();
    const bothJoined = !!(row as any)?.patient_joined_at;
    const quality = classifyMeetingQuality(durationMs, bothJoined);
    await supabase.from('appointments').update({
      status: 'completed',
      session_ended_at: new Date().toISOString(),
      session_ended_by: 'doctor',
      meeting_quality: quality,
      updated_at: new Date().toISOString(),
    } as never).eq('id', appointmentId);
    toast.success('Session ended');
    setPromptBusy(false);
    closeToAppointments();
  };

  const askPatientToRejoin = async () => {
    if (!appointmentId) return;
    setPromptBusy(true);
    // Keep status so the join window stays open; flag quality as needing follow-up.
    await supabase.from('appointments').update({
      status: 'awaiting_prescription',
      meeting_quality: 'needs_rejoin',
      updated_at: new Date().toISOString(),
    } as never).eq('id', appointmentId);
    // Log a patient-facing notification for the dashboard to surface.
    await (supabase as any).from('notification_logs').insert({
      type: 'rejoin_request',
      channel: 'in_app',
      recipient: appointmentId,
      message: 'Your meeting has not been completed yet. Please join again.',
      status: 'sent',
    });
    toast.success('Patient asked to rejoin');
    setPromptBusy(false);
    closeToAppointments();
  };

  useEffect(() => {
    if (!appointmentId || roleLoading || !containerRef.current) {
      return;
    }

    if (!role) {
      setError('Your account role was not found. Please sign out and sign in again.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    const startCall = async () => {
      try {
        setLoading(true);
        setError(null);

        // Ask for camera + microphone right before joining (native only).
        // On web, Daily handles the browser prompt itself.
        const perms = await requestCameraAndMicForVideoCall();
        if (!perms.ok) {
          const missing = [
            !perms.cameraGranted && 'Camera',
            !perms.micGranted && 'Microphone',
          ].filter(Boolean).join(' and ');
          setError(
            perms.permanentlyDenied
              ? `${missing} access is blocked. Open Settings → Apps → Shifora → Permissions and allow ${missing}.`
              : `${missing} permission is needed to start the video call. Please tap Allow when prompted.`,
          );
          setLoading(false);
          return;
        }

        // NOTE: We deliberately do NOT call getUserMedia({video:true}) here as a
        // pre-flight for Daily. Inside the Capacitor WebView that promise can
        // hang waiting for our WebChromeClient.onPermissionRequest hook. Daily
        // will request camera/mic itself once we call join().

        const { data: { user } } = await supabase.auth.getUser();
        const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || (role === 'doctor' ? 'Doctor' : 'Patient');

        // Safety timeout — if getDailyJoin doesn't return within 15s, surface
        // an error instead of leaving the spinner up forever.
        console.info('[video] requesting Daily room', { appointmentId, role });
        const joinPromise = getDailyJoin(appointmentId, displayName);
        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 15000),
        );
        const join = await Promise.race([joinPromise, timeoutPromise]);

        if (cancelled) return;

        if (!join || !containerRef.current) {
          setError(t('video.couldNotStart') + ' (timeout or no room)');
          setLoading(false);
          return;
        }

        console.info('[video] Daily room ready', { room: join.room, isDoctor: join.isDoctor });


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
          joinedAtRef.current = Date.now();
          const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if (role === 'doctor') {
            patch.status = 'in_call';
            patch.doctor_joined_at = new Date().toISOString();
          } else {
            patch.patient_joined_at = new Date().toISOString();
          }
          await supabase.from('appointments').update(patch as never).eq('id', appointmentId);
        });

        call.on('left-meeting', async () => {
          const leftField = role === 'doctor' ? 'doctor_left_at' : 'patient_left_at';
          const patch: Record<string, unknown> = {
            [leftField]: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          if (role === 'doctor') {
            patch.status = 'awaiting_prescription';
          }
          await supabase.from('appointments').update(patch as never).eq('id', appointmentId);

          if (role === 'doctor') {
            // Don't auto-close yet — show the "Was the meeting completed?" prompt.
            setShowDoctorPrompt(true);
          } else {
            closeToAppointments();
          }
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
          <p className="text-sm text-muted-foreground">Appointment পাওয়া যায়নি।</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[200] h-[100dvh] w-screen overflow-hidden bg-background"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
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

        {/* Doctor post-call prompt */}
        {showDoctorPrompt && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/90 px-6">
            <div className="glass-card w-full max-w-md space-y-5 p-6">
              <div className="space-y-1.5 text-center">
                <h2 className="text-lg font-semibold">Was the meeting completed?</h2>
                <p className="text-xs text-muted-foreground">
                  Choose what to do next. The patient sees only your choice.
                </p>
              </div>
              <div className="grid gap-2">
                <button
                  disabled={promptBusy}
                  onClick={finishSession}
                  className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, hsl(152 69% 35%), hsl(174 72% 38%))' }}
                >
                  Yes — end session
                </button>
                <button
                  disabled={promptBusy}
                  onClick={askPatientToRejoin}
                  className="w-full rounded-xl px-4 py-3 text-sm font-semibold border border-border bg-card hover:bg-muted/40 transition disabled:opacity-60"
                >
                  No — ask patient to rejoin
                </button>
                <button
                  disabled={promptBusy}
                  onClick={closeToAppointments}
                  className="w-full text-xs text-muted-foreground py-2 hover:text-foreground"
                >
                  Just close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
