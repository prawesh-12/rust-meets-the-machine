// Each call needs its own frame (the array is kept alive with black_box),
// so ten million nested calls need far more stack than a thread has.
fn depth(n: u64) -> u64 {
    let frame_data = [n as u8; 256];
    std::hint::black_box(&frame_data);
    if n == 0 { 0 } else { depth(n - 1) + frame_data[0] as u64 }
}

fn main() {
    println!("{}", depth(10_000_000));
}
