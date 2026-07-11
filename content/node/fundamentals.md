---
stack: node
id: node-fundamentals
title: "Node.js: fundamentos del runtime"
area: Backend
priority: high
resourceLabel: Node.js, API Docs
resourceUrl: https://nodejs.org/docs/latest/api/
---

## Summary

Lo que distingue a Node como runtime server-side de JS: las fases reales del event loop de libuv, cómo conviven CommonJS y ESM, el modelo de streams con backpressure, y cómo se maneja binario con Buffer.

## Concepts

### El event loop de libuv: fases, no una sola cola

#### Details

El "event loop" que se enseña como concepto básico de JS (call stack, cola de tareas, microtasks) es una simplificación. En Node, el loop lo implementa **libuv** y tiene **fases** ordenadas, cada una con su propia cola de callbacks: `timers` (ejecuta callbacks de `setTimeout`/`setInterval` cuyo umbral venció), `pending callbacks` (callbacks de I/O diferidos de la vuelta anterior, p. ej. algunos errores de TCP), `idle/prepare` (uso interno), `poll` (recupera nuevos eventos de I/O y ejecuta sus callbacks; es donde el loop puede bloquearse esperando I/O), `check` (callbacks de `setImmediate`) y `close callbacks` (p. ej. `socket.on('close', ...)`). El loop recorre estas fases en orden, en cada vuelta ("tick").

Entre **cada fase**,y no solo al final del loop, Node vacía la **microtask queue** (`Promise.then`, `queueMicrotask`) y, con prioridad aún mayor, la cola de `process.nextTick()`. Esto explica un comportamiento que suele sorprender en entrevista: `process.nextTick` se ejecuta antes que cualquier Promise resuelta en el mismo punto, y ambas colas se procesan por completo antes de pasar a la siguiente fase del loop, incluso si eso significa retrasar I/O pendiente.

El caso `setTimeout(fn, 0)` vs `setImmediate(fn)` es el ejemplo clásico de entrevista: dentro del código principal (top-level) el orden entre ambos no está garantizado porque depende de la precisión del timer del sistema operativo; pero dentro de un callback de I/O (fase `poll`), `setImmediate` **siempre** se ejecuta antes que un `setTimeout(fn, 0)`, porque la fase `check` viene inmediatamente después de `poll` en el mismo tick, mientras que `timers` recién se procesa en la vuelta siguiente.

#### Examples

`process.nextTick` y Promises tienen prioridad sobre las fases del loop

```js
console.log("start");

setTimeout(() => console.log("timeout"), 0);
setImmediate(() => console.log("immediate"));

process.nextTick(() => console.log("nextTick"));
Promise.resolve().then(() => console.log("promise"));

console.log("end");

// Orden típico:
// start
// end
// nextTick
// promise
// timeout            (o immediate, según timing del SO, en top-level)
// immediate
```

Dentro de un callback de I/O el orden es determinista

```js
const fs = require("node:fs");

fs.readFile(__filename, () => {
  setTimeout(() => console.log("timeout"), 0);
  setImmediate(() => console.log("immediate"));
  // Acá SIEMPRE gana 'immediate': la fase poll (donde corre
  // este callback) pasa directo a check, no a timers.
});
```

`process.nextTick` puede hambrear al loop si se abusa

```js
function recursiveNextTick(count) {
  if (count <= 0) return;
  process.nextTick(() => recursiveNextTick(count - 1));
}

// Mientras la cola de nextTick no se vacíe, el loop nunca
// avanza a I/O, timers ni checks: riesgo real de "I/O starvation".
recursiveNextTick(1e6);
```

#### Sources

