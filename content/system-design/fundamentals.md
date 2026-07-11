---
stack: system-design
id: system-design-fundamentals
title: Fundamentos de System Design
area: Arquitectura
priority: high
resourceLabel: AWS Well-Architected Framework
resourceUrl: https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html
---

## Summary
Los bloques base de cualquier diseño de sistema: cómo escalar, cómo repartir tráfico, cómo cachear y qué trade-off real estás aceptando al elegir una base de datos.

## Concepts

### Escalado vertical vs horizontal
#### Details
Escalar vertical es agrandar la máquina: más CPU, más RAM, discos más rápidos. Es la opción más simple porque no cambia la arquitectura de la aplicación, pero tiene techo físico (hay un límite de instancia más grande disponible) y sigue siendo un punto único de falla. Escalar horizontal es agregar más instancias y repartir la carga entre ellas; no tiene techo práctico, pero exige que la aplicación pueda correr en paralelo sin pisarse.

Ahí aparece la distinción entre servicios stateless y stateful. Un servicio stateless no guarda información de sesión ni estado de negocio en la instancia misma: cualquier request puede ser atendido por cualquier réplica, porque el estado vive afuera (una base de datos, una cache compartida, un token firmado). Eso es lo que hace posible escalar horizontal sin dolor. Un servicio stateful (por ejemplo, un servidor que guarda sesiones en memoria local) rompe esa propiedad: si el balanceador manda al usuario a otra instancia, pierde su sesión, a menos que uses sticky sessions, que a su vez reintroducen desbalanceo y puntos de falla.

En una entrevista, la señal fuerte no es "sé qué es escalar horizontal", sino identificar QUÉ estado tiene tu sistema y DÓNDE vive. AWS Well-Architected lo llama "diseñar para fallar" y "desacoplar componentes": si sacás el estado de la instancia de cómputo, podés destruir y recrear esa instancia sin que le importe a nadie, que es la base de todo el escalado horizontal, auto-scaling y despliegues sin downtime.

#### Examples
Vertical vs horizontal, en números
```txt
Vertical: 1 servidor de 4 CPU / 16GB -> 1 servidor de 32 CPU / 128GB
  + simple, sin cambios de código
  - techo físico, sigue siendo un solo punto de falla, downtime al migrar

Horizontal: 1 servidor de 4 CPU/16GB -> 10 servidores de 4 CPU/16GB detrás de un LB
  + escala casi sin techo, tolera la caída de una instancia
  - requiere balanceo, estado externo, coordinación (deploys, health checks)
```

Stateless vs stateful, mismo endpoint
```txt
Stateful (mal para escalar horizontal):
  Login guarda session[id] en memoria del proceso Node.
  Si el LB manda el siguiente request a otra instancia -> "no autenticado".

Stateless (listo para escalar horizontal):
  Login emite un JWT firmado, o guarda la sesión en Redis compartido.
  Cualquier instancia puede validar el JWT / leer Redis -> el LB reparte libre.
```

