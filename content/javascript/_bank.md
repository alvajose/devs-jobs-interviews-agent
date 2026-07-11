---
stack: javascript
kind: question-bank
source: curated
sourceUrl: https://developer.mozilla.org
license: curated
copyright: Written from scratch citing MDN Web Docs
---

## Interview Questions

### ¿Qué es el Temporal Dead Zone (TDZ) y por qué existe?
El TDZ es el período entre el inicio del bloque de código y la línea donde se declara una variable `let` o `const`. Durante ese período, la variable existe en el scope (fue "hoisted") pero no puede leerse ni escribirse: cualquier acceso lanza un `ReferenceError`. Existe por diseño: a diferencia de `var` (que se inicializa con `undefined` al hacer hoisting), `let` y `const` no se inicializan hasta que el motor ejecuta la declaración, forzando que el código sea predecible y libre de lecturas accidentales de valores no inicializados. La clave es que el hoisting ocurrió, pero la inicialización no. (developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let#temporal_dead_zone_tdz)

```js
console.log(x); // ReferenceError: Cannot access 'x' before initialization
let x = 5;
```

### ¿Cuál es la diferencia entre hoisting de `var`, `let`/`const` y declaraciones de función?
Las declaraciones de función (`function foo() {}`) se elevan completas, nombre y cuerpo, al inicio del scope, por eso podés llamarlas antes de su declaración en el código. `var` se eleva solo el nombre, inicializado con `undefined`. `let` y `const` se elevan pero no se inicializan, cayendo en el TDZ. Las expresiones de función (`var foo = function() {}`) siguen las reglas de la variable que las contiene: `var` levanta `undefined`, `let`/`const` generan TDZ. Entender esto explica por qué es un error llamar una expresión de función antes de su asignación. (developer.mozilla.org/en-US/docs/Glossary/Hoisting)

```js
greet(); // "Hello", función declarada, hoisted completa
function greet() { console.log("Hello"); }

sayBye(); // TypeError: sayBye is not a function
var sayBye = function() { console.log("Bye"); };
```

### ¿Qué son las microtasks y cómo se diferencian de las macrotasks?
El event loop distingue dos colas: la de macrotasks (callbacks de `setTimeout`, `setInterval`, eventos del DOM) y la de microtasks (continuaciones de Promises vía `.then`/`.catch`, `queueMicrotask`, `MutationObserver`). Después de ejecutar cada macrotask, el motor vacía la cola de microtasks completa antes de renderizar o tomar la siguiente macrotask. Eso significa que promesas encadenadas en serie corren antes que cualquier timer, incluso un `setTimeout(fn, 0)`. En la práctica, esto importa para predecir orden de ejecución y evitar que promesas posterguen trabajo de UI más de lo esperado. (developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide)

```js
console.log("A");
setTimeout(() => console.log("B"), 0); // macrotask
Promise.resolve().then(() => console.log("C")); // microtask
console.log("D");
// A → D → C → B
```

### ¿Cómo funciona `call`, `apply` y `bind` y cuándo usarías cada uno?
Los tres permiten invocar una función fijando explícitamente qué será `this`. `call` invoca la función de inmediato pasando argumentos uno a uno. `apply` también invoca de inmediato pero acepta un array de argumentos (útil cuando ya tenés un array). `bind` no invoca: devuelve una nueva función con `this` fijo, útil para crear callbacks predecibles o aplicación parcial. La diferencia que más suele aparecer en entrevistas es `call` vs `apply` para argumentos variádicos, y `bind` para crear handlers que no pierdan contexto al pasarse como referencia. (developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind)

```js
function greet(greeting, punctuation) {
  return `${greeting}, ${this.name}${punctuation}`;
}
const user = { name: "Ada" };
greet.call(user, "Hello", "!");   // "Hello, Ada!"
greet.apply(user, ["Hi", "."]);   // "Hi, Ada."
const boundGreet = greet.bind(user, "Hey");
boundGreet("?"); // "Hey, Ada?"
```

### ¿Qué es currying y cómo se implementa?
Currying es transformar una función de múltiples argumentos en una cadena de funciones que cada una acepta un solo argumento. No cambia lo que hace la función, cambia cómo se la llama: en vez de `add(2, 3)` tenés `add(2)(3)`. El beneficio principal es la aplicación parcial, podés fijar algunos argumentos y reutilizar la función con distintos finales. Es un patrón de programación funcional y aparece mucho en librerías como Ramda y en composición de funciones. (developer.mozilla.org/en-US/docs/Glossary/Currying)

```js
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) {
      return fn(...args);
    }
    return (...more) => curried(...args, ...more);
  };
}

const add = curry((a, b, c) => a + b + c);
const add5 = add(5);
add5(3)(2); // 10
```

### ¿Cuál es la diferencia entre debounce y throttle?
Ambos limitan la frecuencia de ejecución de una función, pero con lógicas distintas. Debounce retrasa la ejecución hasta que pasen X milisegundos sin que se vuelva a llamar, ideal para búsqueda mientras el usuario escribe (solo ejecutar cuando terminó de tipear). Throttle garantiza que la función no se ejecute más de una vez cada X milisegundos, sin importar cuántas veces se llame, ideal para scroll o resize donde querés un ritmo constante. El error común en entrevistas es usarlos indistintamente: debounce colapsa ráfagas, throttle las distribuye en el tiempo. (developer.mozilla.org/en-US/docs/Web/API/setTimeout)

```js
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function throttle(fn, interval) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= interval) {
      last = now;
      fn(...args);
    }
  };
}
```

### ¿Qué es la delegación de eventos y por qué es más eficiente?
La delegación de eventos aprovecha el bubbling: en lugar de agregar un listener a cada elemento hijo, agregás uno solo al contenedor padre e identificás el target real desde el evento. Es más eficiente porque reduce la cantidad de listeners en memoria, funciona automáticamente con elementos agregados dinámicamente (sin necesidad de re-suscribirse), y simplifica el cleanup. La trampa es que no todos los eventos hacen bubbling (`focus`, `blur`, `scroll`), en esos casos necesitás `capture: true` o trabajar directo en el elemento. (developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Event_bubbling)

```js
document.querySelector("#list").addEventListener("click", (e) => {
  if (e.target.matches("li")) {
    console.log("Clicked item:", e.target.textContent);
  }
});
```

### ¿Cuál es la diferencia entre WeakMap/WeakSet y Map/Set?
`Map` y `Set` mantienen referencias fuertes a sus claves/valores: el objeto no puede ser recolectado por el garbage collector mientras esté en la colección. `WeakMap` y `WeakSet` mantienen referencias débiles a sus claves (que deben ser objetos): si ninguna otra parte del código referencia ese objeto, puede ser garbage collected aunque esté como clave. Esto los hace ideales para cachés o metadatos asociados a objetos que no deberías mantener vivos artificialmente. La contrapartida es que no son iterables y no tienen `.size`, porque su contenido es no determinístico (puede cambiar con el GC). (developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap)

```js
const cache = new WeakMap();
function process(obj) {
  if (!cache.has(obj)) {
    cache.set(obj, heavyComputation(obj));
  }
  return cache.get(obj);
}
// Cuando `obj` ya no tiene referencias externas, el GC puede liberarlo
// y su entrada en cache desaparece automáticamente.
```

### ¿Qué son los generadores y cuándo tiene sentido usarlos?
Un generador es una función que puede pausarse y reanudarse. Se declara con `function*` y usa `yield` para emitir valores de a uno. Cada llamada a `.next()` corre hasta el próximo `yield` y devuelve `{ value, done }`. Son útiles para secuencias lazy (no calculan el próximo valor hasta que se lo pedís), iteración de datasets grandes sin cargarlos todos en memoria, y para construir máquinas de estado explícitas. `async/await` está internamente construido sobre generadores e iteradores. (developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*)

```js
function* range(start, end) {
  for (let i = start; i <= end; i++) {
    yield i;
  }
}

const nums = range(1, 1000000); // no aloca el array completo
nums.next(); // { value: 1, done: false }
nums.next(); // { value: 2, done: false }

for (const n of range(1, 5)) {
  console.log(n); // 1, 2, 3, 4, 5
}
```

### ¿Cuál es la diferencia entre ES Modules y CommonJS?
ES Modules (`import`/`export`) son el estándar nativo del lenguaje, analizados estáticamente antes de ejecutar, eso habilita tree-shaking y detección de errores de importación en tiempo de compilación. CommonJS (`require`/`module.exports`) es el sistema de Node.js original, dinámico y síncrono. La diferencia clave: ESM resuelve imports de forma asíncrona y su binding es vivo (si el módulo exportado cambia el valor, el importador ve el cambio); CommonJS copia el valor en el momento del require. En proyectos modernos, ESM es la elección por defecto; CommonJS sigue siendo relevante en código legacy de Node o cuando necesitás requires dinámicos con lógica en runtime. (developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)

```js
// ESM, binding vivo
export let count = 0;
export function increment() { count++; }

// En otro módulo:
import { count, increment } from "./counter.js";
increment();
console.log(count); // 1, ve el valor actualizado
```

### ¿Qué son Proxy y Reflect y para qué sirven?
`Proxy` permite interceptar operaciones fundamentales sobre un objeto: lectura de propiedades (`get`), escritura (`set`), llamadas a función (`apply`), `in`, `delete`, etc. Cada interceptor se llama "trap". `Reflect` es el espejo: provee los mismos métodos pero como funciones explícitas, útiles para reenviar la operación original desde dentro del trap sin perder semántica. Son la base de frameworks reactivos (Vue 3 usa Proxy para su sistema de reactividad), de validación transparente, logging de accesos, y objetos "mock" observables. El caso de uso más común en entrevistas es validación o logging sin modificar el objeto original. (developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)

```js
const validator = new Proxy({}, {
  set(target, key, value) {
    if (key === "age" && typeof value !== "number") {
      throw new TypeError("age must be a number");
    }
    return Reflect.set(target, key, value);
  },
});

validator.age = 25; // OK
validator.age = "old"; // TypeError
```

### ¿Qué provoca memory leaks en JavaScript y cómo prevenirlos?
Un memory leak ocurre cuando el garbage collector no puede liberar memoria que ya no es necesaria porque todavía existe una referencia activa hacia ella. Las causas más comunes: listeners de eventos no removidos cuando el componente se destruye, closures que retienen referencias a objetos grandes sin querer, timers (`setInterval`) que no se limpian, variables globales acumuladas, y cachés sin límite de tamaño. En aplicaciones SPA, el patrón más peligroso es agregar listeners a `window` o a elementos del DOM desde un componente y nunca removerlos al desmontarlo. La herramienta de diagnóstico es el Memory panel de DevTools: buscar heap snapshots crecientes o retained trees con nodos que no deberían existir. (developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_management)

```js
// Leak: el listener retiene la referencia al componente grande
window.addEventListener("resize", this.handleResize);

// Fix: limpiar en destroy/unmount
componentWillUnmount() {
  window.removeEventListener("resize", this.handleResize);
}
```

### ¿Qué es `structuredClone` y cuándo usarlo en lugar de `JSON.parse(JSON.stringify())`?
`structuredClone` es la API nativa del navegador/Node para hacer una copia profunda de un objeto usando el Structured Clone Algorithm. A diferencia del truco de JSON, maneja correctamente `Date`, `Map`, `Set`, `ArrayBuffer`, `RegExp`, referencias circulares, y tipos como `Blob`. El truco de JSON falla con `undefined`, funciones, `Date` (las convierte en string), referencias circulares (lanza error), y tipos no serializables. `structuredClone` no puede clonar funciones, nodos del DOM ni ciertos objetos del sistema. Para la mayoría de copias profundas en código de aplicación, `structuredClone` es la opción correcta y más segura. (developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone)

```js
const original = {
  date: new Date(),
  map: new Map([["key", "value"]]),
  nested: { arr: [1, 2, 3] },
};

const clone = structuredClone(original);
clone.nested.arr.push(4);
console.log(original.nested.arr); // [1, 2, 3], no mutado
console.log(clone.date instanceof Date); // true
```

### ¿Qué es el optional chaining (`?.`) y el nullish coalescing (`??`)?
`?.` permite acceder a propiedades o llamar métodos en cadena sin lanzar `TypeError` si algún paso es `null` o `undefined`: simplemente retorna `undefined` en ese punto. `??` devuelve el operando de la derecha solo cuando el de la izquierda es `null` o `undefined`, a diferencia de `||` que dispara también para `0`, `""`, y `false`. Usados juntos son la forma idiomática de acceder a datos opcionales con fallbacks, reemplazando patrones verbosos de guardas con `&&`. El error común es confundir `??` con `||`: si esperás que `0` o `""` sean valores válidos, necesitás `??`. (developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining)

```js
const user = { profile: null };

// Con optional chaining, no lanza, retorna undefined
const city = user?.profile?.address?.city;

// Con nullish coalescing, solo cae al default si es null/undefined
const displayName = user?.name ?? "Anónimo";
const port = config.port ?? 3000; // 0 sería válido, || lo reemplazaría
```

### ¿Qué son los tagged template literals y cuándo tienen sentido?
Un tagged template literal permite procesar un template string con una función: la función recibe el array de strings literales y los valores interpolados como argumentos separados, y puede retornar cualquier cosa. Son la base de librerías como `styled-components` (CSS en JS), `graphql` (parsing de queries), y herramientas de sanitización de HTML. La ventaja es que podés controlar exactamente cómo se combinan las partes, habilitar sanitización de input, o generar estructuras de datos en lugar de strings. Es una característica avanzada que pocas veces se usa directamente, pero conocer su mecanismo ayuda a entender cómo funcionan esas librerías. (developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates)

```js
function highlight(strings, ...values) {
  return strings.reduce((result, str, i) => {
    const val = values[i - 1];
    return result + `<strong>${val}</strong>` + str;
  });
}

const name = "Ada";
const age = 30;
highlight`Mi nombre es ${name} y tengo ${age} años.`;
// "Mi nombre es <strong>Ada</strong> y tengo <strong>30</strong> años."
```

### ¿Qué es el patrón de aplicación parcial y en qué se diferencia de currying?
Currying transforma una función en una cadena de funciones de un argumento cada una. Aplicación parcial fija algunos argumentos de una función y devuelve una nueva función que acepta el resto, no necesariamente de a uno. La diferencia es que la aplicación parcial puede fijar múltiples argumentos en un solo paso, y no requiere que la función original sea curried. En JavaScript, `Function.prototype.bind` es la forma nativa de aplicación parcial: `fn.bind(thisArg, arg1, arg2)` fija `this`, `arg1` y `arg2`. En composición funcional, la aplicación parcial es más flexible para adaptar APIs que currying estricto. (developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind)

```js
function multiply(a, b, c) {
  return a * b * c;
}

// Aplicación parcial con bind
const double = multiply.bind(null, 2);
double(3, 4); // 24, fijó `a`, recibe b y c juntos

// Vs currying: multiply(2)(3)(4)
```

### ¿Qué es la cadena de prototipos (`[[Prototype]]`) y cómo funciona la herencia?
Cuando accedés a una propiedad de un objeto que no existe en él, el motor busca en su prototipo (`[[Prototype]]`), luego en el prototipo de ese prototipo, y así hasta llegar a `Object.prototype` cuyo prototipo es `null`. Esa cadena es la "prototype chain". `Object.create(proto)` crea un objeto con `[[Prototype]]` apuntando explícitamente a `proto`. La diferencia entre `__proto__` (accessor no estándar pero ampliamente soportado) y `Object.getPrototypeOf()` (la forma estándar) importa en código de producción. Modificar prototipos de objetos built-in (`Array.prototype`, `Object.prototype`) es peligroso porque afecta a todo código que use esos objetos. (developer.mozilla.org/en-US/docs/Web/JavaScript/Inheritance_and_the_prototype_chain)

```js
const animal = { breathe() { return "breathing"; } };
const dog = Object.create(animal);
dog.bark = function() { return "woof"; };

dog.breathe(); // "breathing", encontrado en [[Prototype]]
Object.getPrototypeOf(dog) === animal; // true
dog.hasOwnProperty("breathe"); // false
```

### ¿Cuál es la diferencia entre `Promise.all`, `Promise.allSettled`, `Promise.race` y `Promise.any`?
`Promise.all` espera que todas se resuelvan; si alguna rechaza, rechaza todo el conjunto inmediatamente (fail-fast). `Promise.allSettled` espera que todas terminen (sean fulfilled o rejected) y devuelve un array con el resultado de cada una, nunca rechaza. `Promise.race` resuelve o rechaza con la primera que termine, sin importar cuál sea. `Promise.any` resuelve con la primera que se cumpla; solo rechaza si TODAS rechazan, con un `AggregateError`. La elección correcta depende de la semántica: si todas son necesarias usá `all`; si querés resultados parciales usá `allSettled`; si necesitás timeout o "el más rápido" usá `race`; si necesitás "al menos uno exitoso" usá `any`. (developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled)

```js
const p1 = fetch("/api/user");
const p2 = fetch("/api/orders");
const p3 = fetch("/api/settings");

// Necesito los tres o nada
const [user, orders, settings] = await Promise.all([p1, p2, p3]);

// Quiero saber qué funcionó y qué no
const results = await Promise.allSettled([p1, p2, p3]);
results.forEach(r => {
  if (r.status === "fulfilled") console.log(r.value);
  else console.error(r.reason);
});
```

### ¿Cómo manejar errores en async/await correctamente?
`async/await` no elimina errores no manejados, los mueve a excepciones síncronas dentro del contexto async. Si un `await` rechaza y no hay `try/catch`, la función async devuelve una Promise rechazada. El patrón `try/catch/finally` es el más legible para errores esperados. Para errores globales no capturados, el navegador emite `unhandledrejection`. Un patrón alternativo es un helper que convierte la Promise en `[error, data]` al estilo Go, evitando try/catch anidados en flujos complejos. El error más común es mezclar `.catch()` con `try/catch` sin saber cuál maneja qué, elegí uno y sé consistente. (developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch)

```js
// Patrón básico
async function loadUser(id) {
  try {
    const res = await fetch(`/api/users/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("Failed to load user:", err);
    return null;
  } finally {
    hideSpinner();
  }
}

