fn rss_of(addr: usize) -> String {
    let smaps = std::fs::read_to_string("/proc/self/smaps").unwrap();
    let mut cur = false; let mut out = String::new();
    for l in smaps.lines() {
        if let Some((range, _)) = l.split_once(' ') {
            if let Some((a, b)) = range.split_once('-') {
                if let (Ok(a), Ok(b)) = (usize::from_str_radix(a,16), usize::from_str_radix(b,16)) { cur = a <= addr && addr < b; if cur { out.push_str(l); out.push('\n'); } continue; }
            }
        }
        if cur && (l.starts_with("Size:") || l.starts_with("Rss:")) { out.push_str(l); out.push('\n'); }
    }
    out
}
fn main() {
    let mut big = vec![0u8; 64 << 20]; // 64 MiB
    let p = big.as_ptr() as usize;
    println!("before touching:\n{}", rss_of(p));
    for i in (0..big.len()).step_by(4096) { big[i] = 1; }
    println!("after writing one byte per 4096:\n{}", rss_of(p));
}
