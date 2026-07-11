---
stack: python
id: python-data-orm
title: "Python: bases de datos, SQLAlchemy y diseño relacional"
area: Backend
priority: high
resourceLabel: SQLAlchemy, ORM Tutorial
resourceUrl: https://docs.sqlalchemy.org/en/20/orm/
---

## Summary
Cómo modelar, consultar y optimizar datos relacionales con SQLAlchemy 2.0: desde el problema N+1 hasta el diseño de índices y connection pooling.

## Concepts

### El problema N+1 y eager loading
#### Details
El N+1 es el error de rendimiento más común al usar un ORM, y también uno de los más frecuentes en entrevistas técnicas. Ocurre cuando cargás una lista de N objetos y luego accedés a una relación en cada uno: el ORM emite 1 query para la lista y N queries más, una por cada fila. Con 500 usuarios eso son 501 roundtrips a la base de datos.

La solución es el **eager loading**: indicarle a SQLAlchemy que traiga la relación en la misma consulta original, antes de que el código empiece a iterar. SQLAlchemy 2.0 ofrece dos estrategias principales. `selectinload` emite una segunda query `IN (...)` para cargar las relaciones en lote, ideal cuando la relación es de uno-a-muchos y querés minimizar filas duplicadas. `joinedload` usa un `JOIN` en la query original, mejor para relaciones muchos-a-uno o uno-a-uno donde la cardinalidad es baja.

En entrevista, la pregunta no es solo "¿sabés lo que es N+1?" sino "¿cómo lo detectás en producción?". Las herramientas clave son habilitar el logging de queries (`echo=True` en el engine o un event listener), usar SQLAlchemy `events` para contar queries por request, o integrar un profiler como `py-spy`. El segundo paso es confirmar que el eager loading funciona midiendo: no alcanza con mirar el código.

#### Examples
Código que produce el problema N+1
```python
from sqlalchemy.orm import Session

with Session(engine) as session:
    users = session.scalars(select(User)).all()
    for user in users:
        # Genera 1 query adicional por cada usuario, N+1
        print(user.posts)
```

Solución con `selectinload` (segunda query IN batch)
```python
from sqlalchemy.orm import selectinload
from sqlalchemy import select

with Session(engine) as session:
    users = session.scalars(
        select(User).options(selectinload(User.posts))
    ).all()
    for user in users:
        print(user.posts)  # ya cargado, 0 queries extra
```

Solución con `joinedload` para relación muchos-a-uno
```python
from sqlalchemy.orm import joinedload

with Session(engine) as session:
    posts = session.scalars(
        select(Post).options(joinedload(Post.author))
    ).all()
    # author ya está cargado via JOIN en la query original
```

