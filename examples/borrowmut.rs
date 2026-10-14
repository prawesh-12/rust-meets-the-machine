// Does not compile (E0502): push may reallocate while `first` still borrows the buffer.
fn main() {
    let mut scores = vec![10, 20];
    let first = &scores[0];
    scores.push(30);
    println!("{first}");
}
