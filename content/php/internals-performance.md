---
stack: php
id: php-internals-performance
title: Internals y Performance de PHP
area: Performance
priority: medium
resourceLabel: PHP Manual, Performance Considerations
resourceUrl: https://www.php.net/manual/en/features.gc.performance-considerations.php
---

## Summary
Cómo maneja memoria el Zend Engine (Zval, copy-on-write, refcounting), qué hace OPcache en producción y cuándo un generator ahorra memoria real, el "PHP7/Zval/HashTable" que se pregunta en entrevistas de backend serias.

## Concepts

### Zval y copy-on-write
#### Details
Cada variable en PHP es internamente un `zval` (Zend value): una estructura que guarda el tipo y el valor, más un contador de referencias (`refcount`). Cuando asignás una variable a otra (`$b = $a`), PHP no copia el dato inmediatamente, ambas variables apuntan al mismo zval y el refcount sube a 2. Esto se llama copy-on-write: la copia real solo ocurre si una de las dos variables se modifica, momento en que PHP separa ("duplica") el zval antes de aplicar el cambio.

Esto explica por qué pasar un array grande a una función por valor no es tan costoso como parece: mientras la función solo lea el array, no hay copia física de memoria, solo se incrementa el refcount. La copia ocurre recién si la función modifica su copia local.

Para arrays y objetos, el refcounting también determina cuándo se libera memoria: cuando el refcount llega a 0, el zval se destruye inmediatamente. El caso problemático son las referencias circulares (un objeto A referencia a B y B referencia a A), ahí el refcount nunca llega a 0 por sí solo, y hace falta el garbage collector cíclico.

#### Examples
Copy-on-write en acción
```php
function inspect(array $data): int {
    return count($data); // no dispara copia, solo lee
}

$huge = range(1, 1_000_000);
inspect($huge); // rápido: refcount sube, no hay duplicación de memoria

function mutate(array $data): array {
    $data[] = 'x'; // ACA se dispara la copia (separación del zval)
    return $data;
}
```

Referencia circular que necesita el GC cíclico
```php
class Node {
    public ?Node $next = null;
}

$a = new Node();
$b = new Node();
$a->next = $b;
$b->next = $a; // ciclo: refcounting solo no libera esto

unset($a, $b);
gc_collect_cycles(); // fuerza al colector cíclico a liberar la memoria
```

