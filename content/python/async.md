---
stack: python
id: python-async
title: Python: async, concurrencia y el GIL
area: Backend
priority: high
resourceLabel: Python, asyncio documentation
resourceUrl: https://docs.python.org/3/library/asyncio.html
---

## Summary
El modelo de concurrencia de Python requiere entender tres capas: el GIL (qué impide y qué no), el event loop de asyncio (concurrencia cooperativa para I/O), y cuándo escalar a threads o procesos (I/O-bound vs CPU-bound). Confundir estos modelos lleva a arquitecturas que no escalan.

## Concepts

### El GIL: qué es, qué impide y qué no impide
#### Details
El Global Interpreter Lock (GIL) es un mutex dentro del intérprete CPython que asegura que **solo un thread ejecute bytecode Python en un instante dado**. Existe por razones históricas de simplicidad: gestionar la referencia de conteo (`refcount`) de objetos de forma thread-safe sin un lock global requeriría locks granulares en cada objeto, lo que en los 90s resultaba más lento que el lock global para la mayoría de los casos.

Lo que el GIL **impide** es el paralelismo real de CPU con threads: si tenés 8 cores y lanzás 8 threads Python corriendo cálculos, solo uno corre a la vez. Los otros esperan el GIL. Esto hace que `threading` sea inútil para acelerar código CPU-bound.

Lo que el GIL **no impide** es la concurrencia en operaciones de I/O. Cuando un thread hace una syscall de I/O (leer un socket, esperar una consulta de base de datos), **libera el GIL** voluntariamente mientras espera. Esto significa que threads sí pueden usarse para I/O concurrente. Pero `asyncio` es más eficiente para ese caso porque evita el overhead de crear y contextualizar threads.

#### Examples
El GIL limita el paralelismo CPU en threads
```python
import threading
import time

def cpu_bound(n: int) -> None:
    # Loop intensivo, el GIL limita a un thread a la vez
    count = 0
    for _ in range(n):
        count += 1

start = time.perf_counter()

# Dos threads "paralelos", pero con GIL son secuenciales en CPU
t1 = threading.Thread(target=cpu_bound, args=(50_000_000,))
t2 = threading.Thread(target=cpu_bound, args=(50_000_000,))
t1.start(); t2.start()
t1.join(); t2.join()

print(f"Threads: {time.perf_counter() - start:.2f}s")
# Similar o PEOR que un solo thread, el GIL no ayuda acá
```

El GIL se libera en I/O: threads sí concurren para I/O-bound
```python
import threading
import urllib.request

def fetch(url: str) -> None:
    with urllib.request.urlopen(url) as resp:
        _ = resp.read()  # el GIL se libera durante la espera del socket
    print(f"Done: {url}")

urls = [
    "https://httpbin.org/delay/1",
    "https://httpbin.org/delay/1",
]
threads = [threading.Thread(target=fetch, args=(u,)) for u in urls]
for t in threads: t.start()
for t in threads: t.join()
# Tarda ~1s, no ~2s, concurrencia real gracias a la liberación del GIL
```

