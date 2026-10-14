// Page 09: where a plain value, a Box and a struct holding a Box end up.
// Printing an address forces the value into memory, so this shows where the
// compiler put the values once their addresses were needed.
use std::mem::size_of;

struct Pair {
    id: i32,
    score: Box<i32>,
}

fn region(addr: usize) -> String {
    let maps = std::fs::read_to_string("/proc/self/maps").unwrap();
    for line in maps.lines() {
        let range = line.split(' ').next().unwrap();
        let (lo, hi) = range.split_once('-').unwrap();
        let lo = usize::from_str_radix(lo, 16).unwrap();
        let hi = usize::from_str_radix(hi, 16).unwrap();
        if addr >= lo && addr < hi {
            let name = line.split_whitespace().nth(5).unwrap_or("(anonymous mapping)");
            return name.to_string();
        }
    }
    "not mapped".to_string()
}

fn main() {
    let x = 7;
    let b = Box::new(7);
    let p = Pair { id: 1, score: Box::new(90) };

    let ax = &x as *const i32 as usize;
    let ab = &b as *const Box<i32> as usize;
    let ab_heap = &*b as *const i32 as usize;
    let ap = &p as *const Pair as usize;
    let ap_heap = &*p.score as *const i32 as usize;

    println!("size_of::<i32>()      = {}", size_of::<i32>());
    println!("size_of::<Box<i32>>() = {}", size_of::<Box<i32>>());
    println!("size_of::<Pair>()     = {}", size_of::<Pair>());
    println!("x          at {ax:#x}  in {}", region(ax));
    println!("b (handle) at {ab:#x}  in {}", region(ab));
    println!("*b (the 7) at {ab_heap:#x}  in {}", region(ab_heap));
    println!("p          at {ap:#x}  in {}", region(ap));
    println!("*p.score   at {ap_heap:#x}  in {}", region(ap_heap));
    println!("{} {} {} {}", x, b, p.id, p.score);
}
