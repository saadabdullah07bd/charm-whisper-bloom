import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, VideoOff } from 'lucide-react';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { requestCameraMicPermissions } from '@/utils/requestPermissions';

/**
 * In-app Daily.co video call screen.
 *
 * The "Join Call" button on the dashboard navigates here. We:
 *   1. Ask camera/mic permission via getUserMedia (still inside the click chain
 *      because navigate() is sync and we re-prompt on mount with a button).
 *   2. Call the `daily-room` edge function to get { url, token }.
 *   3. Mount a Daily prebuilt iframe inside our container — full-screen.
 */
const VideoCallPage: React.FC = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<DailyCall | null>(null);

  const [status, setStatus] = useState<'idle' | 'requesting-perms' | 'connecting' | 'in-call' | 'error' | 'permission-denied'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const startCall = async () => {
    if (!appointmentId) {
      setStatus('error');
      setErrorMsg('Missing appointment ID.');
      return;
    }

    setStatus('requesting-perms');
    const granted = await requestCameraMicPermissions();
    if (!granted) {
      setStatus('permission-denied');
      return;
    }

    setStatus('connecting');
    try {
      const { data, error } = await supabase.functions.invoke('daily-room', {
        body: { appointmentId },
      });
      if (error) throw error;
      if (!data?.url || !data?.token) throw new Error('Invalid room response');

      if (!containerRef.current) throw new Error('Container not ready');

      const frame = DailyIframe.createFrame(containerRef.current, {
        showLeaveButton: true,
        iframeStyle: {
          position: 'absolute',
          width: '100%',
          height: '100%',
          border: '0',
          background: '#000',
        },
      });
      callRef.current = frame;

      frame.on('left-meeting', () => {
        navigate(-1);
      });
      frame.on('error', (e: any) => {
        console.error('[daily] error', e);
        toast.error(e?.errorMsg ?? 'Call error');
      });

      await frame.join({ url: data.url, token: data.token });
      setStatus('in-call');
    } catch (err: any) {
      console.error('[VideoCallPage] start failed', err);
      setStatus('error');
      setErrorMsg(err?.message ?? 'Could not start the call.');
    }
  };

  useEffect(() => {
    return () => {
      if (callRef.current) {
        callRef.current.leave().catch(() => {});
        callRef.current.destroy().catch(() => {});
        callRef.current = null;
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/90 hover:text-white text-sm"
        >
          <ArrowLeft size={18} /> Back
        </button>
        <div className="text-white/80 text-xs">
          {status === 'in-call' ? '● Live' : status === 'connecting' ? 'Connecting…' : ''}
        </div>
      </div>

      {/* Daily iframe mount point */}
      <div ref={containerRef} className="relative flex-1" />

      {/* Overlay states */}
      {status !== 'in-call' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black">
          <div className="max-w-sm w-full px-6 text-center text-white space-y-4">
            {status === 'idle' && (
              <>
                <h2 className="text-2xl font-semibold">Ready to join?</h2>
                <p className="text-white/70 text-sm">
                  Your camera and microphone will be requested next.
                </p>
                <Button onClick={startCall} size="lg" className="w-full">
                  Join Video Call
                </Button>
                <Button variant="ghost" onClick={() => navigate(-1)} className="w-full text-white/70">
                  Cancel
                </Button>
              </>
            )}
            {(status === 'requesting-perms' || status === 'connecting') && (
              <div className="flex flex-col items-center gap-3 text-white/80">
                <Loader2 className="animate-spin" size={32} />
                <p>{status === 'requesting-perms' ? 'Requesting camera & microphone…' : 'Connecting to call…'}</p>
              </div>
            )}
            {status === 'permission-denied' && (
              <>
                <VideoOff className="mx-auto" size={40} />
                <h2 className="text-xl font-semibold">Camera & microphone needed</h2>
                <p className="text-white/70 text-sm">
                  Please allow camera and microphone access in your device settings, then try again.
                </p>
                <Button onClick={startCall} className="w-full">Try Again</Button>
                <Button variant="ghost" onClick={() => navigate(-1)} className="w-full text-white/70">
                  Go Back
                </Button>
              </>
            )}
            {status === 'error' && (
              <>
                <h2 className="text-xl font-semibold">Couldn't start call</h2>
                <p className="text-white/70 text-sm">{errorMsg}</p>
                <Button onClick={startCall} className="w-full">Try Again</Button>
                <Button variant="ghost" onClick={() => navigate(-1)} className="w-full text-white/70">
                  Go Back
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoCallPage;
