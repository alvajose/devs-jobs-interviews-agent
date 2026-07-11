---
stack: typescript
id: typescript-advanced-types
title: Tipos avanzados de TypeScript
area: Lenguaje
priority: medium
resourceLabel: TypeScript Handbook, Utility Types
resourceUrl: https://www.typescriptlang.org/docs/handbook/utility-types.html
---

## Summary
Cómo TypeScript construye tipos a partir de otros tipos: utility types, mapped types, conditional types con `infer`, template literal types y `satisfies`, la caja de herramientas que separa a alguien que "usa" TS de alguien que diseña sus propios tipos.

## Concepts

### Utility types (Partial, Pick, Omit, Record) y cómo están construidos
#### Details
TypeScript incluye utility types globales para transformar tipos sin reescribirlos a mano: `Partial<T>` vuelve todas las propiedades opcionales, `Required<T>` las vuelve obligatorias, `Pick<T, K>` selecciona un subconjunto de propiedades, `Omit<T, K>` excluye propiedades, y `Record<K, V>` construye un tipo objeto con un set de claves y un tipo de valor uniforme. El Handbook los documenta como parte de la librería estándar, disponibles globalmente sin import.

Lo que un entrevistador espera no es la lista de nombres sino entender que **no son magia del compilador**: están definidos con mapped types sobre el propio lenguaje. `Partial<T>` es literalmente `{ [P in keyof T]?: T[P] }`, y `Pick<T, K>` es `{ [P in K]: T[P] }` con un constraint `K extends keyof T`. Saber esto importa porque te permite construir tus propias variantes cuando el utility type estándar no alcanza (por ejemplo un `PartialBy<T, K>` que solo vuelve opcionales *algunas* claves).

`Omit` es el caso más discutido: se implementa como `Pick<T, Exclude<keyof T, K>>`, es decir, primero calcula qué keys *no* excluir y después usa `Pick`. Un detalle real y citado seguido en la comunidad de TS es que `Omit` no es estrictamente type-safe con tipos genéricos o uniones complejas (no preserva bien discriminated unions), a diferencia de un `Pick` inverso hecho a mano en algunos casos, vale la pena mencionarlo si la conversación se pone técnica, porque muestra que conocés las limitaciones, no solo el nombre del tipo.

#### Examples
Partial y Required en un patrón de actualización parcial
```ts
interface User {
  id: string;
  name: string;
  email: string;
}

function updateUser(id: string, changes: Partial<User>) {
  // changes puede traer solo { name: "..." } sin romper el tipo
}

type FullConfig = Required<{ host?: string; port?: number }>;
// { host: string; port: number }
```

Pick y Omit para modelar DTOs
```ts
type UserPublic = Pick<User, "id" | "name">;
type UserWithoutEmail = Omit<User, "email">;
```

Record para mapas homogéneos
```ts
type Role = "admin" | "editor" | "viewer";
const permissions: Record<Role, string[]> = {
  admin: ["read", "write", "delete"],
  editor: ["read", "write"],
  viewer: ["read"],
};
```

Cómo está construido Partial (equivalente real)
```ts
type MyPartial<T> = {
  [P in keyof T]?: T[P];
};

type MyPick<T, K extends keyof T> = {
  [P in K]: T[P];
};
```

#### Sources
- [TypeScript Handbook, Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html)
- [TypeScript Handbook, Mapped Types](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html)

### Mapped types
#### Details
Un mapped type recorre las claves de un tipo existente (`keyof T`) y produce un tipo nuevo aplicando una transformación a cada propiedad, en vez de declarar cada campo a mano. El Handbook lo presenta como la generalización de utility types como `Partial` y `Readonly`: la sintaxis `{ [P in K]: T }` es lo que hace posible construirlos sin soporte especial del compilador.

Los modificadores clave son `?` (opcional) y `readonly`, que se pueden **agregar o remover explícitamente** con el prefijo `+`/`-`. Esto es lo que permite construir el inverso de `Partial`: un tipo `Concrete<T>` que fuerza todas las propiedades a ser requeridas usando `-?`, o un tipo que quita `readonly` con `-readonly`, algo que no tiene un utility type dedicado pero que se resuelve con un mapped type propio.

