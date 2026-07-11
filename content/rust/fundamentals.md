---
stack: rust
id: rust-fundamentals
title: "Rust: Ownership, tipos y traits"
area: Backend
priority: high
resourceLabel: The Rust Programming Language
resourceUrl: https://doc.rust-lang.org/book/
---

## Summary

Rust basa su seguridad de memoria en el modelo de ownership: el compilador garantiza en tiempo de compilación que no existen use-after-free, dangling pointers ni data races, sin necesidad de un garbage collector. El sistema de tipos combina structs y enums como tipos suma, permitiendo modelar estados con Option<T> y Result<T,E> en lugar de nulos o excepciones. Los traits y los genéricos habilitan abstracciones de costo cero: el compilador monomorfa el código genérico en implementaciones concretas, y el dispatch dinámico queda reservado para los casos donde la heterogeneidad en tiempo de ejecución es realmente necesaria. Los iteradores y los closures completan el modelo funcional de Rust, compilando a código equivalente a un for loop manual, sin asignaciones intermedias en el heap.

## Concepts

### 1. Ownership, borrowing y lifetimes

#### Details

Rust aplica tres reglas de ownership que el compilador verifica estáticamente: cada valor tiene exactamente un propietario, cuando ese propietario sale de scope el valor es liberado (dropped), y asignar un valor a otra variable transfiere (move) la propiedad, invalidando el binding anterior. Los tipos que implementan el trait Copy (i32, bool, f64, char, y tuplas de Copy types) se copian en lugar de moverse, porque viven en el stack y su duplicación es trivial; los tipos heap como String o Vec no implementan Copy por defecto. El mecanismo de borrowing permite referencias sin transferir propiedad: pueden existir múltiples referencias inmutables (&T) simultáneamente, pero solo una referencia mutable (&mut T) y ninguna inmutable al mismo tiempo, regla que elimina data races en compilación. El borrow checker garantiza además que ninguna referencia outlive el dato que apunta, lo que previene dangling pointers sin necesidad de runtime checks. Los lifetimes son anotaciones (p. ej. `'a`) que el compilador infiere en la mayoría de los casos mediante lifetime elision; solo se escriben explícitamente en firmas de funciones o structs que almacenan referencias. Los errores más comunes son "cannot borrow as mutable because it is also borrowed as immutable" y "does not live long enough".

#### Examples

```rust
// Move semantics vs Copy types
fn main() {
    let s1 = String::from("hello"); // heap-allocated, not Copy
    let s2 = s1;                    // s1 is moved into s2
    // println!("{}", s1);          // compile error: s1 was moved

    let x: i32 = 5;  // Copy type
    let y = x;        // x is copied, not moved
    println!("{} {}", x, y); // both valid
}
```

```rust
// Borrow checker preventing aliased mutation
fn main() {
    let mut data = vec![1, 2, 3];

    let first = &data[0];      // immutable borrow
    // data.push(4);            // compile error: cannot borrow `data` as mutable
                                // because it is also borrowed as immutable
    println!("{}", first);     // immutable borrow used here

    data.push(4);              // ok: immutable borrow no longer active
}
```

#### Sources

