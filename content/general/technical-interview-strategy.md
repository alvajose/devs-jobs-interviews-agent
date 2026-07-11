---
stack: general
id: technical-interview-strategy
title: Estrategia de Entrevista Técnica
area: Estrategia
priority: high
resourceLabel: Tech Interview Handbook, Coding Interview Cheatsheet
resourceUrl: https://www.techinterviewhandbook.org/coding-interview-cheatsheet/
---

## Summary
Cómo comportarte durante entrevistas técnicas: clarificar, comunicar, diseñar trade-offs, validar edge cases y mostrar señales de contratación.

## Concepts

### Señales que evalúa el entrevistador
#### Details
En una entrevista técnica suelen evaluarse varias señales a la vez: correctness, readability, scalability, architecture/design, personability y domain knowledge. Eso significa que no basta con "llegar a una solución"; el entrevistador observa si cubres edge cases, si tu código se entiende, si razonas sobre complejidad, si modelas bien el problema y si colaboras bien bajo feedback.

Tech Interview Handbook lo refuerza desde el comportamiento: comunicar bien, manejar bloqueos, discutir trade-offs y revisar el código después de escribirlo son señales de "hire". La entrevista técnica no es solo resolver en silencio; es demostrar cómo pensás cuando hay ambigüedad.

Un buen candidato hace explícitas sus decisiones: por qué usa hash map y no nested loops, qué costo de memoria acepta, qué edge cases cubre, qué simplificación está haciendo por tiempo y qué haría distinto en producción.

#### Examples
Mapa mental de evaluación
```txt
Correctness: ¿la solución funciona y cubre edge cases?
Readability: ¿nombres claros, flujo simple, código mantenible?
Scalability: ¿tiempo/memoria razonables para el input?
Architecture/design: ¿modelo y separación de responsabilidades claros?
Personability: ¿acepta feedback y colabora?
Domain knowledge: ¿usa bien el lenguaje sin depender de trivia?
```

Cómo sonar senior al elegir una solución
```txt
"La opción simple es O(n²) con dos loops y O(1) memoria.
Si el input puede crecer, prefiero un hash map: O(n) tiempo y O(n) memoria.
Acepto memoria extra porque reduce mucho el tiempo y el código sigue siendo simple."
```

Qué decir cuando haces una simplificación
```txt
"Para la entrevista voy a asumir que el input cabe en memoria.
En producción, si esto fuera streaming o muy grande, cambiaría el enfoque
para procesar por chunks o usar almacenamiento externo."
```

