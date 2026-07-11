---
stack: react
id: react-error-boundaries
title: React: Error boundaries y manejo de errores
area: Frontend
priority: medium
resourceLabel: React docs, Error boundaries
resourceUrl: https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
---

## Summary
Aislar fallos de UI con error boundaries: qué capturan, qué no, cómo implementarlos y dónde ubicarlos.

## Concepts

### Qué capturan (y qué NO)
#### Details
Un error boundary captura errores lanzados **durante el render**, en métodos de ciclo de vida y en constructores de los componentes que tiene debajo. En vez de que un crash desmonte toda la app (pantalla en blanco), el boundary muestra una UI de fallback para ese subárbol.

Lo más preguntado es lo que **NO** capturan: errores en **event handlers** (esos los manejás con try/catch normal), código **asíncrono** (`setTimeout`, promesas, `fetch`), errores en el **SSR**, y errores lanzados en el **propio** boundary. Saber esta lista distingue a alguien que los entiende de alguien que cree que atrapan todo.

Para los casos que el boundary no cubre (async/handlers), manejás el error vos: try/catch y, si querés UI de error, lo pasás a estado y renderizás un mensaje, o lo propagás a un estado que el boundary sí pueda ver.

#### Examples
Error de render (lo captura el boundary)
```jsx
function Profile({ user }) {
  return <h1>{user.name}</h1>; // si user es null, throw -> fallback
}
```

Error en handler (NO lo captura: try/catch)
```jsx
async function handleSave() {
  try {
    await api.save(form);
  } catch (e) {
    setError("No se pudo guardar");
  }
}
```

#### Sources
- [React docs, Catching rendering errors with an error boundary](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)

### Cómo implementarlos
#### Details
Hoy un error boundary se implementa con un **componente de clase** que define `static getDerivedStateFromError` (para mostrar el fallback) y/o `componentDidCatch` (para loguear el error a un servicio). No existe un Hook equivalente: es el único caso donde todavía se usa una clase.

En la práctica, la mayoría usa la librería **react-error-boundary**, que da un `<ErrorBoundary>` con `FallbackComponent` y un `onReset`/`resetKeys` para reintentar sin recargar. React 19 además agrega callbacks globales `onCaughtError` y `onUncaughtError` para centralizar el logging.

La regla: `getDerivedStateFromError` para el QUÉ mostrar (UI), `componentDidCatch` para el efecto secundario (logging a Sentry/etc.). No hagas fetch ni lógica pesada en el render del fallback.

#### Examples
Boundary con clase
```jsx
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    logToService(error, info.componentStack);
  }
  render() {
    return this.state.hasError ? <Fallback /> : this.props.children;
  }
}
```

Con react-error-boundary (reintento)
```jsx
<ErrorBoundary FallbackComponent={Fallback} onReset={refetch} resetKeys={[userId]}>
  <Profile userId={userId} />
</ErrorBoundary>
```

#### Sources
- [React docs, componentDidCatch](https://react.dev/reference/react/Component#componentdidcatch)
- [React docs, getDerivedStateFromError](https://react.dev/reference/react/Component#static-getderivedstatefromerror)

### Dónde ubicarlos (granularidad)
#### Details
La estrategia importa más que la implementación. Un solo boundary en la raíz evita la pantalla en blanco pero convierte cualquier fallo en "toda la app rota". Lo ideal es **granularidad**: boundaries alrededor de secciones independientes (un widget, una ruta, un panel) para que el fallo de una parte no tire el resto.

En una app con rutas, un boundary por ruta es buen default; dentro, boundaries adicionales en zonas riesgosas (un dashboard con widgets de terceros, un editor). Combinado con Suspense, podés tener fallback de carga y fallback de error por sección.

En entrevista, la respuesta senior conecta esto con UX y resiliencia: "si el widget de recomendaciones falla, el usuario igual ve su feed", en vez de un crash total.

#### Examples
Boundary por sección, no solo en la raíz
```jsx
<Layout>
  <ErrorBoundary FallbackComponent={FeedError}>
    <Feed />
  </ErrorBoundary>
  <ErrorBoundary FallbackComponent={WidgetError}>
    <Recommendations />
  </ErrorBoundary>
</Layout>
```

#### Sources
- [react-error-boundary (GitHub)](https://github.com/bvaughn/react-error-boundary)

## Interview Questions

### ¿Qué captura y qué NO captura un error boundary?
Captura errores lanzados durante el render, en lifecycle y en constructores de los componentes debajo, mostrando un fallback en vez de tirar toda la app. NO captura errores en event handlers, en código async (timeouts, promesas, fetch), en SSR, ni en el propio boundary. Para esos casos uso try/catch y, si quiero UI de error, lo paso a estado.

### ¿Dónde ubicarías los error boundaries en una app?
No solo en la raíz: uso granularidad. Un boundary por ruta como default, y boundaries adicionales alrededor de secciones independientes o riesgosas (widgets de terceros, un editor). Así el fallo de una parte no rompe el resto y el usuario sigue usando lo que funciona. Lo combino con Suspense para tener fallback de carga y de error por sección.

### Un error en un `onClick` async no dispara tu error boundary. ¿Por qué y cómo lo manejás?
Porque los boundaries solo atrapan errores de render/lifecycle, no de event handlers ni de código asíncrono. Lo manejo con try/catch dentro del handler y llevo el error a estado para mostrar feedback (un toast o un mensaje inline). Si quisiera que el boundary lo muestre, puedo setear un estado que provoque un throw en el próximo render, pero normalmente el manejo local es más apropiado.
