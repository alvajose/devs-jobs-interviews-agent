---
stack: javascript
id: javascript-fundamentals
title: Fundamentos de JavaScript
area: Lenguaje
priority: high
resourceLabel: MDN, JavaScript Guide
resourceUrl: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide
---

## Summary
Conceptos base de JavaScript que aparecen constantemente en entrevistas: closures, asincronía, `this`, prototipos y promesas.

## Concepts

### Closures
#### Details
Una closure ocurre cuando una función conserva acceso a su ámbito léxico aunque la función externa ya haya terminado de ejecutarse. MDN lo define como la combinación de una función y las referencias al estado que la rodea. En entrevista, lo importante es explicar que JavaScript no copia el valor: la función interna mantiene una referencia al entorno donde fue creada.

Esto permite encapsular estado privado, crear function factories, mantener datos entre llamadas y construir callbacks que recuerdan contexto. También explica bugs comunes con loops, timers y handlers: varias funciones pueden cerrar sobre la misma variable si esa variable pertenece al mismo entorno.

En diseño real, closures aparecen en módulos, handlers de eventos, memoización, debouncing, currying y APIs que devuelven funciones. Saber explicarlas bien ayuda a razonar sobre memoria, estado retenido y por qué una función puede ver valores "viejos" o compartidos.

#### Examples
Estado privado entre llamadas
```js
function createCounter() {
  let count = 0;

  return function increment() {
    count += 1;
    return count;
  };
}

const counter = createCounter();
console.log(counter()); // 1
console.log(counter()); // 2
```

Factory de funciones
```js
function makeAdder(x) {
  return function add(y) {
    return x + y;
  };
}

const add10 = makeAdder(10);
console.log(add10(5)); // 15
```

Closure útil para configurar un handler
```js
function trackButton(buttonName) {
  return function handleClick() {
    analytics.track("button_clicked", { buttonName });
  };
}

saveButton.addEventListener("click", trackButton("save"));
```

Bug clásico: closures sobre la misma variable
```js
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// 3, 3, 3 porque `var` comparte el mismo binding.

for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// 0, 1, 2 porque `let` crea un binding por iteración.
```

#### Sources
- [MDN, Closures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures)

### Event Loop y asincronía
#### Details
JavaScript ejecuta código en jobs dentro de un event loop. La idea central de MDN es "run-to-completion": cuando un job empieza, corre hasta terminar antes de que otro job pueda ejecutarse. Por eso un cálculo bloqueante congela la UI aunque haya callbacks esperando.

La asincronía no significa paralelismo automático. `setTimeout`, eventos, promises y APIs del navegador programan trabajo para después; el call stack actual debe vaciarse antes de que ese trabajo continúe. En entrevistas, suele importar distinguir código síncrono, timers y microtasks de promises.

Las promises representan un resultado eventual y sus callbacks (`then`, `catch`, `finally` o continuaciones de `await`) corren cuando la promise se resuelve o rechaza. Entender esto ayuda a predecir orden de logs, evitar race conditions y diseñar flujos robustos con `Promise.all`, retries o cancelación.

#### Examples
Run-to-completion: el código síncrono termina primero
```js
console.log("A");

setTimeout(() => {
  console.log("B");
}, 0);

console.log("C");

// A
// C
// B
```

Promises se resuelven después del stack actual
```js
console.log("start");

Promise.resolve().then(() => {
  console.log("promise");
});

console.log("end");

// start
// end
// promise
```

Esperar varias operaciones independientes
```js
const [user, orders] = await Promise.all([
  fetchUser(userId),
  fetchOrders(userId),
]);
```

Evitar bloquear el event loop con trabajo pesado
```js
// Malo en UI: bloquea interacción hasta terminar.
const result = expensiveCalculation(bigInput);

// Mejor: moverlo a un Web Worker o partir el trabajo en chunks.
worker.postMessage(bigInput);
```

#### Sources
- [MDN, JavaScript execution model](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Execution_model)
- [MDN, Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)

### this
#### Details
`this` es un binding que depende de cómo se llama una función, no solo de dónde está escrita. MDN explica que, para una función normal, el valor de `this` se determina en runtime por el call site. En métodos, normalmente apunta al objeto antes del punto; en llamadas sueltas puede ser `undefined` en strict mode.

Las arrow functions son diferentes: no crean su propio `this`, capturan el `this` del ámbito léxico que las rodea. Esto las hace útiles para callbacks donde quieres conservar el contexto, pero malas como métodos cuando esperas que `this` sea el objeto receptor.

