---
stack: cpp
id: cpp-fundamentals
title: "C++: Memoria, RAII y tipos modernos"
area: Backend
priority: high
resourceLabel: C++ Reference
resourceUrl: https://en.cppreference.com/w/
---

## Summary
Los cinco pilares del C++ que aparecen en toda entrevista técnica seria: cómo RAII elimina la gestión manual de recursos, cómo los smart pointers modelan el ownership, cómo la semántica de movimiento evita copias innecesarias, cuándo templates son la herramienta correcta, y por qué el modelo de herencia virtual tiene trampas concretas que conocer.

## Concepts

### RAII y gestión de recursos
#### Details
**RAII** (Resource Acquisition Is Initialization) es el principio central del C++ moderno: un recurso se adquiere en el constructor del objeto que lo posee y se libera en su destructor. Gracias al determinismo del destructor, la liberación del recurso ocurre exactamente cuando el objeto sale de scope, sin importar si el camino de salida fue normal o una excepción. Esto hace innecesario el patrón `try/finally` para cleanup: el destructor es el finally.

Los recursos que RAII maneja incluyen memoria dinámica (`new`/`delete`), file handles (`fopen`/`fclose`), mutexes (`lock`/`unlock`), conexiones de red, handles del sistema operativo, y cualquier recurso que tenga un ciclo acquire/release. La biblioteca estándar aplica RAII en toda su superficie: `std::ifstream` cierra el archivo, `std::lock_guard` libera el mutex, `std::unique_ptr` libera la memoria.

El costo de violar RAII es concreto: si un mutex no se libera porque una excepción saltó antes del unlock manual, el programa se cuelga. Si un `FILE*` no se cierra, se filtran descriptores. RAII elimina estas clases enteras de bugs porque el compilador garantiza que el destructor se ejecuta. Cuando un interviewer pregunta "¿cómo manejarías recursos en C++?", la respuesta es siempre: con RAII, no con cleanup manual.

#### Examples
Sin RAII: cleanup manual frágil
```cpp
void process_file_bad(const std::string& path) {
    FILE* f = fopen(path.c_str(), "r");
    // Si algo lanza antes de fclose, el descriptor se filtra
    do_work(f);
    fclose(f); // puede no ejecutarse
}
```

Con RAII: destructor garantiza el cleanup
```cpp
#include <fstream>
#include <stdexcept>

void process_file_good(const std::string& path) {
    std::ifstream f(path); // adquiere en constructor
    if (!f) throw std::runtime_error("cannot open file");
    do_work(f);
} // destructor cierra el archivo automáticamente, incluso con excepciones
```

RAII con mutex: `std::lock_guard`
```cpp
#include <mutex>

std::mutex mtx;

void update_shared_state() {
    std::lock_guard<std::mutex> lock(mtx); // adquiere el lock
    // si lanza, el destructor de lock_guard hace unlock
    modify_state();
} // lock liberado aquí, sin unlock manual
```

RAII propio para un recurso custom
```cpp
class ManagedHandle {
public:
    explicit ManagedHandle(int resource_id)
        : handle_(acquire_resource(resource_id)) {}

    ~ManagedHandle() {
        release_resource(handle_); // siempre ejecuta
    }

    // no copyable, ownership único
    ManagedHandle(const ManagedHandle&) = delete;
    ManagedHandle& operator=(const ManagedHandle&) = delete;

private:
    int handle_;
};
```