- [Ownership](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html)
- [References and Borrowing](https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html)
- [Lifetimes](https://doc.rust-lang.org/book/ch10-03-lifetime-syntax.html)

---

### 2. Sistema de tipos: structs, enums y pattern matching

#### Details

Los structs agrupan campos con nombre bajo un tipo compuesto; existen también los tuple structs (campos sin nombre) y los unit structs (sin campos, usados como marcadores de tipo). Los enums son tipos suma donde cada variante puede llevar datos de forma distinta, una variante puede ser unit, otra llevar un String, otra un struct anónimo, lo que los hace más expresivos que las jerarquías de clases para representar estados mutuamente excluyentes. `Option<T>` reemplaza al null: el compilador obliga a manejar tanto Some(T) como None antes de usar el valor interno, eliminando el billion-dollar mistake. `Result<T, E>` codifica éxito o fallo en el tipo mismo, forzando el tratamiento del error en el call site; el operador `?` propaga automáticamente el `Err` al caller, eliminando cadenas de match. El `match` en Rust es exhaustivo: si falta algún patrón, el compilador emite un error; además puede destructurar structs y enums, y admite guards con `if`. Las formas `if let` y `while let` son alternativas ergonómicas cuando solo importa un único patrón y no tiene sentido escribir un match completo.

#### Examples

```rust
// Enum with per-variant data + match expression
#[derive(Debug)]
enum Message {
    Quit,
    Move { x: i32, y: i32 },
    Write(String),
    ChangeColor(u8, u8, u8),
}

fn process(msg: Message) {
    match msg {
        Message::Quit => println!("quit"),
        Message::Move { x, y } => println!("move to ({x}, {y})"),
        Message::Write(text) => println!("write: {text}"),
        Message::ChangeColor(r, g, b) => println!("color: {r},{g},{b}"),
    }
}
```

```rust
// Option<T> and Result<T,E> with if let and ?
use std::num::ParseIntError;

fn parse_and_double(s: &str) -> Result<i32, ParseIntError> {
    let n = s.trim().parse::<i32>()?; // ? propagates ParseIntError
    Ok(n * 2)
}

fn main() {
    let maybe: Option<i32> = Some(42);
    if let Some(value) = maybe {
        println!("got {value}");
    }

    match parse_and_double("21") {
        Ok(result) => println!("result: {result}"),
        Err(e) => println!("error: {e}"),
    }
}
```

#### Sources

- [Enums](https://doc.rust-lang.org/book/ch06-00-enums.html)
- [Pattern Matching](https://doc.rust-lang.org/book/ch18-00-patterns.html)
- [Structs](https://doc.rust-lang.org/book/ch05-00-structs.html)

---

### 3. Traits y generics

#### Details

Un trait define un contrato de comportamiento, un conjunto de métodos que un tipo debe implementar, sin implicar herencia; un mismo tipo puede implementar múltiples traits de forma independiente. Las funciones y tipos genéricos expresan restricciones sobre el tipo parámetro mediante trait bounds: `fn print_all<T: Display>(items: &[T])` acepta cualquier slice cuyos elementos implementen Display. El dispatch estático (monomorphization) hace que el compilador genere una versión especializada por cada tipo concreto que use la función genérica, resultando en código con costo cero en tiempo de ejecución, no hay indirección ni vtable. El dispatch dinámico con `dyn Trait` (trait objects) habilita colecciones heterogéneas como `Vec<Box<dyn Animal>>` mediante una vtable en tiempo de ejecución; el tradeoff es la asignación en heap y el overhead del virtual dispatch, a cambio de flexibilidad polimórfica real. Las blanket implementations permiten implementar un trait para todos los tipos que satisfagan una restricción: `impl<T: Display> MyTrait for T` cubre automáticamente cualquier T que ya implemente Display. Algunos traits estándar clave son: From/Into para conversiones sin pérdida, Display/Debug para formateo, Iterator para colecciones iterables, y Clone/Copy para semántica de duplicación.

#### Examples

```rust
use std::fmt::Display;

// Generic function with trait bound (static dispatch)
fn largest<T: PartialOrd>(list: &[T]) -> &T {
    let mut biggest = &list[0];
    for item in list {
        if item > biggest {
            biggest = item;
        }
    }
    biggest
}

// Dynamic dispatch via trait object
trait Animal {
    fn sound(&self) -> &str;
}

struct Dog;
struct Cat;

impl Animal for Dog { fn sound(&self) -> &str { "woof" } }
impl Animal for Cat { fn sound(&self) -> &str { "meow" } }

fn make_sounds(animals: &[Box<dyn Animal>]) {
    for a in animals {
        println!("{}", a.sound()); // vtable dispatch at runtime
    }
}
```

```rust
// From/Into conversion implementation
struct Celsius(f64);
struct Fahrenheit(f64);

impl From<Celsius> for Fahrenheit {
    fn from(c: Celsius) -> Self {
        Fahrenheit(c.0 * 9.0 / 5.0 + 32.0)
    }
}

fn main() {
    let boiling = Celsius(100.0);
    let f: Fahrenheit = boiling.into(); // Into is auto-derived from From
    println!("{:.1}°F", f.0);
}
```

#### Sources

- [Traits](https://doc.rust-lang.org/book/ch10-02-traits.html)
- [Generics](https://doc.rust-lang.org/book/ch10-00-generics.html)
- [std trait catalog](https://doc.rust-lang.org/std/index.html#traits)

---

### 4. Manejo de errores

#### Details

Rust no tiene excepciones; los errores son valores ordinarios del tipo `Result<T, E>` para situaciones recuperables, y `panic!` para violaciones de invariantes que indican un bug en el programa. El operador `?` simplifica la propagación: aplicado sobre un `Result`, si es `Err` retorna inmediatamente del caller con ese error; si es `Ok`, desenvuelve el valor, equivale a un match completo pero sin el boilerplate. Para errores de biblioteca conviene definir tipos de error propios que implementen `std::error::Error`, `Display` y `Debug`, añadiendo contexto semántico al error. El crate `thiserror` provee un derive macro para tipos de error de biblioteca; el crate `anyhow` facilita el boxing de cualquier error con contexto adicional en código de aplicación donde no importa el tipo concreto. El `panic!` es apropiado para errores de programación, índice fuera de rango, parseo de datos que el programador sabe que son válidos, nunca para errores esperables del usuario o del entorno. En código de producción hay que evitar `.unwrap()` y `.expect()` salvo en tests o cuando se puede garantizar lógicamente que el valor es `Ok`/`Some`.

#### Examples

```rust
use std::fs;
use std::io;

// ? operator propagates errors up the call stack
fn read_username(path: &str) -> Result<String, io::Error> {
    let content = fs::read_to_string(path)?; // returns Err early if file missing
    let username = content.lines().next()
        .ok_or(io::Error::new(io::ErrorKind::InvalidData, "empty file"))?;
    Ok(username.to_string())
}
```

```rust
use std::fmt;

// Custom error type (thiserror-style manual implementation)
#[derive(Debug)]
enum AppError {
    Io(std::io::Error),
    Parse(std::num::ParseIntError),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::Io(e) => write!(f, "I/O error: {e}"),
            AppError::Parse(e) => write!(f, "parse error: {e}"),
        }
    }
}

impl std::error::Error for AppError {}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self { AppError::Io(e) }
}

impl From<std::num::ParseIntError> for AppError {
    fn from(e: std::num::ParseIntError) -> Self { AppError::Parse(e) }
}
```

#### Sources

- [Error Handling](https://doc.rust-lang.org/book/ch09-00-error-handling.html)
- [std::result](https://doc.rust-lang.org/std/result/)
- [std::error::Error](https://doc.rust-lang.org/std/error/trait.Error.html)

---

### 5. Iteradores y closures

#### Details

El trait `Iterator` requiere implementar un único método `next() -> Option<Self::Item>`; cualquier tipo que lo implemente se vuelve iterable con el ecosistema completo de adaptadores de la biblioteca estándar. Los adaptadores, map, filter, flat_map, take, skip, zip, enumerate, chain, son lazy: no evalúan nada hasta que un método consumidor los llama, evitando asignaciones intermedias. Los consumidores, collect(), count(), sum(), fold(), for_each(), desencadenan la evaluación de la cadena completa de adaptadores en una sola pasada. Las cadenas de iteradores compilan a ensamblador equivalente a un for loop manual gracias a la monomorphization e inlining del compilador, zero-cost abstraction sin overhead de runtime. Los closures son funciones anónimas que capturan su entorno: `|x| x * 2`; el compilador infiere si la captura es por referencia (&), referencia mutable (&mut), o por valor (move) según el uso del closure. Los move closures fuerzan la captura por valor, necesaria cuando el closure debe sobrevivir al scope actual, por ejemplo al spawnar un thread o devolver el closure desde una función.

#### Examples

```rust
fn main() {
    let numbers = vec![1, 2, 3, 4, 5, 6, 7, 8];

    // Iterator chain: lazy adapters + consuming collect()
    let result: Vec<i32> = numbers
        .iter()
        .filter(|&&x| x % 2 == 0) // keep evens
        .map(|&x| x * x)           // square them
        .collect();                 // triggers evaluation

    println!("{:?}", result); // [4, 16, 36, 64]
}
```

```rust
use std::thread;

fn main() {
    let message = String::from("hello from thread");

    // Without move: closure borrows `message`, compiler error if thread outlives scope
    // With move: closure takes ownership of `message`
    let handle = thread::spawn(move || {
        println!("{message}");
    });

    // message is no longer accessible here, ownership was moved into the closure
    handle.join().unwrap();

    // Non-move closure (captures by reference, valid while data lives)
    let factor = 3;
    let multiply = |x: i32| x * factor; // borrows `factor`
    println!("{}", multiply(7));         // 21
}
```

#### Sources

- [Iterators](https://doc.rust-lang.org/book/ch13-02-iterators.html)
- [Closures](https://doc.rust-lang.org/book/ch13-01-closures.html)
- [std::iter::Iterator](https://doc.rust-lang.org/std/iter/trait.Iterator.html)

---
