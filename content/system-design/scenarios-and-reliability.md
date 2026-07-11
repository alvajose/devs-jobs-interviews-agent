---
stack: system-design
id: system-design-scenarios-and-reliability
title: Escenarios de Diseño y Confiabilidad
area: Arquitectura
priority: medium
resourceLabel: Google Cloud Architecture Center, Reliability
resourceUrl: https://cloud.google.com/architecture
---

## Summary
Un escenario clásico resuelto de punta a punta, diseño de APIs a escala, y los patrones de confiabilidad que evitan que una falla pequeña se convierta en una caída total.

## Concepts

### Escenario completo: diseñar un acortador de URLs
#### Details
Este es el ejercicio clásico para mostrar el flujo completo clarify -> estimate -> design -> tradeoffs. Clarificar primero: ¿cuántas URLs se crean por día?, ¿cuál es el ratio lectura/escritura?, ¿las URLs pueden expirar o el usuario puede elegir un alias custom?, ¿necesitamos analytics de clicks? Sin estas respuestas cualquier diseño es una adivinanza.

Estimar con números redondos: si esperamos 100 millones de URLs nuevas por mes, eso es ~40 escrituras por segundo en promedio (con picos más altos). Si el ratio lectura/escritura es 100:1, típico en este tipo de servicio, eso son ~4000 lecturas por segundo. Guardando cada registro en ~500 bytes, 100M URLs/mes durante 5 años son ~30TB, un volumen que entra cómodo en una base relacional con buen particionamiento, sin necesitar sharding desde el día uno.

Diseñar: un servicio de escritura recibe la URL larga, genera un código corto (hash truncado de la URL + contador, o un contador global codificado en base62 para evitar colisiones) y lo guarda. Un servicio de lectura, separado y stateless, resuelve el código corto contra una cache (Redis, porque el 99% de las lecturas caen sobre un subconjunto pequeño de URLs populares) y solo cae a la base en cache miss. Los trade-offs a exponer: base62 con contador global da códigos más cortos pero requiere coordinar el contador (o particionarlo por rango entre workers); hash truncado evita coordinación central pero necesita manejar colisiones. Para lecturas, el trade-off es cache-aside con TTL vs invalidación activa si permitimos que una URL corta cambie de destino.

#### Examples
Clarify -> estimate -> design -> tradeoffs, aplicado
```txt
1. Clarify: ¿volumen esperado? ¿alias custom? ¿expiración? ¿analytics de clicks?
2. Estimate: 100M URLs/mes -> ~40 writes/s, ratio 100:1 -> ~4000 reads/s,
   ~30TB en 5 años (~500 bytes/registro).
3. Design: write service (genera código) -> DB.
             read service (stateless) -> cache -> DB en miss.
4. Tradeoffs: contador global (códigos cortos, requiere coordinación) vs
   hash truncado (sin coordinación, requiere manejar colisiones).
```

Generación de código corto: dos enfoques
```txt
Contador global + base62:
  id = next_id()               // 1, 2, 3, ...
  code = to_base62(id)         // "b", "c", "1a", ...
  + código muy corto y predecible en longitud
  - requiere un contador coordinado (o particionado por rango entre workers)

Hash truncado:
  code = md5(long_url)[0:7]
  + sin coordinación central, cualquier worker genera códigos en paralelo
  - requiere detectar y resolver colisiones (reintentar con salt)
```

Arquitectura de lectura optimizada para el 100:1
```txt
Client -> [Read service, stateless, N réplicas] -> Cache (Redis, TTL+LRU)
                                                        | miss
                                                        v
                                                    [DB, read replicas]
```

