---
stack: rust
kind: question-bank
source: curated
sourceUrl: https://doc.rust-lang.org
license: curated
copyright: Written from scratch citing official documentation
---

## Interview Questions

### ¿Cuáles son las tres reglas del sistema de ownership en Rust y por qué existen?

Las tres reglas son: cada valor tiene exactamente un dueño, solo puede haber un dueño a la vez, y cuando el dueño sale de scope el valor se libera. Estas reglas existen para garantizar la seguridad de memoria sin necesidad de un garbage collector, eliminando errores como use-after-free y double-free en tiempo de compilación. Al forzar un modelo de propiedad único, el compilador sabe exactamente cuándo liberar memoria, lo que hace innecesario rastrear referencias en runtime. La combinación de estas tres reglas con el sistema de borrowing crea un contrato de memoria verificable estáticamente.

```rust
fn main() {
    let s1 = String::from("hola"); // s1 es el dueño
    let s2 = s1;                   // ownership se mueve a s2
    // println!("{}", s1);         // Error: s1 ya no es válido
    println!("{}", s2);
}
```

Fuente: https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html

---

### ¿Qué diferencia hay entre mover (move) y copiar (copy) un valor? ¿Qué tipos implementan Copy?

Cuando un tipo implementa el trait `Copy`, asignar o pasar ese valor a una función crea una copia bit a bit, y el original sigue siendo válido. Si un tipo no implementa `Copy`, la asignación transfiere el ownership (move), invalidando el original. Los tipos que implementan `Copy` son aquellos cuya copia bit a bit es siempre segura y barata: todos los enteros (`i32`, `u64`, etc.), `f32`, `f64`, `bool`, `char`, y tuplas o arrays de tipos que también son `Copy`. Tipos que gestionan recursos del heap, como `String` o `Vec<T>`, no pueden implementar `Copy` porque copiarlos significaría tener dos dueños del mismo buffer.

```rust
let x: i32 = 5;
let y = x; // copia, x sigue siendo válido
println!("{} {}", x, y); // OK

let s1 = String::from("hola");
let s2 = s1; // move, s1 ya no es válido
```

Fuente: https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html

---

### ¿Cómo funciona el borrow checker y qué clase de bugs previene en tiempo de compilación?

El borrow checker es la parte del compilador de Rust que analiza el flujo de referencias para garantizar que nunca existan referencias inválidas. Aplica dos reglas fundamentales: se pueden tener múltiples referencias inmutables (`&T`) simultáneamente, pero solo una referencia mutable (`&mut T`) exclusiva, y esas categorías son mutuamente excluyentes. Esto previene data races en concurrencia single-thread, use-after-free (referenciar datos ya liberados), e invalidación de iteradores. El análisis ocurre íntegramente en compilación sin costo en runtime.

```rust
let mut v = vec![1, 2, 3];
let first = &v[0];      // referencia inmutable
v.push(4);              // Error: no se puede mutar mientras hay una referencia activa
println!("{}", first);
```

Fuente: https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html

---

### ¿Cuántas referencias mutables pueden coexistir con referencias inmutables al mismo dato?

Ninguna. Rust impone exclusividad mutua: en cualquier punto del código, un dato puede tener múltiples referencias inmutables (`&T`) activas simultáneamente, o exactamente una referencia mutable (`&mut T`), pero nunca ambas al mismo tiempo. Esta regla elimina la posibilidad de que un lector observe un estado inconsistente mientras otro código modifica el dato. El compilador verifica estos invariantes usando lifetimes para determinar el scope de cada referencia, no el tiempo de ejecución.

```rust
let mut data = 42;
let r1 = &data;
let r2 = &data;   // OK: múltiples referencias inmutables
// let rm = &mut data; // Error: no puede coexistir con r1 o r2
println!("{} {}", r1, r2);
```

Fuente: https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html

---

### ¿Qué es un dangling pointer y cómo Rust lo previene sin garbage collector?

Un dangling pointer es una referencia que apunta a memoria que ya fue liberada, típicamente porque el dueño del dato salió de scope mientras la referencia seguía viva. Rust lo previene mediante el sistema de lifetimes: el compilador garantiza que toda referencia tiene un lifetime menor o igual al del dato al que apunta. Si una función intenta retornar una referencia a una variable local, el compilador rechaza el código porque el lifetime de la variable termina al salir de la función. No hay runtime check ni GC: es análisis estático puro.

```rust
fn dangles() -> &String { // Error: lifetime inválido
    let s = String::from("hola");
    &s // s se libera al salir, la referencia quedaría colgada
}
```

Fuente: https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html

---

### ¿Cuándo necesitás anotar lifetimes explícitamente en una función o un struct?

