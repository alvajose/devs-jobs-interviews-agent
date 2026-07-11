---
stack: php
id: php-fundamentals
title: Fundamentos de PHP
area: Lenguaje
priority: high
resourceLabel: PHP Manual, Language Reference
resourceUrl: https://www.php.net/manual/en/langref.php
---

## Summary
Conceptos base de PHP que aparecen en cualquier entrevista: tipado dinámico y sus trampas, arrays como hash maps ordenados, superglobales y manejo de errores con excepciones.

## Concepts

### Type juggling y comparaciones
#### Details
PHP es de tipado dinámico y débil: convierte tipos automáticamente en comparaciones y operaciones (`type juggling`). El manual de PHP documenta tablas de conversión completas para `==` que sorprenden a quien no las conoce, por eso PHP 8 cambió el comportamiento de comparar números contra strings no numéricos: hoy la comparación floja convierte el número a string en vez de forzar el string a número, así `0 == "abc"` pasó de `true` a `false`.

En entrevista, lo que se evalúa es si sabés distinguir comparación floja (`==`, que convierte tipos) de comparación estricta (`===`, que no convierte y compara tipo y valor). La recomendación práctica de producción es declarar `declare(strict_types=1)` al inicio del archivo para que las funciones tipadas rechacen conversiones implícitas en sus argumentos, y usar `===` por defecto salvo que la conversión sea intencional.

Los tipos escalares (`int`, `float`, `string`, `bool`) y el operador null-safe (`?->`, PHP 8.0+) también entran en esta categoría: entender cuándo PHP decide null-coalesce (`??`) vs lanzar un error de acceso a propiedad nula es parte de escribir código defensivo sin volverse verboso.

#### Examples
Comparación floja vs estricta
```php
var_dump(0 == "abc");   // false en PHP 8+ (true en PHP 7)
var_dump(0 === "abc");  // false siempre, tipos distintos
var_dump("1" == "01")  ; // true, ambos numéricos, se comparan como número
var_dump("10" == "1e1"); // true, notación científica se normaliza
```

Forzar tipado estricto en argumentos
```php
declare(strict_types=1);

function total(int $qty, float $price): float {
    return $qty * $price;
}

total(3, 2.5);     // ok
total("3", 2.5);   // TypeError, strict_types no convierte "3" a int
```

Null-coalescing vs null-safe operator
```php
$name = $config['name'] ?? 'default';       // ?? evita undefined key warning
$city = $user?->address?->city ?? 'n/a';    // ?-> corta la cadena si algo es null
```

