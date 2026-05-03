import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: 'Profil introuvable' }, { status: 400 });
    }

    const body = (await request.json()) as {
      endpoint?: string;
      p256dh?: string;
      auth?: string;
      keys?: { p256dh?: string; auth?: string };
    };

    const endpoint = body.endpoint?.trim();
    const p256dh = body.p256dh ?? body.keys?.p256dh;
    const auth = body.auth ?? body.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'Missing subscription keys' }, { status: 400 });
    }

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        profile_id: profile.id,
        endpoint,
        p256dh,
        auth,
      },
      { onConflict: 'profile_id,endpoint' }
    );

    if (error) {
      console.error('[push/subscribe]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[push/subscribe]', e);
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
}