Necesitás anotar lifetimes cuando el compilador no puede inferir la relación entre los lifetimes de múltiples referencias en la firma de una función o en los campos de un struct. En una función con múltiples parámetros de referencia y un valor de retorno que también es referencia, el compilador no sabe a cuál de los parámetros está ligado el valor retornado, por lo que debés declararlo explícitamente. En structs que almacenan referencias como campos, siempre se requiere anotar el lifetime para que el compilador garantice que la instancia no sobrevive al dato referenciado. Las anotaciones no cambian los lifetimes reales; solo documentan relaciones que el compilador necesita verificar.

```rust
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}
```

Fuente: https://doc.rust-lang.org/book/ch10-03-lifetime-syntax.html

---

### ¿Qué significa "lifetime elision" y cuándo aplica el compilador las reglas automáticamente?

Lifetime elision son las tres reglas que el compilador aplica automáticamente para inferir lifetimes en firmas de funciones, evitando que el programador tenga que anotarlos en casos comunes. La primera regla asigna un lifetime distinto a cada parámetro de referencia. La segunda dice que si hay exactamente un parámetro de referencia, su lifetime se aplica a todas las referencias de retorno. La tercera dice que si hay un parámetro `&self` o `&mut self`, su lifetime se aplica a todas las referencias de retorno. Cuando estas reglas no son suficientes para inferir todos los lifetimes, el compilador exige anotaciones explícitas.

```rust
// Con elision (el compilador infiere 'a):
fn first_word(s: &str) -> &str { ... }

// Sin elision (equivalente explícito):
fn first_word<'a>(s: &'a str) -> &'a str { ... }
```

Fuente: https://doc.rust-lang.org/book/ch10-03-lifetime-syntax.html

---

### Describí un escenario real donde el borrow checker te fuerza a redesignar la lógica para mejor.

Un patrón frecuente es querer iterar sobre una colección y modificarla dentro del mismo loop: el borrow checker rechaza este código porque el iterador mantiene una referencia inmutable al vector mientras el cuerpo del loop intenta mutarlo. La solución correcta es separar la fase de lectura de la fase de mutación: primero recolectar los índices o valores a modificar, luego aplicar las modificaciones en un segundo paso. Este rediseño no solo satisface al compilador sino que produce código más claro y predecible, ya que evita la ambigüedad sobre qué estado tiene la colección en cada iteración. El borrow checker actúa como un arquitecto que te obliga a hacer explícito el flujo de datos.

```rust
let mut v = vec![1, 2, 3, 4];
let indices: Vec<usize> = v.iter().enumerate()
    .filter(|(_, &x)| x % 2 == 0)
    .map(|(i, _)| i)
    .collect();
for i in indices {
    v[i] *= 10;
}
```

Fuente: https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html

---

### ¿Por qué Option<T> es superior a null para representar ausencia de valor?

`Option<T>` hace que la ausencia de valor sea parte del sistema de tipos, obligando al programador a manejar ambos casos (`Some(T)` y `None`) o a ser explícito al ignorar uno. En cambio, `null` en otros lenguajes es un valor implícitamente válido para cualquier tipo referencia, lo que significa que cualquier variable podría ser nula sin que el tipo lo indique. Con `Option<T>`, el compilador rechaza el código que intenta usar el valor sin desempaquetar primero, eliminando los NullPointerException en tiempo de compilación. Esto desplaza toda una clase de bugs de runtime hacia errores de compilación, que son infinitamente más baratos de corregir.

```rust
fn dividir(a: f64, b: f64) -> Option<f64> {
    if b == 0.0 { None } else { Some(a / b) }
}

match dividir(10.0, 0.0) {
    Some(r) => println!("Resultado: {}", r),
    None    => println!("División por cero"),
}
```

Fuente: https://doc.rust-lang.org/book/ch06-01-defining-an-enum.html

---

### ¿Cuál es la diferencia entre `unwrap()`, `expect()`, `?` y `match` para manejar un Result?

`unwrap()` extrae el valor de un `Ok` o entra en pánico con un mensaje genérico si es `Err`; útil solo en prototipos o cuando la lógica garantiza que el error es imposible. `expect()` hace lo mismo pero acepta un mensaje de error personalizado, lo que facilita el debugging en producción. El operador `?` propaga el error hacia arriba retornando tempranamente desde la función actual si el valor es `Err`, siendo la forma idiomática en código de producción. `match` es el enfoque más explícito: permite manejar cada variante con lógica distinta sin ningún riesgo de pánico implícito.

```rust
use std::fs;

fn leer_archivo(path: &str) -> Result<String, std::io::Error> {
    let contenido = fs::read_to_string(path)?; // propaga el error
    Ok(contenido)
}
```

Fuente: https://doc.rust-lang.org/book/ch09-02-recoverable-errors-with-result.html

