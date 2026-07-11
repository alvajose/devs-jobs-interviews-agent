---
stack: laravel
id: laravel-testing
title: Laravel: Testing
area: Backend
priority: medium
resourceLabel: Laravel, Testing
resourceUrl: https://laravel.com/docs/testing
---

## Summary
Probar una app Laravel con confianza: feature vs unit tests, datos con factories, y fakes para no tocar servicios externos.

## Concepts

### Feature vs unit tests
#### Details
Laravel trae testing integrado (PHPUnit, y Pest como sintaxis moderna). Los **feature tests** ejercitan la app de punta a punta vía HTTP (hacés un request a una ruta y afirmás la respuesta/efectos): dan la mayor confianza porque prueban routing, middleware, validación, controlador y DB juntos. Los **unit tests** prueban una clase aislada (un servicio, un value object) sin el framework.

La estrategia senior: la mayoría de los tests valiosos en una app web son de feature (probás comportamiento real), y reservás unit para lógica pura compleja. Para la DB, el trait `RefreshDatabase` migra y resetea entre tests, garantizando aislamiento.

#### Examples
Feature test de un endpoint
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

#### Sources
- [Laravel, HTTP Tests](https://laravel.com/docs/http-tests)
- [Laravel, Database Testing](https://laravel.com/docs/database-testing)

### Factories y datos de prueba
#### Details
Las factories generan modelos de prueba con datos realistas (vía Faker) sin que escribas inserts a mano. `User::factory()->count(3)->create()` crea 3 usuarios; podés sobreescribir atributos y declarar relaciones (`has`, `for`). Esto hace los tests legibles y enfocados: solo especificás lo que importa para el caso.

En entrevista, el punto es aislamiento y claridad: cada test crea sus propios datos con factories en vez de depender de un estado compartido o de seeders de producción. Combinado con `RefreshDatabase`, cada test arranca limpio.

#### Examples
Factory con relación y override
```php
$post = Post::factory()
    ->for(User::factory()->create())
    ->create(['title' => 'Specific title']);
```

#### Sources
- [Laravel, Eloquent Factories](https://laravel.com/docs/eloquent-factories)

### Fakes y mocking
#### Details
Un buen test no debe enviar emails reales, encolar jobs de verdad ni llamar APIs externas. Laravel da **fakes** que interceptan y permiten afirmar: `Mail::fake()` + `Mail::assertSent(...)`, `Queue::fake()` + `Queue::assertPushed(...)`, `Event::fake()`, `Http::fake()` para respuestas HTTP simuladas, `Storage::fake()` para archivos.

La idea clave es testear que **tu código intentó** la acción correcta (mandar el mail, encolar el job) sin ejecutar el efecto real. Eso hace los tests rápidos, deterministas y sin dependencias externas. Mockear todo a ciegas es anti-patrón; fakeás los bordes (servicios externos), no tu propia lógica.

#### Examples
Fake de cola y aserción
```php
Queue::fake();

$this->postJson('/api/podcasts', $data)->assertCreated();

Queue::assertPushed(ProcessPodcast::class);
```

#### Sources
- [Laravel, Mocking (fakes)](https://laravel.com/docs/mocking)

## Interview Questions

### Feature vs unit test: ¿cuándo usás cada uno?
Feature para probar comportamiento real de la app vía HTTP (routing + middleware + validación + controlador + DB): es donde está la mayor confianza en una app web. Unit para lógica pura y compleja aislada del framework (un servicio de cálculo, un parser). En la práctica priorizo feature tests y dejo unit para piezas algorítmicas; no testeo getters/setters.

### ¿Cómo testeás un endpoint que envía un email o encola un job, sin ejecutarlos de verdad?
Uso fakes: `Mail::fake()` / `Queue::fake()` antes de la acción, hago el request, y afirmo con `Mail::assertSent(...)` / `Queue::assertPushed(...)`. Así verifico que mi código intentó la acción correcta sin enviar nada ni correr el job, manteniendo el test rápido y determinista.

### ¿Cómo manejás la base de datos en los tests?
Con el trait `RefreshDatabase`, que migra y resetea la DB entre tests para que cada uno arranque limpio y aislado. Genero los datos con factories dentro de cada test, no con estado compartido. Para velocidad suelo usar una DB de test (sqlite en memoria o una DB dedicada).

### ¿Qué es un factory y por qué usarlo?
Es una clase que genera modelos de prueba con datos realistas (Faker) y relaciones, sobreescribiendo solo lo relevante para el caso. Lo uso para que cada test cree sus propios datos de forma legible y aislada, en vez de depender de seeders de producción o de un estado global. Hace los tests claros y mantenibles.
