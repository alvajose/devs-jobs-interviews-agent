---
stack: laravel
id: laravel-apis-rest
title: APIs RESTful con Laravel
area: Backend
priority: high
resourceLabel: Laravel, Eloquent API Resources
resourceUrl: https://laravel.com/docs/eloquent-resources
---

## Summary
Diseñar, exponer y asegurar APIs REST con Laravel: recursos, autenticación, validación y rendimiento de Eloquent.

## Concepts

### API Resources (Transformers)
#### Details
Los API Resources son la capa de transformación entre tus modelos Eloquent y el JSON que devuelve la API. Su valor en entrevista es que **desacoplan el esquema de la base de datos del contrato público**: podés renombrar columnas o agregar campos internos sin romper a los clientes, porque el Resource define explícitamente qué se expone.

Usás un `JsonResource` para un solo objeto y una `ResourceCollection` (o `Resource::collection()`) para listas. Dentro del `toArray()` controlás la forma exacta del payload, podés incluir relaciones de forma condicional con `whenLoaded()` (clave para evitar N+1) y agregar metadatos con `additional()` o una clase de colección.

Un punto fino que distingue a un candidato senior: los Resources ayudan a mantener **consistencia** (fechas en ISO 8601, nombres en camelCase o snake_case según la convención del equipo) y a versionar la salida sin tocar el modelo. No son solo "para que se vea lindo": son tu contrato.

#### Examples
Resource básico que define el contrato
```php
class PostResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'author' => $this->user->name,
            'published_at' => $this->published_at?->toIso8601String(),
        ];
    }
}
```

Incluir una relación solo si fue cargada (evita N+1)
```php
public function toArray($request): array
{
    return [
        'id' => $this->id,
        'title' => $this->title,
        'comments' => CommentResource::collection($this->whenLoaded('comments')),
    ];
}
```

Devolver una colección paginada (mantiene los meta links)
```php
// El Resource respeta la paginación automáticamente
return PostResource::collection(Post::with('user')->paginate(20));
```