---

### ¿Qué ventaja tiene un enum de Rust sobre una jerarquía de clases para modelar estados?

Un enum de Rust puede almacenar datos distintos en cada variante, lo que permite modelar estados mutuamente excluyentes con sus datos asociados en un solo tipo cerrado. Una jerarquía de clases requiere una clase base y subclases, con dispatch dinámico y la posibilidad de que existan combinaciones de estado inválidas si no se diseña cuidadosamente. Con un enum, el tamaño del tipo en memoria es conocido en tiempo de compilación (discriminante más la variante más grande), sin heap allocation extra. El pattern matching sobre enums es exhaustivo por defecto, lo que garantiza que cualquier nuevo estado añadido al enum sea manejado en todos los match expressions del código.

```rust
enum Estado {
    Pendiente,
    Procesando { progreso: u8 },
    Completado(String),
    Error { codigo: u32, mensaje: String },
}
```

Fuente: https://doc.rust-lang.org/book/ch06-01-defining-an-enum.html

---

### ¿Qué es pattern matching exhaustivo y por qué es importante en mantenimiento de código?

El pattern matching exhaustivo significa que un `match` expression debe cubrir todas las posibles variantes del tipo que está siendo analizado; si falta alguna, el compilador emite un error. Esto es crítico en mantenimiento porque cuando se añade una nueva variante a un enum, el compilador señala todos los lugares del código que necesitan ser actualizados para manejar ese nuevo caso, en lugar de silenciosamente caer en un path default incorrecto. Es una forma de acoplamiento deliberado y verificable: los consumidores del tipo se enteran de los cambios en tiempo de compilación. Este mecanismo hace que los refactors de tipos sean seguros y rastreables.

```rust
enum Color { Rojo, Verde, Azul }

fn describir(c: Color) -> &'static str {
    match c {
        Color::Rojo  => "cálido",
        Color::Verde => "natural",
        Color::Azul  => "frío",
        // Si añadimos Color::Amarillo, el compilador lo detectará aquí
    }
}
```

Fuente: https://doc.rust-lang.org/book/ch06-02-match.html

---

### ¿Cuándo usarías `if let` en lugar de `match`?

`if let` es la opción idiomática cuando solo te interesa un caso específico de un `match` y querés ignorar todos los demás sin escribir un arm `_ => ()` explícito. Es más legible cuando la lógica relevante corresponde a una sola variante del enum o `Option`. Sin embargo, `match` sigue siendo preferible cuando necesitás manejar múltiples variantes con lógica distinta o cuando el compilador debe garantizar exhaustividad. En código de producción, `if let` es frecuente para consumir `Option<T>` cuando `None` no requiere ninguna acción.

```rust
let config: Option<String> = obtener_config("timeout");

if let Some(valor) = config {
    println!("Timeout configurado: {}", valor);
}
// None se ignora sin necesidad de arm explícito
```

Fuente: https://doc.rust-lang.org/book/ch06-03-if-let.html

---

### ¿Cómo funciona la desestructuración en Rust? Mostrá un ejemplo con struct y con enum.

La desestructuración permite extraer campos de un struct, variantes de un enum, elementos de una tupla o ítems de un array directamente en el patrón del `let`, `match`, o parámetro de función. Para structs, se usa la sintaxis `Nombre { campo1, campo2 }`, y se puede omitir campos con `..`. Para enums, cada variante puede tener su propio patrón con sus datos asociados. La desestructuración evita acceder a campos manualmente y hace el código más declarativo al nombrar exactamente qué parte del dato nos interesa.

```rust
struct Punto { x: i32, y: i32 }

let p = Punto { x: 3, y: 7 };
let Punto { x, y } = p; // desestructuración de struct
println!("x={}, y={}", x, y);

enum Forma { Circulo(f64), Rectangulo { ancho: f64, alto: f64 } }

let f = Forma::Rectangulo { ancho: 4.0, alto: 2.0 };
match f {
    Forma::Circulo(r)               => println!("radio={}", r),
    Forma::Rectangulo { ancho, alto } => println!("{}x{}", ancho, alto),
}
```

Fuente: https://doc.rust-lang.org/book/ch18-03-pattern-syntax.html

---

### ¿Qué es el tipo `Never` (!) y en qué contextos aparece?

El tipo `!`, llamado "never type" o tipo bottom, representa computaciones que nunca retornan un valor. Una función con tipo de retorno `!` diverge siempre: entra en un loop infinito, llama a `panic!`, o invoca `std::process::exit`. El compilador trata `!` como un subtipo de cualquier otro tipo, lo que permite usarlo en posiciones donde se espera cualquier tipo (por ejemplo, en los brazos de un `match`). Aparece implícitamente en el tipo de `break`, `continue`, `return` dentro de expresiones, y en funciones que siempre panican.

