---
stack: node
id: node-async-performance
title: "Node.js: concurrencia, procesos y diagnóstico"
area: Backend
priority: medium
resourceLabel: Node.js, Diagnostics
resourceUrl: https://nodejs.org/docs/latest/api/diagnostics_channel.html
---

## Summary
Cómo escalar Node más allá de un solo hilo (worker_threads, cluster, child_process), evitar fugas clásicas de EventEmitter, apagar un proceso de forma segura, y diagnosticar bloqueos y memory leaks en producción.

## Concepts

### worker_threads vs cluster vs child_process: cuándo usar cada uno
#### Details
Node es single-threaded para la ejecución de JS, pero eso no significa que no pueda paralelizar trabajo, significa que hay que elegir la herramienta correcta según el problema. **`worker_threads`** crea hilos reales dentro del mismo proceso, cada uno con su propio event loop y contexto V8, pero pueden **compartir memoria** mediante `SharedArrayBuffer` y se comunican con `postMessage` (que por defecto serializa con structured clone, no comparte memoria salvo que se lo pida explícitamente). Es la herramienta correcta para trabajo **CPU-bound**: parsing pesado, compresión, hashing, procesamiento de imágenes, cualquier cosa que bloquearía el event loop principal si corriera ahí.

**`cluster`** no paraleliza cómputo: crea múltiples **procesos** (workers) que comparten el mismo puerto de escucha y balancean requests entrantes entre ellos (por defecto con round-robin en la mayoría de plataformas). Sirve para **escalar throughput de I/O** en múltiples núcleos de CPU cuando cada request individual es liviano en CPU pero hay muchos requests concurrentes, el caso típico de un servidor HTTP en producción. Cada worker de `cluster` es un proceso Node completo con su propia memoria: no hay memoria compartida, la comunicación es por IPC.

**`child_process`** (`spawn`, `exec`, `fork`) sirve para ejecutar **otro programa** (un binario del sistema, un script en otro lenguaje) o para aislar completamente una tarea en su propio proceso con su propio espacio de memoria, útil cuando la tarea es tan pesada o inestable que no querés que un crash se lleve puesto el proceso principal. `fork()` es un caso especial de `spawn()` pensado específicamente para lanzar otro script Node con un canal de IPC ya establecido, y es la base sobre la que está construido `cluster` internamente.

#### Examples
`worker_threads` para no bloquear el loop con CPU pesada
```js
// main.js
const { Worker } = require('node:worker_threads');

function runInWorker(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./heavy-task.js', { workerData: data });
    worker.on('message', resolve);
    worker.on('error', reject);
  });
}

// El servidor HTTP sigue atendiendo otros requests mientras esto corre
runInWorker({ n: 40 }).then((result) => console.log('fib:', result));
```

```js
// heavy-task.js
const { parentPort, workerData } = require('node:worker_threads');

function fib(n) {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}

parentPort.postMessage(fib(workerData.n));
```

`cluster` para escalar un servidor HTTP en todos los cores
```js
const cluster = require('node:cluster');
const http = require('node:http');
const os = require('node:os');

if (cluster.isPrimary) {
  os.cpus().forEach(() => cluster.fork());
  cluster.on('exit', (worker) => {
    console.log(`worker ${worker.process.pid} murió, levantando otro`);
    cluster.fork();
  });
} else {
  http.createServer((req, res) => res.end('hello')).listen(3000);
}
```

`child_process.spawn` para aislar y ejecutar un binario externo
```js
const { spawn } = require('node:child_process');

const ffmpeg = spawn('ffmpeg', ['-i', 'input.mp4', 'output.webm']);
ffmpeg.stderr.on('data', (chunk) => console.error(chunk.toString()));
ffmpeg.on('close', (code) => console.log(`ffmpeg terminó con código ${code}`));
```

