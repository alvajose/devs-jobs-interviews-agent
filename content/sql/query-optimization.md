---
stack: sql
id: sql-query-optimization
title: "SQL: optimización de queries y transacciones"
area: Datos
priority: high
resourceLabel: PostgreSQL, Performance Tips
resourceUrl: https://www.postgresql.org/docs/current/performance-tips.html
---

## Summary
Cómo leer un plan de ejecución, evitar el problema N+1, elegir el nivel de aislamiento correcto, y paginar resultados grandes sin que el rendimiento se degrade con el tamaño del offset.

## Concepts

### Leer un plan de ejecución con EXPLAIN ANALYZE
#### Details
`EXPLAIN` muestra el plan que el optimizador *elegiría* ejecutar, con costos estimados; `EXPLAIN ANALYZE` además ejecuta la query de verdad y muestra tiempos reales y filas reales por cada paso. La diferencia entre lo estimado y lo real es información valiosa: si el planificador estima 10 filas y en la realidad hay 100.000, las estadísticas de la tabla están desactualizadas (hace falta un `ANALYZE`) y el optimizador probablemente está eligiendo un plan subóptimo basado en información incorrecta.

Los nodos clave para reconocer en el output: **Seq Scan** (escaneo secuencial de toda la tabla, aceptable en tablas chicas o cuando se necesita la mayoría de las filas, sospechoso en tablas grandes con filtros selectivos), **Index Scan** (usa el índice para localizar filas y después va a buscar cada una al heap), **Index Only Scan** (responde completamente desde el índice sin tocar el heap, el caso ideal cuando todas las columnas pedidas están en el índice), y **Nested Loop / Hash Join / Merge Join** como las tres estrategias de join, cada una óptima en escenarios distintos según el tamaño de las tablas involucradas y si hay índices disponibles.

La habilidad de entrevista real no es memorizar los nombres de los nodos, sino saber leer de abajo hacia arriba: el costo y las filas se acumulan desde las hojas del plan hacia la raíz, y el nodo con mayor "actual time" acumulado es el candidato número uno a optimizar primero.

#### Examples
EXPLAIN ANALYZE básico
```sql
EXPLAIN ANALYZE
SELECT * FROM orders WHERE customer_id = 42;
```

Detectar un Seq Scan que debería ser Index Scan
```sql
-- Output sospechoso en una tabla de 5M filas:
-- Seq Scan on orders (cost=0.00..95000.00 rows=1 width=120) (actual time=850.123..850.130 rows=1 loops=1)
-- Solución: falta un índice sobre customer_id, o las estadísticas están desactualizadas.
CREATE INDEX idx_orders_customer_id ON orders (customer_id);
ANALYZE orders;
```

Forzar refresco de estadísticas cuando el plan parece equivocado
```sql
ANALYZE orders; -- recalcula estadísticas que usa el optimizador
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders WHERE status = 'pending';
-- BUFFERS muestra hits de cache vs lecturas a disco, útil para detectar I/O real
```

