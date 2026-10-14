#[inline(never)]
fn compute(a: i32, b: i32) -> i32 {
    let x = a + b;
    x
}
fn main() { println!("{}", compute(std::hint::black_box(2), std::hint::black_box(3))); }