#### Sources
- [Tech Interview Handbook, Coding interview cheatsheet](https://www.techinterviewhandbook.org/coding-interview-cheatsheet/)

### Clarificar antes de resolver
#### Details
Tech Interview Handbook recomienda no saltar a codificar. Muchas preguntas están subespecificadas a propósito para evaluar atención al detalle. Antes de proponer solución, repite el problema con tus palabras, pregunta por constraints y valida un ejemplo simple.

Las mejores clarificaciones no son genéricas. Preguntá por tamaño del input, formato, valores inválidos, duplicados, orden, mutabilidad, memoria disponible y comportamiento esperado en edge cases. En árboles/grafos, por ejemplo, confirmar si hay ciclos cambia completamente el enfoque.

La clarificación también te da alineación. Si el entrevistador esperaba otra interpretación, lo detectas temprano. Si tus supuestos son razonables, los puedes declarar y avanzar con permiso.

#### Examples
Checklist de clarificación para coding
```txt
- ¿Cuál es el tamaño máximo del input?
- ¿Puede venir vacío, null, con duplicados o valores negativos?
- ¿El input está ordenado?
- ¿Puedo modificar el array/lista original?
- ¿Necesito optimizar por tiempo, memoria o legibilidad?
- Si es grafo/árbol: ¿puede haber ciclos?
```

Parafrasear antes de codificar
```txt
"Quiero confirmar: recibo una lista de intervalos, pueden solaparse,
y tengo que devolverlos mergeados ordenados por inicio. ¿Puedo asumir
que los endpoints son enteros y que [1,3] y [3,5] se consideran solapados?"
```

Validar con ejemplo pequeño
```txt
Input: [1,2,3,4], target = 5
Output esperado: índices o valores que suman 5.
"¿Querés que devuelva [1,4] como valores o [0,3] como índices?"
```

#### Sources
- [Tech Interview Handbook, Coding interview cheatsheet](https://www.techinterviewhandbook.org/coding-interview-cheatsheet/)

### Discutir approach y trade-offs antes de codificar
#### Details
Tech Interview Handbook dice que una de las peores cosas es saltar directo a código. El entrevistador espera una discusión de enfoque: alternativas, complejidad, trade-offs y acuerdo sobre el approach antes de implementar.

Una forma fuerte de responder es proponer primero la solución simple, explicar su costo, luego optimizar. Eso muestra que entendés el espacio de soluciones. En Two Sum, por ejemplo: nested loops O(n²)/O(1), luego hash map O(n)/O(n). La decisión no es "la más avanzada", sino la que mejor balancea constraints.

Durante esta etapa hablá como si estuvieras colaborando con un compañero. Si te atascás, verbalizá patrones: sorting, hash map, two pointers, BFS/DFS, heap, DP, caching, precomputation, binary search. Pedir una pista después de mostrar pensamiento estructurado suele ser mejor que quedarse callado.

#### Examples
Estructura de explicación de approach
```txt
1. Solución brute force y costo.
2. Cuello de botella.
3. Optimización posible.
4. Trade-off memoria/tiempo.
5. Casos borde.
6. Confirmar con el entrevistador antes de codificar.
```

Ejemplo de trade-off
```txt
"Puedo ordenar y usar two pointers: O(n log n), poca memoria,
pero pierdo índices originales si no guardo pares. Alternativamente,
hash map mantiene índices y da O(n), usando memoria extra."
```

Cómo pedir alineación
```txt
"Voy a implementar la versión con hash map porque cumple O(n) y el código
es directo. ¿Te parece bien, o preferís que optimicemos memoria?"
```

#### Sources
- [Tech Interview Handbook, Work out and optimize your approach](https://www.techinterviewhandbook.org/coding-interview-cheatsheet/)

### Codificar comunicando sin narrar ruido
#### Details
Pensar en voz alta no significa describir cada tecla. Significa explicar intención: "voy a guardar vistos en un map", "este branch cubre input vacío", "este helper separa validación de transformación". El entrevistador no puede leer tu mente; necesita ver cómo razonas.

Tech Interview Handbook recomienda escribir código limpio, directo y modular, con nombres descriptivos. También sugiere pedir permiso para usar helpers triviales (`min`, `max`, `filter`, `reduce`) y declarar atajos de entrevista: "en producción validaría X", "por tiempo voy a dejar este parser simple".

Una buena señal es ajustar tu comunicación al momento: al diseñar, explicas trade-offs; al codificar, explicas intención; al probar, explicas casos. Evita llenar el aire con ruido, pero no te quedes callado ante decisiones importantes.

#### Examples
Comunicación útil mientras codificás
```txt
"Primero construyo un map de valor -> índice para lookup O(1).
Después recorro una vez y busco el complemento. Si lo encuentro,
devuelvo ambos índices. Si no, sigo."
```

Nombres que explican intención
```js
const seenIndexByValue = new Map();
const complement = target - currentValue;
```

Declarar un atajo razonable
```txt
"Voy a asumir que parseDate existe para no gastar tiempo en parsing.
Si fuera producción, cubriría timezone, formatos inválidos y tests."
```

#### Sources
- [Tech Interview Handbook, Code while talking through it](https://www.techinterviewhandbook.org/coding-interview-cheatsheet/)

### Validar con edge cases antes de decir "terminé"
#### Details
Tech Interview Handbook recomienda no anunciar que terminaste apenas compila mentalmente. Primero revisa el código, busca off-by-one, prueba ejemplos y agrega edge cases. Esto muestra cuidado y sube la señal de correctness.

Los edge cases dependen del problema, pero hay patrones frecuentes: input vacío, un solo elemento, duplicados, negativos, valores enormes, ciclos, desconexión, límites inclusivos/exclusivos, strings con casing/espacios, overflow y formatos inválidos.

También reitera complejidad al final. A veces, al revisar, detectas que una operación dentro de un loop cambió el costo real. Esta revisión puede salvar una entrevista porque demuestra que no solo escribes código, sino que verificas calidad.

#### Examples
Checklist posterior al código
```txt
- Correr ejemplo feliz.
- Correr input vacío / mínimo.
- Correr duplicados o valores límite.
- Revisar índices y condiciones de loop.
- Confirmar complejidad real.
- Mencionar mejoras si hubiera más tiempo.
```

Ejemplo de prueba manual
```txt
Para merge intervals:
[] -> []
[[1,3]] -> [[1,3]]
[[1,3],[2,4]] -> [[1,4]]
[[1,3],[3,5]] -> confirmar si tocar borde cuenta como merge.
```

Cómo cerrar fuerte
```txt
"La complejidad queda O(n log n) por el sort y O(n) por la salida.
Si los intervalos ya vinieran ordenados, podríamos bajar a O(n)."
```

#### Sources
- [Tech Interview Handbook, Check code and add test cases](https://www.techinterviewhandbook.org/coding-interview-cheatsheet/)

### System design: modelar antes de dibujar cajas
#### Details
Tech Interview Handbook describe system design como evaluación de tu capacidad para diseñar sistemas reales con múltiples componentes. Puede ser backend distribuido, APIs, object-oriented design o frontend system design. La entrevista busca cómo razonas sobre requisitos, componentes, datos, escalabilidad, tolerancia a fallos y trade-offs.

No arranques dibujando servicios al azar. Primero clarificá objetivos, usuarios, escala, operaciones principales, datos, APIs y constraints. Después proponé una arquitectura inicial y profundizá donde el entrevistador quiera: storage, caching, queues, consistency, observability, rate limits, seguridad o frontend state/data flow.

Para roles frontend, system design puede enfocarse en arquitectura de cliente: componentes, estado, cache, rendering, API contracts, performance, accesibilidad y resiliencia. Para backend, suele aparecer diseño de APIs, esquemas, replicación, colas y tolerancia a fallos.

#### Examples
Secuencia de system design
```txt
1. Clarificar requisitos funcionales.
2. Clarificar no funcionales: escala, latencia, disponibilidad.
3. Definir APIs principales.
4. Definir modelo de datos.
5. Dibujar arquitectura inicial.
6. Profundizar en cuellos de botella y trade-offs.
```

Preguntas útiles
```txt
- ¿Cuántos usuarios/requests esperamos?
- ¿Lecturas o escrituras dominan?
- ¿Necesitamos consistencia fuerte o eventual?
- ¿Qué pasa si falla un servicio externo?
- ¿Qué métricas/alertas necesitamos?
```

Trade-off bien comunicado
```txt
"Para feed usaría cache porque lecturas dominan. Acepto eventual consistency:
si un post tarda segundos en aparecer, es tolerable. Para pagos, en cambio,
necesitaría consistencia e idempotencia mucho más estrictas."
```

#### Sources
- [Tech Interview Handbook, System design interview guide](https://www.techinterviewhandbook.org/system-design/)

### Behavioral: STAR(R) con historias reutilizables
#### Details
Tech Interview Handbook recomienda preparar behavioral con STAR: Situation, Task, Action, Result. También sugiere agregar Reflection para mostrar aprendizaje. La idea no es memorizar respuestas, sino preparar 3-5 historias fuertes que cubran impacto, conflicto, ambigüedad, liderazgo, errores y decisiones técnicas.

La parte más importante suele ser Action: qué hiciste tú, por qué, qué alternativas consideraste y cómo influenciaste el resultado. Un error común es hablar demasiado del contexto o del equipo y muy poco de tu contribución específica.

Para entrevistas técnicas, tus historias deben conectar con decisiones reales: arquitectura, trade-offs, deuda técnica, incidentes, mentoring, colaboración con producto/diseño, migraciones o mejoras de performance. Eso evita respuestas genéricas tipo "trabajo bien en equipo".

#### Examples
Plantilla STAR(R)
```txt
Situation: contexto breve y por qué importaba.
Task: responsabilidad concreta.
Action: decisiones, trade-offs, comunicación, ejecución.
Result: impacto medible o cualitativo.
Reflection: qué aprendiste y qué harías mejor.
```

Historia técnica reutilizable
```txt
"Migramos una pantalla lenta. Mi tarea era bajar tiempo de carga.
Medí primero, encontré N+1 requests, propuse batch endpoint + cache.
Coordiné contrato con backend, agregué métricas y rollout gradual.
Resultado: carga inicial bajó de 4s a 1.2s. Aprendí a validar con datos
antes de reescribir componentes."
```

Preguntas que una misma historia puede cubrir
```txt
- Proyecto de alto impacto.
- Conflicto técnico.
- Decisión con trade-offs.
- Error o aprendizaje.
- Cómo influenciaste sin autoridad directa.
```

#### Sources
- [Tech Interview Handbook, Behavioral interviews](https://www.techinterviewhandbook.org/behavioral-interview/)

## Interview Questions

### El entrevistador te da un problema ambiguo. ¿Qué haces en los primeros dos minutos?
Parafraseo el problema, confirmo output esperado y pregunto constraints relevantes: tamaño, valores inválidos, orden, duplicados, mutabilidad y edge cases. Después corro un ejemplo pequeño con el entrevistador. No empiezo a codificar hasta alinear supuestos.

### Tienes una solución O(n²) clara y una O(n) con memoria extra. ¿Cómo lo comunicas?
Primero explico ambas opciones y sus costos. Luego decido según constraints: si el input puede crecer, favorezco O(n) con hash map; si memoria es muy limitada o n pequeño, la opción O(n²) podría ser suficiente. Lo importante es explicitar el trade-off.

### ¿Qué señales intentas mostrar durante una entrevista de coding?
Correctness, claridad, razonamiento sobre complejidad, comunicación, manejo de edge cases y apertura a feedback. También intento mostrar dominio del lenguaje sin caer en trivia: nombres claros, estructuras adecuadas y código modular.

### ¿Cómo cerrarías una solución después de escribir el código?
No diría "listo" de inmediato. Revisaría el código, correría casos normales y edge cases, buscaría off-by-one o null/empty inputs, y reiteraría complejidad. Si hay limitaciones, diría qué mejoraría en producción.

### ¿Cómo enfocas una entrevista de system design?
Empiezo por requisitos funcionales y no funcionales, escala y constraints. Luego defino APIs/modelo de datos y una arquitectura inicial. Después profundizo en trade-offs: caching, consistencia, colas, fallos, seguridad, observabilidad y performance.

### ¿Cómo preparas behavioral sin sonar memorizado?
Preparo 3-5 historias STAR(R) con proyectos reales: impacto, conflicto, ambigüedad, error y liderazgo. Practico bullets, no guion completo. En la entrevista adapto la historia a la señal que están evaluando y cierro con reflexión.