#### Sources
- [PHP Manual, Garbage Collection](https://www.php.net/manual/en/features.gc.php)
- [PHP Internals, Variables](https://www.php.net/manual/en/internals2.variables.intro.php)

### OPcache en producción
#### Details
PHP normalmente compila cada script a bytecode (opcodes) en cada request y lo descarta al terminar. OPcache guarda ese bytecode compilado en memoria compartida entre requests, evitando recompilar el mismo archivo una y otra vez, es la optimización de producción más impactante y la primera que se pregunta en entrevista de performance backend.

El manual documenta `opcache.validate_timestamps`: en desarrollo debe estar en `1` (default) para que OPcache detecte cambios de archivo comparando timestamps; en producción se recomienda `0` junto con invalidar la caché explícitamente en cada deploy (`opcache_reset()` o reiniciar PHP-FPM), porque comprobar el timestamp de cada archivo en cada request tiene su propio costo.

También es relevante `opcache.memory_consumption` (cuánta memoria compartida reservar) y `opcache.max_accelerated_files` (cuántos archivos distintos puede cachear), subdimensionarlos causa que OPcache empiece a desalojar (evict) archivos y pierda efectividad en aplicaciones grandes con muchos includes.

#### Examples
Configuración típica de producción (php.ini)
```ini
opcache.enable=1
opcache.validate_timestamps=0
opcache.memory_consumption=256
opcache.max_accelerated_files=20000
opcache.jit=tracing
```

Invalidar la caché en el pipeline de deploy
```php
<?php
// deploy-hook.php: correr después de cada deploy si validate_timestamps=0
if (function_exists('opcache_reset')) {
    opcache_reset();
}
```

#### Sources
- [PHP Manual, OPcache Configuration](https://www.php.net/manual/en/opcache.configuration.php)

### Generators para iteración eficiente en memoria
#### Details
Un generator (`yield`) produce valores uno a la vez bajo demanda en vez de construir el array completo en memoria antes de devolverlo. El manual lo describe como una forma sencilla de implementar iteradores: PHP suspende la ejecución de la función en cada `yield` y la reanuda cuando el consumidor pide el siguiente valor, manteniendo su estado interno entre llamadas.

Es la respuesta correcta cuando procesás datasets grandes (leer un archivo de millones de líneas, iterar resultados de una query masiva) donde construir un array completo agotaría la memoria disponible, el costo de memoria de un generator es O(1) por elemento en vuelo, no O(n) del dataset completo.

El trade-off que se pregunta en entrevista senior: un generator solo se puede recorrer una vez (no es "rebobinable" como un array salvo con lógica extra), y no soporta acceso aleatorio por índice, si necesitás ambas cosas, un array sigue siendo la estructura correcta pese al costo de memoria.

#### Examples
Leer un archivo enorme línea por línea sin cargarlo entero
```php
function readLines(string $path): \Generator {
    $handle = fopen($path, 'r');
    while (($line = fgets($handle)) !== false) {
        yield $line; // suspende aca, no acumula en memoria
    }
    fclose($handle);
}

foreach (readLines('access.log') as $line) {
    if (str_contains($line, 'ERROR')) {
        echo $line;
    }
}
```

Generator con clave y valor (como un array asociativo perezoso)
```php
function paginate(array $items, int $size): \Generator {
    foreach (array_chunk($items, $size) as $page => $chunk) {
        yield $page => $chunk;
    }
}
```

#### Sources
- [PHP Manual, Generators Overview](https://www.php.net/manual/en/language.generators.overview.php)

## Interview Questions

### ¿Por qué pasar un array de un millón de elementos a una función no siempre es costoso en PHP?
Porque PHP usa copy-on-write: pasar por valor solo incrementa el refcount del zval, no copia memoria. La copia real recién ocurre si la función modifica su copia local del array, si solo lo lee, el costo es constante, no proporcional al tamaño del array.

### ¿Qué configurarías de OPcache antes de llevar una app PHP a producción?
Como mínimo `opcache.enable=1` y `opcache.validate_timestamps=0` para que no recompile ni chequee timestamps en cada request, ajustando `memory_consumption` y `max_accelerated_files` al tamaño real de la app. Con `validate_timestamps=0` es crítico invalidar la caché (`opcache_reset()` o reinicio de PHP-FPM) en cada deploy, o los usuarios seguirían viendo el bytecode viejo.

### ¿Cuándo usarías un generator en vez de devolver un array completo?
Cuando el dataset es grande o desconocido de antemano, leer un archivo de millones de líneas, iterar resultados de una query masiva. El generator mantiene memoria constante porque produce valores bajo demanda, mientras que un array cargaría todo en memoria antes de que el consumidor procese el primer elemento.

### ¿Qué pasa con dos objetos que se referencian mutuamente y quedan sin uso?
El refcounting normal no los libera porque cada uno mantiene vivo al otro con un refcount mayor a cero, aunque nada externo los referencie. PHP tiene un garbage collector cíclico aparte que detecta y libera estos ciclos, aunque no corre después de cada operación, en código sensible a memoria se puede forzar con `gc_collect_cycles()`.

### ¿Qué limitación tiene un generator frente a un array que a veces lo descarta como opción?
No se puede recorrer más de una vez sin volver a llamar a la función generadora, y no soporta acceso aleatorio por índice como `$array[500]`. Si el consumidor necesita iterar varias veces o acceder por posición arbitraria, un array sigue siendo la estructura correcta pese a su costo de memoria.
