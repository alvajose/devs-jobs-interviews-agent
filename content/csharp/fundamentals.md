---
stack: csharp
id: csharp-fundamentals
title: "C#: Fundamentos para entrevistas"
area: Backend
priority: high
resourceLabel: C#, Language Reference
resourceUrl: https://learn.microsoft.com/dotnet/csharp/
---

## Summary

Los pilares del lenguaje C# que aparecen en toda entrevista técnica seria: cómo el runtime maneja la memoria, cuándo los genéricos evitan boxing, cómo LINQ puede ser tu mejor amigo o tu peor enemigo según cómo lo uses, y por qué `async`/`await` no es magia sino una máquina de estados generada por el compilador.

## Concepts

### Value types vs reference types: stack, heap, boxing y unboxing

#### Details

En C#, los **value types** (`int`, `double`, `bool`, `struct`, `enum`) almacenan su valor directamente donde se declaran: en el stack si son variables locales, o inline dentro de un objeto en el heap. Los **reference types** (`class`, `interface`, `delegate`, `string`, arrays) almacenan una referencia en el stack que apunta al objeto real en el heap. Esta distinción no es trivia de entrevista: define el comportamiento de asignación, pasaje de parámetros y semántica de igualdad.

**Boxing** es el proceso de envolver un value type en un `object` heap-allocated. **Unboxing** es extraerlo de vuelta. Ambas operaciones son implícitas pero costosas: allocan memoria en el heap, presionan al GC, y el unboxing requiere un cast explícito que puede lanzar `InvalidCastException`. El patrón más común que genera boxing sin querer es pasar un `int` a un parámetro de tipo `object` o usar colecciones no genéricas como `ArrayList`.

La elección entre `struct` y `class` tiene reglas claras según las guías de Microsoft: usá `struct` cuando el tipo es pequeño (idealmente ≤ 16 bytes), immutable por naturaleza, semánticamente equivale a un valor primitivo, y no va a ser boxeado frecuentemente. Un `struct` mutable es un antipatrón conocido: como se copia por valor al asignarlo o pasarlo, las mutaciones sobre la copia no afectan al original, lo que produce bugs difíciles de rastrear.

#### Examples

Boxing y unboxing: el costo oculto

```csharp
// Boxing: int → object, allocación en heap
int value = 42;
object boxed = value; // boxing implícito

// Unboxing: object → int, requiere cast explícito
int unboxed = (int)boxed;

// Antipatrón: ArrayList boxa cada int
var list = new System.Collections.ArrayList();
list.Add(1); // boxing
list.Add(2); // boxing

// Solución: List<T> no genera boxing
var genericList = new List<int>();
genericList.Add(1); // sin boxing
```

Struct vs class: semántica de copia

```csharp
struct PointStruct { public int X; public int Y; }
class PointClass  { public int X; public int Y; }

var ps1 = new PointStruct { X = 1, Y = 2 };
var ps2 = ps1;      // copia: ps2 es independiente
ps2.X = 99;
Console.WriteLine(ps1.X); // 1, no afectado

var pc1 = new PointClass { X = 1, Y = 2 };
var pc2 = pc1;      // referencia: pc2 apunta al mismo objeto
pc2.X = 99;
Console.WriteLine(pc1.X); // 99, mutado
```

#### Sources

