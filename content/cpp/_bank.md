---
stack: cpp
kind: question-bank
source: curated
sourceUrl: https://en.cppreference.com
license: curated
copyright: Written from scratch citing official documentation
---

## Interview Questions

### ¿Qué es RAII y por qué elimina la necesidad de bloques `try/finally` para cleanup de recursos?
RAII (Resource Acquisition Is Initialization) vincula la vida de un recurso a la vida de un objeto: el constructor adquiere el recurso y el destructor lo libera. El destructor en C++ se llama determinísticamente cuando el objeto sale de scope, ya sea por fin del bloque o por una excepción propagándose. Eso garantiza el cleanup sin importar el camino de salida, haciendo innecesario el patrón `try/finally` manual. Las violaciones de RAII, mutexes no liberados, archivos no cerrados, son la fuente de deadlocks y resource leaks en código C++ que no usa la biblioteca estándar correctamente.
[en.cppreference.com/w/cpp/language/raii](https://en.cppreference.com/w/cpp/language/raii)

---

### ¿Cuándo usarías `unique_ptr` vs `shared_ptr`? ¿Cuál es el overhead real de `shared_ptr`?
`unique_ptr` modela ownership exclusivo: un solo dueño, cero overhead respecto a un raw pointer, y non-copyable. Es el smart pointer por defecto cuando no necesitás compartir. `shared_ptr` modela ownership compartido: usa reference counting con un bloque de control en el heap, y los incrementos/decrementos del contador son operaciones atómicas, más lentas que un simple entero. El overhead de `shared_ptr` es concreto: dos palabras de puntero, una asignación adicional en el heap, y accesos atómicos en cada copia. Usar `shared_ptr` por defecto "porque es más seguro" es un error de diseño; modelar ownership correcto desde el inicio evita la necesidad de `shared_ptr` en la mayoría de los casos.
[en.cppreference.com/w/cpp/memory/shared_ptr](https://en.cppreference.com/w/cpp/memory/shared_ptr)

---

### ¿Para qué sirve `weak_ptr` y cómo rompe ciclos de referencia?
`weak_ptr` es una referencia no-owning a un objeto manejado por `shared_ptr`: no incrementa el reference count, por lo que no previene la destrucción del objeto. Su uso principal es romper ciclos: si A tiene `shared_ptr` a B y B tiene `shared_ptr` a A, ninguno llega a cero y hay un leak. Si B usa `weak_ptr` a A en su lugar, el ciclo no existe. Para acceder al objeto se usa `.lock()`, que retorna un `shared_ptr` temporal si el objeto sigue vivo, o nullptr si ya fue destruido. Esta verificación explícita de lifetime es la diferencia clave respecto a un raw pointer observador.
[en.cppreference.com/w/cpp/memory/weak_ptr](https://en.cppreference.com/w/cpp/memory/weak_ptr)

---

### ¿Qué es `std::move` exactamente? ¿Mueve algo por sí solo?
`std::move` es un cast, convierte su argumento en una rvalue reference (`T&&`) sin mover nada. Lo que dispara la operación de movimiento es el constructor o assignment operator que recibe esa rvalue reference. Al llamar `std::move(x)` le decís al compilador "este objeto puede ser movido; tratalo como temporal". Si el tipo no tiene move constructor definido, `std::move` silenciosamente cae en la copia, no hay error. El objeto movido queda en un estado válido pero no especificado (usualmente vacío), y usarlo después sin reinicializarlo es un bug lógico aunque no UB si el move constructor lo deja en estado válido.
[en.cppreference.com/w/cpp/utility/move](https://en.cppreference.com/w/cpp/utility/move)

---

### ¿Qué es la Regla de Cero y cuándo se convierte en Regla de Cinco?
La Regla de Cero dice: si una clase solo compone tipos RAII (smart pointers, `std::vector`, `std::string`), no necesitás declarar destructor, copy constructor, copy assignment, move constructor ni move assignment, el compilador los genera correctamente como composición de los de sus miembros. La Regla de Cinco aplica cuando gestionás un recurso crudo (raw pointer a heap, file descriptor, handle del OS): si necesitás un destructor custom, probablemente también necesitás definir los otros cuatro para mantener semántica de copia y movimiento correcta. El gotcha: declarar solo el destructor suprime la generación automática de los move operations.
[en.cppreference.com/w/cpp/language/rule_of_three](https://en.cppreference.com/w/cpp/language/rule_of_three)

---

### ¿Cómo funciona la vtable? ¿Qué overhead real agrega el polimorfismo virtual?
La vtable es un array de punteros a funciones generado por el compilador para cada clase con funciones virtuales. Cada instancia tiene un `vptr` (puntero oculto a la vtable), que añade el tamaño de un puntero a cada objeto. Una llamada virtual requiere: leer el `vptr` del objeto, indexar la vtable para encontrar el puntero a la función, y llamar a través de ese puntero, una indirección extra. El overhead real en código moderno es generalmente pequeño, pero previene el inlining (el compilador no sabe el tipo concreto en el call site), lo que en loops tight puede importar. En ese caso, CRTP o `std::variant` + `std::visit` son alternativas sin vtable.
[en.cppreference.com/w/cpp/language/virtual](https://en.cppreference.com/w/cpp/language/virtual)

---

### ¿Por qué un destructor virtual es obligatorio en clases base polimórficas?
Si eliminás un objeto derivado a través de un puntero a la clase base y el destructor no es virtual, el destructor que se llama es el de la clase base, el destructor de la clase derivada nunca se ejecuta. Eso es undefined behavior, y sus consecuencias concretas son resource leaks: los miembros de la clase derivada (smart pointers, containers, conexiones) no se destruyen. La regla práctica es simple: si una clase tiene alguna función virtual, el destructor debe ser `virtual`. Si la clase no está diseñada para polimorfismo, el destructor puede ser `final` o simplemente no virtual.
[en.cppreference.com/w/cpp/language/destructor](https://en.cppreference.com/w/cpp/language/destructor)

---

### ¿Qué es el slicing problem y cómo se evita?
El slicing ocurre cuando un objeto de una clase derivada se copia o asigna a una variable de tipo base por valor: el compilador copia solo la "rebanada" base del objeto, descartando silenciosamente los miembros y el comportamiento derivado. No hay error de compilación ni warning. La solución es trabajar con referencias o punteros en código polimórfico: `const Base&` o `Base*` preservan el tipo concreto. Para evitar que el slicing sea siquiera posible en una jerarquía, se puede hacer la clase base non-copyable (deletear el copy constructor y copy assignment).
[en.cppreference.com/w/cpp/language/object](https://en.cppreference.com/w/cpp/language/object)

---

### ¿Para qué sirven `override` y `final`? ¿Qué errores previenen?
`override` le dice al compilador que esta función debe sobrescribir una función virtual de la clase base. Si no existe tal función (por un typo, un cambio de firma, o que no sea virtual), el compilador emite un error, previene el bug silencioso de crear una nueva función en lugar de sobrescribir la existente. `final` en una función previene que se sobrescriba en clases derivadas; `final` en una clase previene la herencia. Ambos son herramientas de refactoring seguro: permiten cambiar la jerarquía con confianza de que el compilador atrapa inconsistencias.
[en.cppreference.com/w/cpp/language/override](https://en.cppreference.com/w/cpp/language/override)

---

### ¿Cuándo usarías templates en lugar de herencia virtual?
Templates cuando el conjunto de tipos es conocido en compilación, necesitás overhead cero (sin vtable, con inlining posible), o querés expresar restricciones de tipo con conceptos o type traits. Herencia virtual cuando el tipo concreto se conoce solo en runtime (factory pattern, plugins cargados dinámicamente, callbacks heterogéneos almacenados en un vector de punteros a base). La distinción es compilación vs runtime: templates son polimorfismo estático, virtual es polimorfismo dinámico. Un error común es usar herencia para reutilizar código cuando composición o templates serían más claros.
[en.cppreference.com/w/cpp/language/function_template](https://en.cppreference.com/w/cpp/language/function_template)

---

### ¿Qué hace `if constexpr` y en qué se diferencia de un `if` ordinario?
`if constexpr` evalúa la condición en tiempo de compilación y descarta la rama no tomada completamente, no solo no la ejecuta: ni siquiera la compila para el tipo actual. Eso permite escribir código en ramas que sería inválido para otros tipos sin necesitar specialización completa. Un `if` ordinario compila ambas ramas siempre; `if constexpr` compila solo la que aplica. Es la herramienta principal para reemplazar SFINAE en código nuevo (C++17+), haciendo la lógica de metaprogramación legible.
[en.cppreference.com/w/cpp/language/if](https://en.cppreference.com/w/cpp/language/if)

---

### ¿Qué es SFINAE y cuándo lo usarías hoy en día?
SFINAE (Substitution Failure Is Not An Error) es el principio por el que el compilador descarta silenciosamente una sobrecarga de template cuando la sustitución de tipos en su firma produce un error, en lugar de emitir un error de compilación. Se usa con `std::enable_if` para activar/desactivar overloads según type traits. Hoy en C++20, `requires` y conceptos son la forma preferida, son más legibles y dan mejores mensajes de error. SFINAE sigue relevante para entender código C++11/14/17 legacy y para metaprogramación avanzada donde los conceptos no alcanzan.
[en.cppreference.com/w/cpp/language/sfinae](https://en.cppreference.com/w/cpp/language/sfinae)

---

### ¿Cuándo elegirías `std::vector` sobre `std::list` para inserción frecuente en el medio?
Casi siempre `vector`. Aunque `list` tiene O(1) para inserción/eliminación dado el iterador, los nodos dispersos en heap son cache-hostile: acceder al siguiente nodo puede ser un cache miss. `vector`, aunque requiere mover elementos O(n) para inserción en el medio, trabaja sobre memoria contigua, los movimientos son un `memmove` que el CPU ejecuta con alta eficiencia de caché. Benchmarks reales muestran que `vector` supera a `list` incluso en escenarios de inserción frecuente en el medio hasta tamaños de miles de elementos. `list` tiene valor cuando necesitás estabilidad de iteradores/referencias tras inserción y eso es un requisito concreto.
[en.cppreference.com/w/cpp/container/vector](https://en.cppreference.com/w/cpp/container/vector)

---

### ¿Cuál es la diferencia entre `std::map` y `std::unordered_map`? ¿Cuándo usás cada uno?
`std::map` es un árbol rojo-negro: O(log n) para todas las operaciones, claves ordenadas, iteración en orden garantizada. `std::unordered_map` es una tabla hash: O(1) amortizado para lookup/insert/delete, sin orden. La elección es: si necesitás iterar en orden, `lower_bound`, `upper_bound`, o range queries → `map`. Si solo necesitás lookup/insert/delete y la velocidad importa → `unordered_map`. El gotcha de `unordered_map`: el peor caso es O(n) por colisiones, y para tipos custom necesitás proveer `std::hash`. Reservar capacidad con `reserve()` y ajustar `max_load_factor` reduce rehashing.
[en.cppreference.com/w/cpp/container/map](https://en.cppreference.com/w/cpp/container/map)

---

### ¿Qué tipos de iteradores pueden invalidarse y en qué condiciones?
En `std::vector`, cualquier inserción que cause reubicación invalida todos los iteradores, punteros y referencias. En `std::deque`, insertar en el medio invalida todo; insertar en los extremos invalida iteradores pero no referencias. En `std::map`, `std::set`, `std::list`, la inserción no invalida ningún iterador existente; solo la eliminación de un elemento invalida el iterador a ese elemento específico. Usar un iterador invalidado es undefined behavior. El patrón seguro con `vector` es actualizar el iterador tras la inserción: `it = v.insert(it, val); ++it;`.
[en.cppreference.com/w/cpp/container](https://en.cppreference.com/w/cpp/container)

---

### ¿Cuál es el peligro de capturar por referencia `[&]` en una lambda que sobrevive al scope?
Si una lambda captura variables por referencia y el lambda es almacenado o escapado más allá del scope donde esas variables viven, las referencias quedan colgadas, dangling references. Acceder a ellas es undefined behavior. Un caso frecuente: pasar a una función asíncrona una lambda que captura variables locales por referencia, cuando la función asíncrona ejecuta después de que esas variables fueron destruidas. La solución es capturar por valor `[=]` o capturar el dato relevante con `[x = std::move(x)]` para transferir ownership.
[en.cppreference.com/w/cpp/language/lambda](https://en.cppreference.com/w/cpp/language/lambda)

---

### ¿Cuál es el overhead de `std::function` y cuándo preferirías un template?
`std::function` usa type erasure internamente: puede requerir heap allocation para callables grandes (aunque tiene una optimización de small-buffer para callables pequeños), y la llamada es siempre a través de un puntero de función virtual-like, sin posibilidad de inlining. Para pasar una lambda a una función que solo la usa en ese scope, un template `template<typename F> void apply(F&& f)` es mejor: zero overhead, inline posible. `std::function` es la herramienta correcta cuando necesitás almacenar callables heterogéneos en un contenedor, o cuando la firma debe ser fija en una API pública.
[en.cppreference.com/w/cpp/utility/functional/function](https://en.cppreference.com/w/cpp/utility/functional/function)

---

### ¿Qué diferencia hay entre `std::thread` y `std::async`? ¿Cuál es más seguro?
`std::thread` lanza un hilo del OS directamente y el programador es responsable de `join()` o `detach()` antes de que el destructor se ejecute, si no, `std::terminate()` se llama. `std::async` retorna un `std::future<T>` y el destructor del future hace join implícito (con `std::launch::async`). `std::async` es más seguro como default porque el join es automático. El tradeoff es control: `std::thread` permite más control sobre la vida del hilo, prioridad, y afinidad de CPU. Para trabajo asíncrono general con resultado, `std::async` es la opción preferida en C++ moderno.
[en.cppreference.com/w/cpp/thread/async](https://en.cppreference.com/w/cpp/thread/async)

---

### ¿Por qué `std::lock_guard` es preferido a llamar `mutex.lock()`/`mutex.unlock()` manualmente?
`lock_guard` aplica RAII al mutex: el constructor llama `lock()` y el destructor llama `unlock()`, garantizando la liberación incluso si el código entre lock y unlock lanza una excepción. Con `lock()`/`unlock()` manual, cualquier excepción entre ellos deja el mutex bloqueado permanentemente, deadlock garantizado. `std::unique_lock` es la variante más flexible: movible, permite unlock/relock manual, y es requerida por `std::condition_variable`. Para el caso simple de proteger una sección crítica, `lock_guard` es más claro e igualmente eficiente.
[en.cppreference.com/w/cpp/thread/lock_guard](https://en.cppreference.com/w/cpp/thread/lock_guard)

---

### ¿Qué es un data race y por qué es undefined behavior en lugar de solo "comportamiento no portátil"?
Un data race ocurre cuando dos hilos acceden la misma ubicación de memoria, al menos uno escribe, y no hay ninguna operación de sincronización entre ellos. El estándar C++ lo clasifica como undefined behavior: el compilador y el hardware pueden reordenar instrucciones, mantener valores en registros, o eliminar stores que "nunca se leen" basándose en la suposición de que no hay data races. En la práctica, esto significa que el programa puede producir resultados completamente incorrectos de formas no reproducibles. La solución es siempre usar `std::mutex`, `std::atomic`, o estructuras de sincronización adecuadas para cualquier dato compartido entre hilos.
[en.cppreference.com/w/cpp/language/memory_model](https://en.cppreference.com/w/cpp/language/memory_model)

---

### ¿Para qué usarías `std::atomic` en lugar de un mutex?
`std::atomic<T>` es adecuado para operaciones simples sobre tipos escalares (bool, int, puntero) donde la atomicidad de una sola operación es suficiente: load, store, increment, compare-exchange. El overhead es mucho menor que un mutex porque usa instrucciones atómicas del procesador sin necesidad de syscall. Un mutex es necesario cuando la sección crítica involucra múltiples operaciones que deben ser atómicas entre sí (read-modify-write con lógica compleja, o proteger un struct). `std::atomic` no es un sustituto del mutex para proteger estructuras de datos complejas.
[en.cppreference.com/w/cpp/atomic/atomic](https://en.cppreference.com/w/cpp/atomic/atomic)

---

### ¿Qué es un spurious wakeup y cómo se maneja con `condition_variable`?
Un spurious wakeup es cuando un hilo que espera en `condition_variable::wait()` se despierta sin que ningún otro hilo haya llamado `notify_one()` o `notify_all()`. Es un comportamiento permitido por el estándar (y por la implementación de pthreads en Linux). Por eso, la espera en `condition_variable` SIEMPRE debe estar en un loop con un predicado que verifique la condición real: `cv.wait(lock, []{ return !queue.empty(); });`. La versión con predicado es equivalente a `while (!predicate()) cv.wait(lock);`. Esperar sin predicado es un bug.
[en.cppreference.com/w/cpp/thread/condition_variable](https://en.cppreference.com/w/cpp/thread/condition_variable)

---

### ¿Por qué el signed integer overflow es undefined behavior y qué hace el compilador con esa suposición?
El estándar C++ no define el comportamiento de `INT_MAX + 1` para tipos con signo, a diferencia de los tipos sin signo, donde el overflow está bien definido como módulo 2^n. El compilador usa esta suposición para optimizar: si sabe que un entero con signo no puede hacer overflow, puede eliminar checks redundantes, vectorizar loops, o reordenar operaciones. El clásico: un loop `for (int i = 0; i < n; i++)`, el compilador asume que `i` nunca desborda y puede vectorizarlo agresivamente. Con `-fsanitize=undefined`, UBSan detecta estos overflows en runtime.
[en.cppreference.com/w/cpp/language/ub](https://en.cppreference.com/w/cpp/language/ub)

---

### ¿Qué es strict aliasing y por qué no podés hacer type-punning con `reinterpret_cast`?
Strict aliasing es la regla que dice que un puntero de tipo `T*` y un puntero de tipo `U*` (donde `T != U`, ignorando cv-qualifiers y con ciertas excepciones para `char*`) no pueden apuntar al mismo objeto. El compilador asume que si dos punteros de tipos distintos existen, no se aliasan, y usa esa suposición para reordenar cargas y stores. Hacer type-punning con `reinterpret_cast` viola esta regla y produce UB. La forma correcta en C++20 es `std::bit_cast<T>` para convertir representación binaria; en C++11/14/17, `memcpy` es la solución portátil.
[en.cppreference.com/w/cpp/numeric/bit_cast](https://en.cppreference.com/w/cpp/numeric/bit_cast)

---

### ¿Qué son `constexpr` y `consteval`? ¿Cuándo una función `constexpr` no se evalúa en compilación?
`constexpr` en una función indica que puede evaluarse en compilación si sus argumentos son constantes en compilación; pero si se llama con argumentos runtime, se evalúa normalmente en runtime. `consteval` (C++20) garantiza que la función SOLO se evalúe en compilación, es un error de compilación si se llama con argumentos runtime. `constexpr` variables se evalúan en compilación siempre. El valor práctico: `constexpr` permite precomputar tablas de lookup, validar configuraciones, o simplificar matemáticas complejas a una constante sin ningún costo en runtime.
[en.cppreference.com/w/cpp/language/constexpr](https://en.cppreference.com/w/cpp/language/constexpr)

---

### ¿Qué son los structured bindings de C++17 y cuándo los usarías?
Los structured bindings permiten descomponer un objeto (struct, array, par, tupla) en variables nombradas en una sola declaración: `auto [key, value] = my_map.find(k)->second;`. Son especialmente útiles al iterar sobre `std::map`: `for (const auto& [key, val] : m)` es mucho más claro que acceder a `.first` y `.second` manualmente. Funcionan con cualquier tipo que tenga `get<>` especializado (como `std::tuple`), con structs cuyos miembros son públicos, y con arrays. No reemplazan la descomposición de tipos más complejos, pero eliminan variables intermedias innecesarias.
[en.cppreference.com/w/cpp/language/structured_binding](https://en.cppreference.com/w/cpp/language/structured_binding)

---

### ¿Qué son los Ranges de C++20 y qué problema resuelven respecto a los algoritmos de STL clásicos?
Los Ranges (C++20) son una abstracción sobre pares de iteradores que permiten componer algoritmos de forma lazy y sin temporales. En lugar de `std::sort(v.begin(), v.end())`, se escribe `std::ranges::sort(v)`. La ventaja real es la composición: `v | std::views::filter(pred) | std::views::transform(f)` crea una vista lazy sobre `v` sin allocar ningún contenedor intermedio. Los algoritmos clásicos de STL requieren que el rango esté materializado y no se componen naturalmente. Ranges también mejoran los mensajes de error de templates y permiten expresar intent más claramente.
[en.cppreference.com/w/cpp/ranges](https://en.cppreference.com/w/cpp/ranges)

---

### ¿Qué es CRTP y qué ventaja tiene sobre herencia virtual para mixins de comportamiento?
CRTP (Curiously Recurring Template Pattern) es cuando una clase base es template parametrizada por la clase derivada: `template<typename D> struct Base { void foo() { static_cast<D*>(this)->bar(); } }`. El dispatch ocurre en compilación via `static_cast`, sin vtable, sin vptr en el objeto, y con inlining posible. La ventaja sobre virtual es cero overhead en runtime. La limitación es que el conjunto de tipos debe conocerse en compilación y no podés mezclar tipos distintos en un contenedor homogéneo. Para políticas de comportamiento en clases de alta performance (serialización, logging, comparación), CRTP es la herramienta correcta.
[en.cppreference.com/w/cpp/language/crtp](https://en.cppreference.com/w/cpp/language/crtp)

---

### ¿Qué problema resuelve el pimpl idiom y cuál es su costo?
Pimpl (Pointer to Implementation) esconde los detalles de implementación de una clase detrás de un puntero opaco a un struct que solo se declara en el header y se define en el `.cpp`. Dos beneficios concretos: (1) ABI stability, agregar miembros privados no cambia el layout de la clase pública, lo que es crítico en APIs de bibliotecas compartidas; (2) compilation firewall, los includes pesados de la implementación no se propagan a quien incluye el header, reduciendo tiempos de compilación. El costo es una indirección extra en cada acceso a datos privados y una asignación en el heap para el pimpl.
[en.cppreference.com/w/cpp/language/pimpl](https://en.cppreference.com/w/cpp/language/pimpl)

---

### ¿Qué diferencia hay entre `std::variant` y una unión clásica de C?
Una unión clásica de C no trackea qué miembro está activo: acceder al miembro equivocado es UB y no hay ningún mecanismo de safety. `std::variant<A,B,C>` es una unión type-safe que almacena el tipo activo y garantiza que solo el tipo correcto sea accedido. Intentar `std::get<A>(v)` cuando `v` contiene un `B` lanza `std::bad_variant_access`. `std::visit` aplica un visitor al tipo activo sin necesidad de saber el índice manualmente. El costo es mínimo, un byte adicional para el tag, y la safety es total. `variant` reemplaza el patrón `union` + `enum` de C++ pre-17.
[en.cppreference.com/w/cpp/utility/variant](https://en.cppreference.com/w/cpp/utility/variant)

---

### ¿Cuándo `std::any` es la herramienta correcta y cuáles son sus limitaciones?
`std::any` almacena un valor de cualquier tipo copyable con type-safety en runtime. Es útil cuando el tipo no se conoce en compilación y no hay una jerarquía de herencia para usar. Para recuperar el valor, `std::any_cast<T>` lanza `std::bad_any_cast` si el tipo no coincide. Sus limitaciones: el tipo debe ser copyable (no `unique_ptr`), cada acceso requiere verificar el tipo en runtime, y no hay pattern matching como `std::variant`. Para conjuntos cerrados de tipos conocidos, `variant` es siempre preferible. `any` es para interfaces genéricas donde el tipo es verdaderamente arbitrario (sistemas de scripting, configuraciones, mensajería).
[en.cppreference.com/w/cpp/utility/any](https://en.cppreference.com/w/cpp/utility/any)

---

### ¿Qué garantías ofrece `noexcept` y por qué importa en move constructors?
`noexcept` es una promesa al compilador de que la función no lanza excepciones. Si lanza de todas formas, `std::terminate()` se llama directamente. El valor práctico más importante está en los move constructors: `std::vector` solo usa el move constructor de sus elementos cuando ese constructor es `noexcept`. Si no es `noexcept`, `vector` usa la copia al reubicar, porque si el move lanzara a mitad del proceso, el estado original ya fue destruido y no hay forma de recuperar. Declarar move constructors como `noexcept` es casi siempre correcto y habilita optimizaciones en todos los contenedores.
[en.cppreference.com/w/cpp/language/noexcept_spec](https://en.cppreference.com/w/cpp/language/noexcept_spec)

---

### ¿Qué es `std::optional` y cuándo es mejor que retornar un puntero nulo?
`std::optional<T>` es un wrapper que puede contener un valor de tipo `T` o no contener nada (`std::nullopt`). Es la forma moderna de expresar "este valor puede no estar presente" sin recurrir a punteros: no hay heap allocation (el valor está in-place), la semántica es value-based, y la API es explícita (`.has_value()`, `.value()`, `.value_or(default)`). A diferencia de retornar `nullptr`, no introduce ownership questions ni requiere verificar lifetime manualmente. Para funciones de búsqueda, parseo, o cualquier operación que puede no producir resultado, `optional` comunica el intent directamente en el tipo de retorno.
[en.cppreference.com/w/cpp/utility/optional](https://en.cppreference.com/w/cpp/utility/optional)

---

### ¿Qué es `std::string_view` y por qué es peligroso usarlo como miembro de una clase?
`std::string_view` es una vista no-owning sobre una secuencia de caracteres, básicamente un puntero y un tamaño. Evita copias al pasar strings a funciones: `void f(std::string_view sv)` acepta `const char*`, `std::string`, y literales sin ninguna conversión ni copia. El peligro como miembro de clase: `string_view` no posee el string; si el objeto que lo respalda (un `std::string` temporal, un literal en stack) se destruye antes que el `string_view`, queda dangling. La regla: usar `string_view` como parámetro de función es casi siempre correcto; como miembro de una estructura que sobrevive al scope local, es peligroso sin garantía explícita del lifetime del backing string.
[en.cppreference.com/w/cpp/string/basic_string_view](https://en.cppreference.com/w/cpp/string/basic_string_view)

---

### ¿Qué son los conceptos de C++20 y qué mejoran respecto a SFINAE?
Los conceptos (`concept`) son predicados de compilación sobre tipos que permiten expresar restricciones en templates de forma legible. `template<std::integral T> T add(T a, T b)` es equivalente a SFINAE con `std::enable_if_t<std::is_integral_v<T>>` pero con dos ventajas: los mensajes de error del compilador son claros ("T no satisface el concepto Integral" vs el error de template anidado ilegible de SFINAE), y la intención es directamente visible en la firma. Los conceptos también permiten `requires` clauses inline y pueden combinarse con `&&` y `||`. Para código nuevo en C++20, conceptos reemplazan SFINAE completamente.
[en.cppreference.com/w/cpp/language/constraints](https://en.cppreference.com/w/cpp/language/constraints)

---

### ¿Cómo funciona `std::move_iterator` y en qué escenario lo usarías?
`std::move_iterator` es un adaptador de iterador que convierte la desreferenciación en un `std::move` del elemento. Al usarlo con algoritmos STL, los elementos se mueven en lugar de copiarse. El escenario típico es vaciar un vector de objetos move-only (como `unique_ptr`) a otro contenedor: `std::make_move_iterator(v.begin())`. Esto es más explícito que un loop manual y se integra con todos los algoritmos STL que aceptan iteradores. Sin `move_iterator`, el algoritmo intentaría copiar, lo que falla para tipos move-only.
[en.cppreference.com/w/cpp/iterator/move_iterator](https://en.cppreference.com/w/cpp/iterator/move_iterator)

---

### ¿Qué es el "most vexing parse" de C++ y cómo se evita?
El most vexing parse es una ambigüedad de la gramática de C++ donde una declaración que parece crear un objeto en realidad se parsea como la declaración de una función. El ejemplo clásico: `Widget w(Widget());`, se parsea como una función `w` que retorna `Widget` y toma como argumento un puntero a función que retorna `Widget`. La solución moderna es usar inicialización con llaves (uniform initialization): `Widget w{Widget{}}` o `Widget w = Widget()`. Esta ambigüedad es uno de los motivadores originales de la sintaxis de inicialización con llaves introducida en C++11.
[en.cppreference.com/w/cpp/language/direct_initialization](https://en.cppreference.com/w/cpp/language/direct_initialization)

---

### ¿Qué diferencia hay entre inicialización con `()` y con `{}` en C++11?
La inicialización con `{}` (brace initialization o uniform initialization) tiene dos diferencias clave: (1) no permite narrowing conversions, `int x{3.14}` es error de compilación, mientras que `int x(3.14)` silenciosamente trunca; (2) si el tipo tiene un constructor que toma `std::initializer_list`, ese constructor tiene prioridad sobre otros, lo que puede sorprender: `std::vector<int> v{10, 5}` crea un vector con dos elementos (10 y 5), mientras que `std::vector<int> v(10, 5)` crea uno con diez elementos de valor 5. La regla práctica: usar `{}` para inicialización de valores y listas, `()` cuando necesitás llamar un constructor específico.
[en.cppreference.com/w/cpp/language/list_initialization](https://en.cppreference.com/w/cpp/language/list_initialization)

---

### ¿Qué son las coroutines de C++20 y en qué difieren de `std::thread`?
Las coroutines son funciones que pueden suspender su ejecución y reanudarla más tarde, sin bloquear el hilo del OS. Se implementan con `co_await`, `co_yield` y `co_return`. A diferencia de `std::thread`, que consume un thread del OS por operación asíncrona, las coroutines son cooperativas y pueden ejecutarse miles de ellas sobre un pool pequeño de threads. Son la base para I/O asíncrono eficiente (similar a async/await de C# o Python). C++20 provee el mecanismo de bajo nivel; las librerías como cppcoro o los frameworks de networking construyen las abstracciones de alto nivel sobre él.
[en.cppreference.com/w/cpp/language/coroutines](https://en.cppreference.com/w/cpp/language/coroutines)

---

### ¿Qué herramientas usarías para detectar memory leaks y undefined behavior en C++?
Las herramientas principales son sanitizers de compilador: **AddressSanitizer** (ASan, `-fsanitize=address`) detecta use-after-free, heap/stack out-of-bounds, y leaks; **UndefinedBehaviorSanitizer** (UBSan, `-fsanitize=undefined`) detecta signed overflow, null dereference, strict aliasing violations y más; **ThreadSanitizer** (TSan, `-fsanitize=thread`) detecta data races. **Valgrind** (Memcheck) es más lento pero funciona sin recompilar y detecta leaks y errores de memoria en runtime. Para análisis estático, `clang-tidy` y `cppcheck` detectan patrones problemáticos antes de ejecutar. La combinación de ASan + UBSan en el pipeline de CI cubre la mayoría de los bugs de memoria.
[en.cppreference.com/w/cpp/memory](https://en.cppreference.com/w/cpp/memory)
