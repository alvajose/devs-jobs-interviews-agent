---
stack: php
id: php-oop
title: OOP en PHP
area: Lenguaje
priority: high
resourceLabel: PHP Manual, Classes and Objects
resourceUrl: https://www.php.net/manual/en/language.oop5.php
---

## Summary
Cómo PHP modela composición y polimorfismo más allá de la herencia simple: interfaces, traits, métodos mágicos y late static binding, el terreno donde se evalúa diseño OOP real en entrevista.

## Concepts

### Interfaces vs clases abstractas
#### Details
Una interfaz declara un contrato (firmas de métodos, constantes) sin implementación; una clase abstracta puede mezclar métodos concretos con métodos abstractos que las subclases deben implementar. El manual de PHP permite que una clase implemente múltiples interfaces pero extienda solo una clase (abstracta o no), es la restricción de herencia simple de PHP.

La decisión de diseño es: usar interfaz cuando lo que importa es el contrato y distintas implementaciones no comparten código base (`Comparable`, `Serializable`, un `PaymentGateway` con `Stripe`/`PayPal`); usar clase abstracta cuando hay comportamiento común real que se quiere compartir y solo varía una parte (template method pattern).

Desde PHP 8, las interfaces también pueden declarar constantes y (en PHP 8.4+) propiedades, lo que redujo casos donde antes hacía falta una clase abstracta solo para compartir una constante.

#### Examples
Interfaz como contrato intercambiable
```php
interface PaymentGateway {
    public function charge(float $amount): bool;
}

class StripeGateway implements PaymentGateway {
    public function charge(float $amount): bool { /* ... */ return true; }
}

class PayPalGateway implements PaymentGateway {
    public function charge(float $amount): bool { /* ... */ return true; }
}

function checkout(PaymentGateway $gateway, float $amount): bool {
    return $gateway->charge($amount); // no le importa cuál implementación recibe
}
```

Clase abstracta compartiendo comportamiento (template method)
```php
abstract class Report {
    final public function generate(): string {
        return $this->header() . $this->body() . $this->footer();
    }
    protected function header(): string { return "=== Report ===\n"; }
    protected function footer(): string { return "=== End ===\n"; }
    abstract protected function body(): string; // cada subclase decide esto
}

class SalesReport extends Report {
    protected function body(): string { return "Sales data...\n"; }
}
```

