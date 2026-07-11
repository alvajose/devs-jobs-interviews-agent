---
stack: laravel
id: laravel-fundamentals
title: Laravel: Fundamentos y ciclo de vida
area: Backend
priority: high
resourceLabel: Laravel, Request Lifecycle
resourceUrl: https://laravel.com/docs/lifecycle
---

## Summary
El núcleo de Laravel que toda entrevista asume: ciclo de vida de la request, Service Container/DI y Service Providers.

## Concepts

### Ciclo de vida de una request
#### Details
Toda request entra por `public/index.php`, que carga el autoloader y resuelve la instancia de la aplicación. La request pasa por el **HTTP Kernel**, que ejecuta el stack de **middleware** global (sesiones, CSRF, etc.), despacha al **router**, corre los middleware de la ruta, llama al **controlador**, y devuelve una `Response` que vuelve atravesando los middleware en sentido inverso.

Entender esto importa porque explica DÓNDE poné cada cosa: autenticación y rate limiting en middleware, lógica de negocio en el controlador/servicio, transformación de salida en API Resources. Un candidato que ubica responsabilidades en la capa correcta demuestra que entiende el framework, no solo que lo usa.

El Service Container se arma durante el bootstrap (vía Service Providers) antes de manejar la request, así que cuando el controlador se ejecuta, sus dependencias ya se pueden resolver e inyectar automáticamente.

#### Examples
Middleware: lógica transversal antes/después del controlador
```php
public function handle(Request $request, Closure $next)
{
    if (! $request->user()?->isActive()) {
        abort(403);
    }
    $response = $next($request); // sigue el pipeline
    return $response;
}
```

#### Sources
- [Laravel, Request Lifecycle](https://laravel.com/docs/lifecycle)
- [Laravel, Middleware](https://laravel.com/docs/middleware)

### Service Container e inyección de dependencias
#### Details
El Service Container es el corazón de Laravel: resuelve clases y sus dependencias automáticamente (autowiring). Si un controlador pide en su constructor un `OrderRepository`, el container lo construye y lo inyecta sin que vos lo instancies. Esto desacopla y hace testeable el código.

El patrón senior es **inyectar por interfaz**: bindeás una interfaz a una implementación concreta en un Service Provider, y el resto del código depende de la abstracción. Así podés cambiar la implementación (o mockearla en tests) sin tocar a los consumidores. Es SOLID aplicado: dependés de abstracciones, no de concreciones.

En entrevista, distinguí binding simple, `singleton` (una sola instancia compartida) y binding contextual. Y aclará que el autowiring resuelve clases concretas solo; las interfaces necesitan un binding explícito.

#### Examples
Bindear una interfaz a una implementación
```php
// En un Service Provider
$this->app->bind(PaymentGateway::class, StripeGateway::class);
```

Inyección por constructor (el container resuelve)
```php
class CheckoutController
{
    public function __construct(private PaymentGateway $gateway) {}

    public function store(Request $request)
    {
        $this->gateway->charge($request->amount);
    }
}
```

#### Sources
- [Laravel, Service Container](https://laravel.com/docs/container)

### Service Providers y Facades
#### Details
Los Service Providers son el lugar central donde se configura la app: registran bindings, eventos, rutas, etc. Tienen dos métodos clave: `register()` (solo bindeás cosas en el container, no uses otros servicios acá porque quizá no estén cargados) y `boot()` (ya está todo registrado, podés usar otros servicios).

Las **Facades** dan una API estática conveniente (`Cache::get()`, `DB::table()`) que por debajo resuelve el objeto real del container. En entrevista, el matiz: las facades son cómodas pero ocultan dependencias; para código testeable y explícito muchas veces conviene **inyectar por constructor**. Las facades de Laravel son "testeables" (se pueden mockear), pero la inyección hace visibles las dependencias en la firma.

#### Examples
register vs boot
```php
public function register(): void
{
    $this->app->singleton(Report::class, fn () => new Report());
}

public function boot(): void
{
    // acá ya podés usar config(), rutas, otros servicios
}
```

#### Sources
- [Laravel, Service Providers](https://laravel.com/docs/providers)
- [Laravel, Facades](https://laravel.com/docs/facades)

## Interview Questions

### Explicá el ciclo de vida de una request en Laravel.
Entra por `public/index.php`, que arma la aplicación. El HTTP Kernel corre el stack de middleware global, despacha al router, ejecuta los middleware de la ruta y llama al controlador, que devuelve una Response que vuelve por los middleware en orden inverso. Antes de todo, los Service Providers bootean el container. Saber esto me dice dónde va cada cosa: auth/rate-limit en middleware, negocio en servicios, salida en Resources.

### ¿Qué es el Service Container y por qué inyectar por interfaz?
Es el contenedor que resuelve clases y sus dependencias automáticamente (autowiring) e inyecta por constructor. Inyecto por interfaz para depender de abstracciones: bindeo la interfaz a una implementación en un provider, y puedo cambiarla o mockearla en tests sin tocar a los consumidores. Es el principio de inversión de dependencias de SOLID.

### Facade vs inyección de dependencias: ¿cuándo usás cada una?
Facade para conveniencia en código simple (`Cache::`, `DB::`), sabiendo que oculta la dependencia. Inyección por constructor cuando quiero que las dependencias sean explícitas en la firma y el código sea más fácil de testear y razonar. En servicios de dominio prefiero inyección; las facades las dejo para acceso rápido a infraestructura. Ambas terminan resolviendo del container.

### ¿Cuál es la diferencia entre `register()` y `boot()` en un Service Provider?
En `register()` solo registro bindings en el container; no debo usar otros servicios porque puede que aún no estén cargados. En `boot()` ya está todo registrado, así que puedo usar config, rutas, eventos u otros servicios. Poner lógica que depende de otros servicios en `register()` es un error típico.
