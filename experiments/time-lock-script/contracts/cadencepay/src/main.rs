#![no_std]
#![no_main]

use ckb_std::{
    ckb_constants::Source,
    ckb_types::prelude::*,
    default_alloc, entry,
    high_level::{load_cell_data, load_cell_lock_hash, load_header, load_script},
};

entry!(program_entry);
default_alloc!();

/// CadencePay Subscription Cell — 56 bytes
///
/// [0..32]  recipient_lock_hash  — who receives payment
/// [32..40] amount_per_interval  — shannons per claim (u64 LE)
/// [40..48] interval_blocks      — blocks between valid claims (u64 LE)
/// [48..56] last_claimed_block   — block number of last claim (u64 LE)
///
/// Script args: [0..32] subscriber_lock_hash — owner who can cancel
const DATA_SIZE: usize = 56;

#[repr(i8)]
enum Error {
    InvalidDataSize       = 1,
    IntervalNotReached    = 2,
    NoHeader              = 3,
    InvalidOutputCell     = 4,
    LastClaimedNotUpdated = 5,
}

fn program_entry() -> i8 {
    match verify() {
        Ok(_)  => 0,
        Err(e) => e as i8,
    }
}

/// Owner mode: subscriber is cancelling — skip all validation
fn is_owner_mode() -> bool {
    let script = match load_script() {
        Ok(s)  => s,
        Err(_) => return false,
    };
    let args = script.args();
    let raw  = args.raw_data();
    if raw.len() < 32 { return false; }
    let subscriber_hash = &raw[..32];
    let mut i = 0;
    loop {
        match load_cell_lock_hash(i, Source::Input) {
            Ok(hash) => {
                if hash.as_slice() == subscriber_hash { return true; }
                i += 1;
            }
            Err(_) => return false,
        }
    }
}

fn parse_data(data: &[u8]) -> Result<(u64, u64, u64), Error> {
    if data.len() < DATA_SIZE { return Err(Error::InvalidDataSize); }
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
    // Owner mode — subscriber is cancelling
    if is_owner_mode() {
        return Ok(());
    }

    // Try to load input subscription cell
    match load_cell_data(0, Source::GroupInput) {
        Err(_) => {
            // CREATION MODE — no existing subscription cell being consumed
            // Validate the new output cell is well-formed
            let out = load_cell_data(0, Source::GroupOutput)
                .map_err(|_| Error::InvalidOutputCell)?;
            if out.len() < DATA_SIZE {
                return Err(Error::InvalidDataSize);
            }
            // last_claimed_block must be 0 on creation
            let mut buf = [0u8; 8];
            buf.copy_from_slice(&out[48..56]);
            if u64::from_le_bytes(buf) != 0 {
                return Err(Error::LastClaimedNotUpdated);
            }
            Ok(())
        }

        Ok(input_data) => {
            // CLAIM MODE — enforce interval and output structure
            let (_amount, interval, last_claimed) = parse_data(&input_data)?;

            let header = load_header(0, Source::HeaderDep)
                .map_err(|_| Error::NoHeader)?;
            let current_block: u64 = header.raw().number().unpack();

            if current_block < last_claimed + interval {
                return Err(Error::IntervalNotReached);
            }

            let output_data = load_cell_data(0, Source::GroupOutput)
                .map_err(|_| Error::InvalidOutputCell)?;
            if output_data.len() < DATA_SIZE {
                return Err(Error::InvalidOutputCell);
            }

            // recipient, amount, interval must be unchanged
            if output_data[..48] != input_data[..48] {
                return Err(Error::InvalidOutputCell);
            }

            // last_claimed_block must update to current block
            let mut buf = [0u8; 8];
            buf.copy_from_slice(&output_data[48..56]);
            if u64::from_le_bytes(buf) != current_block {
                return Err(Error::LastClaimedNotUpdated);
            }

            Ok(())
        }
    }
}
