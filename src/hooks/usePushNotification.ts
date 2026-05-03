'use client';

import { useCallback, useEffect, useState } from 'react';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotification() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<'default' | 'granted' | 'denied'>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    const ok =
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window;
    setSupported(ok);
    if (!ok) return;

    setPermission(Notification.permission as 'default' | 'granted' | 'denied');

    void navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(Boolean(sub));
    });
  }, []);

  const requestPermission = useCallback(async () => {
    if (!supported) return;

    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapid?.trim()) {
      console.warn('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY manquant');
      return;
    }

    const perm = await Notification.requestPermission();
    setPermission(perm as 'granted' | 'denied' | 'default');

    if (perm !== 'granted') {
      setIsSubscribed(false);
      return;
    }

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid.trim()) as BufferSource,
      });
    }

    const json = sub.toJSON();
    const keys = json.keys as { p256dh?: string; auth?: string } | undefined;

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: json.endpoint,
        p256dh: keys?.p256dh,
        auth: keys?.auth,
        keys,
      }),
    });

    if (!res.ok) {
      console.warn('[push] subscribe API', await res.text());
      setIsSubscribed(false);
      return;
    }

    setIsSubscribed(true);
  }, [supported]);

  return {
    supported,
    permission,
    isSubscribed,
    requestPermission,
  };
}
