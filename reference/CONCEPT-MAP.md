# Concept map

This file fixes the reading order and the links between ideas. Every topic follows it. If a topic changes what it teaches, this file changes first.

Source IDs in square brackets (for example **[R-OWN]**) refer to entries in `SOURCES.md`.

## Running example

One small program grows from topic to topic. Names and numbers stay the same everywhere.

| Where | Code | Why it appears there |
|---|---|---|
| 01–02 | `fn compute(a: i32, b: i32) -> i32 { let x = a + b; x }` called as `compute(2, 3)` | The smallest thing a CPU can visibly do. Plain `let x = 2 + 3;` is folded to `5` by the compiler, so the arguments come from a call instead. |
| 03–07 | `scores`, a `Vec<i32>` holding `10, 20, 30` | Gives the process something to keep in its address space, something two threads can share, and one address to translate and load. |
| 08 | `main → average(x, 7) → add(a, b)` | Nested calls on one thread's stack. |
| 09 | `let x = 7;` vs `let b = Box::new(7);` | One value with no allocation, one with. |
| 10 | `let mut scores = vec![10, 20]; scores.push(30);` | Spare capacity vs reallocation. |
| 11 | `let a = String::from("hi"); let b = a;` then `clone()` | Move vs clone vs drop. |
| 12 | `&scores`, `&mut scores`, `let first = &scores[0]; scores.push(30);` | Borrow ranges, and why the last one is rejected. |
| 13 | `for s in scores.iter() / iter_mut() / into_iter()` | What the loop sees. |
| 15 | `total(&scores)` returning `60` | Everything at once, one step at a time. |

## Layers (the legend used everywhere)

| Layer | Colour token | Who decides |
|---|---|---|
| Rust language | `--rust` | Rules the compiler checks: types, ownership, borrowing, lifetimes. |
| Compiler and runtime library | `--comp` | `rustc`, LLVM, the linker, startup code, `std`, the allocator. |
| Operating system | `--os` | The kernel: processes, threads, address spaces, page tables, scheduling. |
| CPU and hardware | `--hw` | Registers, execution units, MMU, TLB, caches, RAM. |

---

## index — The whole map

- **Needs:** nothing.
- **Question:** What are the pieces between a Rust source file and the RAM chips, and which piece is responsible for what?
- **New idea:** There are four layers, and each memory word used here belongs to one of them.
- **Prepares:** every topic.
- **Picture:** A cross-section of one running program. Hardware at the bottom (CPU with registers, caches, MMU and TLB; RAM in frames). The kernel above it. One process above that (address space with code, data, heap, two stacks). Rust values at the top (`scores` handle pointing at its buffer). Each part links to its topic.
- **Misconceptions to prevent:** stack and heap are separate chips; Rust has its own memory that replaces the OS's.
- **Sources:** [R-OWN], [K-CONCEPTS], [OSTEP-PROC].

## 01 — What is a program?

- **Needs:** nothing.
- **Question:** What is a program, and what has to happen before its first line runs?
- **New idea:** Source text → compiler → executable file → the OS builds a process → startup code → `main`.
- **Connects back:** —
- **Prepares:** 02 (the CPU runs the machine code inside the executable), 03 (a process).
- **Picture:** Five physically different objects in a row, revealed in order by a play control: a source page, the compiler's stages, the ELF file with header and sections, the kernel boundary (`execve`), and the running process. A real symbol chain from the built binary: `_start` → C `main` → `std::rt::lang_start` → your `main`.
- **Misconceptions:** the source is copied into RAM and run as text; the OS jumps straight into Rust's `main`.
- **Sources:** [RUSTC-OVERVIEW], [ELF5], [EXECVE2], [REF-MAIN], [RUN-ELF], [OSTEP-PROC].

## 02 — How does a CPU run code?

