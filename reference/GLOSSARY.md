# Glossary

Each word here has one meaning, and it is used the same way everywhere. When a word means different things at different layers, both meanings are listed and the layer is named.

Layer tags: **[Rust]** language rule · **[Comp]** compiler, startup code, standard library, allocator · **[OS]** kernel · **[HW]** CPU and memory hardware.

---

## Programs and processes

**Source code** — Text a programmer writes, such as `main.rs`. The CPU never reads it.

**Compiler** [Comp] — A program that translates source code into machine code for a target. `rustc` checks the Rust rules, then hands its output to LLVM, which produces machine code. A linker joins the pieces into one executable.

**Machine code / instruction** [HW] — Bytes the CPU can decode and carry out. One instruction does a small job: add two registers, load from an address, jump, call.

**Executable** [Comp/OS] — A file that holds machine code, data, and the information the OS needs to load it. On Linux the format is ELF. The ELF header records the *entry point*, the address where execution starts.

**Program** — The instructions and data prepared for running, usually stored as an executable file. A program on disk does nothing by itself.

**Process** [OS] — A running instance of a program. The kernel gives it an address space, at least one thread, and resources such as open file descriptors. Running one program twice gives two processes.

**Kernel** [OS] — The part of the operating system that runs with full hardware privilege. It creates processes, sets up address spaces, schedules threads and handles faults.

**System call** [OS] — A request from a process to the kernel, such as "open this file" or "map more memory". The CPU switches into the kernel to handle it, then returns.

**Startup code** [Comp] — Code that runs after the kernel starts the process and before your `main`. For a Rust program on Linux this includes the dynamic loader, the C library's start routine, and `std::rt::lang_start`.

**Scheduler** [OS] — The part of the kernel that decides which runnable thread uses each CPU core next.

**Thread** [OS] — One path of execution inside a process. Each thread has its own register values (including its instruction pointer and stack pointer) and its own stack. Threads of one process share its address space.

**Initial thread / main thread** [OS] — The first thread of a process. Its stack is the one Linux labels `[stack]` in `/proc/PID/maps`. This is different from the function `main`.

## CPU

**CPU core** [HW] — A unit that executes instructions. A chip often has several.

**Register** [HW] — A small, very fast storage slot inside the core. Instructions name registers directly. Examples on x86-64: `rax`, `rdi`, `rsp`.

**General-purpose register** [HW] — A register used for ordinary values and addresses.

**Instruction pointer / program counter** [HW] — The register holding the address of the next instruction (`rip` on x86-64, `PC` on Arm).

**Stack pointer** [HW] — The register holding the address of the current top of the thread's stack (`rsp` on x86-64, `SP` on Arm).

**Flags / status register** [HW] — Bits set by instructions to record results such as "zero" or "overflowed". Later instructions can branch on them.

**Execution unit / ALU** [HW] — The circuitry that performs an operation such as an addition.

**Fetch–decode–execute** — A beginner model of what a core does with each instruction. Modern cores overlap many instructions and may run them out of order. The model is still the right first picture.

**Calling convention / ABI** [Comp] — The agreement between caller and callee about where arguments go, where the result goes, and which registers must be preserved. On x86-64 Linux, `extern "C"` functions follow the System V AMD64 ABI. Plain Rust functions use the "Rust" ABI, whose register use the Rust documentation does not spell out.

**Inlining** [Comp] — The compiler copying a function's body into its caller instead of emitting a call. An inlined function has no call, no return address and no [frame](../lessons/08-function-calls-and-stack-frames.html) of its own. In the optimised `sum.rs`, `total` was inlined into `main`.

## Addresses and memory

**Address** — A number that names one byte.

**Virtual address** [OS/HW] — An address as used by instructions inside a process. It only means something inside that one address space.

**Physical address** [HW] — An address on the memory bus that selects real RAM.

**Address space** [OS] — The full range of virtual addresses a process can use, together with the record of which ranges are mapped and with what permissions.

**Mapping** [OS] — A range of virtual addresses the kernel has set up, with permissions (read, write, execute) and a backing: a file, or anonymous zero-filled memory. Listed one per line in `/proc/PID/maps`.