En entrevistas, una buena respuesta no memoriza reglas aisladas: revisa el sitio de llamada. Preguntate: ¿se llamó como método (`obj.fn()`), con `new`, con `call/apply/bind`, como callback suelto, o dentro de una arrow?

#### Examples
Método llamado desde el objeto
```js
const user = {
  name: "Ada",
  greet() {
    return `Hi, ${this.name}`;
  },
};

console.log(user.greet()); // Hi, Ada
```

Perder `this` al pasar un método como callback
```js
const user = {
  name: "Ada",
  greet() {
    console.log(this.name);
  },
};

const fn = user.greet;
fn(); // undefined en strict mode, porque ya no se llama como user.greet()
```

Fijar contexto con bind
```js
const boundGreet = user.greet.bind(user);
boundGreet(); // Ada
```

Arrow function captura `this` léxico
```js
function Timer() {
  this.seconds = 0;

  setInterval(() => {
    this.seconds += 1;
  }, 1000);
}
```

#### Sources
- [MDN, this](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/this)

### Prototipos
#### Details
JavaScript usa herencia basada en prototipos. Cada objeto puede tener un prototipo, y cuando accedés a una propiedad que no está en el objeto, el motor la busca en la cadena de prototipos. MDN remarca que las clases de JavaScript son sintaxis sobre este modelo, no un sistema de clases separado como en Java o C#.

Esto importa porque métodos compartidos suelen vivir en el prototipo, mientras que datos propios viven en cada instancia. También explica por qué modificar prototipos globales es peligroso: afecta a muchos objetos y puede romper código o abrir problemas de seguridad.

En entrevista, conviene poder conectar `class`, constructor functions, `Object.create`, `prototype`, `__proto__`/`[[Prototype]]` y method lookup. No hace falta usar prototipos manualmente todos los días, pero sí entender el modelo debajo de las clases.

#### Examples
Method lookup por la cadena de prototipos
```js
const animal = {
  speak() {
    return `${this.name} makes a noise`;
  },
};

const dog = Object.create(animal);
dog.name = "Milo";

console.log(dog.speak()); // Milo makes a noise
```

Constructor function y prototype compartido
```js
function User(name) {
  this.name = name;
}

User.prototype.greet = function () {
  return `Hi, ${this.name}`;
};

const ada = new User("Ada");
console.log(ada.greet()); // Hi, Ada
```

Class usa el mismo modelo prototípico
```js
class User {
  constructor(name) {
    this.name = name;
  }

  greet() {
    return `Hi, ${this.name}`;
  }
}

console.log(User.prototype.greet);
```

Propiedad propia vs propiedad heredada
```js
console.log(dog.hasOwnProperty("name")); // true
console.log(dog.hasOwnProperty("speak")); // false
console.log("speak" in dog); // true
```

#### Sources
- [MDN, Inheritance and the prototype chain](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Inheritance_and_the_prototype_chain)

## Interview Questions

### ¿Cómo explicarías closures sin quedarte en la definición?
Diría que una closure permite que una función recuerde variables del ámbito donde fue creada. Lo demostraría con un contador o una factory, y luego hablaría del impacto real: estado privado, callbacks que retienen contexto y bugs cuando varias funciones cierran sobre el mismo binding.

### ¿Qué orden imprimen logs mezclando código síncrono, promises y setTimeout?
Primero corre todo el código síncrono porque JavaScript ejecuta cada job hasta completarlo. Después se resuelven continuaciones de promises y luego callbacks como timers cuando el event loop puede tomarlos. La respuesta fuerte explica el modelo, no solo memoriza el output.

### ¿Por qué se pierde `this` al pasar un método como callback?
Porque `this` depende de cómo se llama la función. Si paso `user.greet` como referencia suelta, ya no se invoca como `user.greet()`, así que pierde el receptor. Las soluciones comunes son `bind`, envolver en una arrow o diseñar la función para recibir datos explícitos.

### ¿Qué relación hay entre `class` y prototipos en JavaScript?
`class` es sintaxis más cómoda sobre el modelo prototípico. Los métodos declarados en la clase viven en el prototype, y las instancias delegan la búsqueda de métodos a través de la cadena de prototipos. Entender eso ayuda a depurar herencia, métodos compartidos y propiedades propias vs heredadas.
