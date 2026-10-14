#!/usr/bin/env sh
# Compiles every example and records what rustc and the programs printed.
# Usage: sh examples/run-all.sh   (from the rust-memory-course directory)
# Writes examples/OUTPUT.txt. Needs rustc on PATH; Linux for maps.rs and rss.rs.
set -u
cd "$(dirname "$0")"
out=OUTPUT.txt
tmp=$(mktemp -d)
{
  echo "toolchain: $(rustc --version)"
  echo "host:      $(rustc -vV | sed -n 's/^host: //p')"
  echo "date:      $(date -u +%Y-%m-%d)"
  echo
  for f in move dangle outlives borrowmut afterinto; do
    echo "===== $f.rs  (expected: does not compile)"
    rustc --edition 2021 "$f.rs" -o "$tmp/$f" 2>&1 | grep -v '^warning\|^ *= note' 
    echo
  done
  for f in boxes vec moves refs sum iterm threads_scope index recurse maps rss; do
    echo "===== $f.rs"
    rustc --edition 2021 -O "$f.rs" -o "$tmp/$f" 2>&1 | grep '^error'
    "$tmp/$f" > "$tmp/out" 2>&1; status=$?
    sed "s#$tmp/##" "$tmp/out"
    echo "(exit status $status)"
    echo
  done
  echo "===== x.rs  optimised (-O) and unoptimised assembly of compute()"
  for lvl in 3 0; do
    rustc --edition 2021 -C opt-level=$lvl --emit asm -C llvm-args=-x86-asm-syntax=intel x.rs -o "$tmp/x$lvl.s"
    echo "-- opt-level=$lvl"
    awk '/^_R[A-Za-z0-9_]*7compute:$/{p=1} p{print} p&&/ret$/{exit}' "$tmp/x$lvl.s" | grep -v '^\s*\.\|^\.L'
  done
  echo
  echo "===== calls.rs  unoptimised (-C opt-level=0): one frame per call"
  rustc --edition 2021 -C opt-level=0 --emit asm -C llvm-args=-x86-asm-syntax=intel calls.rs -o "$tmp/c0.s"
  for fn in 3add 7average 4main; do
    awk "/^_R[A-Za-z0-9_]*${fn}:\$/{p=1} p{print} p&&/ret\$/{exit}" "$tmp/c0.s" | grep -v '^\s*\.\|^\.L'
  done
  echo
  echo "===== calls.rs  optimised (-O): average and add are inlined into main"
  rustc --edition 2021 -O --emit asm -C llvm-args=-x86-asm-syntax=intel calls.rs -o "$tmp/c3.s"
  awk '/^_R[A-Za-z0-9_]*4main:$/{p=1} p{print} p&&/ret$/{exit}' "$tmp/c3.s" | grep -v '^\s*\.\|^\.L'
  echo "symbols named average or add in the optimised output: $(grep -c 'calls7average\|calls3add' "$tmp/c3.s")"
  echo
  echo "===== sum.rs  optimised (-O): main, with total() inlined"
  rustc --edition 2021 -O --emit asm -C llvm-args=-x86-asm-syntax=intel sum.rs -o "$tmp/s3.s"
  awk '/^_R[A-Za-z0-9_]*4main:$/{p=1} p{print} p&&/ret$/{exit}' "$tmp/s3.s" | grep -v '^\s*\.\|^\.L'
  echo "symbols named total in the optimised output: $(grep -c '^_R[A-Za-z0-9_]*5total:' "$tmp/s3.s")"
} 2>&1 | sed "s#$HOME#~#g" > "$out"
rm -rf "$tmp"
echo "wrote examples/$out"
