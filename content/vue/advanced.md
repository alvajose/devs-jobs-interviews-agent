---
stack: vue
id: vue-advanced
title: "Vue: Comunicación, Lifecycle, Performance y Pinia"
area: Frontend
priority: medium
resourceLabel: Vue.js, Guide (Components in-depth)
resourceUrl: https://vuejs.org/guide/components/registration.html
---

## Summary
Cómo comunicar componentes sin acoplarlos, dónde limpiar side effects en Composition API, técnicas de performance de Vue 3 y por qué Pinia reemplazó a Vuex.

## Concepts

### Comunicación entre componentes: props/emits vs provide/inject
#### Details
El flujo de datos por default en Vue es unidireccional: un padre pasa datos a un hijo vía `props`, y el hijo notifica al padre vía eventos con `emit`. Esto es explícito y fácil de rastrear: mirando el template del padre, ves exactamente qué le pasás a cada hijo y qué eventos escuchás. El problema aparece con "prop drilling": cuando un dato necesita atravesar varios niveles de componentes intermedios que no usan ese dato, solo lo reenvían para que llegue a un nieto o bisnieto, y cada componente intermedio queda acoplado a un dato que no le importa.

`provide`/`inject` resuelve el prop drilling permitiendo que un componente ancestro "provea" un valor que cualquier descendiente, sin importar cuán profundo esté, puede "inyectar" directamente, sin que los componentes intermedios sepan que ese valor existe. Es el mecanismo que usan internamente librerías como Vue Router o un sistema de theming/i18n para que cualquier componente del árbol acceda a un contexto compartido.

El tradeoff que hay que saber explicar en entrevista: `provide`/`inject` rompe la trazabilidad explícita que tenían las props. Si abrís un componente hijo y usa `inject('algo')`, no podés saber a simple vista qué ancestro lo proveyó ni con qué valor, lo que dificulta el debugging en árboles grandes. Por eso la recomendación es usarlo para valores realmente transversales (tema, usuario autenticado, configuración de i18n), no como atajo genérico para evitar pasar un par de props.

#### Examples
Prop drilling: el nivel intermedio no usa el dato, solo lo reenvía
```vue
<!-- App.vue -->
<Layout :user="user" />

<!-- Layout.vue: no le importa `user`, solo lo reenvía -->
<Sidebar :user="user" />

<!-- Sidebar.vue: acá sí se usa -->
<span>{{ user.name }}</span>
```

Mismo caso resuelto con provide/inject
```vue
<!-- App.vue -->
<script setup>
import { provide, ref } from 'vue'
const user = ref({ name: 'Ana' })
provide('user', user)
</script>

<!-- Sidebar.vue, sin que Layout sepa nada de esto -->
<script setup>
import { inject } from 'vue'
const user = inject('user')
</script>
<template>
  <span>{{ user.name }}</span>
</template>
```

provide con valor de solo lectura para evitar mutaciones desde el descendiente
```js
import { provide, readonly, ref } from 'vue'

const count = ref(0)
provide('count', readonly(count))
provide('incrementCount', () => count.value++)
```

emit tipado en script setup
```vue
<script setup lang="ts">
const emit = defineEmits<{
  save: [payload: { id: number; name: string }]
}>()

function handleSave() {
  emit('save', { id: 1, name: 'Ana' })
}
</script>
```

