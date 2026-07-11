---
stack: react
id: react-forms
title: React: Formularios y controlled components
area: Frontend
priority: high
resourceLabel: React docs, input
resourceUrl: https://react.dev/reference/react-dom/components/input
---

## Summary
Manejo de formularios en React: controlled vs uncontrolled, estado de muchos campos, validación y rendimiento.

## Concepts

### Controlled vs uncontrolled
#### Details
Un input **controlado** tiene su valor manejado por estado de React (`value` + `onChange`): React es la fuente de la verdad y el input siempre refleja el estado. Un input **no controlado** deja el valor en el DOM y lo leés cuando hace falta (con un `ref` o desde el `FormData` al enviar).

La decisión en entrevista: controlado cuando necesitás reaccionar a cada cambio (validación en vivo, habilitar/deshabilitar, formatear mientras se escribe, campos dependientes). No controlado cuando solo te interesa el valor final al enviar, es menos código y menos re-renders. Un patrón moderno muy limpio es form no controlado + leer `FormData` en el submit.

Error clásico: poner `value` sin `onChange` deja el input de solo lectura (React fija el valor y no hay quién lo actualice). Si querés un valor inicial sin controlar, usás `defaultValue`.

#### Examples
Input controlado
```jsx
function NameField() {
  const [name, setName] = useState("");
  return (
    <input value={name} onChange={(e) => setName(e.target.value)} />
  );
}
```

No controlado: leer FormData al enviar
```jsx
function ContactForm() {
  function handleSubmit(e) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    sendMessage(data.get("email"), data.get("body"));
  }
  return (
    <form onSubmit={handleSubmit}>
      <input name="email" defaultValue="" />
      <textarea name="body" />
      <button>Enviar</button>
    </form>
  );
}
```

#### Sources
- [React docs, input](https://react.dev/reference/react-dom/components/input)
- [React docs, Controlling an input with a state variable](https://react.dev/reference/react-dom/components/input#controlling-an-input-with-a-state-variable)

### Estado de muchos campos
#### Details
Un `useState` por campo no escala. Para formularios con varios campos conviene un solo objeto de estado y un handler genérico que usa el `name` del input, o `useReducer` cuando hay reglas de transición (validación cruzada, pasos, dependencias entre campos).

La clave de inmutabilidad: al actualizar un objeto de estado, creás una copia nueva (`{ ...form, [name]: value }`), nunca mutás el objeto existente, porque React compara por referencia para decidir re-render. Para estado anidado, copiás cada nivel que cambia.

`useReducer` brilla cuando la lógica del formulario tiene muchas reglas: centraliza las transiciones en una función pura, más fácil de testear y razonar que varios setters dispersos.

#### Examples
Un objeto + handler por name
```jsx
const [form, setForm] = useState({ email: "", password: "" });

function handleChange(e) {
  const { name, value } = e.target;
  setForm((f) => ({ ...f, [name]: value }));
}

// <input name="email" value={form.email} onChange={handleChange} />
```

useReducer para lógica con reglas
```jsx
function reducer(state, action) {
  switch (action.type) {
    case "field":
      return { ...state, [action.name]: action.value };
    case "reset":
      return initialState;
    default:
      return state;
  }
}
const [state, dispatch] = useReducer(reducer, initialState);
```

#### Sources
- [React docs, Updating Objects in State](https://react.dev/learn/updating-objects-in-state)
- [React docs, useReducer](https://react.dev/reference/react/useReducer)

### Validación, envío y rendimiento
#### Details
La validación puede ser en vivo (controlado: validás en `onChange`/`onBlur`) o al enviar (revisás antes de mandar). En vivo da feedback inmediato pero re-renderiza por tecla; al enviar es más barato. Una práctica común es validar on-blur por campo y revalidar todo en el submit.

El problema de rendimiento típico en formularios grandes es que **cada tecla re-renderiza todo el formulario** si todo el estado vive arriba. Mitigaciones: dividir en subcomponentes, mantener el estado lo más local posible, o usar librerías (React Hook Form) que evitan re-renders con inputs no controlados + refs. En React 19, las **Actions** (`useActionState`, `useFormStatus`) gestionan pending/errores del envío sin cablear flags a mano (ver el módulo de React moderno).

En entrevista, la respuesta fuerte conecta el patrón con el costo: "controlado para feedback en vivo, pero si el form es grande, aíslo estado o uso uncontrolled/RHF para no re-renderizar todo en cada tecla".

#### Examples
Validación al enviar
```jsx
function handleSubmit(e) {
  e.preventDefault();
  const errs = {};
  if (!form.email.includes("@")) errs.email = "Email inválido";
  if (form.password.length < 8) errs.password = "Mínimo 8 caracteres";
  setErrors(errs);
  if (Object.keys(errs).length === 0) submit(form);
}
```

Aislar un campo caro para no re-renderizar todo
```jsx
// El estado del input vive en el subcomponente, no en el form padre
const EmailField = memo(function EmailField({ onValid }) {
  const [email, setEmail] = useState("");
  return <input value={email} onChange={(e) => setEmail(e.target.value)} />;
});
```

#### Sources
- [React docs, Reacting to Input with State](https://react.dev/learn/reacting-to-input-with-state)
- [React docs, &lt;form&gt;](https://react.dev/reference/react-dom/components/form)

## Interview Questions

### Controlled vs uncontrolled: ¿cuándo usarías cada uno?
Controlado cuando necesito reaccionar a cada cambio: validación en vivo, formateo mientras se escribe, habilitar/deshabilitar botones, campos dependientes. No controlado cuando solo me importa el valor final al enviar, menos código y menos re-renders, leyendo `FormData` o un `ref` en el submit. En formularios grandes me inclino por uncontrolled (o React Hook Form) justamente para no re-renderizar en cada tecla.

### ¿Cómo manejarías un formulario de muchos campos sin un useState por campo?
Uso un solo objeto de estado y un handler genérico que actualiza por `e.target.name` con copia inmutable (`{...form, [name]: value}`). Si la lógica tiene reglas (validación cruzada, pasos, dependencias), paso a `useReducer` para centralizar las transiciones en una función pura, más fácil de testear. Y mantengo la inmutabilidad porque React compara por referencia.

### Un formulario grande se siente lento: cada tecla lo re-renderiza entero. ¿Qué hacés?
El estado está demasiado arriba, así que cada cambio re-renderiza todo. Lo divido en subcomponentes con estado local por campo, o paso a inputs no controlados / React Hook Form que usan refs y evitan re-render por tecla. Mido con el Profiler para confirmar dónde está el costo antes de optimizar. Memoizar ayuda solo si las props de los hijos son estables.

### ¿Por qué un input con `value` pero sin `onChange` queda "trabado"?
Porque al pasar `value` lo convertís en controlado: React fija el valor al del estado, pero sin `onChange` no hay forma de actualizar ese estado, así que el input ignora lo que tipeás (queda de solo lectura, con un warning). La solución es agregar `onChange` que actualice el estado, o usar `defaultValue` si solo querés un valor inicial no controlado.
