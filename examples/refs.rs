// Page 12: a reference is a small value holding an address.
use std::mem::size_of;

fn main() {
    let mut scores = vec![10, 20];

    // Shared borrows: any number at once, as long as nobody mutates.
    let r1 = &scores;
    let r2 = &scores;
    println!("r1 holds {:p} (the Vec handle), r2 holds {:p}", r1, r2);
    println!("&scores[0] holds {:p} (inside the heap buffer)", &scores[0]);
    println!("r1[0] + r2[1] = {}", r1[0] + r2[1]); // last use of r1 and r2

    // A mutable borrow: allowed now, because r1 and r2 are no longer used.
    let m = &mut scores;
    m.push(30);
    println!("{:?}", scores);

    println!("size_of::<&Vec<i32>>() = {}", size_of::<&Vec<i32>>());
    println!("size_of::<&[i32]>()    = {}", size_of::<&[i32]>());
    println!("size_of::<&str>()      = {}", size_of::<&str>());
}
