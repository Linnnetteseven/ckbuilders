#![no_std]
#![no_main]

use ckb_std::{
    ckb_constants::Source,
    ckb_types::prelude::*,
    default_alloc, entry,
    high_level::{load_cell_data, load_header},
};

entry!(program_entry);
default_alloc!();

/// CadencePay Subscription Cell — 56 bytes
///
/// [0..32]  recipient_lock_hash  — who receives payment (32 bytes)
/// [32..40] amount_per_interval  — shannons per claim (u64 LE)
/// [40..48] interval_blocks      — blocks between valid claims (u64 LE)
/// [48..56] last_claimed_block   — block number of last claim (u64 LE)
const DATA_SIZE: usize = 56;

#[repr(i8)]
enum Error {
    /// Cell data is not 56 bytes
    InvalidDataSize       = 1,
    /// Interval has not elapsed since last claim
    IntervalNotReached    = 2,
    /// No header_dep provided — block number unverifiable  
    NoHeader              = 3,
    /// Output subscription cell missing or malformed
    InvalidOutputCell     = 4,
    /// last_claimed_block in output not updated to current block
    LastClaimedNotUpdated = 5,
}

fn program_entry() -> i8 {
    match verify() {
        Ok(_)  => 0,
        Err(e) => e as i8,
    }
}

/// Read (amount, interval, last_claimed) from raw cell data
fn parse_subscription(data: &[u8]) -> Result<(u64, u64, u64), Error> {
    if data.len() < DATA_SIZE {
        return Err(Error::InvalidDataSize);
    }
    let mut buf = [0u8; 8];

    buf.copy_from_slice(&data[32..40]);
    let amount = u64::from_le_bytes(buf);

    buf.copy_from_slice(&data[40..48]);
    let interval = u64::from_le_bytes(buf);

    buf.copy_from_slice(&data[48..56]);
    let last_claimed = u64::from_le_bytes(buf);

    Ok((amount, interval, last_claimed))
}

fn verify() -> Result<(), Error> {
    // Read the input subscription cell
    let input_data = load_cell_data(0, Source::GroupInput)
        .map_err(|_| Error::InvalidDataSize)?;

    let (_amount, interval, last_claimed) = parse_subscription(&input_data)?;

    // Trustless block number via header_deps (RFC 0022)
    // Same mechanism as time-lock-script — no system clock exists
    let header = load_header(0, Source::HeaderDep)
        .map_err(|_| Error::NoHeader)?;
    let current_block: u64 = header.raw().number().unpack();

    if current_block < last_claimed + interval {
        return Err(Error::IntervalNotReached);
    }

    // Output subscription cell must exist and be correctly updated
    let output_data = load_cell_data(0, Source::GroupOutput)
        .map_err(|_| Error::InvalidOutputCell)?;

    if output_data.len() < DATA_SIZE {
        return Err(Error::InvalidOutputCell);
    }

    // recipient, amount, interval must be unchanged — only last_claimed updates
    if output_data[..48] != input_data[..48] {
        return Err(Error::InvalidOutputCell);
    }

    // last_claimed_block in output must equal current block number
    let mut buf = [0u8; 8];
    buf.copy_from_slice(&output_data[48..56]);
    let output_last_claimed = u64::from_le_bytes(buf);

    if output_last_claimed != current_block {
        return Err(Error::LastClaimedNotUpdated);
    }

    Ok(())
}