#### Sources
- [Vue docs, Props](https://vuejs.org/guide/components/props.html)
- [Vue docs, Component Events](https://vuejs.org/guide/components/events.html)
- [Vue docs, Provide / Inject](https://vuejs.org/guide/components/provide-inject.html)

### Lifecycle hooks en Composition API y cleanup
#### Details
En Composition API, los lifecycle hooks son funciones que se importan y se llaman dentro de `setup()` (o directamente en `<script setup>`), en vez de ser opciones del objeto del componente como en Options API. La regla importante es que estos hooks deben registrarse de forma síncrona durante la ejecución de `setup()`; no podés llamarlos después de un `await` o dentro de un callback asíncrono, porque Vue necesita saber en qué instancia de componente está corriendo el hook al momento de registrarlo, y ese contexto se pierde después de un punto de suspensión asíncrono.

`onMounted` corre después de que el componente se montó y su DOM ya existe, que es el momento correcto para integrar librerías de terceros que necesitan un nodo del DOM real (un gráfico, un mapa, un editor de texto enriquecido) o para iniciar timers/suscripciones. `onUnmounted` es su contraparte de limpieza: ahí hay que cancelar cualquier timer, cerrar cualquier conexión o desuscribirse de cualquier listener que se haya iniciado en `onMounted`, exactamente igual que el cleanup del return de un `useEffect` en React. Olvidar el cleanup en `onUnmounted` es la fuente más común de memory leaks y de "fantasmas" (código que sigue corriendo sobre un componente que ya no está en el DOM).

#### Examples
onMounted + onUnmounted simétricos (timer)
```vue
<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const seconds = ref(0)
let intervalId

onMounted(() => {
  intervalId = setInterval(() => {
    seconds.value++
  }, 1000)
})

onUnmounted(() => {
  clearInterval(intervalId)
})
</script>
```

Integrar una librería de terceros que necesita el DOM
```vue
<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import Chart from 'chart.js/auto'

const canvasRef = ref(null)
let chartInstance

onMounted(() => {
  chartInstance = new Chart(canvasRef.value, { type: 'bar', data: {} })
})

onUnmounted(() => {
  chartInstance.destroy()
})
</script>
<template>
  <canvas ref="canvasRef"></canvas>
</template>
```

Composable que encapsula setup + cleanup de un listener
```js
import { onMounted, onUnmounted } from 'vue'

export function useEventListener(target, event, handler) {
  onMounted(() => target.addEventListener(event, handler))
  onUnmounted(() => target.removeEventListener(event, handler))
}
```

Error común: registrar un hook después de un await
```js
// mal: onMounted no se registra dentro del contexto síncrono del setup
async function setup() {
  await fetchConfig()
  onMounted(() => {}) // no funciona como se espera
}

// bien: await dentro del propio hook, no antes de registrarlo
onMounted(async () => {
  await fetchConfig()
})
```

#### Sources
- [Vue docs, Lifecycle Hooks](https://vuejs.org/guide/essentials/lifecycle.html)
- [Vue docs, Composition API: Lifecycle Hooks](https://vuejs.org/api/composition-api-lifecycle.html)

### Performance: v-memo, KeepAlive y carga diferida
#### Details
`v-memo` memoiza un subárbol del template: recibe un array de dependencias y Vue solo vuelve a renderizar ese fragmento del DOM si alguno de esos valores cambió respecto al último render, saltando el diffing normal. Es una herramienta de nicho pensada para casos extremos de listas grandes donde el diffing de por sí ya es rápido pero se vuelve un cuello de botella medible; usarlo por default en cualquier lista es prematuro porque el algoritmo de Vue ya es eficiente sin ayuda.

`KeepAlive` es un componente envoltorio que cachea la instancia de un componente dinámico (por ejemplo, dentro de un `<component :is>` o de una vista de router) en vez de destruirla al desmontarse, preservando su estado interno y evitando re-montar todo cuando el usuario vuelve a esa vista. Expone los hooks `onActivated`/`onDeactivated`, que son el equivalente a `onMounted`/`onUnmounted` pero para cuando el componente entra o sale del cache en vez de montarse/desmontarse de verdad.

`defineAsyncComponent` permite declarar un componente que se resuelve con una importación dinámica (`() => import('./Componente.vue')`), lo cual hace que su código quede en un chunk separado que el bundler (Vite, en el caso típico de Vue 3) carga solo cuando ese componente realmente se necesita. Esto es la base del lazy loading de rutas en Vue Router: cada ruta se define con un import dinámico, así el bundle inicial no incluye código de páginas que el usuario todavía no visitó.

#### Examples
v-memo en una lista grande, solo se re-renderiza la fila si cambia el item
```vue
<div v-for="item in list" :key="item.id" v-memo="[item.id, item.selected]">
  <ExpensiveRow :item="item" />
</div>
```

KeepAlive preservando estado de un tab al cambiar entre vistas
```vue
<KeepAlive>
  <component :is="currentTabComponent" />
</KeepAlive>
```

onActivated/onDeactivated con KeepAlive
```vue
<script setup>
import { onActivated, onDeactivated } from 'vue'

onActivated(() => {
  console.log('el componente volvió a estar visible')
})
onDeactivated(() => {
  console.log('el componente se ocultó pero sigue vivo en cache')
})
</script>
```

defineAsyncComponent y lazy loading de rutas
```js
import { defineAsyncComponent } from 'vue'

const HeavyChart = defineAsyncComponent(() => import('./HeavyChart.vue'))

// en las rutas de Vue Router:
const routes = [
  { path: '/reportes', component: () => import('./views/Reportes.vue') },
]
```

#### Sources
- [Vue docs, v-memo](https://vuejs.org/api/built-in-directives.html#v-memo)
- [Vue docs, KeepAlive](https://vuejs.org/guide/built-ins/keep-alive.html)
- [Vue docs, Async Components](https://vuejs.org/guide/components/async.html)

### Pinia para manejo de estado
#### Details
Pinia es la librería de estado global oficialmente recomendada para Vue 3, y reemplazó a Vuex. La diferencia central es la ausencia de mutations: en Vuex el flujo obligatorio era `component -> dispatch(action) -> commit(mutation) -> state`, con mutations como el único lugar permitido para cambiar estado, lo cual daba trazabilidad pero era boilerplate para casos simples. En Pinia, las actions pueden modificar el state directamente, eliminando esa capa intermedia sin perder la capacidad de usar devtools para ver quién cambió qué.

Pinia también tiene mejor soporte de TypeScript de fábrica: al definir un store con `defineStore`, el tipo de `state`, `getters` y `actions` se infiere automáticamente, algo que en Vuex requería tipado manual extra o librerías auxiliares. Además, cada store en Pinia es independiente y se puede importar solo donde se necesita, en vez de depender de un único store raíz con módulos anidados y namespacing manual como en Vuex.

La composición entre stores es directa: un store de Pinia puede importar y usar otro store dentro de sus propias actions o getters, simplemente llamando a su función `useOtroStore()`, sin necesidad de un sistema de módulos con namespaces. Esto hace que dividir el estado global por dominio (usuario, carrito, notificaciones) sea natural y no requiera configuración adicional.

#### Examples
Definir un store con Composition API style (setup stores)
```js
// stores/counter.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useCounterStore = defineStore('counter', () => {
  const count = ref(0)
  const doubled = computed(() => count.value * 2)

  function increment() {
    count.value++
  }

  return { count, doubled, increment }
})
```

Definir un store con Options style (más parecido a Vuex)
```js
export const useCounterStore = defineStore('counter', {
  state: () => ({ count: 0 }),
  getters: {
    doubled: (state) => state.count * 2,
  },
  actions: {
    increment() {
      this.count++ // acción muta el state directamente, sin mutations
    },
  },
})
```

Usar el store en un componente
```vue
<script setup>
import { useCounterStore } from '@/stores/counter'

const counter = useCounterStore()
</script>
<template>
  <button @click="counter.increment()">{{ counter.count }}</button>
</template>
```

Composición entre stores (un store usa otro)
```js
export const useCartStore = defineStore('cart', () => {
  const userStore = useUserStore()
  const items = ref([])

  function checkout() {
    if (!userStore.isLoggedIn) throw new Error('Debe iniciar sesión')
    // ...
  }

  return { items, checkout }
})
```

#### Sources
- [Pinia docs, Introduction](https://pinia.vuejs.org/introduction.html)
- [Vue docs, State Management](https://vuejs.org/guide/scaling-up/state-management.html)

## Interview Questions

### Tenés un dato de tema (light/dark) que necesita 4 niveles de componentes hijos. ¿Usarías props o provide/inject? Justificá.
Usaría `provide`/`inject`, porque pasar el tema por props a través de componentes intermedios que no lo usan es prop drilling puro: cada intermediario se acopla a un dato que no le importa, y cambiar la forma del dato obliga a tocar todos los niveles. `provide`/`inject` es apropiado acá porque el tema es un valor transversal genuino, no un atajo para evitar pasar dos props a un hijo directo.

### ¿Qué pasa si necesito modificar el valor provisto por un ancestro desde un componente hijo profundo? ¿Cómo lo diseñarías bien?
No mutaría el valor proveído directamente desde el hijo, porque eso hace que el flujo de datos deje de ser rastreable: cualquier descendiente podría cambiar el estado del ancestro sin que quede explícito dónde. La forma correcta es que el ancestro también provea una función (o un composable con una función de update) junto con el valor de solo lectura (`readonly()`), para que la mutación quede centralizada y explícita en un solo lugar.

### Un componente con `onMounted` que arranca una suscripción a un WebSocket deja la conexión abierta después de navegar a otra pantalla. ¿Cuál es el bug y cómo lo arreglás?
Falta el cleanup simétrico en `onUnmounted`: toda suscripción, timer o listener que se inicia en `onMounted` tiene que cerrarse en `onUnmounted`, igual que el return de un `useEffect` en React. Arreglaría guardando la referencia a la conexión en una variable del scope del `setup()` y llamando a `connection.close()` (o el método de cierre correspondiente) dentro de `onUnmounted`.

### Estás en un componente con `<KeepAlive>` alrededor de un `<component :is>` que cambia de tab. Un desarrollador puso la lógica de "cargar datos" en `onMounted` y ahora no se recargan al volver a un tab. ¿Por qué, y qué harías?
`onMounted` solo corre en el montaje real; con `KeepAlive`, al volver a un componente cacheado no se vuelve a montar, entra en `onActivated`. Movería (o duplicaría según el caso) la lógica de carga de datos a `onActivated` si el requerimiento es refrescar datos cada vez que el tab vuelve a estar visible, dejando `onMounted` solo para la inicialización que debe correr una única vez.

### ¿Por qué Pinia no tiene mutations si Vuex las consideraba esenciales para la trazabilidad de cambios de estado?
Vuex exigía mutations como único punto de cambio de estado para que las devtools pudieran registrar cada cambio de forma sincrónica y con nombre, dado que las actions podían ser asíncronas y mezclar varios cambios. Pinia logra la misma trazabilidad en devtools sin esa capa porque trackea directamente las llamadas a actions y los cambios de estado resultantes, así que la separación action/mutation se volvió boilerplate innecesario una vez que la herramienta de devtools pudo hacer ese seguimiento sin necesitar mutations síncronas separadas.

### Tenés una ruta con un componente muy pesado que casi ningún usuario visita. ¿Cómo evitarías que infle el bundle inicial?
Declararía esa ruta con un import dinámico en la configuración de Vue Router (`component: () => import('./views/Pesada.vue')`), lo que hace que Vite genere un chunk separado para ese componente y solo lo descargue cuando el usuario navega efectivamente a esa ruta. Si el componente pesado no es una ruta completa sino parte de una vista (un modal, un editor), usaría `defineAsyncComponent` directamente sobre ese componente en particular.