- **Needs:** 01 (an executable contains machine code).
- **Question:** What does the CPU do with the bytes of `compute`?
- **New idea:** Instructions, registers (general-purpose, instruction pointer, flags), execution units. Fetch–decode–execute as a beginner model only.
- **Connects back:** the `.text` bytes from 01.
- **Prepares:** 03 (who decides which program the CPU runs), 07 (where the CPU gets bytes from), 08 (call and return).
- **Picture:** A CPU cutaway beside a separate RAM strip. Step through the real optimised instructions `lea eax, [rdi + rsi]` and `ret`: values 2 and 3 sit in `rdi`/`rsi`, the adder produces 5 into `eax`, the instruction pointer moves. A second tab shows the unoptimised build, where `x` gets a stack slot.
- **Misconceptions:** the CPU runs Rust; every variable is a box in RAM; one instruction = one clock tick.
- **Sources:** [RUN-ASM], [INTEL-SDM], [PSABI], [OSTEP-CPU], [W-OOO].

## 03 — Program, process and the kernel

- **Needs:** 01, 02.
- **Question:** If the same program runs twice, what does each copy get, and who keeps them apart?
- **New idea:** Process = running instance with its own address space and resources. Kernel, system calls, scheduler. Isolation.
- **Connects back:** `execve` from 01; the CPU from 02 can only run one thread per core at a time.
- **Prepares:** 04 (what an address space contains), 05 (how the same address maps to different RAM).
- **Picture:** One executable launched twice. Process A and B each have an address-space strip with the same toy address `0x5000` for a counter. A "write" button changes only that process's physical frame. A shared read-only code frame is used by both.
- **Misconceptions:** program = process; processes share memory by default; the scheduler runs Rust code.
- **Sources:** [FORK2], [EXECVE2], [PTHREADS7], [ARM-MM], [OSTEP-PROC].

## 04 — Virtual memory: what a process contains

