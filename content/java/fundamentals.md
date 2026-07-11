---
stack: java
id: java-fundamentals
title: "Java: Fundamentos para entrevistas"
area: Backend
priority: high
resourceLabel: Java, Language Documentation
resourceUrl: https://docs.oracle.com/javase/tutorial/
---

## Summary
Los cinco pilares del lenguaje Java que aparecen en toda entrevista técnica seria: los cuatro principios OOP con foco práctico, el sistema de tipos genéricos y sus límites en runtime, el Collections Framework con criterios de selección, la Streams API y sus trampas de rendimiento, y el modelo de memoria con el rol del garbage collector.

## Concepts

### Los cuatro pilares OOP en Java: enfoque de entrevista
#### Details
**Encapsulación** significa ocultar el estado interno de un objeto y exponer solo operaciones bien definidas. En Java se implementa declarando campos `private` y accediendo a ellos a través de getters/setters o métodos de comportamiento. El punto que distingue a un candidato senior: encapsulación no es solo "hacer los campos private", es diseñar la API del objeto de manera que los invariantes nunca se rompan desde afuera.

**Herencia** permite que una clase derive comportamiento y estado de otra. Java solo soporta herencia simple de clases pero múltiple de interfaces. El antipatrón clásico es abusar de herencia cuando la relación correcta es composición: heredás para reutilizar código, pero si el tipo hijo no es genuinamente un subtipo del padre (principio de Liskov), terminás con una jerarquía frágil.

**Polimorfismo** es la capacidad de tratar objetos de distintas clases a través de una interfaz común. En Java se logra por subtipo (override de métodos) y en menor medida por sobrecarga (overload). El polimorfismo en runtime (dispatch dinámico) es lo que permite el principio abierto/cerrado: extendés comportamiento sin modificar código existente.

**Abstracción** separa el qué del cómo. Una interfaz define el contrato; la implementación concreta puede variar. Desde Java 8, las interfaces pueden tener métodos `default` y `static`, lo que desdibuja la línea con las clases abstractas. La diferencia clave en entrevista: clase abstracta puede tener estado y constructores; interfaz no puede (hasta Java 8 sin defaults).

#### Examples
Encapsulación con invariante protegido
```java
public class BankAccount {
    private double balance;

    public BankAccount(double initialBalance) {
        if (initialBalance < 0) throw new IllegalArgumentException("Balance cannot be negative");
        this.balance = initialBalance;
    }

    public void deposit(double amount) {
        if (amount <= 0) throw new IllegalArgumentException("Amount must be positive");
        this.balance += amount;
    }

    public double getBalance() { return balance; }
    // No hay setter de balance: el invariante no puede romperse desde afuera
}
```

Polimorfismo con dispatch dinámico
```java
abstract class Shape {
    abstract double area();
}

class Circle extends Shape {
    private final double radius;
    Circle(double r) { this.radius = r; }

    @Override
    public double area() { return Math.PI * radius * radius; }
}

class Square extends Shape {
    private final double side;
    Square(double s) { this.side = s; }

    @Override
    public double area() { return side * side; }
}

// El método process no sabe qué Shape recibe, polimorfismo en acción
void process(Shape shape) {
    System.out.println("Area: " + shape.area());
}
```

