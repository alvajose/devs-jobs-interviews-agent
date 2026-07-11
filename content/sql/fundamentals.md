---
stack: sql
id: sql-fundamentals
title: "SQL: fundamentos de diseño relacional"
area: Datos
priority: high
resourceLabel: PostgreSQL, Documentation
resourceUrl: https://www.postgresql.org/docs/current/
---

## Summary
Los fundamentos que un entrevistador da por sentado: elegir el JOIN correcto, normalizar (y saber cuándo no hacerlo), diseñar índices que realmente se usan, y garantizar integridad referencial con claves.

## Concepts

### Tipos de JOIN y cuándo usar cada uno
#### Details
El `INNER JOIN` devuelve solo las filas que matchean en ambas tablas, es el default mental de la mayoría, pero silenciosamente descarta datos si una tabla tiene huecos. El `LEFT JOIN` (o `LEFT OUTER JOIN`) devuelve todas las filas de la tabla izquierda aunque no haya match en la derecha, rellenando con `NULL`. Es la herramienta correcta cuando la pregunta de negocio es "traeme todos los X, tengan o no un Y relacionado", por ejemplo, todos los clientes con o sin pedidos. El `RIGHT JOIN` es el espejo del `LEFT JOIN`; en la práctica casi nadie lo usa porque es más legible reordenar las tablas y usar `LEFT JOIN`. El `FULL OUTER JOIN` (soportado en PostgreSQL, no en MySQL) devuelve todas las filas de ambos lados, con `NULL` donde no hay match, útil para detectar discrepancias entre dos conjuntos de datos.

Un caso que separa a quien entiende JOINs de quien los memorizó es el **self-join**: unir una tabla consigo misma usando alias distintos, típicamente para relaciones jerárquicas (un empleado que reporta a otro empleado en la misma tabla `employees`) o para comparar filas entre sí (encontrar duplicados, o pares de eventos consecutivos).

El error más común en entrevista es no distinguir dónde poner la condición de filtro: en la cláusula `ON` (que afecta qué filas matchean antes del join) versus en el `WHERE` (que filtra después de resolver el join). En un `LEFT JOIN`, mover una condición sobre la tabla derecha de `ON` a `WHERE` convierte efectivamente el `LEFT JOIN` en un `INNER JOIN`, porque las filas con `NULL` no pasan el filtro del `WHERE`. Es un bug clásico y una pregunta frecuente.

#### Examples
LEFT JOIN, todos los clientes, tengan o no pedidos
```sql
SELECT c.name, o.id AS order_id
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id;
```

Self-join, jerarquía de empleados y su manager
```sql
SELECT e.name AS employee, m.name AS manager
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.id;
```

El bug clásico: ON vs WHERE en un LEFT JOIN
```sql
-- Esto NO es un LEFT JOIN real: filtra los NULL y se comporta como INNER JOIN
SELECT c.name, o.id
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.status = 'shipped';

-- Correcto: la condición de la tabla derecha va en el ON
SELECT c.name, o.id
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'shipped';
```