#### Sources
- [PHP Manual, Type Juggling](https://www.php.net/manual/en/language.types.type-juggling.php)
- [PHP Manual, Comparison Operators](https://www.php.net/manual/en/language.operators.comparison.php)

### Arrays como hash maps ordenados
#### Details
El array de PHP es una estructura híbrida: internamente es un hash map (`HashTable`) que preserva el orden de inserción, por lo que sirve tanto como array indexado como diccionario asociativo con la misma sintaxis. Esto explica por qué iterar con `foreach` siempre respeta el orden en que se insertaron las claves, a diferencia de un hash map puro en otros lenguajes.

Esta dualidad tiene costo: un array "de lista" (claves 0..n secuenciales) usa esa misma HashTable pero PHP optimiza el caso de claves enteras consecutivas. Insertar con `unset()` en el medio o usar claves no numéricas rompe esa optimización y el array pasa a comportarse como diccionario puro, lo que importa para performance en loops grandes.

Para entrevista, conviene saber qué funciones de array son de "copia" (todas: PHP usa copy-on-write, así que pasar un array grande a una función no duplica memoria hasta que se modifica) y distinguir `array_map`/`array_filter`/`array_reduce` (no mutan, devuelven nuevo array) de `sort()`/`usort()` (mutan por referencia y no preservan claves).

#### Examples
Array asociativo con orden de inserción preservado
```php
$scores = ['bob' => 10, 'ana' => 20, 'cid' => 15];
foreach ($scores as $name => $score) {
    echo "$name: $score\n"; // bob, ana, cid, en ese orden, no alfabético
}
```

array_map / array_filter no mutan
```php
$nums = [1, 2, 3, 4, 5];
$even = array_filter($nums, fn($n) => $n % 2 === 0); // [1=>2, 3=>4], claves originales
$doubled = array_map(fn($n) => $n * 2, $nums);         // [2,4,6,8,10]
```

sort() muta y reindexa; usort() con comparador custom
```php
$data = [3 => 'c', 1 => 'a', 2 => 'b'];
sort($data);   // ['a','b','c'], pierde las claves originales

usort($data, fn($a, $b) => strcmp($a, $b));
```

Copy-on-write: pasar un array grande no cuesta hasta que se modifica
```php
function inspect(array $huge): int {
    return count($huge); // no copia real: solo lee
}
```

#### Sources
- [PHP Manual, Arrays](https://www.php.net/manual/en/language.types.array.php)
- [PHP Manual, Array Functions](https://www.php.net/manual/en/ref.array.php)

### Superglobales y el ciclo de request
#### Details
PHP expone el estado del request HTTP entrante a través de superglobales (`$_GET`, `$_POST`, `$_SERVER`, `$_SESSION`, `$_FILES`, `$_COOKIE`) accesibles desde cualquier scope sin `global`. El manual las agrupa bajo "predefined variables": son arrays asociativos poblados por el SAPI (Apache module, PHP-FPM, CLI) antes de que tu código corra.

El punto de entrevista real es la seguridad: nada en las superglobales está sanitizado. `$_GET`/`$_POST` contienen exactamente lo que envió el cliente, así que usarlas directamente en una query SQL o al imprimir HTML es la puerta de entrada a injection y XSS (ver el módulo de seguridad). La práctica correcta es validar/castear el tipo esperado apenas se lee la superglobal, no en el medio de la lógica de negocio.

También importa el ciclo de vida: en PHP tradicional (no long-running como Swoole/RoadRunner) cada request arranca con memoria limpia, no hay estado compartido entre requests salvo que lo persistas explícitamente (sesión, cache, DB). Esto es lo opuesto a un runtime como Node, y es una pregunta común para candidatos que vienen de otros ecosistemas.

#### Examples
Leer y castear un query param de forma segura
```php
$page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
$page = max(1, $page); // nunca confiar en el input crudo
```

$_SERVER trae metadata del request, no solo variables de servidor
```php
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
```

Cada request es un proceso/hilo aislado (sin estado compartido implícito)
```php
// contador.php, esto SIEMPRE imprime 1, no acumula entre requests
$_SESSION['visits'] = ($_SESSION['visits'] ?? 0) + 1;
echo $_SESSION['visits']; // solo persiste porque está en sesión, no en una variable global
```

#### Sources
- [PHP Manual, Predefined Variables](https://www.php.net/manual/en/reserved.variables.php)
- [PHP Manual, $_SERVER](https://www.php.net/manual/en/reserved.variables.server.php)

### Manejo de errores con excepciones
#### Details
Desde PHP 7, casi todos los errores fatales del engine (llamar a un método en `null`, división por cero) se lanzan como `Error`, que junto con `Exception` implementa la interfaz `Throwable`. Esto significa que un solo `catch (Throwable $e)` puede capturar tanto errores de programación como excepciones de negocio, aunque la práctica recomendada es no tratarlos igual: un `Error` normalmente indica un bug que hay que arreglar, una `Exception` es una condición esperada del dominio.

El manual recomienda crear jerarquías de excepciones propias (extendiendo `Exception` o `RuntimeException`/`InvalidArgumentException` de SPL) para que el código que llama pueda decidir con `catch` específicos qué recuperar y qué re-lanzar. `finally` siempre corre, se haya lanzado excepción o no, y es el lugar correcto para liberar recursos (cerrar conexiones, archivos).

En diseño de APIs, la pregunta típica es "¿devolver `null`/`false` o lanzar excepción?", la convención moderna en PHP (y la que sigue SPL) es lanzar cuando la operación no puede completar su contrato, y reservar `null`/`false` para resultados válidos de "no encontrado" en búsquedas.

#### Examples
Jerarquía de excepciones de dominio
```php
class InsufficientFundsException extends \RuntimeException {}

function withdraw(float $balance, float $amount): float {
    if ($amount > $balance) {
        throw new InsufficientFundsException("Saldo insuficiente: $balance < $amount");
    }
    return $balance - $amount;
}
```

Throwable captura Error y Exception por igual
```php
try {
    $result = 10 / 0; // DivisionByZeroError en PHP 8
} catch (\Throwable $e) {
    error_log($e->getMessage());
}
```

finally libera recursos siempre
```php
$handle = fopen('data.txt', 'r');
try {
    return fread($handle, filesize('data.txt'));
} finally {
    fclose($handle);
}
```

#### Sources
- [PHP Manual, Exceptions](https://www.php.net/manual/en/language.exceptions.php)
- [PHP Manual, SPL Exceptions](https://www.php.net/manual/en/spl.exceptions.php)

## Interview Questions

### ¿Por qué `0 == "abc"` da `false` en PHP 8 pero daba `true` en PHP 7?
PHP 8 cambió las reglas de comparación floja número-vs-string: si el string no es numérico, ahora el número se convierte a string en vez de forzar el string a `0`. Es un cambio de comportamiento importante al migrar código legado, y refuerza por qué conviene usar `===` o `strict_types` en vez de depender de la conversión implícita.

### ¿Cuándo usarías `===` en vez de `==`, y por qué activar `strict_types`?
Uso `===` siempre que el tipo importe para la lógica, que es casi siempre, evita bugs sutiles de conversión con arrays de datos externos (input de usuario, respuestas de API). `strict_types` hace que las funciones tipadas rechacen argumentos que requieran conversión implícita, convirtiendo errores silenciosos en `TypeError` explícitos en desarrollo.

### ¿Por qué un array de PHP puede comportarse como lista y como diccionario con la misma sintaxis?
Porque internamente todo array es una HashTable que preserva orden de inserción; PHP optimiza el caso de claves enteras consecutivas para que se comporte como lista. Si insertás claves no numéricas o hacés `unset()` en el medio, pierde esa optimización y pasa a comportarse como diccionario puro, relevante para performance en loops grandes.

### ¿Por qué no deberías confiar directamente en `$_GET` o `$_POST` en tu lógica de negocio?
Porque son el input crudo del cliente, sin sanitizar ni validar. Los casteo/valido apenas los leo (tipo esperado, rangos, formato) antes de que lleguen a queries SQL o se rendericen en HTML, para no abrir la puerta a SQL injection o XSS.

### ¿Cuándo lanzarías una excepción en vez de devolver `null` o `false`?
Lanzo cuando la operación no puede cumplir su contrato (ej. fondos insuficientes, archivo no existe pero se esperaba que existiera). Reservo `null`/`false` para resultados válidos de "no encontrado" en una búsqueda, donde no encontrar algo es un resultado esperado del dominio, no un error.
