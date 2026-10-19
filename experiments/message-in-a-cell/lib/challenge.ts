/** Signed by the sender before uploading an encrypted video or voice note; binds the exact file. */
export const CHALLENGE_TTL_MS = 10 * 60 * 1000;

export function uploadMessage(address: string, sha256Hex: string, issuedAt: number): string {
  return `Message in a Cell: upload an encrypted capsule file\nAddress: ${address}\nFile: sha256:${sha256Hex}\nIssued: ${new Date(issuedAt).toISOString()}`;
}
