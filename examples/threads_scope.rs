use std::thread;
fn total(values: &Vec<i32>) -> i32 { let mut sum = 0; for v in values.iter() { sum += v; } sum }
fn main() {
    let scores = vec![10, 20, 30];
    thread::scope(|s| {
        let h = s.spawn(|| total(&scores));
        let a = total(&scores);
        let b = h.join().unwrap();
        println!("{a} {b}");
    });
}
