import { Capacitor, registerPlugin } from '@capacitor/core';

export interface NativeDailyCallResult {
  joined: boolean;
  durationMs: number;
  remoteJoined: boolean;
  error?: string;
}

interface DailyCallPluginShape {
  startCall(opts: {
    url: string;
    token?: string | null;
    userName?: string;
    isDoctor?: boolean;
  }): Promise<NativeDailyCallResult>;
  isAvailable(): Promise<{ available: boolean }>;
}

const DailyCall = registerPlugin<DailyCallPluginShape>('DailyCall');

/** True when running on Android in a Capacitor native shell AND the native DailyCall plugin is actually registered in this APK. */
export async function canUseNativeDaily(): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return false;
  try {
    const res = await DailyCall.isAvailable();
    return !!res?.available;
  } catch (err) {
    console.warn('[nativeDaily] plugin not available, falling back to iframe', err);
    return false;
  }
}

export async function startNativeDailyCall(opts: {
  url: string;
  token?: string | null;
  userName?: string;
  isDoctor?: boolean;
}): Promise<NativeDailyCallResult> {
  return DailyCall.startCall({
    url: opts.url,
    token: opts.token ?? null,
    userName: opts.userName ?? 'Guest',
    isDoctor: !!opts.isDoctor,
  });
}
