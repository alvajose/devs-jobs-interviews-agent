---
stack: sql
id: sql-schema-design
title: "SQL: diseño de esquemas para casos reales"
area: Datos
priority: medium
resourceLabel: PostgreSQL, Data Definition
resourceUrl: https://www.postgresql.org/docs/current/ddl.html
---

## Summary
Cómo modelar relaciones uno-a-muchos y muchos-a-muchos, decidir entre soft y hard deletes, diseñar pensando en los patrones de acceso reales, y saber cuándo un modelo relacional no es la herramienta correcta.

## Concepts

### Uno-a-muchos vs muchos-a-muchos: tablas de unión
#### Details
Una relación **uno-a-muchos** se modela con una foreign key en el lado "muchos" apuntando al lado "uno", un `author_id` en `posts` apuntando a `authors`, porque cada post tiene un solo autor pero un autor tiene muchos posts. No hace falta tabla adicional: la FK sola alcanza para representar la relación completa.

Una relación **muchos-a-muchos** no se puede representar con una FK simple porque ninguno de los dos lados tiene un único id del otro lado, un post puede tener varios tags, y un tag puede estar en varios posts. La solución es una **tabla de unión** (junction table / bridge table) con dos foreign keys, una hacia cada tabla relacionada, y típicamente una clave primaria compuesta por ambas FKs para evitar pares duplicados. Cuando la relación en sí tiene atributos propios (por ejemplo, en `enrollments` entre `students` y `courses`, el atributo `enrollment_date` o `grade` no pertenece ni a student ni a course, sino a la relación entre ambos), esos atributos viven como columnas adicionales en la tabla de unión.

La pregunta de entrevista más común sobre este tema no es "qué es una tabla de unión" sino "diseñame el esquema para X" donde X tiene una relación muchos-a-muchos escondida que hay que identificar, por ejemplo, un sistema de turnos donde un turno puede involucrar varios proveedores, o un sistema de permisos donde un usuario tiene varios roles y un rol lo tienen varios usuarios.

#### Examples
Uno-a-muchos, FK simple en el lado "muchos"
```sql
CREATE TABLE authors (id SERIAL PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  author_id INT NOT NULL REFERENCES authors(id),
  title TEXT NOT NULL
);
```

Muchos-a-muchos, tabla de unión con PK compuesta
```sql
CREATE TABLE students (id SERIAL PRIMARY KEY, name TEXT);
CREATE TABLE courses (id SERIAL PRIMARY KEY, title TEXT);
CREATE TABLE enrollments (
  student_id INT NOT NULL REFERENCES students(id),
  course_id INT NOT NULL REFERENCES courses(id),
  enrolled_at DATE NOT NULL DEFAULT CURRENT_DATE,
  grade NUMERIC(4,2),
  PRIMARY KEY (student_id, course_id)
);
```

Tabla de unión con rol adicional (varios proveedores por turno, con distinto rol)
```sql
CREATE TABLE appointment_providers (
  appointment_id INT NOT NULL REFERENCES appointments(id),
  provider_id INT NOT NULL REFERENCES providers(id),
  role TEXT NOT NULL, -- 'primary', 'assistant'
  PRIMARY KEY (appointment_id, provider_id)
);
```

#### Sources
- [PostgreSQL, Foreign Keys](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK)
- [PostgreSQL, Constraints (composite primary keys)](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-PRIMARY-KEYS)

### Soft deletes vs hard deletes
#### Details
Un **hard delete** ejecuta un `DELETE` real: la fila desaparece de la tabla y, salvo backups, la información se pierde. Es simple y mantiene las tablas chicas, pero no sirve cuando el negocio necesita auditoría, recuperación de datos borrados por error, o mantener el historial para reportes (por ejemplo, no perder los detalles de un producto que fue borrado pero aparece en órdenes históricas).

