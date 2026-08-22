use serde::Deserialize;
use std::env;
use std::fmt;
use std::process;

#[derive(Debug, Deserialize)]
struct CapsuleData {
    message: String,
    recipient: String,
    open_date: String,
    sealed_at: String,
}

// Display trait — defines how to print a ValidationError as a readable string.
// This is your first trait implementation. A trait is a shared interface:
// any type that implements Display can be printed with {} in format strings.
// You're telling Rust: "when someone prints a ValidationError, here's what to show."
#[derive(Debug)]
enum ValidationError {
    EmptyMessage,
    EmptyRecipient,
    MessageTooLong,
    MissingOpenDate,
    InvalidJson(String),
    MissingInput,
}

impl fmt::Display for ValidationError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            ValidationError::EmptyMessage =>
                write!(f, "Error [1]: message cannot be empty"),
            ValidationError::EmptyRecipient =>
                write!(f, "Error [2]: recipient cannot be empty"),
            ValidationError::MessageTooLong =>
                write!(f, "Error [3]: message exceeds 500 characters"),
            ValidationError::MissingOpenDate =>
                write!(f, "Error [4]: open_date is missing"),
            ValidationError::InvalidJson(e) =>
                write!(f, "Error [5]: invalid JSON — {}", e),
            ValidationError::MissingInput =>
                write!(f, "Usage: capsule-validator '<json>'"),
        }
    }
}

// Display for CapsuleData — prints a human-readable summary of a valid capsule.
// Same trait, different type. This is how traits work: one interface, many implementations.
impl fmt::Display for CapsuleData {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(
            f,
            "✅ Capsule valid\n   To:      {}\n   Opens:   {}\n   Message: {} chars\n   Sealed:  {}",
            self.recipient,
            self.open_date,
            self.message.len(),
            self.sealed_at
        )
    }
}

impl CapsuleData {
    // Associated function — parses raw JSON into a CapsuleData struct.
    // from_json is not a method on an existing instance (no &self).
    // It's called as CapsuleData::from_json(...), like a static method in JS.
    fn from_json(json: &str) -> Result<Self, ValidationError> {
        serde_json::from_str(json)
            .map_err(|e| ValidationError::InvalidJson(e.to_string()))
    }

    fn validate(&self) -> Result<(), ValidationError> {
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
        Ok(())
    }
}

fn main() {
    let args: Vec<String> = env::args().collect();

    // args[0] is always the program name. args[1] is the first real argument.
    if args.len() < 2 {
        eprintln!("{}", ValidationError::MissingInput);
        process::exit(1);
    }

    let json_input = &args[1];

    // Nested match — first check if JSON is parseable, then validate the data.
    // This mirrors exactly how a CKB Type Script works:
    // read cell data → parse it → validate it → exit 0 or exit with error code.
    match CapsuleData::from_json(json_input) {
        Err(e) => {
            eprintln!("{}", e);
            process::exit(1);
        }
        Ok(capsule) => match capsule.validate() {
            Err(e) => {
                eprintln!("{}", e);
                process::exit(1);
            }
            Ok(()) => {
                println!("{}", capsule);
                process::exit(0);
            }
        },
    }
}

// Unit tests — run with: cargo test
// These live in the same file, compiled only during testing.
// #[cfg(test)] tells the compiler: only include this block when running tests.
#[cfg(test)]
mod tests {
    use super::*;

    fn valid_json() -> &'static str {
        r#"{"message":"Hello future me!","recipient":"Linnette","open_date":"2027-01-01","sealed_at":"2026-08-12"}"#
    }

    #[test]
    fn test_valid_capsule() {
        let capsule = CapsuleData::from_json(valid_json()).unwrap();
        assert!(capsule.validate().is_ok());
    }

    #[test]
    fn test_empty_message() {
        let json = r#"{"message":"","recipient":"Linnette","open_date":"2027-01-01","sealed_at":"2026-08-12"}"#;
        let capsule = CapsuleData::from_json(json).unwrap();
        assert!(matches!(capsule.validate(), Err(ValidationError::EmptyMessage)));
    }

    #[test]
    fn test_message_too_long() {
        let long = "a".repeat(501);
        let json = format!(
            r#"{{"message":"{}","recipient":"Linnette","open_date":"2027-01-01","sealed_at":"2026-08-12"}}"#,
            long
        );
        let capsule = CapsuleData::from_json(&json).unwrap();
        assert!(matches!(capsule.validate(), Err(ValidationError::MessageTooLong)));
    }

    #[test]
    fn test_empty_recipient() {
        let json = r#"{"message":"Hello!","recipient":"","open_date":"2027-01-01","sealed_at":"2026-08-12"}"#;
        let capsule = CapsuleData::from_json(json).unwrap();
        assert!(matches!(capsule.validate(), Err(ValidationError::EmptyRecipient)));
    }

    #[test]
    fn test_invalid_json() {
        let result = CapsuleData::from_json("not json");
        assert!(matches!(result, Err(ValidationError::InvalidJson(_))));
    }
}