#### Sources
- [PostgreSQL, Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html)
- [PostgreSQL, Planner Statistics](https://www.postgresql.org/docs/current/planner-stats.html)

### El problema N+1
#### Details
El N+1 ocurre cuando el código ejecuta 1 query para traer una lista de N registros, y después ejecuta N queries adicionales, una por cada registro, para traer datos relacionados. Es, con diferencia, el problema de rendimiento más común introducido por ORMs (SQLAlchemy, Eloquent, Hibernate, Prisma), porque el acceso "perezoso" (`lazy loading`) a una relación es cómodo de escribir y fácil de no notar en desarrollo con pocos datos, el problema se vuelve visible recién en producción, con datasets grandes.

La causa raíz es la diferencia entre acceder a una relación *dentro* de un loop (dispara una query por iteración) versus pedirle al ORM que traiga esa relación *junto* con la query original. La solución en SQL puro es un `JOIN` (o una segunda query con `WHERE id IN (...)` para evitar filas duplicadas cuando la relación es uno-a-muchos); en el ORM esto se expone como "eager loading" (`with()` en Eloquent, `selectinload`/`joinedload` en SQLAlchemy, `include` en Prisma).

En entrevista, la respuesta completa no es solo "usá eager loading", es explicar cómo se **detecta** en primer lugar: habilitando logging de queries SQL a nivel de framework, contando queries por request (muchos frameworks tienen herramientas de profiling tipo Laravel Debugbar o `django-debug-toolbar`), y confirmando después del fix que el conteo de queries bajó de N+1 a un número constante, no solo asumiendo que el cambio de código funcionó.

#### Examples
El problema, N+1 al iterar una relación
```sql
-- Query 1: traer 50 órdenes
SELECT * FROM orders WHERE customer_id = 42;
-- Queries 2..51: una por cada orden, disparada por el código de la app en un loop
SELECT * FROM order_items WHERE order_id = 1;
SELECT * FROM order_items WHERE order_id = 2;
-- ... 48 veces más
```

La solución en SQL puro, traer todo en una sola query batch
```sql
SELECT oi.*
FROM order_items oi
WHERE oi.order_id IN (
  SELECT id FROM orders WHERE customer_id = 42
);
```

Alternativa con JOIN cuando se necesitan columnas de ambas tablas
```sql
SELECT o.id AS order_id, o.total, oi.product_id, oi.quantity
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.customer_id = 42;
```

#### Sources
- [PostgreSQL, Joins Between Tables](https://www.postgresql.org/docs/current/tutorial-join.html)
- [PostgreSQL, Subqueries](https://www.postgresql.org/docs/current/functions-subquery.html)

### Transacciones y niveles de aislamiento
#### Details
Una transacción agrupa varias operaciones para que ocurran todas o ninguna (atomicidad), y los niveles de aislamiento definen qué tan visibles son los cambios de una transacción concurrente para otra mientras ambas están en curso. Los tres fenómenos clásicos que hay que saber nombrar: **dirty read** (leer datos de una transacción que todavía no hizo commit, y que podría hacer rollback), **non-repeatable read** (leer la misma fila dos veces dentro de la misma transacción y obtener valores distintos porque otra transacción la modificó y confirmó en el medio), y **phantom read** (ejecutar la misma query de rango dos veces y obtener un conjunto de filas distinto porque otra transacción insertó o borró filas que matchean el filtro).

`READ COMMITTED` es el default en PostgreSQL: previene dirty reads pero permite non-repeatable reads y phantom reads. `REPEATABLE READ` (usando snapshot isolation en PostgreSQL) previene además non-repeatable reads, y en la implementación de PostgreSQL también previene phantom reads gracias al mecanismo MVCC, algo que difiere del estándar SQL y de otros motores. `SERIALIZABLE` es el nivel más estricto: garantiza que el resultado de ejecutar transacciones concurrentes es equivalente a ejecutarlas en algún orden secuencial, a costa de mayor probabilidad de que el motor aborte una transacción con un error de serialización que la aplicación debe estar preparada para reintentar.

Un punto de vendor específico que vale la pena mencionar en entrevista: **MySQL con InnoDB usa `REPEATABLE READ` como default**, a diferencia de PostgreSQL que usa `READ COMMITTED`. Esto importa porque el mismo código de aplicación puede comportarse distinto según el motor si depende implícitamente del nivel de aislamiento por defecto.

#### Examples
Transacción explícita con rollback ante error
```sql
BEGIN;

UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;

-- Si alguna falla (ej. balance negativo con un CHECK constraint), se hace ROLLBACK
COMMIT;
```

Configurar el nivel de aislamiento explícitamente
```sql
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
SELECT balance FROM accounts WHERE id = 1;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
COMMIT;
-- Si otra transacción concurrente conflictúa, PostgreSQL puede abortar esta
-- con un serialization_failure, la app debe reintentar la transacción completa.
```

Ver el nivel de aislamiento actual de la sesión
```sql
SHOW transaction_isolation;
```

#### Sources
- [PostgreSQL, Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- [MySQL, InnoDB Transaction Isolation Levels](https://dev.mysql.com/doc/refman/8.0/en/innodb-transaction-isolation-levels.html)

### Paginación a escala: OFFSET vs keyset/cursor pagination
#### Details
`LIMIT ... OFFSET` es la forma más simple de paginar, pero degrada linealmente con el tamaño del offset: para devolver la página 10.000 con `OFFSET 200000`, el motor típicamente tiene que recorrer y descartar las primeras 200.000 filas del resultado ordenado antes de devolver el bloque pedido. En tablas grandes esto convierte "paginar hacia atrás" en una operación cada vez más lenta, y además es inconsistente si se insertan o borran filas entre una página y la siguiente: un usuario puede ver la misma fila dos veces o saltearse una.

La alternativa que escala es **keyset pagination** (también llamada cursor pagination): en vez de un offset numérico, la query recuerda el valor de la última fila vista (típicamente la clave de ordenamiento, ej. `id` o `created_at`) y pide "las siguientes N filas después de ese valor". Esto convierte la paginación en un `WHERE columna > valor ORDER BY columna LIMIT N`, que un índice sobre esa columna resuelve en tiempo prácticamente constante sin importar en qué página estás.

La contra del keyset pagination es que no permite saltar directamente a una página arbitraria por número (no hay "ir a la página 500") sin mantener una tabla de cursores adicional, es el tradeoff que se acepta a cambio de rendimiento consistente. Es exactamente el mecanismo detrás de "cargar más" o scroll infinito en la mayoría de las APIs modernas (Twitter, GitHub API, Stripe API todas usan variantes de cursor pagination).

#### Examples
OFFSET pagination, simple pero degrada con offsets grandes
```sql
SELECT id, title, created_at FROM articles
ORDER BY created_at DESC
LIMIT 20 OFFSET 200000; -- el motor descarta 200000 filas antes de devolver el bloque
```

Keyset pagination, usa el último valor visto como cursor
```sql
-- Primera página
SELECT id, title, created_at FROM articles
ORDER BY created_at DESC, id DESC
LIMIT 20;

-- Página siguiente: el cliente envía el created_at/id de la última fila de la página anterior
SELECT id, title, created_at FROM articles
WHERE (created_at, id) < ('2026-06-15 10:00:00', 4821)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

Índice que hace eficiente el keyset pagination
```sql
CREATE INDEX idx_articles_created_id ON articles (created_at DESC, id DESC);
```

#### Sources
- [PostgreSQL, LIMIT and OFFSET](https://www.postgresql.org/docs/current/queries-limit.html)
- [PostgreSQL, Row Constructor Comparison](https://www.postgresql.org/docs/current/functions-comparisons.html#ROW-WISE-COMPARISON)

## Interview Questions

### Corrés EXPLAIN ANALYZE sobre una query y ves "Seq Scan" en una tabla de 10 millones de filas con un filtro muy selectivo. ¿Qué pasos seguís?
Primero confirmo si existe un índice sobre la columna del filtro; si no existe, esa es la causa directa. Si el índice existe pero el planificador igual elige Seq Scan, sospecho de estadísticas desactualizadas y corro `ANALYZE` sobre la tabla para refrescarlas, porque el optimizador decide según estimaciones de cardinalidad. También reviso si la condición usa una función sobre la columna (por ejemplo `LOWER(email) = ...`) sin un índice funcional correspondiente, lo cual invalida el uso del índice normal. Si nada de esto resuelve el problema, comparo el costo estimado de ambos planes para confirmar si, dado el tamaño real de filas devueltas, el Seq Scan es de hecho la elección correcta.

### Un endpoint que lista órdenes con sus items tarda 8 segundos y ves cientos de queries en el log. ¿Cómo lo diagnosticás y arreglás?
Es un N+1 clásico. Confirmo el patrón contando queries por request con el logging SQL del framework, e identifico qué relación se accede dentro de un loop, típicamente `order.items` para cada orden de la lista. La solución es reemplazar el acceso lazy por eager loading (un JOIN o una segunda query con `IN (...)` batch) para que el número de queries deje de escalar con el tamaño de la lista. Después de aplicar el fix, vuelvo a medir el conteo de queries y el tiempo de respuesta, no basta con mirar el código y asumir que está arreglado.

### ¿Qué diferencia hay entre READ COMMITTED y REPEATABLE READ, y por qué te importaría elegir uno sobre otro?
READ COMMITTED solo garantiza no leer datos sin commitear de otra transacción, pero si leo la misma fila dos veces dentro de mi transacción puedo obtener valores distintos porque otra transacción la modificó y confirmó en el medio (non-repeatable read). REPEATABLE READ fija un snapshot consistente al inicio de la transacción, así que todas las lecturas dentro de ella ven los mismos datos sin importar qué hagan otras transacciones concurrentes. Elegiría REPEATABLE READ (o SERIALIZABLE) cuando la lógica de negocio hace varias lecturas de los mismos datos y necesita que sean consistentes entre sí, como calcular un balance leyendo el mismo saldo más de una vez dentro de la misma operación.

### Tenés que paginar una tabla de 50 millones de eventos ordenados por fecha para un endpoint de scroll infinito. ¿OFFSET o keyset pagination, y por qué?
Keyset pagination, sin dudarlo, para una tabla de ese tamaño. Con `OFFSET`, cada página más profunda obliga al motor a recorrer y descartar todas las filas anteriores, así que el tiempo de respuesta crece con el número de página en vez de mantenerse constante. Con keyset pagination, cada página es un `WHERE created_at < cursor ORDER BY created_at DESC LIMIT N` que un índice compuesto resuelve en tiempo prácticamente constante. La contra que acepto es no poder saltar a una página arbitraria por número, pero para scroll infinito eso no es un requisito real.

### ¿Por qué SERIALIZABLE puede hacer que una transacción falle con un error que no tiene que ver con una violación de constraint?
Porque SERIALIZABLE garantiza que el resultado de las transacciones concurrentes sea equivalente a ejecutarlas una tras otra en algún orden, y para cumplir esa garantía el motor detecta cuándo dos transacciones concurrentes, si se hubieran ejecutado en cualquier orden secuencial, habrían producido un resultado distinto al que producirían corriendo en paralelo. Cuando detecta ese conflicto, aborta una de las dos con un error de serialización, aunque ninguna transacción haya violado ningún constraint de datos. Por eso cualquier código que usa SERIALIZABLE tiene que estar preparado para capturar ese error específico y reintentar la transacción completa desde el principio.

### MySQL usa REPEATABLE READ como default y PostgreSQL usa READ COMMITTED. ¿Qué implicancia práctica tiene esto si portás código de un motor a otro?
Si el código de aplicación depende implícitamente del nivel de aislamiento por defecto, por ejemplo, asumiendo que dos lecturas consecutivas de la misma fila dentro de una transacción siempre van a devolver el mismo valor, ese código puede comportarse distinto al migrar de MySQL a PostgreSQL sin cambiar el nivel de aislamiento explícitamente. La recomendación es no depender nunca del default implícito del motor: si la lógica necesita una garantía de aislamiento específica, hay que declararla explícitamente con `SET TRANSACTION ISOLATION LEVEL` para que el comportamiento sea el mismo sin importar qué motor esté corriendo detrás.
