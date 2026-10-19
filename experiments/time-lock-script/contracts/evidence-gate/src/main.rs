#![no_std]
#![no_main]

use ckb_std::{
    ckb_constants::Source,
    ckb_types::{bytes::Bytes, prelude::*},
    default_alloc, entry,
    error::SysError,
    high_level::{QueryIter, load_cell_data, load_cell_lock_hash, load_cell_type_hash, load_script},
};

entry!(program_entry);
default_alloc!();

/// Climate Black Box: Evidence Gate (lock script)
///
/// Funding streams through CadencePay unchanged: a donor's subscription pays
/// one tranche per period to a *gate* instead of straight to the project.
/// This lock decides who may spend each tranche, using the project's Evidence
/// Ledger, read as a cell dep. Consensus only accepts live cell deps, and the
/// ledger is unique (Type ID), so the gate always sees the current evidence.
///
///   project  may spend while the ledger shows no open alert
///   donor    may take it back while an alert is open
///
/// Authorisation is the owner-input pattern used across this workspace: the
/// tx must also spend a cell under the named lock, so that wallet's own lock
/// checks the signature.
///
/// Args (96 bytes):
///   [0..32]  ledger_type_hash   — the project's Evidence Ledger type script hash
///   [32..64] project_lock_hash
///   [64..96] donor_lock_hash
const ARGS_SIZE: usize = 96;
const LEDGER_DATA_SIZE: usize = 48;

#[repr(i8)]
enum Error {
    InvalidArgs = 1,
    LedgerMissing = 2,
    /// The project tried to withdraw while an alert is open
    AlertOpen = 3,
    /// The donor tried to take funds back with no alert open
    NoAlertOpen = 4,
    /// Neither the project's nor the donor's wallet is spending in this tx
    NotAuthorized = 5,
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

fn has_input_with_lock(lock_hash: &[u8]) -> bool {
    QueryIter::new(load_cell_lock_hash, Source::Input).any(|h| h[..] == lock_hash[..])
}

/// open_alerts from the ledger cell in the cell deps
fn open_alerts(ledger_type_hash: &[u8]) -> Result<u16, Error> {
    for (i, h) in QueryIter::new(load_cell_type_hash, Source::CellDep).enumerate() {
        if matches!(h, Some(h) if h[..] == ledger_type_hash[..]) {
            let d = load_cell_data(i, Source::CellDep)?;
            if d.len() != LEDGER_DATA_SIZE {
                return Err(Error::LedgerMissing);
            }
            return Ok(u16::from_le_bytes([d[44], d[45]]));
        }
    }
    Err(Error::LedgerMissing)
}

fn verify() -> Result<(), Error> {
    let args: Bytes = load_script()?.args().unpack();
    if args.len() != ARGS_SIZE {
        return Err(Error::InvalidArgs);
    }
    let (ledger, project, donor) = (&args[0..32], &args[32..64], &args[64..96]);

    let project_present = has_input_with_lock(project);
    let donor_present = has_input_with_lock(donor);
    if !project_present && !donor_present {
        return Err(Error::NotAuthorized);
    }
    let open = open_alerts(ledger)?;
    if project_present && open == 0 {
        return Ok(());
    }
    if donor_present && open > 0 {
        return Ok(());
    }
    if project_present { Err(Error::AlertOpen) } else { Err(Error::NoAlertOpen) }
}
