---
stack: react
id: react-patterns-performance
title: React: Patrones y Rendimiento
area: Frontend
priority: high
resourceLabel: React docs, Performance APIs
resourceUrl: https://react.dev/reference/react/memo
---

## Summary
Patrones avanzados, performance, estado global y renderizado sin caer en memoización innecesaria.

## Concepts

### React.memo, useMemo y useCallback
#### Details
`memo` permite saltar el re-render de un componente cuando sus props no cambiaron. React aclara que es una optimización, no una garantía: el componente puede volver a renderizar si cambia su propio estado o un contexto que consume. También remarca que no deberías usar `memo` para arreglar bugs; si el código falla sin memoización, primero hay que corregir la causa.

La memoización solo ayuda cuando el componente renderiza con frecuencia, recibe exactamente las mismas props y el render es costoso. Si pasás objetos, arrays o funciones creadas en cada render, rompés la memoización porque cada referencia es nueva. Por eso `memo` suele ir acompañado de `useMemo` para estabilizar objetos/cálculos y `useCallback` para estabilizar funciones.

En entrevista, la respuesta fuerte no es "uso React.memo". Es: mediría con React DevTools Profiler, identificaría qué interacción está lenta, revisaría si el render es caro o si el problema viene de estado mal ubicado, efectos que disparan updates, props inestables o contexto demasiado amplio.

#### Examples
Componente memoizado que solo depende de props estables
```jsx
import { memo } from "react";

const Greeting = memo(function Greeting({ name }) {
  console.log("Greeting rendered");
  return <h3>Hello{name && `, ${name}`}!</h3>;
});
```

Objeto estable para no romper memo
```jsx
function Page({ name, age }) {
  const person = useMemo(
    () => ({ name, age }),
    [name, age],
  );

  return <Profile person={person} />;
}

const Profile = memo(function Profile({ person }) {
  return <div>{person.name}</div>;
});
```

Callback estable para un hijo memoizado
```jsx
function ProductPage({ productId, referrer }) {
  const handleSubmit = useCallback((orderDetails) => {
    post(`/product/${productId}/buy`, {
      referrer,
      orderDetails,
    });
  }, [productId, referrer]);

  return <ShippingForm onSubmit={handleSubmit} />;
}
```

Evitar custom compare peligroso
```jsx
const Chart = memo(ChartImpl, (oldProps, newProps) => {
  // Si comparas manualmente, tienes que comparar TODO,
  // incluyendo funciones que pueden cerrar sobre state viejo.
  return oldProps.points.length === newProps.points.length;
});
```

#### Sources
- [React docs, memo](https://react.dev/reference/react/memo)
- [React docs, useCallback](https://react.dev/reference/react/useCallback)
- [React docs, useMemo](https://react.dev/reference/react/useMemo)

### Estado local, Context y stores externos
#### Details
React recomienda preferir estado local y no levantarlo más de lo necesario. Estado transitorio como inputs, hover, pestañas abiertas o modales suele pertenecer cerca del componente que lo usa. Subirlo demasiado alto hace que más árbol renderice y que la lógica sea más difícil de seguir.

Context es útil para datos transversales como tema, usuario autenticado, locale o configuración, pero no es gratis: cuando cambia el valor del provider, los consumidores relevantes pueden re-renderizar. Para datos que cambian muy seguido o tienen muchas derivaciones, puede convenir dividir providers, pasar props mínimas a hijos memoizados o usar un store externo.

En entrevistas de arquitectura frontend, explica el criterio: colocaría el estado donde tenga el menor alcance correcto. Si muchos componentes lo necesitan y cambia poco, Context. Si es estado de servidor, usaría cache/data fetching. Si es estado cliente complejo con muchas escrituras, evaluaría Zustand, Redux Toolkit u otro store según el equipo y el problema.

#### Examples
Estado local para UI transitoria
```jsx
function ProductCard() {
  const [isQuickViewOpen, setQuickViewOpen] = useState(false);

  return (
    <>
      <button onClick={() => setQuickViewOpen(true)}>Quick view</button>
      {isQuickViewOpen && <QuickView onClose={() => setQuickViewOpen(false)} />}
    </>
  );
}
```

Separar lectura de context y memoizar el hijo pesado
```jsx
function GreetingContainer() {
  const theme = useContext(ThemeContext);
  return <Greeting theme={theme} name="Taylor" />;
}

const Greeting = memo(function Greeting({ theme, name }) {
  return <h3 className={theme}>Hello, {name}</h3>;
});
```

Reducir props en vez de pasar objetos grandes
```jsx
// Mejor para memo: props primitivas y mínimas.
<Profile name={person.name} age={person.age} />

// Peor si `person` se recrea en cada render.
<Profile person={{ name: person.name, age: person.age }} />
```

#### Sources
- [React docs, memo: principles for reducing unnecessary renders](https://react.dev/reference/react/memo#should-you-add-memo-everywhere)
- [React docs, memo: updating using context](https://react.dev/reference/react/memo#updating-a-memoized-component-using-a-context)

### Render puro y efectos mínimos
#### Details
React espera que el render sea puro: mismo input, mismo output, sin efectos secundarios. Muchos problemas de performance vienen de efectos que actualizan estado en cadena, dependencias inestables o lógica derivada que se guarda en estado en vez de calcularse durante render.

La fuente de `memo` lista principios que evitan memoización innecesaria: aceptar `children` en wrappers visuales, preferir estado local, mantener render puro, evitar efectos innecesarios que actualizan estado y remover dependencias innecesarias de efectos. Esto es más importante que memorizar APIs.

En una revisión técnica, buscaría primero efectos que hacen `setState` para datos derivados, objetos creados dentro del componente y pasados a effects, o componentes grandes que mezclan data fetching, transformación de datos y UI. Separar responsabilidades suele mejorar claridad antes que agregar `useMemo`.

#### Examples
Dato derivado sin estado extra
```jsx
function Cart({ items }) {
  const total = items.reduce((sum, item) => sum + item.price, 0);
  return <span>Total: {total}</span>;
}
```

Wrapper visual que acepta children
```jsx
function Panel({ children }) {
  const [open, setOpen] = useState(true);

  return (
    <section>
      <button onClick={() => setOpen(o => !o)}>Toggle</button>
      {open ? children : null}
    </section>
  );
}
```

Mover objeto dentro del effect para evitar dependencia inestable
```jsx
useEffect(() => {
  const options = { roomId, serverUrl };
  const connection = createConnection(options);
  connection.connect();
  return () => connection.disconnect();
}, [roomId, serverUrl]);
```

#### Sources
- [React docs, memo: reducing unnecessary renders](https://react.dev/reference/react/memo#should-you-add-memo-everywhere)
- [React docs, useEffect](https://react.dev/reference/react/useEffect)

## Interview Questions

### ¿Cuándo usarías React.memo y cuándo no?
Lo usaría cuando medí un render costoso que se repite con las mismas props. No lo usaría como default ni para corregir bugs; si el componente falla sin memo, el problema está en la lógica. También revisaría si props inestables están rompiendo la memoización.

### ¿Por qué un componente memoizado sigue re-renderizando?
Porque `memo` solo compara props. Si cambia su estado interno, un contexto que consume, o recibe objetos/funciones nuevas en cada render, puede volver a renderizar. La solución depende de la causa: estado más local, props mínimas, `useMemo`, `useCallback` o dividir context.