**Anonymous mapping** [OS] — A mapping not backed by a file. Its pages start out as zeros.

**Virtual page** [OS/HW] — A fixed-size block of virtual addresses. Mappings are made in whole pages.

**Physical page frame** [HW/OS] — A page-sized block of physical RAM. A virtual page is mapped to a frame, not the other way round: the same frame can back pages in several processes.

**Page size** — The size of a page. 4096 bytes is common (it is the size on the machine the examples were run on). Arm also supports 16 KiB and 64 KiB granules, and both architectures support larger "huge" pages.

**Page offset** — The low bits of an address: which byte inside the page. Translation does not change it.

**Virtual page number (VPN)** — The high bits of a virtual address: which page.

**Page table** [OS/HW] — A data structure in memory, written by the kernel and read by the MMU, that records for each virtual page whether it is mapped, which frame backs it, and what access is allowed. Real page tables have several levels.

**Page table entry (PTE)** — One row of a page table: frame number plus bits such as valid/present, writable, executable.

**MMU (memory management unit)** [HW] — Hardware in the CPU that translates each virtual address to a physical address and checks permissions.

**TLB (translation lookaside buffer)** [HW] — A small cache inside the MMU that holds recent *translations* (page → frame). It does not hold data. A *TLB miss* means the hardware must walk the page table.

**Page fault** [HW→OS] — The exception the MMU raises when a translation is missing or forbidden. The kernel then decides. Often the access is legal and the kernel fixes it (allocates a zeroed page, reads from a file or swap) and the instruction is retried. If the address is not part of any mapping, or the access breaks the permissions, the kernel sends the process `SIGSEGV`.

**Demand paging** [OS] — Giving a mapped page physical memory only when it is first used.

**Resident** [OS] — Currently backed by a physical frame. The `Rss` field in `/proc/PID/smaps` counts resident memory.

**Swap** [OS] — Disk space the kernel can move anonymous pages to when RAM is short.

**RAM / DRAM** [HW] — Main memory. Much larger and much slower than the CPU's caches.

**Cache (CPU cache)** [HW] — Small, fast memory in the CPU that holds copies of recently used memory, in fixed-size *cache lines* (64 bytes on the machine used here). L1 is smallest and fastest; L2 and L3 are larger and slower. Which levels exist, their sizes and which cores share them differ between CPUs.

**Cache hit / miss** [HW] — Whether the requested line was found in a given cache.

**Cache line** [HW] — The fixed-size block in which caches store and move memory. A whole line is brought in when any byte of it is needed. 64 bytes on the machine the examples were run on; other CPUs can differ.

## Stack and heap

**Call stack (stack)** [Comp/OS] — A region of a thread's memory used last-in-first-out for function calls. Each active call can have a *stack frame* there. Each thread has its own.

**Stack frame** [Comp] — The part of the stack used by one active call: perhaps a return address, saved registers, and slots for locals that need memory. Its layout is chosen by the compiler and the ABI.

**Return address** [HW/Comp] — The address of the instruction to continue at after a call returns. On x86-64 `call` pushes it on the stack and `ret` pops it.

**Heap (allocation sense)** [Comp/OS] — Memory obtained at run time from an allocator, in any size, and kept until it is explicitly freed. Not the heap data structure.

**`[heap]` (map label)** [OS] — On Linux, the specific mapping grown with `brk`/`sbrk`. An allocator may also hand out memory from other anonymous mappings, so a heap allocation is not always inside `[heap]`.

**Allocator** [Comp] — The code that hands out and takes back heap memory. `Box`, `Vec` and `String` use Rust's *global allocator*. The standard library says the default one is unspecified. On the Linux machine the examples were run on, its behaviour matches the C library's `malloc`, which gets memory from the kernel with `brk` (the `[heap]` mapping) or, for large blocks, `mmap`.

**Allocation** — One block obtained from an allocator. Freeing it gives it back to the allocator, which may or may not give memory back to the kernel.

**Stack overflow** — A thread's stack running out of room, usually from very deep or endless recursion.