- [Node.js, The Node.js Event Loop, Timers, and process.nextTick()](https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick)
- [Node.js API, Timers](https://nodejs.org/docs/latest/api/timers.html)
- [Node.js API, process.nextTick()](https://nodejs.org/docs/latest/api/process.html#processnexttickcallback-args)

---

### Sistema de módulos: CommonJS vs ESM y su interop

#### Details

Node soporta dos sistemas de módulos con semánticas distintas. **CommonJS** (`require`/`module.exports`) es **síncrono**: `require()` resuelve, lee y ejecuta el archivo en el momento en que se lo invoca, y devuelve un objeto `exports` completo. **ESM** (`import`/`export`) sigue la especificación de JS: la resolución de módulos y el análisis estático de imports ocurren antes de la ejecución, lo que habilita _tree-shaking_ y permite `import` de nivel superior ser asíncrono internamente (aunque en código se escriba de forma síncrona-aparente).

Node decide qué sistema usar por archivo según: la extensión (`.mjs` siempre ESM, `.cjs` siempre CommonJS) o, para `.js`, el campo `"type"` en el `package.json` más cercano (`"module"` → ESM, `"commonjs"` o ausente → CommonJS). Esta configuración por paquete es clave para publicar librerías que sirvan a ambos consumidores (dual package).

La interop tiene una asimetría importante: un módulo ESM puede importar un módulo CommonJS con `import cjsModule from 'pkg'` (Node envuelve el `module.exports` como default export), pero un módulo CommonJS **no puede usar `require()`** para cargar un ESM real de forma síncrona,tiene que usar `import()` dinámico, que devuelve una Promise,, porque cargar un ESM implica un paso de resolución potencialmente asíncrono que rompe el contrato síncrono de `require`. Esta limitación es un tema recurrente de entrevista cuando se discute migrar una base CommonJS a ESM.

#### Examples

`package.json` define el modo por defecto del paquete

```json
{
  "name": "my-lib",
  "type": "module",
  "exports": {
    "import": "./dist/index.mjs",
    "require": "./dist/index.cjs"
  }
}
```

CommonJS consumiendo ESM: solo con `import()` dinámico

```js
// archivo.cjs
async function loadEsmDep() {
  const { default: chalk } = await import("chalk"); // chalk@5+ es ESM-only
  console.log(chalk.green("cargado desde CJS via import() dinámico"));
}

loadEsmDep();
```

ESM consumiendo CommonJS: `import` estático funciona directo

```js
// archivo.mjs
import express from "express"; // CommonJS, expone default export envuelto
import { readFileSync } from "node:fs";

const app = express();
console.log(readFileSync("./package.json", "utf8"));
```

#### Sources

- [Node.js API, Modules: CommonJS modules](https://nodejs.org/docs/latest/api/modules.html)
- [Node.js API, Modules: ECMAScript modules](https://nodejs.org/docs/latest/api/esm.html)
- [Node.js API, Modules: Packages](https://nodejs.org/docs/latest/api/packages.html#determining-module-system)

---

### Streams: Readable, Writable, backpressure y `pipeline`

#### Details

Los streams son la abstracción de Node para procesar datos de forma incremental sin cargarlos enteros en memoria: HTTP requests/responses, sockets TCP, archivos grandes, compresión, todos son streams. Hay cuatro tipos base: **Readable** (fuente de datos, ej. `fs.createReadStream`), **Writable** (destino, ej. `fs.createWriteStream`), **Duplex** (ambos, ej. un socket TCP) y **Transform** (Duplex que modifica los datos al pasar, ej. `zlib.createGzip()`).

El concepto que más se evalúa en entrevista es **backpressure**: qué pasa cuando un Readable produce datos más rápido de lo que un Writable puede consumirlos. `writable.write(chunk)` devuelve `false` cuando el buffer interno superó `highWaterMark`; en ese momento hay que **dejar de escribir** hasta que el stream emita el evento `'drain'`. Ignorar esta señal (seguir llamando `write()` sin chequear el retorno) hace crecer el buffer interno sin límite: es una fuga de memoria clásica al procesar archivos grandes o proxies de datos.

`stream.pipe()` maneja backpressure automáticamente conectando un Readable a un Writable, pero **no propaga errores** del destino hacia el origen ni cierra los streams correctamente ante un error, hay que agregar listeners `'error'` manuales en cada stream. Por eso la API moderna recomendada es `stream.pipeline()` (o su versión Promise, `stream/promises`), que además de manejar backpressure, garantiza que todos los streams del pipeline se destruyan correctamente si cualquiera falla, evitando handles y file descriptors colgados.

#### Examples

Backpressure manual con `write()` y `'drain'`

```js
function writeLargeData(writable, chunks) {
  let i = 0;
  function write() {
    let ok = true;
    while (i < chunks.length && ok) {
      ok = writable.write(chunks[i++]);
    }
    if (i < chunks.length) {
      // el buffer interno está lleno: esperamos 'drain' antes de seguir
      writable.once("drain", write);
    }
  }
  write();
}
```

`pipeline` maneja backpressure y limpieza de errores por vos

```js
const { pipeline } = require("node:stream/promises");
const fs = require("node:fs");
const zlib = require("node:zlib");

async function compressFile(input, output) {
  await pipeline(
    fs.createReadStream(input),
    zlib.createGzip(),
    fs.createWriteStream(output),
  );
  console.log("compresión terminada, todos los streams cerrados correctamente");
}
```

Transform stream custom

```js
const { Transform } = require("node:stream");

const upperCaseTransform = new Transform({
  transform(chunk, encoding, callback) {
    this.push(chunk.toString().toUpperCase());
    callback();
  },
});

process.stdin.pipe(upperCaseTransform).pipe(process.stdout);
```

#### Sources

- [Node.js API, Stream](https://nodejs.org/docs/latest/api/stream.html)
- [Node.js API, Stream: Backpressuring in Streams (Guides)](https://nodejs.org/en/learn/modules/backpressuring-in-streams)
- [Node.js API, stream/promises](https://nodejs.org/docs/latest/api/stream.html#streampipelinesource-transforms-destination-options)

---

### Buffer y manejo de datos binarios

#### Details

`Buffer` es la estructura de Node para representar datos binarios de tamaño fijo, previa a que JS tuviera `Uint8Array` de forma nativa. Hoy `Buffer` **es una subclase de `Uint8Array`**, así que interopera con toda la API de TypedArrays, pero agrega métodos propios (`.toString(encoding)`, `.write()`, `.compare()`, `.concat()`) pensados para I/O: leer un archivo, un socket TCP o el body de un request HTTP devuelve datos como `Buffer` por defecto, no como string, porque en ese punto Node no sabe (ni le importa) qué encoding tienen los bytes.

La forma correcta de crear un Buffer hoy es con `Buffer.alloc(size)` (inicializado a ceros, seguro) o `Buffer.from(data)` (a partir de un array, string o ArrayBuffer). El método `Buffer.allocUnsafe(size)` es más rápido porque no inicializa la memoria, pero puede contener **datos residuales de asignaciones previas** del proceso, un riesgo de seguridad real si ese buffer se envía a un cliente sin sobreescribirlo completo antes.

El encoding importa: `Buffer` puede interpretarse como `'utf8'`, `'ascii'`, `'base64'`, `'hex'`, `'latin1'`, entre otros. Un error común de entrevista es asumir que 1 byte = 1 carácter: en UTF-8, caracteres fuera de ASCII ocupan 2-4 bytes, así que trocear un stream de texto por cantidad fija de bytes puede cortar un carácter multibyte al medio y corromper el string al decodificar.

#### Examples

`alloc` seguro vs `allocUnsafe` rápido pero con riesgo

```js
const safe = Buffer.alloc(10); // [0,0,0,0,0,0,0,0,0,0]
console.log(safe);

const unsafe = Buffer.allocUnsafe(10); // memoria sin inicializar
// nunca enviar `unsafe` sin sobreescribirlo entero primero
unsafe.fill(0);
```

Buffer y Uint8Array interoperan

```js
const buf = Buffer.from("hola", "utf8");
console.log(buf instanceof Uint8Array); // true
console.log(buf.length); // 4 (bytes, no caracteres)

const view = new Uint8Array(buf.buffer, buf.byteOffset, buf.length);
console.log(view); // Uint8Array de los mismos bytes
```

UTF-8 multibyte: cuidado al trocear por bytes

```js
const emoji = Buffer.from("café ☕", "utf8");
console.log(emoji.length); // 8 (é y ☕ ocupan más de 1 byte)

// Cortar en un punto arbitrario de bytes puede partir un carácter:
const cortado = emoji.subarray(0, 5);
console.log(cortado.toString("utf8")); // puede mostrar un carácter corrupto (�)
```

#### Sources

- [Node.js API, Buffer](https://nodejs.org/docs/latest/api/buffer.html)
- [Node.js API, Buffer.allocUnsafe()](https://nodejs.org/docs/latest/api/buffer.html#static-method-bufferallocunsafesize)
- [Node.js API, Buffers and character encodings](https://nodejs.org/docs/latest/api/buffer.html#buffers-and-character-encodings)

## Interview Questions

### ¿Por qué `setImmediate` se ejecuta siempre antes que `setTimeout(fn, 0)` dentro de un callback de I/O, pero el orden no está garantizado en el código top-level?

Dentro de un callback de I/O, el código corre en la fase `poll` del loop de libuv. La fase siguiente en el mismo tick es `check`, donde se ejecutan los callbacks de `setImmediate`; la fase `timers` recién se procesa en la vuelta siguiente. Por eso, en ese contexto, `setImmediate` gana siempre. En el top-level del programa no hay una fase de I/O previa que fije el punto de partida: el orden entre `timers` y `check` depende de cuánto tarda el proceso en llegar a la fase `timers` respecto al timer mínimo del sistema operativo, así que no es determinista.

### Si tenés un stream Readable leyendo un archivo de 5GB y un Writable que escribe a una red lenta, ¿qué pasa sin backpressure y cómo lo evitás?

Sin backpressure, el Readable seguiría empujando chunks al Writable más rápido de lo que la red los puede enviar, y esos chunks se acumularían en el buffer interno del Writable sin límite, hasta agotar la memoria del proceso. La forma correcta es usar `stream.pipeline()` (o `.pipe()` respetando el valor de retorno de `write()` y el evento `'drain'`), que pausa automáticamente la lectura cuando el buffer del destino supera `highWaterMark` y la reanuda cuando se libera. Además, `pipeline` se asegura de destruir todos los streams si alguno falla, evitando file descriptors colgados.

### ¿Por qué un módulo CommonJS no puede hacer `require()` de un paquete que es puramente ESM?

Porque `require()` es una API síncrona: espera devolver el `module.exports` en el mismo tick. Cargar un módulo ESM implica un paso de resolución de grafo de dependencias y linking que la especificación define como potencialmente asíncrono, incluso si en la práctica el archivo está en disco. Node no puede garantizar ese contrato síncrono para ESM, así que la única vía desde CommonJS es `import()` dinámico, que devuelve una Promise. Esto es un bloqueador real al migrar dependencias: si tu código sigue en CommonJS y una librería pasa a ser "ESM-only" (como varias del ecosistema en los últimos años), tenés que envolver el import en una función async o migrar el consumidor a ESM.

### ¿Cuándo usarías `Buffer.allocUnsafe` en vez de `Buffer.alloc`, y qué riesgo asumís al hacerlo?

Usaría `allocUnsafe` solo en un hot path donde voy a sobreescribir el buffer completo inmediatamente después de crearlo (por ejemplo, leyendo bytes exactos desde un socket hacia ese buffer), porque evita el costo de inicializar la memoria a cero. El riesgo es que, si por un bug queda alguna porción del buffer sin sobreescribir y ese buffer se envía a un cliente o se loguea, se puede filtrar memoria residual de otra parte del proceso, datos de otro request, credenciales, lo que haya estado en esa región de memoria antes. Por eso la recomendación por defecto de la documentación es `Buffer.alloc`, y `allocUnsafe` es una optimización consciente, no el default.

### Tenés que decidir si el body de un request HTTP se procesa como Buffer o como string. ¿Cómo lo definís?

Node entrega el body como Buffer por defecto (via el stream `IncomingMessage`) porque no conoce el encoding del contenido hasta inspeccionar los headers. Si el body es texto (JSON, form-urlencoded) y conozco el charset (normalmente UTF-8 por el header `Content-Type`), lo decodifico explícitamente con `Buffer.concat(chunks).toString('utf8')` recién después de haber acumulado todos los chunks, nunca decodifico chunk por chunk, porque un carácter UTF-8 multibyte puede quedar partido entre dos chunks y corromperse. Si el body es binario (upload de imagen, archivo), lo dejo como Buffer/stream y lo paso directo a donde tenga que persistirse, sin pasar por string en ningún momento.

### ¿Cómo explicarías por qué abusar de `process.nextTick()` puede colgar un servidor Node?

`process.nextTick()` agenda un callback en una cola que se procesa por completo **antes** de que el loop avance a la siguiente fase, incluso antes de I/O pendiente. Si un callback de `nextTick` agenda otro `nextTick`, y así sucesivamente sin parar, esa cola nunca se vacía del todo, y el loop jamás llega a procesar la fase `poll` donde estarían esperando las conexiones de red entrantes. El servidor queda "vivo" en términos de proceso, pero no atiende ningún request nuevo: es I/O starvation. La documentación oficial señala explícitamente este riesgo y recomienda `setImmediate` quirúrgicamente cuando se necesita diferir trabajo recursivo sin bloquear I/O.