#### Sources
- [Python, What is the GIL?](https://docs.python.org/3/glossary.html#term-global-interpreter-lock)
- [Python, Thread State and the Global Interpreter Lock](https://docs.python.org/3/c-api/init.html#thread-state-and-the-global-interpreter-lock)

---

### `async`/`await` y el event loop
#### Details
`asyncio` implementa **concurrencia cooperativa**: en lugar de preempción por el OS, las coroutines ceden el control explícitamente usando `await`. El event loop es un único thread que monitorea objetos "awaitable" (sockets, timers, futures) y despacha la ejecución cuando están listos. Esto es eficiente para I/O-bound porque el costo de crear/destruir threads desaparece, y el número de coroutines activas puede ser muy alto (decenas de miles).

Una función `async def` retorna una **coroutine object** al ser llamada, no ejecuta nada todavía. La ejecución comienza cuando el event loop la ejecuta vía `await` o `asyncio.run()`. El `await` tiene dos efectos: indica que esta coroutine puede ser suspendida si la operación no está lista, y le devuelve el control al event loop para que ejecute otras coroutines mientras tanto.

El error de concepto más común es pensar que `async/await` hace el código más rápido automáticamente. Solo tiene sentido si las operaciones que se `await` son verdaderamente asíncronas (operaciones de red, I/O de disco con drivers async, timers). Si `await`-ás código síncrono bloqueante, el event loop queda frenado y no hay ganancia.

#### Examples
Coroutine básica: `async def` y `await`
```python
import asyncio

async def greet(name: str, delay: float) -> str:
    await asyncio.sleep(delay)   # cede el loop durante `delay` segundos
    return f"Hello, {name}!"

async def main() -> None:
    result = await greet("world", 1.0)
    print(result)

asyncio.run(main())
```

Dos coroutines corriendo concurrentemente con `asyncio.gather`
```python
import asyncio
import time

async def fetch_data(source: str, delay: float) -> str:
    print(f"Fetching {source}...")
    await asyncio.sleep(delay)   # simula latencia de red
    return f"data from {source}"

async def main() -> None:
    start = time.perf_counter()

    # gather las ejecuta concurrentemente, no secuencialmente
    results = await asyncio.gather(
        fetch_data("db", 1.0),
        fetch_data("api", 1.5),
        fetch_data("cache", 0.5),
    )

    elapsed = time.perf_counter() - start
    print(results)
    print(f"Total: {elapsed:.2f}s")  # ~1.5s, no ~3s

asyncio.run(main())
```

#### Sources
- [asyncio, Coroutines and Tasks](https://docs.python.org/3/library/asyncio-task.html)
- [asyncio, Event Loop](https://docs.python.org/3/library/asyncio-eventloop.html)
- [asyncio.run()](https://docs.python.org/3/library/asyncio-runner.html#asyncio.run)

---

### `asyncio.gather` vs `asyncio.create_task` vs `asyncio.wait`
#### Details
`asyncio.gather(*coros)` es la forma de alto nivel para correr múltiples coroutines concurrentemente y recoger sus resultados en orden. Cancela todo si alguna falla (por defecto). Es la elección correcta cuando tenés un conjunto fijo de coroutines que querés ejecutar y esperar juntas.

`asyncio.create_task(coro)` crea un `Task` (una coroutine envuelta en el scheduling del event loop) que empieza a ejecutarse inmediatamente, sin bloquearse en ella. Esto permite patrones más dinámicos: crear tareas en un loop, cancelarlas individualmente, o hacer trabajo mientras otras corren. Un `Task` es también útil cuando querés "disparar y olvidar" con cleanup posterior.

`asyncio.wait(tasks, ...)` es más granular: devuelve dos sets (`done` y `pending`) y acepta opciones como `return_when=FIRST_COMPLETED`. Es para patrones de "esperar el primero que termine" (como un timeout competitivo) o procesar resultados a medida que llegan, sin esperar a todos.

#### Examples
`create_task` para lanzar trabajo en background
```python
import asyncio

async def background_job(name: str) -> None:
    await asyncio.sleep(2)
    print(f"{name} done")

async def main() -> None:
    task = asyncio.create_task(background_job("report"))
    # Podemos hacer otro trabajo mientras tanto
    await asyncio.sleep(0.5)
    print("Doing other work...")
    await task  # esperamos que termine antes de salir
    print("Main done")

asyncio.run(main())
```

`wait` con `FIRST_COMPLETED` para implementar timeout competitivo
```python
import asyncio

async def slow_query() -> str:
    await asyncio.sleep(3)
    return "result"

async def timeout_guard(seconds: float) -> str:
    raise TimeoutError(f"Exceeded {seconds}s")

async def main() -> None:
    tasks = {
        asyncio.create_task(slow_query()),
        asyncio.create_task(asyncio.sleep(1)),  # timeout simulado
    }
    done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
    for task in pending:
        task.cancel()
    print(f"Completed: {len(done)}, Cancelled: {len(pending)}")

asyncio.run(main())
```

#### Sources
- [asyncio.gather()](https://docs.python.org/3/library/asyncio-task.html#asyncio.gather)
- [asyncio.create_task()](https://docs.python.org/3/library/asyncio-task.html#asyncio.create_task)
- [asyncio.wait()](https://docs.python.org/3/library/asyncio-task.html#asyncio.wait)

---

### Threads vs Procesos vs Async: cuándo usar cada modelo
#### Details
La regla central es: **I/O-bound → async o threads; CPU-bound → multiprocessing**. El GIL convierte a los threads en inútiles para CPU-bound. Para I/O-bound, `asyncio` es más eficiente que threads porque evita el overhead de creación y context-switching del OS, pero requiere un stack async end-to-end. Threads tienen ventaja cuando trabajás con librerías síncronas que no podés reescribir (un SDK de terceros sin soporte async).

`multiprocessing` crea procesos separados, cada uno con su propio intérprete y GIL. Usa IPC (pipes, queues) para comunicarse, lo que tiene overhead. Es la única forma de escalar CPU-bound en CPython. Una alternativa más moderna es `concurrent.futures.ProcessPoolExecutor`, que provee una API uniforme compatible con futures y asyncio.

En entrevistas de arquitectura, el punto fino es que estos modelos no son mutuamente excluyentes. Un servidor web real puede usar `asyncio` para manejar requests (I/O), delegar cómputo pesado a un `ProcessPoolExecutor` (CPU), y usar un thread pool para librerías síncronas de terceros via `run_in_executor`.

#### Examples
`ProcessPoolExecutor` para trabajo CPU-bound
```python
import asyncio
from concurrent.futures import ProcessPoolExecutor

def cpu_heavy(n: int) -> int:
    # Corre en un proceso separado, sin GIL
    return sum(i * i for i in range(n))

async def main() -> None:
    loop = asyncio.get_running_loop()
    with ProcessPoolExecutor() as pool:
        result = await loop.run_in_executor(pool, cpu_heavy, 5_000_000)
    print(f"Sum of squares: {result}")

asyncio.run(main())
```

`ThreadPoolExecutor` para librerías síncronas dentro de async
```python
import asyncio
from concurrent.futures import ThreadPoolExecutor
import time

def legacy_sync_api(query: str) -> str:
    # Librería de terceros sin soporte async
    time.sleep(1)
    return f"result for: {query}"

async def main() -> None:
    loop = asyncio.get_running_loop()
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = await asyncio.gather(*[
            loop.run_in_executor(pool, legacy_sync_api, q)
            for q in ["users", "orders", "products"]
        ])
    print(results)

asyncio.run(main())
```

#### Sources
- [Python, threading module](https://docs.python.org/3/library/threading.html)
- [Python, multiprocessing module](https://docs.python.org/3/library/multiprocessing.html)
- [concurrent.futures, ProcessPoolExecutor](https://docs.python.org/3/library/concurrent.futures.html#concurrent.futures.ProcessPoolExecutor)

---

### Evitar bloquear el event loop con `run_in_executor`
#### Details
Cualquier llamada síncrona bloqueante dentro de una coroutine **bloquea el event loop completo**: mientras esa operación corre, ninguna otra coroutine puede progresar. Los casos típicos son `time.sleep()` en lugar de `await asyncio.sleep()`, llamadas a librerías de base de datos síncronas, o leer archivos con `open()` sin drivers async. En un servidor web, esto significa que una sola request lenta bloquea a todas las demás.

El patrón correcto para código bloqueante dentro de async es `loop.run_in_executor(executor, func, *args)`. Esto despacha la función a un thread pool (o process pool), libera el event loop, y devuelve un awaitable. El event loop puede seguir procesando otras coroutines mientras la función síncrona corre en el thread.

La alternativa larga es migrar todo el stack a librerías async nativas (aiohttp en lugar de requests, asyncpg/databases en lugar de psycopg2 síncrono, aiofiles para I/O de disco). Esto es más limpio pero requiere trabajo de migración. `run_in_executor` es el puente correcto cuando no podés reescribir una dependencia síncrona.

#### Examples
El problema: código bloqueante congela el loop
```python
import asyncio
import time

async def blocking_bad() -> None:
    print("Start bad")
    time.sleep(2)   # ← BLOQUEA el event loop entero
    print("End bad")

async def other_task() -> None:
    print("Other task running")
    await asyncio.sleep(0)

async def main() -> None:
    # other_task no puede ejecutarse mientras blocking_bad duerme
    await asyncio.gather(blocking_bad(), other_task())

asyncio.run(main())
```

La solución: `run_in_executor` mueve el bloqueo al thread pool
```python
import asyncio
import time
from concurrent.futures import ThreadPoolExecutor

def blocking_io(seconds: float) -> str:
    time.sleep(seconds)   # síncrono, pero ahora en un thread
    return "done"

async def main() -> None:
    loop = asyncio.get_running_loop()
    with ThreadPoolExecutor() as pool:
        # El event loop queda libre mientras blocking_io corre en el thread
        result = await loop.run_in_executor(pool, blocking_io, 2.0)
    print(result)

asyncio.run(main())
```

Wrapper async para una función sync existente
```python
import asyncio
from functools import partial
from concurrent.futures import ThreadPoolExecutor

_executor = ThreadPoolExecutor(max_workers=10)

async def run_sync(func, *args):
    """Convierte cualquier función síncrona en awaitable."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_executor, partial(func, *args))

# Uso:
# result = await run_sync(requests.get, "https://api.example.com/data")
```

#### Sources
- [asyncio, Running in Threads](https://docs.python.org/3/library/asyncio-eventloop.html#asyncio.loop.run_in_executor)
- [asyncio, Developing with asyncio, Detecting blocking code](https://docs.python.org/3/library/asyncio-dev.html#detect-never-retrieved-exceptions)

## Interview Questions

### ¿El GIL impide la concurrencia en Python? ¿Cuándo threads sí tienen valor?
No, el GIL impide el **paralelismo de CPU** con threads, no la concurrencia. La diferencia es clave: cuando un thread hace I/O (espera un socket, una query de base de datos, una respuesta HTTP), libera el GIL voluntariamente. Eso permite que otros threads corran durante esa espera. Donde threads sí tienen valor es exactamente ahí: I/O-bound con librerías síncronas que no puedo reescribir como async. Para CPU-bound real, necesito `multiprocessing` porque solo eso escapa al GIL.

### ¿Cuándo usarías `asyncio` y cuándo preferirías `multiprocessing`? ¿Pueden coexistir?
`asyncio` es mi primera opción para I/O-bound: requests de red, queries de base de datos, operaciones de archivo con drivers async. Es eficiente porque evita el overhead de threads y escala bien (miles de coroutines concurrentes con un solo thread OS). `multiprocessing` lo reservo para CPU-bound: procesamiento de imágenes, ML inference, análisis de datos. Pueden coexistir perfectamente: en un servidor FastAPI, el event loop maneja requests de red con asyncio, y delego cómputo pesado a `ProcessPoolExecutor` via `run_in_executor`. Es una arquitectura común en servicios de backend.

### ¿Qué pasa si llamás código bloqueante (por ejemplo, `time.sleep()` o `requests.get()`) dentro de una coroutine?
El event loop completo queda bloqueado. Mientras esa operación síncrona corre, ninguna otra coroutine puede progresar. En un servidor web eso significa que una sola request lenta bloquea a todas las demás. La solución es `loop.run_in_executor()`, que despacha la función bloqueante a un thread pool y libera el event loop. En producción, lo ideal es migrar a librerías async nativas (aiohttp, asyncpg, aiofiles), pero `run_in_executor` es el puente correcto para dependencias síncronas que no controlo.

### ¿Cómo diseñarías un servicio async que necesita hacer CPU-bound y I/O-bound al mismo tiempo?
Separaría claramente las responsabilidades: el event loop principal maneja el I/O (requests entrantes, llamadas a APIs externas, base de datos via asyncpg o similar), y el cómputo CPU-bound va a un `ProcessPoolExecutor`. La integración se hace con `await loop.run_in_executor(process_pool, heavy_function, data)`. Así el event loop nunca se bloquea: despacha el trabajo al proceso y procesa otras requests mientras espera el resultado. Para evitar crear el pool en cada request, lo creo una sola vez al iniciar la aplicación y lo cierro al shutdown.

### ¿Cuál es la diferencia entre `asyncio.gather` y `asyncio.create_task`? ¿Cuándo usarías cada uno?
`gather` es de alto nivel: recibe coroutines, las convierte en tasks internamente, las ejecuta concurrentemente, y retorna los resultados en orden cuando todas terminan. Es la elección por defecto cuando tengo un conjunto fijo de operaciones que quiero ejecutar juntas. `create_task` es más explícito: crea y programa una task que empieza a ejecutarse inmediatamente, y me devuelve un objeto `Task` que puedo cancelar, inspeccionar o awaitar más tarde. Uso `create_task` cuando quiero control individual sobre las tasks (cancelar una, empezar a procesar resultados a medida que llegan) o cuando creo tasks dinámicamente en un loop.

### ¿Cómo detectarías y corregirías un leak de coroutines en asyncio?
Un síntoma clásico es ver warnings de "coroutine was never awaited" o "Task was destroyed but it is pending". Para detectarlos, activo el modo debug de asyncio (`asyncio.run(main(), debug=True)` o la variable de entorno `PYTHONASYNCIODEBUG=1`), que reporta coroutines que nunca se awaitaron y tasks que tardaron más de 100ms. Para corregirlos: si creo una task con `create_task`, debo guardar la referencia (no soltarla a la GC) y awaitarla o cancelarla explícitamente. Un patrón útil es mantener un set de tasks activas y registrar callbacks de cleanup con `task.add_done_callback`.
