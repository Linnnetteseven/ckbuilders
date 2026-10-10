/** Shared by the browser (to sign) and /api/posts (to verify). */
export const CHALLENGE_TTL_MS = 10 * 60 * 1000;

export function challengeMessage(slug: string, address: string, issuedAt: number): string {
  return `CadencePay: show my member posts from ${slug}\nAddress: ${address}\nIssued: ${new Date(issuedAt).toISOString()}`;
}