Desde TS 4.1 los mapped types también soportan **key remapping** con una cláusula `as` dentro del `[P in K as NewKey]`, lo que permite renombrar o filtrar claves durante el mapeo (incluso combinado con template literal types, por ejemplo para prefijar getters). En entrevista, el ángulo de diseño es reconocer cuándo un mapped type reemplaza código repetitivo: cualquier vez que definís un tipo "derivado" de otro campo por campo, es candidato a mapped type en vez de mantener dos definiciones sincronizadas a mano.

#### Examples
Agregar y remover modificadores explícitamente
```ts
type Concrete<T> = {
  [P in keyof T]-?: T[P]; // saca el "opcional"
};

type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P];
};

type Mutable<T> = {
  -readonly [P in keyof T]: T[P]; // saca el "readonly"
};
```

Key remapping con `as` (TS 4.1+)
```ts
type Getters<T> = {
  [P in keyof T as `get${Capitalize<string & P>}`]: () => T[P];
};

interface Person {
  name: string;
  age: number;
}

type PersonGetters = Getters<Person>;
// { getName: () => string; getAge: () => number }
```

Filtrar claves durante el mapeo
```ts
type OnlyStrings<T> = {
  [P in keyof T as T[P] extends string ? P : never]: T[P];
};

type Result = OnlyStrings<{ id: number; name: string; email: string }>;
// { name: string; email: string }
```

Mapped type sobre una unión de literales (no sobre un objeto)
```ts
type Flags<Keys extends string> = {
  [K in Keys]: boolean;
};

type FeatureFlags = Flags<"darkMode" | "betaBanner">;
// { darkMode: boolean; betaBanner: boolean }
```

#### Sources
- [TypeScript Handbook, Mapped Types](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html)

### Conditional types e `infer`
#### Details
Un conditional type tiene la forma `T extends U ? X : Y`: se resuelve a `X` si `T` es asignable a `U`, o a `Y` en caso contrario, igual que un ternario pero a nivel de tipos. El Handbook los presenta como la herramienta para describir una relación entre el tipo de entrada y el tipo de salida de una forma que un solo tipo estático no puede expresar, típicamente dentro de un tipo genérico.

`infer` se usa dentro de la rama `extends` de un conditional type para **capturar** un tipo y reusarlo en la rama verdadera, en vez de tener que conocerlo de antemano. Es la pieza que permite construir tipos como `ReturnType<T>` (que extrae el tipo de retorno de una función) o `Parameters<T>` (que extrae la tupla de parámetros) sin que el usuario tenga que escribirlos manualmente en cada caso.

Cuando el conditional type se aplica sobre un parámetro de tipo genérico que es una **unión**, TypeScript lo distribuye automáticamente sobre cada miembro de la unión antes de evaluar la condición, esto se llama distributive conditional type, y es la razón por la que `ToArray<string | number>` da `string[] | number[]` en vez de `(string | number)[]`. Entender esa distribución (y cómo desactivarla envolviendo el tipo en corchetes, `[T] extends [U]`) es lo que distingue a alguien que solo copió `ReturnType` de una librería de alguien que puede diagnosticar por qué su propio conditional type genérico se "expande" de forma inesperada sobre una unión.

#### Examples
`infer` para extraer el tipo de retorno (cómo está construido `ReturnType`)
```ts
type MyReturnType<T> = T extends (...args: never[]) => infer R ? R : never;

function getUser() {
  return { id: 1, name: "Ada" };
}

type User = MyReturnType<typeof getUser>;
// { id: number; name: string }
```

`infer` sobre el tipo elemento de un array
```ts
type ElementType<T> = T extends (infer U)[] ? U : T;

type Item = ElementType<string[]>; // string
type NotArray = ElementType<number>; // number
```

Distributive conditional type sobre una unión
```ts
type ToArray<T> = T extends unknown ? T[] : never;

type Result = ToArray<string | number>;
// string[] | number[]  (se distribuye sobre cada miembro)
```

Desactivar la distribución envolviendo en tupla
```ts
type ToArrayNonDist<T> = [T] extends [unknown] ? T[] : never;

type Result2 = ToArrayNonDist<string | number>;
// (string | number)[]  (ya no se distribuye)
```

