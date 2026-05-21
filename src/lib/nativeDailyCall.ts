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

/** True when running on Android in a Capacitor native shell (where the native Daily SDK is wired). */
export function canUseNativeDaily(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
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
