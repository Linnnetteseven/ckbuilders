#![no_std]
#![no_main]

/// Message in a Cell: capsule lock.
///
/// A capsule cell holds a sealed message plus CKB. This lock decides who may
/// open it and when. It never checks signatures itself: a path is authorised
/// when the transaction also spends a cell locked by the named wallet, so that
/// wallet's own lock (JoyID, secp256k1, a throwaway gift key...) does the
/// signature check. Time comes from each input's `since` field, which CKB
/// consensus enforces against the chain, so there is no header the spender
/// can pick.
///
/// Args (73 bytes):
///   [0]      mode: 0 = gift, 1 = legacy
///   [1..33]  sender_lock_hash
///   [33..65] recipient_lock_hash
///   [65..73] t: u64 LE, seconds
///
/// Gift (t = unlock time, Unix seconds):
///   recipient: their input present, every capsule input has an absolute
///              timestamp `since` >= t
///   sender:    reclaim only if still unopened: absolute timestamp
///              `since` >= t + 90 days
/// Legacy (t = inactivity window in seconds):
///   sender (owner): any time. Checking in = spending and re-creating the cell,
///                   which restarts the clock
///   recipient (beneficiary): relative timestamp `since` >= t, i.e. at least t
///                   seconds since the cell was created
///
/// The lock does not constrain outputs: whoever is authorised takes the CKB.
use ckb_std::{
    ckb_constants::Source,
    default_alloc, entry,
    error::SysError,
    high_level::{QueryIter, load_cell_lock_hash, load_input_since, load_script},
};

entry!(program_entry);
default_alloc!();

#[repr(i8)]
enum Error {
    /// Args are not exactly 73 bytes, or the mode is unknown
    InvalidArgs = 1,
    /// Neither the recipient's nor the sender's wallet is spending in this tx
    NotAuthorized = 2,
    /// Recipient is present but the unlock time (or inactivity window) hasn't been reached
    TooEarly = 3,
    /// Sender is present but the 90-day reclaim grace hasn't passed
    ReclaimTooEarly = 4,
    /// t + grace overflows
    Overflow = 5,
    /// A capsule input couldn't be read
    Syscall = 30,
}

const ARGS_LEN: usize = 73;
const MODE_GIFT: u8 = 0;
const MODE_LEGACY: u8 = 1;
/// Sender may reclaim an unopened gift this long after its unlock time
const RECLAIM_GRACE_SECS: u64 = 90 * 24 * 60 * 60;

// `since` layout (RFC 0017): bit 63 = relative, bits 61..62 = metric, low 56 bits = value
const SINCE_RELATIVE: u64 = 1 << 63;
const SINCE_METRIC_MASK: u64 = 0b11 << 61;
const SINCE_METRIC_TIMESTAMP: u64 = 0b10 << 61;
const SINCE_FLAGS_MASK: u64 = SINCE_RELATIVE | SINCE_METRIC_MASK;
const SINCE_VALUE_MASK: u64 = 0x00ff_ffff_ffff_ffff;
const ABSOLUTE_TIMESTAMP: u64 = SINCE_METRIC_TIMESTAMP;
const RELATIVE_TIMESTAMP: u64 = SINCE_RELATIVE | SINCE_METRIC_TIMESTAMP;

fn program_entry() -> i8 {
    match verify() {
        Ok(()) => 0,
        Err(e) => e as i8,
    }
}

fn has_input_with_lock(lock_hash: &[u8]) -> bool {
    QueryIter::new(load_cell_lock_hash, Source::Input).any(|h| h[..] == lock_hash[..])
}

/// Every capsule input in this group must carry a `since` of exactly this kind
/// (absolute/relative timestamp) with a value of at least `min`. Checking all
/// of them stops a second capsule with an empty `since` riding along.
fn all_since_at_least(kind: u64, min: u64) -> Result<bool, Error> {
    let mut i = 0;
    loop {
        match load_input_since(i, Source::GroupInput) {
            Ok(since) => {
                if since & SINCE_FLAGS_MASK != kind || since & SINCE_VALUE_MASK < min {
                    return Ok(false);
                }
            }
            Err(SysError::IndexOutOfBound) => return Ok(i > 0),
            Err(_) => return Err(Error::Syscall),
        }
        i += 1;
    }
}

fn verify() -> Result<(), Error> {
    let script = load_script().map_err(|_| Error::InvalidArgs)?;
    let args = script.args().raw_data();
    if args.len() != ARGS_LEN {
        return Err(Error::InvalidArgs);
    }
    let mode = args[0];
    let sender = &args[1..33];
    let recipient = &args[33..65];
    let mut t_bytes = [0u8; 8];
    t_bytes.copy_from_slice(&args[65..73]);
    let t = u64::from_le_bytes(t_bytes);

    let recipient_present = has_input_with_lock(recipient);
    let sender_present = has_input_with_lock(sender);

    match mode {
        MODE_GIFT => {
            if recipient_present && all_since_at_least(ABSOLUTE_TIMESTAMP, t)? {
                return Ok(());
            }
            if sender_present {
                let reclaim_at = t.checked_add(RECLAIM_GRACE_SECS).ok_or(Error::Overflow)?;
                if all_since_at_least(ABSOLUTE_TIMESTAMP, reclaim_at)? {
                    return Ok(());
                }
                if !recipient_present {
                    return Err(Error::ReclaimTooEarly);
                }
            }
        }
        MODE_LEGACY => {
            // The owner can always move their own savings
            if sender_present {
                return Ok(());
            }
            if recipient_present && all_since_at_least(RELATIVE_TIMESTAMP, t)? {
                return Ok(());
            }
        }
        _ => return Err(Error::InvalidArgs),
    }

    if recipient_present { Err(Error::TooEarly) } else { Err(Error::NotAuthorized) }
}
