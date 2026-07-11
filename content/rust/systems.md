---
stack: rust
id: rust-systems
title: "Rust: Concurrencia, async y performance"
area: Backend
priority: high
resourceLabel: The Rust Async Book
resourceUrl: https://rust-lang.github.io/async-book/
---

## Summary
Rust garantiza "fearless concurrency" mediante los traits `Send` y `Sync`, que el compilador verifica estáticamente para eliminar data races en tiempo de compilación. El modelo async/await de Rust se basa en `Future`s lazys que un runtime como Tokio ejecuta sobre un pool de threads, ideal para trabajo I/O-bound sin el costo de OS threads. Los smart pointers (`Box`, `Rc`, `Arc`, `RefCell`) ofrecen distintos modelos de ownership y mutabilidad compartida, cubriendo casos desde heap allocation simple hasta estado mutable compartido entre threads. Las abstracciones de Rust son zero-cost: iteradores, genéricos y async se compilan a código equivalente a lo que escribirías a mano, sin overhead de runtime.

## Concepts

### Concurrencia sin data races
#### Details
Los traits `Send` y `Sync` son la base del sistema de concurrencia de Rust: `Send` indica que un tipo puede transferirse a otro thread, y `Sync` que puede ser referenciado desde múltiples threads simultáneamente; el compilador los implementa automáticamente cuando es seguro y rechaza el código que los viola. `Arc<T>` (atomic reference counted) provee ownership compartido entre threads de manera segura, a diferencia de `Rc<T>` que no implementa `Send` y solo puede usarse en un único thread. Para estado mutable compartido, `Arc<Mutex<T>>` es el patrón estándar: `Mutex` garantiza acceso exclusivo y su `MutexGuard` libera el lock automáticamente al hacer drop. `Arc<RwLock<T>>` es preferible cuando hay muchas más lecturas que escrituras, ya que permite múltiples lectores concurrentes o un único escritor. Los canales `mpsc` (multi-producer single-consumer) ofrecen message passing como alternativa al estado compartido: se puede clonar el sender para múltiples productores, y los datos se transfieren entre threads en lugar de compartirse. La razón por la que se llama "fearless concurrency" es que si el código compila, es imposible que tenga data races; las violaciones de `Send`/`Sync` son errores de compilación, no bugs en runtime.

#### Examples
`Arc<Mutex<T>>` compartido entre múltiples threads
```rust
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let counter = Arc::new(Mutex::new(0u32));
    let mut handles = vec![];

    for _ in 0..5 {
        let counter = Arc::clone(&counter);
        let handle = thread::spawn(move || {
            let mut val = counter.lock().unwrap();
            *val += 1;
            // MutexGuard drops here, releasing the lock
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.join().unwrap();
    }

    println!("counter = {}", *counter.lock().unwrap()); // 5
}
```

`mpsc` channel enviando valores entre threads
```rust
use std::sync::mpsc;
use std::thread;

fn main() {
    let (tx, rx) = mpsc::channel();
    let tx2 = tx.clone();

    thread::spawn(move || tx.send("hello from thread 1").unwrap());
    thread::spawn(move || tx2.send("hello from thread 2").unwrap());

    for msg in rx.iter().take(2) {
        println!("received: {msg}");
    }
}
```

