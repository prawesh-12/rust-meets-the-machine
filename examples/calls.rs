// Page 08: nested calls on one thread's stack.
// Debug build: every call gets its own frame. Optimised build: see OUTPUT.txt.
fn add(a: i32, b: i32) -> i32 {
    a + b
}

fn average(x: i32, y: i32) -> i32 {
    let s = add(x, y);
    s / 2
}

fn main() {
    let x = std::hint::black_box(13);
    let m = average(x, 7);
    println!("{m}");
}