// Patrón helper para múltiples awaits sin try/catch anidado
const to = (p) => p.then(data => [null, data]).catch(err => [err, null]);
const [err, user] = await to(fetchUser(1));
```

### ¿Qué es una IIFE y por qué se usaba tanto antes de los módulos?
Una IIFE (Immediately Invoked Function Expression) es una función que se declara y ejecuta en el mismo lugar. Su propósito era crear un scope privado para evitar contaminar el scope global, que era el único mecanismo disponible antes de que existieran los módulos ES o CommonJS. Los patrones de module pre-ES6 (Revealing Module Pattern, AMD, UMD) se basaban en IIFEs. Hoy su uso directo disminuyó porque los módulos ES resuelven el problema de scope de forma nativa, pero siguen siendo útiles en scripts inline, inicialización de configuraciones, o cuando necesitás un bloque de código async en un contexto que no admite top-level await. (developer.mozilla.org/en-US/docs/Glossary/IIFE)

```js
// Scope privado sin contaminar window
const counter = (function () {
  let count = 0;
  return {
    increment: () => ++count,
    value: () => count,
  };
})();

counter.increment();
counter.value(); // 1
// `count` no es accesible desde fuera
```

### ¿Qué es memoización y cómo se implementa?
Memoización es una técnica de optimización que cachea el resultado de una función para una combinación dada de argumentos, evitando recalcularlo si la función vuelve a llamarse con los mismos inputs. Funciona solo en funciones puras (mismos inputs → mismo output, sin side effects). El tradeoff es memoria vs CPU. Es especialmente útil para funciones recursivas costosas (Fibonacci, cálculos de DP) o funciones con inputs referenciables como strings o números. Para objetos como keys, necesitás serialización o una estrategia de caché más sofisticada. (developer.mozilla.org/en-US/docs/Web/JavaScript/Closures)

```js
function memoize(fn) {
  const cache = new Map();
  return function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

const expensiveFn = memoize((n) => {
  console.log("Computing...");
  return n * n;
});

expensiveFn(5); // Computing... 25
expensiveFn(5); // 25, desde caché, sin log
```

### ¿Qué es el patrón de iterador y cómo se implementa el protocolo de iteración?
El protocolo de iteración de JavaScript define que un objeto es iterable si tiene un método `[Symbol.iterator]` que devuelve un iterador. Un iterador es un objeto con un método `next()` que devuelve `{ value, done }`. Este protocolo habilita `for...of`, spread, destructuring, y `Array.from` sobre cualquier objeto personalizado. Los generadores implementan este protocolo automáticamente. Crear iteradores personalizados tiene sentido cuando querés modelar una secuencia lazy, un recurso paginado, o una estructura de datos custom que necesita ser traversable. (developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols)

```js
const range = {
  from: 1,
  to: 5,
  [Symbol.iterator]() {
    let current = this.from;
    const last = this.to;
    return {
      next() {
        return current <= last
          ? { value: current++, done: false }
          : { value: undefined, done: true };
      },
    };
  },
};

for (const n of range) console.log(n); // 1, 2, 3, 4, 5
[...range]; // [1, 2, 3, 4, 5]
```

### ¿Cuál es la diferencia entre `Object.freeze` y `Object.seal`?
`Object.freeze` hace que un objeto sea completamente inmutable: no podés agregar propiedades, eliminarlas, ni modificar sus valores. `Object.seal` permite modificar propiedades existentes pero no agregar ni eliminar. Ambos son shallow, no afectan objetos anidados. En código defensivo, `freeze` se usa para constantes de configuración que nunca deben cambiar. El congelamiento no es recursivo: si una propiedad es un objeto, ese objeto interno sigue siendo mutable a menos que también lo congeles explícitamente. TypeScript con `as const` y `readonly` provee garantías similares en tiempo de compilación. (developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze)

```js
const config = Object.freeze({ host: "localhost", port: 3000 });
config.port = 8080; // Silencioso en non-strict, TypeError en strict
console.log(config.port); // 3000

const settings = Object.seal({ theme: "dark", lang: "es" });
settings.theme = "light"; // OK, modificar sí se puede
settings.newProp = "x"; // Silencioso o TypeError, agregar no se puede
```

### ¿Qué es la diferencia entre copia shallow y copia deep?
Una copia shallow crea un nuevo objeto en el nivel raíz pero comparte referencias a los objetos anidados, si modificás el anidado, ambos lo ven. Una copia deep replica toda la estructura recursivamente. `Object.assign`, spread (`{...obj}`), y `Array.prototype.slice` son shallow. `structuredClone` es la forma nativa de copia profunda. El tradeoff es rendimiento: copias profundas de objetos grandes son costosas. En React, la inmutabilidad de estado suele requerir al menos una copia shallow del nivel que cambió; la copia profunda es necesaria solo cuando necesitás romper toda referencia compartida. (developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone)

```js
const original = { a: 1, nested: { b: 2 } };

// Shallow: nested es la misma referencia
const shallow = { ...original };
shallow.nested.b = 99;
console.log(original.nested.b); // 99, mutado!

// Deep: copia total independiente
const deep = structuredClone(original);
deep.nested.b = 99;
console.log(original.nested.b); // 2, intacto
```

### ¿Qué son las funciones de orden superior (higher-order functions)?
Una función de orden superior es aquella que acepta funciones como argumentos, devuelve una función, o ambas cosas. Es el concepto central de programación funcional en JavaScript. `map`, `filter`, `reduce`, `sort` son higher-order functions de la API estándar de arrays. El valor real está en que permiten separar el "qué hacer" (la lógica de negocio) del "cómo iterar" (la estructura de control). Las funciones que devuelven funciones (como `memoize`, `debounce`, `curry`) también son higher-order. Reconocerlas ayuda a leer código funcional y a diseñar APIs componibles. (developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map)

```js
// map, filter, reduce son higher-order: reciben funciones
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
const evens = numbers.filter(n => n % 2 === 0);
const sum = numbers.reduce((acc, n) => acc + n, 0);

// Crear una higher-order function
function withLogging(fn) {
  return function (...args) {
    console.log("Calling with", args);
    const result = fn(...args);
    console.log("Result:", result);
    return result;
  };
}
```

### ¿Qué es el contexto de ejecución y el call stack?
Cada vez que JavaScript ejecuta código, crea un contexto de ejecución que contiene: el entorno de variables locales, el binding de `this`, y la referencia al scope exterior. El global execution context es el primero. Cada llamada a función crea uno nuevo que se apila en el call stack. Cuando la función retorna, su contexto se saca del stack. Si el stack crece sin límite (recursión infinita), se produce un "Maximum call stack size exceeded". Entender el call stack es fundamental para leer stack traces, entender el scope de variables, y saber por qué código asíncrono (timers, promises) corre después del stack actual. (developer.mozilla.org/en-US/docs/Glossary/Call_stack)

```js
function c() { return "c"; }
function b() { return c(); }
function a() { return b(); }

a();
// Stack en el momento pico: [global, a, b, c]
// Cuando c retorna: [global, a, b]
// Cuando b retorna: [global, a]
// Cuando a retorna: [global]
```

### ¿Cuál es la diferencia entre `for...of` y `for...in`?
`for...in` itera sobre las claves enumerables de un objeto y de toda su cadena de prototipos, diseñado para objetos planos pero peligroso sobre arrays porque puede incluir propiedades agregadas al prototipo. `for...of` itera sobre los valores de cualquier objeto iterable (`Array`, `Map`, `Set`, `String`, generadores) usando el protocolo de iteración. Para arrays, casi siempre querés `for...of`. Para objetos planos donde necesitás las claves, usá `Object.keys()` o `Object.entries()` combinado con `for...of`. Confundir los dos es un bug clásico. (developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of)

```js
const arr = [10, 20, 30];

for (const val of arr) console.log(val);  // 10, 20, 30, valores
for (const key in arr) console.log(key);  // "0", "1", "2", índices como strings

const map = new Map([["a", 1], ["b", 2]]);
for (const [key, val] of map) console.log(key, val); // "a" 1, "b" 2
```

### ¿Qué es `Symbol` y para qué se usa en la práctica?
`Symbol` crea un valor primitivo único e irrepetible, dos `Symbol()` nunca son iguales. Se usan principalmente para crear claves de propiedad que no colisionan con otras claves, para implementar protocolos del lenguaje (como `Symbol.iterator`, `Symbol.toPrimitive`, `Symbol.hasInstance`), y para agregar propiedades a objetos externos sin riesgo de sobreescribir nada existente. Son no enumerables por `for...in` ni `Object.keys`, pero sí accesibles vía `Object.getOwnPropertySymbols`. En librerías, los Symbols permiten agregar metadatos internos a objetos del usuario de forma no invasiva. (developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol)

```js
const ID = Symbol("id");
const user = { name: "Ada", [ID]: 42 };

console.log(user[ID]); // 42
console.log(Object.keys(user)); // ["name"], ID no aparece
console.log(Symbol("id") === Symbol("id")); // false, cada uno es único

// Protocol built-in
class Collection {
  [Symbol.iterator]() { /* ... */ }
}
```

### ¿Qué son las funciones puras y por qué importan en JavaScript?
Una función pura cumple dos condiciones: mismo input siempre produce mismo output (determinismo), y no tiene side effects (no modifica estado externo, no hace I/O, no lanza excepciones dependientes de estado global). Importan porque son predecibles, testeables de forma aislada, y componibles. En React, los componentes funcionales y los reducers de Redux son contratos de funciones puras. En programación funcional, la pureza permite optimizaciones como memoización y evaluación lazy. El error frecuente es asumir que una función es pura cuando mutila un objeto que recibió como argumento o depende de una variable del scope externo que puede cambiar. (developer.mozilla.org/en-US/docs/Glossary/Pure_function)

```js
// Pura: determinista, sin side effects
const add = (a, b) => a + b;

// Impura: depende de estado externo
let tax = 0.21;
const withTax = (price) => price * (1 + tax); // si tax cambia, cambia el output

// Impura: muta el argumento
function addItem(cart, item) {
  cart.push(item); // side effect sobre el parámetro
  return cart;
}

// Pura: no muta
const addItem = (cart, item) => [...cart, item];
```

### ¿Qué es la diferencia entre `null` y `undefined`?
`undefined` es el valor por defecto de una variable declarada pero no asignada, de un parámetro no pasado, o de una propiedad que no existe en un objeto. `null` es un valor explícito asignado por el programador para indicar "sin valor intencionalmente". La distinción importa en APIs: si una función devuelve `undefined`, probablemente olvidaste manejar un caso; si devuelve `null`, es una decisión explícita. `typeof null === "object"` es el bug histórico más famoso de JavaScript, no te dice nada sobre el tipo real. Para chequeos de nulidad usa `=== null` o `=== undefined` explícitamente, o `?? / ?.` para ambos. (developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/null)

```js
let a;
console.log(a); // undefined, declarada sin valor

const obj = {};
console.log(obj.name); // undefined, propiedad inexistente

const b = null; // intención explícita: "sin valor"

console.log(null == undefined);  // true, igualdad débil
console.log(null === undefined); // false, tipos distintos
console.log(typeof null);        // "object", bug histórico
```

### ¿Qué es AbortController y para qué se usa?
`AbortController` permite cancelar operaciones asíncronas como `fetch` o cualquier API que acepte una `AbortSignal`. El controlador expone un `signal` que pasás a la operación, y cuando llamás `.abort()`, la operación es cancelada y lanza un `AbortError`. Es esencial en aplicaciones SPA donde el usuario puede navegar o deshacerse de un componente antes de que una request termine, sin cancelación, el callback de una request vieja puede actualizar estado de un componente ya desmontado. También sirve para implementar timeouts propios. (developer.mozilla.org/en-US/docs/Web/API/AbortController)

```js
const controller = new AbortController();
const { signal } = controller;

// Timeout de 5 segundos
const timeoutId = setTimeout(() => controller.abort(), 5000);

try {
  const res = await fetch("/api/data", { signal });
  clearTimeout(timeoutId);
  const data = await res.json();
} catch (err) {
  if (err.name === "AbortError") {
    console.log("Request was cancelled");
  }
}
```

### ¿Qué son los Web Workers y cuándo los necesitás?
Los Web Workers permiten ejecutar JavaScript en un hilo de fondo, separado del hilo principal de la UI. El hilo principal es single-threaded, y cualquier cálculo pesado bloqueará el renderizado y las interacciones. Los Workers resuelven eso: corren en paralelo y se comunican con el hilo principal vía `postMessage` / `onmessage`, pasando datos por valor (copia) o usando `Transferable` para buffers sin copia. Son adecuados para procesamiento de imágenes, parsing de archivos grandes, cálculos intensivos (crypto, física, ML). La restricción importante es que los Workers no tienen acceso al DOM ni a muchas APIs del navegador. (developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)

```js
// main.js
const worker = new Worker("worker.js");
worker.postMessage({ data: hugeArray });
worker.onmessage = (e) => console.log("Result:", e.data);

// worker.js
self.onmessage = (e) => {
  const result = expensiveProcess(e.data.data);
  self.postMessage(result);
};
```

### ¿Cómo funciona `Object.assign` y en qué se diferencia del spread de objetos?
`Object.assign(target, ...sources)` copia propiedades enumerables propias de los sources al target, mutando target y devolviéndolo. El spread de objetos (`{...source}`) crea un nuevo objeto con las mismas propiedades sin mutar nada. Ambos son shallow. La diferencia práctica: `Object.assign` puede mutar un objeto existente (útil para merge in-place); spread siempre crea uno nuevo (preferido en Redux y React para inmutabilidad). Ambos invocan setters si existen en el target, pero solo `Object.assign`, el spread los define directamente. Para crear objetos inmutablemente en funciones de estado, el spread es la convención. (developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)

```js
const defaults = { theme: "light", lang: "en", timeout: 3000 };
const userPrefs = { theme: "dark" };

// Spread: nuevo objeto, sin mutar
const config = { ...defaults, ...userPrefs };
// { theme: "dark", lang: "en", timeout: 3000 }

// Object.assign: muta el primer argumento
Object.assign(defaults, userPrefs); // cuidado: modifica defaults
```

### ¿Qué es el patrón de composición de funciones (`compose` y `pipe`)?
`compose` y `pipe` son funciones de orden superior que combinan varias funciones en una sola. `compose` las aplica de derecha a izquierda (matemáticamente: `f(g(x))`); `pipe` de izquierda a derecha (más legible para muchos). Permiten construir transformaciones complejas como cadenas de funciones puras sin variables intermedias. No están en el estándar de JavaScript pero son triviales de implementar. Librerías como Ramda y RxJS las proveen. El valor real está en que cada paso es una función pura testeable y reutilizable. (developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions)

```js
const compose = (...fns) => (x) => fns.reduceRight((acc, fn) => fn(acc), x);
const pipe = (...fns) => (x) => fns.reduce((acc, fn) => fn(acc), x);

const trim = (s) => s.trim();
const toLower = (s) => s.toLowerCase();
const slugify = (s) => s.replace(/\s+/g, "-");

const toSlug = pipe(trim, toLower, slugify);
toSlug("  Hello World  "); // "hello-world"
```

### ¿Qué es la diferencia entre `==` y `===` en JavaScript?
`===` (igualdad estricta) compara valor y tipo sin conversión. `==` (igualdad abstracta) aplica coerción de tipos antes de comparar, siguiendo un algoritmo complejo definido en la spec. El problema de `==` es que produce resultados contraintuitivos: `0 == ""` es `true`, `null == undefined` es `true`, `[] == false` es `true`. La regla práctica es usar siempre `===` excepto en el caso específico de `value == null` (que es la forma idiomática de chequear `null` y `undefined` a la vez). Conocer la coerción de tipos explica por qué JavaScript tiene esa reputación de comportamiento "raro". (developer.mozilla.org/en-US/docs/Web/JavaScript/Equality_comparisons_and_sameness)

```js
0 == ""       // true, coerción
0 === ""      // false, tipos distintos
null == undefined // true, caso especial
null === undefined // false
[] == false   // true, cadena de coerciones
[] === false  // false

// Único uso idiomático de ==
if (value == null) { /* null o undefined */ }
```

### ¿Qué es `strict mode` y qué comportamientos cambia?
`"use strict"` activa el modo estricto, que restringe comportamientos inseguros o ambiguos del lenguaje. Convierte errores silenciosos en excepciones (escribir en propiedades no-writable, usar variables no declaradas), deshabilita `with`, cambia el valor de `this` en funciones no metódicas a `undefined` en lugar de `window`, y previene nombres de parámetros duplicados. Los módulos ES y las clases son siempre strict por defecto, lo que hace que en código moderno el `"use strict"` explícito sea menos necesario. Su importancia en entrevistas es que demuestra conocimiento de cómo JavaScript maneja errores por defecto vs de forma explícita. (developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode)

```js
"use strict";

x = 10; // ReferenceError: x is not defined (sin strict: crea global silenciosamente)

function loose() {
  console.log(this); // window (non-strict)
}
function strict() {
  "use strict";
  console.log(this); // undefined
}
```

### ¿Qué es el concepto de "pass by value" vs "pass by reference" en JavaScript?
JavaScript es siempre "pass by value", pero el valor de un objeto ES una referencia. Los tipos primitivos (`number`, `string`, `boolean`, `null`, `undefined`, `symbol`, `bigint`) se pasan como copia: modificar el parámetro no afecta el original. Los objetos se pasan como referencia: podés mutar sus propiedades internas y el exterior lo ve. Pero reasignar el parámetro (hacerle apuntar a otro objeto) no afecta la variable original, por eso no es "pass by reference" en el sentido estricto de C++. Entender esto es crucial para saber cuándo necesitás clonar objetos antes de modificarlos. (developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures)

```js
// Primitivo: se pasa copia
let n = 5;
function change(x) { x = 10; }
change(n);
console.log(n); // 5, no cambió

// Objeto: se pasa referencia al valor
const obj = { count: 0 };
function increment(o) { o.count++; } // muta el objeto original
increment(obj);
console.log(obj.count); // 1, sí cambió

// Pero reasignar el parámetro no afecta al exterior
function replace(o) { o = { count: 99 }; }
replace(obj);
console.log(obj.count); // 1, sigue siendo 1
```

### ¿Qué son las variables globales implícitas y por qué son peligrosas?
En non-strict mode, asignar un valor a una variable no declarada crea automáticamente una propiedad en el objeto global (`window` en browsers). Es uno de los bugs más silenciosos de JavaScript: el código funciona, pero el estado creado accidentalmente puede ser leído o sobreescrito desde cualquier parte. En aplicaciones con múltiples scripts o librerías de terceros, las colisiones de nombres globales son una fuente frecuente de errores difíciles de rastrear. Strict mode convierte esto en un `ReferenceError`. La solución definitiva son los módulos ES, donde el scope por defecto es siempre local al módulo. (developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode)

```js
// Non-strict: crea window.typo sin error
function bad() {
  typo = "accidental global"; // faltó let/const/var
}
bad();
console.log(window.typo); // "accidental global"

// Strict mode o ESM: ReferenceError inmediato
"use strict";
function safe() {
  typo = "error"; // ReferenceError: typo is not defined
}
```

### ¿Qué son `Map` y `Set` y cuándo preferirlos sobre objetos y arrays?
`Map` es una colección de pares clave-valor donde cualquier tipo puede ser clave (objetos, funciones, primitivos). A diferencia de un objeto plano, no hereda propiedades de `Object.prototype`, mantiene el orden de inserción y tiene `.size`. `Set` es una colección de valores únicos con el mismo modelo. Preferís `Map` sobre objeto cuando las claves no son strings/símbolos, cuando necesitás iterar en orden de inserción con garantías, o cuando necesitás frecuentes adds/deletes. Preferís `Set` para deduplicar valores o cuando la semántica de "colección sin duplicados" hace el código más expresivo. (developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map)

```js
const map = new Map();
const key = { id: 1 };
map.set(key, "metadata");
map.get(key); // "metadata", objeto como clave

// Deduplicar con Set
const unique = [...new Set([1, 2, 2, 3, 3, 3])]; // [1, 2, 3]

// Frecuencia de palabras: Map es más apropiado que objeto
const freq = new Map();
for (const word of words) {
  freq.set(word, (freq.get(word) ?? 0) + 1);
}
```

### ¿Qué es la recursión de cola (tail call optimization) y soporta JavaScript?
Una llamada es "tail call" cuando es la última operación de la función, no hay trabajo pendiente después de que retorne. La optimización de tail calls reutiliza el mismo frame del stack en lugar de apilar uno nuevo, permitiendo recursión sin crecer el stack. La especificación ES2015 la incluyó como obligatoria en strict mode, pero en la práctica solo Safari la implementó. En V8 (Node, Chrome) y SpiderMonkey (Firefox) no está disponible. Por eso, en JavaScript práctico, la recursión profunda igual puede causar stack overflow, y la solución real es trampolining o convertir a iteración. Vale saber la teoría aunque la implementación sea inconsistente. (developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/return)

```js
// No tail call: hay una multiplicación pendiente después de la llamada recursiva
function factorial(n) {
  if (n === 0) return 1;
  return n * factorial(n - 1); // pendiente: n * (resultado)
}

// Tail call: el return es directamente la llamada recursiva
function factorial(n, acc = 1) {
  if (n === 0) return acc;
  return factorial(n - 1, n * acc); // tail position
}
```

### ¿Qué es la diferencia entre declaración de función y expresión de función?
Una declaración de función (`function foo() {}`) se hoistea completamente y está disponible en todo el scope antes de su línea. Una expresión de función (`const foo = function() {}` o `const foo = () => {}`) sigue las reglas de la variable que la contiene. Además, las declaraciones de función siempre tienen nombre propio, lo que mejora los stack traces; las expresiones pueden ser anónimas. En código moderno, las funciones flecha como expresiones son ubicuas, pero entender la diferencia de hoisting previene errores cuando el orden de definición importa. También hay diferencias de binding de `this`: las arrows no tienen el suyo. (developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)

```js
// Declaración: usable antes de ser definida
greet(); // "Hello"
function greet() { console.log("Hello"); }

// Expresión: TDZ o undefined antes de la asignación
sayBye(); // ReferenceError o TypeError
const sayBye = () => console.log("Bye");
```

### ¿Qué es `queueMicrotask` y en qué se diferencia de `Promise.resolve().then()`?
`queueMicrotask` encola explícitamente una función en la microtask queue, exactamente igual que hacer `Promise.resolve().then(fn)`. La diferencia es semántica y de rendimiento: `queueMicrotask` comunica la intención directamente (no necesitás crear una Promise solo para encolar trabajo), y evita el overhead de construir un objeto Promise. También es más explícito en el código: quien lee sabe que es una microtask, no una operación asíncrona real. Se usa para diferir trabajo hasta después del código síncrono actual sin salir del contexto de microtasks, útil en librerías que batchean updates. (developer.mozilla.org/en-US/docs/Web/API/Window/queueMicrotask)

```js
console.log("1, sync");

queueMicrotask(() => console.log("3, microtask"));

Promise.resolve().then(() => console.log("4, promise microtask"));

setTimeout(() => console.log("5, macrotask"), 0);

console.log("2, sync");

// Output: 1, 2, 3, 4, 5
```

### ¿Cómo funciona el garbage collector en JavaScript y qué algoritmo usa?
El motor de JavaScript usa principalmente el algoritmo de "mark-and-sweep". El GC periódicamente parte desde las raíces (variables globales, call stack activo) y marca todos los objetos alcanzables. Lo que no se marcó es basura y puede ser liberado. La generación V8 también usa un modelo generacional: la memoria se divide en joven y vieja. Objetos jóvenes se recolectan frecuentemente (minor GC, barato); los que sobreviven varios ciclos pasan a la vieja generación (major GC, más costoso). Esto implica que objetos de larga vida que generan garbage al actualizarse (por ejemplo, reconstruir arrays grandes frecuentemente) presionan al major GC y pueden causar jank. Entender esto ayuda a diseñar código con menos presión sobre el GC. (developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_management)

```js
// Objeto alcanzable, no puede ser recolectado
const aliveRef = { data: "important" };

// Objeto inalcanzable, candidato a GC
function createGarbage() {
  const temp = { data: new Array(1000).fill(0) };
  // temp sale de scope aquí, ya no es alcanzable
}
createGarbage();

// Referencia circular ya no es problema para mark-and-sweep
// (sí lo era para el viejo reference counting)
```