```rust
fn loop_infinito() -> ! {
    loop {
        // hace trabajo indefinidamente
    }
}

// El brazo `panic!` tiene tipo `!`, compatible con `u32`
let x: u32 = match resultado {
    Ok(v)  => v,
    Err(e) => panic!("error: {}", e),
};
```

Fuente: https://doc.rust-lang.org/book/ch19-04-advanced-types.html

---

### ¿Qué diferencia hay entre `impl Trait`, generics estáticos (`T: Trait`) y `dyn Trait`?

`T: Trait` en posición genérica y `impl Trait` en firma de función son equivalentes semánticamente: ambos generan monomorphization (código especializado por tipo en tiempo de compilación), con dispatch estático y cero overhead. La diferencia es notacional: `impl Trait` es más conciso en retornos de función pero no permite múltiples parámetros con el mismo tipo concreto garantizado. `dyn Trait` en cambio usa dispatch dinámico (vtable) y requiere un tipo de tamaño conocido como `Box<dyn Trait>` o `&dyn Trait`; permite mezclar tipos concretos distintos en runtime, con el costo de una indirección de puntero.

```rust
fn estatico(x: impl Display) { println!("{}", x); } // monomorphization
fn dinamico(x: &dyn Display) { println!("{}", x); } // vtable dispatch

fn mayor<T: PartialOrd>(a: T, b: T) -> T {
    if a > b { a } else { b }
}
```

Fuente: https://doc.rust-lang.org/book/ch10-02-traits.html

---

### ¿Qué es monomorphization y qué tradeoff implica vs. dynamic dispatch?

Monomorphization es el proceso por el cual el compilador genera versiones concretas del código genérico para cada tipo con el que se usa, produciendo dispatch estático sin overhead en runtime. El tradeoff es un mayor tamaño del binario compilado (code bloat) y tiempos de compilación más largos cuando hay muchas instanciaciones distintas. Dynamic dispatch vía `dyn Trait` produce un binario más pequeño y compile times más bajos, pero añade una indirección de puntero (vtable) en cada llamada y prohíbe ciertas optimizaciones del compilador como inlining. Para rutas de código críticas en performance, monomorphization suele ganar; para colecciones heterogéneas o arquitecturas con muchos tipos pluggables, `dyn Trait` puede ser la opción correcta.

Fuente: https://doc.rust-lang.org/book/ch10-01-syntax.html

---

### ¿Qué son las blanket implementations y cuándo pueden causar conflictos?

Una blanket implementation es una implementación de un trait para todos los tipos que satisfacen otra condición, usando un parámetro genérico sin restricción de tipo concreto. El ejemplo canónico en la biblioteca estándar es `impl<T: Display> ToString for T`, que da el método `to_string()` a cualquier tipo que implemente `Display`. Los conflictos ocurren cuando dos blanket implementations distintas podrían aplicarse al mismo tipo concreto, lo que viola la regla de coherencia (orphan rule) de Rust: el compilador rechaza cualquier ambigüedad en la resolución de traits. Este es un problema conocido en el diseño de APIs de bibliotecas grandes.

```rust
trait MiTrait {}
impl<T: Clone> MiTrait for T {}   // blanket implementation
impl<T: Copy>  MiTrait for T {}   // Error: conflicto potencial
// Copy implica Clone, por lo que un tipo Copy tendría dos implementaciones
```

Fuente: https://doc.rust-lang.org/book/ch10-02-traits.html

---

### ¿Cómo funcionan From e Into? ¿Por qué implementar From es suficiente para obtener Into?

`From<T>` define cómo construir un tipo a partir de otro, y `Into<U>` define cómo convertir un tipo en otro. La biblioteca estándar incluye una implementación genérica: `impl<T, U: From<T>> Into<T> for U`, lo que significa que si implementás `From<A> for B`, automáticamente obtenés `Into<B> for A` sin código adicional. La convención es siempre implementar `From` en lugar de `Into` porque `From` tiene una dirección más clara (quién es construido) y la implicación automática cubre el sentido inverso. El operador `?` usa estas conversiones para propagar errores entre tipos distintos.

```rust
#[derive(Debug)]
struct Metros(f64);

impl From<f64> for Metros {
    fn from(v: f64) -> Self { Metros(v) }
}

let m: Metros = 3.5_f64.into(); // Into disponible automáticamente
let m2 = Metros::from(3.5);
```

Fuente: https://doc.rust-lang.org/std/convert/trait.From.html

---

### ¿Cuándo implementarías Display vs Debug en un tipo propio?