#### Sources
- [TypeScript Handbook, Conditional Types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html)
- [TypeScript Handbook, Conditional Types (infer)](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html#inferring-within-conditional-types)

### Template literal types
#### Details
Los template literal types usan la misma sintaxis que los template strings de JavaScript pero a nivel de tipos, permitiendo construir tipos string a partir de la concatenación de literales y uniones. El Handbook explica que cuando un template literal type incluye una unión en una de sus posiciones, el resultado es el producto cartesiano de todas las combinaciones posibles, no un solo string genérico.

El caso de uso más citado es modelar convenios de nombres de forma exhaustiva sin escribir cada combinación a mano: eventos (`"click" | "focus"` combinados con `"on" + Capitalize<Event>"` para dar `"onClick" | "onFocus"`), rutas de API, variantes de CSS, o claves de i18n. TypeScript también expone utility types intrínsecos para manipular el casing dentro del template (`Uppercase`, `Lowercase`, `Capitalize`, `Uncapitalize`), que se combinan naturalmente con key remapping en mapped types.

El punto que separa uso básico de uso avanzado es combinarlos con `infer` dentro de un conditional type para **parsear** un string literal: por ejemplo, extraer el nombre de un parámetro de una ruta tipo `/users/:id` como un tipo `"id"` en vez de un `string` genérico. Es el mismo mecanismo que usan librerías de routing tipadas (como React Router o tRPC) para que la ruta y los parámetros que devuelve el hook estén sincronizados en tiempo de compilación, sin generar código.

#### Examples
Producto cartesiano de uniones
```ts
type Corner = "top" | "bottom";
type Side = "left" | "right";

type CornerPosition = `${Corner}-${Side}`;
// "top-left" | "top-right" | "bottom-left" | "bottom-right"
```

Convención de nombres para handlers de eventos
```ts
type EventName = "click" | "focus" | "blur";
type HandlerName = `on${Capitalize<EventName>}`;
// "onClick" | "onFocus" | "onBlur"

type Handlers = {
  [E in HandlerName]: () => void;
};
```

Parsear un parámetro de ruta con `infer`
```ts
type ExtractParam<Route extends string> =
  Route extends `${string}/:${infer Param}` ? Param : never;

type Param1 = ExtractParam<"/users/:id">; // "id"
```

Validar formato en tiempo de compilación
```ts
type HexColor = `#${string}`;

function setColor(color: HexColor) {}

setColor("#ff0000"); // ok
// setColor("red"); // error: no matchea el patrón
```

#### Sources
- [TypeScript Handbook, Template Literal Types](https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html)

### El operador `satisfies` (TS 4.9+)
#### Details
`satisfies` valida que una expresión sea compatible con un tipo dado, sin cambiar el tipo *inferido* de esa expresión como sí lo hace una anotación (`: Tipo`) o un cast (`as Tipo`). El release note de TypeScript 4.9 lo introduce exactamente para resolver esta tensión: querés que el compilador chequee que tu objeto cumple cierta forma, pero también querés conservar el tipo más específico posible (literales, no el tipo ancho de la interfaz) para el resto del código.

El ejemplo canónico es una paleta de colores tipada como `Record<string, string | RGB>`: si anotás la variable con ese tipo (`const palette: Record<...> = {...}`), TypeScript "olvida" que cada color es específicamente un `string` o una tupla RGB, y llamar a `.toUpperCase()` sobre un color que en realidad es un string ya no autocompleta bien porque el tipo se amplió al de la unión completa. Con `satisfies` el compilador valida la forma contra `Record<string, string | RGB>` en el momento de la declaración, pero el tipo que queda para usar después sigue siendo el literal inferido de cada propiedad.

La regla práctica para entrevista: usar anotación de tipo (`:`) cuando querés que el tipo declarado *sea* el contrato (por ejemplo la firma de una función pública), y `satisfies` cuando querés *validar* contra un tipo pero seguir trabajando con la inferencia más precisa, típicamente en configuraciones, objetos de constantes, o mapas de valores donde después necesitás autocompletado o narrowing sobre los valores literales exactos.

#### Examples
El problema que resuelve `satisfies`
```ts
type RGB = [red: number, green: number, blue: number];

// Con anotación de tipo: se pierde la info específica de cada color.
const palette1: Record<string, string | RGB> = {
  red: [255, 0, 0],
  green: "#00ff00",
};
// palette1.red podría ser string | RGB: hay que narrowear para usarlo

// Con satisfies: se valida la forma, pero se conserva el tipo inferido.
const palette2 = {
  red: [255, 0, 0],
  green: "#00ff00",
} satisfies Record<string, string | RGB>;

palette2.red.map((x) => x); // TS sabe que es RGB (tupla), no string | RGB
```

Detectar errores de tipeo sin perder literales
```ts
const config = {
  method: "GET",
  retries: 3,
} satisfies { method: "GET" | "POST"; retries: number };

config.method; // tipo "GET", no string
```

`satisfies` atrapa keys inválidas en tiempo de compilación
```ts
type Endpoint = { path: string; auth: boolean };

const endpoints = {
  users: { path: "/users", auth: true },
  // health: { path: "/health", authh: false }, // error: "authh" no existe en Endpoint
} satisfies Record<string, Endpoint>;
```

#### Sources
- [TypeScript 4.9 Release Notes, The satisfies Operator](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html#the-satisfies-operator)

## Interview Questions

### Necesitás un tipo `PartialBy<T, K>` que vuelva opcionales solo algunas propiedades de `T`, dejando el resto igual. ¿Cómo lo construís y por qué ninguno de los utility types estándar alcanza?
`Partial<T>` vuelve opcionales *todas* las propiedades, y no hay una variante estándar para un subconjunto. Lo resolvería combinando `Omit` y `Partial` con `Pick`: `type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>`. La intersección junta las propiedades no tocadas (`Omit`) con las que sí quiero opcionales (`Partial<Pick<...>>`), mostrando que los utility types están pensados para combinarse, no como catálogo cerrado.

### Un compañero define una función `ReturnType` casera y se sorprende de que `MyReturnType<string | number>` no da lo que espera. ¿Qué está pasando?
Depende de cómo esté escrita la condición: si el conditional type queda expuesto sobre un parámetro genérico "naked" (sin envolver en tupla), TypeScript distribuye la condición sobre cada miembro de la unión automáticamente, evaluando la condición por separado para `string` y para `number` y devolviendo la unión de los resultados. Si el comportamiento esperado era tratar la unión como un solo tipo, hay que envolver ambos lados en tupla (`[T] extends [U]`) para desactivar esa distribución.

### Estás modelando los props de una tabla que acepta columnas dinámicas, donde cada handler de evento debe llamarse `onSort<NombreColumna>`. ¿Cómo lo tipás sin escribir cada combinación a mano?
Usaría un mapped type con key remapping y un template literal type: `type SortHandlers<Columns extends string> = { [C in Columns as `onSort${Capitalize<C>}`]: () => void }`. Esto genera automáticamente `onSortName`, `onSortDate`, etc. a partir de la unión de nombres de columna, y si se agrega una columna nueva el tipo del handler correspondiente aparece solo, sin tocar la definición del mapped type.

### Tenés un objeto de configuración con valores muy específicos (por ejemplo `method: "GET"`) pero necesitás validar que respete una forma más general (`method: string`). Si le ponés una anotación de tipo explícita, perdés el literal exacto en autocompletado. ¿Cómo lo resolvés?
Usaría `satisfies` en vez de una anotación de tipo: `const config = { method: "GET" } satisfies { method: string }`. El compilador valida que la forma sea compatible con el tipo general en el momento de la declaración (atrapando typos o keys de más), pero el tipo que queda disponible para el resto del código es el inferido real (`"GET"` como literal), no el tipo ancho de la anotación.

### ¿Por qué `Omit<T, K>` a veces "rompe" una discriminated union en vez de simplemente quitar una propiedad?
Porque `Omit` se implementa vía `Pick<T, Exclude<keyof T, K>>`, que opera sobre `keyof T` de la unión completa aplanada, no distribuye sobre cada miembro de la unión por separado. Si `T` es una discriminated union y `K` es una key que solo existe en algunos miembros, `Omit` puede perder la relación entre el discriminante y las propiedades específicas de cada variante. La alternativa cuando esto importa es escribir un `DistributiveOmit` propio usando un conditional type distributivo en vez de `Omit` directo.

### ¿Cuándo elegirías escribir un conditional type con `infer` en vez de simplemente declarar dos overloads de una función?
Cuando la relación entre el input y el output depende de una estructura genérica que puede variar de formas que no querés (o no podés) enumerar con overloads fijos, por ejemplo, extraer el tipo de un elemento dentro de cualquier array, o el tipo de retorno de cualquier función sin importar su firma. Los overloads sirven bien para un número acotado de formas conocidas de antemano; `infer` sirve para capturar y reusar una parte de un tipo genérico de forma reutilizable en cualquier instanciación futura del tipo.
