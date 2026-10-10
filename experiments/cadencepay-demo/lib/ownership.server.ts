import "server-only";
import { ccc } from "@ckb-ccc/core";

export class OwnershipError extends Error {}

/**
 * Prove the caller controls `address`:
 *  1. the signature over the challenge is valid for the signer's key, and
 *  2. that key's lock (JoyID main key or secp256k1) IS the address's lock.
 * Step 2 matters: a valid signature from some other key proves nothing.
 */
export async function provenLock(
  client: ccc.Client,
  address: string,
  message: string,
  signature: ccc.Signature,
): Promise<ccc.Script> {
  if (!(await ccc.Signer.verifyMessage(message, signature))) {
    throw new OwnershipError("Signature does not verify");
  }
  const claimed = (await ccc.Address.fromString(address, client)).script;

  let derived: ccc.Script;
  if (signature.signType === ccc.SignerSignType.JoyId) {
    const { keyType, publicKey } = JSON.parse(signature.identity) as { keyType: string; publicKey: string };
    if (keyType !== "main_key") throw new OwnershipError("JoyID sub-keys are not supported yet; use your main key");
    // JoyID lock args = 0x0001 ‖ blake160(64-byte public key), verified against a real JoyID testnet tx
    const args = ccc.hexFrom(ccc.bytesConcat([0x00, 0x01], ccc.bytesFrom(ccc.hashCkb(ccc.hexFrom(publicKey))).slice(0, 20)));
    derived = await ccc.Script.fromKnownScript(client, ccc.KnownScript.JoyId, args);
  } else if (signature.signType === ccc.SignerSignType.CkbSecp256k1) {
    const args = ccc.hexFrom(ccc.bytesFrom(ccc.hashCkb(signature.identity)).slice(0, 20));
    derived = await ccc.Script.fromKnownScript(client, ccc.KnownScript.Secp256k1Blake160, args);
  } else {
    throw new OwnershipError("This wallet type is not supported for member posts yet");
  }

  if (!derived.eq(claimed)) throw new OwnershipError("The signing key does not own this address");
  return claimed;
}
