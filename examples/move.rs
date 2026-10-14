// Does not compile (E0382): `a` is used after its value moved to `b`.
fn main() {
    let a = String::from("hi");
    let b = a;
    println!("{a}");
}
