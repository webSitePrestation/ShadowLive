import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { RtcTokenBuilder, RtcRole } from 'agora-token';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { channelName, uid, role } = await request.json();
    if (!channelName || uid === undefined) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    }

    const appId = process.env.AGORA_APP_ID;
    const certificate = process.env.AGORA_APP_CERTIFICATE;
    if (!appId || !certificate) {
      return NextResponse.json(
        { error: 'Missing Agora server configuration (AGORA_APP_ID / AGORA_APP_CERTIFICATE)' },
        { status: 500 }
      );
    }
    const expirationSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationSeconds;

    const agoraRole = role === 'host' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      certificate,
      channelName,
      uid,
      agoraRole,
      privilegeExpiredTs,
      privilegeExpiredTs
    );

    if (!token) {
      return NextResponse.json({ error: 'Failed to generate Agora token' }, { status: 500 });
    }

    return NextResponse.json({ token, appId });
  } catch (error) {
    console.error('Agora token error:', error);
    return NextResponse.json({ error: 'Token generation failed' }, { status: 500 });
  }
}
