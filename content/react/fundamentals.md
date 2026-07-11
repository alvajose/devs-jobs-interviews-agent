---
stack: react
id: react-fundamentals
title: React: Fundamentos (JSX, props, listas)
area: Frontend
priority: high
resourceLabel: React docs, Describing the UI
resourceUrl: https://react.dev/learn/describing-the-ui
---

## Summary

Los cimientos que se asumen en cualquier entrevista de React: componentes, JSX, props, listas/keys y renderizado condicional.

## Concepts

### Componentes y JSX

#### Details

Un componente es una función que devuelve markup (JSX). JSX no es HTML: es azúcar sintáctico que compila a llamadas a `createElement`. Por eso tiene reglas propias: un componente debe devolver **un solo elemento raíz** (o un `Fragment`), los atributos van en camelCase (`className`, `onClick`), y para insertar valores de JS usás llaves `{}`.

El nombre del componente debe empezar con **mayúscula**: así React distingue un componente (`<Profile />`) de una etiqueta del DOM (`<div />`). En minúscula, React lo trata como tag nativo. Es un error clásico que rompe el render sin un mensaje obvio.

En entrevista conviene mencionar que el render debe ser **puro**: dado el mismo input (props/estado), produce el mismo output, sin efectos secundarios durante el render. Eso es lo que permite a React optimizar y re-renderizar con confianza.

#### Examples

Componente con expresiones JS embebidas

```jsx
function Greeting({ user }) {
  return <h1>Hola, {user.name.toUpperCase()}</h1>;
}
```

Fragment para evitar un div innecesario

```jsx
function Row() {
  return (
    <>
      <td>Name</td>
      <td>Role</td>
    </>
  );
}
```

#### Sources

- [React docs, Your First Component](https://react.dev/learn/your-first-component)
- [React docs, Writing Markup with JSX](https://react.dev/learn/writing-markup-with-jsx)

### Props y composición

#### Details

Las props son la forma de pasar datos de un componente padre a un hijo, y son **de solo lectura**: un componente nunca debe mutar sus props. Si necesitás que algo cambie, eso es estado, no props. Esta inmutabilidad es la que hace predecible el flujo de datos (top-down, "unidirectional data flow").

La prop especial `children` permite **composición**: un componente envuelve a otro sin saber qué es. Por eso React favorece composición sobre herencia: en vez de extender clases, componés componentes (un `Card` que recibe cualquier contenido como `children`). Es la respuesta correcta a "¿cómo reutilizás UI?".

Un patrón útil en entrevista es distinguir componentes **presentacionales** (reciben props, renderizan) de **contenedores** (manejan estado/lógica). Mantener componentes chicos y enfocados mejora testeo y reutilización.

#### Examples

Composición con children

```jsx
function Card({ title, children }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

// <Card title="Perfil"><Avatar /><Bio /></Card>
```

Props con default y desestructuración

```jsx
function Button({ variant = "primary", children }) {
  return <button className={`btn btn-${variant}`}>{children}</button>;
}
```

#### Sources

- [React docs, Passing Props to a Component](https://react.dev/learn/passing-props-to-a-component)
- [React docs, Passing JSX as children](https://react.dev/learn/passing-props-to-a-component#passing-jsx-as-children)

### Listas y keys

#### Details

Para renderizar listas usás `map()` devolviendo un elemento por item. Cada elemento necesita una prop `key` **única y estable entre renders**. La key le dice a React qué item es cuál cuando la lista cambia (se reordena, agrega o borra), para reusar y mover nodos en vez de recrearlos.

El error más común,y pregunta típica, es usar el **índice del array como key**. Funciona hasta que la lista se reordena o se insertan/borran items: ahí React asocia mal el estado/DOM a los items equivocados, causando bugs sutiles (un input mantiene el valor de otra fila). La key debe venir de un id estable del dato, no de la posición.

#### Examples

Key estable desde el dato

```jsx
function TodoList({ todos }) {
  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>{todo.text}</li>
      ))}
    </ul>
  );
}
```

Anti-patrón: índice como key en lista mutable

```jsx
// ⚠️ Si la lista se reordena/filtra, el estado por fila se desalinea
{
  todos.map((todo, i) => <Row key={i} todo={todo} />);
}
```

#### Sources

- [React docs, Rendering Lists](https://react.dev/learn/rendering-lists)
- [React docs, Keeping list items in order with key](https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key)

### Renderizado condicional

#### Details

Renderizás condicionalmente con `if`/early return, el operador ternario, o `&&` para "mostrar si". Son solo expresiones de JS dentro de JSX, no hay una sintaxis especial de templating.

La trampa clásica de entrevista es `&&` con valores **falsy que no son booleanos**: `{count && <Badge />}` renderiza `0` literal en pantalla cuando `count` es 0, porque `0` es falsy pero React lo renderiza como texto. La forma segura es comparar explícitamente (`count > 0 && ...`) o usar ternario (`count ? <Badge/> : null`).

#### Examples

Ternario y early return

```jsx
function Profile({ user }) {
  if (!user) return <Spinner />;
  return user.isAdmin ? <AdminPanel /> : <UserPanel />;
}
```

Trampa del && con 0

```jsx
{
  items.length > 0 && <List items={items} />;
} // ✅
{
  items.length && <List items={items} />;
} // ⚠️ renderiza 0
```

#### Sources

- [React docs, Conditional Rendering](https://react.dev/learn/conditional-rendering)

## Interview Questions

### ¿Por qué no deberías usar el índice del array como `key`?

Porque la key debe identificar al item de forma estable entre renders, y el índice cambia cuando la lista se reordena, filtra o se insertan/borran elementos. Si uso el índice, React asocia el estado y el DOM a la posición, no al dato: aparecen bugs como un input que conserva el valor de otra fila tras reordenar. Uso un id estable del dato; el índice solo es aceptable en listas estáticas que nunca cambian de orden.

### ¿Por qué React favorece la composición sobre la herencia?

Porque la UI se reutiliza mejor combinando componentes que extendiendo clases. Con `children` y props, un componente envuelve o configura a otro sin acoplarse a su implementación (un `Card`, `Modal` o `Layout` que reciben contenido arbitrario). La herencia generaría jerarquías rígidas; la composición mantiene componentes chicos, intercambiables y fáciles de testear.

### ¿Qué significa que un componente sea "puro" y por qué importa?

Que durante el render, con las mismas props y estado, produce el mismo JSX y no causa efectos secundarios (no muta variables externas, no hace fetch, no toca el DOM). Importa porque React puede re-renderizar, memoizar y, en modo concurrente, pausar/reanudar renders confiando en que no rompe nada. Los efectos van en event handlers o en `useEffect`, no en el cuerpo del render.

### Tenés un bug: una fila de la lista muestra datos cruzados tras reordenar. ¿Qué revisás primero?

Las keys. Casi seguro están usando el índice como key (o una key no única), así que al reordenar React reutiliza nodos y estado de la posición equivocada. La solución es usar un id estable del dato como key. También verifico que no haya estado local en las filas que dependa de la posición en vez del id.
