---
stack: python
id: python-fundamentals
title: Python: fundamentos del lenguaje
area: Backend
priority: high
resourceLabel: Python, The Python Language Reference
resourceUrl: https://docs.python.org/3/reference/
---

## Summary

Los pilares del modelo de objetos de Python que aparecen en toda entrevista técnica: cómo se representan los datos en memoria, cuándo te quemás con mutabilidad, y cuándo generators y type hints hacen la diferencia en código de producción.

## Concepts

### El data model: objetos, identidad y mutabilidad

#### Details

En Python todo es un objeto: un entero, una función, una clase. Cada objeto tiene identidad (dirección en memoria), tipo y valor. El operador `is` compara **identidad** (`id(a) == id(b)`), mientras que `==` compara **valor** (delega a `__eq__`). Confundirlos es un bug silencioso clásico: `a is None` es correcto para verificar None; `a == None` puede devolver True si un objeto implementa `__eq__` de forma rara.

La **mutabilidad** define si el valor de un objeto puede cambiar en memoria. Las listas, dicts y sets son mutables; strings, ints, floats y tuples son inmutables. Esta distinción importa en entrevistas porque explica comportamientos no obvios: dos strings iguales pueden ser el mismo objeto (interning), pero dos listas iguales casi nunca lo son.

Lo que Python llama "pasar por referencia" es en realidad **pass-by-object-reference** (o "pass-by-assignment"): una función recibe una referencia al mismo objeto, no una copia. Si el argumento es mutable, la función puede mutar su contenido. Si es inmutable, cualquier reasignación dentro de la función no afecta al caller. Entender esto es clave para predecir bugs en código real.

#### Examples

`is` vs `==` con None y con listas

```python
a = [1, 2, 3]
b = [1, 2, 3]

print(a == b)   # True, mismo valor
print(a is b)   # False, objetos distintos en memoria

x = None
print(x is None)   # True, forma idiomática
print(x == None)   # True, pero evitarlo (PEP 8)
```

Pass-by-object-reference: mutables vs inmutables

```python
def append_item(lst: list, item: int) -> None:
    lst.append(item)   # muta el objeto original

def reset_value(n: int) -> None:
    n = 0              # reasigna la variable local, no afecta al caller

nums = [1, 2]
append_item(nums, 3)
print(nums)   # [1, 2, 3], mutado

val = 10
reset_value(val)
print(val)    # 10, sin cambios
```

Interning de strings (CPython)

```python
a = "hello"
b = "hello"
print(a is b)   # True en CPython (interning de literales)

c = "".join(["hel", "lo"])
print(a is c)   # False, construido en runtime, objeto nuevo
```

#### Sources

