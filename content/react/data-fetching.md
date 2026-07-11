---
stack: react
id: react-data-fetching
title: React: Data fetching y estado de servidor
area: Frontend
priority: high
resourceLabel: React docs, You Might Not Need an Effect
resourceUrl: https://react.dev/learn/you-might-not-need-an-effect
---

## Summary

Traer datos sin bugs: efectos con cleanup, por qué el estado de servidor no es estado local, y cuándo usar React Query/SWR o Suspense.

## Concepts

### Fetch en efectos: race conditions y cleanup

#### Details

El patrón base para traer datos en cliente es un `useEffect` que hace fetch y guarda el resultado en estado. El problema clásico,y pregunta de entrevista, es la **race condition**: si la dependencia cambia rápido (el usuario tipea o navega), pueden llegar respuestas fuera de orden y pintás datos viejos. La solución es un flag `ignore` en el cleanup que descarta respuestas obsoletas.

También hay que manejar los tres estados explícitos: loading, error y data. Olvidarse del error o del loading es señal de código de juguete. Y el cleanup corre antes del próximo efecto y al desmontar, así que es donde cancelás o ignorás lo que ya no importa.

En entrevista conviene aclarar que `useEffect` para fetching es aceptable, pero tiene límites (waterfalls, no cachea, no dedup). Por eso en apps reales se prefiere una librería de estado de servidor o un framework con data fetching integrado.

#### Examples

Fetch con cleanup que evita race conditions

```jsx
useEffect(() => {
  let ignore = false;
  setLoading(true);
  fetchUser(userId)
    .then((data) => {
      if (!ignore) setUser(data);
    })
    .catch((e) => {
      if (!ignore) setError(e);
    })
    .finally(() => {
      if (!ignore) setLoading(false);
    });
  return () => {
    ignore = true;
  };
}, [userId]);
```

#### Sources

- [React docs, Fetching data in an Effect](https://react.dev/learn/synchronizing-with-effects#fetching-data)
- [React docs, You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)

### Estado de servidor ≠ estado local

#### Details

Un error conceptual común es tratar los datos del servidor como estado de cliente normal (`useState` + `useEffect`). El estado de servidor es distinto: es **asíncrono, compartido y se vuelve obsoleto** (otro usuario lo cambió, o tu copia quedó vieja). Necesita cache, revalidación, dedup de requests y manejo de stale data, cosas que reinventás mal a mano.

Por eso existen librerías como **React Query (TanStack Query)** o **SWR**: cachean por key, deduplican requests simultáneos, revalidan en foco/reconexión, y dan loading/error/stale listos. La respuesta senior a "¿cómo manejás data fetching?" no es "useEffect", es "distingo estado de servidor de estado de UI y uso una herramienta de cache para el primero".

Lo que NO debería vivir duplicado como estado local es el dato del servidor: si lo copiás a `useState`, tenés dos fuentes de verdad que se desincronizan.

#### Examples

React Query: cache, loading y error resueltos

```jsx
function useUser(userId) {
  return useQuery({
    queryKey: ["user", userId],
    queryFn: () => fetchUser(userId),
  });
}
// const { data, isLoading, error } = useUser(id);
```

#### Sources

- [TanStack Query, Overview](https://tanstack.com/query/latest/docs/framework/react/overview)
- [SWR, Getting Started](https://swr.vercel.app/docs/getting-started)

### Suspense y el futuro del fetching

#### Details

React empuja hacia leer datos con **Suspense**: en vez de manejar loading a mano, un componente "suspende" mientras el dato no está y un `<Suspense>` padre muestra el fallback. En frameworks con Server Components, el fetching pasa al servidor (un Server Component async hace `await`), eliminando waterfalls de cliente.

En cliente, el `use()` de React 19 permite leer una promesa durante el render integrándose con Suspense. La idea de arquitectura: mover el fetching lo más cerca del servidor/origen posible, y usar Suspense para coordinar estados de carga de forma declarativa.

En entrevista, mostrá el panorama: useEffect (clásico, con sus límites) → librería de cache (hoy, lo más común en SPA) → Server Components / Suspense (la dirección de React).

#### Examples

Server Component que trae datos sin estado de loading manual

```jsx
async function UserPage({ id }) {
  const user = await getUser(id); // en el servidor
  return <Profile user={user} />;
}
```

#### Sources

- [React docs, use](https://react.dev/reference/react/use)
- [React docs, Suspense](https://react.dev/reference/react/Suspense)

## Interview Questions

### ¿Cómo evitás una race condition al traer datos en un useEffect?

Uso un flag `ignore` en el cleanup del efecto: cuando la dependencia cambia o el componente se desmonta, el cleanup marca `ignore = true`, y al resolver el fetch solo aplico el resultado si `ignore` sigue en false. Así descarto respuestas viejas que llegan tarde y no piso datos nuevos con viejos. También cancelaría con AbortController si quiero cortar el request.

### ¿Por qué el estado de servidor no debería manejarse como estado local?

Porque es asíncrono, compartido y se vuelve obsoleto: necesita cache, revalidación, dedup y manejo de stale data. Si lo copio a useState tengo dos fuentes de verdad que se desincronizan. Por eso uso una librería de estado de servidor (React Query/SWR) que cachea por key y revalida, y reservo useState para estado puro de UI.

### ¿Cómo elegís entre useEffect, React Query y Server Components para fetching?

useEffect para casos simples o cuando no quiero dependencias, asumiendo sus límites (sin cache, waterfalls). React Query/SWR en SPAs reales donde necesito cache, dedup y revalidación. Server Components / Suspense cuando el framework lo soporta, para mover el fetching al servidor y evitar waterfalls de cliente y JS extra. La decisión depende de la complejidad y de si tengo servidor.
