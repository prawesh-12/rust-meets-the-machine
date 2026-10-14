# How a Rust program meets the machine

A small static website that follows one Rust program from source file to CPU. It covers what a program and a process are, and how virtual addresses reach physical RAM. It shows what threads, stacks, frames and caches do. It ends with how `Box`, `Vec`, ownership, borrowing and iterators sit on top of all that.

Every topic answers one question, and most have an interactive diagram you can step through. Measured values (addresses, sizes, assembly, compiler errors) come from real runs of the programs in [`examples/`](examples/), and each one is labelled as observed, guaranteed by documentation, or illustrative.

## Reading it

**Locally:** clone the repository and open `index.html` in a browser. There is no build step, no server and no network requirement. Opening the files straight from disk works.

**On GitHub Pages:** in the repository settings, open *Pages*, choose *Deploy from a branch*, and select the branch and the folder that contains `index.html`. The site uses only relative links, so it works from any path.

The pages are plain HTML with one stylesheet and two small scripts, and they work without JavaScript. Without it, every diagram shows its finished state with all of its steps written out. With JavaScript, the diagrams become step-through figures and toggles. `Tab` reaches every control, and `←` / `→` step a diagram once it has focus. Animations follow the system's reduced-motion setting, and the colours follow its light or dark setting.

## Topics

| | Question |
|---|---|
| [01](lessons/01-what-is-a-program.html) | What is a program? |
| [02](lessons/02-how-a-cpu-runs-code.html) | How does a CPU run code? |
| [03](lessons/03-programs-processes-and-the-kernel.html) | What does a program get when it starts running? |
| [04](lessons/04-virtual-memory.html) | What is inside a process's address space? |
| [05](lessons/05-physical-ram-and-address-translation.html) | How does a virtual address reach physical RAM? |
| [06](lessons/06-threads-and-their-stacks.html) | What do threads share, and what does each keep to itself? |
| [07](lessons/07-registers-caches-and-a-memory-read.html) | Where do the bytes of one memory read come from? |
| [08](lessons/08-function-calls-and-stack-frames.html) | What happens on the stack when one function calls another? |
| [09](lessons/09-rust-values-stack-heap-and-box.html) | Where does a Rust value live, and what does `Box` change? |
| [10](lessons/10-string-and-vec-memory.html) | What is a `Vec` made of, and what happens when it grows? |
| [11](lessons/11-ownership-moves-clone-and-drop.html) | Who frees a `String`'s memory? |
| [12](lessons/12-references-borrowing-and-lifetimes.html) | How can code use a value it does not own? |
| [13](lessons/13-iterators-and-following-data.html) | What does a loop over a `Vec` actually hand you? |
| [14](lessons/14-memory-bugs-and-rust-safety.html) | How do memory bugs happen, and what does Rust change? |
| [15](lessons/15-follow-one-example-end-to-end.html) | What happens, layer by layer, when `total(&scores)` runs? |

The topics are written to be read in this order, but each one stands on its own and links to the ideas it depends on. Basic Rust syntax (`let`, functions, `Vec`, `for` loops) is assumed. Nothing about operating systems or hardware is.

## The four layers

Everything on the site is tagged with the layer that decides it, in the same colour everywhere:

- **Rust language**: rules the compiler checks before the program runs (types, ownership, borrowing, lifetimes).
- **Compiler and runtime library**: `rustc`, LLVM, start-up code, the standard library, the allocator.
- **Operating system**: processes, threads, address spaces, page tables, scheduling.
- **CPU and hardware**: registers, the MMU and TLB, caches, RAM.

Much of the confusion around "stack", "heap" and "memory" comes from mixing these layers up, so the site keeps them apart.

## Repository layout

```text
index.html                  the whole map: four layers and the fifteen questions
lessons/                    one topic per file, numbered in reading order
assets/css/site.css         shared styles: layout, layer colours, diagrams, light and dark
assets/js/site.js           navigation, the "On this page" outline, opened-topic marks, external-link labels
assets/js/diagrams.js       the step-through engine and the code for each diagram
reference/GLOSSARY.md       definitions of every term, with its layer
reference/SOURCES.md        every source, the claim it supports, its caveats, and the observed results
reference/CONCEPT-MAP.md    reading order: what each topic needs, answers and prepares
reference/*.html            the same three documents as pages of the site
examples/*.rs               the programs whose output and assembly the topics quote
examples/run-all.sh         rebuilds and runs every example, rewriting examples/OUTPUT.txt
examples/OUTPUT.txt         the recorded output used on the site
```

## Running the examples

```sh
sh examples/run-all.sh
```

This needs `rustc` on your `PATH`. The script compiles every example and runs the ones that should run. It confirms that five deliberately invalid programs fail with the expected errors (E0382, E0106, E0597, E0502 and E0382 again). It also captures assembly for `x.rs`, `calls.rs` and `sum.rs`, then rewrites `OUTPUT.txt`.

- `maps.rs` and `rss.rs` read `/proc/self/…`, so they only work on Linux.
- `recurse.rs` overflows its stack on purpose and exits with status 134.
- Assembly capture uses x86-64 Intel syntax.

Your numbers will differ from the recorded ones. Addresses change on every run, and sizes, register choices and assembly can change with the toolchain, target and allocator.

## Where the numbers come from

The recorded run used Linux 7.0 (Ubuntu, glibc) on x86-64, an Intel Core i5-12450H, and rustc 1.98.1. That machine has 4 KiB pages and an 8 MiB main-thread stack limit. Full details are at the top of [`reference/SOURCES.md`](reference/SOURCES.md).

Technical claims are checked against primary sources and cited where they are made: the Rust Book, the Rust Reference, the standard library documentation, the Rustonomicon, the Linux kernel documentation and man pages, and Intel and Arm manuals. Wikipedia links are included as further reading only. `SOURCES.md` records which passage supports each claim, and the kind of claim it is (language guarantee, documented behaviour, common hardware behaviour, or observed result).

## Notes

- Topics you have opened get a ✓ in the navigation. The marks live in your browser's local storage and nowhere else. When the files are opened from disk, Firefox keeps that storage separate for each file, so there the marks may not carry over from one topic to the next.
- Some figures use small made-up addresses so the numbers fit on screen. They are labelled as illustrative.
