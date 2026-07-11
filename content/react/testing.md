---
stack: react
id: react-testing
title: Testing en React
area: Frontend
priority: high
resourceLabel: Testing Library, React Testing Library
resourceUrl: https://testing-library.com/docs/react-testing-library/intro/
---

## Summary
Pruebas de componentes enfocadas en comportamiento observable: queries accesibles, eventos de usuario, async UI y mocks mínimos.

## Concepts

### React Testing Library: pruebas como usuario
#### Details
React Testing Library existe para evitar tests acoplados a detalles de implementación. Su principio guía es: mientras más se parezcan tus tests a cómo una persona usa el software, más confianza dan. Por eso trabaja con nodos reales del DOM y no con instancias internas de componentes.

La fuente recomienda buscar elementos como lo haría un usuario: rol accesible, nombre visible, labels, texto y estado observable. Esto hace que refactors internos no rompan tests si el comportamiento no cambió. También empuja a construir UI más accesible, porque si no puedes seleccionar un botón por rol y nombre, quizá tu markup no está comunicando bien la intención.

En entrevista, no digas solo "uso render y fireEvent". Explicá que testearías el contrato visible: qué ve el usuario, qué acción realiza, qué cambia en pantalla o qué request se dispara. Evitaría probar `state`, nombres de métodos o estructura interna salvo que sea una unidad pura fuera de React.

#### Examples
Buscar por rol y nombre accesible
```jsx
import { render, screen } from "@testing-library/react";

test("muestra el botón de guardar", () => {
  render(<ProfileForm />);

  expect(
    screen.getByRole("button", { name: /guardar/i }),
  ).toBeInTheDocument();
});
```

Probar comportamiento observable
```jsx
import userEvent from "@testing-library/user-event";

test("envía el formulario", async () => {
  const user = userEvent.setup();
  render(<ContactForm />);

  await user.type(screen.getByLabelText(/email/i), "ada@example.com");
  await user.click(screen.getByRole("button", { name: /enviar/i }));

  expect(await screen.findByText(/mensaje enviado/i)).toBeInTheDocument();
});
```

Evitar test frágil por implementación
```jsx
// Frágil: depende de clases o estructura interna.
container.querySelector(".primary-button");

// Mejor: depende del contrato accesible.
screen.getByRole("button", { name: /enviar/i });
```

#### Sources
- [React Testing Library, Intro](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Library, About Queries](https://testing-library.com/docs/queries/about)

### Queries: getBy, queryBy y findBy
#### Details
Testing Library divide queries según qué esperas del DOM. `getBy...` falla si no encuentra un elemento o si encuentra más de uno, útil cuando el elemento debe existir ya. `queryBy...` devuelve `null` si no existe, útil para afirmar ausencia. `findBy...` devuelve una Promise y reintenta, útil para UI async que aparece después de un fetch, timer o transición.

La prioridad recomendada empieza por queries accesibles para todos: `getByRole` con `name` debería ser la primera opción para casi todo. Para formularios, `getByLabelText` refleja cómo una persona encuentra campos. `getByTestId` es escape hatch cuando no hay una forma semántica razonable.

Este detalle importa en entrevistas porque muestra que sabes escribir tests estables. Un test que usa `findByRole` para contenido async evita `setTimeout` manual. Un test que usa `queryByText` para ausencia evita errores de `getByText`. La query correcta expresa la expectativa.

#### Examples
Elemento que debe existir ahora
```jsx
render(<Login />);

expect(
  screen.getByRole("heading", { name: /iniciar sesión/i }),
).toBeInTheDocument();
```

Elemento que no debe estar
```jsx
expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
```

Elemento que aparece async
```jsx
await user.click(screen.getByRole("button", { name: /cargar/i }));

expect(
  await screen.findByRole("status", { name: /listo/i }),
).toBeInTheDocument();
```

Preferir label en formularios
```jsx
await user.type(
  screen.getByLabelText(/correo electrónico/i),
  "ada@example.com",
);
```

#### Sources
- [Testing Library, About Queries](https://testing-library.com/docs/queries/about)

### Jest, matchers y setup
#### Details
Jest provee el runner, assertions y CLI para ejecutar tests. La documentación básica muestra `test`, `expect` y matchers como `toBe`. En proyectos TypeScript modernos, puede requerir configuración de Babel, `ts-jest`, o usar alternativas como Vitest si el stack es Vite.

Para React, Jest por sí solo no define cómo interactuar con componentes; se combina con React Testing Library para renderizar DOM y con `@testing-library/jest-dom` para matchers como `toBeInTheDocument`. Separar responsabilidades ayuda: Jest corre y afirma; Testing Library encuentra elementos e interactúa desde la perspectiva del usuario.

En entrevista, destacá también límites: no mockear todo por default, no testear implementación, y elegir nivel de test según riesgo. Una función pura compleja puede tener unit tests; una pantalla crítica necesita integración de usuario; flujos end-to-end quedan para herramientas como Playwright/Cypress.

#### Examples
Test unitario básico con Jest
```js
test("adds 1 + 2 to equal 3", () => {
  expect(sum(1, 2)).toBe(3);
});
```

Script de test
```json
{
  "scripts": {
    "test": "jest"
  }
}
```

Importar APIs tipadas de Jest
```ts
import { describe, expect, test } from "@jest/globals";

describe("sum", () => {
  test("adds numbers", () => {
    expect(sum(1, 2)).toBe(3);
  });
});
```

React + jest-dom matcher
```jsx
render(<SubmitButton />);

expect(
  screen.getByRole("button", { name: /enviar/i }),
).toBeEnabled();
```

#### Sources
- [Jest docs, Getting Started](https://jestjs.io/docs/getting-started)
- [React Testing Library, Intro](https://testing-library.com/docs/react-testing-library/intro/)

## Interview Questions

### ¿Qué hace bueno a un test de React?
Un buen test verifica comportamiento observable, no implementación. Busca elementos como los encontraría el usuario, ejecuta acciones reales o cercanas a reales y afirma cambios visibles. Si un refactor interno rompe el test sin cambiar comportamiento, probablemente el test está demasiado acoplado.

### ¿Cuándo usarías getBy, queryBy y findBy?
`getBy` cuando el elemento debe existir ya, `queryBy` para afirmar ausencia, y `findBy` cuando esperas que aparezca de forma async. Elegir bien la query evita esperas manuales y hace que la intención del test sea clara.