#### Sources
- [Java Tutorials, OOP Concepts](https://docs.oracle.com/javase/tutorial/java/concepts/)
- [Java Tutorials, Interfaces and Inheritance](https://docs.oracle.com/javase/tutorial/java/IandI/index.html)

---

### Generics y type erasure: por qué importa en entrevistas
#### Details
Los generics de Java permiten escribir código parametrizado por tipo (`List<String>`, `Optional<User>`) con verificación en tiempo de compilación. El compilador puede detectar `ClassCastException` potenciales antes de que el programa corra. Sin generics, el código de colecciones requería castings manuales constantemente y los errores aparecían en runtime.

**Type erasure** es el mecanismo por el que el compilador elimina la información de tipo genérico al generar bytecode. `List<String>` y `List<Integer>` se convierten en `List` (raw type) en el `.class`. Esto tiene consecuencias directas: no podés hacer `new T()`, no podés hacer `instanceof List<String>`, y no podés crear arrays de tipos genéricos (`new T[10]` no compila). Esta es la pregunta de entrevista: ¿qué no podés hacer con generics en runtime y por qué?

Los **wildcards** (`? extends T` y `? super T`) son la respuesta de Java al problema de varianza. `List<Integer>` NO es subtipo de `List<Number>` aunque `Integer extends Number`. Si lo fuera, podrías agregar un `Double` a través de la referencia `List<Number>`, corrompiendo la lista. El principio PECS (Producer Extends, Consumer Super) guía cuándo usar cada wildcard.

#### Examples
Type erasure en acción
```java
List<String> strings = new ArrayList<>();
List<Integer> ints = new ArrayList<>();

// En runtime, ambas son simplemente java.util.ArrayList
System.out.println(strings.getClass() == ints.getClass()); // true

// Esto NO compila, no se puede preguntar por el tipo genérico en runtime
// if (strings instanceof List<String>) { ... }  // error de compilación
```

Wildcards y PECS
```java
// Producer Extends: solo leer de la colección
void printAll(List<? extends Number> numbers) {
    for (Number n : numbers) System.out.println(n); // OK
    // numbers.add(1);  // NO compila, no sabemos el tipo exacto
}

// Consumer Super: solo escribir a la colección
void addNumbers(List<? super Integer> list) {
    list.add(1);  // OK, Integer es subtipo de cualquier cosa en la lista
}
```

#### Sources
- [Java Tutorials, Generics](https://docs.oracle.com/javase/tutorial/java/generics/index.html)
- [Java Tutorials, Type Erasure](https://docs.oracle.com/javase/tutorial/java/generics/erasure.html)
- [Java Tutorials, Wildcards](https://docs.oracle.com/javase/tutorial/java/generics/wildcards.html)

---

### Collections Framework: cuándo usar qué y thread-safety
#### Details
El Collections Framework de Java tiene tres interfaces fundamentales: `List`, `Set` y `Map`. La elección entre implementaciones no es trivial y es exactamente lo que buscan los entrevistadores.

Para **List**: `ArrayList` es O(1) amortizado para agregar al final y O(1) para acceso por índice; ideal para acceso aleatorio frecuente. `LinkedList` es O(1) para inserción/eliminación en extremos pero O(n) para acceso por índice; casi nunca es la mejor opción en práctica moderna. Para **Set**: `HashSet` es O(1) amortizado para add/contains/remove pero sin orden garantizado. `LinkedHashSet` mantiene orden de inserción. `TreeSet` mantiene orden natural o por `Comparator` con operaciones O(log n). Para **Map**: misma lógica, `HashMap`, `LinkedHashMap`, `TreeMap`.

**Thread-safety**: las implementaciones estándar (`ArrayList`, `HashMap`, etc.) NO son thread-safe. Las opciones son: `Collections.synchronizedList(list)` (sincronización gruesa, baja concurrencia), `CopyOnWriteArrayList` (ideal para muchas lecturas, pocas escrituras), `ConcurrentHashMap` (segmentación interna, alta concurrencia real). Usar `HashMap` desde múltiples threads puede producir loops infinitos en Java 7 y corrupción silenciosa en Java 8+.

#### Examples
Selección de implementación según criterio
```java
// Acceso por índice frecuente → ArrayList
List<String> names = new ArrayList<>();
names.add("Alice");
System.out.println(names.get(0)); // O(1)

// Sin duplicados, orden no importa → HashSet
Set<String> uniqueIds = new HashSet<>();
uniqueIds.add("id-1");
System.out.println(uniqueIds.contains("id-1")); // O(1)

// Mapa con iteración en orden de inserción → LinkedHashMap
Map<String, Integer> scores = new LinkedHashMap<>();
scores.put("Alice", 95);
scores.put("Bob", 87);
scores.entrySet().forEach(e -> System.out.println(e.getKey() + ": " + e.getValue()));
```

ConcurrentHashMap para acceso multithreaded
```java
// NO hacer esto en entornos concurrentes:
// Map<String, Integer> map = new HashMap<>();

// Correcto:
Map<String, Integer> concurrentMap = new ConcurrentHashMap<>();
concurrentMap.put("key", 1);
// computeIfAbsent es atómico en ConcurrentHashMap
concurrentMap.computeIfAbsent("counter", k -> 0);
```

#### Sources
- [Java Tutorials, Collections](https://docs.oracle.com/javase/tutorial/collections/index.html)
- [Java API, java.util.concurrent](https://docs.oracle.com/javase/8/docs/api/java/util/concurrent/package-summary.html)

---

### Streams API: evaluación lazy, pipelines y trampas de rendimiento
#### Details
La Streams API (Java 8+) permite procesar colecciones de forma declarativa y funcional. Un `Stream` es una secuencia de elementos que soporta operaciones secuenciales y paralelas. El concepto central que hay que entender para una entrevista: **un stream es lazy**, las operaciones intermedias no se ejecutan hasta que se invoca una operación terminal.

Las **operaciones intermedias** (`filter`, `map`, `flatMap`, `sorted`, `distinct`, `limit`, `skip`) retornan otro Stream y no hacen nada por sí solas. Las **operaciones terminales** (`collect`, `forEach`, `reduce`, `count`, `findFirst`, `anyMatch`) disparan el procesamiento. Esta distinción importa porque múltiples operaciones intermedias se fusionan en un solo paso sobre los datos, no se construyen colecciones intermedias.

Las **trampas de parallel streams**: `parallelStream()` divide el trabajo en el ForkJoinPool común. Es beneficioso cuando las operaciones son CPU-bound, la colección es grande (miles de elementos), y las operaciones son stateless e independientes. Es contraproducente, y puede ser más lento, para operaciones I/O bound, operaciones con estado compartido, o colecciones pequeñas. El overhead de coordinación de threads supera el beneficio por debajo de cierto umbral.

Un stream solo puede consumirse una vez. Intentar operar sobre un stream ya terminado lanza `IllegalStateException`.

#### Examples
Pipeline básico: lazy evaluation
```java
List<String> names = List.of("Alice", "Bob", "Charlie", "Anna", "Bryan");

// Ninguna operación corre hasta el collect()
List<String> result = names.stream()
    .filter(name -> name.startsWith("A"))   // intermedia, lazy
    .map(String::toUpperCase)               // intermedia, lazy
    .sorted()                               // intermedia, lazy
    .collect(Collectors.toList());          // terminal, dispara todo

System.out.println(result); // [ALICE, ANNA]
```

flatMap para aplanar estructuras anidadas
```java
List<List<Integer>> nested = List.of(
    List.of(1, 2, 3),
    List.of(4, 5),
    List.of(6, 7, 8, 9)
);

List<Integer> flat = nested.stream()
    .flatMap(List::stream)
    .collect(Collectors.toList());
// [1, 2, 3, 4, 5, 6, 7, 8, 9]
```

Cuándo NO usar parallelStream
```java
// MAL: operación trivial en lista pequeña, overhead > beneficio
List<Integer> smallList = List.of(1, 2, 3, 4, 5);
int sum = smallList.parallelStream().reduce(0, Integer::sum);

// BIEN: operación CPU-intensive en colección grande
long count = largeNumberList.parallelStream()
    .filter(n -> isPrime(n))   // costoso computacionalmente
    .count();
```

#### Sources
- [Java Tutorials, Aggregate Operations](https://docs.oracle.com/javase/tutorial/collections/streams/index.html)
- [Java API, java.util.stream](https://docs.oracle.com/javase/8/docs/api/java/util/stream/package-summary.html)

---

### Java Memory Model: stack, heap, GC y tipos de referencias
#### Details
En la JVM, la **stack** almacena variables locales, parámetros de métodos y referencias a objetos. Cada thread tiene su propia stack. La **heap** almacena todos los objetos creados con `new`. La heap es compartida entre threads, lo que hace necesario el modelo de memoria de Java para garantizar visibilidad entre threads.

El **garbage collector** libera automáticamente objetos en heap que ya no tienen referencias alcanzables desde la raíz (GC roots: variables en stack, variables estáticas). Java divide la heap en generaciones: Young Generation (Eden + Survivor spaces) para objetos recientes y Old Generation para objetos de larga vida. La mayoría de los objetos "mueren jóvenes", esto es la hipótesis generacional que justifica el diseño. Los GC modernos (G1, ZGC, Shenandoah) están diseñados para minimizar pausas en aplicaciones de baja latencia.

Los **tipos de referencias** son clave en entrevistas sobre caching y manejo de recursos:
- **Strong reference**: la referencia estándar (`Object o = new Object()`). El GC nunca colecta el objeto mientras exista.
- **Weak reference** (`WeakReference<T>`): el GC puede colectar el objeto en cualquier momento, incluso si existe la weak reference. Usado en caches donde el objeto puede regenerarse.
- **Soft reference** (`SoftReference<T>`): el GC colecta el objeto solo bajo presión de memoria. Ideal para caches en memoria que ceden espacio cuando se necesita.
- **Phantom reference**: notifica que el objeto fue colectado, sin proveer acceso al mismo. Usado para limpieza de recursos nativos.

#### Examples
Stack vs Heap visual
```java
void processOrder(int orderId) {        // orderId → en STACK (primitivo)
    Order order = new Order(orderId);   // order → referencia en STACK
                                        // new Order(...) → objeto en HEAP
    double total = order.getTotal();    // total → en STACK
}
// Al salir del método: orderId, order, total se eliminan de la stack
// El objeto Order en heap queda elegible para GC si no hay más referencias
```

WeakReference para caché
```java
import java.lang.ref.WeakReference;

WeakReference<byte[]> cache = new WeakReference<>(new byte[1024 * 1024]);

byte[] data = cache.get();
if (data != null) {
    // usar data
} else {
    // el GC ya colectó el objeto, regenerar o recargar
    data = loadFromDisk();
}
```

#### Sources
- [Java Tutorials, Understanding Memory Management](https://docs.oracle.com/javase/8/docs/technotes/guides/vm/gctuning/)
- [Java API, java.lang.ref](https://docs.oracle.com/javase/8/docs/api/java/lang/ref/package-summary.html)

## Interview Questions

### ¿Cuál es la diferencia entre herencia y composición? ¿Cuándo elegís una sobre la otra?
Herencia establece una relación "es-un" y permite reutilizar código de la clase padre. Composición establece una relación "tiene-un" donde un objeto delega comportamiento a otro objeto que contiene. La regla práctica es preferir composición sobre herencia: la herencia crea acoplamiento fuerte porque la subclase depende de los detalles de implementación del padre, y un cambio en el padre puede romper subclases de formas inesperadas. Usás herencia cuando el subtipo genuinamente satisface el Principio de Liskov, es decir, puede sustituirse por el supertipo sin romper el programa.

### ¿Por qué no se puede hacer `instanceof` con tipos genéricos en Java?
Porque el compilador aplica type erasure: la información de tipo genérico (`List<String>`) se elimina del bytecode y en runtime solo existe `List`. Por eso, `instanceof List<String>` es un error de compilación, en runtime la JVM no puede distinguir un `List<String>` de un `List<Integer>`. Lo que sí podés hacer es `instanceof List<?>` o `instanceof List` (raw type). Para verificar el tipo de los elementos individuales hay que iterar y verificar cada uno con `instanceof String`.

### ¿Cuál es la diferencia entre `HashMap` y `ConcurrentHashMap`? ¿Cuándo usarías cada uno?
`HashMap` no es thread-safe: acceso concurrente desde múltiples threads puede causar corrupción de datos o loops infinitos. `ConcurrentHashMap` usa segmentación interna (locks por segmento en Java 7, CAS operations en Java 8+) para permitir alta concurrencia sin bloquear toda la estructura. Usás `HashMap` cuando el acceso es desde un único thread o el acceso está externamente sincronizado. Usás `ConcurrentHashMap` cuando múltiples threads leen y escriben concurrentemente, su costo de sincronización es significativamente menor que un `Collections.synchronizedMap`.

### ¿Cuándo es contraproducente usar `parallelStream()`?
`parallelStream()` divide el trabajo usando el ForkJoinPool común de la JVM, lo que tiene overhead de coordinación de threads. Es contraproducente cuando la colección es pequeña (el overhead supera el beneficio), cuando las operaciones son I/O-bound (los threads no están limitados por CPU sino por disco/red, y más threads no ayudan), o cuando hay estado compartido mutable en las lambdas (introduce condiciones de carrera). Es beneficioso solo con operaciones CPU-intensive, colecciones grandes, y lambdas stateless.

### ¿Qué diferencia hay entre una `SoftReference` y una `WeakReference`?
Ambas permiten que el garbage collector colecte el objeto referenciado, pero con diferente agresividad. Una `WeakReference` se colecta en el próximo ciclo de GC, apenas el objeto no tenga strong references. Una `SoftReference` el GC la respeta mientras haya suficiente memoria, solo la colecta bajo presión de memoria. Esto hace que `SoftReference` sea ideal para implementar caches en memoria: el cache cede espacio automáticamente cuando la aplicación necesita más heap, sin que tengas que gestionar la eviction manualmente.

### ¿Qué significa que las Streams son lazy? ¿Cómo afecta eso al rendimiento?
Lazy significa que las operaciones intermedias (`filter`, `map`, etc.) no se ejecutan cuando se invocan, solo registran la operación. El procesamiento real ocurre cuando se invoca una operación terminal (`collect`, `count`, `findFirst`). El beneficio de rendimiento es doble: primero, Java puede fusionar múltiples operaciones intermedias en un solo pass sobre los datos en lugar de crear colecciones intermedias. Segundo, operaciones como `findFirst` o `limit` pueden cortocircuitarse y terminar sin procesar todos los elementos, por ejemplo, `stream.filter(...).findFirst()` detiene el procesamiento en el primer match.
