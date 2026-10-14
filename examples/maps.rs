use std::thread;
fn main() {
    let small = vec![10, 20, 30];
    let big = vec![0u8; 1 << 20];
    let local = 7;
    let h = thread::spawn(|| {
        let t = 1;
        println!("thread local  {:p}", &t);
        std::thread::sleep(std::time::Duration::from_millis(300));
    });
    std::thread::sleep(std::time::Duration::from_millis(100));
    println!("main fn       {:p}", main as fn());
    println!("small buffer  {:p}", small.as_ptr());
    println!("big buffer    {:p}", big.as_ptr());
    println!("main local    {:p}", &local);
    let maps = std::fs::read_to_string("/proc/self/maps").unwrap();
    for l in maps.lines() { println!("{l}"); }
    h.join().unwrap();
}