Un **soft delete** no borra la fila: agrega una columna (típicamente `deleted_at TIMESTAMP NULL`, o un booleano `is_deleted`) y todas las queries de la aplicación filtran `WHERE deleted_at IS NULL` para excluir los registros "borrados". El costo es que ahora **todo** el código de acceso a esa tabla tiene que recordar aplicar ese filtro, un JOIN o una query que se olvida el filtro puede filtrar datos que el negocio consideraba borrados, un bug de seguridad/privacidad real. Muchos ORMs (Eloquent con `SoftDeletes`, por ejemplo) resuelven esto con un "global scope" que aplica el filtro automáticamente salvo que se pida explícitamente lo contrario.

Otro costo que se paga en soft deletes: los constraints `UNIQUE` dejan de funcionar como se espera, porque un email "borrado" sigue ocupando el valor único y bloquea que un nuevo usuario se registre con ese mismo email. La solución típica es un índice único parcial que solo aplica sobre las filas no borradas.

#### Examples
Soft delete con columna deleted_at
```sql
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;

-- "Borrar" un usuario sin perder el registro
UPDATE users SET deleted_at = now() WHERE id = 42;

-- Todas las queries de la app deben excluir los borrados
SELECT * FROM users WHERE deleted_at IS NULL;
```

Índice único parcial, permite reusar el email tras un soft delete
```sql
CREATE UNIQUE INDEX idx_users_email_active
ON users (email)
WHERE deleted_at IS NULL;
```

Hard delete con ON DELETE CASCADE cuando el historial no es un requisito
```sql
CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE
);
-- Al hacer DELETE FROM users WHERE id = 42, las sesiones asociadas se borran en cascada.
```

