---
stack: react
id: react-modern-features
title: React moderno: 18, 19 y Server Components
area: Frontend
priority: high
resourceLabel: React 19, Blog oficial
resourceUrl: https://react.dev/blog/2024/12/05/react-19
---

## Summary
Lo que más se pregunta hoy en React senior: rendering concurrente, Suspense/streaming, Server Components y el modelo de Actions de React 19.

## Concepts

### Rendering concurrente: transitions y deferred values
#### Details
React 18 introdujo el rendering concurrente: React puede preparar una actualización en segundo plano e interrumpirla si llega algo más urgente (como tipear). El objetivo no es "más rápido" sino **mantener la UI responsiva** bajo updates pesados. En entrevista, la idea clave es separar actualizaciones urgentes (input) de no urgentes (re-renderizar una lista grande filtrada).

`useTransition` marca una actualización como no urgente y te da un flag `isPending` para mostrar feedback sin congelar el input. `useDeferredValue` hace algo parecido pero sobre un valor: renderiza con el valor viejo mientras prepara el nuevo. Ambos evitan el patrón viejo de `setTimeout`/debounce manual para que la escritura no se trabe.

También en 18: **automatic batching** (varias `setState` en promesas/timeouts ahora se agrupan en un solo render) y `useId` para IDs estables en SSR. Un candidato fuerte sabe que estas APIs son para responsividad percibida, no para arreglar lógica lenta de fondo: si el cálculo es caro de verdad, primero se optimiza el cálculo.

#### Examples
Filtrar una lista grande sin trabar el input
```jsx
function SearchResults({ query }) {
  const deferredQuery = useDeferredValue(query);
  const list = useMemo(() => filterHugeList(deferredQuery), [deferredQuery]);
  return <List items={list} />;
}
```

Navegación no urgente con feedback
```jsx
const [isPending, startTransition] = useTransition();

function selectTab(nextTab) {
  startTransition(() => {
    setTab(nextTab); // re-render pesado, no bloquea el click
  });
}
```

