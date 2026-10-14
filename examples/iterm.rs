// Page 13: the three ways to iterate over a Vec, and how big the iterator value is.
use std::mem::size_of;

fn main() {
    let mut scores = vec![10, 20, 30];

    for s in scores.iter_mut() {
        *s += 1; // s: &mut i32, changes the element in the buffer
    }
    for s in scores.iter() {
        println!("{s}"); // s: &i32
    }
    for s in scores.into_iter() {
        let owned: i32 = s; // s: i32, moved out of the buffer
        println!("owned {owned}");
    }
    // println!("{:?}", scores); // would not compile: scores was moved (see afterinto.rs)

    println!("size_of::<std::slice::Iter<i32>>()    = {}", size_of::<std::slice::Iter<i32>>());
    println!("size_of::<std::slice::IterMut<i32>>() = {}", size_of::<std::slice::IterMut<i32>>());
    println!("size_of::<std::vec::IntoIter<i32>>()  = {}", size_of::<std::vec::IntoIter<i32>>());
}
