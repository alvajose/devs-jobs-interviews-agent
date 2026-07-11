---
stack: typescript
id: typescript-fundamentals
title: Fundamentos de TypeScript
area: Lenguaje
priority: high
resourceLabel: TypeScript Handbook
resourceUrl: https://www.typescriptlang.org/docs/handbook/intro.html
---

## Summary
El valor real de TypeScript sobre JavaScript: tipado estructural, uniones discriminadas, narrowing y genéricos, lo que un entrevistador espera que entiendas del sistema de tipos, no de la sintaxis.

## Concepts

### Interfaces vs type aliases (tipado estructural)
#### Details
TypeScript usa tipado estructural ("duck typing" con chequeo estático): dos tipos son compatibles si tienen la misma forma, sin importar su nombre o de dónde vengan. El Handbook lo remarca explícitamente al comparar `interface` y `type`: ambos describen la forma de un objeto y en la mayoría de los casos son intercambiables, la elección es de estilo y de algunas capacidades puntuales, no de "cuál es más type-safe".

Las diferencias reales que sí importan en una entrevista: las `interface` se pueden extender con `extends` y son "declaration-merging" (declarar la misma interface dos veces en el mismo scope las combina), mientras que `type` no se puede reabrir pero sí puede describir uniones, intersecciones, tuplas y tipos primitivos con alias, cosas que una interface no puede expresar directamente. Desde TS 4.2 los alias también se muestran mejor en mensajes de error al preservar el nombre.

En diseño de librerías o APIs públicas, el propio equipo de TypeScript recomienda `interface` para formas de objetos que otros van a extender (por el merge y porque el error de "no assignable" suele ser más legible), y `type` cuando necesitás uniones, mapped types o composición más algebraica. Lo importante en entrevista no es recitar la tabla de diferencias sino explicar que ambas caen en el mismo modelo estructural: TypeScript nunca compara nombres de tipos, compara formas.

#### Examples
Compatibilidad estructural, no nominal
```ts
interface Point {
  x: number;
  y: number;
}

// No implementa Point explícitamente, pero calza en su forma.
const p = { x: 1, y: 2, z: 3 };
function log(point: Point) {
  console.log(point.x, point.y);
}
log(p); // válido: TS solo exige que existan x e y numéricos
```

Declaration merging solo en interfaces
```ts
interface Window {
  myAppFlag: boolean;
}

interface Window {
  anotherFlag: string;
}

// Window ahora tiene ambas propiedades: útil para "ampliar" tipos de terceros.
```

`type` para lo que una interface no puede expresar
```ts
type Id = string | number; // unión
type Point3D = { x: number; y: number; z: number };
type Coordinates = [number, number]; // tupla

// Esto no tiene equivalente directo como interface:
type Status = "idle" | "loading" | "success" | "error";
```

Extender una interface vs. intersectar un type
```ts
interface Animal {
  name: string;
}
interface Dog extends Animal {
  breed: string;
}

type AnimalT = { name: string };
type DogT = AnimalT & { breed: string };
```

#### Sources
- [TypeScript Handbook, Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html)
- [TypeScript Handbook, Interfaces](https://www.typescriptlang.org/docs/handbook/2/objects.html)

### Union types, intersection types y discriminated unions
#### Details
Una unión (`A | B`) describe un valor que puede ser de cualquiera de varios tipos; una intersección (`A & B`) describe un valor que debe cumplir todos los tipos a la vez. El Handbook las presenta como las dos operaciones básicas para combinar tipos existentes en vez de escribir uno nuevo desde cero.

El patrón que más aparece en código real y en entrevistas es la **discriminated union**: una unión de objetos que comparten una propiedad literal común (el "discriminante", típicamente `kind` o `type`) con un valor distinto en cada miembro. TypeScript puede usar esa propiedad para reducir automáticamente la unión al tipo correcto dentro de un `if` o `switch`, sin necesidad de castear nada a mano.

El valor de diseño es modelar estados mutuamente excluyentes de forma que sea *imposible* representar un estado inválido: por ejemplo, un resultado que es `success` con `data` o `error` con `message`, pero nunca ambos ni ninguno. Combinado con un `switch` exhaustivo y el tipo `never` en el `default`, el compilador te obliga a manejar cada variante, si agregás un nuevo miembro a la unión y te olvidás de un caso, el build falla. Esa es la respuesta que un entrevistador busca: no "qué es una unión", sino "cómo diseño estados con uniones para que el compilador atrape los casos que me olvidé".

#### Examples
Discriminated union para un resultado de red
```ts
type FetchResult =
  | { status: "success"; data: string }
  | { status: "error"; message: string }
  | { status: "loading" };

function render(result: FetchResult) {
  switch (result.status) {
    case "success":
      return result.data; // TS sabe que data existe acá
    case "error":
      return result.message;
    case "loading":
      return "Loading...";
  }
}
```

Exhaustividad forzada con `never`
```ts
function assertNever(x: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(x)}`);
}

