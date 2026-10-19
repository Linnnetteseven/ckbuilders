#![no_std]
#![no_main]

use ckb_std::{
    ckb_constants::Source,
    ckb_types::{bytes::Bytes, prelude::*},
    default_alloc, entry,
    error::SysError,
    high_level::{
        QueryIter, load_cell_capacity, load_cell_data, load_cell_lock_hash, load_script,
        load_witness_args,
    },
    type_id::validate_type_id,
};
use blake2b_ref::Blake2bBuilder;

entry!(program_entry);
default_alloc!();

/// Climate Black Box: Evidence Ledger (type script)
///
/// One ledger cell per project, identified by Type ID. It holds a running
/// commitment to the project's whole evidence history, and this script
/// recomputes that commitment itself, so the history is append-only and
/// cannot fork, skip, reorder or be deleted.
///
/// Type args (64 bytes):
///   [0..32]  type_id                — the project's ledger identity
///   [32..64] recorder_lock_hash     — the only wallet allowed to append
///
/// Data (exactly 48 bytes):
///   [0..8]   seq          u64 LE    — number of events recorded
///   [8..40]  head         [32]      — running commitment, see below
///   [40..44] last_period  u32 LE    — latest observed month, YYYYMM
///   [44..46] open_alerts  u16 LE    — alerts raised and not yet resolved
///   [46..48] reserved     must be 0
///
/// Appends carry their events in the ledger input's witness
/// (WitnessArgs.input_type), one 37-byte entry per event:
///   kind u8 ‖ period u32 LE ‖ manifest_sha256 [32]
/// and the script folds them in: head = blake2b(head ‖ entry), seq += 1.
///
/// Event kinds:
///   1 observation       period >= last_period; last_period = period
///   2 alert raised      period <= last_period (about an observed month); open_alerts += 1
///   3 alert resolved    open_alerts > 0; open_alerts -= 1
///   4 other             investigation, intervention, commitment: no state change
///
/// Modes, chosen by the shape of the script group:
///   0 → 1  create   Type ID, recorder input present, empty state
///   1 → 1  append   recorder input present, ≥ 1 event, state recomputed exactly
///   1 → 0  never    a ledger cannot be destroyed
const ARGS_SIZE: usize = 64;
const DATA_SIZE: usize = 48;
const ENTRY_SIZE: usize = 37;

#[repr(i8)]
enum Error {
    InvalidArgs = 1,
    InvalidDataSize = 2,
    InvalidGroupShape = 3,
    TypeIdInvalid = 4,
    RecorderMissing = 5,
    NotEmptyAtCreate = 6,
    NoEvents = 7,
    BadEntries = 8,
    UnknownKind = 9,
    PeriodWentBack = 10,
    AlertForUnobservedPeriod = 11,
    NoOpenAlert = 12,
    StateMismatch = 13,
    LockChanged = 14,
    CapacityChanged = 15,
    InvalidPeriod = 16,
    Overflow = 17,
    Syscall = 30,
}

impl From<SysError> for Error {
    fn from(_: SysError) -> Self {
        Error::Syscall
    }
}

fn program_entry() -> i8 {
    match verify() {
        Ok(()) => 0,
        Err(e) => e as i8,
    }
}

#[derive(PartialEq, Eq)]
struct State {
    seq: u64,
    head: [u8; 32],
    last_period: u32,
    open_alerts: u16,
}

fn parse_state(data: &[u8]) -> Result<State, Error> {
    if data.len() != DATA_SIZE || data[46] != 0 || data[47] != 0 {
        return Err(Error::InvalidDataSize);
    }
    let mut seq = [0u8; 8];
    seq.copy_from_slice(&data[0..8]);
    let mut head = [0u8; 32];
    head.copy_from_slice(&data[8..40]);
    let mut period = [0u8; 4];
    period.copy_from_slice(&data[40..44]);
    let mut open = [0u8; 2];
    open.copy_from_slice(&data[44..46]);
    Ok(State {
        seq: u64::from_le_bytes(seq),
        head,
        last_period: u32::from_le_bytes(period),
        open_alerts: u16::from_le_bytes(open),
    })
}