- [Value types (C# reference)](https://learn.microsoft.com/dotnet/csharp/language-reference/builtin-types/value-types)
- [Boxing and Unboxing](https://learn.microsoft.com/dotnet/csharp/programming-guide/types/boxing-and-unboxing)
- [Choosing Between Class and Struct](https://learn.microsoft.com/dotnet/standard/design-guidelines/choosing-between-class-and-struct)

---

### Generics y constraints: type safety sin boxing

#### Details

Los genéricos permiten escribir código parametrizado por tipos que el compilador verifica en tiempo de compilación. A diferencia de usar `object` (que requiere boxing para value types y casts en runtime), los genéricos generan código especializado por tipo a través del JIT: `List<int>` almacena ints directamente, sin allocaciones de boxing. Esto los hace más seguros y más performantes al mismo tiempo.

Las **constraints** (`where`) restringen qué tipos puede recibir un parámetro genérico y habilitan operaciones sobre él. `where T : class` garantiza que T es un reference type (permite `null` checks). `where T : struct` garantiza value type (útil con `Nullable<T>`). `where T : new()` garantiza que T tiene un constructor sin parámetros, lo que habilita `new T()`. Se pueden combinar múltiples constraints en el mismo tipo.

**Covariance** (`out T`) y **contravariance** (`in T`) en interfaces y delegates permiten asignaciones de tipos genéricos compatibles. `IEnumerable<Derived>` es asignable a `IEnumerable<Base>` porque `IEnumerable<T>` declara `out T`: produce T pero no lo consume. `Action<Base>` es asignable a `Action<Derived>` porque `Action<T>` declara `in T`: consume T pero no lo produce. Confundir la dirección de la varianza es un error de compilación.

#### Examples

Constraints en acción

```csharp
// T debe ser un reference type con constructor sin parámetros
public T CreateInstance<T>() where T : class, new()
{
    return new T();
}

// T debe implementar IComparable<T> para poder comparar
public T Max<T>(T a, T b) where T : IComparable<T>
{
    return a.CompareTo(b) >= 0 ? a : b;
}

// Múltiples constraints
public void Process<T>(T item)
    where T : class, IDisposable, new()
{
    using var instance = new T();
    // ...
}
```

Covariance con IEnumerable<out T>

```csharp
IEnumerable<string> strings = new List<string> { "hello", "world" };
IEnumerable<object> objects = strings; // válido: string es object (covariance)

// Contravariance: Action<in T>
Action<object> writeObject = obj => Console.WriteLine(obj);
Action<string> writeString = writeObject; // válido: puede escribir strings (son objects)
```

#### Sources

- [Generic classes and methods](https://learn.microsoft.com/dotnet/csharp/fundamentals/types/generics)
- [Constraints on type parameters](https://learn.microsoft.com/dotnet/csharp/programming-guide/generics/constraints-on-type-parameters)
- [Covariance and Contravariance in Generics](https://learn.microsoft.com/dotnet/standard/generics/covariance-and-contravariance)

---

### LINQ: ejecución diferida, IEnumerable<T> vs IQueryable<T> y pitfalls

#### Details

LINQ es un sistema de consultas integrado en el lenguaje que trabaja sobre cualquier fuente que implemente `IEnumerable<T>` o `IQueryable<T>`. La diferencia fundamental entre ambas interfaces define dónde se ejecuta la query: `IEnumerable<T>` ejecuta en memoria en el proceso .NET (LINQ to Objects); `IQueryable<T>` delega la ejecución a un proveedor externo que traduce la expression tree a otra representación,SQL en el caso de Entity Framework, y ejecuta en el servidor de base de datos.

La **ejecución diferida** (deferred execution) es el comportamiento por defecto de los operadores LINQ: llamar a `Where`, `Select`, o `OrderBy` no ejecuta nada. La query se ejecuta cuando se enumera: al hacer `foreach`, al llamar `ToList()`, `ToArray()`, `Count()`, `First()`, o cualquier operador de materialización. Esto es eficiente, pero genera el pitfall más común: **múltiple enumeración**. Si enumerás una query dos veces, se ejecuta dos veces; si la fuente es un stream o una query de base de datos, esto puede ser costoso o incorrecto.

El pitfall de **N+1 con EF** surge cuando usás LINQ sobre `IQueryable<T>` pero accedés a propiedades de navegación dentro del loop sin haberlas cargado con `Include`. Cada acceso dispara una query adicional. La solución es `Include` + `ThenInclude` para eager loading, o `Select` para proyectar solo los campos que necesitás y evitar traer entidades enteras.

#### Examples

Deferred execution: la query no corre hasta que se enumera

```csharp
var numbers = new[] { 1, 2, 3, 4, 5 };

// No ejecuta nada todavía, es solo una definición
var query = numbers.Where(n => {
    Console.WriteLine($"Evaluating {n}");
    return n > 2;
});

Console.WriteLine("Before enumeration");
var result = query.ToList(); // aquí se ejecuta
// Output: "Before enumeration" primero, luego los "Evaluating"
```

IEnumerable vs IQueryable: dónde corre el filtro

```csharp
// IQueryable: el WHERE viaja al SQL → eficiente
IQueryable<User> dbQuery = dbContext.Users
    .Where(u => u.IsActive)
    .OrderBy(u => u.Name);

// IEnumerable: trae TODOS los usuarios a memoria, filtra en C#
IEnumerable<User> memQuery = dbContext.Users
    .AsEnumerable()          // fuerza IEnumerable desde aquí
    .Where(u => u.IsActive); // filtro en proceso .NET
```

Multiple enumeration: el pitfall silencioso

```csharp
// PROBLEMA: si GetUsersFromDb() retorna IEnumerable<User> lazy,
// se ejecuta la query dos veces
var users = GetUsersFromDb().Where(u => u.IsActive);
var count = users.Count();   // primera ejecución
var list  = users.ToList();  // segunda ejecución

// SOLUCIÓN: materializar una vez
var usersList = GetUsersFromDb().Where(u => u.IsActive).ToList();
var count2 = usersList.Count; // en memoria, sin re-query
```

#### Sources

- [LINQ Overview](https://learn.microsoft.com/dotnet/csharp/linq/)
- [Deferred versus immediate query execution](https://learn.microsoft.com/dotnet/csharp/linq/get-started/write-linq-queries)
- [IQueryable<T> Interface](https://learn.microsoft.com/dotnet/api/system.linq.iqueryable-1)

---

### `async`/`await` y el modelo Task: ValueTask, ConfigureAwait y deadlocks

#### Details

`async`/`await` es azúcar sintáctica sobre una **máquina de estados** que el compilador genera. Un método `async` se divide en continuaciones: el código antes del primer `await` corre síncronamente en el hilo llamador; cuando el `await` encuentra un `Task` no completado, retorna el control al llamador y registra el resto del método como callback. Cuando el Task completa, el runtime agenda la continuación. No hay "nuevo thread" por defecto; la escalabilidad viene de liberar el thread mientras espera I/O.

`Task<T>` vs `ValueTask<T>`: `Task<T>` es siempre una allocación en el heap. `ValueTask<T>` es un struct que evita esa allocación cuando el resultado está disponible síncronamente (caso frecuente en caching o paths rápidos). Úsalo solo cuando el profiling muestra presión de allocaciones en hot paths; para la mayoría de los casos, `Task<T>` es más simple y tiene mejor soporte en herramientas.

`ConfigureAwait(false)` instrucción al awaiter a no capturar el `SynchronizationContext` actual. En aplicaciones de escritorio (WPF/WinForms) o ASP.NET clásico, hay un contexto que exige que las continuaciones vuelvan al thread UI o al thread de request. Si código de biblioteca hace `await` sin `ConfigureAwait(false)` y el caller espera síncronamente (`.Result` o `.Wait()`), se produce un **deadlock**: el thread de request está bloqueado esperando el Task, y el Task está esperando que ese mismo thread esté libre para ejecutar su continuación. La regla: las bibliotecas deben siempre usar `ConfigureAwait(false)`; las aplicaciones no necesitan hacerlo.

#### Examples

La máquina de estados generada por async/await

```csharp
// Lo que escribís:
public async Task<string> GetDataAsync()
{
    var data = await FetchFromApiAsync();
    return data.ToUpper();
}

// Conceptualmente lo que el compilador genera:
// Un state machine que registra el resto del método como continuación
// cuando FetchFromApiAsync() no completa síncronamente
```

ValueTask en hot paths

```csharp
public ValueTask<int> GetFromCacheAsync(string key)
{
    if (_cache.TryGetValue(key, out var value))
        return ValueTask.FromResult(value); // sin allocación: resultado inmediato

    return new ValueTask<int>(FetchFromDbAsync(key)); // allocación solo si necesario
}
```

Deadlock clásico: sync-over-async

```csharp
// DEADLOCK en ASP.NET clásico o WPF:
public string GetData()
{
    return GetDataAsync().Result; // bloquea el thread, espera la continuación
    // La continuación quiere ese mismo thread → deadlock
}

// FIX en biblioteca: ConfigureAwait(false)
public async Task<string> GetDataAsync()
{
    var data = await FetchFromApiAsync().ConfigureAwait(false);
    return data.ToUpper();
    // La continuación no necesita volver al thread original → no deadlock
}
```

#### Sources

- [Asynchronous programming with async and await](https://learn.microsoft.com/dotnet/csharp/asynchronous-programming/)
- [ValueTask<TResult>](https://learn.microsoft.com/dotnet/api/system.threading.tasks.valuetask-1)
- [ConfigureAwait FAQ](https://learn.microsoft.com/dotnet/core/extensions/async-disposable)

---

### Memory management: GC, IDisposable, Span<T> y patrones zero-allocation

#### Details

El **Garbage Collector** de .NET usa un sistema generacional con tres generaciones (Gen 0, 1, 2). Los objetos nuevos se asignan en Gen 0, que es pequeña y se recolecta frecuentemente con pausas mínimas. Los objetos que sobreviven una recolección promueven a Gen 1 y eventualmente a Gen 2. Gen 2 también incluye el **Large Object Heap** (LOH) para objetos ≥ 85,000 bytes, que solo se recolecta en collections completas y puede fragmentarse. La implicación para el código de producción es minimizar allocaciones en hot paths y evitar objetos grandes de corta vida.

`IDisposable` y el statement `using` son el mecanismo para liberar **recursos no administrados** (handles de archivos, conexiones de red, conexiones de base de datos) de forma determinista, sin esperar al GC. El patrón Dispose correcto implementa `IDisposable.Dispose()` para limpieza determinista y opcionalmente un finalizer (`~ClassName()`) como red de seguridad. Siempre envolvé `IDisposable` en `using` o `await using` (para `IAsyncDisposable`).

`Span<T>` y `ReadOnlySpan<T>` son tipos ref struct que representan una región contigua de memoria,puede ser stack, heap, o memoria nativa, sin allocar. Son la herramienta central para **zero-allocation parsing y slicing**: en lugar de crear substrings (que alloca), creás un `ReadOnlySpan<char>` que apunta a una sección del string original. `stackalloc` permite asignar arrays pequeños directamente en el stack, evitando el heap por completo. Ambas técnicas son relevantes en código de alto rendimiento y APIs web de alto throughput.

#### Examples

El patrón Dispose correcto

```csharp
public class DatabaseConnection : IDisposable
{
    private SqlConnection? _connection;
    private bool _disposed = false;

    public DatabaseConnection(string connStr)
    {
        _connection = new SqlConnection(connStr);
        _connection.Open();
    }

    public void Dispose()
    {
        Dispose(disposing: true);
        GC.SuppressFinalize(this); // evita que el GC llame al finalizer
    }

    protected virtual void Dispose(bool disposing)
    {
        if (!_disposed)
        {
            if (disposing)
                _connection?.Dispose(); // libera recursos administrados

            _disposed = true;
        }
    }
}

// Uso correcto: using garantiza Dispose al salir del bloque
using var conn = new DatabaseConnection(connectionString);
```

Span<T> para parsing sin allocaciones

```csharp
// Con string: alloca dos strings nuevos
string input = "John,Doe,30";
var parts = input.Split(',');
string firstName = parts[0]; // nueva allocación

// Con Span: cero allocaciones
ReadOnlySpan<char> span = input.AsSpan();
int firstComma = span.IndexOf(',');
ReadOnlySpan<char> firstNameSpan = span[..firstComma]; // apunta al original

Console.WriteLine(firstNameSpan.ToString()); // "John"
```

stackalloc para buffers temporales pequeños

```csharp
// Sin heap allocation: el buffer vive en el stack
Span<int> buffer = stackalloc int[64];
for (int i = 0; i < buffer.Length; i++)
    buffer[i] = i * i;

// buffer se libera automáticamente al salir del scope
```

#### Sources

- [Garbage Collection](https://learn.microsoft.com/dotnet/standard/garbage-collection/)
- [IDisposable interface](https://learn.microsoft.com/dotnet/api/system.idisposable)
- [Memory and Span usage guidelines](https://learn.microsoft.com/dotnet/standard/memory-and-spans/)

## Interview Questions

### ¿Cuál es la diferencia entre value types y reference types? ¿Qué implica para el pasaje de parámetros?

Los value types almacenan su valor directamente (en el stack o inline en el heap); los reference types almacenan una referencia al objeto en el heap. Al pasar un value type a un método, se copia el valor: mutaciones internas no afectan al caller. Al pasar un reference type, se copia la referencia: mutaciones al objeto sí se ven desde el caller, pero reasignar la variable local no afecta al caller. Usar `ref` o `out` en un value type permite modificar el original desde el método.

### ¿Por qué boxing y unboxing son costosos? ¿Cuándo ocurren sin que te des cuenta?

Boxing es una allocación en el heap que convierte un value type en un `object`; unboxing es extraerlo de vuelta con un cast que puede fallar en runtime. Son costosos porque presionan al GC con objetos de vida corta. Ocurren de forma implícita al pasar un `int` a un parámetro `object`, al usar colecciones no genéricas como `ArrayList`, o al usar interfaces en value types. La solución es usar genéricos: `List<int>` en lugar de `ArrayList`.

### ¿Cuándo elegís struct sobre class?

Usá `struct` cuando el tipo es pequeño (≤ 16 bytes aproximadamente), es immutable o semánticamente representa un valor (coordenadas, colores, rangos), no va a ser boxeado frecuentemente, y la semántica de copia es deseable. Un `struct` mutable es un antipatrón porque al asignarlo o pasarlo se copia, y las mutaciones sobre la copia son invisibles para el original, generando bugs sutiles. Las guías de Microsoft desaconsejan explícitamente los structs mutables.
