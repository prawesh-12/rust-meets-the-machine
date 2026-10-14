// Page 10: what a Vec and a String hold, and what push does to the buffer.
// Addresses differ on every run; whether the buffer moves depends on the allocator.
fn main() {
    let mut v = vec![10, 20];
    println!("len={} cap={} buffer at {:p}", v.len(), v.capacity(), v.as_ptr());
    v.push(30);
    println!("len={} cap={} buffer at {:p}", v.len(), v.capacity(), v.as_ptr());
    v.push(40);
    println!("len={} cap={} buffer at {:p}", v.len(), v.capacity(), v.as_ptr());

    // Same pushes, but another allocation is made right after the buffer,
    // so the allocator cannot grow the block where it is.
    let mut w = vec![10, 20];
    let neighbour = Box::new(0u64);
    println!("w: len={} cap={} buffer at {:p}  (neighbour at {:p})", w.len(), w.capacity(), w.as_ptr(), &*neighbour);
    for n in [30, 40, 50, 60, 70] {
        w.push(n);
        println!("w: len={} cap={} buffer at {:p}", w.len(), w.capacity(), w.as_ptr());
    }

    let e: Vec<i32> = Vec::new();
    println!("empty len={} cap={}", e.len(), e.capacity());
    let s = String::from("hi");
    println!("s len={} cap={}", s.len(), s.capacity());
    let f = String::from("né");
    println!("né len={} chars={} bytes={:?}", f.len(), f.chars().count(), f.as_bytes());
    println!("size_of Vec<i32>={} String={} Box<i32>={}", std::mem::size_of::<Vec<i32>>(), std::mem::size_of::<String>(), std::mem::size_of::<Box<i32>>());
}
