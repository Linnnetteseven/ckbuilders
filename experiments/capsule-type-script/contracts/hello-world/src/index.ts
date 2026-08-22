import * as bindings from '@ckb-js-std/bindings';
import { SOURCE_GROUP_OUTPUT, TextDecoder } from '@ckb-js-std/bindings';
import { log } from '@ckb-js-std/core';

// Error codes — same as your Rust capsule-validator.
// Non-zero exit = transaction rejected. 0 = accepted.
// This is the contract between your script and the CKB-VM.
const ERROR_NO_DATA = 1;
const ERROR_INVALID_UTF8 = 2;
const ERROR_INVALID_JSON = 3;
const ERROR_EMPTY_MESSAGE = 4;
const ERROR_EMPTY_RECIPIENT = 5;
const ERROR_MISSING_OPEN_DATE = 6;
const ERROR_MESSAGE_TOO_LONG = 7;

interface CapsuleData {
  message: string;
  recipient: string;
  open_date: string;
  sealed_at: string;
}

function validateCapsule(data: CapsuleData): number {
  if (!data.message || data.message.trim() === '') return ERROR_EMPTY_MESSAGE;
  if (data.message.length > 500) return ERROR_MESSAGE_TOO_LONG;
  if (!data.recipient || data.recipient.trim() === '') return ERROR_EMPTY_RECIPIENT;
  if (!data.open_date || data.open_date.trim() === '') return ERROR_MISSING_OPEN_DATE;
  return 0;
}

function main(): number {
  log.setLevel(log.LogLevel.Debug);

  // Read raw bytes from the first output cell that has this script attached.
  // SOURCE_GROUP_OUTPUT means: only look at outputs tagged with THIS script.
  // This is how a Type Script scopes itself — it only sees its own cells.
  let rawData: ArrayBuffer;
  try {
    rawData = bindings.loadCellData(0, SOURCE_GROUP_OUTPUT);
  } catch (e) {
    log.debug(`Failed to load cell data: ${e}`);
    return ERROR_NO_DATA;
  }

  if (!rawData || rawData.byteLength === 0) {
    log.debug('Cell data is empty');
    return ERROR_NO_DATA;
  }

  // Convert raw bytes to a string.
  // TextDecoder is available in the CKB JS VM.
  let jsonStr: string;
  try {
    jsonStr = new TextDecoder().decode(new Uint8Array(rawData));
  } catch (e) {
    log.debug(`Cell data is not valid UTF-8: ${e}`);
    return ERROR_INVALID_UTF8;
  }

  log.debug(`Cell data: ${jsonStr}`);

  // Parse JSON — same step as serde_json::from_str in your Rust version.
  let capsule: CapsuleData;
  try {
    capsule = JSON.parse(jsonStr) as CapsuleData;
  } catch (e) {
    log.debug(`Invalid JSON: ${e}`);
    return ERROR_INVALID_JSON;
  }

  // Run validation — same logic as validate() in your Rust impl block.
  const result = validateCapsule(capsule);
  if (result !== 0) {
    log.debug(`Validation failed with error code: ${result}`);
    return result;
  }

  log.debug(`Capsule valid — recipient: ${capsule.recipient}, opens: ${capsule.open_date}`);
  return 0;
}

bindings.exit(main());

