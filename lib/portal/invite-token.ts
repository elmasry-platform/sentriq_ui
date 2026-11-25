/** The invitation token travels in the URL fragment so it is never sent to a server or logged.
 *  Returns the token, or "" when the fragment has no well-formed token. */
export function parseInviteToken(hash: string): string {
  const m = /token=([0-9a-f]{32,256})/i.exec(hash)
  return m ? m[1] : ""
}
