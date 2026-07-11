---
stack: react
id: react-accessibility
title: React: Accesibilidad (a11y)
area: Frontend
priority: medium
resourceLabel: MDN, ARIA
resourceUrl: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA
---

## Summary
Construir UI usable por todos: HTML semántico, ARIA solo cuando hace falta, formularios con labels y manejo de foco/teclado.

## Concepts

### HTML semántico primero, ARIA después
#### Details
La primera regla de ARIA es: **no uses ARIA si un elemento HTML nativo ya hace el trabajo**. Un `<button>` es accesible por teclado, anunciable por lectores de pantalla y enfocable por defecto; un `<div onClick>` no es nada de eso sin que lo arregles a mano. En React es fácil caer en `<div>` con onClick por estilo, y eso rompe accesibilidad.

ARIA (roles, estados, propiedades) sirve para llenar huecos cuando construís un widget que no tiene equivalente nativo (un combobox custom, un tab panel). Pero ARIA mal puesto es peor que nada: anuncia algo que no se comporta así. La jerarquía es: elemento semántico correcto → si no existe, ARIA + comportamiento de teclado completo.

En entrevista, la señal de seniority es decir "uso `<button>`, `<nav>`, `<main>`, `<label>` reales, y ARIA solo para widgets custom, siempre con el comportamiento de teclado que el rol implica".

#### Examples
Semántico (accesible) vs div (no)
```jsx
// ✅ accesible por teclado y lectores de pantalla
<button onClick={save}>Guardar</button>

// ⚠️ necesita role, tabIndex y handler de teclado para igualar al button
<div onClick={save}>Guardar</div>
```

ARIA para un widget custom (con su comportamiento)
```jsx
<div role="tab" aria-selected={active} tabIndex={active ? 0 : -1}>
  {label}
</div>
```

#### Sources
- [MDN, ARIA](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA)
- [W3C, First Rule of ARIA Use](https://www.w3.org/TR/using-aria/#firstrule)

### Formularios accesibles
#### Details
Todo control de formulario necesita un **label asociado**. Lo correcto es un `<label htmlFor={id}>` ligado al `id` del input (en JSX es `htmlFor`, no `for`). Un placeholder NO es un label: desaparece al escribir y muchos lectores de pantalla no lo anuncian como nombre del campo.

Los errores de validación deben ser **percibibles**: asociar el mensaje al campo con `aria-describedby`, marcar el campo inválido con `aria-invalid`, y anunciar cambios dinámicos con un `aria-live` region para que el lector de pantalla los lea sin que el usuario tenga que buscarlos.

Esto conecta con el módulo de testing: si testeás con `getByLabelText`/`getByRole`, estás forzando markup accesible de paso. UI accesible y UI testeable empujan en la misma dirección.

#### Examples
Label asociado + error percibible
```jsx
<label htmlFor="email">Correo</label>
<input
  id="email"
  type="email"
  aria-invalid={!!error}
  aria-describedby={error ? "email-error" : undefined}
/>
{error && <p id="email-error" role="alert">{error}</p>}
```

#### Sources
- [MDN, Labeling controls](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Forms)
- [React docs, input (htmlFor)](https://react.dev/reference/react-dom/components/input)

### Teclado y manejo de foco
#### Details
Todo lo que se puede hacer con mouse tiene que poder hacerse con teclado. Eso implica orden de tabulación lógico, foco visible (no remover el outline sin reemplazo), y, en componentes como modales/menús, **gestionar el foco**: al abrir un modal el foco entra en él, queda atrapado adentro (focus trap), y al cerrar vuelve al elemento que lo abrió.

En React, mover foco es uno de los usos legítimos de `useEffect` + `ref` (sincronizar con el DOM). También conviene `Escape` para cerrar overlays y respetar `prefers-reduced-motion` para animaciones.

En entrevista, mencionar focus management en modales muestra que pensás más allá de "se ve bien": pensás en cómo se navega sin mouse, que es accesibilidad real y también mejor UX para power users.

#### Examples
Mover foco al abrir (uso válido de useEffect + ref)
```jsx
const closeRef = useRef(null);
useEffect(() => {
  if (isOpen) closeRef.current?.focus();
}, [isOpen]);

// <button ref={closeRef} onClick={onClose}>Cerrar</button>
```

#### Sources
- [MDN, Keyboard-navigable JavaScript widgets](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Keyboard-navigable_JavaScript_widgets)
- [WAI-ARIA Authoring Practices, Dialog (Modal)](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)

## Interview Questions

### ¿Por qué evitar `<div onClick>` y preferir `<button>`?
Porque un `<button>` es accesible por defecto: enfocable con Tab, activable con Enter/Espacio y anunciado como botón por lectores de pantalla. Un `<div onClick>` no es nada de eso; para igualarlo tendría que agregar `role="button"`, `tabIndex={0}` y handlers de teclado. Usar el elemento semántico correcto es menos código y más accesible. ARIA lo reservo para widgets sin equivalente nativo.

### ¿Cómo hacés accesible un formulario en React?
Cada control con su `<label htmlFor>` ligado al `id` (no placeholder como label). Los errores los asocio con `aria-describedby`, marco el campo con `aria-invalid`, y uso `role="alert"`/`aria-live` para que los cambios dinámicos se anuncien. De paso, esto hace el formulario testeable con `getByLabelText`/`getByRole`.

### ¿Qué es el focus management y por qué importa en un modal?
Es controlar dónde está el foco del teclado. En un modal: al abrir, el foco entra al diálogo; mientras está abierto, queda atrapado adentro (no se va al contenido de atrás); al cerrar, vuelve al elemento que lo abrió. Importa porque sin eso un usuario de teclado o lector de pantalla queda "perdido" detrás del modal. En React lo resuelvo con `ref` + `useEffect` y manejo de Tab/Escape.
