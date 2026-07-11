---
stack: python
id: python-patterns-performance
title: "Python: patrones, rendimiento y errores"
area: Backend
priority: medium
resourceLabel: Python, Data Structures
resourceUrl: https://docs.python.org/3/tutorial/datastructures.html
---

## Summary

Cómo encarar un problema de rendimiento en Python sin adivinar: profiling, estructuras de datos correctas, memoization, manejo idiomático de errores y gestión de recursos.

## Concepts

### Profiling: medir antes de optimizar

#### Details

El primer error de rendimiento es optimizar sin medir. Python tiene herramientas built-in para esto: `cProfile` es el profiler estándar que muestra cuánto tiempo se gasta en cada función y cuántas veces fue llamada. La salida tiene dos columnas clave: `cumtime` (tiempo total incluyendo sub-llamadas) y `tottime` (tiempo propio de la función). El cuello de botella real casi nunca está donde creés que está, de ahí la regla "measure, don't guess".

Para un análisis rápido en desarrollo podés ejecutar `python -m cProfile -s cumtime myscript.py` desde la terminal. Para profiling en producción o dentro de una función específica, `cProfile.Profile()` como context manager te da control más fino. La librería `pstats` filtra y ordena los resultados. Para profiling de memoria (no tiempo), `tracemalloc` es el módulo estándar; para profiling line-by-line, `line_profiler` (paquete externo) es la herramienta de facto.

El ciclo correcto es: (1) medir y encontrar el bottleneck real, (2) entender POR QUÉ ese código es lento (¿algoritmo O(n²)?, ¿I/O bloqueante?, ¿copia innecesaria de datos?), (3) aplicar el cambio mínimo, (4) medir de nuevo para confirmar la mejora. Saltarse el paso 1 o el paso 4 invalida el proceso completo.

#### Examples

Profiling básico desde la terminal

```bash
python -m cProfile -s cumtime -m myapp.scripts.process_data
# -s cumtime: ordenar por tiempo acumulado
# Buscar las primeras filas, ahí está el bottleneck
```

Profiling de una función específica en código

```python
import cProfile
import pstats
import io

profiler = cProfile.Profile()
profiler.enable()

result = process_large_dataset(data)  # el código a perfilar

profiler.disable()
stream = io.StringIO()
stats = pstats.Stats(profiler, stream=stream).sort_stats("cumulative")
stats.print_stats(20)  # top 20 funciones
print(stream.getvalue())
```

Profiling de memoria con tracemalloc

```python
import tracemalloc

tracemalloc.start()

result = load_and_process_users()

snapshot = tracemalloc.take_snapshot()
top_stats = snapshot.statistics("lineno")
for stat in top_stats[:5]:
    print(stat)  # muestra archivo, línea y memoria asignada
```

#### Sources

