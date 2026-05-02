'use client';

import { useInviteNotification } from '@/hooks/useInviteNotification';
import InviteToast from '@/components/live/InviteToast';

interface Props {
  profileId: string;
  /** Seuls les soumis reçoivent les invitations duo en broadcast */
  role: string;
  children: React.ReactNode;
}

export default function InviteNotificationLayer({ profileId, role, children }: Props) {
  const { invite, dismissInvite } = useInviteNotification(profileId);

  return (
    <>
      {role === 'SOUMIS' && <InviteToast invite={invite} onDismiss={dismissInvite} />}
      {children}
    </>
  );
}
