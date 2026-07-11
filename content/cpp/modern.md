---
stack: cpp
id: cpp-modern
title: "C++ moderno: STL, concurrencia y patrones"
area: Backend
priority: high
resourceLabel: C++ Reference, Standard Library
resourceUrl: https://en.cppreference.com/w/cpp/standard_library
---

## Summary
Los cinco temas del C++ moderno que separan a quienes conocen el lenguaje de quienes lo usan: elegir el container correcto en O(1) de análisis, escribir lambdas sin trampa, razonar sobre data races con `std::atomic`, identificar undefined behavior antes de que el compilador lo explote, y aplicar CRTP, pimpl y type erasure cuando el problema lo justifica.

## Concepts

### STL containers y su elección
#### Details
Elegir el container equivocado es un error de diseño con consecuencias de performance. El análisis empieza por las garantías de complejidad y el patrón de acceso predominante.

**`std::vector`** es el container por defecto: almacenamiento contiguo, acceso O(1) por índice, cache-friendly, `push_back` amortizado O(1). Sus debilidades: inserción/eliminación en el medio es O(n), y al crecer puede invalidar todos los iteradores. Reservar capacidad con `reserve()` cuando el tamaño final es conocido elimina las reubicaciones.

**`std::deque`** es un array de arrays: O(1) en ambos extremos pero sin garantía de contigüidad. Los iteradores se invalidan más fácilmente. Útil para colas donde necesitás `push_front` eficiente.

**`std::list`** (lista doblemente enlazada): O(1) inserción/eliminación dado el iterador al nodo, pero O(n) acceso por posición y uso de memoria alto por los punteros extra. En la práctica, `vector` supera a `list` incluso en inserción frecuente en el medio debido a la localidad de caché.

**`std::map`** es un árbol rojo-negro balanceado: O(log n) para búsqueda, inserción y eliminación. Mantiene las claves ordenadas, lo que permite iteración en orden y operaciones de rango. **`std::unordered_map`** es una tabla hash: O(1) promedio para lookup, pero O(n) en el peor caso (colisiones). Sin orden. Requiere que la clave tenga `std::hash` definido. Para tipos custom, necesitás proveer el hash.

Invalidación de iteradores es un gotcha concreto: `vector::push_back` invalida todos los iteradores si hay reubicación; `map` y `list` no invalidan iteradores al insertar/eliminar (excepto el iterador al elemento eliminado).

#### Examples
Cuándo `map` vs `unordered_map`
```cpp
#include <map>
#include <unordered_map>
#include <string>

// map: ordenado, O(log n), útil si necesitás iterar en orden o lower_bound
std::map<std::string, int> sorted_scores;

// unordered_map: O(1) promedio, sin orden, mejor para lookup puro
std::unordered_map<std::string, int> fast_scores;
fast_scores.reserve(1000); // evita rehashing
fast_scores.max_load_factor(0.25f); // menos colisiones, más memoria
```

Reservar capacidad en `vector`
```cpp
#include <vector>

std::vector<int> nums;
nums.reserve(1'000'000); // una sola asignación, sin reubicaciones
for (int i = 0; i < 1'000'000; ++i)
    nums.push_back(i);
```

Invalidación de iteradores con `vector`
```cpp
std::vector<int> v = {1, 2, 3};
auto it = v.begin();
v.push_back(4); // puede reubicar, it es potencialmente inválido
// usar it aquí es UB si hubo reubicación
```