- [Python, cProfile](https://docs.python.org/3/library/profile.html)
- [Python, tracemalloc](https://docs.python.org/3/library/tracemalloc.html)

### Estructuras de datos correctas: O(1) vs O(n)

#### Details

Elegir la estructura de datos equivocada es una de las fuentes más comunes de código Python lento, y también un tema frecuente en entrevistas de backend. La regla fundamental: si vas a hacer búsquedas o verificar pertenencia repetidamente, usá `dict` o `set`, no `list`. Buscar un elemento en una lista es O(n), Python revisa uno por uno hasta encontrarlo. Buscar en un `set` o en las keys de un `dict` es O(1) amortizado gracias al hash table interno.

La diferencia importa en escala. Con 10 elementos, la diferencia entre O(1) y O(n) es despreciable. Con 100.000 elementos iterando N veces, la diferencia es la que separa un endpoint que responde en 50ms de uno que tarda 30 segundos. El caso más clásico: "verificar si un elemento está en una colección" dentro de un loop. `if item in my_list` dentro de un loop de 10.000 iteraciones es O(n²). Convertir `my_list` a `my_set` antes del loop es O(n log n) en total.

Para colecciones ordenadas donde también necesitás búsqueda eficiente, el módulo `bisect` provee búsqueda binaria O(log n) sobre listas. Para conteo de frecuencias, `collections.Counter` es más expresivo que un dict manual. Para colas con inserción/extracción por ambos extremos, `collections.deque` es O(1) vs O(n) de una lista normal. Conocer el zoo completo de `collections` es señal de un candidato que piensa en complejidad, no solo en "que funcione".

#### Examples

Verificar pertenencia en un loop: O(n²) vs O(n)

```python
# Lento: O(n²), busca en la lista por cada elemento
blocked_emails = get_blocked_emails()  # list de 50.000 entradas
users_to_notify = [u for u in all_users if u.email not in blocked_emails]

# Rápido: convertir a set una vez, O(1) por lookup
blocked_set = set(get_blocked_emails())  # O(n) una vez
users_to_notify = [u for u in all_users if u.email not in blocked_set]
```

Counter para frecuencias (más expresivo que un dict manual)

```python
from collections import Counter

def top_tags(posts: list[Post], n: int = 10) -> list[tuple[str, int]]:
    all_tags = [tag for post in posts for tag in post.tags]
    tag_counts = Counter(all_tags)
    return tag_counts.most_common(n)
```

deque para una cola de procesamiento (O(1) en ambos extremos)

```python
from collections import deque

queue = deque(initial_tasks)
while queue:
    task = queue.popleft()  # O(1), list.pop(0) sería O(n)
    result = process(task)
    if result.spawns_subtasks:
        queue.extend(result.subtasks)
```

#### Sources

- [Python, Time Complexity](https://wiki.python.org/moin/TimeComplexity)
- [Python, collections](https://docs.python.org/3/library/collections.html)

### Memoization con `functools.lru_cache`

#### Details

La memoización es la técnica de cachear el resultado de una función para un conjunto dado de argumentos, evitando recalcularlos. En Python, `functools.lru_cache` implementa esto con una política LRU (Least Recently Used) configurable via el parámetro `maxsize`. Es ideal para funciones puras (sin side effects) que son costosas de calcular y se llaman repetidamente con los mismos argumentos: cálculos recursivos, lookups a datos que no cambian durante la sesión, transformaciones costosas de texto.

La restricción fundamental es que los argumentos deben ser **hasheables**, `lru_cache` los usa como claves del cache interno. Esto excluye listas, dicts y sets como argumentos directos; si necesitás cachear sobre colecciones, podés convertirlas a tupla. `@lru_cache(maxsize=None)` deshabilita el límite (equivalente a `@cache` en Python 3.9+), útil para recursive dynamic programming donde nunca querés eviction, pero puede crecer sin límite.

Para casos donde el cache debe tener expiración (TTL) o compartirse entre procesos, `lru_cache` no alcanza, ahí se necesita Redis o una librería de cache externa. También es importante entender que `lru_cache` no es thread-safe para eviction bajo alta concurrencia extrema (aunque el GIL mitiga la mayoría de los problemas en CPython). Para una función que lees de DB y que puede cambiar, no uses `lru_cache` sin pensar en invalidación, el cache va a servir datos stale.

#### Examples

Cálculo de Fibonacci con memoización (el ejemplo canónico)

```python
from functools import lru_cache

@lru_cache(maxsize=None)
def fibonacci(n: int) -> int:
    if n < 2:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

# Sin cache: O(2^n). Con cache: O(n), cada valor se calcula una vez.
```

Cache de lookup costoso con maxsize fijo

```python
from functools import lru_cache

@lru_cache(maxsize=256)
def get_country_config(country_code: str) -> dict:
    """Carga configuración de país desde archivo, costoso, pero estático en runtime."""
    return load_config_from_file(f"configs/{country_code}.json")

# Los 256 países más recientes quedan en cache; el menos usado se descarta.
```

Invalidar el cache manualmente cuando los datos cambian

```python
@lru_cache(maxsize=128)
def get_feature_flags(user_id: int) -> dict:
    return fetch_flags_from_db(user_id)

# Cuando los flags cambian para un usuario:
get_feature_flags.cache_clear()  # limpia TODO el cache de esta función
```

#### Sources

- [Python, functools.lru_cache](https://docs.python.org/3/library/functools.html#functools.lru_cache)
- [PEP 3155, functools.cache](https://docs.python.org/3/library/functools.html#functools.cache)

### Manejo de excepciones idiomático: EAFP vs LBYL

#### Details

Python tiene dos estilos de control de flujo para situaciones de error. **LBYL** (Look Before You Leap): verificar la precondición antes de intentar la operación. **EAFP** (Easier to Ask Forgiveness than Permission): intentar la operación y manejar el error si falla. El estilo idiomático de Python es EAFP: es más conciso, evita race conditions en operaciones concurrentes, y en muchos casos es también más performante (no hay doble chequeo).

La regla crítica para entrevistas: **nunca usar `except:` desnudo ni `except Exception:` como catch-all para lógica de negocio**. Un `except:` sin tipo captura incluso `KeyboardInterrupt` y `SystemExit`, errores que definitivamente no querés swallow. Un `except Exception:` como catch-all sin logging ni re-raise oculta bugs reales. La práctica correcta es capturar el tipo de excepción más específico posible para esa operación, logear con contexto, y re-lanzar o convertir a un error de dominio.

La jerarquía de excepciones de Python está diseñada para esto. Para operaciones con archivos o red usás `IOError`/`OSError`. Para conversiones, `ValueError` o `TypeError`. Para lookups en dict, `KeyError`. Para accesos a atributos, `AttributeError`. Conocer qué excepción lanza cada operación,y cuál es la más específica, es lo que separa código Python idiomático de código defensivo y verboso.

#### Examples

EAFP idiomático: intentar y manejar (estilo Python)

```python
# LBYL (no idiomático): doble verificación
if "user_id" in data and data["user_id"] is not None:
    user_id = data["user_id"]
else:
    raise ValueError("user_id required")

# EAFP (idiomático): intentar y capturar el error específico
try:
    user_id = data["user_id"]
except KeyError:
    raise ValueError("user_id is required in the payload") from None
```

Excepciones específicas con contexto de logging

```python
import logging

logger = logging.getLogger(__name__)

def load_user_config(user_id: int) -> dict:
    try:
        with open(f"configs/user_{user_id}.json") as f:
            return json.load(f)
    except FileNotFoundError:
        logger.info("No config for user %d, using defaults", user_id)
        return DEFAULT_CONFIG
    except json.JSONDecodeError as exc:
        logger.error("Corrupt config for user %d: %s", user_id, exc)
        raise ConfigurationError(f"Invalid config for user {user_id}") from exc
```

Anti-patrón: never do this

```python
# MAL: traga todos los errores, incluidos bugs de programación
try:
    result = process_payment(order)
except:
    pass  # el orden puede haber quedado en estado inconsistente, nadie lo sabe

# MAL: catch demasiado amplio sin re-raise ni logging
try:
    result = fetch_from_external_api(endpoint)
except Exception:
    result = None  # silencia un timeout, un 500, un bug, todo igual
```

#### Sources

- [Python, Errors and Exceptions](https://docs.python.org/3/tutorial/errors.html)
- [Python Glossary, EAFP](https://docs.python.org/3/glossary.html#term-EAFP)

### Context managers y gestión de recursos

#### Details

Los context managers garantizan que los recursos se liberen correctamente, incluso cuando hay excepciones. El protocolo `__enter__` / `__exit__` es lo que está detrás de la sentencia `with`. Usarlo para archivos, conexiones de red, locks, sesiones de base de datos y transacciones no es solo "buena práctica", es la única forma de garantizar que el recurso se libera aunque el código que lo usa falle a mitad de camino.

El patrón más común de bug de recursos en Python es abrir algo (un archivo, una conexión, un lock) y olvidarse del `close()` o del `release()`. Si hay una excepción entre el `open()` y el `close()`, el `close()` nunca se ejecuta. Un context manager mueve el teardown al protocolo del objeto, que Python ejecuta siempre al salir del bloque `with`. Esto es lo que hace que `with open(...) as f` sea preferible a `f = open(...) ... f.close()`.

Para crear tus propios context managers hay dos caminos. El primero es implementar `__enter__` y `__exit__` en una clase. El segundo, más liviano para contextos simples, es usar el decorador `@contextmanager` de `contextlib` con una función generadora: todo lo que va antes del `yield` es el setup, el `yield` es el cuerpo del bloque `with`, y lo que va después (idealmente en un bloque `finally`) es el teardown. Esta segunda forma es idiomática para wrappers de un solo uso.

#### Examples

Context manager con `contextlib.contextmanager`

```python
from contextlib import contextmanager
import time
import logging

logger = logging.getLogger(__name__)

@contextmanager
def timer(operation_name: str):
    start = time.perf_counter()
    try:
        yield
    finally:
        elapsed = time.perf_counter() - start
        logger.info("%s took %.3fs", operation_name, elapsed)

# Uso:
with timer("process_orders"):
    result = process_all_orders(batch)
```

Context manager para transacción explícita de DB

```python
from contextlib import contextmanager
from sqlalchemy.orm import Session

@contextmanager
def transaction(session: Session):
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise

# Uso:
with transaction(session) as s:
    s.add(Order(user_id=1, total=100))
    s.add(StockMovement(product_id=5, delta=-1))
    # commit al salir limpio, rollback si hay excepción
```

Manejo de múltiples recursos con un solo `with`

```python
# Python 3.10+ permite paréntesis para múltiples context managers
with (
    open("input.csv") as infile,
    open("output.csv", "w") as outfile,
    timer("csv_transform"),
):
    transform_csv(infile, outfile)
# ambos archivos se cierran siempre, incluso si transform_csv falla
```

#### Sources

- [Python, contextlib](https://docs.python.org/3/library/contextlib.html)
- [Python, with statement](https://docs.python.org/3/reference/compound_stmts.html#the-with-statement)

## Interview Questions

### Un endpoint de FastAPI tarda 3 segundos. ¿Cuál es tu proceso para encontrar dónde está el problema?

Primero mido antes de asumir: activo `cProfile` o un middleware de timing que loguea el tiempo por sub-operación. Busco `cumtime` alto en funciones que yo escribí, no en el runtime de Python. Las causas más comunes en APIs son N+1 de queries (veo 200+ queries por request en el log SQL), una query sin índice sobre una tabla grande (veo un `Seq Scan` en `EXPLAIN ANALYZE`), o serialización ineficiente de objetos grandes. Con el profiler identifico la función culpable, entiendo el POR QUÉ (algoritmo, I/O, estructura de datos), aplico el cambio mínimo y mido de nuevo para confirmar.

### ¿Cuándo usarías un `set` en lugar de una `list`? ¿Y un `dict` en lugar de un `set`?

Uso `set` cuando necesito verificar pertenencia repetidamente y el orden no importa. `if item in my_list` dentro de un loop es O(n), si la lista tiene 50.000 elementos y el loop tiene 10.000 iteraciones, es medio billón de comparaciones. `if item in my_set` es O(1) amortizado: convierto la lista a set una vez O(n) y el loop completo es O(n). Uso `dict` cuando además de verificar pertenencia necesito asociar un valor a cada elemento: `if user_id in blocked_ids_with_reason` y quiero saber la razón.

### ¿Para qué usarías `lru_cache` y cuándo NO lo usarías?

Lo uso para funciones puras y costosas que se llaman con los mismos argumentos repetidamente en el mismo proceso: parsing de configuración, cálculos combinatorios, lookups a datos estáticos que no cambian en runtime. No lo uso cuando los datos pueden cambiar durante la vida del proceso sin que yo pueda invalidar el cache, cuando los argumentos no son hasheables, o cuando el cache necesita ser compartido entre procesos o sobrevivir reinicios. Para esos casos uso Redis con un TTL explícito.

### ¿Cuál es la diferencia entre EAFP y LBYL? ¿Cuál preferís en Python y por qué?

LBYL verifica la condición antes de actuar, EAFP actúa y maneja el error si falla. En Python prefiero EAFP por tres razones: es más conciso, evita race conditions (entre el check y la operación el estado puede cambiar, especialmente en código concurrente) y muchas operaciones de Python ya están diseñadas para lanzar excepciones descriptivas en caso de falla. La clave es capturar la excepción MÁS ESPECÍFICA posible, no `except Exception` como catch-all, y siempre logear con contexto suficiente para diagnosticar el error en producción.

### ¿Qué pasa si no usás un context manager para manejar un archivo o una conexión de base de datos?

Si no uso un context manager y hay una excepción entre el `open()` y el `close()`, el `close()` nunca se ejecuta. Para archivos, eso significa que el descriptor queda abierto hasta que el garbage collector lo recoja, y el GC de CPython no garantiza cuándo. En una app de alta concurrencia podés agotar los file descriptors del sistema operativo (`Too many open files`). Para conexiones de DB, la conexión queda "prestada" al pool indefinidamente, eventualmente el pool se llena y los requests nuevos empiezan a dar timeout. El `with` garantiza que `__exit__` se llama siempre, incluyendo en casos de excepción.

### ¿Qué problema tiene este código y cómo lo corregirías? `except: pass`

El `except:` desnudo captura absolutamente todo, incluyendo `KeyboardInterrupt`, `SystemExit`, y `GeneratorExit`, señales que el runtime necesita para funcionar correctamente. El `pass` encima significa que el error se silencia completamente: si hay un bug, nunca lo vas a saber. La corrección depende del contexto: si el error es recuperable, capturo la excepción ESPECÍFICA que puede ocurrir (`except ValueError`, `except KeyError`) y manejo ese caso con logging y un valor de fallback razonable. Si el error no es recuperable, no lo capturo, dejo que propague y que el handler global lo loguee y devuelva un 500 al cliente.
