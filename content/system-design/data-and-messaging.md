---
stack: system-design
id: system-design-data-and-messaging
title: Datos y Mensajería a Escala
area: Arquitectura
priority: high
resourceLabel: PostgreSQL, High Availability, Load Balancing, and Replication
resourceUrl: https://www.postgresql.org/docs/current/high-availability.html
---

## Summary
Cómo escalar el almacenamiento de datos y desacoplar componentes con mensajería, con foco en las decisiones de sistema (no en sintaxis de queries, que ya cubre el stack SQL).

## Concepts

### Escalado de bases de datos: réplicas de lectura vs sharding
#### Details
Cuando una sola base de datos no da abasto, hay dos caminos distintos que resuelven problemas distintos. Agregar réplicas de lectura resuelve un problema de volumen de lecturas: el primary sigue recibiendo todas las escrituras, pero las lecturas se reparten entre N réplicas que reciben los cambios por replicación. Es la solución correcta cuando el sistema es read-heavy (típico en la mayoría de apps web) y el dataset todavía entra cómodo en un solo nodo de escritura.

Sharding resuelve un problema distinto: cuando el volumen de ESCRITURA o el tamaño total del dataset ya no entra en un solo nodo, no importa cuántas réplicas de lectura agregues. Sharding parte los datos horizontalmente entre varios nodos independientes según una shard key (por ejemplo, `user_id % N` o un rango), de forma que cada nodo solo tiene una porción de las escrituras y del dataset. El costo es mucho mayor complejidad operativa: queries que cruzan shards (joins, agregaciones globales) se vuelven caras o imposibles sin una capa extra, y resharding (cuando hay que cambiar el número de shards) es una migración de datos en producción.

La consecuencia de las réplicas de lectura que más se pregunta en entrevistas es el replication lag: como la replicación es asíncrona en la mayoría de los motores, hay una ventana de tiempo donde una réplica todavía no tiene el último write. Si un usuario escribe y en el mismo segundo lee desde una réplica, puede no ver su propio cambio ("read-your-writes" roto). Las mitigaciones típicas son leer del primary inmediatamente después de escribir (para ese usuario puntual), usar réplicas síncronas para datos críticos, o diseñar la UI para tolerar esa demora.

#### Examples
Réplicas de lectura: arquitectura
```txt
        writes                 reads (repartidas)
Client -------> [Primary] --replica--> [Replica 1]
                    |     --replica--> [Replica 2]
                    |     --replica--> [Replica 3]
                (única fuente de verdad para escritura)
```

Sharding por rango de user_id
```txt
Shard A: user_id 0        - 999999    (nodo independiente)
Shard B: user_id 1000000  - 1999999   (nodo independiente)
Shard C: user_id 2000000  - 2999999   (nodo independiente)

Query "dame los últimos 10 usuarios activos globalmente" 
  -> requiere consultar las 3 shards y mergear (fan-out), ya no es un solo SELECT.
```

Replication lag rompiendo read-your-writes
```txt
t0: Client escribe "nombre = Juan" -> Primary confirma.
t0 + 50ms: Client lee su perfil -> cae en Replica 2, que todavía tiene "nombre = Ana".
Mitigación: leer del primary por un ratito post-write, o marcar la sesión
como "sticky al primary" durante N segundos tras un write.
```