#### Sources
- [PostgreSQL, Partial Indexes](https://www.postgresql.org/docs/current/indexes-partial.html)
- [PostgreSQL, DELETE](https://www.postgresql.org/docs/current/sql-delete.html)

### Diseñar el esquema según los patrones de acceso
#### Details
El error de diseño más frecuente es modelar entidades pensando solo en "qué representa el negocio" sin preguntarse "cómo se va a consultar esto en producción, con qué frecuencia, y a qué escala". Un esquema correctamente normalizado puede ser inutilizable en la práctica si las queries más frecuentes requieren cinco `JOIN`s sobre tablas de millones de filas. Diseñar pensando en el acceso significa identificar de antemano las 3-4 queries que se van a ejecutar más seguido y asegurarse de que existan índices (o, en casos extremos, columnas desnormalizadas) que las resuelvan eficientemente.

Un ejemplo clásico de entrevista es un **feed social**: mostrar los posts más recientes de las personas que sigo. La versión ingenua hace un `JOIN` entre `follows` y `posts` ordenado por fecha en tiempo de lectura ("pull model"), funciona bien con pocos usuarios, pero se degrada cuando alguien sigue a miles de cuentas. El patrón alternativo ("push model" o fan-out on write) precalcula el feed de cada usuario al momento de publicar, escribiendo una fila en una tabla `feed_items` por cada seguidor, mucho más rápido de leer, más caro de escribir, y es exactamente el tradeoff que Twitter documentó públicamente para su propio feed.

Otro caso frecuente: un **sistema de e-commerce**. Las órdenes necesitan snapshot de precio e información del producto en el momento de la compra (no una referencia viva a `products`, porque el precio cambia con el tiempo), por eso `order_items` suele duplicar `product_name` y `unit_price` en vez de solo tener un `product_id`. Esto es desnormalización deliberada motivada por un requisito real: la orden histórica no debe cambiar si el producto cambia de precio después.

#### Examples
Feed social, pull model (JOIN en tiempo de lectura, simple pero no escala)
```sql
SELECT p.* FROM posts p
JOIN follows f ON f.followee_id = p.author_id
WHERE f.follower_id = 42
ORDER BY p.created_at DESC
LIMIT 20;
```

Feed social, push model (fan-out on write, precalculado)
```sql
-- Al publicar un post, se inserta una fila de feed por cada seguidor
INSERT INTO feed_items (user_id, post_id, created_at)
SELECT follower_id, 999, now()
FROM follows WHERE followee_id = 42;

-- Leer el feed es un solo SELECT sin JOIN pesado
SELECT * FROM feed_items WHERE user_id = 42 ORDER BY created_at DESC LIMIT 20;
```

E-commerce, snapshot de precio en order_items (no referencia viva a products)
```sql
CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id),
  product_id INT NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,   -- snapshot al momento de la compra
  unit_price NUMERIC(10,2) NOT NULL, -- snapshot, no el precio actual de products
  quantity INT NOT NULL
);
```

#### Sources
- [PostgreSQL, Data Definition](https://www.postgresql.org/docs/current/ddl.html)
- [PostgreSQL, Indexes](https://www.postgresql.org/docs/current/indexes.html)

### Cuándo un modelo relacional no es la herramienta correcta
#### Details
El modelo relacional brilla cuando los datos tienen estructura estable, relaciones bien definidas entre entidades, y la aplicación necesita garantías fuertes de consistencia (transacciones ACID, integridad referencial). No es la herramienta correcta en todos los casos, y saber reconocer cuándo NO usarlo es tan valioso en entrevista como saber diseñar con SQL.

Un documento (tipo MongoDB) tiene sentido cuando el esquema es genuinamente variable entre registros (cada "producto" tiene atributos completamente distintos según su categoría) o cuando el patrón de acceso siempre lee el documento completo de una vez, sin necesidad de hacer joins ni queries parciales sobre sus campos internos, por ejemplo, guardar la configuración completa de un usuario o el payload de un evento de analytics. Un store clave-valor o cache (Redis) tiene sentido para datos efímeros o de acceso extremadamente frecuente donde la latencia importa más que la durabilidad estricta, sesiones, rate limiting, cachear el resultado de una query cara. Una base de grafos (Neo4j) tiene sentido cuando la consulta central del sistema es sobre relaciones profundas y variables entre entidades (recomendaciones basadas en conexiones de segundo o tercer grado), algo que en SQL requeriría JOINs recursivos costosos.

La respuesta madura en entrevista no es "SQL siempre" ni "NoSQL siempre", es reconocer que muchos sistemas reales son **poliglota**: PostgreSQL como fuente de verdad transaccional, Redis para cache y sesiones, Elasticsearch para búsqueda de texto completo. La pregunta que hay que saber contestar es "para ESTE caso de uso específico, qué patrón de acceso predomina, y qué motor lo resuelve mejor", no una preferencia dogmática.

#### Examples
Caso donde SQL es correcto, relaciones estables e integridad crítica
```sql
-- Sistema de facturación: necesita ACID real, no puede permitir un pago
-- registrado sin su orden correspondiente, ni una orden con total inconsistente.
BEGIN;
INSERT INTO invoices (order_id, total) VALUES (123, 250.00);
UPDATE orders SET status = 'invoiced' WHERE id = 123;
COMMIT;
```

Caso donde un documento tiene más sentido, esquema variable por categoría
```json
// Catálogo de productos con atributos completamente distintos por categoría:
// electrónica tiene "voltage" y "warranty_months", ropa tiene "size" y "material".
// Forzar esto a columnas SQL fijas generaría muchas columnas NULL o una tabla EAV incómoda.
{ "id": "p_123", "category": "electronics", "attributes": { "voltage": "220V", "warranty_months": 24 } }
```

Sistema poliglota típico, SQL como fuente de verdad, Redis como cache
```sql
-- PostgreSQL guarda el dato canónico
SELECT * FROM products WHERE id = 123;
-- La capa de aplicación cachea el resultado en Redis con TTL
-- para no pegarle a Postgres en cada request de un producto poco cambiante.
```

#### Sources
- [PostgreSQL, JSON Types (cuando SQL necesita flexibilidad de esquema)](https://www.postgresql.org/docs/current/datatype-json.html)
- [PostgreSQL, Data Definition](https://www.postgresql.org/docs/current/ddl.html)

## Interview Questions

### Diseñá el esquema para un sistema de e-commerce simple: clientes, órdenes, productos e items de orden. ¿Qué decisiones tomás y por qué?
Modelaría `customers`, `products` y `orders` (con FK a `customer_id`) como entidades independientes, y `order_items` como la tabla que resuelve la relación muchos-a-muchos entre orders y products, con `order_id` y `product_id` como FKs. La decisión clave es que `order_items` no debe depender solo de un `product_id` para mostrar el detalle histórico: guardo `product_name` y `unit_price` como snapshot en el momento de la compra, porque si el producto cambia de precio o nombre después, la orden histórica no debe reflejar ese cambio. Indexaría `orders.customer_id` para listar el historial de compras de un cliente rápidamente.

### ¿Cómo modelarías que un usuario puede tener varios roles y un rol lo pueden tener varios usuarios?
Es una relación muchos-a-muchos clásica, así que uso una tabla de unión `user_roles(user_id, role_id)` con clave primaria compuesta por ambas columnas para evitar asignar el mismo rol dos veces al mismo usuario. Si necesito auditar cuándo se asignó cada rol, agrego una columna `assigned_at` en la tabla de unión misma, porque ese dato pertenece a la relación entre usuario y rol, no a ninguna de las dos entidades por separado.

### Elegiste soft deletes para la tabla de usuarios. ¿Qué problemas tenés que resolver que no existirían con hard delete?
El problema principal es que cada query sobre `users` en toda la aplicación tiene que recordar filtrar `WHERE deleted_at IS NULL`, y olvidarse ese filtro en un solo lugar puede exponer datos que el negocio considera borrados, un riesgo real de privacidad. También los constraints `UNIQUE` dejan de comportarse como se espera: si alguien borra su cuenta y otra persona intenta registrarse con el mismo email, el `UNIQUE` sobre `email` lo bloquea aunque la cuenta esté "borrada". La solución es un índice único parcial que solo aplica sobre las filas activas, y en frameworks con ORM conviene usar el mecanismo nativo de soft delete (como los global scopes de Eloquent) para no depender de que cada desarrollador recuerde el filtro manualmente.

### Te piden diseñar un feed social tipo Twitter: mostrar los posts recientes de las cuentas que sigo. ¿Cómo lo resolvés a distintas escalas?
Con pocos usuarios, resolvería el feed con un JOIN en tiempo de lectura entre `follows` y `posts` ordenado por fecha, simple y correcto. A escala, con usuarios que siguen a miles de cuentas, ese JOIN se vuelve costoso en cada carga del feed, así que cambiaría a un modelo de fan-out on write: al publicar un post, inserto una fila en una tabla `feed_items` por cada seguidor, precalculando el feed. Esto hace la lectura del feed casi instantánea (un solo SELECT sin JOIN pesado) a cambio de más trabajo de escritura por cada publicación, el tradeoff clásico entre optimizar lectura vs escritura, y depende del ratio real de lecturas vs publicaciones del producto.

### ¿Cuándo elegirías un documento (MongoDB) en vez de una tabla relacional para una entidad de tu sistema?
Cuando el esquema de esa entidad varía genuinamente entre registros, por ejemplo, atributos de producto que son completamente distintos según la categoría, forzar eso a columnas SQL fijas termina en muchas columnas NULL o en un patrón EAV incómodo de mantener y de indexar. También lo elegiría cuando el patrón de acceso predominante es leer o escribir el documento completo de una sola vez, sin necesidad de hacer joins ni queries parciales sobre sus campos internos, como el payload completo de un evento de analytics. Fuera de esos casos, prefiero relacional por las garantías de integridad y las capacidades de consulta que ofrece de forma nativa.

### Un JOIN entre `orders` y `order_items` para calcular el total de ventas del mes tarda demasiado en un dashboard. ¿Qué opciones considerás antes de tocar el schema?
Primero corro `EXPLAIN ANALYZE` para confirmar que el problema es realmente el JOIN y no la falta de un índice sobre las columnas de fecha o de FK. Si el índice ya existe y el volumen de datos es simplemente grande para agregación en tiempo real, evaluaría una tabla de resumen pre-agregada (por ejemplo `daily_sales_summary`) actualizada por un job periódico o un trigger, en vez de recalcular el total desde las tablas transaccionales en cada carga del dashboard. Solo tocaría el esquema transaccional (agregar una columna desnormalizada en `orders`) si el resumen pre-agregado no es aceptable por requisitos de tiempo real, porque prefiero mantener las tablas operacionales normalizadas y aislar la desnormalización a una capa de reporting separada.