`Debug` es para desarrolladores: se deriva automáticamente con `#[derive(Debug)]` y produce una representación interna del tipo útil para logging y debugging. `Display` es para usuarios finales: debe implementarse manualmente y produce la representación que se mostrará en la interfaz, mensajes de error, o en cualquier contexto donde el usuario ve el output. Implementar `Display` también habilita automáticamente el método `to_string()` mediante la blanket implementation. La regla práctica es: derivá `Debug` siempre que puedas; implementá `Display` solo cuando el tipo tiene una representación significativa para el usuario final.

```rust
use std::fmt;

struct Temperatura(f64);

impl fmt::Display for Temperatura {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{:.1}°C", self.0)
    }
}

println!("{}", Temperatura(36.6)); // "36.6°C"
```

Fuente: https://doc.rust-lang.org/std/fmt/trait.Display.html

---

### ¿Qué es un trait object y por qué requiere `Box<dyn Trait>` en la mayoría de los casos?

Un trait object es un valor cuyo tipo concreto es desconocido en tiempo de compilación pero que garantiza implementar un trait específico; el dispatch ocurre en runtime via vtable. El problema es que Rust necesita saber el tamaño de cada tipo en tiempo de compilación para colocarlo en el stack. Como `dyn Trait` puede representar cualquier tipo concreto con tamaños distintos, tiene tamaño desconocido (es un "unsized type"). `Box<dyn Trait>` resuelve esto poniendo el valor en el heap (tamaño fijo: el puntero) y manteniendo un fat pointer con la vtable. Existen alternativas como `&dyn Trait` (referencia prestada) o `Arc<dyn Trait>` para contextos concurrentes.

```rust
trait Animal { fn hablar(&self); }

struct Perro;
struct Gato;
impl Animal for Perro { fn hablar(&self) { println!("Guau"); } }
impl Animal for Gato  { fn hablar(&self) { println!("Miau"); } }

let animales: Vec<Box<dyn Animal>> = vec![Box::new(Perro), Box::new(Gato)];
for a in &animales { a.hablar(); }
```

Fuente: https://doc.rust-lang.org/book/ch17-02-trait-objects.html

---

### ¿Qué método hace que una cadena de iteradores empiece a ejecutarse realmente?

Los iteradores en Rust son lazy: métodos como `map`, `filter` o `take` construyen una cadena de adaptadores sin procesar ningún elemento. La ejecución real ocurre cuando se llama un "consuming adaptor": el más común es `collect()`, que materializa todos los elementos en una colección, pero también lo son `sum()`, `count()`, `for_each()`, `fold()`, y `next()`. Sin un consuming adaptor, el compilador emite una advertencia porque la cadena de iteradores construida no hace nada. Esta laziness permite que Rust optimice cadenas largas sin crear colecciones intermedias.

```rust
let v = vec![1, 2, 3, 4, 5];
let resultado: Vec<i32> = v.iter()
    .filter(|&&x| x % 2 == 0) // lazy
    .map(|&x| x * 10)          // lazy
    .collect();                // ejecuta todo aquí
println!("{:?}", resultado); // [20, 40]
```

Fuente: https://doc.rust-lang.org/book/ch13-02-iterators.html

---

### ¿Cuál es la diferencia entre `map`, `for_each` y un loop `for` en términos de semántica?

`map` es un adaptador lazy que transforma cada elemento y retorna un nuevo iterador; no ejecuta nada por sí solo y su resultado debe ser consumido. `for_each` es un consuming adaptor que aplica una closure a cada elemento por sus efectos secundarios, sin retornar nada útil; es equivalente a consumir el iterador con `for` pero en estilo funcional. Un loop `for` es azúcar sintáctico sobre `into_iter()` seguido de llamadas a `next()`; es la opción más legible para lógica imperativa compleja. La diferencia práctica: usá `map` cuando transformás y querés continuar la cadena, `for_each` o `for` cuando el objetivo es un efecto secundario.

```rust
let v = vec![1, 2, 3];
let dobles: Vec<i32> = v.iter().map(|&x| x * 2).collect(); // transforma
v.iter().for_each(|x| println!("{}", x));                   // efecto lateral
for x in &v { println!("{}", x); }                          // equivalente
```

Fuente: https://doc.rust-lang.org/book/ch13-02-iterators.html

---

### ¿Qué hace la palabra clave `move` en una closure y cuándo es obligatoria?

Por defecto, una closure captura variables del entorno por referencia cuando puede; `move` fuerza a que la closure tome ownership de todas las variables capturadas en lugar de tomar referencias. Es obligatorio cuando la closure necesita vivir más que el scope donde se creó, como al pasarla a un thread con `std::thread::spawn`: el thread puede ejecutar en cualquier momento futuro y las referencias al stack del creador serían inválidas. También es necesario cuando el valor capturado no implementa `Copy` y la closure necesita enviarse a otro contexto de ownership.

