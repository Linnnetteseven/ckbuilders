use serde::Deserialize;

// Deserialize tells serde how to parse JSON into this struct.
// Debug lets us print it with {:?} during development.
#[derive(Debug, Deserialize)]
struct CapsuleData {
    message: String,
    recipient: String,
    open_date: String,
    sealed_at: String,
}

// Every possible reason a capsule can fail validation gets its own variant.
// This is the same pattern as your Week 2 error-handling experiment —
// except now it's guarding real data instead of a toy example.
#[derive(Debug)]
enum ValidationError {
    EmptyMessage,
    EmptyRecipient,
    MessageTooLong,
    MissingOpenDate,
}

// impl block — this is where you attach behaviour to a struct.
// Think of it like adding methods to a class, except the data and the
// behaviour are defined separately. Rust keeps them intentionally apart.
impl CapsuleData {
    fn validate(&self) -> Result<(), ValidationError> {
        // &self means: borrow this CapsuleData to read it.
        // We don't need to own it — just inspect it.
        // Same concept as your ownership-basics experiment: borrow, don't consume.

        if self.message.trim().is_empty() {
            return Err(ValidationError::EmptyMessage);
        }

        if self.message.len() > 500 {
            return Err(ValidationError::MessageTooLong);
        }

        if self.recipient.trim().is_empty() {
            return Err(ValidationError::EmptyRecipient);
        }

        if self.open_date.trim().is_empty() {
            return Err(ValidationError::MissingOpenDate);
        }

        Ok(()) // All checks passed. () is Rust's "nothing to return" type.
    }
}

fn main() {
    println!("capsule-validator ready");
}
