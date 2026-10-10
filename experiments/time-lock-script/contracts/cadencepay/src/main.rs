#![no_std]
#![no_main]

use ckb_std::{
    ckb_constants::Source,
    ckb_types::{bytes::Bytes, prelude::*},
    default_alloc, entry,
    error::SysError,
    high_level::{
        load_cell_capacity, load_cell_data, load_cell_lock, load_cell_lock_hash,
        load_cell_occupied_capacity, load_cell_type, load_header, load_script, load_script_hash,
        QueryIter,
    },
    type_id::validate_type_id,
};

entry!(program_entry);
default_alloc!();

/// CadencePay Subscription Cell — v3
///
/// Lock:  Input Type Proxy Lock, args = hash of this cell's own type script.
///        The lock always passes when this cell is spent, so THIS type
///        script is the only authority over every spend.
///
/// Type args (64 bytes):
///   [0..32]  type_id               — unique, unforgeable subscription id
///   [32..64] subscriber_lock_hash  — whose consent create/top-up/cancel need
///
/// Data (exactly 56 bytes):
///   [0..32]  recipient_lock_hash   — who receives each payment
///   [32..40] amount_per_interval   — shannons per claim (u64 LE)
///   [40..48] interval_blocks       — blocks between claims (u64 LE)
///   [48..56] next_claim_block      — earliest block of the next claim (u64 LE)
///
/// Modes, chosen by the shape of the script group:
///   0 → 1  create   subscriber input present, Type ID, terms valid
///   1 → 1  claim    anyone; header ≥ next_claim, pays exactly `amount`
///                   to the recipient, next_claim += interval
///   1 → 1  top-up   subscriber input present, capacity grows, data unchanged
///   1 → 0  cancel   subscriber input present, remaining CKB refunded
///   1 → 0  close    anyone, only when balance < amount; all CKB refunded
const ARGS_SIZE: usize = 64;
const DATA_SIZE: usize = 56;
const MIN_INTERVAL_BLOCKS: u64 = 100;
/// Most a cancel tx may spend on fees out of the subscription itself (0.01 CKB)
const MAX_CANCEL_FEE: u64 = 1_000_000;
/// Data hash of Input Type Proxy Lock (ckb-devrel/ckb-proxy-locks),
/// testnet cellDep 0xb4f171c9…7b93 index 1, referenced with hash_type data1.
const INPUT_TYPE_PROXY_LOCK_CODE_HASH: [u8; 32] = [
    0x51, 0x23, 0x90, 0x89, 0x65, 0xc7, 0x11, 0xb0,
    0xff, 0xd8, 0xae, 0xc6, 0x42, 0xf1, 0xed, 0xe3,
    0x29, 0x64, 0x9b, 0xda, 0x1e, 0xbd, 0xca, 0x6b,
    0xd2, 0x41, 0x24, 0xd3, 0x79, 0x6f, 0x76, 0x8a,
];
const HASH_TYPE_DATA1: u8 = 2;