- **Needs:** 03.
- **Question:** What is inside one process's address space?
- **New idea:** A virtual address; mappings with permissions; code, read-only data, writable data, heap area, anonymous mappings, libraries, thread stacks. Mapped is not the same as resident.
- **Connects back:** the separate address spaces of 03.
- **Prepares:** 05 (translation), 06 (several stacks), 10 (where a `Vec`'s buffer comes from).
- **Picture:** A tall, address-ordered strip built from a real `/proc/self/maps` of a Rust program (`maps.rs`). Clicking a region answers "what might live here" and "who manages it". Real pointers printed by the same run are marked on the strip. A toggle overlays a second run (Process B). A small table shows 64 MiB mapped but 4 KiB resident until written.
- **Misconceptions:** "the heap" in a map = every heap-allocated Rust value; virtual space = RAM; the layout is universal.
- **Sources:** [PROC-MAPS], [MMAP2], [MALLOC3], [K-CONCEPTS], [K-X86-MM], [RUN-MAPS], [RUN-RSS].

## 05 — Physical RAM and address translation

- **Needs:** 04.
- **Question:** How does a virtual address become a physical one?
- **New idea:** Pages and frames, page number + offset, page table entries with valid/present/permission bits, MMU, TLB, page faults (normal vs invalid).
- **Connects back:** same address, different frame (03); mapped vs resident (04).
- **Prepares:** 07 (translation is half of every load).
- **Picture:** A toy machine: 12-bit addresses, 256-byte pages, 16 frames. Choose a process and an address; step through split → TLB → page table → frame → physical byte. Cases: TLB hit, TLB miss, not present (fault, kernel fixes, retry), not mapped (fault, SIGSEGV), write to read-only.
- **Misconceptions:** virtual pages are adjacent in RAM; TLB = data cache; a page fault always means a crash.
- **Sources:** [K-CONCEPTS], [ARM-MM], [OSTEP-PAGING], [OSTEP-TLB], [OSTEP-SWAP], [RUN-RSS].

## 06 — Threads and their stacks

- **Needs:** 03, 04.
- **Question:** When a process has two threads, what do they share and what does each have alone?
- **New idea:** A thread = execution state (registers) + its own stack, inside a shared address space. `main` is a function, not a stack. Sharing is not automatically safe (`Send`/`Sync`, forward link).
- **Connects back:** the two stack regions in the 04 map.
- **Prepares:** 07, 08 (one thread's stack in detail).
- **Picture:** One process boundary with two thread lanes. Each lane has its own registers card and stack. Shared code, a static, and the `scores` buffer sit above, reachable from both. Buttons call and return in either thread; the other lane never changes.
- **Misconceptions:** each thread has its own copy of memory; one "main stack" serves everyone; stack size is universal.
- **Sources:** [PTHREADS7], [STD-THREAD], [OSTEP-THREADS], [NOMICON-SEND], [RUN-MAPS], [RUN-SCOPE].

## 07 — Registers, caches and one memory read

- **Needs:** 02, 05.
- **Question:** When an instruction reads `scores[1]`, where do the bytes actually come from?
- **New idea:** Cache hierarchy holds copies of memory in lines; hits and misses; the TLB sits on the translation path, not the data path. Hardware manages fills.
- **Connects back:** translation (05), registers (02).
- **Prepares:** 15.
- **Picture:** One load drawn as two lanes. Translation lane: TLB → (miss) page walk. Data lane: L1d → L2 → L3 → DRAM. Toggles choose TLB hit/miss and where the data is found; the path lights only the parts used. A cache line strip shows that loading `scores[1]` brings its neighbours too.
- **Misconceptions:** CPU asks RAM every time; programmers move data into cache; every CPU has the same L1/L2/L3 layout.
- **Sources:** [DREPPER], [ARM-MM], [OSTEP-TLB], [RUN-LSCPU].

## 08 — Function calls and stack frames

- **Needs:** 02, 06.
- **Question:** What happens on a thread's stack when one function calls another and returns?
- **New idea:** Frames, return address, LIFO, calling convention, optimisation can remove slots, returning does not erase bytes. Recursion uses frames.
- **Connects back:** `ret` in 02; the per-thread stack in 06.
- **Prepares:** 09 (values in frames vs heap), 14 (stack overflow).
- **Picture:** Step through `main → average → add → return → return`. The stack column grows and shrinks; the current line is highlighted; a side list shows which source values are live. Returned frames turn grey ("space reusable, bytes not cleared").
- **Misconceptions:** every local has a stack slot; return wipes memory; `main` is the stack.
- **Sources:** [R-OWN], [RUN-CALLS], [PSABI], [FN-ABI], [REF-OVERFLOW], [INTEL-SDM], [W-CALLSTACK].

## 09 — Rust values, stack, heap and `Box<T>`

- **Needs:** 08, 04.
- **Question:** Where does a Rust value live, and what does `Box` change?
- **New idea:** Binding vs value vs storage. Heap allocation through the global allocator. `Box<T>` is a pointer that owns its allocation. Structs hold fields inline.
- **Connects back:** frames (08), heap area and anonymous mappings (04).
- **Prepares:** 10 (`Vec` is a handle plus a buffer), 11 (ownership).
- **Picture:** Four columns — binding, Rust value, possible runtime storage, heap allocation — for `let x = 7`, `let b = Box::new(7)`, and a struct holding a `Box`. Each cell is badged "guaranteed" or "illustrative".
- **Misconceptions:** Rust has its own memory; every local is on the stack; heap = long-lived.
- **Sources:** [R-OWN], [STD-BOX], [STD-BOXNEW], [STD-ALLOC], [REF-LAYOUT], [MALLOC3], [RUN-BOXES], [RUN-SIZES].

## 10 — `String` and `Vec<T>` in memory

- **Needs:** 09.
- **Question:** What is a `Vec` made of, and what happens when it grows?
- **New idea:** (ptr, len, cap) triplet with unspecified order; contiguous elements; spare capacity vs reallocation; empty `Vec` does not allocate; `String` is bytes; literals are `&'static str`.
- **Connects back:** `Box` (09).
- **Prepares:** 11 (moving a handle), 12 (why a reference into the buffer blocks `push`).
- **Picture:** Interactive handle + buffer with a real arrow from `ptr` to the first element. `push` with spare capacity vs at full capacity (new buffer, copy, old freed, arrow moves). Toggle a borrowed `&scores[0]` to see what reallocation would break. A `String` panel shows bytes for `"hi"` and `"né"`.
- **Misconceptions:** every push allocates; field order is fixed; `len` of a `String` counts characters; empty `Vec` has a buffer.
- **Sources:** [STD-VEC], [STD-STRING], [R-OWN], [R-VEC], [MALLOC3], [RUN-VEC], [RUN-BORROWMUT].

## 11 — Ownership, moves, copies, clones and drop

- **Needs:** 10.
- **Question:** Who is responsible for freeing a `String`'s buffer, and what does `let b = a;` change?
- **New idea:** Owner; move; `Copy`; `Clone`; drop at end of scope in reverse declaration order; moved-from bindings are not dropped; freeing ≠ returning RAM to the OS.
- **Connects back:** handle + buffer (10).
- **Prepares:** 12 (using without owning).
- **Picture:** Scenes for move, copy and clone, ending in a scope exit that shows which allocations are freed and in what order.
- **Misconceptions:** a move copies the heap text; assignment always copies or always moves; ownership is a CPU feature; drop returns RAM to the OS.
- **Sources:** [R-OWN], [REF-DESTRUCTORS], [STD-COPY], [MALLOC3], [MALLOPT3], [RUN-MOVE], [RUN-MOVES].

## 12 — References, borrowing and lifetimes

- **Needs:** 11.
- **Question:** How can code use a value without owning it, and how does the compiler know the value is still there?
- **New idea:** `&T`, `&mut T`, the two rules, borrow ranges end at last use, lifetimes describe relationships, the dangling-reference errors. Safe vs unsafe boundary.
- **Connects back:** owner and drop (11); reallocation (10).
- **Prepares:** 13 (iteration borrows), 14 (use-after-free).
- **Picture:** A reference drawn as its own small value with an arrow to the owner. A borrow timeline beside the code shows each reference's live range; overlapping shared/mutable ranges turn red with the real compiler error.
- **Misconceptions:** a reference is a copy; lifetime annotations extend life; lifetimes are runtime timers; Rust prevents every memory bug.
- **Sources:** [R-BORROW], [R-LIFETIMES], [REF-UB], [NOMICON-SAFE], [RUN-REFS], [RUN-DANGLE], [RUN-OUTLIVES], [RUN-BORROWMUT].

## 13 — Iterators

- **Needs:** 12, 10.
- **Question:** When a loop walks through `scores`, what does each step give you?
- **New idea:** An iterator is a separate value that produces items; `iter` (`&T`), `iter_mut` (`&mut T`), `into_iter` (`T`, consumes); `for` calls `into_iter`.
- **Connects back:** references (12), buffer (10).
- **Prepares:** 15.
- **Picture:** The buffer cells with a moving "next item" marker; switching mode changes the arrow style and the state of `scores` (borrowed, mutably borrowed, moved).
- **Misconceptions:** the iterator is the buffer; the loop copies the vector; iterator layout is fixed.
- **Sources:** [STD-ITER], [REF-LOOP], [RUN-ITER], [RUN-AFTERINTO].

## 14 — Memory bugs and what Rust changes

- **Needs:** 08, 10, 12.
- **Question:** What goes wrong in stack overflow, out-of-bounds access and use-after-free, and what does Rust do about each?
- **New idea:** Panics vs undefined behaviour; bounds checks; `get`; the safe/unsafe boundary.
- **Connects back:** frames (08), buffer bounds (10), borrows (12).
- **Prepares:** 15.
- **Picture:** For each bug, a small memory drawing plus an intended / allowed / Rust table with real outputs.
- **Misconceptions:** Rust makes recursion safe; Rust catches every bug in all code; a panic is memory corruption.
- **Sources:** [REF-ARRAY], [STD-SLICE], [REF-UB], [REF-NOTUNSAFE], [REF-OVERFLOW], [STD-FORGET], [STD-THREAD], [STD-SRC-STACKOVF], [R-PANIC], [RUN-INDEX], [RUN-RECURSE].

## 15 — One example, end to end

- **Needs:** all.
- **Question:** What happens, layer by layer, when `total(&scores)` runs?
- **New idea:** none — the layers seen together, one event at a time.
- **Picture:** A step control over a labelled illustrative trace. Each step highlights one row out of: source, Rust rule, value/allocation, thread/stack, address/translation, CPU/cache.
- **Sources:** all previous, plus [RUN-SUM-ASM].
