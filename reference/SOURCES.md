# Sources

Every technical claim in the explanations traces to an entry here. Each entry gives the source, the passage relied on (quoted where short), what kind of claim it is, and any caveat that has to be shown next to the claim.

**Kinds of claim:** *Language guarantee* (Rust promises it) · *Library guarantee* (documented `std` behaviour) · *Documented OS behaviour* (Linux docs or man pages) · *Architecture* (CPU vendor docs) · *Common hardware behaviour* (true of typical designs, not promised) · *Observed* (measured on the machine below; may differ elsewhere) · *Teaching simplification*.

All sources were opened and read on 2026-10-14. Quotes are copied from the source documents as they read on that date.

## Machine used for observed results

| | |
|---|---|
| Toolchain | `rustc 1.98.1 (48a229cea 2026-09-01)` |
| Target | `x86_64-unknown-linux-gnu` |
| OS | Linux 7.0 (Ubuntu), glibc |
| CPU | 12th Gen Intel Core i5-12450H (4 performance + 4 efficiency cores) |
| Page size | 4096 (`getconf PAGESIZE`) |
| Main-thread stack limit | 8192 KiB (`ulimit -s`) |

Run `sh examples/run-all.sh` to reproduce; it writes `examples/OUTPUT.txt`.

---

## Rust — language and standard library