**Guard page** [OS] — Memory next to a stack that is deliberately left unmapped, so running off the end of the stack causes a fault instead of silently writing into other memory. Rust's standard library recognises such a fault and reports a [stack overflow](../lessons/14-memory-bugs-and-rust-safety.html).

## Rust

**Binding / variable** [Rust] — A name in source code, such as `scores`. It exists at compile time. At run time there may or may not be a memory location for it.

**Value** [Rust] — The thing a binding holds: `7`, or a `Vec` handle.

**Type** [Rust] — What a value is and how big it is, such as `i32` (4 bytes) or `Vec<i32>`.

**Owner** [Rust] — The binding (or containing value) responsible for a value. Each value has exactly one owner at a time.

**Drop** [Rust/Comp] — Running a value's cleanup code when its owner goes out of scope. For `Box`, `Vec` and `String`, dropping frees their heap allocation.

**Move** [Rust] — Transferring ownership. The bytes of the handle are copied to the new place, and the old binding can no longer be used. Heap contents are not copied.

**`Copy`** [Rust] — A marker for types (integers, `bool`, `char`, `f64`, …) whose values are duplicated on assignment; the old binding stays usable.

**`Clone`** [Rust] — An explicit call (`.clone()`) that creates an independent value. For `String` this means a new allocation with the same bytes.

**Handle** — The fixed-size part of a `Box`, `Vec` or `String`: a pointer (and for `Vec`/`String`, a length and capacity). It is a value like any other. The data it points to is a separate allocation.

**`Box<T>`** [Rust/Comp] — A pointer that owns one `T` stored in a heap allocation and frees it when dropped.

**`Vec<T>`** [Rust/Comp] — A growable list of `T` kept contiguously in one heap buffer. Its handle is a (pointer, capacity, length) triplet; the order of those fields is unspecified.

**Length** — How many elements a `Vec` holds now. For a `String`, how many *bytes*.

**Capacity** — How many elements a `Vec` can hold before it must reallocate. For a `String`, in bytes.

**Reallocation** — Getting a bigger buffer, moving the elements into it, and freeing the old one. The elements' addresses change.

**`String`** [Rust/Comp] — A growable, owned, UTF-8 string. Same shape as a `Vec<u8>`.

**`&str` / string literal** [Rust] — A borrowed view of UTF-8 bytes. A literal such as `"hi"` is a `&'static str` pointing into the executable's read-only data; it allocates nothing.

**Reference** [Rust] — A value that lets code reach another value without owning it. `&T` is a shared reference; `&mut T` is a mutable (exclusive) reference. At run time it is an address.

**Slice** [Rust] — A view of a run of elements stored next to each other, such as part or all of a `Vec`'s buffer. A reference to a slice, `&[T]`, carries an address and a length (16 bytes on x86-64).

**Borrow** [Rust] — Creating a reference. The borrow lasts from where the reference is made to its last use.

**Lifetime** [Rust] — The stretch of the program over which a reference must stay valid. A lifetime annotation (`'a`) names a relationship between references so the compiler can check it. It changes nothing at run time.

**Borrow checker** [Rust/Comp] — The part of `rustc` that checks ownership and borrowing rules. It runs at compile time.

**Iterator** [Rust] — A value with a `next` method that yields one item at a time. It is separate from the collection it walks.

**Panic** [Rust] — An orderly failure: the thread stops (usually unwinding and running drops) and reports a message. Not memory corruption.

**Undefined behaviour (UB)** [Rust] — Behaviour the language gives no meaning to, such as reading through a dangling pointer. Once it happens, the program may do anything. Safe Rust cannot cause it; `unsafe` code must avoid it by hand.

**`unsafe`** [Rust] — A block or function in which the programmer, not the compiler, promises certain rules hold (for example, that a raw pointer is valid).

**Raw pointer** [Rust] — `*const T` or `*mut T`: an address with none of a reference's rules. Creating one is safe; reading or writing through one requires `unsafe`, and the compiler no longer checks that it points to a live value.

**Dangling pointer / reference** — A pointer to memory that is no longer a live allocation of the expected value.

**`Send` / `Sync`** [Rust] — Marker traits. `Send`: safe to move to another thread. `Sync`: safe to share `&T` between threads.
