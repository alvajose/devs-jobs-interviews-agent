---
stack: csharp
id: csharp-aspnet
title: "ASP.NET Core: APIs, DI y middleware"
area: Backend
priority: high
resourceLabel: ASP.NET Core, Documentation
resourceUrl: https://learn.microsoft.com/aspnet/core/
---

## Summary

Los mecanismos internos de ASP.NET Core que aparecen en toda entrevista de backend .NET: cómo el pipeline de middleware procesa cada request, cómo el contenedor de DI gestiona los lifetimes y sus trampas, cuándo usar Minimal APIs vs Controllers, cómo DbContext interactúa con el ORM, y cómo asegurar endpoints con JWT y políticas de autorización.

## Concepts

### Middleware pipeline: Use, Run, Map y orden de ejecución

#### Details

El pipeline de ASP.NET Core es una cadena de **middlewares** donde cada uno puede ejecutar lógica antes y después del siguiente. La arquitectura sigue el patrón chain-of-responsibility: cada middleware recibe el `HttpContext` y un `RequestDelegate` (`next`) que representa el resto del pipeline. Al llamar `await next(context)`, pasa el control al siguiente middleware; al no llamarlo, **cortocircuita** el pipeline.

`app.Use()` registra middleware que puede llamar al siguiente (`next`) o cortocircuitar. `app.Run()` es terminal: registra un middleware que siempre cortocircuita (no recibe `next`). `app.Map()` ramifica el pipeline basándose en el path del request: útil para bifurcar comportamiento por prefijo de ruta. El **orden importa**: autenticación debe ir antes que autorización, el manejo de excepciones debe ser el primero registrado para capturar errores de cualquier middleware posterior.

Al escribir middleware personalizado, la forma recomendada es una clase con `InvokeAsync(HttpContext context, RequestDelegate next)` que el framework resuelve por convención, o implementar `IMiddleware` si querés que el contenedor de DI inyecte dependencias con Scoped lifetime (la convención no soporta Scoped porque el middleware se registra como singleton).

#### Examples

Orden del pipeline y cortocircuito

```csharp
var app = builder.Build();

// Primer middleware: manejo de excepciones (debe ser primero para capturar todo)
app.UseExceptionHandler("/error");

// Logging: ejecuta lógica antes y después del resto del pipeline
app.Use(async (context, next) =>
{
    Console.WriteLine($"Request: {context.Request.Path}");
    await next(context); // pasa al siguiente
    Console.WriteLine($"Response: {context.Response.StatusCode}");
});

// Autenticación antes de autorización (orden obligatorio)
app.UseAuthentication();
app.UseAuthorization();

// Terminal: no llama a next
app.Run(async context =>
{
    await context.Response.WriteAsync("Hello from terminal middleware");
});
```

Middleware personalizado con IMiddleware (soporte para Scoped DI)

```csharp
public class RequestTimingMiddleware : IMiddleware
{
    private readonly ILogger<RequestTimingMiddleware> _logger;

    public RequestTimingMiddleware(ILogger<RequestTimingMiddleware> logger)
        => _logger = logger;

    public async Task InvokeAsync(HttpContext context, RequestDelegate next)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        await next(context);
        sw.Stop();
        _logger.LogInformation("{Path} took {Ms}ms",
            context.Request.Path, sw.ElapsedMilliseconds);
    }
}

// Registro en Program.cs
builder.Services.AddTransient<RequestTimingMiddleware>();
app.UseMiddleware<RequestTimingMiddleware>();
```

Map: bifurcación por path

```csharp
// Requests a /api van por un sub-pipeline diferente
app.Map("/api", apiApp =>
{
    apiApp.UseAuthentication();
    apiApp.UseAuthorization();
    apiApp.MapControllers();
});
```

#### Sources

