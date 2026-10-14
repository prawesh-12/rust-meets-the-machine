fn total(values: &Vec<i32>) -> i32 {
    let mut sum = 0;
    for v in values.iter() {
        sum += v;
    }
    sum
}

fn main() {
    let mut scores = vec![10, 20];
    scores.push(30);
    let t = total(&scores);
    println!("{t}");
}