**[R-OWN]** The Rust Programming Language, §4.1 "What Is Ownership?" — https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html
- Ownership rules: "Each value in Rust has an *owner*. There can only be one owner at a time. When the owner goes out of scope, the value will be dropped." — *Language guarantee.*
- Stack: "The stack stores values in the order it gets them and removes the values in the opposite order." — *Teaching model* (the Book's own intro).
- Allocator: "The memory allocator finds an empty spot in the heap that is big enough, marks it as being in use, and returns a *pointer*." — *Teaching model.*
- Function calls: "the values passed into the function … and the function's local variables get pushed onto the stack." — **Caveat used in [Calls and stack frames](../lessons/08-function-calls-and-stack-frames.html) and [Values, stack, heap, Box](../lessons/09-rust-values-stack-heap-and-box.html):** the Book is describing a conceptual model; optimised code may keep these in registers (see [RUN-ASM]).
- `String` parts: "a pointer to the memory that holds the contents of the string, a length, and a capacity." Length and capacity are in bytes. — *Library behaviour.*
- Move: "we copy the pointer, the length, and the capacity that are on the stack. We do not copy the data on the heap"; "Rust considers `s1` as no longer valid." — *Language guarantee* (ownership), *teaching model* (where the handle lives).
- `clone`: "If we *do* want to deeply copy the heap data … we can use a common method called `clone`."
- Drop: "Rust calls `drop` automatically at the closing curly bracket."
- `Copy` types: integers, `bool`, floats, `char`, tuples of `Copy` types; "nothing that requires allocation or is some form of resource can implement `Copy`."

**[R-BORROW]** The Rust Programming Language, §4.2 "References and Borrowing" — https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html
- "A reference is like a pointer in that it's an address we can follow … Unlike a pointer, a reference is guaranteed to point to a valid value of a particular type for the life of that reference." — *Language guarantee (safe Rust).*
- "At any given time, you can have *either* one mutable reference *or* any number of immutable references." "References must always be valid."
- "a reference's scope starts from where it is introduced and continues through the last time that reference is used." — used for the borrow timeline in [References and lifetimes](../lessons/12-references-borrowing-and-lifetimes.html).
- `dangle()` example and E0106 message.

**[R-LIFETIMES]** The Rust Programming Language, §10.3 "Validating References with Lifetimes" — https://doc.rust-lang.org/book/ch10-03-lifetime-syntax.html
- "Lifetime annotations don't change how long any of the references live. Rather, they describe the relationships of the lifetimes of multiple references to each other." — *Language guarantee.*
- "The Rust compiler has a *borrow checker* that compares scopes to determine whether all borrows are valid."
- E0597 example (`r = &x` inside an inner block).

**[STD-VEC]** `std::vec::Vec`, section "Guarantees" — https://doc.rust-lang.org/std/vec/struct.Vec.html
- "`Vec` is and always will be a (pointer, capacity, length) triplet. No more, no less. The order of these fields is completely unspecified." — *Library guarantee.* **Caveat in [String and Vec](../lessons/10-string-and-vec-memory.html):** the ptr/len/cap drawing is a teaching layout, not a byte order.
- "if you construct a `Vec` with capacity 0 via `Vec::new`, `vec![]` … it will not allocate memory." — *Library guarantee.*
- "its pointer points to `len` initialized, contiguous elements in order … followed by `capacity - len` logically uninitialized, contiguous elements." — *Library guarantee.*
- "`push` and `insert` will never (re)allocate if the reported capacity is sufficient. `push` and `insert` *will* (re)allocate if `len == capacity`." — *Library guarantee.*
- "`Vec` does not guarantee any particular growth strategy when reallocating when full." — **Caveat in [String and Vec](../lessons/10-string-and-vec-memory.html):** growing from 2 to 4 is what we observed, not a rule.
- "`vec![e_1, e_2, ..., e_n]` … produce a `Vec` that requests an allocation of the exact size needed for precisely `n` elements"; capacity "at least the requested capacity and not more than the allocated capacity." — **Caveat:** so `vec![10, 20]` *asks* for room for 2; `capacity()` reported 2 in our run.
- "the ABI is not stable and `Vec` makes no guarantees about its memory layout (including the order of fields)."
- "`Vec` will never automatically shrink itself." "Even if you drop a `Vec`, its buffer may simply be reused by another allocation."

**[STD-STRING]** `std::string::String` — https://doc.rust-lang.org/std/string/struct.String.html
- "A UTF-8–encoded, growable string."
- "A `String` is made up of three components: a pointer to some bytes, a length, and a capacity … The length is the number of bytes currently stored in the buffer, and the capacity is the size of the buffer in bytes." "This buffer is always stored on the heap." — *Library guarantee.*
- `len`: "Returns the length of this `String`, in bytes, not `char`s or graphemes."

**[STD-BOX]** `std::boxed` — https://doc.rust-lang.org/std/boxed/index.html
- "`Box<T>`, casually referred to as a 'box', provides the simplest form of heap allocation in Rust. Boxes provide ownership for this allocation, and drop their contents when they go out of scope."
- "For non-zero-sized values, a `Box` will use the `Global` allocator for its allocation."
- "So long as `T: Sized`, a `Box<T>` is guaranteed to be represented as a single pointer." — *Library guarantee.* Matches [RUN-SIZES] (8 bytes on x86-64).

**[STD-ALLOC]** `std::alloc` — https://doc.rust-lang.org/std/alloc/index.html
- "the standard library has one 'global' memory allocator that is used for example by `Box<T>` and `Vec<T>`." "Currently the default global allocator is unspecified." — **Caveat in [Inside an address space](../lessons/04-virtual-memory.html) and [Values, stack, heap, Box](../lessons/09-rust-values-stack-heap-and-box.html):** that it behaves like glibc `malloc` here is *observed* ([RUN-MAPS]), not promised.

**[STD-ITER]** `std::iter` — https://doc.rust-lang.org/std/iter/index.html
- "`iter()`, which iterates over `&T`. `iter_mut()`, which iterates over `&mut T`. `into_iter()`, which iterates over `T`."
- `for` loop desugaring into `IntoIterator::into_iter(values)` and repeated `next()`.
- "Iterators (and iterator adapters) are *lazy*."

**[STD-THREAD]** `std::thread`, section "Stack size" — https://doc.rust-lang.org/std/thread/index.html
- "The default stack size is platform-dependent and subject to change. Currently, it is 2 MiB on all Tier-1 platforms." — **Caveat in [Threads and their stacks](../lessons/06-threads-and-their-stacks.html):** "currently", for spawned threads only.
- "Note that the stack size of the main thread is *not* determined by Rust."
- "When the main thread of a Rust program terminates, the entire program shuts down, even if other threads are still running."

**[STD-SLICE]** `slice::get` — https://doc.rust-lang.org/std/primitive.slice.html#method.get
- "returns a reference to the element at that position or `None` if out of bounds."

**[REF-ARRAY]** The Rust Reference, "Array and slice indexing expressions" — https://doc.rust-lang.org/reference/expressions/array-expr.html
- "bounds can be checked at compile-time with a constant index value. Otherwise a check will be performed at run-time that will put the thread in a *panicked state* if it fails." — *Language guarantee.*

**[REF-MAIN]** The Rust Reference, "Crates and source files" → main functions — https://doc.rust-lang.org/reference/crates-and-source-files.html
- "A crate that contains a `main` function can be compiled to an executable." — The Reference does not describe what runs before `main`; [What a program is](../lessons/01-what-is-a-program.html) uses [RUN-ELF] for that.

**[REF-DESTRUCTORS]** The Rust Reference, "Destructors" — https://doc.rust-lang.org/reference/destructors.html
- "When an initialized variable or temporary goes out of scope, its *destructor* is run or it is *dropped*." Variables "are dropped in reverse order of declaration." The example notes "Uninitialized does not drop" — a moved-from binding is uninitialised. — *Language guarantee.*
- "`core::mem::forget` can be used to prevent the destructor of a variable from being run" — [Ownership, moves, drop](../lessons/11-ownership-moves-clone-and-drop.html) notes drop is not guaranteed in every case.

**[REF-OVERFLOW]** The Rust Reference, "Overflow" — https://doc.rust-lang.org/reference/expressions/operator-expr.html#overflow
- "Integer operators will panic when they overflow when compiled in debug mode." — *Language rule.* Explains the `jo` check in [RUN-CALLS].

**[STD-BLACKBOX]** `std::hint::black_box` — https://doc.rust-lang.org/std/hint/fn.black_box.html
- An identity function that tells the compiler to be "maximally pessimistic" about what it could do, provided on a "best-effort" basis. — *Library documentation.* The examples use it so that results are not computed at compile time; it is not a guarantee.

**[REF-LAYOUT]** The Rust Reference, "Type layout" — https://doc.rust-lang.org/reference/type-layout.html
- `i32` has size 4. Default representation: "There are no other guarantees of data layout"; field order "does not have to be the same as the order in which the fields are specified." "Type layout can be changed with each compilation."

**[REF-UB]** The Rust Reference, "Behavior considered undefined" — https://doc.rust-lang.org/reference/behavior-considered-undefined.html
- List includes "Data races" and "Accessing (loading from or storing to) a place that is dangling." "`unsafe` only means that avoiding undefined behavior is on the programmer." The list "is not exhaustive."

**[FN-ABI]** `fn` primitive, "ABI compatibility" — https://doc.rust-lang.org/core/primitive.fn.html
- "The default ABI is 'Rust'." The page does not specify the Rust ABI's register use. — **Caveat in [How a CPU runs code](../lessons/02-how-a-cpu-runs-code.html):** the registers `compute` used are observed, not promised.

**[NOMICON-SAFE]** The Rustonomicon, "How Safe and Unsafe Interact" — https://doc.rust-lang.org/nomicon/safe-unsafe-meaning.html
- "No matter what, Safe Rust clients can't cause Undefined Behavior."
- "Safe Rust inherently has to trust that any Unsafe Rust it touches has been written correctly."
- `slice::get_unchecked` "performs unchecked indexing, allowing memory safety to be freely violated"; "All FFI … functions are `unsafe` to call."

**[NOMICON-SEND]** The Rustonomicon, "Send and Sync" — https://doc.rust-lang.org/nomicon/send-and-sync.html
- "A type is Send if it is safe to send it to another thread. A type is Sync if it is safe to share between threads (T is Sync if and only if `&T` is Send)." Automatically derived.

**[RUSTC-OVERVIEW]** Rust Compiler Development Guide, "Overview of the compiler" — https://rustc-dev-guide.rust-lang.org/overview.html
- Stages: tokens → AST → HIR → THIR → MIR ("MIR is used for borrow checking") → LLVM IR → machine code in object files → "linked together to produce the final binary." — *Implementation detail of rustc*, can change between versions.

**[R-VEC]** The Rust Programming Language, §8.1 "Storing Lists of Values with Vectors" — https://doc.rust-lang.org/book/ch08-01-vectors.html
- Explains the `let first = &v[0]; v.push(6);` error: adding an element "might require allocating new memory and copying the old elements to the new space". — *Explanation.* Used in [String and Vec](../lessons/10-string-and-vec-memory.html).

**[R-PANIC]** The Rust Programming Language, §9.1 "Unrecoverable Errors with panic!" — https://doc.rust-lang.org/book/ch09-01-unrecoverable-errors-with-panic.html
- "By default, when a panic occurs, the program starts unwinding, which means Rust walks back up the stack and cleans up the data from each function it encounters." — *Explanation.* Exit status 101 is observed ([RUN-INDEX]). Used in [Memory bugs and safety](../lessons/14-memory-bugs-and-rust-safety.html).

**[STD-BOXNEW]** `Box::new` — https://doc.rust-lang.org/std/boxed/struct.Box.html#method.new
- "Allocates memory on the heap and then places `x` into it. This doesn't actually allocate if `T` is zero-sized." — *Library guarantee.* Used in [Values, stack, heap, Box](../lessons/09-rust-values-stack-heap-and-box.html).

**[STD-COPY]** `std::marker::Copy` — https://doc.rust-lang.org/std/marker/trait.Copy.html
- "the only difference is whether you are allowed to access x after the assignment. Under the hood, both a copy and a move can result in bits being copied in memory, although this is sometimes optimized away." — *Library documentation.* Used in [Ownership, moves, drop](../lessons/11-ownership-moves-clone-and-drop.html).

**[STD-FORGET]** `std::mem::forget` — https://doc.rust-lang.org/std/mem/fn.forget.html
- "forget is not marked as unsafe, because Rust's safety guarantees do not include a guarantee that destructors will always run." — *Library documentation.* Used in [Memory bugs and safety](../lessons/14-memory-bugs-and-rust-safety.html).

**[REF-LOOP]** The Rust Reference, "Iterator loops" — https://doc.rust-lang.org/reference/expressions/loop-expr.html#iterator-loops
- "A for expression is a syntactic construct for looping over elements provided by an implementation of std::iter::IntoIterator." — *Language rule.* Used in [Iterators](../lessons/13-iterators-and-following-data.html).

**[REF-NOTUNSAFE]** The Rust Reference, "Behavior not considered unsafe" — https://doc.rust-lang.org/reference/behavior-not-considered-unsafe.html
- Lists deadlocks, leaks of memory and other resources, exiting without calling destructors, and integer overflow. — *Language rule.* Used in [Memory bugs and safety](../lessons/14-memory-bugs-and-rust-safety.html).

**[STD-SRC-STACKOVF]** Rust standard library source, `library/std/src/sys/pal/unix/stack_overflow.rs` at tag 1.98.1 — https://github.com/rust-lang/rust/blob/1.98.1/library/std/src/sys/pal/unix/stack_overflow.rs
- Installs a `SIGSEGV`/`SIGBUS` handler on an alternate stack; if the faulting address is in the guard page it prints "thread '…' has overflowed its stack" and aborts. — *Implementation, not a language promise.* Used in [Memory bugs and safety](../lessons/14-memory-bugs-and-rust-safety.html); matches [RUN-RECURSE].

## Linux and operating systems

**[K-CONCEPTS]** Linux kernel docs, "Concepts overview" (memory management) — https://www.kernel.org/doc/html/latest/admin-guide/mm/concepts.html
- "With virtual memory, each and every memory access uses a virtual address."
- "The physical system memory is divided into page frames, or pages. The size of each page is architecture specific."
- "The page tables are organized hierarchically." "The lowest bits in the virtual address define the offset inside the actual page."
- "CPUs maintain a cache of such translations called Translation Lookaside Buffer (or TLB)."
- Demand paging; for anonymous mappings "When the program performs a write, a regular physical page will be allocated."
- Swap: "the dirty page will be swapped out."

**[K-X86-MM]** Linux kernel docs, "Memory Management" (x86_64) — https://www.kernel.org/doc/html/latest/arch/x86/x86_64/mm.html
- 4-level paging: `0000000000000000 … 00007fffffffefff | ~128 TB | user-space virtual memory, different per mm`. — *Documented OS behaviour, x86-64 Linux only.*

**[PROC-MAPS]** `proc_pid_maps(5)` — https://man7.org/linux/man-pages/man5/proc_pid_maps.5.html
- Field meanings; permissions `r w x s p`; `[stack]` is "The initial process's (also known as the main thread's) stack"; `[heap]` is "The process's heap"; "If the pathname field is blank, this is an anonymous mapping as obtained via mmap(2)."
- `[stack:tid]` labels for thread stacks existed only Linux 3.4–4.4. — **Caveat in [Inside an address space](../lessons/04-virtual-memory.html) and [Threads and their stacks](../lessons/06-threads-and-their-stacks.html):** on current kernels thread stacks appear as unnamed anonymous mappings.

**[MMAP2]** `mmap(2)` — https://man7.org/linux/man-pages/man2/mmap.2.html
- "mmap() creates a new mapping in the virtual address space of the calling process." `MAP_ANONYMOUS`: "The mapping is not backed by any file; its contents are initialized to zero." After `munmap`, "subsequent references to these pages will generate SIGSEGV."

**[MALLOPT3]** `mallopt(3)` — https://man7.org/linux/man-pages/man3/mallopt.3.html
- `M_TRIM_THRESHOLD`: "When the amount of contiguous free memory at the top of the heap grows sufficiently large, free(3) employs sbrk(2) to release this memory back to the system." — *glibc behaviour.* Used in [Ownership, moves, drop](../lessons/11-ownership-moves-clone-and-drop.html): freeing usually returns a block to the allocator, not to the kernel.

**[MALLOC3]** `malloc(3)` (glibc notes) — https://man7.org/linux/man-pages/man3/malloc.3.html
- "Normally, malloc() allocates memory from the heap, and adjusts the size of the heap as required, using sbrk(2). When allocating blocks of memory larger than MMAP_THRESHOLD bytes, the glibc malloc() implementation allocates the memory as a private anonymous mapping using mmap(2). MMAP_THRESHOLD is 128 kB by default."
- **Caveat:** the man page does not say whether `free` returns memory to the kernel. The documentation says only that freeing returns the block to the allocator, and the allocator *may* keep it — supported by [STD-VEC] ("its buffer may simply be reused by another allocation").

**[EXECVE2]** `execve(2)` — https://man7.org/linux/man-pages/man2/execve.2.html
- "causes the program that is currently being run by the calling process to be replaced with a new program, with newly initialized stack, heap, and (initialized and uninitialized) data segments." PID is kept. For dynamically linked ELF, "the interpreter named in the PT_INTERP segment is used to load the needed shared objects."

**[FORK2]** `fork(2)` — https://man7.org/linux/man-pages/man2/fork.2.html
- "The child process and the parent process run in separate memory spaces. At the time of fork() both memory spaces have the same content." "Under Linux, fork() is implemented using copy-on-write pages."

**[ELF5]** `elf(5)` — https://man7.org/linux/man-pages/man5/elf.5.html
- `e_entry`: "the virtual address to which the system first transfers control, thus starting the process."
- `.text` "holds the 'text', or executable instructions"; `.rodata` read-only data; `.data` initialised data; `.bss` uninitialised data; `PT_LOAD` loadable segment; `PT_INTERP` interpreter path.

**[PTHREADS7]** `pthreads(7)` — https://man7.org/linux/man-pages/man7/pthreads.7.html
- Threads "share the same global memory (data and heap segments), but each thread has its own stack (automatic variables)."
- Process-wide: PID, open file descriptors, signal dispositions, current directory, resource limits, …
- Per thread: thread ID, signal mask, `errno`, alternate signal stack, scheduling policy and priority.
- Default thread stack size comes from `RLIMIT_STACK` for pthreads. — **Caveat:** Rust's `std::thread` sets its own default ([STD-THREAD]).

## CPU and memory hardware

**[ARM-MM]** Arm, "Learn the architecture — Memory Management" (101811, v1.0) — https://developer.arm.com/-/media/Arm%20Developer%20Community/PDF/Learn%20the%20Architecture/LearnTheArchitecture-MemoryManagement-101811_0100_00_en.pdf
- "each application can use its own set of virtual addresses that will be mapped to different locations in the physical system. As the operating system switches between different applications it re-programs the map."
- "The Memory Management Unit (MMU) performs translations." It contains "The table walk unit … [and] Translation Lookaside Buffers (TLBs), which cache recently used translations."
- "an OS can present multiple fragmented physical regions of memory as a single, contiguous virtual address space."
- Armv8-A granules: "4KB, 16KB, and 64KB." TLB entries can be tagged with an ASID so several applications' translations coexist. — *Architecture (Arm).*

**[INTEL-SDM]** Intel 64 and IA-32 Architectures Software Developer's Manuals — https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html
- Volume 1 (Basic Architecture) defines the x86-64 execution environment: general-purpose registers, `RIP`, `RFLAGS`. Volume 3A covers paging and TLBs. — *Architecture (x86-64).* Used only for register names; behaviour shown in the explanations comes from [RUN-ASM].

**[PSABI]** System V AMD64 psABI (living document) — https://gitlab.com/x86-psABIs/x86-64-ABI
- Integer arguments in `rdi`, `rsi`, `rdx`, `rcx`, `r8`, `r9`; result in `rax`. Applies to C-ABI functions. — **Caveat:** see [FN-ABI].

**[DREPPER]** Ulrich Drepper, "What Every Programmer Should Know About Memory" (2007) — https://www.akkadia.org/drepper/cpumemory.pdf
- §3: L1d/L1i/L2/L3 hierarchy; memory is cached in whole *cache lines* (64 bytes in the examples); caches are managed by the processor and are largely transparent to programs.
- **Caveat:** 2007 hardware. [Caches and one load](../lessons/07-registers-caches-and-a-memory-read.html) uses it for structure only, not for timings.

**[OSTEP-PROC] [OSTEP-CPU] [OSTEP-PAGING] [OSTEP-TLB] [OSTEP-SWAP] [OSTEP-THREADS]** Arpaci-Dusseau, *Operating Systems: Three Easy Pieces* —
https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-intro.pdf, …/cpu-mechanisms.pdf, …/vm-paging.pdf, …/vm-tlbs.pdf, …/vm-beyondphys.pdf, …/threads-intro.pdf
- Process creation: "modern OSes perform the process lazily, i.e., by loading pieces of code or data only as they are needed."
- Paging: split into VPN and offset; "the offset stays the same (i.e., it is not translated)"; `PhysAddr = (PFN << SHIFT) | offset`.
- TLB hit/miss flow; present bit; a page fault on a legal-but-absent page "should be called a page miss."
- Threads: "each thread has its own private set of registers"; threads "share the same address space"; a thread switch does not change page tables.
- *Reputable textbook; teaching models.*

## Observed on the machine above

**[RUN-ELF]** `readelf -h`, `readelf -l`, `nm` on a release build of `examples/x.rs`.
- ELF type `DYN (Position-Independent Executable file)`; `Entry point address: 0x14e90`; symbol at that address is `_start`, not `main`.
- Symbols present: `_start`, `main` (C-level, generated), `std::rt::lang_start_internal`, the user's `x::main`.
- `[Requesting program interpreter: /lib64/ld-linux-x86-64.so.2]`.

**[RUN-ASM]** `rustc --emit asm` of `examples/x.rs`.
- `-O`: `compute` is `lea eax, [rdi + rsi]` / `ret` — `x` never touches memory.
- `-C opt-level=0`: `add edi, esi` / `mov dword ptr [rsp + 4], edi` / `seto al` / `jo …` / `mov eax, dword ptr [rsp + 4]` — `x` gets a stack slot and there is an overflow check.

**[RUN-MAPS]** `examples/maps.rs`, run twice. Real `/proc/self/maps` plus printed pointers.
- The 3-element `Vec`'s buffer is inside `[heap]`; the 1 MiB `Vec`'s buffer is in its own anonymous mapping; the spawned thread's local is in an anonymous mapping of about 2 MiB; `main`'s local is in `[stack]`.
- Both runs used different addresses (address-space layout randomisation).

**[RUN-RSS]** `examples/rss.rs`. A 64 MiB `vec![0u8; …]`: `Size: 65540 kB`, `Rss: 4 kB` before writing; `Rss: 65536 kB` after writing one byte per page.

**[RUN-VEC]** `examples/vec.rs`. `vec![10, 20]` → `len=2 cap=2`; after `push(30)` → `len=3 cap=4`, buffer address unchanged (glibc grew the block in place). A second vector with another allocation placed right after its buffer: unchanged at `cap=4`, moved (`…d70` → `…db0`) when capacity went to 8. `Vec::new()` → `cap=0`; `"né"` → `len=3`, 2 chars, bytes `[110, 195, 169]`.

**[RUN-MOVES]** `examples/moves.rs`. After `let b = a;`, `b.as_ptr()` equals the address `a`'s buffer had; `b.clone()` has a different buffer. Drop messages: `end of main`, then `drop second`, `drop third`, `drop first` (the moved-from binding `second` was not dropped separately).

**[RUN-REFS]** `examples/refs.rs`. `&scores` holds a stack address (the handle); `&scores[0]` holds a heap address (the buffer). `size_of::<&Vec<i32>>() = 8`, `&[i32]` and `&str` = 16.

**[RUN-SUM-ASM]** `examples/OUTPUT.txt`, optimised assembly of `main` in `sum.rs`: `__rust_alloc(8, 4)`; one 8-byte store of `85899345930` (20·2³² + 10); handle stored as cap at `[rsp+8]`, ptr at `[rsp+16]`, len at `[rsp+24]`; `RawVec::grow_one`; `mov dword ptr [rbx + 8], 30`; two loads plus `add eax, 30`; `__rust_dealloc`. No `total` symbol.

**[RUN-BOXES]** `examples/boxes.rs`. `size_of::<Box<i32>>() = 8`, `size_of::<Pair>() = 16`; `x`, `b` and `p` reported inside `[stack]`, the boxed `7` and `90` inside `[heap]`, 0x20 bytes apart.

**[RUN-CALLS]** `examples/calls.rs`. Unoptimised: `add` and `average` each begin with `push rax` and end with `pop rcx; ret`; `main` reserves 40 bytes with `sub rsp, 40`. Optimised (`-O`): no symbol for `average` or `add`; the arithmetic is inside `main`.

**[RUN-SIZES]** same program: `size_of::<Vec<i32>>() = 24`, `String = 24`, `Box<i32> = 8`.

**[RUN-MOVE] [RUN-DANGLE] [RUN-OUTLIVES] [RUN-BORROWMUT] [RUN-AFTERINTO]** Compiler errors E0382, E0106, E0597, E0502, E0382, copied from `examples/OUTPUT.txt`.

**[RUN-INDEX]** `examples/index.rs`: `None`, then `index out of bounds: the len is 3 but the index is 10`, exit status 101.

**[RUN-RECURSE]** `examples/recurse.rs`: `thread 'main' (…) has overflowed its stack` / `fatal runtime error: stack overflow, aborting`, exit status 134 (SIGABRT). An earlier version (`count_down(n + 1) + 1`) built with `-O` did not overflow at all: the optimiser removed the recursion and the program looped forever.

**[RUN-ITER]** `examples/iterm.rs`: `11 21 31` after `iter_mut`, then `owned 11/21/31` from `into_iter`; `size_of` `slice::Iter<i32>` = 16, `IterMut` = 16, `vec::IntoIter<i32>` = 32.

**[RUN-SCOPE]** `examples/threads_scope.rs`: output as recorded.

**[RUN-LSCPU]** `lscpu`: `L1d cache: 320 KiB (8 instances)`, `L1i cache: 384 KiB (8 instances)`, `L2 cache: 7 MiB (5 instances)`, `L3 cache: 12 MiB (1 instance)`; `getconf LEVEL1_DCACHE_LINESIZE` = 64.

## Secondary reading (not used as proof)

Wikipedia links appear beside first uses of general OS and hardware terms. All were checked to return HTTP 200 on 2026-10-14. "Heap" links go to *Memory management* (allocation sense), never to *Heap (data structure)*.

- Arithmetic logic unit — https://en.wikipedia.org/wiki/Arithmetic_logic_unit ([How a CPU runs code](../lessons/02-how-a-cpu-runs-code.html))
- Buffer overflow — https://en.wikipedia.org/wiki/Buffer_overflow ([Memory bugs and safety](../lessons/14-memory-bugs-and-rust-safety.html))
- C dynamic memory allocation#Common errors — https://en.wikipedia.org/wiki/C_dynamic_memory_allocation#Common_errors ([Ownership, moves, drop](../lessons/11-ownership-moves-clone-and-drop.html))
- **[W-CALLSTACK]** Call stack — https://en.wikipedia.org/wiki/Call_stack ([Calls and stack frames](../lessons/08-function-calls-and-stack-frames.html))
- Calling convention — https://en.wikipedia.org/wiki/Calling_convention ([Calls and stack frames](../lessons/08-function-calls-and-stack-frames.html))
- Central processing unit — https://en.wikipedia.org/wiki/Central_processing_unit ([How a CPU runs code](../lessons/02-how-a-cpu-runs-code.html))
- Compiler — https://en.wikipedia.org/wiki/Compiler ([What a program is](../lessons/01-what-is-a-program.html))
- Computer program — https://en.wikipedia.org/wiki/Computer_program ([What a program is](../lessons/01-what-is-a-program.html))
- Context switch — https://en.wikipedia.org/wiki/Context_switch ([Processes and the kernel](../lessons/03-programs-processes-and-the-kernel.html))
- CPU cache — https://en.wikipedia.org/wiki/CPU_cache ([Caches and one load](../lessons/07-registers-caches-and-a-memory-read.html))
- Dangling pointer — https://en.wikipedia.org/wiki/Dangling_pointer ([String and Vec](../lessons/10-string-and-vec-memory.html) and [Memory bugs and safety](../lessons/14-memory-bugs-and-rust-safety.html))
- Data race — https://en.wikipedia.org/wiki/Data_race ([Threads and their stacks](../lessons/06-threads-and-their-stacks.html))
- Demand paging — https://en.wikipedia.org/wiki/Demand_paging ([Inside an address space](../lessons/04-virtual-memory.html))
- Executable — https://en.wikipedia.org/wiki/Executable ([What a program is](../lessons/01-what-is-a-program.html))
- Heap (data structure), linked only to say it is a different meaning of "heap" — https://en.wikipedia.org/wiki/Heap_(data_structure) ([Values, stack, heap, Box](../lessons/09-rust-values-stack-heap-and-box.html))
- Inline expansion — https://en.wikipedia.org/wiki/Inline_expansion ([Calls and stack frames](../lessons/08-function-calls-and-stack-frames.html))
- Instruction cycle — https://en.wikipedia.org/wiki/Instruction_cycle ([How a CPU runs code](../lessons/02-how-a-cpu-runs-code.html))
- Iterator — https://en.wikipedia.org/wiki/Iterator ([Iterators](../lessons/13-iterators-and-following-data.html))
- Kernel (operating system) — https://en.wikipedia.org/wiki/Kernel_(operating_system) ([What a program is](../lessons/01-what-is-a-program.html))
- Locality of reference — https://en.wikipedia.org/wiki/Locality_of_reference ([Caches and one load](../lessons/07-registers-caches-and-a-memory-read.html))
- Machine code — https://en.wikipedia.org/wiki/Machine_code ([What a program is](../lessons/01-what-is-a-program.html))
- Memory hierarchy — https://en.wikipedia.org/wiki/Memory_hierarchy ([Caches and one load](../lessons/07-registers-caches-and-a-memory-read.html))
- Memory management unit — https://en.wikipedia.org/wiki/Memory_management_unit ([From virtual address to RAM](../lessons/05-physical-ram-and-address-translation.html))
- Memory management#Manual memory management — https://en.wikipedia.org/wiki/Memory_management#Manual_memory_management ([Values, stack, heap, Box](../lessons/09-rust-values-stack-heap-and-box.html))
- Memory-mapped file — https://en.wikipedia.org/wiki/Memory-mapped_file ([Inside an address space](../lessons/04-virtual-memory.html))
- Operating system — https://en.wikipedia.org/wiki/Operating_system ([Processes and the kernel](../lessons/03-programs-processes-and-the-kernel.html))
- **[W-OOO]** Out-of-order execution — https://en.wikipedia.org/wiki/Out-of-order_execution ([How a CPU runs code](../lessons/02-how-a-cpu-runs-code.html))
- Page fault — https://en.wikipedia.org/wiki/Page_fault ([From virtual address to RAM](../lessons/05-physical-ram-and-address-translation.html))
- Page table — https://en.wikipedia.org/wiki/Page_table ([From virtual address to RAM](../lessons/05-physical-ram-and-address-translation.html))
- Paging — https://en.wikipedia.org/wiki/Paging ([From virtual address to RAM](../lessons/05-physical-ram-and-address-translation.html))
- Pointer (computer programming) — https://en.wikipedia.org/wiki/Pointer_(computer_programming) ([References and lifetimes](../lessons/12-references-borrowing-and-lifetimes.html))
- Process (computing) — https://en.wikipedia.org/wiki/Process_(computing) ([What a program is](../lessons/01-what-is-a-program.html) and [Processes and the kernel](../lessons/03-programs-processes-and-the-kernel.html))
- Processor register — https://en.wikipedia.org/wiki/Processor_register ([How a CPU runs code](../lessons/02-how-a-cpu-runs-code.html))
- Race condition#Data race — https://en.wikipedia.org/wiki/Race_condition#Data_race ([References and lifetimes](../lessons/12-references-borrowing-and-lifetimes.html))
- Random-access memory — https://en.wikipedia.org/wiki/Random-access_memory ([From virtual address to RAM](../lessons/05-physical-ram-and-address-translation.html))
- Scheduling (computing) — https://en.wikipedia.org/wiki/Scheduling_(computing) ([Processes and the kernel](../lessons/03-programs-processes-and-the-kernel.html))
- Stack (abstract data type) — https://en.wikipedia.org/wiki/Stack_(abstract_data_type) ([Calls and stack frames](../lessons/08-function-calls-and-stack-frames.html))
- Stack overflow — https://en.wikipedia.org/wiki/Stack_overflow ([Memory bugs and safety](../lessons/14-memory-bugs-and-rust-safety.html))
- Stack-based memory allocation — https://en.wikipedia.org/wiki/Stack-based_memory_allocation ([Calls and stack frames](../lessons/08-function-calls-and-stack-frames.html))
- System call — https://en.wikipedia.org/wiki/System_call ([Processes and the kernel](../lessons/03-programs-processes-and-the-kernel.html))
- Thread (computing) — https://en.wikipedia.org/wiki/Thread_(computing) ([Threads and their stacks](../lessons/06-threads-and-their-stacks.html))
- Translation lookaside buffer — https://en.wikipedia.org/wiki/Translation_lookaside_buffer ([From virtual address to RAM](../lessons/05-physical-ram-and-address-translation.html))
- UTF-8 — https://en.wikipedia.org/wiki/UTF-8 ([String and Vec](../lessons/10-string-and-vec-memory.html))
- Virtual memory — https://en.wikipedia.org/wiki/Virtual_memory ([Inside an address space](../lessons/04-virtual-memory.html), index)
