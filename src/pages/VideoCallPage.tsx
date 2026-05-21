import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, VideoOff } from 'lucide-react';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { requestCameraMicPermissions } from '@/utils/requestPermissions';

const withTimeout = <T,>(promise: Promise<T>, ms: number, message: string): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);

type Status = 'idle' | 'requesting-perms' | 'loading-room' | 'in-prejoin' | 'in-call' | 'error' | 'permission-denied';

/**
 * In-app Daily.co video call screen with Daily's built-in pre-join UI.
 *
 * Flow:
 *   1. Show our "Ready to join?" splash (lets user back out safely).
 *   2. On click: request native camera/mic perms (Capacitor + getUserMedia).
 *   3. Fetch room URL + token from `daily-room` edge function.
 *   4. Mount Daily iframe with `showPrejoinUI: true` — Daily shows its own
 *      camera preview / mic test / device selector before joining.
 */
const VideoCallPage: React.FC = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<DailyCall | null>(null);

  const [status, setStatus] = useState<Status>('idle');
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

    setStatus('loading-room');
    try {
      if (callRef.current) {
        await callRef.current.destroy().catch(() => {});
        callRef.current = null;
      }

      const { data, error } = await withTimeout(
        supabase.functions.invoke('daily-room', { body: { appointmentId } }),
        20000,
        'The call server took too long to respond. Please check your connection and try again.',
      );
      if (error) throw error;
      if (!data?.url || !data?.token) throw new Error('Invalid room response');

      if (!containerRef.current) throw new Error('Container not ready');

      const frame = DailyIframe.createFrame(containerRef.current, {
        showLeaveButton: true,
        showFullscreenButton: true,
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
      frame.on('joined-meeting', () => {
        setStatus('in-call');
      });
      frame.on('error', (e: { errorMsg?: string } | undefined) => {
        console.error('[daily] error', e);
        const message = e?.errorMsg ?? 'Daily could not connect to the call.';
        toast.error(message);
        setStatus('error');
        setErrorMsg(message);
      });
      frame.on('network-connection', (e: { event?: string } | undefined) => {
        if (e?.event === 'interrupted') {
          toast.error('Network connection interrupted. Trying to reconnect...', { duration: 5000 });
        } else if (e?.event === 'connected') {
          toast.success('Network connection restored');
        }
      });

      // Pre-auth so the iframe loads its pre-join UI without an extra round-trip.
      await frame.preAuth({ url: data.url, token: data.token });
      // Open Daily's built-in pre-join (camera preview, mic test, device selector).
      await frame.startCamera();
      await frame.join();
      // status flips to 'in-call' via the 'joined-meeting' event above.
      setStatus('in-prejoin');
    } catch (err: unknown) {
      console.error('[VideoCallPage] start failed', err);
      if (callRef.current) {
        await callRef.current.destroy().catch(() => {});
        callRef.current = null;
      }
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Could not start the call.');
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

  const showOverlay = status === 'idle'
    || status === 'requesting-perms'
    || status === 'loading-room'
    || status === 'permission-denied'
    || status === 'error';

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
          {status === 'in-call' ? '● Live' : status === 'in-prejoin' ? 'Pre-join' : ''}
        </div>
      </div>

      {/* Daily iframe mount point */}
      <div ref={containerRef} className="relative flex-1" />

      {/* Overlay states (only while not in Daily UI) */}
      {showOverlay && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black">
          <div className="max-w-sm w-full px-6 text-center text-white space-y-4">
            {status === 'idle' && (
              <>
                <h2 className="text-2xl font-semibold">Ready to join?</h2>
                <p className="text-white/70 text-sm">
                  We'll ask for camera & microphone, then open the pre-join screen so
                  you can check your video and audio before connecting.
                </p>
                <Button onClick={startCall} size="lg" className="w-full">
                  Join Video Call
                </Button>
                <Button variant="ghost" onClick={() => navigate(-1)} className="w-full text-white/70">
                  Cancel
                </Button>
              </>
            )}
            {(status === 'requesting-perms' || status === 'loading-room') && (
              <div className="flex flex-col items-center gap-3 text-white/80">
                <Loader2 className="animate-spin" size={32} />
                <p>{status === 'requesting-perms' ? 'Requesting camera & microphone…' : 'Preparing your room…'}</p>
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
