/** Shared by the browser (to sign) and /api/posts (to verify). */
export const CHALLENGE_TTL_MS = 10 * 60 * 1000;

export function challengeMessage(slug: string, address: string, issuedAt: number): string {
  return `CadencePay: show my member posts from ${slug}\nAddress: ${address}\nIssued: ${new Date(issuedAt).toISOString()}`;
}

/** Signed by a creator before uploading their display image; binds the exact file. */
export function uploadMessage(address: string, sha256Hex: string, issuedAt: number): string {
  return `CadencePay: upload my creator image\nAddress: ${address}\nFile: sha256:${sha256Hex}\nIssued: ${new Date(issuedAt).toISOString()}`;
}