#### Sources
- [PostgreSQL docs, High Availability, Load Balancing, and Replication](https://www.postgresql.org/docs/current/high-availability.html)
- [AWS Architecture Center, Database](https://aws.amazon.com/architecture/)
- [system-design-primer, Sharding](https://github.com/donnemartin/system-design-primer#sharding)

### SQL vs NoSQL como decisión de sistema
#### Details
Esto no es una comparación de sintaxis (eso ya está cubierto en el stack de SQL); acá la pregunta es cuándo el modelo relacional es la elección correcta a nivel de sistema y cuándo no. SQL brilla cuando las relaciones entre entidades importan de verdad (un pedido tiene ítems, un ítem referencia un producto, todo necesita integridad referencial) y cuando necesitás transacciones ACID que abarquen múltiples tablas: mover dinero entre dos cuentas, reservar un asiento y cobrar en la misma operación. El motor te da consistencia fuerte "gratis" a cambio de que escalar horizontalmente la escritura sea difícil (ver sharding arriba).

NoSQL (documentales como MongoDB, key-value como DynamoDB/Redis, wide-column como Cassandra) tiende a ganar cuando el patrón de acceso es simple y predecible desde el diseño (buscar por una key, o por un partition key + sort key), el volumen de escritura es tan alto que necesitás particionar desde el día uno, y podés vivir con eventual consistency o modelar la desnormalización a propósito (guardar datos duplicados para evitar joins). El costo es que cambiar el patrón de acceso después es doloroso: en Postgres podés agregar un índice nuevo y seguir andando, en un key-value store diseñado para un acceso específico, un patrón de consulta nuevo puede requerir rediseñar el modelo de datos entero.

La señal de entrevistador senior es justamente esta: no preguntan "SQL o NoSQL" para ver si sabés la definición, preguntan para ver si podés mapear el patrón de acceso y las garantías de consistencia que el dominio necesita a la tecnología correcta, y si podés admitir un modelo híbrido (Postgres para el core transaccional, Redis para sesiones/cache, Elasticsearch para búsqueda full-text) en vez de forzar todo a una sola base.

#### Examples
Cuándo SQL gana
```txt
- Pedido -> Ítems -> Producto -> Inventario, todo tiene que ser consistente
  en la misma transacción (reservar stock + crear pedido + cobrar).
- Reportes ad-hoc con joins y agregaciones que no se pueden predecir de antemano.
```

Cuándo NoSQL gana
```txt
- Feed de actividad de un usuario: partition key = user_id, acceso siempre
  "dame las últimas N actividades de este usuario". Escritura masiva, sin joins.
- Sesiones / carrito temporal: key-value simple, TTL nativo, sin necesidad
  de relaciones.
```

Arquitectura híbrida real
```txt
Postgres      -> core transaccional (pedidos, pagos, inventario)
Redis         -> sesiones, cache, rate limiting
Elasticsearch -> búsqueda full-text de productos
S3            -> archivos e imágenes
```

#### Sources
- [AWS Architecture Center, Databases](https://aws.amazon.com/architecture/)
- [Google Cloud Architecture Center, Databases](https://cloud.google.com/architecture)
- [PostgreSQL docs](https://www.postgresql.org/docs/current/index.html)
- [system-design-primer, SQL vs NoSQL](https://github.com/donnemartin/system-design-primer#sql-or-nosql)

### Colas de mensajes y procesamiento asíncrono
#### Details
Una cola de mensajes desacopla al productor (quien genera el trabajo) del consumidor (quien lo procesa), de forma que el productor no tiene que esperar a que el trabajo termine para responder. El caso de uso típico: un usuario sube un video, la API responde "recibido" inmediatamente y encola un job de transcodificación; un worker separado lo procesa cuando puede. Esto mejora la percepción de latencia, amortigua picos de tráfico (la cola absorbe el burst mientras los workers procesan a su ritmo) y permite escalar productores y consumidores de forma independiente.

La garantía de entrega es una decisión de diseño explícita, no un detalle de implementación. At-least-once significa que un mensaje puede entregarse más de una vez (por reintentos ante fallas de red o de ack), así que el consumidor tiene que ser idempotente: procesar el mismo mensaje dos veces no debe duplicar el efecto (por ejemplo, chequear un ID de operación ya procesado antes de aplicar el cambio). Exactly-once es mucho más difícil de garantizar de punta a punta en sistemas distribuidos reales (usualmente se logra combinando at-least-once + deduplicación idempotente en el consumidor, no como propiedad nativa gratis del broker) y hay que ser honesto en la entrevista sobre esa limitación en vez de prometerla como si fuera trivial.

Cuándo reach for a queue vs una llamada síncrona: si el caller necesita el resultado inmediato para continuar (validar una tarjeta de crédito antes de confirmar la compra), una llamada síncrona (HTTP/RPC) es lo correcto. Si el trabajo es de larga duración, puede fallar y reintentarse sin bloquear al usuario, o necesita fan-out a múltiples consumidores (un evento "pedido creado" que dispara email, analytics y actualización de inventario), una cola o un bus de eventos es la elección correcta.

#### Examples
Desacople productor/consumidor
```txt
Sync (mal para trabajo largo):
  Client -> API -> [procesa transcodificación, 3 min] -> Response
  (el usuario espera 3 minutos con la conexión abierta)

Async con cola:
  Client -> API -> encola job -> Response inmediata "en proceso"
                        |
                        v
                   [Worker] procesa cuando puede, actualiza estado
```

Idempotencia ante at-least-once delivery
```txt
function processPayment(message):
  if paymentAlreadyProcessed(message.idempotencyKey):
      return  // ya se aplicó, ignorar duplicado
  charge(message.amount)
  markProcessed(message.idempotencyKey)
```

Cuándo cola vs llamada síncrona
```txt
Síncrono:  validar stock antes de confirmar compra (el caller necesita
           la respuesta YA para decidir el siguiente paso).
Cola:      enviar email de confirmación, generar factura PDF, actualizar
           analytics (el caller no necesita esperar, y puede reintentarse).
```

#### Sources
- [AWS Architecture Center, Messaging](https://aws.amazon.com/architecture/)
- [Google Cloud Architecture Center, Event-driven architectures](https://cloud.google.com/architecture)
- [system-design-primer, Asynchronism](https://github.com/donnemartin/system-design-primer#asynchronism)

### Replicación de bases de datos: leader-follower
#### Details
La replicación leader-follower (también llamada primary-replica) es la base sobre la que se construyen las réplicas de lectura: un nodo leader recibe todas las escrituras y las propaga a uno o más followers, que aplican los mismos cambios en el mismo orden. La replicación puede ser síncrona (el leader espera confirmación del follower antes de dar el write por exitoso, garantizando que el follower está al día pero agregando latencia y un punto de fragilidad si el follower se cae) o asíncrona (el leader confirma el write sin esperar al follower, más rápido pero con la ventana de replication lag ya descripta).

Las consecuencias prácticas del replication lag van más allá de "los datos tardan en llegar". Si un follower se promueve a leader durante un failover y todavía no había recibido los últimos writes del leader anterior, esos writes se pierden (a menos que el mecanismo de failover los recupere de un write-ahead log). También puede producir lecturas "hacia atrás en el tiempo": un usuario ve un dato, refresca, y ve una versión más vieja porque el segundo request cayó en un follower más atrasado que el primero.

En una entrevista, mostrar que entendés esto significa poder decir explícitamente qué tipo de replicación elegirías según el dominio: síncrona (o quorum, como en sistemas multi-nodo) para datos donde perder un write en un failover es inaceptable, asíncrona cuando la disponibilidad y la latencia de escritura importan más que la garantía absoluta de no perder el último write en el peor caso.

#### Examples
Síncrona vs asíncrona
```txt
Síncrona:  Leader -> espera ACK del follower -> confirma write al cliente.
           Sin pérdida de datos en failover, pero mayor latencia de escritura.

Asíncrona: Leader -> confirma write al cliente -> propaga al follower después.
           Menor latencia, pero riesgo de perder el último write si el
           leader cae antes de propagar.
```

Failover con pérdida de datos por lag
```txt
t0: Leader confirma write W100 al cliente (asíncrono).
t1: Leader cae antes de propagar W100 al follower.
t2: Follower se promueve a nuevo leader, pero solo tiene hasta W99.
    -> W100 se perdió para el sistema, aunque el cliente recibió éxito.
```

#### Sources
- [PostgreSQL docs, High Availability, Load Balancing, and Replication](https://www.postgresql.org/docs/current/high-availability.html)
- [AWS Architecture Center, Database](https://aws.amazon.com/architecture/)
- [system-design-primer, Replication](https://github.com/donnemartin/system-design-primer#database)

## Interview Questions

### Tu app es 95% lecturas y empezó a saturar la base. ¿Agregarías réplicas de lectura o shardearías?
Primero confirmaría si el cuello de botella es de lectura o de escritura, y el tamaño total del dataset. Con 95% lecturas y un dataset que todavía entra en un nodo de escritura, agregaría réplicas de lectura: resuelve exactamente ese problema con mucha menos complejidad operativa que sharding. Reservaría sharding para el día en que el volumen de ESCRITURA o el tamaño del dataset dejen de entrar en un solo primary, porque sharding trae joins cross-shard y resharding como costos permanentes.

### Elegís entre Postgres y un key-value store para el catálogo de sesiones de usuarios activos. ¿Cómo decidís?
El patrón de acceso a sesiones es casi siempre "dame la sesión por su ID" o "expirá esta sesión en X minutos", sin necesidad de joins ni queries relacionales complejas. Eso apunta directo a un key-value store como Redis: acceso O(1) por key, TTL nativo para expiración, y no pago el costo de un motor relacional para un patrón de acceso tan simple. Usaría Postgres si además necesitara reportes relacionales sobre esas sesiones, algo que normalmente no es el caso.

### Diseñá el flujo de "usuario sube un video y el sistema lo procesa" sin bloquear al usuario.
Clarificaría el tiempo esperado de procesamiento y si el usuario necesita feedback de progreso. Con procesamiento de varios minutos, la API respondería inmediatamente tras guardar el archivo y encolar un job de transcodificación, devolviendo un ID de trabajo. Un pool de workers consumiría la cola, procesaría el video y actualizaría el estado (por ejemplo, en la base o notificando por websocket). El trade-off a mencionar es la garantía de entrega: si el worker falla a mitad de proceso, necesito que el mensaje se reintente (at-least-once) y que el procesamiento sea idempotente para no duplicar el archivo final.

### ¿Cómo asegurás que un consumidor de cola no duplique un efecto si el broker entrega el mismo mensaje dos veces?
Asumiendo entrega at-least-once, que es lo más realista en sistemas distribuidos, diseñaría el consumidor para ser idempotente: cada mensaje llevaría una idempotency key, y antes de aplicar el efecto el consumidor verificaría si esa key ya fue procesada (por ejemplo, en una tabla o cache con esa key como índice único). Si ya se procesó, el consumidor descarta el mensaje duplicado sin reaplicar el efecto. No intentaría prometer exactly-once nativo del broker, porque en la práctica es mucho más frágil que construir idempotencia explícita en la aplicación.

### Un usuario escribe su perfil y al refrescar la página ve la versión vieja. ¿Qué está pasando y cómo lo resolverías?
Es un síntoma clásico de replication lag: el write fue al primary, pero el read posterior cayó en una réplica que todavía no recibió ese cambio. Lo resolvería de una de dos formas según el costo aceptable: leer del primary durante una ventana corta después de que ese usuario escribe (sticky read post-write), o, si el dominio lo permite, aceptar la demora y comunicarla en la UI ("guardado, puede tardar unos segundos en reflejarse"). Elegiría según qué tan crítico sea para el negocio que el usuario vea su propio cambio al instante.

### ¿Por qué "vamos a usar NoSQL porque escala mejor" es una respuesta débil en una entrevista de diseño?
Porque escalar no es una propiedad exclusiva de NoSQL: Postgres también escala con réplicas de lectura y sharding, solo que con más fricción en la escritura distribuida. La respuesta fuerte conecta la elección con el patrón de acceso real (¿necesito joins y transacciones multi-tabla, o accesos simples por key?) y con la consistencia que el dominio tolera (¿puedo vivir con eventual consistency o necesito ACID?). Sin esa justificación, "NoSQL escala mejor" es una frase de marketing, no una decisión de arquitectura.
