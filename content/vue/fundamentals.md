---
stack: vue
id: vue-fundamentals
title: "Vue: Fundamentos y Reactividad"
area: Frontend
priority: high
resourceLabel: Vue.js, Guide
resourceUrl: https://vuejs.org/guide/introduction.html
---

## Summary
Cómo funciona la reactividad de Vue 3, cuándo usar Composition API vs Options API, y las decisiones de template que más se preguntan en entrevista.

## Concepts

### Reactividad basada en Proxy (ref y reactive)
#### Details
Vue 3 reescribió el sistema de reactividad usando `Proxy` de ES2015, en vez del `Object.defineProperty` que usaba Vue 2. La diferencia no es un detalle de implementación: `Object.defineProperty` solo puede interceptar propiedades que ya existen en el objeto al momento de definir los getters/setters, por eso en Vue 2 agregar una propiedad nueva a un objeto reactivo (`this.obj.nuevaProp = valor`) o modificar un índice de array por asignación directa no disparaba la reactividad, y había que usar `Vue.set`/`this.$set`. Un `Proxy` envuelve el objeto completo e intercepta cualquier operación (get, set, deleteProperty, has), incluyendo propiedades agregadas después, por lo que ese problema desaparece.

`reactive()` envuelve un objeto en un Proxy profundo: cualquier acceso a sus propiedades queda "trackeado" como dependencia, y cualquier mutación dispara los efectos que dependen de ella. `ref()` existe porque un Proxy no puede envolver un primitivo (un `number` o `string` no tiene identidad de objeto); por eso `ref` guarda el valor dentro de un objeto con una propiedad `.value`, y esa propiedad sí es interceptable. Cuando usás `ref` con objetos, Vue internamente llama a `reactive()` sobre ese valor.

El punto que más se pregunta en entrevista es "¿por qué `.value` en el script pero no en el template?": el compilador de templates desenvuelve (`unwrap`) automáticamente los refs de nivel superior que están en el scope del componente, así que en el template escribís `{{ count }}` en vez de `{{ count.value }}`. Dentro de `<script setup>` o funciones normales de JS, el desenvolvimiento no es automático y hay que acceder con `.value` explícitamente.

#### Examples
ref para primitivos, acceso con .value en script
```js
import { ref } from 'vue'

const count = ref(0)
console.log(count.value) // 0
count.value++
```

reactive para objetos, sin .value
```js
import { reactive } from 'vue'

const state = reactive({ count: 0, user: { name: 'Ana' } })
state.count++ // reactivo
state.user.name = 'Bea' // también reactivo (proxy profundo)
```

Vue 2 no detectaba agregar propiedades nuevas
```js
// Vue 2 (Object.defineProperty), esto NO era reactivo:
this.obj.nuevaProp = 'valor'
// había que usar:
this.$set(this.obj, 'nuevaProp', 'valor')

// Vue 3 (Proxy), esto SÍ es reactivo directamente:
state.nuevaProp = 'valor'
```

toRefs para desestructurar sin perder reactividad
```js
import { reactive, toRefs } from 'vue'

const state = reactive({ count: 0, name: 'Ana' })
// desestructurar `state` directamente rompe la reactividad
const { count, name } = toRefs(state)
```