#### Sources
- [Laravel, Eloquent: API Resources](https://laravel.com/docs/eloquent-resources)

### Autenticación con Sanctum
#### Details
Sanctum cubre dos escenarios de auth sin la complejidad de un servidor OAuth2: **tokens de API** (para apps móviles o clientes de terceros) y **autenticación de SPA por cookies** (para tu propio frontend en el mismo dominio). En entrevista, lo importante es saber elegir el modo correcto y por qué.

Para tokens, emitís un token personal con `createToken()` y el cliente lo manda en el header `Authorization: Bearer ...`; protegés rutas con el middleware `auth:sanctum`. Para una SPA propia, usás el guard de cookies con protección CSRF, lo que evita guardar tokens en `localStorage` (más seguro contra XSS).

La pregunta de decisión clásica es **Sanctum vs Passport**: Passport implementa OAuth2 completo (authorization code flow, scopes para apps de terceros, client credentials). Si no necesitás ser un proveedor OAuth para terceros, Sanctum es más liviano y suficiente para el 90% de los casos. Elegir Passport "por las dudas" es un red flag de sobre-ingeniería.

#### Examples
Emitir un token para un cliente móvil
```php
$token = $user->createToken('mobile-app')->plainTextToken;
// El cliente luego envía: Authorization: Bearer {token}
```

Proteger rutas de API con el guard de Sanctum
```php
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', fn (Request $request) => $request->user());
    Route::apiResource('posts', PostController::class);
});
```

Tokens con habilidades (scopes simples)
```php
$token = $user->createToken('ci-token', ['posts:read'])->plainTextToken;
// Verificación: $request->user()->tokenCan('posts:read');
```

#### Sources
- [Laravel, Sanctum](https://laravel.com/docs/sanctum)

### Validación de requests y manejo de errores
#### Details
La validación en Laravel ocurre **antes** de que la lógica de negocio corra. La forma idiomática es un Form Request (`php artisan make:request`), que encapsula reglas y autorización; si falla, Laravel devuelve automáticamente **422 Unprocessable Entity** con los errores por campo en JSON cuando la request espera JSON. Esto mantiene los controladores limpios.

Para errores que no son de validación, el patrón senior es lanzar excepciones con significado y mapearlas a códigos HTTP correctos en el handler: 401 (no autenticado), 403 (no autorizado), 404 (no encontrado), 409 (conflicto), 422 (validación). Lo importante en entrevista es **devolver el código correcto y un cuerpo de error consistente**, no un 200 con `{ "error": ... }` adentro.

Un detalle que suma: en una API querés que TODOS los errores salgan como JSON (no como página HTML de error). Eso se logra asegurando que el cliente mande `Accept: application/json` o forzando el render JSON en el handler de excepciones.

#### Examples
Form Request con reglas y autorización
```php
class StorePostRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Post::class);
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:120'],
            'body' => ['required', 'string'],
        ];
    }
}
```

Usarlo en el controlador (datos ya validados)
```php
public function store(StorePostRequest $request)
{
    $post = Post::create($request->validated());
    return new PostResource($post); // 201 con resource()->response()->setStatusCode(201)
}
```

Mapear una excepción de negocio a un código HTTP
```php
// app/Exceptions/Handler.php
$this->renderable(function (PostLockedException $e, $request) {
    return response()->json(['message' => 'Post is locked'], 409);
});
```

#### Sources
- [Laravel, Validation](https://laravel.com/docs/validation)
- [Laravel, Error Handling](https://laravel.com/docs/errors)

### Eloquent: relaciones, N+1 y paginación
#### Details
La causa #1 de APIs Laravel lentas es el problema **N+1**: iterar una colección y, por cada item, disparar una query para una relación. Con 100 posts y su autor, son 1 + 100 queries. La solución es **eager loading** con `with()`, que lo baja a 2 queries. Saber diagnosticar esto (con `DB::listen`, Telescope o Debugbar) y resolverlo es una pregunta de entrevista muy común.

Para listados siempre **paginá** (`paginate()` o `cursorPaginate()` para datasets grandes / scroll infinito). Devolver miles de filas sin paginar es otro red flag. Combinado con API Resources y `whenLoaded()`, exponés solo lo necesario y cargás relaciones de forma controlada.

A nivel base de datos, las relaciones eficientes dependen de **índices** en las foreign keys y en las columnas por las que filtrás/ordenás. Un candidato fuerte conecta el ORM con lo que pasa en la DB, no lo trata como una caja negra.

#### Examples
Problema N+1 (malo) vs eager loading (bueno)
```php
// N+1: 1 query de posts + 1 por cada autor
$posts = Post::all();
foreach ($posts as $post) {
    echo $post->user->name;
}

// Eager loading: 2 queries en total
$posts = Post::with('user')->get();
```

Paginación estándar (mantiene meta/links en el JSON)
```php
return PostResource::collection(
    Post::with('user')->latest()->paginate(20)
);
```

Cursor pagination para listas muy grandes
```php
return PostResource::collection(
    Post::with('user')->orderBy('id')->cursorPaginate(50)
);
```

#### Sources
- [Laravel, Eloquent Relationships: Eager Loading](https://laravel.com/docs/eloquent-relationships#eager-loading)
- [Laravel, Pagination](https://laravel.com/docs/pagination)

## Interview Questions

### ¿Cómo versionarías una API en Laravel sin romper a los clientes actuales?
Prefijo de versión en la ruta (`/api/v1`, `/api/v2`) con grupos de rutas separados, manteniendo v1 viva mientras los clientes migran. Dentro de una versión evito breaking changes; los cambios aditivos (campos nuevos opcionales) no rompen, así que no siempre requieren bump. Los API Resources ayudan: puedo tener `V2\PostResource` con otra forma sin tocar el modelo. Documento deprecaciones y doy una ventana de transición.

### ¿Sanctum o Passport? ¿Cuándo cada uno?
Sanctum para el 90% de los casos: SPA propia (cookies + CSRF) o tokens de API simples para móvil/terceros. Passport solo si necesito un servidor OAuth2 completo: authorization code flow, scopes para apps de terceros, client credentials. Passport es más pesado de operar; no lo meto si no necesito OAuth real.

### ¿Cómo aseguras que Laravel ejecute tareas programadas (cron jobs) de forma confiable en producción?
Defino las tareas en el scheduler de Laravel (`routes/console.php` o `app/Console/Kernel.php`) y en el servidor configuro UN solo cron de sistema que corre `php artisan schedule:run` cada minuto. Para que no se solapen uso `withoutOverlapping()`; el trabajo pesado lo mando a una queue (`->onQueue()`) con workers supervisados por Supervisor/Horizon. Monitoreo fallos con `->onFailure()` y un healthcheck (ej. ping a un servicio de cron monitoring).

### Tu API que lista recursos con sus relaciones está lenta. ¿Cómo lo diagnosticás y resolvés?
Primero confirmo que es N+1: miro el conteo de queries con Telescope/Debugbar o `DB::listen`. Si veo "1 + N", aplico eager loading con `with()` para las relaciones que el endpoint realmente usa, y en el Resource cargo relaciones con `whenLoaded()` para no traer de más. Luego reviso paginación (nunca devolver todo) e índices en las foreign keys/columnas de filtro. Recién después pienso en cache si sigue haciendo falta.

### ¿Cómo manejás un error de validación y qué código HTTP devolvés?
Uso Form Requests que validan antes del controlador; Laravel devuelve 422 con los errores por campo automáticamente en JSON. Para errores de negocio lanzo excepciones propias y las mapeo en el Handler a códigos coherentes (403, 404, 409), con un cuerpo de error consistente. Nunca devuelvo 200 con un error adentro.
