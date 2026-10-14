// Does not compile (E0106): returns a reference to a local that is dropped.
fn dangle() -> &String {
    let s = String::from("hi");
    &s
}
fn main() { let r = dangle(); }
