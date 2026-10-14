// Does not compile (E0597): `r` would outlive the value it refers to.
fn main() {
    let r;
    {
        let x = 5;
        r = &x;
    }
    println!("r: {r}");
}