#### Sources
- [Node.js API, Worker threads](https://nodejs.org/docs/latest/api/worker_threads.html)
- [Node.js API, Cluster](https://nodejs.org/docs/latest/api/cluster.html)
- [Node.js API, Child process](https://nodejs.org/docs/latest/api/child_process.html)

---

### EventEmitter: patrones y la fuga de memoria por listeners
#### Details
`EventEmitter` es la base de gran parte de la API de Node (streams, servers, sockets). Un patrón central de diseño es que emitir un evento `'error'` **sin ningún listener registrado** hace que Node **lance esa excepción y, si nada la captura, tire abajo el proceso**, es la única excepción a la regla de que emitir un evento sin listeners es un no-op silencioso. Esto es intencional: fuerza a que los errores no pasen desapercibidos.

El memory leak clásico con EventEmitter ocurre al **registrar listeners repetidamente sin removerlos**, típicamente dentro de un handler de request o un loop: cada llamado agrega un listener nuevo al mismo emitter de larga vida (por ejemplo, un emitter global o un socket persistente), y esos listeners nunca se liberan porque nada dispara su remoción. Node detecta este patrón por default: a partir de **11 listeners** para el mismo evento en el mismo emitter, imprime un warning `MaxListenersExceededWarning`, no es un límite duro, es una señal de que probablemente hay un leak.

La forma correcta de manejar un listener temporal es `emitter.once(event, handler)` cuando solo importa la primera ocurrencia, o guardar la referencia al handler para poder hacer `emitter.off(event, handler)` explícitamente cuando ya no es necesario. Si el número de listeners esperado es legítimamente alto (un event bus central con muchos módulos suscritos), se ajusta con `emitter.setMaxListeners(n)` en vez de ignorar el warning.

#### Examples
Emitir `'error'` sin listener tira el proceso
```js
const { EventEmitter } = require('node:events');
const emitter = new EventEmitter();

emitter.emit('error', new Error('boom'));
// Uncaught Error: boom, el proceso crashea porque no hay listener 'error'
```

El leak: agregar listeners en cada request sin remover
```js
const emitter = new EventEmitter(); // vive durante toda la vida del proceso

function handleRequest(req, res) {
  // BUG: cada request agrega un nuevo listener que nunca se remueve
  emitter.on('data-ready', (data) => res.end(data));
  emitter.emit('data-ready', 'payload');
}
// Después de ~11 requests: MaxListenersExceededWarning, señal de leak
```

El fix: `once` o remover explícitamente
```js
function handleRequestFixed(req, res) {
  emitter.once('data-ready', (data) => res.end(data)); // se autoremueve tras dispararse
  emitter.emit('data-ready', 'payload');
}

// Alternativa cuando no es "una sola vez": guardar referencia y remover
function subscribe() {
  const handler = (data) => console.log(data);
  emitter.on('tick', handler);
  return () => emitter.off('tick', handler); // función de cleanup
}
```

#### Sources
- [Node.js API, Events](https://nodejs.org/docs/latest/api/events.html)
- [Node.js API, Events: Error events](https://nodejs.org/docs/latest/api/events.html#error-events)
- [Node.js API, emitter.setMaxListeners()](https://nodejs.org/docs/latest/api/events.html#emittersetmaxlistenersn)

---

### Graceful shutdown: señales del proceso y mantener el loop vivo
#### Details
El event loop de Node se mantiene corriendo mientras existan handles activos que lo mantengan "vivo" (un servidor escuchando, un timer pendiente, un socket abierto): cuando no queda ninguno, el proceso termina naturalmente. Cada handle asíncrono tiene los métodos `.ref()` (default) y `.unref()`: `.unref()` le dice al loop "no me cuentes para decidir si seguís vivo", útil para timers de housekeeping que no deberían impedir que el proceso termine si es lo único que queda pendiente.

Un **graceful shutdown** correcto ante `SIGTERM` (la señal que mandan Kubernetes, Docker, o `systemd` al pedir que un proceso termine) no debe ser un `process.exit()` inmediato: hay que dejar de aceptar conexiones nuevas, esperar a que terminen las requests en vuelo, cerrar conexiones a bases de datos y otros recursos, y **recién ahí** salir. `server.close()` deja de aceptar nuevas conexiones pero no corta las existentes; el callback de `close()` se dispara cuando todas terminaron. Si hay requests que nunca terminan (conexiones colgadas, streams infinitos), se necesita un timeout de gracia que fuerce `process.exit()` después de N segundos como red de seguridad.

`SIGKILL` (a diferencia de `SIGTERM`) no puede ser interceptado ni manejado: el sistema operativo mata el proceso sin darle chance de correr código de cleanup. Por eso orquestadores como Kubernetes mandan primero `SIGTERM` y, si el proceso no termina dentro del `terminationGracePeriodSeconds` configurado, escalan a `SIGKILL`. Diseñar el shutdown asumiendo que siempre vas a tener esa ventana de gracia, y que nunca es infinita, es la expectativa real en producción.

#### Examples
Graceful shutdown de un servidor HTTP ante `SIGTERM`
```js
const http = require('node:http');

const server = http.createServer((req, res) => res.end('ok'));
server.listen(3000);

async function shutdown(signal) {
  console.log(`${signal} recibido, cerrando...`);

  const forceExit = setTimeout(() => {
    console.error('shutdown forzado: timeout de gracia excedido');
    process.exit(1);
  }, 10_000).unref(); // no mantiene el proceso vivo si el shutdown fue limpio

  server.close(async (err) => {
    clearTimeout(forceExit);
    // acá cerraría también pool de DB, colas, etc.
    console.log('servidor cerrado, sin conexiones activas');
    process.exit(err ? 1 : 0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

`.unref()` para no bloquear la salida del proceso con un timer de background
```js
// Este interval de "heartbeat" no debería impedir que el proceso
// termine si es la única tarea pendiente en el loop.
const heartbeat = setInterval(() => console.log('alive'), 5000);
heartbeat.unref();

// Si no hay nada más manteniendo el loop vivo, el proceso
// termina igual, sin necesidad de clearInterval explícito.
```

#### Sources
- [Node.js API, Process: Signal events](https://nodejs.org/docs/latest/api/process.html#signal-events)
- [Node.js API, server.close()](https://nodejs.org/docs/latest/api/net.html#serverclosecallback)
- [Node.js API, timeout.unref()](https://nodejs.org/docs/latest/api/timers.html#timeoutunref)

---

### Diagnosticar bloqueos del event loop y memory leaks
#### Details
Un event loop "bloqueado" es código síncrono que tarda demasiado (un JSON.parse gigante, un loop CPU-intensivo, una regex catastrófica) y no le da chance al loop de atender otras conexiones mientras corre. El primer diagnóstico es con el inspector integrado: `node --inspect` (o `--inspect-brk` para pausar al arrancar) expone un endpoint de debugging compatible con las DevTools de Chrome, donde se puede tomar un **CPU profile** y ver exactamente qué función acapara el tiempo de ejecución síncrona.

Para medir tiempos con precisión programática (sin abrir DevTools), el módulo `perf_hooks` da acceso a `performance.now()` (alta resolución, no afectado por cambios de reloj del sistema como `Date.now()`) y a `PerformanceObserver` para medir automáticamente cuánto tardan funciones marcadas. `diagnostics_channel` es la API más reciente para instrumentación de bajo overhead: permite publicar y suscribirse a canales de datos internos (por ejemplo, cuándo arranca y termina cada función HTTP) sin el costo de un profiler corriendo todo el tiempo, es la base sobre la que se construyen APMs como Datadog o New Relic para Node.

Para memory leaks, la herramienta base es tomar **heap snapshots** (vía `--inspect` + DevTools, o programáticamente con el módulo `v8`) en distintos momentos y compararlos: si un tipo de objeto crece de snapshot a snapshot sin bajar nunca, ahí está el leak (típicamente: listeners no removidos, closures reteniendo referencias grandes, caches sin límite de tamaño). Herramientas del ecosistema como **clinic.js** (`clinic doctor`, `clinic flame`) automatizan este flujo: corren la app bajo carga y generan un reporte visual señalando si el problema es CPU, I/O o event-loop-delay, sin tener que interpretar un profile crudo a mano.

#### Examples
Perfilando con el inspector integrado
```bash
node --inspect server.js
# Abrir chrome://inspect en Chrome, conectar, y grabar un CPU profile
# mientras se reproduce la carga que causa el bloqueo.
```

Midiendo con `perf_hooks` sin herramientas externas
```js
const { performance, PerformanceObserver } = require('node:perf_hooks');

const obs = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(`${entry.name}: ${entry.duration.toFixed(2)}ms`);
  }
});
obs.observe({ entryTypes: ['measure'] });

performance.mark('start-parse');
JSON.parse(hugeJsonString);
performance.mark('end-parse');
performance.measure('json-parse', 'start-parse', 'end-parse');
```

Instrumentación de bajo overhead con `diagnostics_channel`
```js
const diagnostics_channel = require('node:diagnostics_channel');

const channel = diagnostics_channel.channel('app:db-query');

// En el código de la app, al ejecutar una query:
channel.publish({ query: 'SELECT * FROM users', durationMs: 42 });

// En un módulo de observabilidad, sin acoplarse al código de negocio:
channel.subscribe((message) => {
  if (message.durationMs > 100) {
    console.warn('query lenta detectada:', message.query);
  }
});
```

#### Sources
- [Node.js, Debugging Node.js Applications](https://nodejs.org/en/learn/getting-started/debugging)
- [Node.js API, Performance measurement APIs](https://nodejs.org/docs/latest/api/perf_hooks.html)
- [Node.js API, Diagnostics Channel](https://nodejs.org/docs/latest/api/diagnostics_channel.html)

## Interview Questions

### Tenés un endpoint que hace un hash de contraseñas con bcrypt (CPU-bound) y notás que bajo carga todos los requests se enlentecen, no solo el de hashing. ¿Cómo lo resolvés?
El problema es que el hashing síncrono bloquea el único hilo de JS: mientras corre, el event loop no puede atender ningún otro request, aunque sean requests livianos que no tienen nada que ver con el hashing. La solución es mover ese trabajo CPU-bound a un `worker_thread`: el hilo principal sigue atendiendo I/O mientras el worker calcula el hash en paralelo, y se comunica el resultado de vuelta con `postMessage`. Usar `cluster` no resolvería el síntoma completo porque, aunque reparte requests entre procesos, cada proceso individual seguiría bloqueándose durante el hashing de su propio request, worker_threads ataca el problema en su raíz, que es cómputo bloqueante dentro de un mismo proceso.

### ¿Por qué `cluster` no comparte memoria entre workers, y qué implica eso para el diseño de una app que lo usa?
`cluster` levanta procesos del sistema operativo completos, no hilos: cada uno tiene su propio espacio de memoria y su propia instancia del runtime V8. Esto implica que cualquier estado en memoria, un cache en un objeto, un contador, sesiones guardadas en RAM, **no se comparte** entre workers: un request que llega al worker 2 no ve lo que guardó el worker 1. El diseño correcto para una app en `cluster` es externalizar todo estado compartido a un almacén fuera del proceso (Redis para sesiones/cache, una base de datos para estado persistente), tratando cada worker como completamente stateless respecto a los demás.

### En un servidor con muchos módulos suscribiéndose a un EventEmitter central, empezás a ver `MaxListenersExceededWarning` en producción. ¿Es necesariamente un bug?
No necesariamente, es una heurística, no un límite duro. El warning aparece a partir de 11 listeners para el mismo evento en el mismo emitter porque ese número suele indicar un leak (listeners agregados repetidamente sin remover, por ejemplo dentro de un handler de request). Pero si el diseño es legítimamente un event bus central con muchos módulos independientes suscritos de forma permanente, ese número puede ser esperado. Lo que hay que verificar es si el conteo de listeners **crece indefinidamente con el tiempo o con el tráfico** (leak real) o si se estabiliza en un número fijo al arrancar la app (diseño intencional), en el segundo caso, se ajusta con `setMaxListeners()` explícitamente para documentar la intención, en vez de solo silenciar el warning.

### ¿Qué diferencia hay entre matar un proceso Node con `SIGKILL` y con `SIGTERM`, y por qué el shutdown de tu app debería depender de eso?
`SIGTERM` es una señal que el proceso puede interceptar y manejar con código propio antes de salir, es la señal correcta para pedir un shutdown ordenado. `SIGKILL` la maneja directamente el kernel: el proceso termina de inmediato sin ejecutar ni una línea más de JS, no hay forma de interceptarla. Por eso el código de graceful shutdown (dejar de aceptar conexiones, drenar requests en vuelo, cerrar la conexión a la base de datos) se engancha exclusivamente a `SIGTERM`/`SIGINT`. Además, hay que asumir que la ventana de gracia no es infinita: orquestadores como Kubernetes escalan a `SIGKILL` después de un tiempo configurado si el proceso no terminó solo, así que el shutdown necesita su propio timeout interno que fuerce `process.exit()` antes de que eso ocurra.

### Un servicio en producción muestra uso de memoria creciendo constantemente hasta hacer OOM cada pocas horas. ¿Cómo encarás el diagnóstico?
Primero confirmaría que es un leak real y no solo el comportamiento normal del garbage collector (la memoria de Node puede subir y bajar en dientes de sierra sin ser un leak). Con eso descartado, tomaría heap snapshots en al menos dos o tres momentos separados bajo carga similar usando `--inspect` y las DevTools, y los compararía: un tipo de objeto que crece consistentemente snapshot a snapshot, sin bajar nunca, señala el leak. Los sospechosos más comunes son listeners de EventEmitter nunca removidos, closures que retienen referencias a objetos grandes más tiempo del necesario, o caches propios sin límite de tamaño ni TTL. Si el diagnóstico manual es lento, usaría `clinic doctor` para automatizar la corrida bajo carga y obtener un reporte que ya distingue si el patrón corresponde a memoria, CPU o event-loop-delay antes de meterme a leer heap snapshots a mano.

### ¿Cuándo elegirías `child_process` en vez de `worker_threads` para paralelizar trabajo?
Elegiría `child_process` cuando necesito ejecutar código que no es JS/Node (un binario del sistema como `ffmpeg` o `imagemagick`, un script en Python), porque `worker_threads` solo puede correr código JS dentro del mismo runtime V8. También lo elegiría cuando quiero **aislamiento total de fallos**: si la tarea es inestable o puede crashear, un `child_process` separado no se lleva puesto el proceso principal, mientras que un crash no controlado en un worker_thread puede, según el caso, afectar el proceso host. El costo es mayor: cada `child_process` es un proceso del SO completo con su propio overhead de arranque y memoria, más pesado que un worker_thread, así que no lo usaría para paralelizar cómputo puro en JS donde worker_threads es más liviano y permite compartir memoria con `SharedArrayBuffer` si hace falta.
