/**
 * app.ts — CKB Time Capsule: UI and event handling
 *
 * Connects the HTML interface to the on-chain logic in lib.ts.
 * Runs against devnet by default. Switch NETWORK=testnet to use
 * the public testnet (requires funded testnet address).
 */

import { ccc } from "@ckb-ccc/core";
import { sealCapsule, retrieveCapsule, isCapsuleReady, CapsuleData } from "./lib";

// Use devnet by default — override with NETWORK env var at build time
const NETWORK = process.env.NETWORK ?? "devnet";

function buildClient(): ccc.Client {
  if (NETWORK === "testnet") return new ccc.ClientPublicTestnet();
  // Devnet runs locally via offckb node
  return new ccc.ClientPublicTestnet("http://localhost:8114");
}

const client = buildClient();

// ── Seal form ────────────────────────────────────────────────────────────────

const sealForm = document.getElementById("seal-form") as HTMLElement;
const sealStatus = document.getElementById("seal-status") as HTMLElement;
const capsuleResult = document.getElementById("capsule-result") as HTMLElement;
const capsuleHash = document.getElementById("capsule-hash") as HTMLElement;

sealForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const privateKey = (document.getElementById("private-key") as HTMLInputElement).value.trim();
  const to = (document.getElementById("to") as HTMLInputElement).value.trim();
  const from = (document.getElementById("from") as HTMLInputElement).value.trim();
  const message = (document.getElementById("message") as HTMLTextAreaElement).value.trim();
  const openDate = (document.getElementById("open-date") as HTMLInputElement).value;

  if (!privateKey || !to || !from || !message || !openDate) {
    showStatus(sealStatus, "All fields are required.", "error");
    return;
  }

  const capsule: CapsuleData = {
    to,
    from,
    message,
    openDate,
    sealedAt: new Date().toISOString().split("T")[0],
  };

  showStatus(sealStatus, "Sealing capsule on-chain...", "pending");

  try {
    const txHash = await sealCapsule(capsule, privateKey, client);
    capsuleHash.textContent = txHash;
    capsuleResult.classList.remove("hidden");
    showStatus(sealStatus, "Capsule sealed successfully.", "success");
  } catch (err) {
    showStatus(sealStatus, `Failed: ${(err as Error).message}`, "error");
  }
});

// ── Read form ────────────────────────────────────────────────────────────────

const readForm = document.getElementById("read-form") as HTMLElement;
const readStatus = document.getElementById("read-status") as HTMLElement;
const capsuleDisplay = document.getElementById("capsule-display") as HTMLElement;

readForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const txHash = (document.getElementById("tx-hash") as HTMLInputElement).value.trim();

  if (!txHash.startsWith("0x")) {
    showStatus(readStatus, "Enter a valid 0x-prefixed transaction hash.", "error");
    return;
  }

  showStatus(readStatus, "Retrieving capsule from chain...", "pending");
  capsuleDisplay.classList.add("hidden");

  try {
    const capsule = await retrieveCapsule(txHash, client);

    if (!capsule) {
      showStatus(readStatus, "No capsule found at this transaction hash.", "error");
      return;
    }

    renderCapsule(capsule);
    showStatus(readStatus, "", "");
  } catch (err) {
    showStatus(readStatus, `Failed: ${(err as Error).message}`, "error");
  }
});

function renderCapsule(capsule: CapsuleData): void {
  const ready = isCapsuleReady(capsule);

  (document.getElementById("disp-to") as HTMLElement).textContent = capsule.to;
  (document.getElementById("disp-from") as HTMLElement).textContent = capsule.from;
  (document.getElementById("disp-sealed") as HTMLElement).textContent = capsule.sealedAt;
  (document.getElementById("disp-open-date") as HTMLElement).textContent = capsule.openDate;

  const msgEl = document.getElementById("disp-message") as HTMLElement;
  const lockedEl = document.getElementById("disp-locked") as HTMLElement;

  if (ready) {
    msgEl.textContent = capsule.message;
    msgEl.classList.remove("hidden");
    lockedEl.classList.add("hidden");
  } else {
    lockedEl.textContent = `This capsule opens on ${capsule.openDate}. Come back then.`;
    lockedEl.classList.remove("hidden");
    msgEl.classList.add("hidden");
  }

  capsuleDisplay.classList.remove("hidden");
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function showStatus(el: HTMLElement, msg: string, type: string): void {
  el.textContent = msg;
  el.className = "status";
  if (type) el.classList.add(type);
}
