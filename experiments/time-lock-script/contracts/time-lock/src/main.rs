#![no_std]
#![no_main]

use ckb_std::{
    ckb_constants::Source,
    ckb_types::prelude::*,
    default_alloc, entry,
    high_level::{load_header, load_script},
};

entry!(program_entry);
default_alloc!();

/// Exit codes — documented so the caller knows exactly why a transaction failed
#[repr(i8)]
enum Error {
    /// Script args are missing or shorter than 8 bytes
    Encoding = 1,
    /// Current block timestamp is before the unlock timestamp
    TooEarly = 2,
    /// No header_dep provided — time source required
    NoHeader = 3,
}

fn program_entry() -> i8 {
    match verify() {
        Ok(_) => 0,
        Err(e) => e as i8,
    }
}

fn verify() -> Result<(), Error> {
    // Args: first 8 bytes = unlock timestamp in milliseconds, little-endian u64
    let script = load_script().map_err(|_| Error::Encoding)?;
    let args = script.args();
    let raw = args.raw_data();

    if raw.len() < 8 {
        return Err(Error::Encoding);
    }

    let mut buf = [0u8; 8];
    buf.copy_from_slice(&raw[..8]);
    let unlock_ms = u64::from_le_bytes(buf);

    // RFC 0022: the transaction must include a header_dep.
    // header_dep[0] is the block whose timestamp we treat as "now".
    // The CKB consensus layer guarantees this block exists and its hash is valid.
    let header = load_header(0, Source::HeaderDep).map_err(|_| Error::NoHeader)?;
    let current_ms: u64 = header.raw().timestamp().unpack();

    if current_ms < unlock_ms {
        return Err(Error::TooEarly);
    }

    Ok(())
}