/// YYYYMM with a real month (0 is allowed only as "nothing observed yet")
fn valid_period(p: u32) -> bool {
    let month = p % 100;
    (1..=12).contains(&month) && p / 100 >= 1900
}

fn group_count(source: Source) -> usize {
    QueryIter::new(load_cell_capacity, source).count()
}

fn has_input_with_lock(lock_hash: &[u8]) -> bool {
    QueryIter::new(load_cell_lock_hash, Source::Input).any(|h| h[..] == lock_hash[..])
}

fn fold(head: &[u8; 32], entry: &[u8]) -> [u8; 32] {
    let mut out = [0u8; 32];
    let mut hasher = Blake2bBuilder::new(32).personal(b"ckb-default-hash").build();
    hasher.update(head);
    hasher.update(entry);
    hasher.finalize(&mut out);
    out
}

fn verify() -> Result<(), Error> {
    let args: Bytes = load_script()?.args().unpack();
    if args.len() != ARGS_SIZE {
        return Err(Error::InvalidArgs);
    }
    let recorder = &args[32..64];

    let shape = (group_count(Source::GroupInput), group_count(Source::GroupOutput));
    if !matches!(shape, (0, 1) | (1, 1)) {
        // 1 → 0 is deletion; anything else is not a single ledger
        return Err(Error::InvalidGroupShape);
    }
    validate_type_id(&args[0..32]).map_err(|_| Error::TypeIdInvalid)?;
    if !has_input_with_lock(recorder) {
        return Err(Error::RecorderMissing);
    }

    let after = parse_state(&load_cell_data(0, Source::GroupOutput)?)?;
    if shape == (0, 1) {
        if after.seq != 0 || after.head != [0u8; 32] || after.last_period != 0 || after.open_alerts != 0 {
            return Err(Error::NotEmptyAtCreate);
        }
        return Ok(());
    }

    // ── Append ──
    let before = parse_state(&load_cell_data(0, Source::GroupInput)?)?;
    if load_cell_lock_hash(0, Source::GroupInput)? != load_cell_lock_hash(0, Source::GroupOutput)? {
        return Err(Error::LockChanged);
    }
    // The ledger is a record, not a wallet: capacity stays put
    if load_cell_capacity(0, Source::GroupInput)? != load_cell_capacity(0, Source::GroupOutput)? {
        return Err(Error::CapacityChanged);
    }

    let witness = load_witness_args(0, Source::GroupInput).map_err(|_| Error::NoEvents)?;
    let entries: Bytes = match witness.input_type().to_opt() {
        Some(b) => b.unpack(),
        None => return Err(Error::NoEvents),
    };
    if entries.is_empty() {
        return Err(Error::NoEvents);
    }
    if entries.len() % ENTRY_SIZE != 0 {
        return Err(Error::BadEntries);
    }

    let mut state = State { seq: before.seq, head: before.head, last_period: before.last_period, open_alerts: before.open_alerts };
    for entry in entries.chunks(ENTRY_SIZE) {
        let kind = entry[0];
        let mut p = [0u8; 4];
        p.copy_from_slice(&entry[1..5]);
        let period = u32::from_le_bytes(p);
        if !valid_period(period) {
            return Err(Error::InvalidPeriod);
        }
        match kind {
            1 => {
                if period < state.last_period {
                    return Err(Error::PeriodWentBack);
                }
                state.last_period = period;
            }
            2 => {
                if state.last_period == 0 || period > state.last_period {
                    return Err(Error::AlertForUnobservedPeriod);
                }
                state.open_alerts = state.open_alerts.checked_add(1).ok_or(Error::Overflow)?;
            }
            3 => {
                state.open_alerts = state.open_alerts.checked_sub(1).ok_or(Error::NoOpenAlert)?;
            }
            4 => {}
            _ => return Err(Error::UnknownKind),
        }
        state.head = fold(&state.head, entry);
        state.seq = state.seq.checked_add(1).ok_or(Error::Overflow)?;
    }

    if state != after {
        return Err(Error::StateMismatch);
    }
    Ok(())
}
