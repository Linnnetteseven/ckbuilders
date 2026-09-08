# CKB Weekly Report — Week 5
**Builder:** Linet Mugwanja  
**Period:** Aug 24 – Aug 30, 2026  
**Repo:** github.com/Linnnetteseven/ckbuilders

---

## What I Built

This week I built a time-lock lock script in Rust — a RISC-V program 
that controls when a CKB cell can be spent. At cell creation, the 
unlock timestamp is encoded as a little-endian u64 in the script args. 
When someone tries to spend the cell, the script reads a block header 
from header_deps and compares its timestamp against the unlock time. 
CKB validates block headers by consensus before any script runs, so 
the timestamp is trustworthy — old blocks have smaller timestamps and 
can't be used to fake "time has passed." The script exits 0 if the 
time has passed, or returns a named error code so failures are 
traceable on the Nervos error code registry.

---

## Architecture

### Args encoding
The unlock timestamp is set at cell creation — not at spend time. 
Nobody can change it after the cell exists. Format: 8 bytes, 
little-endian u64, milliseconds since UNIX epoch. Little-endian 
matches the native byte order of the RISC-V architecture CKB-VM runs 
on and is consistent with how the broader CKB ecosystem encodes raw 
args.

```
args[0..8] = unlock_timestamp_ms (u64, little-endian)
```

### Why no system clock — and how header_deps solves it

CKB scripts run inside a sandboxed RISC-V VM. There is no `Date.now()`, 
no `block.timestamp`, no system clock. A block header contains the 
timestamp of when it was mined. The CKB consensus layer validates 
block headers before any script runs — so a fake header is rejected 
before it ever reaches the script. This makes the time source more 
trustworthy than an in-script clock would be: it's a historical record 
the chain already committed to, not something the caller controls.

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | Unlock conditions met |
| 1 | Args missing or shorter than 8 bytes |
| 2 | Block timestamp is before unlock timestamp |
| 3 | No header_dep included — no time source |

---

## Core Logic

```rust
fn verify() -> Result<(), Error> {
    let script = load_script().map_err(|_| Error::Encoding)?;
    let args = script.args();
    let raw = args.raw_data();

    if raw.len() < 8 {
        return Err(Error::Encoding);
    }

    let mut buf = [0u8; 8];
    buf.copy_from_slice(&raw[..8]);
    let unlock_ms = u64::from_le_bytes(buf);

    let header = load_header(0, Source::HeaderDep)
        .map_err(|_| Error::NoHeader)?;
    let current_ms: u64 = header.raw().timestamp().unpack();

    if current_ms < unlock_ms {
        return Err(Error::TooEarly);
    }

    Ok(())
}
```

---
## Evidence

### 3 tests passing

![Tests passing](../experiments/time-lock-script/assets/Screenshot%20from%202026-08-30%2011-58-34.png)

### RISC-V binary compiled

![Build output](../experiments/time-lock-script/assets/Screenshot%20from%202026-08-30%2016-24-55.png)


---

## Test Results

```
test test_unlocks_after_timestamp     ... ok  (cycles: 20,388)
test test_rejects_before_timestamp    ... ok
test test_rejects_missing_header_dep  ... ok

test result: ok. 3 passed; 0 failed
```

**test_unlocks_after_timestamp** — unlock_ms set 60 seconds in the 
past, header timestamped to now. Script exits 0. Proves the happy 
path works.

**test_rejects_before_timestamp** — unlock_ms set 1 hour in the 
future, header timestamped to now. Script exits 2 (TooEarly). Proves 
you genuinely cannot unlock early.

**test_rejects_missing_header_dep** — no header_dep in the 
transaction. Script exits 3 (NoHeader). Proves the script does not 
operate without a verified time source.

20,388 cycles is roughly 75x cheaper than a standard secp256k1 
signature verification. The script does no cryptography — just memory 
reads and one integer comparison. This means it composes cheaply with 
a signature check when wired into the Time Capsule dApp.

---

## Security Observation

The script is correct but not maximally hardened. By design, miners 
have roughly ±30 seconds of wiggle room in the timestamps they set, 
within consensus rules. For a time capsule unlocking in days or months 
this is irrelevant. For second-level precision, combining this script 
with the `since` field (RFC 0017) would enforce the time constraint at 
two consensus levels instead of one — leaving the caller no flexibility 
at all.


---

## RFC Reading

- RFC 0022 (Header Deps): full read — focused on header_deps field 
  semantics and timestamp validation guarantees
- RFC 0017 (Since): overview pass — relevant to combining since + 
  header_deps for stronger time guarantees

---

## Next Week (W6)

- Deploy time-lock-script binary to devnet via offckb
- Wire the lock script to the Time Capsule dApp frontend
- Begin Molecule serialization for structured cell data
- Solidify CadencePay architecture — recurring payment protocol 
  using type scripts + header_deps
