---
stack: react
id: react-hooks
title: React: Componentes y Hooks
area: Frontend
priority: high
resourceLabel: roadmap.sh, React
resourceUrl: https://roadmap.sh/react
---

## Summary
Componentes funcionales, los hooks base y cómo evitar renders y bugs de estado.

## Concepts

### useState y renders
#### Details
`useState` agrega estado local a un componente. Lo importante para entrevistas es el modelo mental: cada render ve un "snapshot" del estado. Llamar al setter no cambia la variable actual dentro del código que ya está corriendo; le pide a React que renderice de nuevo con el próximo valor.

Cuando el nuevo estado depende del anterior, usa la forma funcional (`setCount(c => c + 1)`). React encola esas funciones y las aplica en orden, lo que evita bugs cuando hay varias actualizaciones seguidas o batching. Para objetos y arrays, no mutes la referencia existente: React necesita una nueva referencia para detectar el cambio correctamente.

También conviene saber cuándo `useState` deja de ser suficiente. Si varios campos cambian juntos o una transición tiene muchas reglas, `useReducer` suele expresar mejor la lógica. Si el dato viene del servidor, muchas veces no debería vivir como estado local duplicado sino en una capa de cache/data fetching.

#### Examples
Actualizar desde el valor anterior
```jsx
function Counter() {
  const [count, setCount] = useState(0);

  function incrementThreeTimes() {
    setCount(c => c + 1);
    setCount(c => c + 1);
    setCount(c => c + 1);
  }

  return <button onClick={incrementThreeTimes}>{count}</button>;
}
```

Actualizar arrays sin mutar
```jsx
function TodoList() {
  const [items, setItems] = useState([]);

  function addItem(text) {
    setItems(items => [
      ...items,
      { id: crypto.randomUUID(), text, done: false },
    ]);
  }
}
```

Actualizar objetos anidados copiando cada nivel
```jsx
setForm(form => ({
  ...form,
  address: {
    ...form.address,
    city: "San José",
  },
}));
```

Evitar estado duplicado si se puede derivar
```jsx
function Cart({ items }) {
  const total = items.reduce((sum, item) => sum + item.price, 0);
  return <span>Total: {total}</span>;
}
```

