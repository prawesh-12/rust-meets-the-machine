// Page 11: what a move, a copy and a clone do to the bytes, and the order of drops.
struct Noisy(&'static str);

impl Drop for Noisy {
    fn drop(&mut self) {
        println!("drop {}", self.0);
    }
}

fn main() {
    let n = 5;
    let m = n; // i32 is Copy: both stay usable
    println!("n={n} m={m}");

    let a = String::from("hi");
    let a_buf = a.as_ptr();
    let b = a; // move: the handle is copied, the buffer is not
    println!("a's buffer was at {a_buf:p}; b's buffer is at {:p}", b.as_ptr());
    let c = b.clone(); // clone: a second buffer with the same bytes
    println!("c's buffer is at {:p}", c.as_ptr());

    let _first = Noisy("first");
    let second = Noisy("second");
    let _third = Noisy("third");
    let _kept = second; // moved: dropped once, as _kept, not as `second`
    println!("end of main");
}