- [Python Data Model](https://docs.python.org/3/reference/datamodel.html)
- [Built-in Functions, id()](https://docs.python.org/3/library/functions.html#id)

---

### El gotcha del argumento mutable por defecto

#### Details

Python evalúa los valores por defecto de los argumentos **una sola vez**, cuando se define la función, no cada vez que se la llama. Si ese valor por defecto es mutable (una lista, un dict), todos los llamados comparten el mismo objeto. Es el bug más común para desarrolladores que migran a Python y aparece en casi toda entrevista técnica seria.

El patrón correcto es usar `None` como centinela y crear el mutable dentro del cuerpo de la función. Esto garantiza que cada llamado tenga su propia instancia. La regla de oro: **nunca uses un mutable como valor por defecto**.

En entrevista, más allá de conocer el fix, lo que se evalúa es si entendés el mecanismo: los defaults viven en `function.__defaults__` como una tupla, creada en el momento de la definición. Si el interviewer pregunta "¿dónde vive ese estado?", esa es la respuesta.

#### Examples

El bug: todos los llamados acumulan en la misma lista

```python
def add_to_cart(item: str, cart: list = []) -> list:
    cart.append(item)
    return cart

print(add_to_cart("apple"))   # ['apple']
print(add_to_cart("banana"))  # ['apple', 'banana'] ← bug: la lista persiste
```

El fix: usar None como centinela

```python
def add_to_cart(item: str, cart: list | None = None) -> list:
    if cart is None:
        cart = []
    cart.append(item)
    return cart

print(add_to_cart("apple"))   # ['apple']
print(add_to_cart("banana"))  # ['banana'], instancia fresca
```

Inspeccionando los defaults en tiempo de ejecución

```python
def f(x: list = []) -> None:
    pass

print(f.__defaults__)   # ([],), la lista ya existe antes de llamar a f
```

#### Sources

- [Python FAQ, Default argument values](https://docs.python.org/3/faq/programming.html#why-are-default-values-shared-between-objects)
- [Python Language Reference, Function definitions](https://docs.python.org/3/reference/compound_stmts.html#function-definitions)

---

### Type hints y el módulo `typing`

#### Details

Los type hints (PEP 484) son anotaciones opcionales que no afectan el runtime de Python: el intérprete las ignora. Su valor real está en herramientas externas (mypy, pyright, el IDE) que las usan para detectar bugs antes de ejecutar. En equipos grandes o bases de código mantenidas a largo plazo, el tipado estático reduce significativamente la carga cognitiva y los bugs de integración.

Desde Python 3.10+, la sintaxis nativa se simplificó: `X | Y` reemplaza a `Union[X, Y]`, y `list[int]` reemplaza a `List[int]` (ya no necesitás importar de `typing` para los genéricos built-in). Para versiones anteriores a 3.10, la forma más limpia es importar desde `typing`. `Optional[X]` es equivalente a `X | None` y comunica explícitamente que el valor puede no estar presente.

En entrevista, el ángulo senior es hablar de "gradual typing": podés agregar tipos incrementalmente a una base de código sin tipos. La decisión de adoptar tipado es una decisión de mantenibilidad a futuro, no de funcionalidad presente. Proyectos como Django, FastAPI y SQLAlchemy son casos de estudio de cómo el tipado mejora la DX a escala.

#### Examples

Funciones con hints en Python 3.11+

```python
from typing import Optional

def get_user_email(user_id: int) -> Optional[str]:
    # Retorna None si el usuario no existe
    users: dict[int, str] = {1: "alice@example.com"}
    return users.get(user_id)

result = get_user_email(1)
if result is not None:
    print(result.upper())
```

Union types con sintaxis moderna (Python 3.10+)

```python
def parse_input(value: str | int | None) -> str:
    if value is None:
        return "empty"
    return str(value)
```

Tipando estructuras complejas con dataclasses

```python
from dataclasses import dataclass

@dataclass
class Point:
    x: float
    y: float
    label: str | None = None

p = Point(1.0, 2.5, label="origin")
print(p.x, p.y)  # 1.0 2.5
```

#### Sources

- [PEP 484, Type Hints](https://docs.python.org/3/library/typing.html)
- [Python typing module](https://docs.python.org/3/library/typing.html)
- [Python dataclasses](https://docs.python.org/3/library/dataclasses.html)

---

### Generators e iteradores: lazy evaluation con `yield`

#### Details

Un **iterador** es cualquier objeto que implementa `__iter__` y `__next__`. Un **generator** es la forma más simple de crear iteradores: una función con `yield` que "pausa" su estado en cada llamado a `next()`. La clave mental es que un generator produce valores **bajo demanda** en lugar de construir toda la secuencia en memoria. Eso los hace ideales para procesar streams, archivos grandes o pipelines de datos.

La diferencia práctica entre `return [...]` y `yield` es memoria y tiempo de inicio. Una lista se construye completa antes de que el caller reciba el primer elemento. Un generator emite el primer elemento inmediatamente y calcula el siguiente solo cuando se lo piden. Para `n=10` esto es irrelevante; para `n=10_000_000` puede ser la diferencia entre que el programa corra o explote la RAM.

En entrevista, el punto de distinción es: ¿cuándo usás una lista y cuándo un generator? Lista cuando necesitás acceso aleatorio por índice, cuando el tamaño es razonable, o cuando vas a iterar múltiples veces. Generator cuando el dataset puede ser grande, cuando procesás un stream, o cuando querés componer pipelines lazy. Un generator se agota: iterarlo dos veces no funciona como con una lista.

#### Examples

Generator básico con `yield`

```python
def fibonacci() -> int:
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b

gen = fibonacci()
print([next(gen) for _ in range(8)])  # [0, 1, 1, 2, 3, 5, 8, 13]
```

Procesando un archivo grande sin cargarlo en memoria

```python
def read_lines_lazy(path: str):
    with open(path, encoding="utf-8") as f:
        for line in f:
            yield line.rstrip()

# Solo una línea en memoria a la vez
for line in read_lines_lazy("big_file.txt"):
    if "ERROR" in line:
        print(line)
        break
```

Generator expression vs list comprehension

```python
# List: calcula todo ahora, usa O(n) memoria
squares_list = [x * x for x in range(1_000_000)]

# Generator: lazy, usa O(1) memoria
squares_gen = (x * x for x in range(1_000_000))

print(next(squares_gen))  # 0, solo calculó el primero
```

#### Sources

- [Python, Generator Types](https://docs.python.org/3/glossary.html#term-generator)
- [Python, `yield` expression](https://docs.python.org/3/reference/expressions.html#yield-expressions)
- [Python HOW-TO: Functional Programming, Generators](https://docs.python.org/3/howto/functional.html#generators)

---

### Context managers y el protocolo `with`

#### Details

Un context manager garantiza que el setup y el teardown de un recurso ocurran correctamente, incluso si hay excepciones. El statement `with` llama a `__enter__` al entrar al bloque y a `__exit__` al salir, sin importar si el bloque terminó normalmente o con error. Es el mecanismo correcto para manejar archivos, conexiones a bases de datos, locks, y cualquier recurso que deba liberarse.

El patrón mental correcto es: "¿hay algo que necesito hacer antes Y después, y que debe ocurrir sin importar qué?" Si la respuesta es sí, querés un context manager. El antipatrón es usar try/finally manualmente para lo mismo: es más verboso, más propenso a errores, y no se puede reutilizar.

Crear tu propio context manager es sencillo: implementás `__enter__` y `__exit__` en una clase, o usás el decorador `@contextmanager` del módulo `contextlib` con un generator que hace `yield` exactamente una vez. Este segundo enfoque es más conciso para casos simples y aparece con frecuencia en código de producción (mocking de tiempo, timers de performance, transacciones de test).

#### Examples

Manejo correcto de archivos con `with`

```python
# Sin with: si open() falla o hay error al leer, f.close() no se llama
with open("data.txt", encoding="utf-8") as f:
    content = f.read()
# f está garantizadamente cerrado aquí
```

Context manager con `@contextmanager`

```python
import time
from contextlib import contextmanager

@contextmanager
def timer(label: str):
    start = time.perf_counter()
    try:
        yield                            # el bloque `with` corre aquí
    finally:
        elapsed = time.perf_counter() - start
        print(f"{label}: {elapsed:.4f}s")

with timer("database query"):
    # ... código a medir
    pass
```

Context manager como clase

```python
class ManagedConnection:
    def __init__(self, host: str) -> None:
        self.host = host
        self.conn = None

    def __enter__(self):
        print(f"Connecting to {self.host}")
        self.conn = object()  # simula una conexión
        return self.conn

    def __exit__(self, exc_type, exc_val, exc_tb) -> bool:
        print("Closing connection")
        # retornar True suprime la excepción; False la propaga
        return False

with ManagedConnection("db.example.com") as conn:
    print("Using connection:", conn)
```

#### Sources

- [Python contextlib, Utilities for with-statement contexts](https://docs.python.org/3/library/contextlib.html)
- [Python Language Reference, The with statement](https://docs.python.org/3/reference/compound_stmts.html#the-with-statement)
- [Python Data Model, Context managers](https://docs.python.org/3/reference/datamodel.html#context-managers)

## Interview Questions

### ¿Cuándo usarías un generator en vez de construir una lista? ¿Qué tradeoffs tiene?

Usaría un generator cuando el dataset puede ser muy grande o cuando quiero empezar a procesar elementos antes de tener todos disponibles. Un generator es lazy: produce valores uno a la vez bajo demanda, lo que mantiene el uso de memoria constante en lugar de lineal. El tradeoff principal es que un generator es single-pass: si necesito iterar múltiples veces o acceder a un elemento por índice, necesito una lista. También, el debugging puede ser más difícil porque el estado está "congelado" entre yields y no es visible directamente.

### ¿Por qué es un bug usar una lista como valor por defecto en un argumento de función? ¿Cómo lo detectás y lo corregís?

El problema es que Python evalúa los defaults una sola vez, cuando define la función. Entonces todos los llamados comparten el mismo objeto mutable. Si appendás a esa lista en un llamado, el siguiente llamado la ve con ese contenido acumulado. Lo detecto cuando veo un argumento mutable con valor por defecto y la función lo modifica internamente. La corrección es usar `None` como centinela y crear el mutable dentro del cuerpo: `if cart is None: cart = []`. Esta es la forma idiomática y está documentada en el FAQ oficial.

### ¿Cuándo usás `is` y cuándo `==`? ¿Por qué `x is None` es preferido a `x == None`?

`is` compara identidad de objeto (si son el mismo objeto en memoria), `==` compara valor (el resultado de `__eq__`). Uso `is` exclusivamente para `None`, `True` y `False`, porque son singletons: hay exactamente una instancia de cada uno en el intérprete. Usar `x == None` puede dar resultados incorrectos si algún objeto implementa `__eq__` de forma no estándar y retorna `True` al compararse con `None`, lo cual no es hipotético en ORMs u objetos proxy.

### ¿Qué valor real aportan los type hints en Python si el runtime los ignora?

Los type hints son documentación ejecutable por herramientas. mypy o pyright los analizan estáticamente y detectan errores antes de correr el código: llamar una función con el tipo incorrecto, acceder a `.email` en algo que puede ser `None`, etc. En equipos grandes, el tipado actúa como una interfaz contractual entre módulos: sé qué espera una función sin leer su implementación. FastAPI, por ejemplo, usa los type hints en runtime para validación automática, lo que muestra que el ecosistema los adoptó más allá del análisis estático puro.

### ¿Cómo diseñarías un context manager para manejar transacciones de base de datos con rollback automático?

Implementaría un context manager que al entrar inicia una transacción y al salir hace commit si no hubo excepción, o rollback si la hubo. En `__exit__` recibo `exc_type, exc_val, exc_tb`: si `exc_type is not None`, hay una excepción activa y llamo rollback; si no, commit. Retorno `False` para propagar la excepción al caller así este sabe que falló. Con `@contextmanager` de contextlib, el equivalente es poner el yield en un try/except: si el bloque `with` lanza, el except lo captura para el rollback. Este patrón está en SQLAlchemy y en la mayoría de las librerías de acceso a datos.

### ¿Cómo explicarías el modelo de "pass by object reference" de Python a alguien que viene de C++ o Java?

En Python no existe "pass by value" ni "pass by reference" en el sentido clásico. Lo que se pasa es siempre una referencia al objeto, pero la referencia en sí se pasa por valor. Es decir, la función recibe su propia variable que apunta al mismo objeto. Si el objeto es mutable, podés mutarlo a través de esa referencia y el caller lo ve. Pero si reasignás la variable dentro de la función (apuntarla a otro objeto), el caller no lo ve porque su variable sigue apuntando al original. En Java esto es lo mismo con objetos; la diferencia es que Python aplica esto a todo, incluyendo ints y strings.