#### Sources
- [AWS Well-Architected Framework, Reliability pillar](https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html)
- [Google Cloud Architecture Center, Scalability](https://cloud.google.com/architecture)
- [system-design-primer, Horizontal vs vertical scaling](https://github.com/donnemartin/system-design-primer)

### Balanceo de carga
#### Details
Un load balancer reparte requests entrantes entre varias instancias del mismo servicio para que ninguna quede sobrecargada y para poder sacar instancias de circulación (deploy, falla, mantenimiento) sin cortar el servicio. La elección del algoritmo importa: round robin reparte en orden fijo y es simple pero ignora la carga real de cada instancia; least connections manda tráfico a la instancia con menos conexiones activas, mejor cuando las requests tienen duración muy variable; consistent hashing asigna cada key (por ejemplo, un `user_id` o una key de cache) siempre a la misma instancia, minimizando el remapeo cuando agregás o sacás nodos, algo clave para caches distribuidas o sharding.

La otra distinción central es capa 4 (transporte) vs capa 7 (aplicación). Un balanceador L4 opera sobre IP/puerto/TCP, es muy rápido porque no mira el contenido del request, pero no puede tomar decisiones basadas en la URL, headers o cookies. Un balanceador L7 entiende HTTP: puede rutear `/api/*` a un servicio y `/static/*` a otro, hacer terminación TLS, inspeccionar headers para sticky sessions o canary releases. El costo es más CPU por request porque hay que parsear el protocolo de aplicación.

En una entrevista de diseño, mencionar solo "pongo un load balancer" no alcanza; la señal senior es justificar el algoritmo según el patrón de tráfico (¿las requests son uniformes o muy dispares en duración?) y la capa según si necesitás routing inteligente o solo throughput crudo.

#### Examples
Comparación de algoritmos
```txt
Round robin:        A -> B -> C -> A -> B -> C ...
                     Simple, no considera carga real de cada nodo.

Least connections:  manda al nodo con menos conexiones abiertas ahora mismo.
                     Mejor si las requests tardan tiempos muy distintos.

Consistent hashing: hash(key) mapea siempre al mismo nodo (con wrap-around).
                     Agregar/sacar un nodo solo remapea ~1/N de las keys,
                     no todas. Clave para caches distribuidas y sharding.
```

L4 vs L7
```txt
L4 (transporte): decide por IP:puerto/TCP. No ve HTTP. Rápido, "dumb pipe".
L7 (aplicación):  decide por path, headers, cookies. Puede hacer TLS termination,
                  rate limiting por ruta, canary por header. Más costo de CPU.
```

#### Sources
- [AWS Architecture Center, Load balancing](https://aws.amazon.com/architecture/)
- [Google Cloud Architecture Center, Load balancing](https://cloud.google.com/architecture)
- [MDN, HTTP overview](https://developer.mozilla.org/en-US/docs/Web/HTTP)
- [system-design-primer, Load balancer](https://github.com/donnemartin/system-design-primer#load-balancer)

### Estrategias de caching
#### Details
Cachear sirve para evitar recalcular o releer datos caros. Cache-aside (lazy loading) es el patrón más común: la aplicación primero consulta la cache, si no está (miss) lee la base de datos y escribe el resultado en cache antes de responder. Es simple y solo cachea lo que realmente se pide, pero deja una ventana donde la cache puede quedar desactualizada si otro proceso escribe directo en la base. Write-through escribe simultáneamente en cache y base en cada write, así la cache nunca queda stale, a costo de mayor latencia de escritura. Write-behind (write-back) escribe primero en cache y de forma asíncrona persiste en la base, dando escrituras muy rápidas pero con riesgo de pérdida de datos si la cache cae antes de persistir.

Tan importante como el patrón de escritura es la política de expiración. Un TTL (time to live) fuerza a que un dato caché se invalide después de X tiempo, evitando que quede stale para siempre, pero elegir mal el TTL es un trade-off directo entre frescura y hit rate. Cuando la cache se llena, hace falta una política de eviction: LRU (least recently used) descarta lo que no se usó hace más tiempo, asumiendo que el acceso reciente predice acceso futuro; existen variantes como LFU (least frequently used) para patrones distintos de acceso.

Dónde se ubica la cache en el request path también es una decisión de diseño: puede vivir en el cliente (HTTP cache-control, ver MDN), en un CDN cerca del usuario, en una capa dedicada como Redis entre la app y la base, o dentro del proceso de la aplicación (in-memory, más rápida pero no compartida entre instancias). La señal de entrevista es explicar qué se invalida, cuándo, y qué pasa si la cache y la fuente de verdad divergen.

#### Examples
Cache-aside en pseudocódigo
```txt
function getUser(id):
  user = cache.get(id)
  if user is null:
    user = db.query("SELECT * FROM users WHERE id = ?", id)
    cache.set(id, user, ttl=300)
  return user
```

Write-through vs write-behind
```txt
Write-through:
  app.write(data) -> cache.set(data) + db.write(data)  (sincrónico, ambos)
  Consistencia alta, escritura más lenta.

Write-behind:
  app.write(data) -> cache.set(data) -> (async, en background) db.write(data)
  Escritura rápida, riesgo de perder datos si la cache cae antes del flush.
```

Dónde vive la cache en el request path
```txt
Cliente (browser cache, Cache-Control) 
  -> CDN (assets estáticos, respuestas cacheables por URL)
    -> Load balancer / API gateway
      -> App server (cache in-memory, no compartida entre instancias)
        -> Cache distribuida (Redis) 
          -> Base de datos (fuente de verdad)
```

#### Sources
- [Redis docs, Caching patterns](https://redis.io/docs/latest/develop/use/patterns/)
- [MDN, HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [AWS Architecture Center, Caching](https://aws.amazon.com/architecture/)
- [system-design-primer, Cache](https://github.com/donnemartin/system-design-primer#cache)

### CAP theorem en la práctica
#### Details
El teorema CAP dice que ante una partición de red (P), un sistema distribuido tiene que elegir entre consistencia (C, todos los nodos ven el mismo dato al mismo tiempo) y disponibilidad (A, cada request recibe una respuesta, aunque no sea la más reciente). La partición no es opcional: en un sistema distribuido real, la red SIEMPRE puede partirse (paquetes perdidos, latencia, nodos caídos), así que en la práctica la pregunta no es "elijo P" sino "qué hago CUANDO ocurre una partición: rechazo requests para no dar datos viejos (CP), o respondo igual aceptando posible inconsistencia (AP)".

Esto se traduce directo en la elección de base de datos. Postgres/MySQL en configuración tradicional con un único primary priorizan consistencia: si el primary no puede confirmar con sus réplicas (o directamente cae), preferís negar la escritura antes que servir datos inconsistentes. Sistemas como Cassandra o DynamoDB priorizan disponibilidad: siguen aceptando lecturas/escrituras durante una partición, resolviendo conflictos después (last-write-wins, vector clocks, reconciliación en la app). Ninguna de las dos es "mejor": para un carrito de compras, mejor disponibilidad con eventual consistency que negar la venta; para un balance bancario, consistencia fuerte casi siempre gana.

La señal senior en una entrevista es no repetir el triángulo de memoria, sino conectar la decisión con el dominio: "acá elijo eventual consistency porque el costo de negocio de mostrarte un like desactualizado es cero, pero para el saldo de tu cuenta necesito consistencia fuerte aunque eso implique más latencia o rechazar writes durante una partición".

#### Examples
CAP como decisión de negocio, no de trivia
```txt
Escenario: carrito de compras en e-commerce
  Prioridad: disponibilidad (AP). Mejor mostrar el carrito con datos
  levemente desactualizados que bloquear la compra.

Escenario: saldo de cuenta bancaria / inventario de stock exacto
  Prioridad: consistencia (CP). Preferible rechazar una operación
  a mostrar/permitir un saldo o stock incorrecto.
```

Bases de datos y su sesgo típico bajo partición
```txt
PostgreSQL / MySQL (single primary):  CP  (rechaza escritura si no hay quorum/primary)
DynamoDB / Cassandra (multi-leader):  AP  (acepta escritura, reconcilia después)
```

#### Sources
- [AWS Well-Architected Framework, Reliability pillar](https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html)
- [Google Cloud Architecture Center](https://cloud.google.com/architecture)
- [system-design-primer, CAP theorem](https://github.com/donnemartin/system-design-primer#cap-theorem)

## Interview Questions

### Diseñá un acortador de URLs que soporte alta tasa de lectura (redirects) con baja latencia. ¿Cómo escalarías la capa de lectura?
Primero aclararía volumen esperado (lecturas vs escrituras, ¿cuántos redirects por segundo?) y si necesitamos analytics en tiempo real. Estimando que las lecturas superan escrituras por varios órdenes de magnitud, diseñaría servicio stateless de redirect detrás de un load balancer L7, con una cache (Redis, con TTL y LRU) delante de la base para servir los códigos más consultados sin tocar disco. Escalaría horizontalmente la capa de redirect agregando réplicas sin estado, y usaría CDN/edge cache para los códigos más populares. El trade-off que expondría es cache-aside vs invalidación: si permitimos actualizar el destino de una URL, hay que decidir TTL corto o invalidación activa al escribir.

### Tu servicio empieza a tener picos de latencia bajo carga. Antes de escalar horizontal, ¿qué mirarías?
Primero confirmaría si el servicio es realmente stateless, porque escalar horizontal un servicio con estado en memoria solo mueve el problema. Después revisaría si el cuello de botella es CPU, I/O o la base de datos: agregar más instancias de app no ayuda si todas pegan contra la misma base saturada. Si el cuello es la base, evaluaría caching antes de escalar cómputo, porque suele ser más barato y rápido de implementar que sumar instancias.

### ¿Cuándo elegirías round robin vs consistent hashing para tu load balancer?
Round robin cuando las requests son razonablemente uniformes en costo y no necesito afinidad entre cliente y servidor. Consistent hashing cuando el balanceador está repartiendo tráfico hacia nodos que mantienen estado local relevante (por ejemplo, shards de una cache distribuida), porque minimiza el remapeo de keys cuando escalo o cae un nodo, evitando un cache storm.

### Te piden cachear el perfil de usuario de una red social. ¿Qué patrón de caching usarías y por qué?
Usaría cache-aside con TTL corto, porque el perfil se lee mucho más de lo que se escribe y una inconsistencia de unos segundos es tolerable para este dominio. Si el perfil se actualiza desde múltiples fuentes (app, admin, integraciones), agregaría invalidación activa (borrar la key en cache al escribir) en vez de confiar solo en el TTL, para no mostrar datos obviamente viejos. Elegiría LRU como política de eviction porque el acceso a perfiles sigue un patrón de popularidad razonable.

### Te dicen que elijas entre Postgres y DynamoDB para el catálogo de productos de un e-commerce con tráfico global. ¿Cómo decidís?
Preguntaría primero por el patrón de acceso: si necesito queries relacionales complejas, transacciones fuertes entre tablas y el volumen de escritura cabe en un primary con réplicas, Postgres da consistencia fuerte y un modelo de datos más flexible para reportes. Si la escala de escritura es masiva y distribuida globalmente y puedo modelar el acceso por clave/partición desde el inicio, DynamoDB da disponibilidad y escala horizontal casi sin límite a costo de eventual consistency y un modelo de datos más rígido. La decisión depende de si el dominio tolera eventual consistency, no de cuál tecnología es "mejor".

### ¿Por qué escalar horizontal un servicio que guarda sesiones en memoria del proceso no funciona bien?
Porque el balanceador de carga no sabe (ni debería saber) a qué instancia fue la request anterior de ese usuario; sin sticky sessions, la siguiente request puede caer en una instancia que nunca vio esa sesión, y el usuario aparece "deslogueado". La solución real es sacar el estado de sesión de la instancia (JWT firmado o store compartido como Redis) para que cualquier réplica pueda atender cualquier request, que es la definición misma de servicio stateless.
