---
stack: laravel
id: laravel-security
title: Laravel: Seguridad
area: Backend
priority: high
resourceLabel: Laravel, Security
resourceUrl: https://laravel.com/docs/authentication
---

## Summary
Las defensas que Laravel da por defecto y dónde te podés cortar solo: inyección, XSS, CSRF, mass assignment y passwords.

## Concepts

### Inyección y mass assignment
#### Details
**SQL injection**: Eloquent y el Query Builder usan parameter binding por defecto, así que los valores nunca se concatenan al SQL. El riesgo aparece cuando metés input crudo en `whereRaw`/`DB::raw` sin bindings; ahí debés pasar bindings explícitos. La regla: nunca interpolar input del usuario en SQL crudo.

**Mass assignment**: `Model::create($request->all())` sin protección deja que el usuario setee columnas que no debería (ej. `is_admin`). Te protegés con `$fillable` (whitelist) o `$guarded`, y validando con Form Requests antes. Es de las cosas más preguntadas porque es un agujero silencioso.

#### Examples
SQL crudo con binding (seguro)
```php
// ⚠️ vulnerable: DB::select("... where email = '$email'")
DB::select('select * from users where email = ?', [$email]); // ✅ binding
```

Mass assignment controlado
```php
protected $fillable = ['title', 'body']; // is_admin / user_id NO asignables por el cliente
```

#### Sources
- [Laravel, Query Builder (bindings)](https://laravel.com/docs/queries)
- [Laravel, Mass Assignment](https://laravel.com/docs/eloquent#mass-assignment)

### XSS y CSRF
#### Details
**XSS**: Blade escapa por defecto con `{{ $value }}` (convierte HTML peligroso en texto). Solo se renderiza HTML crudo con `{!! !!}`, que debés usar únicamente sobre contenido en el que confías o ya saneado. En APIs JSON el riesgo se traslada al frontend, pero del lado server la regla es: no imprimir HTML del usuario sin sanitizar.

**CSRF**: para rutas web con sesión, Laravel exige un token CSRF (`@csrf` en formularios; el middleware lo valida) para que un sitio externo no haga acciones en nombre del usuario logueado. Las APIs con tokens Bearer (Sanctum) no usan CSRF porque no dependen de cookies de sesión; las SPAs por cookie sí usan la protección CSRF de Sanctum.

#### Examples
Escapado de Blade
```blade
{{ $comment }}      {{-- escapado: seguro --}}
{!! $comment !!}    {{-- crudo: solo si confías/saneaste --}}
```

Token CSRF en formulario web
```blade
<form method="POST" action="/posts">
  @csrf
  ...
</form>
```

#### Sources
- [Laravel, Blade (escaping)](https://laravel.com/docs/blade#displaying-data)
- [Laravel, CSRF Protection](https://laravel.com/docs/csrf)

### Passwords, validación y secretos
#### Details
Los passwords se guardan **hasheados** con bcrypt/argon2 vía `Hash::make()`; nunca en texto plano. La verificación es `Hash::check()`. La validación de entrada (Form Requests) es parte de la seguridad: rechazar datos mal formados antes de que toquen la lógica reduce superficie de ataque.

Los secretos (API keys, credenciales de DB) van en `.env`, fuera del control de versiones, y se leen vía `config()` (no `env()` directo fuera de config, por el cache de config en producción). En entrevista suma mencionar HTTPS, rate limiting (`throttle`) contra fuerza bruta, y no exponer detalles de error en producción (`APP_DEBUG=false`).

#### Examples
Hashear y verificar password
```php
$user->password = Hash::make($request->password);
// login:
if (! Hash::check($request->password, $user->password)) { abort(401); }
```

#### Sources
- [Laravel, Hashing](https://laravel.com/docs/hashing)
- [Laravel, Validation](https://laravel.com/docs/validation)

## Interview Questions

### ¿Cómo previene Laravel la inyección SQL y cuándo seguís expuesto?
Eloquent y el Query Builder usan parameter binding por defecto: los valores van como parámetros, no concatenados al SQL. Seguís expuesto si usás `whereRaw`/`DB::raw` interpolando input del usuario; ahí tenés que pasar bindings explícitos (`?` + array). La regla es nunca meter input crudo en SQL.

### ¿Qué es CSRF y cómo lo maneja Laravel?
CSRF es cuando un sitio externo hace que el navegador del usuario logueado ejecute una acción sin su intención, aprovechando la cookie de sesión. Laravel lo previene exigiendo un token CSRF en requests web que cambian estado (`@csrf` + middleware que valida). Las APIs con tokens Bearer no usan CSRF (no dependen de cookies); las SPAs por cookie usan la protección CSRF de Sanctum.

### ¿Qué es el riesgo de mass assignment y cómo lo evitás?
Es asignar atributos masivamente desde input (`create($request->all())`), permitiendo setear campos que no deberían (como `is_admin` o `user_id` ajeno). Lo evito con `$fillable` (whitelist) o `$guarded`, y validando con Form Requests. Nunca paso `$request->all()` sin control a un modelo.

### ¿Cómo se almacenan y verifican las contraseñas en Laravel?
Hasheadas con bcrypt/argon2 vía `Hash::make()`, nunca en texto plano; el hash incluye salt. Para login uso `Hash::check(plano, hash)`. Sumo defensas: rate limiting (`throttle`) contra fuerza bruta, HTTPS, y `APP_DEBUG=false` en producción para no filtrar detalles de error.