#### Sources
- [Fearless Concurrency](https://doc.rust-lang.org/book/ch16-00-concurrency.html)
- [std::sync::Mutex](https://doc.rust-lang.org/std/sync/struct.Mutex.html)
- [std::sync::mpsc](https://doc.rust-lang.org/std/sync/mpsc/index.html)

---

### Async/await y el modelo de Futures
#### Details
El trait `Future` representa un valor que aún no fue computado; su método `poll()` lo lleva a completarse paso a paso, y los futures son lazy: no hacen nada hasta que un runtime los ejecuta mediante polling. `async fn` transforma una función para que retorne `impl Future<Output = T>`; el operador `await` suspende la tarea actual y cede el control al runtime (no bloquea el thread del OS), permitiendo que otras tareas avancen en el mientras. La diferencia clave con threads es que las tareas async son livianas (no son OS threads), por lo que miles pueden coexistir sobre unos pocos threads; son ideales para trabajo I/O-bound, mientras que los threads siguen siendo mejores para trabajo CPU-bound. Tokio es el runtime async dominante en el ecosistema: provee el executor, el reactor de I/O, y versiones async de las primitivas de la std (archivos, red, time, sincronización). Un error frecuente es hacer llamadas bloqueantes (lectura de archivo con std, `thread::sleep`) dentro de código async; eso bloquea el thread del executor y degrada el rendimiento; la solución es `tokio::task::spawn_blocking` para offloading. Para paralelismo real dentro de async se usa `tokio::spawn`, que crea una tarea concurrente y retorna un `JoinHandle` similar a `thread::spawn`.

#### Examples
`async fn` básico con `await` y `tokio::main`
```rust
use tokio::time::{sleep, Duration};

async fn fetch_data(id: u32) -> String {
    sleep(Duration::from_millis(100)).await;
    format!("data for id={id}")
}

#[tokio::main]
async fn main() {
    let result = fetch_data(42).await;
    println!("{result}");
}
```

`tokio::spawn` para tareas verdaderamente concurrentes
```rust
use tokio::task::JoinHandle;
use tokio::time::{sleep, Duration};

async fn work(name: &'static str) -> String {
    sleep(Duration::from_millis(50)).await;
    format!("{name} done")
}

#[tokio::main]
async fn main() {
    let h1: JoinHandle<String> = tokio::spawn(work("task-a"));
    let h2: JoinHandle<String> = tokio::spawn(work("task-b"));

    let (r1, r2) = tokio::join!(h1, h2);
    println!("{}", r1.unwrap());
    println!("{}", r2.unwrap());
}
```

#### Sources
- [Async Book, Getting Started](https://rust-lang.github.io/async-book/01_getting_started/01_chapter.html)
- [std::future::Future](https://doc.rust-lang.org/std/future/trait.Future.html)
- [Async/Await](https://doc.rust-lang.org/book/ch17-00-async-await.html)

---

### Smart pointers
#### Details
`Box<T>` asigna un valor en el heap con ownership único; se usa cuando necesitás un puntero de tamaño conocido a un valor en heap, para tipos recursivos (el compilador necesita conocer el tamaño en compilación), valores grandes que no querés copiar, o trait objects (`Box<dyn Trait>`). `Rc<T>` provee ownership compartido con reference counting en un único thread; clonar un `Rc` incrementa el contador y el valor se destruye cuando el contador llega a cero; NO implementa `Send`, por lo que no puede cruzar thread boundaries. `Arc<T>` es la versión thread-safe de `Rc`: usa operaciones atómicas para el conteo, lo que tiene un pequeño costo de runtime pero permite compartir datos entre threads. `RefCell<T>` implementa interior mutability: permite mutar datos a través de una referencia compartida (`&T`); el borrow checking ocurre en runtime en lugar de compile time, y viola las reglas provoca un panic en lugar de un error de compilación. El patrón `Rc<RefCell<T>>` es el estándar para estado mutable compartido dentro de un único thread (por ejemplo, nodos de un grafo o árbol). Los ciclos de referencias entre `Rc` impiden la desalocación; se rompen usando `Weak<T>`, que es una referencia no-owning que no incrementa el strong count.

#### Examples
`Box<T>` para una estructura de datos recursiva
```rust
// Without Box, the compiler cannot determine the size of List
enum List {
    Cons(i32, Box<List>),
    Nil,
}

fn main() {
    let list = List::Cons(1,
        Box::new(List::Cons(2,
            Box::new(List::Nil))));

    if let List::Cons(val, _) = list {
        println!("head = {val}"); // head = 1
    }
}
```

`Rc<RefCell<T>>` para estado mutable compartido en un solo thread
```rust
use std::cell::RefCell;
use std::rc::Rc;

fn main() {
    let shared = Rc::new(RefCell::new(vec![1, 2, 3]));

    let a = Rc::clone(&shared);
    let b = Rc::clone(&shared);

    a.borrow_mut().push(4); // mutate through clone a
    b.borrow_mut().push(5); // mutate through clone b

    println!("{:?}", shared.borrow()); // [1, 2, 3, 4, 5]
}
```

#### Sources
- [Smart Pointers](https://doc.rust-lang.org/book/ch15-00-smart-pointers.html)
- [std::rc::Rc](https://doc.rust-lang.org/std/rc/struct.Rc.html)
- [std::cell::RefCell](https://doc.rust-lang.org/std/cell/struct.RefCell.html)

---

### Unsafe Rust
#### Details
Las garantías de Safe Rust (sin undefined behavior, sin data races, sin dangling pointers) son verificadas por el compilador; `unsafe` levanta exactamente 5 restricciones y nada más. Los 5 superpoderes de `unsafe` son: (1) desreferenciar raw pointers (`*const T`, `*mut T`), (2) llamar funciones unsafe, (3) acceder o modificar variables estáticas mutables, (4) implementar traits unsafe, (5) acceder a campos de unions. `unsafe` NO desactiva el borrow checker ni el sistema de tipos: todas las demás reglas de Safe Rust siguen vigentes; solo habilita esas 5 operaciones específicas. Los usos legítimos incluyen FFI (llamar bibliotecas C), operaciones de performance que el borrow checker no puede verificar (como transmutación de slices o SIMD), y construir abstracciones seguras sobre operaciones inherentemente inseguras (como la gestión interna del buffer de `Vec`). El principio clave es aislar el código unsafe en el scope más pequeño posible y envolverlo en una API pública segura para que los callers no necesiten usar `unsafe`; se deben documentar los invariantes que el programador es responsable de mantener. Cada bloque `unsafe` es un contrato: el programador le está diciendo al compilador "verifiqué que esto es seguro aunque vos no podés hacerlo".

#### Examples
Desreferenciando un raw pointer en un bloque unsafe
```rust
fn main() {
    let x: i32 = 42;
    let raw: *const i32 = &x;

    // Safe Rust cannot dereference raw pointers
    let value = unsafe { *raw };
    println!("value = {value}"); // 42
}
```

Wrapper seguro alrededor de una operación unsafe
```rust
/// Returns the first element of a slice without bounds checking.
/// # Safety
/// Caller must guarantee that `slice` is non-empty.
unsafe fn first_unchecked(slice: &[i32]) -> i32 {
    *slice.get_unchecked(0)
}

/// Safe public API, panics on empty slice instead of UB.
fn first(slice: &[i32]) -> Option<i32> {
    if slice.is_empty() {
        None
    } else {
        // SAFETY: we just checked that the slice is non-empty.
        Some(unsafe { first_unchecked(slice) })
    }
}

fn main() {
    println!("{:?}", first(&[10, 20, 30])); // Some(10)
    println!("{:?}", first(&[]));            // None
}
```

#### Sources
- [Unsafe Rust](https://doc.rust-lang.org/book/ch19-01-unsafe-rust.html)
- [Unsafe Code Guidelines](https://doc.rust-lang.org/reference/unsafe-code-guidelines.html)
- [std::ptr](https://doc.rust-lang.org/std/ptr/index.html)

---

### Performance y zero-cost abstractions
#### Details
El principio de zero-cost abstraction es "lo que no usás, no lo pagás; lo que sí usás, no podrías haberlo codificado mejor a mano" (Bjarne Stroustrup); Rust lo aplica a iteradores, genéricos y async, que se compilan a instrucciones equivalentes a un loop manual. La monomorphization compila funciones genéricas en implementaciones concretas separadas por cada tipo utilizado, eliminando el costo de generics en runtime (a diferencia del type erasure de Java o el boxing de Go). Las asignaciones en stack son prácticamente gratuitas (solo mover el stack pointer), mientras que las asignaciones en heap invocan al allocator; se prefiere el stack cuando el tamaño es conocido en compile time. Evitar `.clone()` innecesarios es crítico: clonar copia datos del heap; preferir `&T`, `.as_ref()`, o `Cow<str>`/`Cow<[u8]>` para funciones que a veces necesitan ownership y a veces no. El atributo `#[inline]` es un hint para que el compilador inserte el código de una función en el call site, reduciendo el overhead de llamada para funciones pequeñas y frecuentes; `#[inline(always)]` lo fuerza, pero rara vez es necesario dado el agresivo inlining automático del compilador. El flujo correcto es perfilar antes de optimizar: `cargo flamegraph` para CPU profiling y `criterion` para micro-benchmarks reproducibles; el compilador en modo `--release` aplica optimizaciones agresivas (-O2 equivalente) que hacen irrelevantes muchas micro-optimizaciones prematuras.

#### Examples
Cadena de iteradores zero-cost comparada con un loop explícito
```rust
fn sum_of_evens_iter(data: &[u32]) -> u64 {
    // The compiler emits virtually identical assembly to the loop below
    data.iter()
        .filter(|&&x| x % 2 == 0)
        .map(|&x| x as u64)
        .sum()
}

fn sum_of_evens_loop(data: &[u32]) -> u64 {
    let mut total = 0u64;
    for &x in data {
        if x % 2 == 0 {
            total += x as u64;
        }
    }
    total
}

fn main() {
    let data = vec![1u32, 2, 3, 4, 5, 6];
    assert_eq!(sum_of_evens_iter(&data), sum_of_evens_loop(&data));
    println!("both = {}", sum_of_evens_iter(&data)); // 12
}
```

`Cow<str>` para evitar allocations cuando la modificación es opcional
```rust
use std::borrow::Cow;

fn ensure_uppercase(s: &str) -> Cow<str> {
    if s.chars().all(|c| c.is_uppercase() || !c.is_alphabetic()) {
        Cow::Borrowed(s) // no allocation, borrow the original
    } else {
        Cow::Owned(s.to_uppercase()) // allocate only when needed
    }
}

fn main() {
    let already_upper = "HELLO";
    let mixed = "Hello, World";

    println!("{}", ensure_uppercase(already_upper)); // HELLO, no alloc
    println!("{}", ensure_uppercase(mixed));          // HELLO, WORLD, alloc
}
```

#### Sources
- [Performance](https://doc.rust-lang.org/book/ch13-04-performance.html)
- [std::borrow::Cow](https://doc.rust-lang.org/std/borrow/enum.Cow.html)
- [The Rustonomicon, Data Layout](https://doc.rust-lang.org/nomicon/data.html)

---