- [ASP.NET Core Middleware](https://learn.microsoft.com/aspnet/core/fundamentals/middleware/)
- [Write custom ASP.NET Core middleware](https://learn.microsoft.com/aspnet/core/fundamentals/middleware/write)

---

### Dependency injection: lifetimes, trampas y IServiceCollection

#### Details

ASP.NET Core incluye un contenedor de DI integrado. Los **lifetimes** determinan cuándo se crea y destruye una instancia de un servicio: **Transient** crea una instancia nueva en cada resolución (ideal para servicios livianos y sin estado); **Scoped** crea una instancia por request HTTP (una instancia compartida dentro del mismo request, destruida al final); **Singleton** crea una instancia única para toda la vida de la aplicación.

La trampa más crítica es **capturar un Scoped service dentro de un Singleton**. Si un Singleton tiene una dependencia Scoped inyectada, esa dependencia scoped queda "atrapada" con la vida del Singleton: no se destruye al final del request y se comparte incorrectamente entre requests. ASP.NET Core detecta esto en development con una excepción al resolver el servicio (scope validation). En production, esta validación está deshabilitada por performance, por lo que el bug se puede colar.

`IServiceCollection` es la interfaz para registrar servicios. Los métodos `AddSingleton`, `AddScoped`, `AddTransient` aceptan tanto la interfaz como la implementación. Para registrar implementaciones múltiples de la misma interfaz se puede usar `Add` directamente o usar fábricas (`AddSingleton<IMyService>(sp => new MyService(sp.GetRequiredService<IDep>()))`). El método `GetRequiredService<T>()` lanza si el servicio no está registrado; `GetService<T>()` retorna null. En producción preferí siempre `GetRequiredService` para fallar rápido.

#### Examples

Registro de los tres lifetimes

```csharp
builder.Services.AddTransient<IEmailService, SmtpEmailService>();
builder.Services.AddScoped<IUserRepository, EfUserRepository>();
builder.Services.AddSingleton<IMemoryCache, MemoryCache>();
```

La trampa Scoped-en-Singleton

```csharp
// BUG: DbContext (Scoped) capturado en un Singleton
public class MySingletonService
{
    private readonly AppDbContext _dbContext; // ← DbContext atrapado

    public MySingletonService(AppDbContext dbContext)
        => _dbContext = dbContext;
}

// FIX: inyectar IServiceScopeFactory y crear un scope manualmente
public class MySingletonService
{
    private readonly IServiceScopeFactory _scopeFactory;

    public MySingletonService(IServiceScopeFactory scopeFactory)
        => _scopeFactory = scopeFactory;

    public async Task DoWorkAsync()
    {
        using var scope = _scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        // dbContext existe solo dentro de este using
    }
}
```

Registro con fábrica para lógica condicional

```csharp
builder.Services.AddSingleton<IStorageService>(sp =>
{
    var config = sp.GetRequiredService<IConfiguration>();
    return config["Storage:Provider"] == "Azure"
        ? new AzureBlobStorageService(config["Storage:ConnectionString"])
        : new LocalFileStorageService(config["Storage:BasePath"]);
});
```

#### Sources

- [Dependency injection in ASP.NET Core](https://learn.microsoft.com/aspnet/core/fundamentals/dependency-injection)
- [Service lifetimes](https://learn.microsoft.com/aspnet/core/fundamentals/dependency-injection#service-lifetimes)

---

### Minimal APIs vs Controllers: cuándo elegir cada uno

#### Details

**Minimal APIs** (introducidas en .NET 6) registran endpoints directamente en `Program.cs` usando métodos de extensión sobre `WebApplication`. Son ideales para microservicios simples, APIs pequeñas, o cuando querés reducir la fricción de los controllers (sin necesidad de atributos, herencia de `ControllerBase`, o archivos separados). El código es más conciso y el startup es marginalmente más rápido. Soportan route groups, filters, y TypedResults para documentación OpenAPI.

**Controllers** siguen el patrón MVC/API: clases que heredan de `ControllerBase`, métodos de acción decorados con atributos HTTP, y una separación explícita de responsabilidades. Son preferibles cuando el dominio tiene mucha lógica en los controllers, necesitás model binding complejo, filters a nivel de controller, herencia de controllers base, o estás en un equipo grande donde la convención de controllers es conocida. También son necesarios para APIs con muchos endpoints donde colocar todo en `Program.cs` se volvería inmanejable.

Los **route groups** (`MapGroup`) en Minimal APIs resuelven el problema de repetición de prefijos de ruta y permiten aplicar filtros y middleware a un grupo de endpoints:

#### Examples

Minimal API con route group y TypedResults

```csharp
var usersGroup = app.MapGroup("/api/users")
    .RequireAuthorization()
    .WithOpenApi();

usersGroup.MapGet("/", async (IUserRepository repo) =>
    TypedResults.Ok(await repo.GetAllAsync()));

usersGroup.MapGet("/{id:int}", async (int id, IUserRepository repo) =>
    await repo.GetByIdAsync(id) is { } user
        ? TypedResults.Ok(user)
        : TypedResults.NotFound());

usersGroup.MapPost("/", async (CreateUserRequest req, IUserRepository repo) =>
{
    var user = await repo.CreateAsync(req);
    return TypedResults.Created($"/api/users/{user.Id}", user);
});
```

Controller equivalente

```csharp
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly IUserRepository _repo;
    public UsersController(IUserRepository repo) => _repo = repo;

    [HttpGet]
    public async Task<IActionResult> GetAll()
        => Ok(await _repo.GetAllAsync());

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
        => await _repo.GetByIdAsync(id) is { } user ? Ok(user) : NotFound();
}
```

#### Sources

- [Minimal APIs overview](https://learn.microsoft.com/aspnet/core/fundamentals/minimal-apis/overview)
- [Choose between controller-based APIs and minimal APIs](https://learn.microsoft.com/aspnet/core/fundamentals/apis)
- [Route groups](https://learn.microsoft.com/aspnet/core/fundamentals/minimal-apis/route-handlers#route-groups)

---

### Entity Framework Core: DbContext lifetime, migraciones, AsNoTracking y SQL raw

#### Details

`DbContext` implementa el **Unit of Work** pattern: rastrea los cambios a las entidades que cargaste y persiste todo en una sola transacción al llamar `SaveChangesAsync()`. Su lifetime correcto en ASP.NET Core es **Scoped**: una instancia por request, registrada con `AddDbContext`. Un DbContext como Singleton es un bug grave: comparte el change tracker entre requests concurrentes, generando condiciones de carrera y datos incorrectos.

El **change tracker** es lo que hace posible detectar cambios automáticamente, pero tiene un costo: EF Core rastrea cada entidad cargada. Para queries de solo lectura (reportes, respuestas de API que no van a mutar datos), `AsNoTracking()` desactiva el tracking, reduciendo memoria y tiempo de procesamiento. La regla práctica: usá `AsNoTracking()` en cualquier query donde no vayas a llamar `SaveChangesAsync()` con esas entidades.

Las **migraciones** son snapshots incrementales del modelo de EF Core generados con `dotnet ef migrations add <Name>`. Cada migración tiene un método `Up()` (aplicar cambio) y `Down()` (revertir). `dotnet ef database update` aplica las pendientes. Para queries complejas que EF Core no puede generar eficientemente, `FromSqlRaw` permite ejecutar SQL literal retornando entidades tipadas; `ExecuteSqlRaw` para comandos sin retorno. Ambos soportan parámetros para evitar SQL injection.

#### Examples

DbContext registrado correctamente como Scoped

```csharp
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("Default")));

// En un repositorio: DI inyecta un DbContext por request
public class UserRepository : IUserRepository
{
    private readonly AppDbContext _db;
    public UserRepository(AppDbContext db) => _db = db;

    // AsNoTracking para queries de lectura
    public Task<List<User>> GetActiveAsync() =>
        _db.Users
           .AsNoTracking()
           .Where(u => u.IsActive)
           .ToListAsync();
}
```

Raw SQL con parámetros (sin SQL injection)

```csharp
// FromSqlRaw con parámetros parametrizados (safe)
var users = await _db.Users
    .FromSqlRaw("SELECT * FROM Users WHERE Email = {0}", email)
    .AsNoTracking()
    .ToListAsync();

// EF Core 7+: FromSql con interpolación segura
var users2 = await _db.Users
    .FromSql($"SELECT * FROM Users WHERE Email = {email}")
    .ToListAsync();

// ExecuteSqlRaw para INSERT/UPDATE/DELETE
await _db.Database.ExecuteSqlRawAsync(
    "UPDATE Users SET LastLoginAt = {0} WHERE Id = {1}",
    DateTime.UtcNow, userId);
```

Migración: comandos del ciclo de vida

```bash
# Crear migración
dotnet ef migrations add AddUserLastLoginAt

# Aplicar al database
dotnet ef database update

# Revertir la última migración
dotnet ef database update PreviousMigrationName
```

#### Sources

- [DbContext Lifetime, Configuration, and Initialization](https://learn.microsoft.com/ef/core/dbcontext-configuration/)
- [Tracking vs No-Tracking Queries](https://learn.microsoft.com/ef/core/querying/tracking)
- [Raw SQL Queries](https://learn.microsoft.com/ef/core/querying/sql-queries)
- [Migrations Overview](https://learn.microsoft.com/ef/core/managing-schemas/migrations/)

---

### Authentication & Authorization: JWT bearer, policies y claims

#### Details

En ASP.NET Core, **autenticación** y **autorización** son dos conceptos separados con middleware separado. La autenticación (`UseAuthentication`) resuelve "¿quién sos?",extrae y valida las credenciales del request y popula `HttpContext.User`. La autorización (`UseAuthorization`) resuelve "¿podés hacer esto?",evalúa si el usuario autenticado tiene permiso para el recurso solicitado. El orden importa: siempre `UseAuthentication` antes de `UseAuthorization`.

**JWT Bearer** es el esquema más común en APIs REST: el cliente incluye un token en el header `Authorization: Bearer <token>`. El middleware valida la firma del token con la clave secreta, la expiración, el issuer y el audience configurados en `AddJwtBearer`. Si el token es válido, popula `HttpContext.User` con los claims del token. Los **claims** son pares clave-valor dentro del token que representan afirmaciones sobre el usuario (id, rol, email, permisos específicos).

Las **políticas** (`AddAuthorization`) son la forma flexible de definir reglas de autorización reutilizables. Una política puede requerir un claim específico, un rol, o implementar un `IAuthorizationRequirement` personalizado con su `IAuthorizationHandler`. Esto es más mantenible que decorar cada endpoint con `[Authorize(Roles = "Admin,Manager")]`, porque centraliza la lógica y permite cambiarla sin tocar los endpoints.

#### Examples

Configuración de JWT Bearer en Program.cs

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer           = true,
            ValidateAudience         = true,
            ValidateLifetime         = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer    = builder.Configuration["Jwt:Issuer"],
            ValidAudience  = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!))
        };
    });
```

Políticas de autorización basadas en claims

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy =>
        policy.RequireRole("Admin"));

    options.AddPolicy("PremiumUser", policy =>
        policy.RequireClaim("subscription", "premium", "enterprise"));

    options.AddPolicy("MinAge18", policy =>
        policy.RequireAssertion(ctx =>
            ctx.User.HasClaim(c => c.Type == "age" && int.Parse(c.Value) >= 18)));
});

// En un endpoint
app.MapDelete("/api/users/{id}", async (int id, IUserRepository repo) =>
{
    await repo.DeleteAsync(id);
    return TypedResults.NoContent();
}).RequireAuthorization("AdminOnly");
```

Generación de token JWT

```csharp
public string GenerateToken(User user)
{
    var claims = new[]
    {
        new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
        new Claim(ClaimTypes.Email, user.Email),
        new Claim(ClaimTypes.Role, user.Role),
    };

    var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
    var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

    var token = new JwtSecurityToken(
        issuer:   _config["Jwt:Issuer"],
        audience: _config["Jwt:Audience"],
        claims:   claims,
        expires:  DateTime.UtcNow.AddHours(1),
        signingCredentials: creds);

    return new JwtSecurityTokenHandler().WriteToken(token);
}
```

#### Sources

- [Authentication in ASP.NET Core](https://learn.microsoft.com/aspnet/core/security/authentication/)
- [Authorization in ASP.NET Core](https://learn.microsoft.com/aspnet/core/security/authorization/introduction)
- [JWT Bearer authentication](https://learn.microsoft.com/aspnet/core/security/authentication/configure-jwt-bearer-token-authentication)
- [Policy-based authorization](https://learn.microsoft.com/aspnet/core/security/authorization/policies)

## Interview Questions

### ¿Por qué el orden de los middlewares importa? ¿Qué pasa si ponés UseAuthorization antes de UseAuthentication?

El pipeline procesa los middlewares en el orden en que fueron registrados. Si `UseAuthorization` va antes de `UseAuthentication`, cuando el middleware de autorización evalúa los permisos, `HttpContext.User` todavía no fue populado con los claims del request,el token JWT ni siquiera fue validado. El resultado es que todos los endpoints protegidos se comportan como si el usuario fuera anónimo. El orden correcto siempre es: manejo de excepciones primero, luego routing, autenticación, y finalmente autorización.

### ¿Cuándo un Scoped service capturado en un Singleton es un bug y cómo se detecta?

Un Scoped service está diseñado para durar un request; si un Singleton lo inyecta en su constructor, ese Scoped service queda vivo para siempre y se comparte entre todos los requests. En el caso de DbContext, significa un change tracker compartido entre requests concurrentes: comportamiento no determinístico y potencialmente datos incorrectos. En ambiente de desarrollo, ASP.NET Core lanza una `InvalidOperationException` al resolver el gráfico de dependencias. La solución es inyectar `IServiceScopeFactory` en el Singleton y crear un scope manualmente cuando se necesita el servicio Scoped.
