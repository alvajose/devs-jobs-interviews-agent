---
stack: laravel
id: laravel-middleware-auth
title: Laravel: Middleware, auth y autorización
area: Backend
priority: high
resourceLabel: Laravel, Authorization
resourceUrl: https://laravel.com/docs/authorization
---

## Summary
Controlar acceso en Laravel: middleware, autenticación (quién sos) y autorización (qué podés hacer).

## Concepts

### Middleware
#### Details
El middleware filtra requests HTTP antes (o después) de que lleguen al controlador. Es donde va la lógica transversal: autenticación, rate limiting, CORS, forzar HTTPS, logging. Corre como un pipeline: cada middleware decide si pasa al siguiente (`$next($request)`) o corta (redirect/abort).

Hay middleware global (toda request), de grupo (`web`, `api`) y de ruta. Pueden recibir parámetros (`->middleware('throttle:60,1')`). La clave de diseño en entrevista: middleware = preocupaciones transversales de la request, NO lógica de negocio. Mete auth y rate limiting acá, no validación de reglas de dominio.

#### Examples
Middleware que corta o deja pasar
```php
public function handle(Request $request, Closure $next)
{
    if (! $request->user()?->subscribed()) {
        return redirect('/billing');
    }
    return $next($request);
}
```

Aplicar a rutas con parámetro
```php
Route::middleware('auth:sanctum', 'throttle:60,1')->group(function () {
    Route::apiResource('posts', PostController::class);
});
```

#### Sources
- [Laravel, Middleware](https://laravel.com/docs/middleware)

### Autenticación
#### Details
La autenticación responde "¿quién sos?". Laravel usa **guards** para definir cómo se autentica cada request: `web` (sesión por cookies) para apps con servidor, y tokens (Sanctum) para APIs/SPAs. El helper `auth()->user()` / `$request->user()` da el usuario actual.

En entrevista, distinguí sesión (stateful, cookie + server session) de tokens (stateless, Bearer). Para una SPA propia, Sanctum por cookies; para móvil/terceros, tokens. El middleware `auth` protege rutas exigiendo un usuario autenticado.

#### Examples
Proteger y leer el usuario
```php
Route::middleware('auth:sanctum')->get('/me', function (Request $r) {
    return $r->user();
});
```

#### Sources
- [Laravel, Authentication](https://laravel.com/docs/authentication)
- [Laravel, Sanctum](https://laravel.com/docs/sanctum)

### Autorización: gates y policies
#### Details
La autorización responde "¿qué podés hacer?". Laravel ofrece **Gates** (closures simples para permisos sueltos, ej. "ver el panel admin") y **Policies** (clases que agrupan reglas de autorización para un modelo, ej. `PostPolicy` con `update`, `delete`). La regla: Policy cuando la autorización es sobre un modelo/recurso; Gate para permisos generales no atados a un modelo.

Verificás con `$user->can('update', $post)`, `$this->authorize('update', $post)` en el controlador (lanza 403 si falla), o `@can` en Blade. Separar autorización (puede) de autenticación (es) y de validación (datos correctos) es señal de claridad de capas.

#### Examples
Policy y su uso
```php
class PostPolicy
{
    public function update(User $user, Post $post): bool
    {
        return $user->id === $post->user_id;
    }
}

// En el controlador:
$this->authorize('update', $post); // 403 si no puede
```

#### Sources
- [Laravel, Authorization (Gates & Policies)](https://laravel.com/docs/authorization)

## Interview Questions

### ¿Qué lógica va en un middleware y qué NO?
Va lo transversal a la request: autenticación, rate limiting, CORS, forzar HTTPS, logging, locale. NO va lógica de negocio ni validación de reglas de dominio (eso es Form Requests/servicios). El middleware decide si la request sigue (`$next`) o se corta, antes de llegar al controlador.

### Gate vs Policy: ¿cuándo usás cada una?
Policy cuando la autorización es sobre un modelo/recurso: agrupo las reglas (`view`, `update`, `delete`) en una clase por modelo (`PostPolicy`). Gate para permisos generales que no cuelgan de un modelo (ej. "acceder al panel admin"). Ambos se consultan con `can`/`authorize`. Usar Policies mantiene la autorización organizada y descubrible.

### ¿Cómo proteges una ruta de API y verificas permisos sobre un recurso?
La ruta va detrás del middleware `auth:sanctum` (autenticación). Dentro del controlador, antes de actuar sobre el recurso, llamo `$this->authorize('update', $post)` que usa la Policy y lanza 403 si el usuario no tiene permiso. Así separo autenticación (middleware) de autorización (policy) de validación (Form Request).

### ¿Cuál es la diferencia entre autenticación y autorización?
Autenticación es "¿quién sos?" (validar identidad: sesión o token). Autorización es "¿qué podés hacer?" (permisos sobre acciones/recursos, vía gates/policies). Primero autenticás (middleware `auth`), después autorizás (policy). Confundirlas lleva a bugs de seguridad: un usuario autenticado no necesariamente está autorizado a tocar un recurso ajeno.