```rust
let mensaje = String::from("hola desde otro thread");

let handle = std::thread::spawn(move || {
    println!("{}", mensaje); // mensaje fue movido al thread
});

handle.join().unwrap();
```

Fuente: https://doc.rust-lang.org/book/ch13-01-closures.html

---

### ¿Qué diferencia hay entre `Fn`, `FnMut` y `FnOnce`?

Los tres traits representan closures con distintos niveles de restricción sobre cómo capturan y usan las variables del entorno. `FnOnce` es el más permisivo: puede consumir (mover) las variables capturadas, por lo que solo puede llamarse una vez. `FnMut` puede modificar las variables capturadas pero no consumirlas, por lo que puede llamarse múltiples veces en forma mutable. `Fn` no modifica ni consume las capturas, puede llamarse múltiples veces concurrentemente. Toda closure que implementa `Fn` también implementa `FnMut`, y toda que implementa `FnMut` también implementa `FnOnce`; es una jerarquía de subtipos.

```rust
fn llamar_una_vez<F: FnOnce()>(f: F) { f(); }
fn llamar_veces<F: Fn()>(f: F) { f(); f(); f(); }

let s = String::from("hola");
llamar_una_vez(move || drop(s)); // FnOnce: consume s

let x = 42;
llamar_veces(|| println!("{}", x)); // Fn: solo lee x
```

Fuente: https://doc.rust-lang.org/book/ch13-01-closures.html

---

### ¿Cómo implementarías el Iterator trait para un tipo propio?

Para implementar `Iterator` solo es obligatorio definir el tipo asociado `Item` y el método `next(&mut self) -> Option<Self::Item>`. El método retorna `Some(elemento)` mientras haya elementos y `None` cuando la secuencia termina. Una vez implementado `next`, el tipo obtiene gratis todos los métodos de la biblioteca estándar del trait `Iterator` (map, filter, collect, sum, etc.) a través de los métodos con implementación default del trait. El estado del iterador debe vivir en el struct que implementa el trait.

```rust
struct Contador { valor: u32, maximo: u32 }

impl Contador {
    fn nuevo(max: u32) -> Self { Contador { valor: 0, maximo: max } }
}

impl Iterator for Contador {
    type Item = u32;

    fn next(&mut self) -> Option<u32> {
        if self.valor < self.maximo {
            self.valor += 1;
            Some(self.valor)
        } else {
            None
        }
    }
}

let suma: u32 = Contador::nuevo(5).sum(); // 15
```

Fuente: https://doc.rust-lang.org/book/ch13-02-iterators.html

---

### ¿Cuándo es apropiado usar `panic!` vs. retornar un `Result`?

`panic!` está reservado para situaciones que representan bugs del programador: violaciones de invariantes que nunca deberían ocurrir en código correcto, como índices fuera de rango o estados imposibles. `Result` es para errores esperables que el código cliente puede y debe manejar: fallos de IO, parsing de input externo, errores de red. La heurística clave es: si el error puede ocurrir incluso con código correcto del llamador (porque depende del entorno, del usuario, o de datos externos), usá `Result`. En bibliotecas, prácticamente siempre se usa `Result` para no quitarle al llamador la decisión de cómo manejar el error.

```rust
// Correcto: panic para invariante del programador
fn obtener_primero(v: &[i32]) -> i32 {
    assert!(!v.is_empty(), "el vector no debe estar vacío");
    v[0]
}

// Correcto: Result para error de entorno
fn leer_puerto(s: &str) -> Result<u16, std::num::ParseIntError> {
    s.parse()
}
```

Fuente: https://doc.rust-lang.org/book/ch09-03-to-panic-or-not-to-panic.html

---

### ¿Cómo creás un tipo de error propio que sea compatible con el ecosistema de Rust?

Un tipo de error propio debe implementar los traits `std::error::Error` (que requiere `Debug` y `Display`), `Debug` para inspección interna, y `Display` para mensajes legibles. Opcionalmente se puede implementar el método `source()` del trait `Error` para encadenar la causa raíz del error. Para integrarse con el operador `?`, el tipo debe implementar `From<OtroError>` para cada error que pueda ocurrir en la función. La crate `thiserror` automatiza todo este boilerplate via macros sin añadir overhead en runtime.

```rust
use std::fmt;

#[derive(Debug)]
enum AppError {
    Io(std::io::Error),
    Parse(std::num::ParseIntError),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            AppError::Io(e)    => write!(f, "Error de IO: {}", e),
            AppError::Parse(e) => write!(f, "Error de parseo: {}", e),
        }
    }
}

impl std::error::Error for AppError {}
```

Fuente: https://doc.rust-lang.org/std/error/trait.Error.html

---