#[repr(i8)]
enum Error {
    InvalidArgs           = 1,
    InvalidDataSize       = 2,
    InvalidGroupShape     = 3,
    TypeIdInvalid         = 4,
    NoHeader              = 5,
    ClaimTooEarly         = 6,
    ScheduleNotAdvanced   = 7,
    FieldsChanged         = 8,
    LockChanged           = 9,
    CapacityMismatch      = 10,
    PayoutMissing         = 11,
    MultipleSubscriptions = 12,
    SubscriberAuthMissing = 13,
    RefundMissing         = 14,
    InvalidTerms          = 15,
    WrongLock             = 16,
    InsufficientCapacity  = 17,
    Overflow              = 18,
    BalanceSufficient     = 19,
    InvalidStart          = 20,
    Syscall               = 30,
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

struct Terms {
    recipient: [u8; 32],
    amount: u64,
    interval: u64,
    next_claim: u64,
}

fn parse_terms(data: &[u8]) -> Result<Terms, Error> {
    if data.len() != DATA_SIZE {
        return Err(Error::InvalidDataSize);
    }
    let u64_at = |at: usize| {
        let mut buf = [0u8; 8];
        buf.copy_from_slice(&data[at..at + 8]);
        u64::from_le_bytes(buf)
    };
    let mut recipient = [0u8; 32];
    recipient.copy_from_slice(&data[0..32]);
    Ok(Terms {
        recipient,
        amount: u64_at(32),
        interval: u64_at(40),
        next_claim: u64_at(48),
    })
}

fn group_count(source: Source) -> usize {
    QueryIter::new(load_cell_capacity, source).count()
}

fn header_number() -> Result<u64, Error> {
    let header = load_header(0, Source::HeaderDep).map_err(|_| Error::NoHeader)?;
    Ok(header.raw().number().unpack())
}

fn has_input_with_lock(lock_hash: &[u8]) -> bool {
    QueryIter::new(load_cell_lock_hash, Source::Input).any(|h| h[..] == lock_hash[..])
}

/// Capacity flowing TO `lock_hash` in this tx: outputs minus inputs.
/// Netting stops someone counting the receiver's own recycled cell as a payment.
fn net_received(lock_hash: &[u8]) -> Result<i128, Error> {
    let mut net: i128 = 0;
    for (i, h) in QueryIter::new(load_cell_lock_hash, Source::Output).enumerate() {
        if h[..] == lock_hash[..] {
            net += load_cell_capacity(i, Source::Output)? as i128;
        }
    }
    for (i, h) in QueryIter::new(load_cell_lock_hash, Source::Input).enumerate() {
        if h[..] == lock_hash[..] {
            net -= load_cell_capacity(i, Source::Input)? as i128;
        }
    }
    Ok(net)
}

/// Spending modes allow exactly one CadencePay cell (any subscription) in the
/// inputs, so two subscriptions can never share one payout or refund output.
fn single_cadencepay_input() -> Result<(), Error> {
    let script = load_script()?;
    let count = QueryIter::new(load_cell_type, Source::Input)
        .filter(|t| match t {
            Some(t) => t.code_hash() == script.code_hash() && t.hash_type() == script.hash_type(),
            None => false,
        })
        .count();
    if count == 1 { Ok(()) } else { Err(Error::MultipleSubscriptions) }
}

fn verify() -> Result<(), Error> {
    let args: Bytes = load_script()?.args().unpack();
    if args.len() != ARGS_SIZE {
        return Err(Error::InvalidArgs);
    }
    let subscriber = &args[32..64];

    let shape = (group_count(Source::GroupInput), group_count(Source::GroupOutput));
    if !matches!(shape, (0, 1) | (1, 1) | (1, 0)) {
        return Err(Error::InvalidGroupShape);
    }
    validate_type_id(&args[0..32]).map_err(|_| Error::TypeIdInvalid)?;

    match shape {
        (0, 1) => create(subscriber),
        (1, 1) => update(subscriber),
        _ => end(subscriber),
    }
}

fn create(subscriber: &[u8]) -> Result<(), Error> {
    let terms = parse_terms(&load_cell_data(0, Source::GroupOutput)?)?;
    if terms.amount == 0 || terms.interval < MIN_INTERVAL_BLOCKS || terms.recipient == [0u8; 32] {
        return Err(Error::InvalidTerms);
    }
    terms.next_claim.checked_add(terms.interval).ok_or(Error::Overflow)?;
    // No backdated schedules: the first claim cannot be earlier than "now"
    if terms.next_claim < header_number()? {
        return Err(Error::InvalidStart);
    }

    let lock = load_cell_lock(0, Source::GroupOutput)?;
    let hash_type: u8 = lock.hash_type().into();
    let lock_args: Bytes = lock.args().unpack();
    if lock.code_hash().as_slice() != INPUT_TYPE_PROXY_LOCK_CODE_HASH
        || hash_type != HASH_TYPE_DATA1
        || lock_args[..] != load_script_hash()?[..]
    {
        return Err(Error::WrongLock);
    }

    let capacity = load_cell_capacity(0, Source::GroupOutput)?;
    let occupied = load_cell_occupied_capacity(0, Source::GroupOutput)?;
    let needed = occupied.checked_add(terms.amount).ok_or(Error::Overflow)?;
    if capacity < needed {
        return Err(Error::InsufficientCapacity);
    }

    if !has_input_with_lock(subscriber) {
        return Err(Error::SubscriberAuthMissing);
    }
    Ok(())
}

fn update(subscriber: &[u8]) -> Result<(), Error> {
    let in_data = load_cell_data(0, Source::GroupInput)?;
    let out_data = load_cell_data(0, Source::GroupOutput)?;
    let before = parse_terms(&in_data)?;
    let after = parse_terms(&out_data)?;

    if load_cell_lock_hash(0, Source::GroupInput)? != load_cell_lock_hash(0, Source::GroupOutput)? {
        return Err(Error::LockChanged);
    }
    single_cadencepay_input()?;

    let in_cap = load_cell_capacity(0, Source::GroupInput)?;
    let out_cap = load_cell_capacity(0, Source::GroupOutput)?;

    // ── Top-up: only the subscriber adds funds; terms untouched ──
    if out_cap > in_cap {
        if in_data != out_data {
            return Err(Error::FieldsChanged);
        }
        if !has_input_with_lock(subscriber) {
            return Err(Error::SubscriberAuthMissing);
        }
        return Ok(());
    }

    // ── Claim: permissionless, one period per tx ──
    if after.recipient != before.recipient
        || after.amount != before.amount
        || after.interval != before.interval
    {
        return Err(Error::FieldsChanged);
    }
    if header_number()? < before.next_claim {
        return Err(Error::ClaimTooEarly);
    }
    let next = before.next_claim.checked_add(before.interval).ok_or(Error::Overflow)?;
    if after.next_claim != next {
        return Err(Error::ScheduleNotAdvanced);
    }

    let occupied = load_cell_occupied_capacity(0, Source::GroupInput)?;
    let remaining = in_cap.checked_sub(before.amount).ok_or(Error::InsufficientCapacity)?;
    if remaining < occupied {
        return Err(Error::InsufficientCapacity);
    }
    if out_cap != remaining {
        return Err(Error::CapacityMismatch);
    }

    if net_received(&before.recipient)? < before.amount as i128 {
        return Err(Error::PayoutMissing);
    }
    Ok(())
}

fn end(subscriber: &[u8]) -> Result<(), Error> {
    single_cadencepay_input()?;
    let terms = parse_terms(&load_cell_data(0, Source::GroupInput)?)?;
    let in_cap = load_cell_capacity(0, Source::GroupInput)? as i128;

    // ── Cancel: the subscriber may leave at any time ──
    if has_input_with_lock(subscriber) {
        if net_received(subscriber)? < in_cap - MAX_CANCEL_FEE as i128 {
            return Err(Error::RefundMissing);
        }
        return Ok(());
    }

    // ── Close: anyone may end a cell that can no longer fund a period ──
    let occupied = load_cell_occupied_capacity(0, Source::GroupInput)? as i128;
    if in_cap - occupied >= terms.amount as i128 {
        return Err(Error::BalanceSufficient);
    }
    if net_received(subscriber)? < in_cap {
        return Err(Error::RefundMissing);
    }
    Ok(())
}
