/// ownership-basics/src/main.rs
///
///Rust ownership explored through a concept that maps directly to CKB script development:
/// verifying that value exists, is valid, and can only be used once
///
/// In a CKB lock script, you do exactly this with witness data -
/// load it, validate it, consume it. Rust's ownership model makes double spending a value a compile rror not a runtime bug.

fn main() {
//ownership: message is owned by this scope
// Only one owner at a time - like a live cell in CKB.

   let message = String::from("Sealed by Linet");
   
   let length = get_length(&message);
   
   println!("Length:{} ", length);
   
   // Try uncommenting this line and running cargo build.
    // The compiler will refuse — message was moved.
    // This is Rust preventing you from using consumed data.
   println!("{}", message);
}

/// Takes ownership of a String and returns its length.
/// The String is dropped (freed) when this function returns
/// unless ownership is explicitly returned to the caller.
fn get_length(s: &String) -> usize {
    s.len()
    // s goes out of scope here and is dropped.
    // No garbage collector needed — the compiler knows exactly
    // when this memory is no longer reachable.
}