### ¿Cuál es la diferencia de filosofía entre `thiserror` y `anyhow`?

`thiserror` está diseñado para bibliotecas: genera implementaciones de `std::error::Error` con macros sin añadir overhead, manteniendo tipos de error explícitos que los callers pueden inspeccionar y manejar por variante. `anyhow` está diseñado para aplicaciones: provee un tipo de error opaco (`anyhow::Error`) que puede contener cualquier error, con contexto añadido fácilmente via `.context()`. La elección depende de quién consume el error: si es código del usuario final que simplemente necesita reportar errores, `anyhow` reduce el boilerplate enormemente; si es una API pública donde el caller necesita distinguir tipos de error y reaccionar diferente, `thiserror` es la elección correcta.

Fuente: https://doc.rust-lang.org/book/ch09-02-recoverable-errors-with-result.html

---

### ¿Cómo podés agregar contexto a un error al propagarlo con `?`?

Con la crate `anyhow`, el método `.context("mensaje")` o `.with_context(|| format!("..."))` envuelve el error original con información adicional antes de propagarlo, formando una cadena de errores. Con errores propios, se puede implementar `From<ErrorOriginal>` para `ErrorConContexto` y añadir la información adicional en esa conversión. La clave es que el contexto se añade en el punto donde el error ocurre, no donde se reporta, lo que produce mensajes de error con toda la cadena causal sin perder el error raíz.

```rust
use anyhow::{Context, Result};

fn leer_config(path: &str) -> Result<String> {
    std::fs::read_to_string(path)
        .with_context(|| format!("No se pudo leer el archivo de config: {}", path))?;
    Ok(String::new())
}
```

Fuente: https://doc.rust-lang.org/book/ch09-02-recoverable-errors-with-result.html

---

### ¿Qué garantizan los traits Send y Sync y cómo los aplica el compilador?

`Send` garantiza que un tipo puede transferirse de forma segura entre threads (su ownership puede moverse a otro thread). `Sync` garantiza que una referencia al tipo puede compartirse entre threads simultáneamente (es seguro tener `&T` desde múltiples threads). La mayoría de los tipos primitivos son `Send + Sync` automáticamente; los que no lo son (como `Rc<T>` o `Cell<T>`) implementan explícitamente `!Send` o `!Sync`. El compilador aplica estos traits en las firmas de `thread::spawn` y similares: exige que todo lo capturado sea `Send`, rechazando el código si se intenta compartir un tipo no thread-safe. Son auto-traits: se implementan automáticamente cuando todos los campos del tipo los satisfacen.

```rust
use std::rc::Rc;

let rc = Rc::new(5);
// Error: Rc<i32> no implementa Send
// std::thread::spawn(move || println!("{}", rc));

use std::sync::Arc;
let arc = Arc::new(5); // Arc sí es Send + Sync
std::thread::spawn(move || println!("{}", arc)).join().unwrap();
```

Fuente: https://doc.rust-lang.org/book/ch16-04-extensible-concurrency-sync-and-send.html

---

### ¿Cuándo preferirías async/await sobre threads del sistema operativo?

Async/await es preferible cuando el programa tiene un alto volumen de tareas concurrentes que pasan la mayor parte del tiempo esperando IO (red, disco, base de datos), porque las tareas asíncronas son mucho más livianas que los threads del SO: no tienen stack dedicado y se multiplexan en pocos threads reales. Los threads del SO son preferibles para trabajo CPU-intensivo que corre en paralelo real, ya que las tareas async se suspenden cooperativamente y una tarea que nunca cede el control puede bloquear todo el runtime. La regla práctica: IO-bound con alta concurrencia → async; CPU-bound o trabajo pesado → threads o Rayon.

```rust
use tokio; // runtime de async

#[tokio::main]
async fn main() {
    let tarea = tokio::spawn(async {
        // simula espera de IO
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        42
    });
    println!("{}", tarea.await.unwrap());
}
```

Fuente: https://rust-lang.github.io/async-book/01_getting_started/02_why_async.html

---

### ¿Qué es un runtime de async en Rust y por qué no hay uno en la librería estándar?

Un runtime de async es la capa que ejecuta los `Future`s generados por async/await: provee un event loop, un thread pool, y las primitivas de IO asíncrono. La librería estándar de Rust define el trait `Future` y la sintaxis async/await, pero deliberadamente no incluye un runtime para no imponer elecciones de arquitectura a todos los usuarios del lenguaje. Diferentes dominios tienen requisitos muy distintos: un servidor web necesita un runtime IO-bound multi-threaded (Tokio), un sistema embebido necesita un runtime single-threaded sin heap, y un juego puede tener requerimientos propios. Esta decisión de diseño mantiene la librería estándar minimalista y permite que el ecosistema evolucione runtimes especializados.