#### Sources
- [cppreference, RAII](https://en.cppreference.com/w/cpp/language/raii)
- [cppreference, Destructors](https://en.cppreference.com/w/cpp/language/destructor)

---

### Smart pointers
#### Details
Los smart pointers son wrappers RAII sobre punteros crudos que gestionan la lifetime del objeto apuntado. C++11 introdujo tres: `std::unique_ptr`, `std::shared_ptr` y `std::weak_ptr`. La regla de oro para elegir: **modelá el ownership explícitamente**, no uses raw pointers para ownership.

**`std::unique_ptr`** expresa ownership exclusivo: exactamente un `unique_ptr` posee el objeto en cualquier momento. Es non-copyable pero movible. Overhead cero respecto a un raw pointer: no hay heap adicional, no hay contador. Es el smart pointer por defecto cuando no necesitás compartir ownership.

**`std::shared_ptr`** expresa ownership compartido: múltiples `shared_ptr` pueden apuntar al mismo objeto. Usa reference counting (el contador vive en un bloque de control en el heap). El objeto se destruye cuando el último `shared_ptr` sale de scope. El overhead es real: dos indirecciones de memoria, incrementos/decrementos atómicos del contador, y el bloque de control extra.

**`std::weak_ptr`** es una referencia no-owning a un objeto manejado por `shared_ptr`. No incrementa el ref count. Sirve para romper ciclos (A tiene `shared_ptr` a B, B tiene `weak_ptr` a A). Para acceder al objeto, hay que convertir a `shared_ptr` con `.lock()`, si el objeto ya fue destruido, `lock()` retorna nullptr.

Un **raw pointer** es aceptable cuando: (1) el ownership está claramente en otro lado y la vida del pointee garantizadamente excede la del raw pointer, (2) en interfaces de bajo nivel / legacy que no manejan ownership, (3) en código de performance crítica donde el overhead de `shared_ptr` es medible y documentado.

#### Examples
`unique_ptr`: ownership exclusivo con move
```cpp
#include <memory>

std::unique_ptr<int> a = std::make_unique<int>(42);
// std::unique_ptr<int> b = a;  // ERROR: no copyable
std::unique_ptr<int> b = std::move(a); // OK: transfiere ownership
// a es nullptr ahora
```

`shared_ptr`: ownership compartido
```cpp
#include <memory>
#include <iostream>

auto p1 = std::make_shared<std::string>("shared");
{
    auto p2 = p1; // ref count = 2
    std::cout << p1.use_count() << "\n"; // 2
} // p2 sale de scope, ref count = 1
std::cout << p1.use_count() << "\n"; // 1
// objeto destruido cuando p1 sale de scope
```

`weak_ptr`: romper ciclos de referencia
```cpp
#include <memory>

struct Node {
    std::shared_ptr<Node> next;
    std::weak_ptr<Node> prev; // weak evita el ciclo
};

auto n1 = std::make_shared<Node>();
auto n2 = std::make_shared<Node>();
n1->next = n2;
n2->prev = n1; // no incrementa ref count de n1
```

`weak_ptr`: uso seguro con `.lock()`
```cpp
std::weak_ptr<int> weak;
{
    auto shared = std::make_shared<int>(10);
    weak = shared;
    if (auto locked = weak.lock()) { // shared_ptr temporal
        std::cout << *locked << "\n"; // 10
    }
} // shared destruido
if (weak.expired()) {
    std::cout << "objeto ya no existe\n";
}
```

#### Sources
- [cppreference, unique_ptr](https://en.cppreference.com/w/cpp/memory/unique_ptr)
- [cppreference, shared_ptr](https://en.cppreference.com/w/cpp/memory/shared_ptr)
- [cppreference, weak_ptr](https://en.cppreference.com/w/cpp/memory/weak_ptr)

---

### Move semantics y rvalue references
#### Details
Antes de C++11, pasar o retornar objetos grandes (vectores, strings, buffers) implicaba copias profundas costosas. **Move semantics** agrega la capacidad de "robar" los recursos de un objeto temporal en lugar de copiarlos. Un objeto movido queda en un estado válido pero no especificado (usualmente vacío o nulo).

La distinción clave es entre **lvalue** (tiene nombre, tiene dirección, puede aparecer a la izquierda de `=`) y **rvalue** (temporal, sin nombre persistente, como el resultado de `f()` o un literal). Una **rvalue reference** (`T&&`) solo puede enlazarse a rvalues. `std::move` es un cast que convierte un lvalue en un rvalue reference, no mueve nada por sí solo, solo habilita que el move constructor o move assignment operator sea seleccionado.

La **Regla de Cero** es el ideal: si una clase solo compone otros tipos RAII (smart pointers, containers), no necesitás definir ninguno de los cinco especiales, el compilador los genera correctamente. La **Regla de Cinco** aplica cuando gestionás recursos crudos: si definís cualquiera de los cinco (destructor, copy constructor, copy assignment, move constructor, move assignment), probablemente debés definir los cinco para mantener semántica correcta.

El compilador genera move constructor y move assignment automáticamente cuando no declarás ninguno de los cinco especiales manualmente. Si declarás un destructor custom pero no declarás los moves, el compilador los suprime, un gotcha frecuente.

#### Examples
Costo de copiar vs mover
```cpp
#include <vector>
#include <iostream>

struct Buffer {
    std::vector<int> data;

    Buffer(std::vector<int> d) : data(std::move(d)) {} // mueve el argumento

    // move constructor: O(1), roba el puntero interno
    Buffer(Buffer&& other) noexcept : data(std::move(other.data)) {}

    // copy constructor: O(n), copia todos los elementos
    Buffer(const Buffer& other) : data(other.data) {}
};
```

`std::move` para transferir ownership
```cpp
#include <memory>
#include <string>

std::unique_ptr<std::string> make() {
    auto p = std::make_unique<std::string>("hello");
    return p; // NRVO o move implícito
}

auto a = make();
auto b = std::move(a); // a queda nullptr, b tiene el string
```

Regla de Cinco aplicada a un buffer raw
```cpp
class RawBuffer {
    int* data_;
    std::size_t size_;
public:
    explicit RawBuffer(std::size_t n)
        : data_(new int[n]), size_(n) {}

    ~RawBuffer() { delete[] data_; }

    // copy: deep copy
    RawBuffer(const RawBuffer& o)
        : data_(new int[o.size_]), size_(o.size_) {
        std::copy(o.data_, o.data_ + o.size_, data_);
    }
    RawBuffer& operator=(const RawBuffer& o) {
        if (this != &o) {
            delete[] data_;
            data_ = new int[o.size_];
            size_ = o.size_;
            std::copy(o.data_, o.data_ + o.size_, data_);
        }
        return *this;
    }

    // move: roba el puntero, O(1)
    RawBuffer(RawBuffer&& o) noexcept
        : data_(o.data_), size_(o.size_) {
        o.data_ = nullptr;
        o.size_ = 0;
    }
    RawBuffer& operator=(RawBuffer&& o) noexcept {
        if (this != &o) {
            delete[] data_;
            data_ = o.data_;
            size_ = o.size_;
            o.data_ = nullptr;
            o.size_ = 0;
        }
        return *this;
    }
};
```

#### Sources
- [cppreference, Move constructors](https://en.cppreference.com/w/cpp/language/move_constructor)
- [cppreference, std::move](https://en.cppreference.com/w/cpp/utility/move)
- [cppreference, Rule of three/five/zero](https://en.cppreference.com/w/cpp/language/rule_of_three)

---

### Templates y metaprogramación básica
#### Details
Los **templates** son el mecanismo de genericidad de C++: permiten escribir código parametrizado por tipos o valores, con instanciación en tiempo de compilación. A diferencia del polimorfismo virtual (runtime), los templates resuelven en compilación: sin overhead de vtable, con oportunidad de inlining agresivo.

**Template specialization** permite proveer implementaciones alternativas para tipos específicos. Puede ser completa (para un tipo concreto) o parcial (para una familia de tipos). `if constexpr` (C++17) reemplaza muchos patrones de specialization: permite ramas de código que se compilan solo si la condición es verdadera en compilación.

**SFINAE** (Substitution Failure Is Not An Error) es el mecanismo por el que el compilador descarta silenciosamente una sobrecarga de template cuando la sustitución de tipos falla, en lugar de emitir un error. Se usa con `std::enable_if` (C++11) para activar/desactivar overloads según propiedades del tipo. `std::is_integral`, `std::is_floating_point`, `std::is_same`, `std::is_base_of` son traits de `<type_traits>` que inspeccionan tipos en compilación.

Cuándo preferir templates sobre herencia virtual: cuando el comportamiento varía por tipo y el conjunto de tipos es conocido en compilación, cuando necesitás overhead cero, cuando el polimorfismo en runtime es demasiado para el caso de uso. Herencia virtual es correcta cuando el tipo concreto no se conoce hasta runtime (factory pattern, plugins, callbacks heterogéneos).

#### Examples
Function template básico
```cpp
#include <type_traits>

template <typename T>
T max_val(T a, T b) {
    return (a > b) ? a : b;
}

auto x = max_val(3, 7);       // T = int
auto y = max_val(3.0, 1.5);   // T = double
```

`if constexpr` para ramas de compilación
```cpp
#include <type_traits>
#include <string>

template <typename T>
std::string describe(T val) {
    if constexpr (std::is_integral_v<T>) {
        return "integer: " + std::to_string(val);
    } else if constexpr (std::is_floating_point_v<T>) {
        return "float: " + std::to_string(val);
    } else {
        return "other type";
    }
}
```

SFINAE con `std::enable_if`
```cpp
#include <type_traits>

// solo disponible para tipos integrales
template <typename T>
std::enable_if_t<std::is_integral_v<T>, T>
safe_div(T a, T b) {
    if (b == 0) throw std::domain_error("division by zero");
    return a / b;
}
```

Template specialization completa
```cpp
#include <iostream>

template <typename T>
struct Printer {
    void print(const T& val) { std::cout << val << "\n"; }
};

// specialization para bool
template <>
struct Printer<bool> {
    void print(bool val) {
        std::cout << (val ? "true" : "false") << "\n";
    }
};
```

#### Sources
- [cppreference, Function templates](https://en.cppreference.com/w/cpp/language/function_template)
- [cppreference, Class templates](https://en.cppreference.com/w/cpp/language/class_template)
- [cppreference, Type traits](https://en.cppreference.com/w/cpp/header/type_traits)
- [cppreference, if constexpr](https://en.cppreference.com/w/cpp/language/if)

---

### Herencia, virtual y polimorfismo
#### Details
El polimorfismo en runtime en C++ se implementa via **vtable** (virtual function table): un array de punteros a funciones, generado por el compilador para cada clase con funciones virtuales. Cada instancia de esa clase tiene un **vptr** (puntero a la vtable), implícitamente añadido por el compilador. Una llamada virtual es: dereferenciar el vptr, indexar la vtable, llamar al puntero de función, una indirección extra respecto a una llamada estática.

**El destructor virtual es obligatorio** en cualquier clase base que se use polimórficamente. Si eliminás un objeto derivado a través de un puntero a la clase base sin destructor virtual, el comportamiento es **undefined behavior**: el destructor de la clase derivada no se llama, los recursos que gestiona no se liberan. La regla práctica: si la clase tiene alguna función virtual, el destructor debe ser virtual.

El **slicing problem** ocurre cuando un objeto derivado se copia o asigna a una variable de tipo base: solo la porción base se copia, la parte derivada "se rebana" y se pierde. No hay error de compilación. La solución es trabajar siempre con referencias o punteros a la clase base en código polimórfico, nunca con valores.

`override` (C++11) le dice al compilador que esta función debe sobrescribir una virtual de la clase base, error de compilación si no hay nada que sobrescribir. `final` previene que una clase o función virtual sea derivada/sobrescrita. Ambos son esenciales para refactors seguros: si renombrás la función base y olvidás la derivada, el compilador te avisa.

**Composición vs herencia**: la herencia modela "es-un" con acoplamiento fuerte. La composición modela "tiene-un" con acoplamiento débil. Para comportamiento reutilizable que no es una jerarquía de tipos, la composición es casi siempre más mantenible. La herencia múltiple agrega complejidad (problema del diamante, virtual inheritance) y debe usarse solo con razón clara.

#### Examples
vtable y destructor virtual
```cpp
#include <iostream>
#include <memory>

struct Base {
    virtual void greet() const { std::cout << "Base\n"; }
    virtual ~Base() { std::cout << "~Base\n"; } // OBLIGATORIO
};

struct Derived : Base {
    void greet() const override { std::cout << "Derived\n"; }
    ~Derived() override { std::cout << "~Derived\n"; }
};

int main() {
    std::unique_ptr<Base> obj = std::make_unique<Derived>();
    obj->greet(); // "Derived", dispatch via vtable
} // "~Derived", luego "~Base", correcto gracias al destructor virtual
```

Slicing problem
```cpp
struct Animal {
    virtual std::string sound() const { return "..."; }
};

struct Dog : Animal {
    std::string sound() const override { return "woof"; }
};

void bad(Animal a) {           // copia por valor: Dog → Animal (sliced)
    std::cout << a.sound();    // "...", Dog perdido
}

void good(const Animal& a) {   // referencia: no hay slicing
    std::cout << a.sound();    // "woof", correcto
}

Dog d;
bad(d);   // slicing
good(d);  // polimorfismo correcto
```

`override` y `final`
```cpp
struct Shape {
    virtual double area() const = 0;
    virtual ~Shape() = default;
};

struct Circle final : Shape {          // no derivable
    double radius;
    explicit Circle(double r) : radius(r) {}
    double area() const override {     // error si Shape no tiene area()
        return 3.14159 * radius * radius;
    }
};
```

#### Sources
- [cppreference, virtual function specifier](https://en.cppreference.com/w/cpp/language/virtual)
- [cppreference, override specifier](https://en.cppreference.com/w/cpp/language/override)
- [cppreference, Destructors, Virtual destructors](https://en.cppreference.com/w/cpp/language/destructor)