#### Sources
- [SQLAlchemy, Relationship Loading Techniques](https://docs.sqlalchemy.org/en/20/orm/queryguide/relationships.html)
- [SQLAlchemy, selectinload](https://docs.sqlalchemy.org/en/20/orm/queryguide/relationships.html#select-in-loading)

### Diseño de índices y tradeoffs
#### Details
Un índice es una estructura de datos auxiliar (típicamente un B-tree) que permite al motor de base de datos encontrar filas sin escanear toda la tabla. La regla de oro es indexar las columnas que aparecen en cláusulas `WHERE`, `JOIN ON` y `ORDER BY` en queries frecuentes o de alto impacto. También son candidatas las foreign keys: sin índice en la FK, un `JOIN` entre tablas grandes puede resultar en un full sequential scan.

El costo que muchos candidatos olviden mencionar: **los índices ralentizan las escrituras**. Cada `INSERT`, `UPDATE` y `DELETE` debe actualizar todos los índices relevantes. En una tabla con muchas escrituras (event log, audit trail, mensajes) o con muchos índices compuestos, este overhead puede dominar el tiempo de respuesta. El tradeoff es siempre velocidad de lectura vs. costo de escritura, y es una decisión de diseño, no algo que se hace "por las dudas".

En SQLAlchemy definís índices declarativamente en el modelo con `Index` o el parámetro `index=True` en `Column`. Los índices compuestos tienen un orden: `Index('ix_user_country_created', User.country, User.created_at)` es útil para filtrar por `country` y opcionalmente por `created_at`, pero no para filtrar solo por `created_at`. Entender el "leftmost prefix rule" es lo que distingue a alguien que sabe usar índices de alguien que sabe qué son.

#### Examples
Índice simple en el modelo (columna muy filtrada)
```python
from sqlalchemy.orm import DeclarativeBase, mapped_column, Mapped
from sqlalchemy import String, Index

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    country: Mapped[str] = mapped_column(String(2))
    created_at: Mapped[datetime] = mapped_column()
```

Índice compuesto declarativo para queries multidimensionales
```python
class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        Index("ix_users_country_created", "country", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255))
    country: Mapped[str] = mapped_column(String(2))
    created_at: Mapped[datetime] = mapped_column()
```

Verificar que el planificador usa el índice (PostgreSQL)
```sql
EXPLAIN ANALYZE
SELECT id, email FROM users
WHERE country = 'AR' AND created_at > '2024-01-01';
-- Buscar "Index Scan" vs "Seq Scan" en el output
```

#### Sources
- [SQLAlchemy, Indexes](https://docs.sqlalchemy.org/en/20/core/constraints.html#indexes)
- [PostgreSQL, Indexes](https://www.postgresql.org/docs/current/indexes.html)

### Transacciones y el patrón Unit of Work
#### Details
SQLAlchemy maneja transacciones a través del objeto `Session`, que implementa el patrón **Unit of Work**: rastreás objetos Python, hacés cambios, y al final llamás `commit()` para que SQLAlchemy genere y envíe el SQL mínimo necesario. No vas armando queries a mano para cada operación, el Session "sabe" qué cambió.

La `Session` es un contexto de trabajo de vida corta. La práctica recomendada en SQLAlchemy 2.0 es usarla con un context manager (`with Session(engine) as session`) o con un gestor de dependencias (FastAPI, Flask). Una Session que dura más de un request HTTP introduce problemas graves: entidades que creen estar en el estado de hace varios requests, datos desactualizados (stale data), y transacciones que nunca cierran. Las Sessions no son thread-safe para uso concurrente: una por thread/task.

En cuanto al manejo de errores: si algo falla dentro de la transacción, llamás `rollback()` para deshacer todos los cambios pendientes. Con el context manager esto es automático ante una excepción. El concepto clave para entrevista es la **atomicidad**: un grupo de operaciones relacionadas (crear un pedido + descontar stock + registrar el movimiento) deben ocurrir todas o ninguna. Eso es exactamente para lo que sirve una transacción explícita.

#### Examples
Uso básico con context manager (Session auto-cierra y rollback en error)
```python
from sqlalchemy.orm import Session
from sqlalchemy import select

with Session(engine) as session:
    user = User(name="Ana García", email="ana@example.com")
    session.add(user)
    session.commit()
    # session.refresh(user)  # para acceder al id generado
    print(user.id)
```

Operación atómica: múltiples objetos en una sola transacción
```python
with Session(engine) as session:
    try:
        order = Order(user_id=user_id, total=250.00)
        session.add(order)

        item = session.get(InventoryItem, item_id)
        item.stock -= 1

        movement = StockMovement(item_id=item_id, delta=-1, order=order)
        session.add(movement)

        session.commit()  # todo junto o nada
    except Exception:
        session.rollback()
        raise
```

Leer con sesión de solo lectura (optimización para queries sin escritura)
```python
with Session(engine) as session:
    users = session.scalars(
        select(User).where(User.active == True)
    ).all()
    # No hay commit porque no hay cambios
```

#### Sources
- [SQLAlchemy, Session Basics](https://docs.sqlalchemy.org/en/20/orm/session_basics.html)
- [SQLAlchemy, Unit of Work](https://docs.sqlalchemy.org/en/20/glossary.html#term-unit-of-work)

### Joins y consultas eficientes
#### Details
La elección entre un `JOIN` y una subquery no es estética: tiene implicaciones directas en el plan de ejecución del motor. Un `JOIN` generalmente es más eficiente cuando el motor puede usar los índices de ambas tablas y hacer un hash join o merge join en un solo paso. Una subquery correlacionada (que referencia la query externa en cada fila) puede resultar en que el motor la ejecute una vez por fila de la tabla exterior, lo que es funcionalmente igual al problema N+1 pero a nivel SQL.

SQLAlchemy 2.0 construye joins con `select(...).join(...)`. Podés hacer inner join, left outer join, y join hacia relaciones declaradas en el modelo. La ventaja de usar las relaciones del modelo es que SQLAlchemy infiere la condición `ON` automáticamente desde la foreign key, reduciendo errores. Para aggregaciones complejas o queries analíticas, a veces conviene bajar a SQL textual con `text()` o una expresión Core en lugar de forzar el ORM.

Cuando vas a filtrar por el resultado de otra query, la decisión entre `EXISTS`, `IN (subquery)` y `JOIN` importa. `EXISTS` corta la evaluación en cuanto encuentra el primer match, es más eficiente que un `IN` cuando la subquery devuelve muchas filas. Los optimizadores modernos (PostgreSQL, MySQL 8+) suelen transformar `IN` en `EXISTS` automáticamente, pero conocer la distinción demuestra que entendés qué está pasando debajo.

#### Examples
Inner join entre modelos via relación declarada
```python
from sqlalchemy import select

# Traer posts con el nombre de su autor
stmt = (
    select(Post.title, User.name)
    .join(Post.author)  # usa la FK declarada en el modelo
    .where(Post.published == True)
    .order_by(Post.created_at.desc())
)
rows = session.execute(stmt).all()
```

Left outer join para incluir filas sin relación
```python
from sqlalchemy.orm import outerjoin

stmt = (
    select(User, Post)
    .outerjoin(User.posts)
    .where(User.active == True)
)
```

Subquery con EXISTS (más eficiente que IN cuando el subconjunto es grande)
```python
from sqlalchemy import exists, select

# Usuarios que tienen al menos un post publicado
has_post = exists(
    select(Post.id).where(Post.author_id == User.id, Post.published == True)
)
active_authors = session.scalars(select(User).where(has_post)).all()
```

#### Sources
- [SQLAlchemy, Join expressions](https://docs.sqlalchemy.org/en/20/orm/queryguide/select.html#joined-loading)
- [SQLAlchemy, EXISTS subquery](https://docs.sqlalchemy.org/en/20/core/selectable.html#sqlalchemy.sql.expression.exists)

### Connection Pooling
#### Details
Abrir una conexión a la base de datos es costoso: hay un handshake TCP, autenticación, y el motor asigna recursos del lado del servidor. Para una app con 50 requests concurrentes, abrir y cerrar una conexión por request es inaceptable. El **connection pool** mantiene un conjunto de conexiones abiertas y las presta a cada request cuando las necesita, devolviéndolas al pool al terminar.

SQLAlchemy incluye su propio pool por defecto al crear el `Engine`. El pool configurable más común es `QueuePool`, que mantiene un tamaño fijo de conexiones (`pool_size`) más un margen de sobrecarga (`max_overflow`). Si todas las conexiones están en uso y se excede `max_overflow`, las requests siguientes esperan hasta `pool_timeout` segundos antes de lanzar una excepción. Ajustar estos parámetros correctamente requiere conocer la cantidad de workers del servidor (Gunicorn, Uvicorn) y el límite de conexiones del motor de BD.

Un punto crítico en entornos serverless o con múltiples procesos: el pool vive **dentro del proceso**. Si usás forking (Gunicorn pre-fork), cada worker tiene su propio pool; no compartís conexiones entre procesos. En Lambda o Cloud Functions donde el proceso puede ser nuevo por cada invocación, el pool tiene menos valor, en esos entornos se recomienda un proxy externo como PgBouncer. También es importante habilitar `pool_pre_ping=True` para que SQLAlchemy verifique que la conexión sigue viva antes de usarla, evitando errores después de un timeout del servidor.

#### Examples
Configurar pool con parámetros explícitos
```python
from sqlalchemy import create_engine

engine = create_engine(
    "postgresql+psycopg2://user:pass@localhost/mydb",
    pool_size=10,        # conexiones permanentes
    max_overflow=20,     # conexiones extra bajo carga pico
    pool_timeout=30,     # segundos a esperar si el pool está lleno
    pool_pre_ping=True,  # verificar la conexión antes de usarla
)
```

Deshabilitar pool para scripts o entornos serverless
```python
from sqlalchemy.pool import NullPool

engine = create_engine(
    "postgresql+psycopg2://user:pass@localhost/mydb",
    poolclass=NullPool,  # abre y cierra una conexión por uso
)
```

#### Sources
- [SQLAlchemy, Connection Pooling](https://docs.sqlalchemy.org/en/20/core/pooling.html)
- [SQLAlchemy, Engine Configuration](https://docs.sqlalchemy.org/en/20/core/engines.html)

## Interview Questions

### Te dan una endpoint que tarda 8 segundos. Al revisar los logs ves 200+ queries para devolver una lista de 50 órdenes. ¿Cómo lo diagnosticás y solucionás?
Es un N+1 clásico. Lo primero que hago es confirmar el patrón en los logs SQL (`echo=True` o un event listener que cuente queries por request). Después identifico qué relación se está cargando lazy: si cada `Order` accede a `order.items` o `order.user`, ahí está el origen. La solución es agregar `selectinload` o `joinedload` en la query original de órdenes. Después de aplicar el fix, mido de nuevo: debería bajar a 1-2 queries para toda la lista.

### ¿Qué columnas indexarías en una tabla de `orders` con millones de filas, y qué tradeoff aceptás al hacerlo?
Indexaría `user_id` (FK para joins frecuentes), `status` si se filtra mucho por él (aunque tiene baja cardinalidad, vale la pena medir), y un índice compuesto `(user_id, created_at DESC)` para queries del estilo "últimas órdenes de un usuario". El tradeoff que acepto: cada `INSERT` y `UPDATE` de estado va a ser más lento porque el motor debe actualizar los índices. En una tabla con alta frecuencia de escritura agregaría solo los índices que los queries más críticos necesitan, verificando con `EXPLAIN ANALYZE` que realmente se usan.

### ¿Cuándo usarías un `JOIN` vs una subquery con `EXISTS`? ¿Es lo mismo para el planificador?
Los uso como herramientas distintas. `JOIN` lo elijo cuando necesito columnas de ambas tablas en el resultado o cuando el motor puede hacer un hash join eficiente con ambos índices. `EXISTS` lo elijo cuando solo necesito verificar si hay al menos un match, corta la evaluación al primer resultado, a diferencia de `IN` que puede materializar toda la subquery. En la práctica, optimizadores modernos como PostgreSQL suelen transformar `IN` en `EXISTS` automáticamente, pero conocer la distinción te permite escribir la intención correcta y entender el `EXPLAIN`.

### ¿Qué problemas introduce una SQLAlchemy Session de vida larga (por ejemplo, que dure todo el ciclo de vida de la app)?
Una Session de vida larga acumula objetos en su identity map sin liberarlos, eso es un memory leak progresivo. Además, los objetos quedan "stale": la Session cree que su estado coincide con la base de datos, pero otros procesos pueden haber modificado esas filas. También bloquea la conexión o mantiene la transacción abierta más tiempo del necesario. La práctica correcta es una Session por request (en web apps) o por operación atómica, siempre usando un context manager para garantizar el cierre.

### ¿Cómo diseñarías el esquema relacional para un sistema de reservas donde un turno puede pertenecer a varios proveedores de servicio?
Usaría una tabla de join `appointment_providers(appointment_id, provider_id, role)` para la relación muchos-a-muchos, con índices en ambas FK. La tabla `appointments` tendría índice compuesto en `(provider_id, starts_at)` para las queries de agenda. Si los proveedores tienen horarios disponibles, agregaría una tabla `availability(provider_id, day_of_week, start_time, end_time)` separada del turno en sí. El punto clave del diseño es separar "disponibilidad planificada" de "turno confirmado", son conceptos distintos aunque relacionados.

### ¿Cuándo tiene sentido usar `NullPool` en lugar del pool por defecto de SQLAlchemy?
En entornos donde el proceso no tiene estado persistente entre invocaciones: funciones Lambda, Cloud Run jobs, scripts one-shot. El pool por defecto asume que el proceso vive tiempo suficiente para amortizar el costo de abrir conexiones, en un Lambda que dura 200ms, mantener un pool de 10 conexiones abiertas es desperdicio de recursos del servidor de base de datos y puede agotar el límite de conexiones del motor rápidamente. `NullPool` abre y cierra una conexión por uso, que en ese contexto es el comportamiento correcto. Para producción con un servidor de larga duración, siempre prefiero el pool estándar con `pool_pre_ping=True`.