#### Sources
- [PostgreSQL, Joins Between Tables](https://www.postgresql.org/docs/current/tutorial-join.html)
- [PostgreSQL, Select Lists (JOIN types)](https://www.postgresql.org/docs/current/queries-table-expressions.html#QUERIES-JOIN)

### Normalización (1FN-3FN) y desnormalización deliberada
#### Details
Normalizar no es un ritual académico: cada forma normal existe para eliminar una clase específica de anomalía de actualización. **1FN** exige valores atómicos por columna (nada de "tags: php,mysql,docker" en un solo campo), sin esto, no podés indexar ni filtrar por un valor individual sin parsear strings. **2FN** exige que cada columna no clave dependa de la clave primaria completa, no de una parte de ella, relevante en tablas con clave compuesta, donde una columna que depende solo de la mitad de la clave debería vivir en otra tabla. **3FN** exige que las columnas no clave dependan *solo* de la clave primaria y no de otras columnas no clave, si el `city` depende del `zip_code` y ambos están en la misma tabla `orders`, actualizar una ciudad implica encontrar y corregir todas las filas que la mencionan, con riesgo de inconsistencia.

La razón por la que esto importa en producción es la **anomalía de actualización**: sin normalizar, un mismo dato repetido en múltiples filas puede quedar desincronizado si se actualiza en una fila y no en otra. Normalizar hasta 3FN es el punto de equilibrio que casi toda aplicación transaccional (OLTP) usa por default.

La desnormalización es una decisión de rendimiento tomada a conciencia, no un error. Se justifica cuando el costo de los `JOIN`s repetidos en las lecturas más frecuentes supera el costo de mantener datos duplicados sincronizados, típicamente en reporting, dashboards, o columnas calculadas cacheadas (ej. guardar `order.total` precalculado en vez de sumar `order_items` en cada lectura). La regla de entrevista: primero normalizás por corrección, después desnormalizás puntos específicos con evidencia de que el JOIN es el cuello de botella real.

#### Examples
Violación de 1FN, columna no atómica
```sql
-- Mal: no podés indexar ni filtrar por un tag individual
CREATE TABLE articles (
  id SERIAL PRIMARY KEY,
  title TEXT,
  tags TEXT -- 'sql,postgres,indexing'
);
```

1FN correcta, tabla de relación
```sql
CREATE TABLE articles (id SERIAL PRIMARY KEY, title TEXT);
CREATE TABLE tags (id SERIAL PRIMARY KEY, name TEXT UNIQUE);
CREATE TABLE article_tags (
  article_id INT REFERENCES articles(id),
  tag_id INT REFERENCES tags(id),
  PRIMARY KEY (article_id, tag_id)
);
```

Desnormalización deliberada, total cacheado para evitar recalcular en cada lectura
```sql
ALTER TABLE orders ADD COLUMN total_cached NUMERIC(10,2);
-- Se recalcula en cada INSERT/UPDATE de order_items via trigger o en la capa de aplicación,
-- a cambio de lecturas O(1) en vez de un SUM(...) con JOIN en cada request.
```

#### Sources
- [PostgreSQL, Data Definition (Constraints)](https://www.postgresql.org/docs/current/ddl-constraints.html)
- [PostgreSQL, CREATE TABLE](https://www.postgresql.org/docs/current/sql-createtable.html)

### Índices B-tree: cuándo ayudan y cuándo perjudican
#### Details
El índice por defecto en PostgreSQL y MySQL es un **B-tree**, una estructura balanceada que permite búsquedas, rangos y ordenamientos en tiempo logarítmico en vez de escanear la tabla entera. Un índice ayuda cuando la columna aparece en `WHERE`, `JOIN ON` o `ORDER BY` de queries frecuentes, y cuando la **selectividad** es alta (pocos valores distintos por fila devuelta), indexar una columna booleana con 50/50 de distribución rara vez vale la pena, porque el motor terminaría igual escaneando buena parte de la tabla.

El costo que casi nadie menciona sin que se lo pregunten: **todo índice ralentiza escrituras**. Cada `INSERT`, `UPDATE` o `DELETE` debe mantener actualizado cada índice de la tabla, no solo la tabla en sí. En tablas de alta escritura (logs de eventos, colas, auditoría) agregar índices "por las dudas" es un antipatrón, cada índice de más es overhead medible en cada operación de escritura, y en `UPDATE` de columnas indexadas, además.

En **índices compuestos**, el orden de las columnas define la "leftmost prefix rule": un índice `(country, created_at)` sirve para filtrar por `country` solo o por `country AND created_at`, pero NO sirve para filtrar solo por `created_at`, el motor no puede saltar a la mitad del árbol sin fijar primero la columna líder. Ordenar las columnas del índice según qué combinación de filtros es más frecuente (y poner primero la de mayor selectividad, en general) es una decisión de diseño explícita, no un detalle menor.

#### Examples
Índice simple sobre columna de alta selectividad
```sql
CREATE INDEX idx_users_email ON users (email);
```

Índice compuesto, respeta el leftmost prefix rule
```sql
CREATE INDEX idx_orders_user_created ON orders (user_id, created_at DESC);
-- Sirve para: WHERE user_id = ?  y  WHERE user_id = ? AND created_at > ?
-- NO sirve para: WHERE created_at > ? (sin user_id)
```

Verificar que el planificador realmente usa el índice
```sql
EXPLAIN ANALYZE
SELECT id, total FROM orders
WHERE user_id = 42 AND created_at > '2026-01-01'
ORDER BY created_at DESC;
-- Buscar "Index Scan" o "Index Only Scan" en vez de "Seq Scan"
```

#### Sources
- [PostgreSQL, Indexes](https://www.postgresql.org/docs/current/indexes.html)
- [PostgreSQL, Multicolumn Indexes](https://www.postgresql.org/docs/current/indexes-multicolumn.html)
- [MySQL, How MySQL Uses Indexes](https://dev.mysql.com/doc/refman/8.0/en/mysql-indexes.html)

### Claves primarias, foráneas e integridad referencial
#### Details
La clave primaria (`PRIMARY KEY`) garantiza unicidad y no-nulidad para identificar cada fila; internamente crea un índice único, así que también sirve como acceso rápido por id. La clave foránea (`FOREIGN KEY`) es el mecanismo que el motor usa para **garantizar integridad referencial**: no permite insertar una fila que apunte a un id inexistente en la tabla referenciada, ni borrar una fila padre si todavía hay hijos apuntándola (a menos que se configure explícitamente lo contrario).

Ese "a menos que" son las políticas `ON DELETE` / `ON UPDATE`: `CASCADE` propaga el borrado o la actualización a las filas hijas, `SET NULL` desvincula la relación dejando la FK en null, `RESTRICT` (o el default) bloquea el borrado del padre mientras existan hijos. Elegir mal esta política es una fuente real de bugs en producción, un `ON DELETE CASCADE` en la tabla equivocada puede borrar en cascada datos que debían preservarse para auditoría.

Una trampa común de entrevista: una foreign key sin índice explícito en PostgreSQL. A diferencia de la clave primaria, PostgreSQL **no crea automáticamente un índice sobre la columna FK** en la tabla hija. Sin ese índice, cualquier `JOIN` desde el padre hacia el hijo, o cualquier `DELETE` en el padre que dispare la verificación de FK, termina haciendo un sequential scan sobre la tabla hija completa.

#### Examples
FK con política de borrado explícita
```sql
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id)
);
```

La trampa: FK sin índice, hay que crearlo a mano
```sql
-- PostgreSQL no indexa automáticamente order_items.order_id por ser FK
CREATE INDEX idx_order_items_order_id ON order_items (order_id);
```

SET NULL para desvincular en vez de bloquear el borrado
```sql
CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  author_id INT REFERENCES users(id) ON DELETE SET NULL,
  body TEXT
);
```

#### Sources
- [PostgreSQL, Foreign Keys](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK)
- [PostgreSQL, CREATE TABLE (referential actions)](https://www.postgresql.org/docs/current/sql-createtable.html)

## Interview Questions

### Tenés una tabla `orders` con millones de filas y un `LEFT JOIN` hacia `customers` que anda lento. ¿Qué revisás primero?
Primero corro `EXPLAIN ANALYZE` para ver si el planificador está usando un índice o haciendo un sequential scan en alguna de las dos tablas. Si el join es sobre `customer_id`, verifico que esa columna esté indexada en `orders`, recordando que PostgreSQL no indexa FKs automáticamente. También reviso si hay condiciones sobre la tabla derecha escritas en el `WHERE` en vez del `ON`, porque eso puede forzar un plan distinto al esperado. Por último miro la selectividad de cualquier filtro adicional: si el filtro devuelve la mayoría de las filas, un índice puede no ayudar y el seq scan puede ser, de hecho, el plan correcto.

### Te piden diseñar el esquema de un blog con posts, autores y tags. ¿Cómo lo normalizás y dónde pondrías el límite?
Empezaría en 3FN: `authors`, `posts` (con `author_id` como FK), `tags`, y una tabla de unión `post_tags` para la relación muchos-a-muchos entre posts y tags. Eso evita anomalías de actualización, cambiar el nombre de un tag no requiere tocar cada post que lo usa. El límite de normalizar más allá de 3FN lo pongo cuando el costo de los JOINs adicionales en las queries de lectura más frecuentes (por ejemplo, listar posts con su cantidad de tags) empieza a doler medido con `EXPLAIN ANALYZE`, recién ahí evaluaría una columna desnormalizada como `tag_count` cacheada.

### ¿Cuándo NO conviene agregar un índice, aunque la columna se use en un WHERE?
Cuando la tabla tiene escrituras muy frecuentes y la columna tiene baja selectividad, por ejemplo, un booleano `is_active` con distribución pareja. El índice no reduce mucho el trabajo de lectura porque el motor igual necesita revisar buena parte de la tabla, pero sí agrega overhead medible en cada `INSERT`/`UPDATE`/`DELETE`, porque el índice tiene que mantenerse actualizado. También evito indexar columnas que casi nunca aparecen en filtros o `ORDER BY` de las queries reales del sistema, "por las dudas" no es una razón válida para pagar el costo de escritura.

### ¿Qué pasa si escribís la condición de la tabla derecha de un LEFT JOIN en el WHERE en vez del ON?
Convertís efectivamente el LEFT JOIN en un INNER JOIN. El LEFT JOIN preserva todas las filas de la tabla izquierda rellenando con NULL cuando no hay match, pero si después filtrás en el WHERE por una columna de la tabla derecha, esas filas con NULL no van a pasar el filtro casi nunca (a menos que compares explícitamente contra NULL), así que terminás descartando exactamente las filas que el LEFT JOIN debía preservar. La condición sobre la tabla derecha tiene que ir en el ON para que se evalúe como parte del proceso de matching, no como filtro posterior.

### Diseñá una tabla de eventos de auditoría que reciba miles de inserts por segundo. ¿Qué decisiones de índices y claves tomás?
Minimizaría los índices al mínimo indispensable, porque cada índice adicional le pega directo al throughput de escritura. Usaría una clave primaria simple (idealmente autogenerada y secuencial, tipo `BIGSERIAL`, para evitar fragmentación del índice del PK) y evitaría foreign keys estrictas hacia tablas transaccionales si eso agrega validación costosa en el hot path, muchas veces conviene relajar la integridad referencial fuerte en tablas de auditoría append-only y validarla a nivel de aplicación. Si necesito consultar por rango de fechas, indexaría solo esa columna, y evaluaría particionar la tabla por fecha para que las queries recientes no escaneen histórico completo.

### ¿Por qué una FK sin índice puede ser un problema de rendimiento silencioso?
Porque el motor la usa constantemente para dos operaciones: hacer JOIN desde la tabla padre, y verificar integridad referencial cuando se borra o actualiza una fila padre (para chequear si existen hijos). Sin un índice sobre la columna FK del lado hijo, ambas operaciones terminan en un sequential scan de la tabla hija completa. Es "silencioso" porque el sistema funciona correctamente al principio, con pocas filas, y el problema solo se manifiesta cuando la tabla crece, momento en el que ya está en producción y el diagnóstico requiere mirar el plan de ejecución para notarlo.