#### Sources
- [React docs, useState](https://react.dev/reference/react/useState)

### useEffect y dependencias
#### Details
`useEffect` sirve para sincronizar un componente con algo externo a React: una conexión, un timer, una suscripción, un request manual, una API del navegador o una librería de terceros. Si no estás sincronizando con un sistema externo, probablemente no necesitas un Effect.

El array de dependencias debe incluir los valores reactivos usados dentro del efecto. No es una lista de "cuándo quiero que corra"; es una consecuencia del código que escribiste. Si falta una dependencia, puedes crear stale closures. Si agregas dependencias inestables innecesarias, puedes causar reconexiones, loops o renders extra.

El cleanup es igual de importante que el setup. React ejecuta cleanup antes de correr el siguiente efecto con valores nuevos y al desmontar. En Strict Mode de desarrollo, React corre setup + cleanup una vez extra para detectar efectos que no limpian bien; si eso rompe algo, normalmente el cleanup está incompleto.

#### Examples
Suscripción con cleanup correcto
```jsx
useEffect(() => {
  const connection = createConnection(serverUrl, roomId);
  connection.connect();

  return () => {
    connection.disconnect();
  };
}, [serverUrl, roomId]);
```

Interval sin stale closure usando updater
```jsx
useEffect(() => {
  const id = setInterval(() => {
    setCount(c => c + 1);
  }, 1000);

  return () => clearInterval(id);
}, []);
```

Fetch manual evitando race conditions
```jsx
useEffect(() => {
  let ignore = false;

  async function loadBio() {
    setBio(null);
    const result = await fetchBio(person);
    if (!ignore) {
      setBio(result);
    }
  }

  loadBio();

  return () => {
    ignore = true;
  };
}, [person]);
```

Mover objetos dentro del efecto para evitar dependencias inestables
```jsx
useEffect(() => {
  const options = { serverUrl, roomId };
  const connection = createConnection(options);
  connection.connect();
  return () => connection.disconnect();
}, [serverUrl, roomId]);
```

#### Sources
- [React docs, useEffect](https://react.dev/reference/react/useEffect)

### Custom hooks
#### Details
Un custom hook extrae lógica reutilizable que usa hooks. La convención `useX` no es estética: le permite a React y al linter aplicar las reglas de hooks. Cada llamada al custom hook tiene su propio estado; no crea estado global compartido a menos que internamente use una fuente compartida.

La señal de que necesitas un custom hook suele ser repetición de comportamiento, no repetición visual: debounce, conexión a un servicio, lectura de media query, estado de formulario, sincronización con localStorage o encapsular una API del navegador. El componente queda más declarativo y el hook esconde el detalle imperativo.

En entrevista, vale explicar el tradeoff: un hook demasiado genérico puede esconder el flujo y volverse difícil de probar. Mejor hooks pequeños nombrados por intención (`useDebouncedValue`, `useOnlineStatus`, `useChatRoom`) que un mega hook que maneja todo.

#### Examples
Hook simple para toggle
```jsx
function useToggle(init = false) {
  const [on, setOn] = useState(init);
  const toggle = () => setOn(value => !value);
  return [on, toggle];
}
```

Hook para debounce
```jsx
function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
```

Hook que encapsula una conexión
```jsx
function useChatRoom({ serverUrl, roomId }) {
  useEffect(() => {
    const connection = createConnection(serverUrl, roomId);
    connection.connect();
    return () => connection.disconnect();
  }, [serverUrl, roomId]);
}
```

Uso del hook en un componente
```jsx
function SearchBox() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 400);

  useEffect(() => {
    if (debouncedQuery) search(debouncedQuery);
  }, [debouncedQuery]);
}
```

#### Sources
- [React docs, Reusing logic with custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [React docs, useEffect: wrapping Effects in custom Hooks](https://react.dev/reference/react/useEffect#wrapping-effects-in-custom-hooks)

### Evitar renders innecesarios
#### Details
Un render no es automáticamente un problema. React puede ejecutar componentes sin que eso implique actualizar mucho DOM. El problema aparece cuando una interacción se vuelve lenta, un subárbol costoso se recalcula demasiadas veces, o props inestables rompen memoización.

`React.memo` puede saltar renders cuando las props no cambiaron, pero no evita renders por estado propio ni por context que consume el componente. `useMemo` cachea un cálculo o una referencia de objeto, y `useCallback` cachea una función. Estas herramientas ayudan cuando hay una razón concreta; usadas por default pueden ensuciar el código sin mejorar nada.

Una respuesta sólida en entrevista empieza por diagnóstico: usar React DevTools Profiler, mirar qué componente renderiza, por qué renderiza y cuánto cuesta. Antes de memoizar, revisa si el estado está demasiado arriba, si un context cambia demasiado, si hay efectos que disparan renders en cadena o si se están creando objetos/funciones innecesarias.

#### Examples
React.memo con props primitivas
```jsx
const UserBadge = React.memo(function UserBadge({ name, role }) {
  console.log("render badge");
  return <span>{name} · {role}</span>;
});
```

useMemo para cálculo costoso
```jsx
const sortedItems = useMemo(() => {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}, [items]);
```

useCallback para función pasada a hijo memoizado
```jsx
const handleSelect = useCallback((id) => {
  setSelectedId(id);
}, []);

return <MemoizedList items={items} onSelect={handleSelect} />;
```

Evitar objeto nuevo que rompe memo
```jsx
const options = useMemo(() => ({
  pageSize,
  sortBy,
}), [pageSize, sortBy]);

return <DataGrid options={options} />;
```

Mejorar diseño antes de memoizar
```jsx
function ModalShell({ children }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      {open ? <div className="modal">{children}</div> : null}
    </>
  );
}
```

#### Sources
- [React docs, memo](https://react.dev/reference/react/memo)
- [React docs, useMemo](https://react.dev/reference/react/useMemo)
- [React docs, useCallback](https://react.dev/reference/react/useCallback)

## Interview Questions

### ¿Cómo evitas renders innecesarios en un componente?
Primero identifico la causa: props/estado que cambian de referencia en cada render. Mantengo referencias estables con `useCallback`/`useMemo`, envuelvo hijos costosos en `React.memo`, y subo o divido el estado para que un cambio no re-renderice todo el árbol. Clave: medir con el Profiler antes de optimizar; la mayoría de los renders son baratos.

### Explicá el "ciclo de vida" de un componente con hooks.
Montaje: corre el cuerpo del componente y luego los `useEffect` con `[]`. Actualización: cada cambio de estado/props re-ejecuta el cuerpo y re-corre los efectos cuyas dependencias cambiaron (corriendo antes su cleanup). Desmontaje: corre el cleanup de cada efecto. No hay métodos como en clases; todo se modela con efectos y sus dependencias.

### ¿Cómo compartirías lógica con estado entre varios componentes sin herencia?
Con un custom hook: extraigo la lógica (estado + efectos) en una función `useAlgo()` que cada componente llama. Cada uso tiene su propia instancia de estado aislada. Es la alternativa moderna a HOCs y render props, sin el "wrapper hell".