function render2(result: FetchResult) {
  switch (result.status) {
    case "success":
      return result.data;
    case "error":
      return result.message;
    case "loading":
      return "Loading...";
    default:
      return assertNever(result); // si agrego un caso nuevo, esto no compila
  }
}
```

Intersección para componer capacidades
```ts
type Timestamped = { createdAt: Date };
type Named = { name: string };

type Entity = Timestamped & Named;

const user: Entity = { name: "Ada", createdAt: new Date() };
```

Unión simple sin discriminante (menos segura)
```ts
type Input = string | number;

function double(value: Input) {
  if (typeof value === "string") return value.repeat(2);
  return value * 2;
}
```

#### Sources
- [TypeScript Handbook, Unions and Intersection Types](https://www.typescriptlang.org/docs/handbook/2/objects.html#union-types)
- [TypeScript Handbook, Narrowing (discriminated unions)](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions)

### Type narrowing (type guards, `in`, `instanceof`, predicados custom)
#### Details
Narrowing es el proceso por el cual TypeScript refina el tipo de una variable dentro de una rama de código, en base a chequeos que hacés en runtime. El Handbook lo describe como el análisis de control de flujo: TS sigue `if`, `&&`, `return` temprano, `typeof`, `instanceof`, etc., y ajusta el tipo visible dentro de cada bloque sin que vos anotes nada extra.

Las herramientas nativas son `typeof` (para primitivos), `instanceof` (para clases), el operador `in` (para chequear si una propiedad existe, útil cuando dos tipos no comparten un discriminante literal), y comparaciones de igualdad directas. Cuando ninguna de esas alcanza, se puede escribir un **type predicate** custom: una función que devuelve `arg is Tipo` en vez de `boolean`, y que TypeScript trata como una fuente de verdad para el narrowing en cualquier `if` que la use.

La razón de ser de todo esto es evitar el escape hatch de `as` (type assertion): castear manualmente le dice a TS "confiá en mí" sin verificación real, mientras que narrowing hace que el *runtime check* y el *tipo estático* queden sincronizados. En entrevista, la señal de nivel es explicar cuándo usar cada herramienta: `in` cuando los tipos no tienen discriminante propio (por ejemplo validando la forma de un JSON externo), predicados custom cuando la lógica de validación es compleja o reusable, y por qué un predicado mal escrito (que miente sobre lo que realmente valida) rompe la seguridad de tipos silenciosamente.

#### Examples
`typeof` e `instanceof`
```ts
function process(value: string | Date) {
  if (typeof value === "string") {
    return value.toUpperCase();
  }
  return value.toISOString(); // TS sabe que acá es Date
}

class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

function handle(err: Error) {
  if (err instanceof ApiError) {
    console.log(err.statusCode); // solo accesible tras el narrowing
  }
}
```

Operador `in` para tipos sin discriminante literal
```ts
type Cat = { meow: () => void };
type Dog = { bark: () => void };

function makeSound(animal: Cat | Dog) {
  if ("meow" in animal) {
    animal.meow();
  } else {
    animal.bark();
  }
}
```

Type predicate custom
```ts
interface User {
  id: string;
  email: string;
}

function isUser(value: unknown): value is User {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "email" in value
  );
}

function greet(payload: unknown) {
  if (isUser(payload)) {
    console.log(payload.email); // narrowed a User
  }
}
```

Narrowing con `Array.isArray` y chequeos combinados
```ts
function normalize(value: string | string[] | undefined) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}
```

#### Sources
- [TypeScript Handbook, Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [TypeScript Handbook, Everyday Types (unknown)](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#unknown)

### Generics (constraints e inferencia)
#### Details
Los genéricos permiten escribir componentes (funciones, tipos, clases) que trabajan sobre una variedad de tipos en vez de uno solo, preservando la relación entre lo que entra y lo que sale. El Handbook usa el ejemplo clásico de `identity<Type>(arg: Type): Type` para mostrar que sin genéricos perdés información de tipo (usando `any`) o quedás atado a un tipo concreto, los genéricos son el punto medio que mantiene la firma precisa.

Un genérico sin restricciones acepta cualquier tipo, lo cual a veces es demasiado permisivo: si tu función necesita acceder a `.length`, por ejemplo, `Type` sin constraint no lo garantiza. Ahí entra `extends` como **constraint**: `function loggingIdentity<Type extends { length: number }>(arg: Type)` le dice al compilador "acepto cualquier tipo, siempre que tenga `.length`", y eso habilita el autocompletado y el chequeo dentro de la función.

En la práctica, la mayoría de las veces no hace falta especificar el tipo genérico explícitamente porque TypeScript lo **infiere** a partir de los argumentos que le pasás, esa inferencia es lo que hace que genéricos bien diseñados se sientan invisibles para quien los consume. La habilidad que se evalúa en entrevista es diseñar la firma genérica correcta: constraints que sean lo bastante amplios para ser reusables pero lo bastante estrictos para que el compilador atrape errores, y saber cuándo relacionar dos parámetros de tipo (por ejemplo `K extends keyof T`) para expresar dependencias entre argumentos, como en una función `getProperty(obj, key)` que solo acepta keys reales del objeto.

#### Examples
Genérico básico con inferencia
```ts
function identity<Type>(arg: Type): Type {
  return arg;
}

