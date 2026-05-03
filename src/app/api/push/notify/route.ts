import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .single();

    if (profileErr || !profile || (profile.role !== 'DOMINA' && profile.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as {
      sessionId?: string;
      sessionTitle?: string;
      dominaName?: string;
    };

    const sessionId = body.sessionId?.trim();
    const sessionTitle = body.sessionTitle?.trim() ?? 'Live';
    const dominaName = body.dominaName?.trim() ?? 'Domina';

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidEmail = process.env.VAPID_EMAIL ?? 'mailto:admin@shadowlive.app';

    if (!publicKey || !privateKey) {
      return NextResponse.json({ error: 'Push server not configured' }, { status: 503 });
    }

    const admin = createServiceRoleClient();
    if (!admin) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
    }

    const { data: subs, error: subsErr } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, profile_id');

    if (subsErr) {
      console.error('[push/notify] fetch subs', subsErr);
      return NextResponse.json({ error: subsErr.message }, { status: 500 });
    }

    const profileIds = [...new Set((subs ?? []).map((s) => s.profile_id).filter(Boolean))] as string[];
    if (profileIds.length === 0) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    const { data: soumisProfiles, error: roleErr } = await admin
      .from('profiles')
      .select('id')
      .in('id', profileIds)
      .eq('role', 'SOUMIS');

    if (roleErr) {
      console.error('[push/notify] roles', roleErr);
      return NextResponse.json({ error: roleErr.message }, { status: 500 });
    }

    const soumisIdSet = new Set((soumisProfiles ?? []).map((p) => p.id));
    const targets = (subs ?? []).filter((s) => soumisIdSet.has(s.profile_id));

    webpush.setVapidDetails(vapidEmail, publicKey, privateKey);

    const payload = JSON.stringify({
      title: `${dominaName} est en live 🔴`,
      body: sessionTitle,
      icon: '/icon-192.png',
      data: { url: `/live/${sessionId}` },
    });

    let sent = 0;
    const staleIds: string[] = [];

    for (const row of targets) {
      const subscription = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };

      try {
        await webpush.sendNotification(subscription, payload, {
          TTL: 3600,
        });
        sent += 1;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 410 || status === 404) {
          staleIds.push(row.id);
        } else {
          console.warn('[push/notify] send failed', status, err);
        }
      }
    }

    if (staleIds.length > 0) {
      await admin.from('push_subscriptions').delete().in('id', staleIds);
    }

    return NextResponse.json({ success: true, sent });
  } catch (e) {
    console.error('[push/notify]', e);
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
}