#### Sources
- [AWS Architecture Center](https://aws.amazon.com/architecture/)
- [Google Cloud Architecture Center, Scalability](https://cloud.google.com/architecture)
- [system-design-primer, Design Pastebin/URL shortener](https://github.com/donnemartin/system-design-primer#design-a-system-that-scales-to-millions-of-users-on-aws)

### Diseño de APIs a escala
#### Details
Idempotencia en APIs de escritura es lo que permite reintentar una request de forma segura ante fallas de red, sin correr el riesgo de duplicar el efecto (cobrar dos veces, crear dos pedidos). El patrón estándar es que el cliente genere una idempotency key (un UUID) y la envíe en el request; el servidor guarda esa key junto con el resultado de la primera ejecución, y si llega la misma key de nuevo, devuelve el resultado guardado en vez de reprocesar. Esto es crítico en cualquier endpoint de pago o creación de recursos donde un timeout del lado del cliente no significa necesariamente que el servidor no haya procesado el request.

Paginar datasets grandes tiene dos enfoques con trade-offs distintos. Offset-based (`LIMIT 20 OFFSET 100`) es simple de implementar y permite saltar a una página arbitraria, pero es lento en offsets grandes (la base tiene que descartar todas las filas anteriores) y es inconsistente si se insertan o borran filas entre páginas (un usuario puede ver el mismo item dos veces o saltarse uno). Cursor-based (keyset pagination) usa el último valor visto como punto de partida (`WHERE id > last_seen_id LIMIT 20`), es mucho más eficiente porque usa el índice directamente y es estable ante inserciones/borrados, pero no permite saltar directo a una página arbitraria por número.

Rate limiting protege al sistema de un cliente (intencional o no) que satura la capacidad. Token bucket permite ráfagas controladas: cada request consume un token de un balde que se rellena a tasa constante, así que un cliente puede acumular capacidad si estuvo inactivo y usarla de golpe, hasta el límite del balde. Sliding window cuenta requests en una ventana de tiempo móvil (no fija), evitando el problema del "fixed window" donde un cliente puede hacer 2x el límite pegado al borde de dos ventanas consecutivas.

#### Examples
Idempotency key en un endpoint de pago
```txt
POST /payments
Headers: Idempotency-Key: 7f3a-...-9c1

Server:
  if key ya existe en store:
      return resultado guardado (sin recobrar)
  else:
      procesar pago, guardar (key -> resultado)
      return resultado
```

Offset vs cursor pagination
```txt
Offset:  GET /items?offset=10000&limit=20
         SELECT * FROM items ORDER BY id LIMIT 20 OFFSET 10000
         -> la DB descarta 10000 filas antes de devolver las 20. Lento a escala.

Cursor:  GET /items?after=item_849&limit=20
         SELECT * FROM items WHERE id > 849 ORDER BY id LIMIT 20
         -> usa el índice directo, O(log n) + 20, estable ante inserts/deletes.
```

Token bucket vs sliding window
```txt
Token bucket: balde de 10 tokens, se rellena 1 token/segundo.
  Cliente inactivo 10s -> puede hacer 10 requests de golpe, después 1/s.

Sliding window: cuenta requests en los últimos 60s de forma continua,
  no en bloques fijos de minuto. Evita el "burst en el borde de ventana".
```

#### Sources
- [MDN, HTTP overview](https://developer.mozilla.org/en-US/docs/Web/HTTP)
- [AWS Architecture Center, API design](https://aws.amazon.com/architecture/)
- [Google Cloud Architecture Center, API design](https://cloud.google.com/architecture)
- [system-design-primer, Rate limiting](https://github.com/donnemartin/system-design-primer)

### Patrones de confiabilidad
#### Details
Un timeout define cuánto tiempo esperar una respuesta antes de darla por perdida; sin timeouts explícitos, un servicio lento aguas abajo puede colgar indefinidamente a todos sus llamadores, agotando threads o conexiones y propagando la falla hacia arriba. Los retries reintentan una operación que falló, pero un retry naive (reintentar inmediatamente y sin límite) empeora una caída: si el servicio downstream está saturado, una ola de reintentos inmediatos de todos los clientes es exactamente la carga extra que lo termina de tumbar. La mitigación estándar es backoff exponencial (esperar 1s, después 2s, después 4s...) combinado con jitter (agregar aleatoriedad a esos tiempos) para que los reintentos de miles de clientes no lleguen todos sincronizados en el mismo instante.

El circuit breaker va un paso más allá de retry/timeout: monitorea la tasa de fallas hacia un servicio downstream y, si supera un umbral, "abre el circuito" y deja de intentar llamar a ese servicio por un tiempo, devolviendo un error rápido (o un fallback) en vez de seguir esperando timeouts que ya sabemos que van a fallar. Esto protege tanto al servicio que llama (no gasta threads/conexiones esperando algo que va a fallar) como al servicio downstream (le da tiempo de recuperarse sin más carga). Después de un tiempo, el circuito pasa a "half-open" y deja pasar algunas requests de prueba para ver si el servicio se recuperó.

La razón por la que esto se pregunta tanto en entrevistas es que conecta con incidentes reales: la mayoría de las caídas grandes en sistemas distribuidos no son "el servicio A se rompió", son "el servicio A se puso lento, y B, C y D lo siguieron reintentando sin backoff hasta tumbar todo el clúster" (retry storm / cascading failure). Mostrar que entendés esto es mostrar experiencia operativa real, no solo conocimiento de patrones de libro.

#### Examples
Retry naive vs exponential backoff + jitter
```txt
Naive:      retry inmediato, sin límite -> retry storm si el downstream
            está degradado, empeora la caída.

Backoff:    intento 1 -> falla -> esperar 1s
            intento 2 -> falla -> esperar 2s
            intento 3 -> falla -> esperar 4s
            + jitter: esperar random(0, 2^intento) para desincronizar clientes.
```

Circuit breaker: estados
```txt
CLOSED  (normal) -> tasa de fallas supera umbral -> OPEN
OPEN    (falla rápido, sin llamar al downstream) -> pasa el tiempo -> HALF-OPEN
HALF-OPEN (deja pasar algunas requests de prueba)
    -> si funcionan -> CLOSED
    -> si fallan     -> OPEN de nuevo
```

Timeout evitando agotamiento de recursos
```txt
Sin timeout: Service A llama a Service B (lento) -> el thread de A queda
             bloqueado esperando -> bajo carga, A agota su pool de threads
             -> A también empieza a fallar, aunque el problema era de B.

Con timeout: A espera máximo 2s, si B no responde, A falla rápido y
             libera el thread (opcionalmente sirviendo un fallback).
```

#### Sources
- [AWS Well-Architected Framework, Reliability pillar](https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html)
- [Google Cloud Architecture Center, Reliability](https://cloud.google.com/architecture)
- [system-design-primer, Availability patterns](https://github.com/donnemartin/system-design-primer#availability-patterns)

## Interview Questions

### Diseñá un acortador de URLs para 100 millones de URLs nuevas por mes con lecturas 100 veces más frecuentes que escrituras. Recorré tu proceso completo.
Empezaría clarificando si hace falta alias custom, expiración y analytics de clicks. Con esos números, estimo ~40 writes/s y ~4000 reads/s, y un volumen total manejable por una base relacional bien indexada sin necesitar sharding inicial. Diseñaría un servicio de escritura que genera el código corto (contador global en base62 o hash truncado, cada uno con su trade-off de coordinación vs colisiones) y un servicio de lectura stateless con cache delante de la base, porque el tráfico de lectura se concentra en un subconjunto pequeño de URLs populares. Cerraría mencionando cómo escalaría cada capa por separado si el tráfico crece 10x.

### ¿Por qué elegirías cursor-based pagination en vez de offset para un feed infinito?
Porque offset-based se vuelve lento a medida que el offset crece, ya que la base tiene que descartar todas las filas anteriores antes de devolver la página pedida, y además es inconsistente si se insertan o borran filas entre requests, mostrando duplicados o saltando ítems. Cursor-based usa el último ID visto para arrancar desde ahí con el índice directo, manteniéndose rápido y estable sin importar cuán "adentro" del feed esté el usuario. El costo que acepto es no poder saltar directo a "la página 50", algo que en un feed infinito casi nunca se necesita.

### Un cliente reintenta un pago que falló por timeout y termina cobrando dos veces. ¿Cómo lo prevenís desde el diseño de la API?
El problema real es que un timeout del lado del cliente no garantiza que el servidor no haya procesado el request; el cliente no sabe si falló antes o después de aplicar el efecto. La solución es una idempotency key generada por el cliente en cada intento de pago: el servidor guarda el resultado asociado a esa key la primera vez, y ante la misma key en un reintento, devuelve el resultado guardado en vez de volver a cobrar. Esto traslada la responsabilidad de "no duplicar" al servidor, que es donde realmente se puede garantizar.

### Tu servicio A llama a un servicio B que empieza a responder lento. Sin ningún patrón de confiabilidad, ¿qué pasa y cómo lo evitás?
Sin timeout, los threads o conexiones de A que esperan a B se van acumulando, agotando el pool de A y haciendo que A también empiece a fallar para TODOS sus clientes, no solo para las requests que dependían de B. Pondría un timeout razonable en las llamadas a B, y si el patrón de falla es sostenido, agregaría un circuit breaker para dejar de llamar a B temporalmente y fallar rápido (o servir un fallback), dándole tiempo a B de recuperarse en vez de sumarle más carga.

### ¿Por qué "agregar reintentos" puede empeorar una caída en vez de arreglarla?
Porque si el servicio downstream está degradado por sobrecarga, una ola de reintentos inmediatos de todos los clientes afectados es carga adicional exactamente en el peor momento, un retry storm que puede terminar de tumbarlo. La forma correcta es combinar backoff exponencial, para dar tiempo real de recuperación entre intentos, con jitter, para que los reintentos de muchos clientes no lleguen todos sincronizados y generen otro pico de carga.

### Te piden rate limitar una API pública para que ningún cliente haga más de 100 requests por minuto. ¿Token bucket o sliding window, y por qué?
Si quiero permitir ráfagas cortas de un cliente que estuvo inactivo (por ejemplo, un dashboard que hace varias llamadas al cargar y después queda tranquilo), token bucket es más natural porque acumula capacidad cuando no se usa. Si en cambio necesito un límite estricto y uniforme sin permitir picos concentrados en el borde de una ventana, sliding window evita el problema del fixed window donde un cliente puede hacer hasta el doble del límite pegando dos ráfagas justo en el cambio de minuto. La elección depende de si el patrón de tráfico esperado tolera ráfagas o no.
