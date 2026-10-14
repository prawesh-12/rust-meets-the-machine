// Does not compile (E0382): into_iter() consumed `scores`.
fn main() {
    let scores = vec![10, 20, 30];
    for s in scores.into_iter() { println!("{s}"); }
    println!("{:?}", scores);
}
