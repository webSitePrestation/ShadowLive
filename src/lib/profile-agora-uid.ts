/**
 * UID Agora stable dérivé du profil (même utilisateur = même UID dans le canal).
 * Permet à la Domina de cibler un remote user après un ban.
 */
export function profileIdToAgoraUid(profileId: string): number {
  let h = 5381;
  for (let i = 0; i < profileId.length; i++) {
    h = ((h << 5) + h + profileId.charCodeAt(i)) >>> 0;
  }
  const uid = (h % 2147483646) + 1;
  return uid === 0 ? 1 : uid;
}
