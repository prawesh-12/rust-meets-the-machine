fn main() {
    let v = vec![10, 20, 30];
    let i = std::env::args().count() + 9; // 10, not known at compile time
    println!("{:?}", v.get(i));
    println!("{}", v[i]);
}
