/// error-handling/src/main.rs
///
/// Error handling in Rust using enums and Result<T, E>.
///
/// This maps directly to CKB script development — every lock script
/// must return 0 for success or a non-zero error code for failure.
/// Rust's Result type makes it impossible to ignore an error case.
/// The compiler forces you to handle both outcomes explicitly.

/// Error codes for our capsule validator.
/// In a real CKB lock script these would be non-zero exit codes
/// returned to the VM. Each variant maps to a specific failure
/// reason — never use a single generic error code in production.
#[derive(Debug)]
enum CapsuleError {
    EmptyMessage,
    MessageTooLong,
    MissingRecipient,
}

/// A minimal capsule structure — just the fields we need to validate.
struct Capsule {
    to: String,
    message: String,
}

/// Validates a capsule before it goes on-chain.
/// Returns Ok(()) if valid, or Err(CapsuleError) describing exactly
/// what failed. The caller is forced by the compiler to handle both.
///
/// Security note: validate all inputs before processing them.
/// In a CKB script, args and witness data are user-supplied —
/// treat them as hostile until proven valid.
fn validate_capsule(capsule: &Capsule) -> Result<(), CapsuleError> {
    if capsule.to.is_empty() {
        return Err(CapsuleError::MissingRecipient);
    }

    if capsule.message.is_empty() {
        return Err(CapsuleError::EmptyMessage);
    }

    // 280 bytes is a reasonable on-chain message limit —
    // every byte costs capacity in CKB
    if capsule.message.len() > 280 {
        return Err(CapsuleError::MessageTooLong);
    }

    Ok(())
}

fn main() {
    let capsules = vec![
        Capsule {
            to: String::from("Future Linet"),
            message: String::from("You shipped the time capsule. Keep going."),
        },
        Capsule {
            to: String::from(""),
            message: String::from("This one has no recipient."),
        },
        Capsule {
            to: String::from("Future Linet"),
            message: String::from(""),
        },
    ];

    for capsule in &capsules {
        match validate_capsule(capsule) {
            Ok(()) => {
                println!("✓ Valid — sealed for: {}", capsule.to);
            }
            Err(CapsuleError::MissingRecipient) => {
                println!("✗ Error code 1: missing recipient");
            }
            Err(CapsuleError::EmptyMessage) => {
                println!("✗ Error code 2: empty message");
            }
            Err(CapsuleError::MessageTooLong) => {
                println!("✗ Error code 3: message exceeds 280 bytes");
            }
        }
    }
}
