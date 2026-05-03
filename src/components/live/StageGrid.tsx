'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ICameraVideoTrack } from '@/lib/agora/client';
import type { RemoteStreamUser } from '@/hooks/useMultiStream';
import type { Profile, StageParticipant } from '@/types';
import ParticipantCell from './ParticipantCell';

interface Props {
  localVideoTrack: ICameraVideoTrack | null;
  remoteUsers: RemoteStreamUser[];
  stageParticipants: StageParticipant[];
  localProfile: Profile;
  dominaProfile: Pick<Profile, 'id' | 'username' | 'avatar_url'>;
  isDomina: boolean;
  onParticipantAction?: (
    profileId: string,
    action: 'mute' | 'hide' | 'remove' | 'kick'
  ) => void;
}

type StageCell = {
  key: string;
  uidRef: string;
  profileId: string;
  name: string;
  role: Profile['role'];
  isDomina: boolean;
  videoTrack: ICameraVideoTrack | null | RemoteStreamUser['videoTrack'];
  isMirror?: boolean;
  isMuted?: boolean;
  isCamOff?: boolean;
  isHost?: boolean;
};

export default function StageGrid({
  localVideoTrack,
  remoteUsers,
  stageParticipants,
  localProfile,
  dominaProfile,
  isDomina,
  onParticipantAction,
}: Props) {
  const [activeMenuFor, setActiveMenuFor] = useState<string | null>(null);

  const dominaRemoteTrack = useMemo(() => {
    if (isDomina) return null;
    const hostRemote = remoteUsers.find((u) => u.isHost && u.videoTrack);
    return hostRemote?.videoTrack ?? remoteUsers[0]?.videoTrack ?? null;
  }, [isDomina, remoteUsers]);

  const stageCells = useMemo<StageCell[]>(() => {
    const participantsSorted = stageParticipants
      .filter((p) => p.is_on_stage)
      .sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());

    const participantCells = participantsSorted.map((p): StageCell => {
      const isLocalParticipant = p.profile_id === localProfile.id;
      const matchedRemote = remoteUsers.find((u) => Number(u.uid) === p.agora_uid);
      return {
        key: `participant-${p.profile_id}`,
        uidRef: String(p.agora_uid),
        profileId: p.profile_id,
        name: p.profile?.username ?? (isLocalParticipant ? localProfile.username : 'Intervenant'),
        role: p.profile?.role ?? (isLocalParticipant ? localProfile.role : 'SOUMIS'),
        isDomina: false,
        videoTrack: isLocalParticipant ? localVideoTrack : (matchedRemote?.videoTrack ?? null),
        isMirror: isLocalParticipant,
        isMuted: p.mic_muted,
        isCamOff: p.cam_off,
        isHost: matchedRemote?.isHost,
      };
    });

    const dominaCell: StageCell = {
      key: `domina-${dominaProfile.id}`,
      uidRef: `domina-${dominaProfile.id}`,
      profileId: dominaProfile.id,
      name: dominaProfile.username,
      role: 'DOMINA',
      isDomina: true,
      videoTrack: isDomina ? localVideoTrack : dominaRemoteTrack,
      isMirror: isDomina,
      isMuted: false,
      isCamOff: false,
      isHost: true,
    };

    return [dominaCell, ...participantCells].slice(0, 5);
  }, [dominaProfile.id, dominaProfile.username, dominaRemoteTrack, isDomina, localProfile.id, localProfile.role, localProfile.username, localVideoTrack, remoteUsers, stageParticipants]);

  const dominaCell = stageCells[0];
  const participantCells = stageCells.slice(1);
  const total = stageCells.length;

  const topHeightClass =
    total <= 2 ? 'h-1/2' : total === 3 ? 'h-[60%]' : total === 4 ? 'h-[55%]' : 'h-[60%]';
  const bottomHeightClass =
    total <= 2 ? 'h-1/2' : total === 3 ? 'h-[40%]' : total === 4 ? 'h-[45%]' : 'h-[40%]';
  const bottomGridClass =
    total <= 2
      ? 'grid-cols-1'
      : total === 3
        ? 'grid-cols-2'
        : total === 4
          ? 'grid-cols-3'
          : 'grid-cols-2 grid-rows-2';

  return (
    <div className="relative w-full h-full overflow-hidden">
      <AnimatePresence>
        {activeMenuFor && (
          <motion.button
            type="button"
            aria-label="Fermer menu actions"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 bg-transparent"
            onClick={() => setActiveMenuFor(null)}
          />
        )}
      </AnimatePresence>

      {total === 1 ? (
        <motion.div
          layout
          transition={{ type: 'spring', stiffness: 210, damping: 26 }}
          className="relative z-0 w-full h-full p-2"
        >
          <motion.div layoutId={`stage-cell-${dominaCell.uidRef}`} className="w-full h-full">
            <ParticipantCell
              videoTrack={dominaCell.videoTrack ?? null}
              name={dominaCell.name}
              role={dominaCell.role}
              isMirror={dominaCell.isMirror}
              isHost
            />
          </motion.div>
        </motion.div>
      ) : (
        <motion.div
          layout
          transition={{ type: 'spring', stiffness: 210, damping: 26 }}
          className="relative z-0 w-full h-full flex flex-col gap-2 p-2"
        >
          <div className={`${topHeightClass} min-h-0`}>
            <motion.div layoutId={`stage-cell-${dominaCell.uidRef}`} className="w-full h-full">
              <ParticipantCell
                videoTrack={dominaCell.videoTrack ?? null}
                name={dominaCell.name}
                role={dominaCell.role}
                isMirror={dominaCell.isMirror}
                isHost
              />
            </motion.div>
          </div>

          <div className={`${bottomHeightClass} min-h-0`}>
            <motion.div
              layout
              transition={{ type: 'spring', stiffness: 210, damping: 26 }}
              className={`grid ${bottomGridClass} gap-2 h-full`}
            >
              {participantCells.map((cell) => (
                <motion.div key={cell.key} layoutId={`stage-cell-${cell.uidRef}`} className="min-h-0">
                  <ParticipantCell
                    videoTrack={cell.videoTrack ?? null}
                    name={cell.name}
                    role={cell.role}
                    isMirror={cell.isMirror}
                    isMuted={cell.isMuted}
                    isCamOff={cell.isCamOff}
                    isHost={cell.isHost}
                    showControls={isDomina}
                    controlsOpen={activeMenuFor === cell.profileId}
                    onToggleControls={() =>
                      setActiveMenuFor((cur) => (cur === cell.profileId ? null : cell.profileId))
                    }
                    onMute={() => {
                      onParticipantAction?.(cell.profileId, 'mute');
                    }}
                    onHideCamera={() => {
                      onParticipantAction?.(cell.profileId, 'hide');
                    }}
                    onRemove={() => {
                      onParticipantAction?.(cell.profileId, 'remove');
                      setActiveMenuFor(null);
                    }}
                    onKick={() => {
                      onParticipantAction?.(cell.profileId, 'kick');
                      setActiveMenuFor(null);
                    }}
                  />
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