const a = identity("hello"); // Type inferido como string
const b = identity(42); // Type inferido como number
```

Constraint con `extends`
```ts
function loggingIdentity<Type extends { length: number }>(arg: Type): Type {
  console.log(arg.length); // seguro: el constraint lo garantiza
  return arg;
}

loggingIdentity("hello"); // ok, string tiene length
loggingIdentity([1, 2, 3]); // ok, array tiene length
// loggingIdentity(42); // error: number no tiene length
```

Relacionar parámetros con `keyof`
```ts
function getProperty<Type, Key extends keyof Type>(obj: Type, key: Key) {
  return obj[key];
}

const user = { id: 1, name: "Ada" };
getProperty(user, "name"); // ok
// getProperty(user, "email"); // error: "email" no es keyof user
```

Genérico en una clase reusable
```ts
class Box<T> {
  constructor(private value: T) {}
  get(): T {
    return this.value;
  }
  map<U>(fn: (value: T) => U): Box<U> {
    return new Box(fn(this.value));
  }
}

const box = new Box(10).map((n) => n.toString()); // Box<string>
```

#### Sources
- [TypeScript Handbook, Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html)
- [TypeScript Handbook, Type Inference](https://www.typescriptlang.org/docs/handbook/type-inference.html)

## Interview Questions

### Tenés un objeto que viene de una librería externa y necesitás extenderlo con propiedades propias sin romper el tipado de terceros. ¿Interface o type, y por qué?
Usaría `interface` para ese caso porque el declaration merging permite reabrir la misma interfaz y agregar miembros (como el patrón clásico de extender `Window` o los tipos de Express). Con `type` eso no es posible porque un alias no se puede redeclarar. Si en cambio necesitara combinar formas heterogéneas (uniones, tuplas) usaría `type` con intersección, porque ahí `interface` no alcanza.

### Estás modelando el estado de una petición HTTP (idle, loading, success, error) y el equipo se queja de bugs donde acceden a `data` cuando en realidad hubo un error. ¿Cómo lo rediseñarías con el sistema de tipos?
Lo modelaría como una discriminated union con un campo `status` literal por variante, de modo que `data` solo exista en el miembro `success` y `message` solo en `error`. Así, fuera de un `switch`/`if` que verifique `status`, TypeScript no deja acceder a esas propiedades. Además agregaría un `default` con `assertNever` en el switch para que agregar un nuevo estado sin manejarlo rompa el build.

### Recibís un payload de una API externa tipado como `unknown`. ¿Cómo lo validás de forma type-safe antes de usarlo?
Escribiría un type predicate (`function isUser(x: unknown): x is User`) que valide en runtime la forma esperada, y solo dentro del `if (isUser(payload))` TypeScript me deja tratarlo como `User`. Evitaría un `as User` directo porque eso no verifica nada en runtime, solo calla al compilador y puede esconder bugs si el payload real no calza.

### ¿Cuándo usarías `in` en vez de un discriminante literal para narrowing?
Cuando los tipos de la unión no comparten una propiedad literal común pero sí difieren en qué propiedades existen, por ejemplo dos formas de respuesta de API sin un campo `type` explícito. El operador `in` chequea presencia de una key en runtime y TypeScript usa eso para reducir la unión, sin necesidad de rediseñar los tipos para agregar un discriminante que capaz no controlás (porque vienen de una fuente externa).

### Diseñá la firma de una función `pluck(objects, key)` que devuelva un array con el valor de una propiedad dada, type-safe.
La firma sería `function pluck<T, K extends keyof T>(objects: T[], key: K): T[K][]`. El constraint `K extends keyof T` obliga a que `key` sea una propiedad real de `T`, y el tipo de retorno `T[K][]` queda ligado exactamente al tipo de esa propiedad, si mañana cambia el tipo de esa propiedad en `T`, el retorno se actualiza solo, sin tocar la función.

### Un compañero usa genéricos sin ningún `extends` "por las dudas, para que sea más flexible". ¿Qué problema le señalarías?
Le diría que un genérico sin constraint es básicamente `unknown` disfrazado: dentro de la función no podés acceder a ninguna propiedad porque TS no sabe nada del tipo, así que en la práctica termina forzando `any` o casts para poder operar con el valor. La flexibilidad real no viene de sacar el constraint, sino de elegir el constraint mínimo necesario (por ejemplo `{ length: number }` en vez del tipo concreto) para que siga aceptando muchos tipos pero el compilador pueda verificar el cuerpo de la función.