Fuente: https://rust-lang.github.io/async-book/02_execution/04_executor.html

---

### ¿Qué problema resuelve `Arc<Mutex<T>>` y cuál es su limitación principal?

`Arc<Mutex<T>>` combina shared ownership entre threads (`Arc`: Atomic Reference Counting) con exclusión mutua para acceso mutable seguro (`Mutex`). Resuelve el problema de necesitar múltiples dueños de un dato mutable en contextos multi-threaded, algo que el sistema de ownership de Rust prohíbe directamente. La limitación principal es el riesgo de deadlock cuando dos threads esperan mutuamente locks que el otro tiene, lo que Rust no puede detectar en tiempo de compilación. Además, el contention sobre el Mutex puede convertirse en un cuello de botella de performance en código con alta concurrencia de escritura.

```rust
use std::sync::{Arc, Mutex};
use std::thread;

let contador = Arc::new(Mutex::new(0));

let handles: Vec<_> = (0..5).map(|_| {
    let c = Arc::clone(&contador);
    thread::spawn(move || { *c.lock().unwrap() += 1; })
}).collect();

for h in handles { h.join().unwrap(); }
println!("{}", *contador.lock().unwrap()); // 5
```

Fuente: https://doc.rust-lang.org/book/ch16-03-shared-state.html

---

### ¿Cómo evitarías un deadlock con Mutex en Rust?

La estrategia más efectiva es ordenar consistentemente la adquisición de locks: si dos partes del código necesitan los mismos Mutexes, siempre deben adquirirlos en el mismo orden. Otra táctica es minimizar el scope del lock guard, liberándolo lo antes posible en lugar de mantenerlo durante operaciones costosas. `try_lock()` permite intentar adquirir el lock sin bloquear y manejar el caso de fallo en lugar de esperar indefinidamente. En arquitecturas más modernas, se puede reemplazar `Mutex<T>` con canales (`mpsc::channel`) o con primitivas como `RwLock<T>` cuando hay muchos lectores y pocos escritores, reduciendo la contención.

```rust
use std::sync::{Arc, Mutex};

let lock_a = Arc::new(Mutex::new(0));
let lock_b = Arc::new(Mutex::new(0));

// Siempre adquirir en el mismo orden: A primero, luego B
{
    let _a = lock_a.lock().unwrap();
    let _b = lock_b.lock().unwrap();
    // trabajo con ambos recursos
} // ambos locks liberados aquí
```

Fuente: https://doc.rust-lang.org/book/ch16-03-shared-state.html

---

### ¿Qué permite exactamente `unsafe` en Rust? ¿Qué NO desactiva?

`unsafe` habilita exactamente cinco capacidades adicionales: dereferenciar raw pointers (`*const T` / `*mut T`), llamar funciones unsafe (incluyendo FFI), acceder o modificar statics mutables, implementar traits unsafe, y acceder campos de unions. Lo que `unsafe` NO desactiva es todo el resto del sistema de tipos: el borrow checker sigue activo, los traits siguen siendo verificados, los lifetimes siguen siendo analizados, y el compilador sigue optimizando. `unsafe` no es una "escape hatch" del lenguaje completo; es una declaración de que el programador asume la responsabilidad de garantizar invariantes específicos que el compilador no puede verificar automáticamente.

```rust
let mut x = 5;
let raw = &mut x as *mut i32;

unsafe {
    *raw += 1; // dereferenciar raw pointer: solo permitido en unsafe
}
println!("{}", x); // 6
```

Fuente: https://doc.rust-lang.org/book/ch19-01-unsafe-rust.html

---

### ¿Qué es `Cow<str>` y cuándo lo usarías en lugar de String o &str?

`Cow<'a, str>` (Clone-on-Write) es un enum que puede contener ya sea una referencia prestada (`&'a str`) o un `String` propio, sin saber cuál en tiempo de compilación. Se usa cuando una función puede retornar texto sin modificar (ahorrando una copia) en el caso común, pero necesita devolver texto modificado (como `String`) en casos excepcionales. El clon ocurre solo cuando se necesita mutar el contenido. Es ideal en funciones de sanitización o transformación de strings donde la mayoría de los inputs no necesitan cambios, evitando allocaciones innecesarias en el path común.

```rust
use std::borrow::Cow;

fn asegurar_mayuscula(s: &str) -> Cow<str> {
    if s.starts_with(char::is_uppercase) {
        Cow::Borrowed(s)          // sin copia: retorna referencia
    } else {
        let mut owned = s.to_owned();
        owned.make_ascii_uppercase();
        Cow::Owned(owned)         // copia solo cuando es necesario
    }
}
```

Fuente: https://doc.rust-lang.org/std/borrow/enum.Cow.html