#### Sources
- [cppreference, std::vector](https://en.cppreference.com/w/cpp/container/vector)
- [cppreference, std::map](https://en.cppreference.com/w/cpp/container/map)
- [cppreference, std::unordered_map](https://en.cppreference.com/w/cpp/container/unordered_map)
- [cppreference, Iterator invalidation](https://en.cppreference.com/w/cpp/container)

---

### Lambdas y `std::function`
#### Details
Una lambda en C++ es azúcar sintáctica sobre una clase anónima con `operator()`. El compilador genera esa clase en el momento de la definición, con el tipo capturado como miembros. El resultado es que cada lambda tiene un **tipo único** conocido solo por el compilador.

La **cláusula de captura** controla qué variables del scope externo ve la lambda: `[=]` captura todo por valor (copia al momento de definición), `[&]` captura todo por referencia (peligroso si la lambda sobrevive al scope), `[x]` captura `x` por valor, `[&x]` por referencia. Si capturás por referencia y la lambda se almacena más tiempo que las variables, es un dangling reference, undefined behavior.

`mutable` en una lambda permite mutar las variables capturadas por valor (que por defecto son `const` dentro de la lambda). No afecta al original, la copia capturada sí cambia.

**`std::function`** es un wrapper tipo-borrado para cualquier callable (lambdas, punteros a función, functors). El precio: heap allocation para callables grandes, overhead de indirect call, y sin oportunidad de inlining. Para almacenar lambdas en contenedores (`std::vector<std::function<void()>>`) es correcto. Para pasar lambdas como argumento a funciones que solo las usan en ese scope, es mejor un template: `template <typename F> void apply(F&& f)`, inline posible, zero overhead.

#### Examples
Captura por valor vs por referencia
```cpp
int multiplier = 3;

auto by_value = [multiplier](int x) { return x * multiplier; };
multiplier = 10;
by_value(5); // 15, capturó el valor 3 al definirse

auto by_ref = [&multiplier](int x) { return x * multiplier; };
by_ref(5);   // 50, lee multiplier actual (10)
```

Lambda `mutable`
```cpp
int count = 0;
auto counter = [count]() mutable {
    return ++count; // muta la copia capturada, no el original
};
counter(); // 1
counter(); // 2
// count sigue siendo 0 afuera
```

`std::function` vs template, tradeoff de overhead
```cpp
#include <functional>
#include <vector>

// OK: almacenar callables heterogéneos en un contenedor
std::vector<std::function<void()>> callbacks;
callbacks.push_back([]{ std::cout << "a\n"; });
callbacks.push_back([]{ std::cout << "b\n"; });

// Mejor: pasar lambda a función que no la almacena
template <typename F>
void transform_all(std::vector<int>& v, F&& f) {
    for (auto& x : v) x = f(x);
}
// el compilador puede inlinear f, zero overhead
```

#### Sources
- [cppreference, Lambda expressions](https://en.cppreference.com/w/cpp/language/lambda)
- [cppreference, std::function](https://en.cppreference.com/w/cpp/utility/functional/function)

---

### Concurrencia con `std::thread` y `std::async`
#### Details
**`std::thread`** lanza un hilo del OS directamente. El thread debe ser `join()`-ed o `detach()`-ed antes de que el destructor de `std::thread` se ejecute, si no, el destructor llama a `std::terminate()`. Es manejo manual: el programador controla la vida del hilo.

**`std::async`** es más alto nivel: lanza una tarea asíncrona y retorna un `std::future<T>` que eventualmente tendrá el resultado. Con `std::launch::async` garantiza ejecución en nuevo hilo; con `std::launch::deferred` la ejecuta lazy en el mismo hilo cuando se llama `.get()`. El `future` hace join implícito en su destructor, más seguro que `thread` crudo.

**`std::mutex`** protege secciones críticas. `std::lock_guard` (RAII, no movible) o `std::unique_lock` (RAII, movible, lockeable condicionalmente) son las formas correctas de adquirirlo, nunca llamar `lock()`/`unlock()` manualmente.

**`std::condition_variable`** permite a un hilo esperar hasta que otro señalice una condición. Requiere `unique_lock`. La espera siempre debe estar en un loop con predicado para manejar **spurious wakeups** (el OS puede despertar el hilo sin señal real).

**`std::atomic<T>`** garantiza operaciones atómicas sin mutex para tipos simples. Load, store, compare-exchange, fetch-add son atómicos. `std::atomic<bool>` para flags de parada. Para operaciones compuestas (read-modify-write donde el valor nuevo depende del viejo), `compare_exchange_weak/strong` es el patrón correcto. Un **data race** (dos threads acceden la misma memoria, al menos uno escribe, sin sincronización) es undefined behavior, no "probablemente incorrecto", sino UB que el compilador puede transformar de forma no obvia.

#### Examples
`std::thread` con join explícito
```cpp
#include <thread>
#include <iostream>

void worker(int id) {
    std::cout << "thread " << id << "\n";
}

int main() {
    std::thread t1(worker, 1);
    std::thread t2(worker, 2);
    t1.join(); // espera a t1
    t2.join(); // espera a t2
}
```

`std::async` y `std::future`
```cpp
#include <future>

int heavy_computation(int n) { return n * n; }

auto fut = std::async(std::launch::async, heavy_computation, 42);
// ... otro trabajo ...
int result = fut.get(); // bloquea hasta que el resultado esté listo
```

Mutex con `lock_guard` y `condition_variable`
```cpp
#include <mutex>
#include <condition_variable>
#include <queue>

std::mutex mtx;
std::condition_variable cv;
std::queue<int> work_queue;

void producer(int item) {
    {
        std::lock_guard<std::mutex> lock(mtx);
        work_queue.push(item);
    }
    cv.notify_one();
}

void consumer() {
    std::unique_lock<std::mutex> lock(mtx);
    cv.wait(lock, []{ return !work_queue.empty(); }); // loop anti-spurious
    int item = work_queue.front();
    work_queue.pop();
}
```

`std::atomic` para flag de parada
```cpp
#include <atomic>
#include <thread>

std::atomic<bool> stop_flag{false};

void background_task() {
    while (!stop_flag.load(std::memory_order_relaxed)) {
        do_work();
    }
}

// desde el hilo principal:
// stop_flag.store(true, std::memory_order_relaxed);
```

#### Sources
- [cppreference, std::thread](https://en.cppreference.com/w/cpp/thread/thread)
- [cppreference, std::async](https://en.cppreference.com/w/cpp/thread/async)
- [cppreference, std::mutex](https://en.cppreference.com/w/cpp/thread/mutex)
- [cppreference, std::atomic](https://en.cppreference.com/w/cpp/atomic/atomic)

---

### Undefined behavior más comunes
#### Details
**Undefined behavior** (UB) en C++ significa que el estándar no especifica qué hace el programa, el compilador puede asumir que UB nunca ocurre y optimizar en consecuencia, produciendo código que hace cosas completamente inesperadas. No es "comportamiento no portátil" ni "probablemente un crash": el compilador puede eliminar ramas de código, reordenar instrucciones, o producir resultados aparentemente correctos hasta que cambia el nivel de optimización.

Los UB más frecuentes en entrevistas:

1. **Out-of-bounds**: acceder `v[n]` cuando `n >= v.size()`. Puede leer basura, corromper memoria, o aparentar funcionar hasta que llega valgrind o AddressSanitizer.
2. **Use-after-free**: usar un puntero después de `delete`. La memoria puede haberse reasignado. El programa puede funcionar en debug y explotar en release.
3. **Signed integer overflow**: `INT_MAX + 1` es UB para tipos con signo. El compilador asume que no ocurre y puede optimizar loops basándose en esa suposición. Para tipos sin signo (`unsigned`), el overflow está bien definido (módulo 2^n).
4. **Null pointer dereference**: desreferenciar un puntero nulo. Generalmente crash, pero formalmente UB, el compilador puede eliminar código "unreachable" que asume no-nulo.
5. **Strict aliasing**: acceder a un objeto a través de un puntero de tipo incompatible. `int* p = ...; float* q = (float*)p; *q;` viola strict aliasing. El compilador asume que punteros de tipos distintos no apuntan al mismo objeto y puede reordenar operaciones.

Las herramientas para detectar UB: AddressSanitizer (ASan) para memory errors, UndefinedBehaviorSanitizer (UBSan) para UB numérico y casting, Valgrind para leaks y use-after-free.

#### Examples
Signed overflow (UB) vs unsigned (definido)
```cpp
#include <climits>

int a = INT_MAX;
int b = a + 1;    // UB: signed overflow, el compilador asume que no pasa

unsigned int c = UINT_MAX;
unsigned int d = c + 1; // bien definido: 0 (módulo 2^32)
```

Use-after-free
```cpp
int* p = new int(42);
delete p;
std::cout << *p; // UB: use-after-free, puede imprimir 42 o crashear
p = nullptr;     // buena práctica: nullear tras delete
```

Out-of-bounds con vector
```cpp
std::vector<int> v = {1, 2, 3};
int x = v[5];      // UB: sin bounds check
int y = v.at(5);   // lanza std::out_of_range, seguro
```

Strict aliasing violation
```cpp
float f = 3.14f;
// INCORRECTO: viola strict aliasing, UB
int* p = reinterpret_cast<int*>(&f);
std::cout << *p;

// CORRECTO para type-punning: usar memcpy o std::bit_cast (C++20)
#include <bit>
int bits = std::bit_cast<int>(f); // bien definido en C++20
```

#### Sources
- [cppreference, Undefined behavior](https://en.cppreference.com/w/cpp/language/ub)
- [cppreference, std::bit_cast](https://en.cppreference.com/w/cpp/numeric/bit_cast)

---

### Patrones de diseño en C++ moderno
#### Details
**CRTP** (Curiously Recurring Template Pattern) es una forma de polimorfismo estático: la clase base es un template parametrizado por la clase derivada. Permite el dispatch sin vtable, en compilación, sin overhead de runtime. Se usa para mixins de comportamiento, policy-based design, y como alternativa a herencia virtual cuando el conjunto de tipos es conocido.

**Pimpl idiom** (Pointer to IMPLementation) esconde los detalles de implementación detrás de un puntero opaco. La clase pública declara solo la interfaz; la implementación vive en un `.cpp` separado. Ventajas: (1) ABI stability, agregar miembros privados no cambia el layout de la clase pública, (2) compilation firewall, los includes de la implementación no se propagan a quien incluye el header. El costo: una indirección extra y una asignación en el heap.

**Type erasure** es el mecanismo de esconder un tipo concreto detrás de una interfaz uniforme sin herencia. `std::any` almacena cualquier valor con type-safety en runtime (`.value<T>()` lanza si el tipo no coincide). `std::variant<A,B,C>` es una unión type-safe que almacena exactamente uno de los tipos listados; `std::visit` con un visitor aplica la función correcta sin virtual dispatch. Son las alternativas modernas a la herencia cuando la jerarquía no tiene sentido conceptual.

**Policy-based design** (Alexandrescu) combina templates y composición para lograr clases altamente configurables: el comportamiento varía por tipo de política (template parameter) sin herencia. Ejemplo: un allocator como política de un container, o una strategy de hash como política de un mapa.

#### Examples
CRTP para polimorfismo estático sin vtable
```cpp
template <typename Derived>
struct Logger {
    void log(const std::string& msg) {
        static_cast<Derived*>(this)->write(msg); // dispatch estático
    }
};

struct FileLogger : Logger<FileLogger> {
    void write(const std::string& msg) {
        // escribe a archivo
    }
};

struct ConsoleLogger : Logger<ConsoleLogger> {
    void write(const std::string& msg) {
        std::cout << msg << "\n";
    }
};
```

Pimpl idiom
```cpp
// widget.h, solo la interfaz, sin includes de implementación
#include <memory>
#include <string>

class Widget {
public:
    explicit Widget(const std::string& name);
    ~Widget();
    void render();
private:
    struct Impl;                          // forward declaration
    std::unique_ptr<Impl> pimpl_;         // opaque pointer
};

// widget.cpp, implementación oculta al caller
struct Widget::Impl {
    std::string name;
    // ... otros miembros privados, incluye lo que sea necesario
};

Widget::Widget(const std::string& name)
    : pimpl_(std::make_unique<Impl>(Impl{name})) {}
Widget::~Widget() = default;
void Widget::render() { /* usa pimpl_->name */ }
```

`std::variant` y `std::visit` como type erasure
```cpp
#include <variant>
#include <iostream>

using Shape = std::variant<int, double, std::string>; // ejemplo simplificado

struct Printer {
    void operator()(int x)         { std::cout << "int: "    << x << "\n"; }
    void operator()(double x)      { std::cout << "double: " << x << "\n"; }
    void operator()(const std::string& s) { std::cout << "str: " << s << "\n"; }
};

Shape s = 3.14;
std::visit(Printer{}, s); // "double: 3.14", dispatch sin vtable
```

#### Sources
- [cppreference, Templates](https://en.cppreference.com/w/cpp/language/templates)
- [cppreference, std::variant](https://en.cppreference.com/w/cpp/utility/variant)
- [cppreference, std::any](https://en.cppreference.com/w/cpp/utility/any)
- [cppreference, std::visit](https://en.cppreference.com/w/cpp/utility/variant/visit)