#### Sources
- [Vue docs, Reactivity Fundamentals](https://vuejs.org/guide/essentials/reactivity-fundamentals.html)
- [Vue docs, Reactivity in Depth](https://vuejs.org/guide/extras/reactivity-in-depth.html)

### Composition API vs Options API
#### Details
Options API organiza un componente por tipo de opción (`data`, `methods`, `computed`, `watch`), lo cual es fácil de leer en componentes chicos porque cada bloque tiene un lugar fijo. El problema aparece cuando un componente crece: la lógica de una sola feature (por ejemplo, un buscador con debounce) termina esparcida entre `data`, `methods` y `watch`, y para entenderla hay que saltar entre secciones.

Composition API resuelve eso organizando el código por feature en vez de por tipo de opción: todo el estado y la lógica relacionada a una funcionalidad puede vivir junto dentro de `setup()` (o directamente en el bloque `<script setup>`), y esa lógica se puede extraer a una función reutilizable ("composable"), que es el equivalente conceptual a un custom hook de React. Esto también resuelve el problema de reutilización que en Options API se resolvía con mixins, los cuales tenían colisión de nombres y un origen de propiedades poco claro.

Para entrevista, la respuesta correcta no es "Composition API es superior en todos los casos": Options API sigue siendo válida para componentes simples o para equipos que vienen de Vue 2 y priorizan la convención sobre la flexibilidad. La recomendación oficial de Vue es usar Composition API con `<script setup>` para proyectos nuevos, sobre todo si hay TypeScript de por medio, porque la inferencia de tipos es mucho mejor que con Options API.

#### Examples
Mismo componente en Options API
```vue
<script>
export default {
  data() {
    return { count: 0 }
  },
  computed: {
    doubled() {
      return this.count * 2
    }
  },
  methods: {
    increment() {
      this.count++
    }
  }
}
</script>
```

Mismo componente en Composition API con script setup
```vue
<script setup>
import { ref, computed } from 'vue'

const count = ref(0)
const doubled = computed(() => count.value * 2)

function increment() {
  count.value++
}
</script>
```

Composable reutilizable (equivalente a un custom hook)
```js
// useCounter.js
import { ref, computed } from 'vue'

export function useCounter(initial = 0) {
  const count = ref(initial)
  const doubled = computed(() => count.value * 2)
  function increment() {
    count.value++
  }
  return { count, doubled, increment }
}
```

Uso del composable en dos componentes distintos, sin colisión
```vue
<script setup>
import { useCounter } from './useCounter'

const { count, doubled, increment } = useCounter(10)
</script>
```

#### Sources
- [Vue docs, Composition API FAQ](https://vuejs.org/guide/extras/composition-api-faq.html)
- [Vue docs, Composables](https://vuejs.org/guide/reusability/composables.html)

### computed vs watch
#### Details
`computed` define un valor derivado de otras fuentes reactivas y se cachea: solo se recalcula cuando alguna de sus dependencias reactivas cambia, y si se lee varias veces sin que las dependencias cambien, devuelve el valor cacheado sin volver a ejecutar la función. Esto lo hace la herramienta correcta cuando lo que necesitás es un valor sincrónico derivado de otro estado, como un total, un filtro o un string formateado.

`watch` está pensado para efectos secundarios: reaccionar a un cambio para hacer algo que no es "calcular un valor", como hacer un fetch, escribir en `localStorage`, animar algo o loguear. A diferencia de `computed`, `watch` no cachea nada y no devuelve un valor reactivo nuevo; corre una función callback cada vez que la fuente observada cambia, y esa función puede ser asíncrona.

El error común de entrevista es usar `watch` para calcular un valor derivado (guardarlo en un `ref` aparte con un watcher), lo cual duplica estado y agrega una fuente extra de bugs de sincronización, cuando `computed` ya resolvía el problema de forma declarativa y sin estado adicional. También vale mencionar `watchEffect`, que a diferencia de `watch` no necesita que le especifiques las fuentes: las detecta automáticamente rastreando qué reactivos se leen dentro de la función durante su primera ejecución.

#### Examples
computed para un valor derivado y cacheado
```js
import { ref, computed } from 'vue'

const items = ref([{ price: 10 }, { price: 20 }])
const total = computed(() =>
  items.value.reduce((sum, item) => sum + item.price, 0)
)
```

watch para un efecto secundario (fetch al cambiar un id)
```js
import { ref, watch } from 'vue'

const userId = ref(1)
const user = ref(null)

watch(userId, async (newId) => {
  user.value = await fetchUser(newId)
}, { immediate: true })
```

Antipatrón: usar watch para lo que computed ya resuelve
```js
// mal: estado duplicado y desincronizable
const items = ref([{ price: 10 }])
const total = ref(0)
watch(items, () => {
  total.value = items.value.reduce((sum, i) => sum + i.price, 0)
}, { deep: true })

// bien
const total = computed(() =>
  items.value.reduce((sum, i) => sum + i.price, 0)
)
```

watchEffect: fuentes detectadas automáticamente
```js
import { ref, watchEffect } from 'vue'

const query = ref('')
const page = ref(1)

watchEffect(() => {
  // corre de nuevo si cambia `query` o `page`, sin declararlos
  console.log(`buscando "${query.value}" en página ${page.value}`)
})
```

#### Sources
- [Vue docs, Computed Properties](https://vuejs.org/guide/essentials/computed.html)
- [Vue docs, Watchers](https://vuejs.org/guide/essentials/watchers.html)

### v-model y v-for: lo que hay debajo
#### Details
`v-model` en un input es azúcar sintáctica: se expande a un `:value` (o `:checked` según el tipo) más un listener de evento (`@input` o `@change`) que actualiza esa variable. En un componente propio, `v-model` por default se traduce a una prop `modelValue` más un evento `update:modelValue`; el componente hijo tiene que emitir ese evento para que el padre actualice su estado. Desde Vue 3.4 existe además el macro `defineModel()`, que simplifica ese contrato dentro de `<script setup>` sin tener que declarar la prop y el emit a mano. Entender este mecanismo es clave para poder implementar `v-model` en un componente de formulario custom (un input de moneda, un date picker, etc).

`key` en `v-for` no es un detalle cosmético: le dice al algoritmo de diffing de Vue cómo identificar de forma estable cada nodo entre renders, para poder reordenar, insertar o eliminar elementos del DOM real reutilizando los correctos en vez de recrearlos todos. Usar el índice del array como `key` es un antipatrón cuando la lista puede reordenarse, insertar o borrar elementos en el medio, porque el índice de un ítem cambia aunque el ítem sea el mismo, lo que confunde al diffing y puede causar que el estado interno de un componente (por ejemplo, el valor tipeado en un input dentro del `v-for`) termine asociado al ítem equivocado.

#### Examples
v-model expandido manualmente en un input nativo
```vue
<input :value="text" @input="text = $event.target.value" />
<!-- equivalente a: -->
<input v-model="text" />
```

v-model en un componente propio (Vue 3.4+, defineModel)
```vue
<!-- CustomInput.vue -->
<script setup>
const model = defineModel()
</script>
<template>
  <input v-model="model" />
</template>
```

v-model en un componente propio (forma explícita, sin defineModel)
```vue
<!-- CustomInput.vue -->
<script setup>
defineProps(['modelValue'])
defineEmits(['update:modelValue'])
</script>
<template>
  <input
    :value="modelValue"
    @input="$emit('update:modelValue', $event.target.value)"
  />
</template>
```

key correcto vs antipatrón del índice
```vue
<!-- mal: si se borra el primer item, el estado interno se desalinea -->
<li v-for="(todo, index) in todos" :key="index">
  <input v-model="todo.text" />
</li>

<!-- bien: key estable basada en un id -->
<li v-for="todo in todos" :key="todo.id">
  <input v-model="todo.text" />
</li>
```

#### Sources
- [Vue docs, Component v-model](https://vuejs.org/guide/components/v-model.html)
- [Vue docs, List Rendering, key](https://vuejs.org/guide/essentials/list.html#maintaining-state-with-key)

## Interview Questions

### ¿Por qué Vue 3 migró de `Object.defineProperty` a `Proxy` para la reactividad, y qué problema concreto resolvió?
`Object.defineProperty` solo intercepta propiedades ya definidas al momento de hacer reactivo el objeto, entonces agregar propiedades nuevas o modificar índices de array no disparaba reactividad en Vue 2, y había que usar `Vue.set`/`Vue.delete` como workaround. `Proxy` intercepta el objeto completo (get/set/has/deleteProperty), así que cualquier mutación, incluyendo propiedades agregadas después, se detecta sin API especial. El tradeoff es que `Proxy` no es soportable en navegadores muy viejos, motivo por el cual Vue 2 no pudo usarlo.

### Tenés un componente Options API que creció mucho y se volvió difícil de mantener. ¿Migrarías a Composition API? ¿Cómo lo harías sin romper todo de una vez?
Migraría de forma incremental: Vue 3 permite mezclar Options API y Composition API en el mismo componente (usando `setup()` junto a otras opciones), así que se puede extraer la lógica más enredada (por feature, no por tipo) a composables uno por uno, verificando que cada extracción no cambie comportamiento, antes de convertir el resto del componente. No migraría todo el proyecto de golpe si no hay tests que cubran el comportamiento actual.

### ¿Cuándo elegirías `watch` en vez de `computed` para resolver un valor que depende de otro estado?
Nunca, si lo único que necesito es el valor derivado en sí: para eso `computed` es más simple, cachea y no genera estado adicional. Usaría `watch` cuando necesito ejecutar un efecto secundario en respuesta a un cambio (llamar a una API, escribir en storage, resetear otro campo del formulario), es decir, cuando el objetivo no es "tener un valor" sino "hacer algo cuando el valor cambia".

### Un compañero implementó `v-model` en un input de precio custom copiando y pegando el patrón de un input de texto simple, pero algo no actualiza bien el valor formateado. ¿Qué revisarías?
Revisaría el contrato de `v-model`: que el componente reciba correctamente la prop (`modelValue` o el nombre custom con `v-model:precio`) y emita el evento `update:modelValue` (o `update:precio`) con el valor ya transformado al tipo esperado por el padre, no el string crudo del input. Un bug típico es emitir el string del evento nativo sin parsear a número, o mutar directamente la prop en vez de emitir el evento (las props son de solo lectura desde el hijo).

### En un `v-for` con una lista de tareas que el usuario puede reordenar con drag and drop, ¿qué `key` usarías y por qué es importante en este caso puntual?
Usaría un id estable de cada tarea (no el índice), porque al reordenar, el índice de cada ítem cambia aunque el ítem en sí sea el mismo. Si la key fuera el índice, Vue reutilizaría los nodos del DOM en las posiciones que no cambiaron de índice pero sí de contenido, lo que puede desincronizar estado interno de cada fila (inputs, animaciones, foco) del ítem real que representa.

### ¿Qué ventaja concreta tiene `<script setup>` con TypeScript frente a Options API?
La inferencia de tipos es directa: las props declaradas con `defineProps<Props>()` y los emits con `defineEmits<Emits>()` se tipan con interfaces de TypeScript nativas, sin necesidad de helpers adicionales para que el editor infiera tipos correctamente. En Options API, especialmente con mixins o `this`, la inferencia de tipos es mucho más débil y requiere más anotaciones manuales.