#### Sources
- [PHP Manual, Object Interfaces](https://www.php.net/manual/en/language.oop5.interfaces.php)
- [PHP Manual, Abstract Classes](https://www.php.net/manual/en/language.oop5.abstract.php)

### Traits: composición horizontal
#### Details
PHP no permite herencia múltiple de clases, pero los traits resuelven el caso de compartir implementación concreta entre clases sin relación jerárquica: un trait se "copia" dentro de la clase que lo usa en tiempo de compilación, como si el código estuviera escrito ahí directamente. El manual los describe como un mecanismo de reutilización de código para lenguajes de herencia simple.

El punto que se pregunta en entrevista es la resolución de conflictos: si una clase usa dos traits que definen el mismo método, PHP produce un error fatal salvo que se resuelva explícitamente con `insteadof` (elegir cuál gana) y `as` (crear un alias del método descartado). Esto obliga a ser explícito en vez de que gane "el último que se declaró" silenciosamente.

Un trait puede tener métodos abstractos que la clase que lo usa debe implementar, y puede depender de propiedades que la clase debe declarar, por eso conviene documentar esas expectativas, ya que el trait no las fuerza como lo haría una interfaz.

#### Examples
Trait compartiendo comportamiento sin herencia
```php
trait Loggable {
    public function log(string $msg): void {
        error_log(static::class . ": $msg");
    }
}

class OrderService { use Loggable; }
class UserService { use Loggable; }
// ambas ganan log() sin heredar de una base común
```

Resolviendo conflicto entre dos traits
```php
trait A { public function hello() { return "A"; } }
trait B { public function hello() { return "B"; } }

class C {
    use A, B {
        A::hello insteadof B; // gana A
        B::hello as helloFromB; // alias para no perder B::hello
    }
}
```

#### Sources
- [PHP Manual, Traits](https://www.php.net/manual/en/language.oop5.traits.php)

### Métodos mágicos
#### Details
PHP reserva nombres de método con doble guion bajo (`__construct`, `__get`, `__set`, `__call`, `__toString`, `__invoke`, `__clone`) que el engine invoca automáticamente en ciertos eventos: acceder a una propiedad inexistente/inaccesible dispara `__get`/`__set`, llamar a un método inexistente dispara `__call`, usar un objeto como string dispara `__toString`, usar un objeto como si fuera función dispara `__invoke`.

Son potentes para proxies, ORMs (Eloquent los usa extensivamente para atributos dinámicos) y DSLs fluidos, pero el manual y la práctica coinciden en la advertencia: abusar de `__get`/`__set` rompe el autocompletado del IDE, hace más lento el acceso a propiedades (hay una llamada a método detrás de cada acceso) y oculta bugs de tipeo (`$user->nmae` no falla, silenciosamente devuelve `null` desde `__get`).

La recomendación de entrevista senior es: usar magic methods cuando el problema realmente lo pide (mapear una tabla dinámica en un ORM, un builder fluido), y preferir propiedades/métodos explícitos en el resto del código de negocio.

#### Examples
__construct con property promotion (PHP 8.0+)
```php
class Point {
    public function __construct(
        public readonly float $x,
        public readonly float $y,
    ) {}
}
```

__get / __set para atributos dinámicos (patrón usado por ORMs)
```php
class Model {
    private array $attributes = [];

    public function __get(string $name) {
        return $this->attributes[$name] ?? null;
    }
    public function __set(string $name, $value): void {
        $this->attributes[$name] = $value;
    }
}

$user = new Model();
$user->name = "Ada"; // dispara __set
echo $user->name;     // dispara __get
```

__invoke para objetos "callable"
```php
class Multiplier {
    public function __construct(private float $factor) {}
    public function __invoke(float $n): float {
        return $n * $this->factor;
    }
}

$double = new Multiplier(2);
echo $double(21); // 42, el objeto se usa como función
```

#### Sources
- [PHP Manual, Magic Methods](https://www.php.net/manual/en/language.oop5.magic.php)

### Late static binding y visibilidad
#### Details
`self::` resuelve al tipo donde se escribió el código; `static::` (late static binding, PHP 5.3+) resuelve al tipo de la clase realmente instanciada en tiempo de ejecución. El manual lo introduce precisamente para el caso de métodos estáticos heredados que necesitan saber "quién soy en verdad", típico en el patrón factory estático o en Active Record, donde un método `create()` en la clase base debe devolver una instancia de la subclase que lo llamó, no de la base.

Sobre visibilidad: `private` limita el acceso a la clase exacta donde se declara (ni subclases lo ven), `protected` lo extiende a subclases, `public` es visible desde cualquier lado. PHP 8.1 agregó `readonly` para propiedades que solo se pueden asignar una vez (típicamente en el constructor), habilitando Value Objects inmutables sin necesitar getters manuales para cada campo.

En entrevista, el error común es explicar `self` vs `static` solo con la definición, la respuesta fuerte muestra el bug concreto que `self::` produce en un factory heredado y cómo `static::` lo arregla.

#### Examples
self:: vs static:: en un factory heredado
```php
class Model {
    public static function create(): static {
        return new static(); // late static binding: respeta quién llamó
    }
    public static function createBroken(): self {
        return new self(); // BUG: siempre crea Model, nunca la subclase
    }
}

class User extends Model {}

$u = User::create();       // instancia de User (correcto)
$b = User::createBroken(); // instancia de Model (bug)
```

readonly properties para Value Objects inmutables (PHP 8.1+)
```php
final class Money {
    public function __construct(
        public readonly int $cents,
        public readonly string $currency,
    ) {}

    public function add(Money $other): self {
        if ($other->currency !== $this->currency) {
            throw new \InvalidArgumentException("Monedas distintas");
        }
        return new self($this->cents + $other->cents, $this->currency);
        // no se puede mutar $this->cents directamente: readonly lo impide
    }
}
```

#### Sources
- [PHP Manual, Late Static Bindings](https://www.php.net/manual/en/language.oop5.late-static-bindings.php)
- [PHP Manual, Visibility](https://www.php.net/manual/en/language.oop5.visibility.php)
- [PHP 8.1 Migration, Readonly Properties](https://www.php.net/manual/en/migration81.new-features.php)

## Interview Questions

### ¿Cuándo elegirías una interfaz sobre una clase abstracta, o viceversa?
Interfaz cuando distintas implementaciones no comparten código y lo que importa es el contrato (un `PaymentGateway` intercambiable). Clase abstracta cuando hay comportamiento común real que quiero compartir y solo una parte varía por subclase, ahí el template method pattern con métodos abstractos tiene más sentido que forzar el contrato solo con una interfaz.

### ¿Qué problema resuelven los traits que no resuelve la herencia simple de PHP?
Compartir implementación concreta entre clases sin relación jerárquica, PHP no permite herencia múltiple de clases, así que si dos clases no relacionadas necesitan el mismo comportamiento (logging, un timestamp mixin), un trait lo inyecta sin forzar una jerarquía artificial.

### ¿Qué riesgos tiene abusar de `__get`/`__set` en una clase de dominio?
Rompe el autocompletado del IDE, agrega overhead de una llamada a método en cada acceso a propiedad, y oculta typos silenciosamente porque `$obj->nmae` no falla, devuelve `null` desde `__get` en vez de un error claro. Los reservo para casos que realmente lo piden, como un ORM con atributos dinámicos.

### ¿Qué bug produce usar `self::` en vez de `static::` dentro de un método factory heredado?
`self::` siempre resuelve a la clase donde está escrito el método, así que un factory en la clase base con `new self()` siempre crea instancias de la base, incluso si lo llamás desde una subclase. `static::` resuelve la clase realmente invocada en runtime (late static binding), que es lo que se necesita para que `Subclase::create()` devuelva una `Subclase`.

### Diseño: ¿cómo implementarías un Value Object inmutable en PHP moderno?
Uso `readonly` (PHP 8.1+) en las propiedades del constructor con property promotion, para que solo se asignen una vez y no haya setters. Cualquier "modificación" devuelve una nueva instancia en vez de mutar la existente, como en el ejemplo de `Money::add()`, que crea un nuevo objeto en vez de tocar `$this->cents`.
