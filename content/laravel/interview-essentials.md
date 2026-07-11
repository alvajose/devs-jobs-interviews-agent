---
stack: laravel
id: laravel-interview-essentials
title: Laravel: Preguntas esenciales de entrevista
area: Backend
priority: high
resourceLabel: Laravel, Documentation
resourceUrl: https://laravel.com/docs
---

## Summary
Preguntas frecuentes de entrevistas Laravel, respondidas con criterio de producción y basadas en documentación oficial.

## Concepts

### Ciclo de vida, Container y Providers
#### Details
Una entrevista Laravel suele empezar por el recorrido de una request y el rol del container. La respuesta fuerte conecta las piezas: `public/index.php` carga la app, el kernel procesa middleware, el router resuelve la ruta, el controlador recibe dependencias desde el Service Container y la respuesta vuelve por el pipeline.

El Service Container gestiona dependencias e inyección. Laravel puede resolver clases concretas por autowiring, pero las interfaces necesitan un binding explícito. Ese punto es clave para testabilidad: si un controlador depende de una interfaz, puedes sustituir la implementación en tests o en otro entorno sin cambiar el consumidor.

Los Service Providers son el punto central de bootstrap. `register()` se usa para registrar bindings en el container; `boot()` corre después de registrar providers y puede depender de otros servicios ya disponibles. Esta diferencia aparece mucho en entrevistas porque revela si entiendes el arranque del framework.

#### Examples
Inyección de dependencias en un controlador
```php
class PodcastController extends Controller
{
    public function __construct(
        protected AppleMusic $apple,
    ) {}

    public function show(string $id): View
    {
        return view('podcasts.show', [
            'podcast' => $this->apple->findPodcast($id),
        ]);
    }
}
```

Binding de interfaz a implementación
```php
public function register(): void
{
    $this->app->bind(PaymentGateway::class, StripeGateway::class);
}
```

`boot()` puede recibir dependencias del container
```php
public function boot(ResponseFactory $response): void
{
    $response->macro('serialized', function (mixed $value) {
        // ...
    });
}
```

