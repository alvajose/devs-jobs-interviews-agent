---
stack: csharp
kind: question-bank
source: curated
sourceUrl: https://learn.microsoft.com/dotnet
license: curated
copyright: Written from scratch citing official documentation
---

## Interview Questions

### ¿Cuál es la diferencia entre value types y reference types en C#?

Los value types (`int`, `struct`, `enum`) almacenan su valor directamente en el stack o inline dentro del objeto contenedor; los reference types (`class`, `string`, arrays) almacenan una referencia en el stack que apunta al objeto real en el heap. Al asignar un value type se copia el valor; al asignar un reference type se copia la referencia, por lo que ambas variables apuntan al mismo objeto. Esta distinción define la semántica de igualdad, el comportamiento al pasar parámetros y el costo de memoria.
, [Value types](https://learn.microsoft.com/dotnet/csharp/language-reference/builtin-types/value-types)

### ¿Qué es boxing y unboxing? ¿Por qué son costosos?

Boxing es envolver un value type en un `object` heap-allocated; unboxing es extraer el valor de ese objeto con un cast explícito. Ambas operaciones generan allocaciones en el heap que presionan al GC. El unboxing requiere un cast que puede lanzar `InvalidCastException` en runtime si el tipo no coincide. Ocurren de forma implícita al usar colecciones no genéricas como `ArrayList` o al pasar un `int` a un parámetro `object`. Usar genéricos (`List<int>`) elimina el boxing.

```csharp
int n = 42;
object boxed = n;       // boxing: allocación en heap
int unboxed = (int)boxed; // unboxing: cast explícito
```

, [Boxing and Unboxing](https://learn.microsoft.com/dotnet/csharp/programming-guide/types/boxing-and-unboxing)

### ¿Cuándo elegís struct sobre class?

Elegís `struct` cuando el tipo es pequeño (idealmente ≤ 16 bytes), es immutable por naturaleza, representa semánticamente un valor primitivo (coordenadas, colores, rangos), y la semántica de copia es deseable. Los structs mutables son un antipatrón conocido: al asignarlos o pasarlos se copian, y las mutaciones a la copia son invisibles para el original. Un struct también evita las allocaciones de heap, lo que lo hace valioso en hot paths de alto rendimiento.
, [Choosing Between Class and Struct](https://learn.microsoft.com/dotnet/standard/design-guidelines/choosing-between-class-and-struct)

### ¿Qué garantizan los genéricos que no garantiza usar object?

Los genéricos son verificados en tiempo de compilación: si pasás un tipo incorrecto, el error aparece antes de ejecutar. Usar `object` requiere casts en runtime que pueden lanzar `InvalidCastException` y genera boxing para value types. `List<int>` almacena ints directamente sin boxing; `ArrayList` boxa cada int. Los genéricos también permiten expresar constraints (`where T : IComparable<T>`) que habilitan operaciones sobre T con type safety completa.
, [Generic classes and methods](https://learn.microsoft.com/dotnet/csharp/fundamentals/types/generics)

### ¿Qué son las constraints en genéricos y cuándo las usás?

Las constraints (`where T : ...`) restringen qué tipos puede recibir un parámetro genérico y habilitan operaciones sobre él. `where T : class` garantiza reference type; `where T : struct` garantiza value type; `where T : new()` permite instanciar T con `new T()`; `where T : InterfazX` permite llamar los métodos de esa interfaz sobre T. Sin constraints, sobre T solo podés llamar métodos de `object`. Se usan cuando la implementación genérica necesita asumir algo sobre el tipo para ser útil.

```csharp
public T Max<T>(T a, T b) where T : IComparable<T>
    => a.CompareTo(b) >= 0 ? a : b;
```

, [Constraints on type parameters](https://learn.microsoft.com/dotnet/csharp/programming-guide/generics/constraints-on-type-parameters)

### ¿Qué es covariance y contravariance en genéricos?

Covariance (`out T`) permite que `IEnumerable<Derived>` sea asignable a `IEnumerable<Base>`: el tipo produce T pero no lo consume, así que un consumidor de Base puede recibir uno de Derived. Contravariance (`in T`) permite que `Action<Base>` sea asignable a `Action<Derived>`: el tipo consume T, así que un consumidor que acepta Base también puede aceptar Derived. Solo funciona en interfaces y delegates, no en clases genéricas.
, [Covariance and Contravariance in Generics](https://learn.microsoft.com/dotnet/standard/generics/covariance-and-contravariance)

### ¿Qué es la ejecución diferida (deferred execution) en LINQ?

Los operadores LINQ como `Where`, `Select`, `OrderBy` no ejecutan nada cuando se los llama; definen una query. La ejecución ocurre cuando se enumera: al hacer `foreach`, `ToList()`, `Count()`, `First()`, etc. Esto permite componer queries sin costo hasta que realmente se necesitan los datos. El pitfall es la múltiple enumeración: si enumerás la misma query dos veces, se ejecuta dos veces. La solución es materializar con `ToList()` o `ToArray()` cuando vayas a usar los datos más de una vez.
, [LINQ, Deferred execution](https://learn.microsoft.com/dotnet/csharp/linq/get-started/write-linq-queries)

### ¿Cuál es la diferencia entre IEnumerable<T> e IQueryable<T> en el contexto de LINQ?

`IEnumerable<T>` ejecuta la query en memoria en el proceso .NET: si usás `Where` sobre un `IEnumerable`, trae todos los registros y filtra en C#. `IQueryable<T>` construye una expression tree que el proveedor (EF Core, por ejemplo) traduce a SQL y ejecuta en el servidor de base de datos. Usar `AsEnumerable()` en un `IQueryable` antes del filtro es un bug de performance frecuente: hace que el filtro ocurra en C# en vez de en SQL.
, [IQueryable<T>](https://learn.microsoft.com/dotnet/api/system.linq.iqueryable-1)

### ¿Cómo funciona async/await por debajo? ¿Crea un nuevo thread?

`async`/`await` es azúcar sintáctica sobre una máquina de estados que el compilador genera. No crea un nuevo thread; cuando el código espera una operación I/O, libera el thread actual al thread pool y registra el resto del método como continuación. Cuando la operación completa, el runtime agenda esa continuación para ejecutar en un thread disponible. Esto es lo que permite que un servidor web maneje miles de requests concurrentes con pocos threads: los threads están libres mientras esperan I/O, en lugar de bloqueados.
, [Async/await overview](https://learn.microsoft.com/dotnet/csharp/asynchronous-programming/)

### ¿Cuándo usás ValueTask<T> en lugar de Task<T>?

`ValueTask<T>` es un struct que evita una allocación de heap cuando el resultado está disponible síncronamente. Tiene sentido en hot paths donde el caso frecuente es un resultado inmediato (por ejemplo, lectura de cache en memoria). Para la mayoría de los métodos async, `Task<T>` es la elección correcta: es más simple, tiene mejor soporte en tooling y debuggers, y `ValueTask<T>` tiene restricciones de uso (no se puede awaitar dos veces, no se puede convertir a Task directamente). Solo migrá a `ValueTask<T>` cuando el profiling muestre presión de allocaciones real.
, [ValueTask<TResult>](https://learn.microsoft.com/dotnet/api/system.threading.tasks.valuetask-1)

### ¿Qué es ConfigureAwait(false) y cuándo se usa?

`ConfigureAwait(false)` instruye al awaiter a no capturar el `SynchronizationContext` actual. En frameworks con contexto (WPF, WinForms, ASP.NET clásico), las continuaciones por defecto vuelven al thread original. Si código de biblioteca hace await sin `ConfigureAwait(false)` y el caller espera síncronamente (`.Result`), se puede producir un deadlock: el thread está bloqueado esperando el Task, y el Task espera ese thread. Las bibliotecas de clase deben siempre usar `ConfigureAwait(false)`; las aplicaciones generalmente no lo necesitan.
, [ConfigureAwait FAQ](https://learn.microsoft.com/dotnet/csharp/asynchronous-programming/task-asynchronous-programming-model)

### ¿Cómo produce un deadlock el patrón sync-over-async?

```csharp
// En ASP.NET clásico (con SynchronizationContext):
public string GetData() => GetDataAsync().Result; // DEADLOCK
```

El thread del request llama `.Result`, que bloquea el thread. `GetDataAsync` completa su await y necesita ese mismo thread para ejecutar la continuación. Ambos se esperan mutuamente. El fix es `ConfigureAwait(false)` en la biblioteca, o mejor aún, no bloquear async code con `.Result` o `.Wait()`: hacerlo async hasta la capa de arriba.
, [Async programming best practices](https://learn.microsoft.com/dotnet/csharp/asynchronous-programming/async-scenarios)

### ¿Qué hace el Garbage Collector con las generaciones? ¿Qué es el LOH?

El GC divide el heap en Gen 0, Gen 1 y Gen 2. Los objetos nuevos entran a Gen 0, que es pequeña y se recolecta frecuentemente con pausas mínimas. Los objetos que sobreviven promueven a generaciones mayores. Gen 2 también incluye el **Large Object Heap** (LOH) para objetos ≥ 85,000 bytes, recolectado solo en collections completas. El LOH tiende a fragmentarse porque no se compacta por defecto. Para código de alto rendimiento, el objetivo es minimizar allocaciones en Gen 0 y evitar objetos grandes de vida corta.
, [Garbage Collection](https://learn.microsoft.com/dotnet/standard/garbage-collection/)

### ¿Cuándo y cómo implementás IDisposable correctamente?

`IDisposable` se implementa cuando la clase posee recursos no administrados (handles de archivos, conexiones de base de datos, sockets) o recursos administrados costosos que no querés esperar al GC para liberar. El patrón correcto tiene un método `Dispose(bool disposing)` que distingue si fue llamado por el usuario (disposing=true, libera todo) o por el finalizer (disposing=false, solo libera no-administrados). En `Dispose()` público se llama `GC.SuppressFinalize(this)` para evitar el costo del finalizer cuando el objeto ya fue dispuesto.

```csharp
public void Dispose()
{
    Dispose(disposing: true);
    GC.SuppressFinalize(this);
}
```

, [IDisposable](https://learn.microsoft.com/dotnet/api/system.idisposable)

### ¿Qué es Span<T> y cuándo lo usás para evitar allocaciones?

`Span<T>` es un ref struct que representa una región contigua de memoria (stack, heap, o nativa) sin copiarla. `ReadOnlySpan<char>` permite hacer slicing de strings sin crear substrings nuevos: `span[..index]` retorna una vista del original. Es ideal para parsing de alto rendimiento, procesamiento de texto, y manipulación de buffers donde crear strings intermedios presionaría al GC. La limitación es que no puede ser campo de una clase (solo variables locales) y no puede cruzar awaits.

```csharp
ReadOnlySpan<char> span = "John,Doe".AsSpan();
var first = span[..span.IndexOf(',')]; // cero allocaciones
```

, [Memory and Span usage guidelines](https://learn.microsoft.com/dotnet/standard/memory-and-spans/)

### ¿Qué son los delegates en C# y para qué se usan?

Un delegate es un tipo que encapsula una referencia a un método con una firma específica: funciona como un puntero a función type-safe. Son la base de los eventos, LINQ, callbacks y el patrón observer. `Func<T, TResult>` encapsula métodos que retornan un valor; `Action<T>` encapsula métodos void; `Predicate<T>` encapsula métodos que retornan bool. Los delegates multicast pueden encadenar múltiples métodos con `+=`.

```csharp
Func<int, int, int> add = (a, b) => a + b;
Action<string> log = message => Console.WriteLine(message);
```

, [Delegates](https://learn.microsoft.com/dotnet/csharp/programming-guide/delegates/)

### ¿Cuál es la diferencia entre Func<T>, Action<T> y Predicate<T>?

`Func<T..., TResult>` encapsula un método que retorna un valor (el último parámetro de tipo es el retorno). `Action<T...>` encapsula un método void: no retorna nada. `Predicate<T>` encapsula un método que toma un T y retorna bool,es equivalente a `Func<T, bool>`. La distinción importa para legibilidad: usar `Predicate<T>` en un método de filtrado comunica la intención más claramente que `Func<T, bool>`, aunque son intercambiables en la mayoría de los contextos.
, [Func delegate](https://learn.microsoft.com/dotnet/api/system.func-2), [Action delegate](https://learn.microsoft.com/dotnet/api/system.action-1)

### ¿Qué son las expresiones lambda y cómo se relacionan con los delegates?

Una expresión lambda es una forma concisa de definir un delegate inline: `(x) => x * 2` es un `Func<int, int>`. El compilador infiere el tipo del delegate del contexto. Las lambdas pueden capturar variables del scope externo (closures), lo que puede generar allocaciones si se usan en hot paths. Las lambda expressions son la base de LINQ: `Where(u => u.IsActive)` pasa una lambda que el compilador convierte en un delegate (o en una expression tree si el parámetro es `IQueryable<T>`).
, [Lambda expressions](https://learn.microsoft.com/dotnet/csharp/language-reference/operators/lambda-expressions)

### ¿Qué es la palabra clave yield y cómo funciona un iterator?

`yield return` convierte un método en un **iterator**: el compilador genera una máquina de estados que "pausa" el método en cada `yield return` y lo reanuda desde ahí en el próximo `MoveNext()`. El resultado es un `IEnumerable<T>` lazy que produce elementos bajo demanda. Esto permite procesar secuencias grandes sin materialized them en memoria. `yield break` termina el iterator. El método debe retornar `IEnumerable<T>`, `IEnumerator<T>` o sus variantes async.

```csharp
IEnumerable<int> Evens(int max)
{
    for (int i = 0; i <= max; i += 2)
        yield return i;
}
```

, [yield statement](https://learn.microsoft.com/dotnet/csharp/language-reference/statements/yield)

### ¿Cuál es la diferencia entre interface y abstract class en C#?

Una interfaz define un contrato puro: lista qué métodos/propiedades debe exponer un tipo, sin estado. Una clase abstracta puede tener implementación parcial, campos, constructores, y estado compartido. Una clase puede implementar múltiples interfaces pero heredar de solo una clase (abstracta o no). Elegís abstract class cuando querés compartir implementación y estado entre subclases relacionadas. Elegís interfaz cuando querés un contrato que cualquier tipo (incluidos structs) pueda cumplir, especialmente para DI y testing.
, [Interfaces](https://learn.microsoft.com/dotnet/csharp/fundamentals/types/interfaces), [Abstract classes](https://learn.microsoft.com/dotnet/csharp/programming-guide/classes-and-structs/abstract-and-sealed-classes-and-class-members)

### ¿Cuándo usás ref y out como modificadores de parámetros?

`ref` pasa una referencia al valor original: el parámetro debe estar inicializado antes de llamar al método, y el método puede leerlo y modificarlo. `out` es similar pero no requiere inicialización previa: el método está obligado a asignarlo antes de retornar. Se usan para métodos que necesitan retornar múltiples valores (`TryParse`, `TryGetValue`) o para pasar value types sin boxing a métodos que los modifican. En código moderno se prefiere retornar tuplas o records en vez de `out` salvo en el patrón Try\*.
, [ref keyword](https://learn.microsoft.com/dotnet/csharp/language-reference/keywords/ref), [out keyword](https://learn.microsoft.com/dotnet/csharp/language-reference/keywords/out-parameter-modifier)

### ¿Qué son los extension methods y qué restricciones tienen?

Los extension methods permiten agregar métodos a un tipo existente sin modificarlo ni heredar de él. Se definen como métodos estáticos en una clase estática, con `this TipoAExtender` como primer parámetro. El compilador los trata como si fueran métodos de instancia del tipo. Restricciones: no pueden acceder a miembros privados, no pueden sobreescribir métodos existentes (si hay un método de instancia con la misma firma, gana el de instancia), y se resuelven en compile time, no en runtime (sin polimorfismo).

```csharp
public static class StringExtensions
{
    public static bool IsNullOrEmpty(this string? s) => string.IsNullOrEmpty(s);
}
```

, [Extension methods](https://learn.microsoft.com/dotnet/csharp/programming-guide/classes-and-structs/extension-methods)

### ¿Cómo funciona el middleware pipeline de ASP.NET Core?

El pipeline es una cadena de middlewares donde cada uno recibe el `HttpContext` y un delegate `next` que representa el resto del pipeline. Un middleware puede ejecutar lógica antes de llamar a `next` (pre-processing), después de llamar a `next` (post-processing), o cortocircuitar sin llamar a `next`. El orden de registro en `Program.cs` define el orden de ejecución. La regla clave: el middleware de manejo de excepciones debe registrarse primero para capturar errores de cualquier middleware posterior.
, [ASP.NET Core Middleware](https://learn.microsoft.com/aspnet/core/fundamentals/middleware/)

### ¿Cuáles son los tres lifetimes del contenedor de DI y cuándo usás cada uno?

**Transient** crea una instancia nueva por cada resolución: para servicios livianos y sin estado. **Scoped** crea una instancia por request HTTP: para servicios que deben ser consistentes dentro de un request (DbContext, repositorios). **Singleton** crea una instancia única para toda la vida de la aplicación: para servicios thread-safe, costosos de crear, que mantienen estado global (caches, configuración). La regla de oro: un Singleton no puede capturar un Scoped porque outlive el scope del Scoped.
, [Service lifetimes](https://learn.microsoft.com/aspnet/core/fundamentals/dependency-injection#service-lifetimes)

### ¿Por qué no podés inyectar un Scoped service en un Singleton? ¿Cómo lo resolvés?

Un Singleton vive para siempre; un Scoped vive por un request. Si el Singleton captura el Scoped en su constructor, ese Scoped queda vivo indefinidamente y se comparte entre requests: el change tracker de un DbContext atrapado acumula cambios de múltiples requests concurrentes. ASP.NET Core detecta esto en development y lanza una excepción. La solución es inyectar `IServiceScopeFactory` en el Singleton y crear un scope manualmente en cada operación que necesite el Scoped service.
, [Dependency injection anti-patterns](https://learn.microsoft.com/aspnet/core/fundamentals/dependency-injection#scope-validation)

### ¿Cuándo elegís Minimal APIs sobre Controllers?

Minimal APIs son ideales para microservicios con pocos endpoints, APIs internas simples, o cuando querés reducir la fricción del modelo MVC (sin herencia, sin atributos, sin clases separadas). Los Controllers son preferibles cuando tenés muchos endpoints que justifican organización en clases, necesitás model binding complejo, filters a nivel de controller, herencia entre controllers, o un equipo que ya conoce bien el modelo MVC. A partir de .NET 7+, Minimal APIs con route groups y filters alcanzan paridad de features con Controllers para la mayoría de los casos de uso.
, [Choose between controller-based and minimal APIs](https://learn.microsoft.com/aspnet/core/fundamentals/apis)

### ¿Qué es AsNoTracking() en EF Core y cuándo lo usás?

`AsNoTracking()` desactiva el change tracker para una query: EF Core no registra las entidades retornadas ni detecta cambios sobre ellas. Usalo en cualquier query donde no vayas a llamar `SaveChangesAsync()` con esas entidades. En queries de lectura (reportes, respuestas de API), `AsNoTracking()` reduce el uso de memoria y el tiempo de procesamiento porque EF Core no tiene que registrar ni comparar snapshots. Puede tener un impacto significativo en queries que retornan muchas entidades.

```csharp
var users = await _db.Users.AsNoTracking().Where(u => u.IsActive).ToListAsync();
```

, [Tracking vs No-Tracking Queries](https://learn.microsoft.com/ef/core/querying/tracking)

### ¿Cuál debe ser el lifetime de DbContext en ASP.NET Core?

`DbContext` debe ser **Scoped**: una instancia por request HTTP. Así se garantiza que todas las operaciones en un request comparten el mismo unit of work y change tracker, y que el contexto se destruye correctamente al final del request. Un DbContext Singleton es un bug grave: comparte el change tracker entre requests concurrentes, genera condiciones de carrera y puede retornar datos incorrectos. `AddDbContext<T>()` registra el contexto como Scoped por defecto.
, [DbContext Lifetime](https://learn.microsoft.com/ef/core/dbcontext-configuration/)

### ¿Cómo usás FromSqlRaw de forma segura? ¿Por qué no concatenar strings?

`FromSqlRaw` con parámetros posicionales (`{0}`, `{1}`) o `FromSql` con interpolación de strings (EF Core 7+) parametrizan la query de forma segura: los valores se pasan como parámetros SQL, no como parte del texto de la query. Concatenar strings directamente (`"WHERE Id = " + id`) produce SQL injection: un atacante puede inyectar SQL arbitrario. EF Core 7+ introdujo `FromSql($"SELECT * FROM Users WHERE Email = {email}")` que usa `FormattableString` para distinguir la interpolación segura de una concatenación peligrosa.
, [Raw SQL Queries](https://learn.microsoft.com/ef/core/querying/sql-queries)

### ¿Cómo configurás JWT bearer authentication en ASP.NET Core?

Registrás el esquema con `AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options => ...)` donde configurás `TokenValidationParameters`: validar issuer, audience, lifetime y la clave de firma. En el pipeline agregás `UseAuthentication()` antes de `UseAuthorization()`. Los endpoints se protegen con `[Authorize]` o `.RequireAuthorization()`. El middleware valida el token del header `Authorization: Bearer <token>` y popula `HttpContext.User` con los claims del token si es válido.
, [JWT Bearer authentication](https://learn.microsoft.com/aspnet/core/security/authentication/configure-jwt-bearer-token-authentication)

### ¿Cuál es la diferencia entre autenticación y autorización en ASP.NET Core?

**Autenticación** resuelve "¿quién sos?", valida las credenciales y popula `HttpContext.User`. **Autorización** resuelve "¿podés hacer esto?", evalúa si el usuario autenticado tiene permiso para el recurso. Son middlewares separados con responsabilidades distintas. Un request puede pasar autenticación (el token JWT es válido y sabemos quién es el usuario) pero fallar autorización (el usuario no tiene el rol o claim necesario). El orden importa: `UseAuthentication()` siempre antes de `UseAuthorization()`.
, [Authentication vs Authorization](https://learn.microsoft.com/aspnet/core/security/authorization/introduction)

### ¿Qué son las políticas de autorización y qué ventaja tienen sobre Roles?

Las políticas centralizan la lógica de autorización en `AddAuthorization(options => options.AddPolicy("NombrePolitica", policy => ...))`. En vez de esparcir `[Authorize(Roles = "Admin,Manager")]` en múltiples controllers, definís la regla una vez y la aplicás por nombre. Las políticas son más expresivas: pueden requerir claims específicos, assertions personalizadas, o `IAuthorizationRequirement` con handlers complejos. Si la regla de acceso cambia, la modificás en un solo lugar.
, [Policy-based authorization](https://learn.microsoft.com/aspnet/core/security/authorization/policies)

### ¿Qué es IHostedService y cuándo lo usás?

`IHostedService` define un servicio de background que el host de ASP.NET Core inicia y detiene con la aplicación. `StartAsync` se llama al iniciar la aplicación; `StopAsync` recibe un `CancellationToken` para apagar limpiamente. Úsalo para tareas periódicas (polling, cron-like jobs), inicialización de recursos al arranque, o procesamiento de colas en background. La clase base `BackgroundService` simplifica la implementación: sobreescribís `ExecuteAsync(CancellationToken)` con tu lógica en loop.

```csharp
public class QueueProcessor : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await ProcessNextMessageAsync();
            await Task.Delay(1000, stoppingToken);
        }
    }
}
```

, [Background tasks with hosted services](https://learn.microsoft.com/aspnet/core/fundamentals/host/hosted-services)

### ¿Cómo funciona System.Threading.Channels y para qué se usa?

`System.Threading.Channels` provee una abstracción de producer-consumer thread-safe y async-friendly: un `Channel<T>` tiene un `Writer` para publicar y un `Reader` para consumir. Es ideal para desacoplar producción y consumo con backpressure: podés crear un `BoundedChannel` con capacidad máxima que bloquea al writer cuando está lleno. Es más eficiente y ergonómico que `ConcurrentQueue<T>` con semáforos manuales para pipelines async.

```csharp
var channel = Channel.CreateBounded<WorkItem>(capacity: 100);
// Producer
await channel.Writer.WriteAsync(item, cancellationToken);
// Consumer
await foreach (var item in channel.Reader.ReadAllAsync(cancellationToken))
    await ProcessAsync(item);
```

, [System.Threading.Channels](https://learn.microsoft.com/dotnet/core/extensions/channels)

### ¿Cómo configurás logging en ASP.NET Core y cuáles son los log levels?

ASP.NET Core incluye logging integrado con `ILogger<T>`. Los log levels en orden creciente de severidad son: `Trace`, `Debug`, `Information`, `Warning`, `Error`, `Critical`. Se configuran por namespace en `appsettings.json` bajo `"Logging:LogLevel"`. Para producción, el proveedor por defecto escribe a la consola; se pueden agregar proveedores externos (Serilog, NLog) vía packages. `ILogger<T>` se inyecta vía DI y la categoría (nombre de la clase) se incluye automáticamente en cada log entry.

```csharp
_logger.LogInformation("User {UserId} logged in at {Time}", userId, DateTime.UtcNow);
```

, [Logging in .NET Core](https://learn.microsoft.com/aspnet/core/fundamentals/logging/)

### ¿Cuál es la diferencia entre IMemoryCache e IDistributedCache?

`IMemoryCache` almacena datos en la memoria del proceso: es rápido pero los datos no se comparten entre instancias (no sirve en un cluster con múltiples servidores). `IDistributedCache` es una abstracción sobre almacenes externos (Redis, SQL Server): los datos son compartidos entre todas las instancias del servicio. Usá `IMemoryCache` para datos de corta vida específicos de la instancia (sesiones de usuario en un solo servidor, configuración costosa de parsear). Usá `IDistributedCache` cuando la aplicación escala horizontalmente o cuando los datos en cache deben sobrevivir reinicios.
, [Caching in ASP.NET Core](https://learn.microsoft.com/aspnet/core/performance/caching/overview)

### ¿Qué son las migraciones de EF Core y cómo se gestionan?

Las migraciones son snapshots incrementales del modelo de EF Core que representan cambios al schema de la base de datos. Se generan con `dotnet ef migrations add <Nombre>` y contienen métodos `Up()` (aplicar el cambio) y `Down()` (revertirlo). Se aplican a la base de datos con `dotnet ef database update`. En producción, el enfoque recomendado es generar el SQL de la migración con `dotnet ef migrations script` y aplicarlo en un pipeline de CI/CD controlado, en vez de aplicar migraciones automáticamente en el startup.
, [Migrations Overview](https://learn.microsoft.com/ef/core/managing-schemas/migrations/)

### ¿Cómo manejarías un N+1 problem en EF Core?

El N+1 problem ocurre cuando cargás una lista de entidades y luego accedés a una propiedad de navegación de cada una dentro de un loop, generando una query SQL por cada elemento. La solución principal es **eager loading** con `Include()` + `ThenInclude()` para cargar las relaciones en la misma query. Alternativamente, una proyección con `Select()` que traiga solo los campos necesarios evita cargar entidades completas y sus relaciones no usadas. `AsSplitQuery()` divide la query en múltiples SELECT en vez de un JOIN que puede producir producto cartesiano en relaciones one-to-many.

```csharp
// Eager loading: una sola query con JOIN
var orders = await _db.Orders
    .Include(o => o.Customer)
    .Include(o => o.Items)
    .AsNoTracking()
    .ToListAsync();
```

, [Loading Related Data](https://learn.microsoft.com/ef/core/querying/related-data/)

### ¿Qué es un filter en Minimal APIs y para qué sirve?

Los filters en Minimal APIs (equivalentes a los Action Filters de Controllers) interceptan la invocación del endpoint: pueden ejecutar lógica antes y después, validar el request, o cortocircuitar retornando una respuesta sin llamar al handler. Se implementan con `IEndpointFilter` o con el método `AddEndpointFilter<T>()`. Úsalos para validación transversal (FluentValidation automático), logging de requests, o transformación de responses. Los route groups permiten aplicar un filter a múltiples endpoints a la vez.
, [Filters in Minimal API apps](https://learn.microsoft.com/aspnet/core/fundamentals/minimal-apis/min-api-filters)

### ¿Cómo leés configuración tipada en ASP.NET Core con IOptions<T>?

El sistema de configuración de ASP.NET Core soporta múltiples fuentes (appsettings.json, variables de entorno, secrets) que se fusionan jerárquicamente. Para acceder a una sección tipada, definís una clase POCO que mapea la estructura JSON y la registrás con `builder.Services.Configure<MySettings>(builder.Configuration.GetSection("MySettings"))`. Se inyecta como `IOptions<MySettings>` (valor fijo al startup), `IOptionsSnapshot<MySettings>` (se recarga por request si el archivo cambia), o `IOptionsMonitor<MySettings>` (notificaciones de cambio en tiempo real).
, [Options pattern in ASP.NET Core](https://learn.microsoft.com/aspnet/core/fundamentals/configuration/options)

### ¿Qué son los records en C# y cuándo los preferís sobre clases?

Los `record` son tipos por referencia (o value con `record struct`) diseñados para datos inmutables con igualdad basada en valor: dos records con las mismas propiedades son iguales. El compilador genera automáticamente `Equals`, `GetHashCode`, `ToString` y el operador `==` basados en las propiedades. Son ideales para DTOs, response objects, value objects de DDD, y cualquier tipo donde la igualdad semántica sea por contenido. La sintaxis positional (`record Person(string Name, int Age)`) es concisa para tipos simples.

```csharp
record UserDto(int Id, string Name, string Email);
var a = new UserDto(1, "Alice", "alice@example.com");
var b = new UserDto(1, "Alice", "alice@example.com");
Console.WriteLine(a == b); // true, igualdad por valor
```

, [Records](https://learn.microsoft.com/dotnet/csharp/language-reference/builtin-types/record)

### ¿Qué es el patrón Repository y cómo se implementa con EF Core?

El patrón Repository abstrae el acceso a datos detrás de una interfaz, desacoplando la lógica de negocio de la tecnología de persistencia. En EF Core, el DbContext ya implementa Unit of Work; agregar un Repository sobre él agrega una capa de indirección útil para testing (podés mockear `IUserRepository` sin DbContext) y para encapsular queries complejas. La implementación típica tiene una interfaz con métodos CRUD y de query, y una implementación que usa `DbContext`. Evitá el antipatrón de un repositorio genérico que exponga `IQueryable<T>`: filtrá la data antes de retornarla.
, [Repository pattern with EF Core](https://learn.microsoft.com/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/infrastructure-persistence-layer-design)

### ¿Cómo funciona el model binding en Controllers y Minimal APIs?

En Controllers, ASP.NET Core bind automáticamente los parámetros de los action methods: `[FromRoute]` desde segmentos de la URL, `[FromQuery]` desde query string, `[FromBody]` desde el cuerpo JSON (inferido si el tipo es complejo). En Minimal APIs, el binding es similar pero sin atributos: tipos simples se bindean desde route/query automáticamente; tipos complejos se asumen `[FromBody]`. `IFormFile` se bindea desde multipart. La validación de `DataAnnotations` se ejecuta automáticamente en Controllers con `[ApiController]`; en Minimal APIs requiere validación explícita o un filter.
, [Model binding in ASP.NET Core](https://learn.microsoft.com/aspnet/core/mvc/models/model-binding)
