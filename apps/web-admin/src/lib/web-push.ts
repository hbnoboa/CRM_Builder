'use client';

import api from '@/lib/api';
import { isIos, isStandalone } from '@/stores/pwa-install-store';

/**
 * Notificacao no navegador (Web Push) deste aparelho, na empresa atual.
 *  - unsupported: navegador sem suporte
 *  - ios-install: iPhone/iPad fora do aplicativo instalado (a Apple so permite instalado)
 *  - blocked: a pessoa bloqueou as notificacoes do site no navegador
 */
export type DevicePushState =
  | { status: 'unavailable' }
  | { status: 'unsupported' | 'ios-install' | 'blocked' }
  | { status: 'off' | 'on'; publicKey: string };

const supported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function keyBytes(base64Url: string): Uint8Array {
  const padded = `${base64Url}${'='.repeat((4 - (base64Url.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  return (await navigator.serviceWorker.getRegistration('/')) || navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

export async function devicePushState(): Promise<DevicePushState> {
  const { data } = await api.get<{ available: boolean; publicKey: string | null }>('/push/web/config');
  if (!data.available || !data.publicKey) return { status: 'unavailable' };
  if (isIos() && !isStandalone()) return { status: 'ios-install' };
  if (!supported()) return { status: 'unsupported' };
  if (Notification.permission === 'denied') return { status: 'blocked' };
  const sub = await (await registration()).pushManager.getSubscription();
  if (!sub || Notification.permission !== 'granted') return { status: 'off', publicKey: data.publicKey };
  const { data: st } = await api.post<{ subscribed: boolean }>('/push/web/status', { endpoint: sub.endpoint });
  return { status: st.subscribed ? 'on' : 'off', publicKey: data.publicKey };
}

/** Pede permissao, inscreve o aparelho e avisa a API. false = a pessoa nao permitiu. */
export async function enableDevicePush(publicKey: string): Promise<boolean> {
  if ((await Notification.requestPermission()) !== 'granted') return false;
  const reg = await registration();
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  const options = { userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) as BufferSource };
  try {
    sub ??= await reg.pushManager.subscribe(options);
  } catch {
    // Inscricao antiga com outra chave: refaz
    await sub?.unsubscribe();
    sub = await reg.pushManager.subscribe(options);
  }
  const keys = sub.toJSON().keys ?? {};
  await api.post('/push/web/subscribe', { endpoint: sub.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } });
  return true;
}

/** Para de receber neste aparelho (tambem ao sair da conta). */
export async function disableDevicePush(): Promise<void> {
  if (!supported()) return;
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await api.delete('/push/web/subscribe', { data: { endpoint: sub.endpoint } }).catch(() => undefined);
  await sub.unsubscribe().catch(() => undefined);
}