#### Sources
- [Laravel docs, Request lifecycle](https://laravel.com/docs/lifecycle)
- [Laravel docs, Service container](https://laravel.com/docs/container)
- [Laravel docs, Service providers](https://laravel.com/docs/providers)

### Middleware, autenticación y autorización
#### Details
Middleware resuelve preocupaciones transversales de la request: autenticación, rate limiting, CORS, logging, locale o restricciones globales. No debería contener lógica de negocio. Una buena respuesta separa capas: middleware decide si la request pasa; Form Request valida datos; policies/gates autorizan acciones; servicios ejecutan negocio.

Autenticación responde "quién es el usuario". En APIs modernas, Sanctum suele cubrir SPAs propias, mobile y tokens simples. Para rutas protegidas, `auth:sanctum` valida la identidad y expone `$request->user()`.

Autorización responde "qué puede hacer ese usuario". Laravel ofrece Gates para permisos generales y Policies para acciones sobre modelos. La documentación lo resume bien: gates son como rutas simples; policies agrupan lógica alrededor de un modelo o recurso.

#### Examples
Ruta protegida con Sanctum
```php
Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');
```

Gate para acceso general
```php
Gate::define('viewPulse', function (User $user) {
    return $user->isAdmin();
});
```

Policy para un recurso
```php
class PostPolicy
{
    public function update(User $user, Post $post): bool
    {
        return $user->id === $post->user_id;
    }
}
```

Autorizar antes de entrar al controlador con middleware
```php
Route::put('/posts/{post}', [PostController::class, 'update'])
    ->middleware('can:update,post');
```

#### Sources
- [Laravel docs, Middleware](https://laravel.com/docs/middleware)
- [Laravel docs, Sanctum](https://laravel.com/docs/sanctum)
- [Laravel docs, Authorization](https://laravel.com/docs/authorization)

### Eloquent: relaciones, N+1 y mass assignment
#### Details
Eloquent se evalúa mucho porque combina productividad con riesgos de rendimiento y seguridad. Debes saber modelar relaciones (`hasMany`, `belongsTo`, `belongsToMany`), cuándo usar eager loading y cómo evitar consultas ocultas.

El problema N+1 ocurre cuando iteras una colección y accedes a una relación que no fue cargada. La solución típica es `with()`, `load()` o constraints de eager loading. En entrevistas, no basta decir "uso with"; explica cómo diagnosticas el conteo de queries y cómo decides qué relaciones cargar.

Mass assignment es otro tema recurrente. `Model::create($request->all())` sin control puede permitir que el usuario escriba columnas sensibles. La defensa es validar input y limitar atributos asignables con `$fillable` o `$guarded`.

#### Examples
Eager loading para evitar N+1
```php
$books = Book::with('author')->get();

foreach ($books as $book) {
    echo $book->author->name;
}
```

Eager loading de múltiples relaciones
```php
$books = Book::with(['author', 'publisher'])->get();
```

Cargar relaciones sobre una colección existente
```php
$users->load([
    'comments.author',
    'posts' => fn ($query) => $query->where('active', 1),
]);
```

Proteger mass assignment
```php
class User extends Model
{
    protected $fillable = ['name', 'email'];
}
```

#### Sources
- [Laravel docs, Eloquent relationships](https://laravel.com/docs/eloquent-relationships)
- [Laravel docs, Eager loading](https://laravel.com/docs/eloquent-relationships#eager-loading)
- [Laravel docs, Mass assignment](https://laravel.com/docs/eloquent#mass-assignment)

### APIs, validación y Resources
#### Details
En entrevistas Laravel backend, una pregunta común es cómo diseñar una API mantenible. La respuesta debería incluir rutas claras, validación antes del controlador, respuestas consistentes y transformación de modelos con API Resources.

Form Requests encapsulan reglas de validación y autorización de input. Eso mantiene controladores pequeños y hace explícito el contrato de entrada. Para la salida, API Resources evitan exponer el modelo Eloquent completo y permiten controlar campos, relaciones condicionales, links y metadata.

Una buena API también evita colecciones ilimitadas: usa paginación, códigos HTTP correctos y formatos de error consistentes. Si el endpoint incluye relaciones, combina Resources con eager loading para evitar N+1.

#### Examples
Form Request en controlador
```php
public function store(StorePostRequest $request)
{
    $post = Post::create($request->validated());

    return new PostResource($post);
}
```

Resource con relación condicional
```php
return [
    'id' => $this->id,
    'title' => $this->title,
    'author' => new UserResource($this->whenLoaded('user')),
];
```

Colección paginada
```php
return PostResource::collection(
    Post::with('user')->latest()->paginate(15),
);
```

#### Sources
- [Laravel docs, Validation](https://laravel.com/docs/validation)
- [Laravel docs, Eloquent API Resources](https://laravel.com/docs/eloquent-resources)
- [Laravel docs, Pagination](https://laravel.com/docs/pagination)

### Queues, scheduling y eventos
#### Details
Queues aparecen mucho en entrevistas porque separan latencia de confiabilidad. Si una acción es lenta o depende de terceros (emails, imágenes, reportes, webhooks), no debería bloquear la request. Se encola un job y un worker lo procesa.

La parte importante no es solo `dispatch()`: es diseñar jobs idempotentes, configurar reintentos, backoff, timeouts y manejar fallos. Un job puede ejecutarse más de una vez, por lo que no debe duplicar efectos como cobros, emails o registros.

El scheduler define tareas recurrentes en código y normalmente se ejecuta con un único cron del sistema que corre `schedule:run` cada minuto. Eventos y listeners ayudan a desacoplar efectos secundarios del flujo principal.

#### Examples
Job con reintentos y backoff
```php
class ProcessPodcast implements ShouldQueue
{
    public int $tries = 3;
    public int $backoff = 10;

    public function handle(): void
    {
        // Trabajo pesado
    }
}
```

Despachar trabajo a una cola específica
```php
ProcessPodcast::dispatch($podcast)->onQueue('media');
```

Tarea programada sin solaparse
```php
Schedule::command('reports:generate')
    ->dailyAt('02:00')
    ->withoutOverlapping();
```

Listener encolado para efecto secundario
```php
class SendWelcomeEmail implements ShouldQueue
{
    public function handle(UserRegistered $event): void
    {
        Mail::to($event->user)->send(new WelcomeMail());
    }
}
```

#### Sources
- [Laravel docs, Queues](https://laravel.com/docs/queues)
- [Laravel docs, Task scheduling](https://laravel.com/docs/scheduling)
- [Laravel docs, Events](https://laravel.com/docs/events)

### Testing y fakes
#### Details
Laravel favorece feature tests para comportamiento real: haces una request, atraviesas routing, middleware, validación, controlador y base de datos, y verificas respuesta/efectos. Unit tests quedan para lógica pura o servicios aislados.

Factories hacen que cada test cree sus propios datos sin depender de seeders o estado global. `RefreshDatabase` mantiene aislamiento entre tests.

Fakes son clave para bordes externos: `Mail::fake()`, `Queue::fake()`, `Event::fake()`, `Http::fake()` o `Storage::fake()`. Pruebas que tu código intentó enviar un email o encolar un job sin ejecutar el efecto real.

#### Examples
Feature test de endpoint
```php
public function test_user_can_create_post(): void
{
    $user = User::factory()->create();

    $response = $this->actingAs($user)
        ->postJson('/api/posts', ['title' => 'Hola']);

    $response->assertCreated();
    $this->assertDatabaseHas('posts', ['title' => 'Hola']);
}
```

Autenticar usuario con abilities de Sanctum
```php
Sanctum::actingAs(
    User::factory()->create(),
    ['view-tasks'],
);
```

Fake de cola
```php
Queue::fake();

$this->postJson('/api/podcasts', $data)->assertCreated();

Queue::assertPushed(ProcessPodcast::class);
```

#### Sources
- [Laravel docs, Testing](https://laravel.com/docs/testing)
- [Laravel docs, HTTP tests](https://laravel.com/docs/http-tests)
- [Laravel docs, Database testing](https://laravel.com/docs/database-testing)
- [Laravel docs, Mocking / fakes](https://laravel.com/docs/mocking)
- [Laravel docs, Sanctum testing](https://laravel.com/docs/sanctum#testing)

## Interview Questions

### Explica el ciclo de vida de una request en Laravel y dónde pondrías autenticación, validación y lógica de negocio.
La request entra por `public/index.php`, pasa por el kernel, middleware global, router, middleware de ruta y controlador. Autenticación y rate limiting van en middleware; validación en Form Requests; autorización en gates/policies; lógica de negocio en servicios o actions; transformación de respuesta en API Resources. Esta separación evita controladores enormes y hace el sistema más testeable.

### ¿Qué es el Service Container y cuándo necesitas un binding explícito?
Es el componente que resuelve dependencias e inyecta clases automáticamente. Laravel puede autowirear clases concretas, pero una interfaz necesita un binding explícito en un Service Provider para saber qué implementación usar. Esto permite depender de abstracciones y cambiar implementaciones o mocks sin modificar consumidores.

### Gate vs Policy: ¿cuándo usarías cada uno?
Gate para permisos generales no asociados a un modelo, como ver un panel administrativo. Policy para acciones sobre un recurso/modelo, como actualizar o eliminar un `Post`. En apps reales se pueden usar ambos; lo importante es separar autorización de autenticación y no mezclar permisos dentro del controlador.

### Tu endpoint Laravel está lento al listar recursos con relaciones. ¿Cómo lo investigas?
Primero reviso el número de queries con Telescope, Debugbar o logging. Si veo N+1, aplico eager loading con `with()` o `load()`, uso `withCount()` cuando solo necesito conteos, pagino resultados y reviso índices de columnas usadas en joins/filtros. También evitaría cargar relaciones que el Resource no necesita.

### ¿Qué es mass assignment y cómo lo evitas?
Es asignar atributos masivamente desde input del usuario, por ejemplo `Model::create($request->all())`. El riesgo es que el usuario envíe campos que no debería controlar (`is_admin`, `user_id`). Lo evito validando input y definiendo `$fillable` o `$guarded`; uso `$request->validated()` en lugar de pasar todo el request.

### ¿Sanctum, Passport o sesión web?
Sesión web para apps server-rendered tradicionales. Sanctum para SPAs propias con cookies/CSRF o tokens simples para mobile/terceros. Passport solo cuando necesito OAuth2 completo con clients, authorization code flow, client credentials o integración formal de terceros.

### ¿Cuándo mandarías trabajo a una queue?
Cuando el trabajo es lento, no necesita bloquear la respuesta o depende de servicios externos: emails, imágenes, reportes, webhooks. Lo encolo para mantener baja latencia en la request. También diseño el job con retries, backoff, timeout, manejo de fallos e idempotencia para tolerar reintentos.

### ¿Cómo probarías un endpoint que encola un job o envía un email?
Usaría feature tests para ejecutar el flujo real del endpoint, factories para datos, y fakes para bordes externos. Por ejemplo, `Queue::fake()` antes del request y luego `Queue::assertPushed(...)`. Así verifico comportamiento sin ejecutar el job ni depender de servicios externos.

### ¿Qué diferencia hay entre Form Request, middleware y policy?
Form Request valida y puede autorizar el input de una acción concreta. Middleware filtra requests de forma transversal antes de llegar al controlador. Policy decide permisos sobre un recurso/modelo. Separarlos mantiene el diseño claro y evita mezclar validación, autenticación, autorización y negocio en un solo lugar.

### ¿Cómo diseñarías una API REST en Laravel para no exponer detalles internos del modelo?
Usaría rutas claras, Form Requests para validar entrada, controladores delgados, servicios para negocio y API Resources para transformar salida. El Resource decide campos, relaciones condicionales y metadata. Además paginaría colecciones, usaría códigos HTTP correctos y evitaría N+1 con eager loading.