#### Sources
- [React docs, useTransition](https://react.dev/reference/react/useTransition)
- [React docs, useDeferredValue](https://react.dev/reference/react/useDeferredValue)

### Suspense y streaming
#### Details
`Suspense` deja declarar un estado de carga para una parte del árbol mientras algo "suspende" (código con `lazy`, o datos con un framework/`use()`). En vez de coordinar flags de loading a mano, envolvés la zona en `<Suspense fallback={...}>` y React muestra el fallback hasta que esté listo.

Su valor arquitectónico aparece con **streaming SSR**: el servidor manda HTML por partes y va completando los huecos de Suspense a medida que resuelven, en vez de esperar a que TODO el dato esté listo. Eso mejora el time-to-first-byte y la performance percibida en apps con data pesada.

En entrevista conviene aclarar el límite: Suspense para datos necesita un origen que sepa suspender (frameworks tipo Next, o `use()` con una promesa estable). No es un reemplazo directo de cualquier `useEffect` + fetch en cualquier app.

#### Examples
Code-splitting con lazy + Suspense
```jsx
const Settings = lazy(() => import("./Settings"));

<Suspense fallback={<Spinner />}>
  <Settings />
</Suspense>;
```

Límites de Suspense independientes (streaming)
```jsx
<Suspense fallback={<FeedSkeleton />}>
  <Feed />
</Suspense>
<Suspense fallback={<SidebarSkeleton />}>
  <Sidebar />
</Suspense>
```

#### Sources
- [React docs, Suspense](https://react.dev/reference/react/Suspense)
- [React docs, lazy](https://react.dev/reference/react/lazy)

### Server Components (RSC)
#### Details
Los React Server Components se renderizan **antes**, en el servidor, y no envían su JavaScript al cliente. Sirven para leer datos cerca de la fuente (DB, filesystem, APIs internas) y mandar al browser solo el resultado, reduciendo el bundle. Es un cambio de arquitectura, no una API más.

La distinción clave que se pregunta es **Server Component vs Client Component**. Por defecto (en frameworks con RSC) los componentes son server: pueden ser async y hacer `await` de datos, pero NO pueden usar estado, efectos ni handlers del browser. Cuando necesitás interactividad (onClick, useState, useEffect), marcás el archivo con `"use client"`. La estrategia senior: mantener Server Components como default y empujar la interactividad a hojas Client lo más chicas posible.

Beneficios: menos JS enviado, data fetching sin waterfalls de cliente, secretos del servidor que nunca llegan al browser. Costo: mental model nuevo, y los Server Components no tienen estado ni ciclo de vida de cliente.

#### Examples
Server Component que lee datos directamente (async)
```jsx
// app/posts/page.jsx  (Server Component por defecto)
async function PostsPage() {
  const posts = await db.post.findMany(); // corre en el servidor
  return <PostList posts={posts} />;
}
```

Aislar la interactividad en una hoja Client
```jsx
"use client";
import { useState } from "react";

export function LikeButton({ postId }) {
  const [liked, setLiked] = useState(false);
  return <button onClick={() => setLiked(true)}>{liked ? "♥" : "♡"}</button>;
}
```

#### Sources
- [React docs, Server Components](https://react.dev/reference/rsc/server-components)
- [React docs, "use client"](https://react.dev/reference/rsc/use-client)

### Actions y mutaciones (React 19)
#### Details
React 19 estandariza las **Actions**: funciones async que React conecta a transiciones para manejar automáticamente pending, errores y updates optimistas. En vez de cablear a mano `loading`, `error` y `disabled` en cada formulario, dejás que la Action lo orqueste.

`useActionState` envuelve una Action y te devuelve el estado resultante, una versión "envuelta" para disparar, y el flag `isPending`. `useFormStatus` lee el estado de envío del `<form>` padre sin prop drilling (ideal para un botón de submit reutilizable). `useOptimistic` muestra un valor optimista mientras la request está en vuelo y revierte solo si falla. Con **Server Actions** (`"use server"`), un Client Component puede llamar código del servidor directamente para mutar datos.

Además React 19 trae ergonomía: el `use()` para leer promesas/context en render (incluso condicionalmente), `ref` como prop normal (adiós `forwardRef` en la mayoría de casos) y soporte nativo de `<title>`/`<meta>` que React sube al `<head>`. En entrevista, lo importante es el modelo mental: formularios y mutaciones dejan de ser estado manual y pasan a ser Actions con estados gestionados.

#### Examples
Formulario con useActionState
```jsx
function UpdateName() {
  const [error, submitAction, isPending] = useActionState(
    async (prev, formData) => {
      const err = await updateName(formData.get("name"));
      return err ?? null;
    },
    null,
  );

  return (
    <form action={submitAction}>
      <input name="name" />
      <button disabled={isPending}>Update</button>
      {error && <p>{error}</p>}
    </form>
  );
}
```

Botón de submit que lee el estado del form
```jsx
"use client";
import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending}>{pending ? "Saving…" : "Save"}</button>;
}
```

UI optimista
```jsx
const [optimistic, addOptimistic] = useOptimistic(
  messages,
  (state, newMsg) => [...state, { text: newMsg, sending: true }],
);
```

#### Sources
- [React 19, Blog oficial](https://react.dev/blog/2024/12/05/react-19)
- [React docs, useActionState](https://react.dev/reference/react/useActionState)
- [React docs, useOptimistic](https://react.dev/reference/react/useOptimistic)
- [React docs, use](https://react.dev/reference/react/use)

## Interview Questions

### ¿Qué problema resuelve el rendering concurrente y cuándo usarías useTransition?
El problema es la responsividad: un update pesado (filtrar/renderizar una lista grande) bloquea la interacción del usuario. El rendering concurrente permite marcar ese update como no urgente para que la entrada (tipear, clickear) siga fluida. Uso `useTransition` cuando una acción del usuario dispara un re-render caro pero no crítico, y muestro `isPending` como feedback. Si el cálculo en sí es lento, primero lo optimizo; las transiciones son para percepción, no para esconder lógica lenta.

### ¿Qué son los Server Components y cómo cambian la arquitectura de una app React?
Son componentes que renderizan en el servidor y no envían su JS al cliente, así que pueden leer datos directamente (DB, APIs internas) y reducir el bundle. Cambian el default: la app es server-first y la interactividad se vuelve la excepción, aislada en componentes Client. Esto elimina muchos waterfalls de fetching en el cliente y mantiene secretos en el servidor, a cambio de un modelo mental nuevo (los Server Components no tienen estado ni efectos).

### Server Component vs Client Component: ¿cómo decidís cuál usar?
Por defecto dejo Server Components: para data fetching, contenido estático y acceso a recursos del servidor. Marco `"use client"` solo donde necesito interactividad del browser: estado, efectos, event handlers, APIs del DOM. La estrategia es empujar el `"use client"` a las hojas más chicas posibles (ej. un botón) para enviar el mínimo JS y mantener el resto en el servidor.

### ¿Cómo manejarías un formulario con estado de envío, errores y UI optimista en React 19?
Uso una Action con `useActionState`: encapsula la mutación y me da el resultado/error y `isPending` sin cablear flags a mano. El botón de submit lee `useFormStatus` para deshabilitarse durante el envío sin prop drilling. Para que la UI responda al instante, `useOptimistic` muestra el cambio antes de que el servidor confirme y revierte solo si falla. Si la mutación corre en el servidor, la expongo como Server Action con `"use server"`.

### ¿Cuándo Suspense y streaming mejoran la performance percibida?
Cuando una página depende de datos de distinta latencia: en vez de esperar a que TODO cargue, envuelvo zonas independientes en `<Suspense>` con su fallback, y con streaming SSR el servidor manda el HTML listo primero y completa los huecos a medida que resuelven. El usuario ve contenido útil antes. No ayuda si todo el contenido depende del mismo dato lento; ahí el problema es la fuente de datos.
