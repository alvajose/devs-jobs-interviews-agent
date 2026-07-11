---
stack: python
kind: question-bank
source: DevLoversTeam/python-interview-questions
sourceUrl: https://github.com/DevLoversTeam/python-interview-questions
license: MIT
copyright: Copyright (c) 2026 DevLovers
---

<!-- Ingested verbatim from https://github.com/DevLoversTeam/python-interview-questions (MIT). Copyright (c) 2026 DevLovers.
     Re-run: node scripts/ingest/run.mjs python-devlovers, do NOT hand-edit. -->

## Interview Questions

### ¿En qué se diferencia Python de los lenguajes compilados?
#### Python

Python normalmente se ejecuta mediante un intérprete: el código se compila a
bytecode y se ejecuta en tiempo de ejecución en la VM de CPython. En los lenguajes
compilados como C/C++ o Rust, normalmente hay una compilación previa a código
máquina.

Consecuencias prácticas:

- Python es más rápido para desarrollo y prototipado.
- Los lenguajes compilados nativos suelen ser más rápidos en tareas intensivas de CPU.
- En Python, el rendimiento suele mejorarse con algoritmos, perfilado y
  extensiones en C.

**En resumen:**

- Python optimiza la velocidad de desarrollo.
- La compilación a código máquina normalmente ofrece mejor rendimiento bruto.
- La elección depende del dominio y de los requisitos de latencia y rendimiento.

### ¿Cuál es la diferencia entre `ruff` y `black` en funcionalidad y uso?
#### Python

`black` es un formateador de código con reglas fijas.

`ruff` es un linter rápido, además de formateador y autofixer de muchas reglas
como PEP 8, imports, bugs potenciales y simplificaciones de sintaxis.

En la práctica:

- o bien `ruff check --fix` + `ruff format`;
- o bien `ruff` para análisis estático + `black` para formateo.

**En resumen:**

- `black` se centra en el formateo.
- `ruff` cubre el linting y parte de las autocorrecciones.
- En proyectos modernos, a menudo basta con solo `ruff`.

### ¿Cuál es la diferencia entre `list` y `tuple`?
#### Python

La diferencia principal es que `list` es mutable y `tuple` es immutable.

Consecuencias prácticas:

- `list` sirve para datos que cambian;
- `tuple` sirve para registros fijos;
- `tuple` puede usarse como clave de diccionario si sus elementos son hashables.

```python
coords: tuple[float, float] = (50.45, 30.52)
queue: list[str] = ["task-1", "task-2"]
```

**En resumen:**

- `list` es para colecciones mutables.
- `tuple` es para estructuras de datos inmutables.
- La elección afecta la seguridad de la API y su uso en `dict/set`.

### ¿Qué es una hash function?
#### Python

Una hash function transforma un objeto en un número entero, el hash, que se
usa para ubicarlo o buscarlo rápidamente en `dict` y `set`.

Condiciones de corrección:

- si `a == b`, entonces `hash(a) == hash(b)`;
- el valor del hash debe ser estable durante la vida del objeto.

**En resumen:**

- La hash function es la base del rendimiento rápido de `dict` y `set`.
- No garantiza unicidad, porque puede haber colisiones.
- En clases personalizadas, `__eq__` y `__hash__` deben ser coherentes.

### ¿Cuál es la diferencia entre los operadores `is` y `==`?
#### Python

`==` compara **valores**, es decir equivalencia, mientras que `is` compara
**identidad**, o sea si se trata del mismo objeto en memoria.

```python
a = [1, 2]
b = [1, 2]
a == b   # True
a is b   # False
```

**Importante sobre optimizaciones, interning:** CPython cachea enteros pequeños
de `-5` a `256` y strings cortos durante compilación o carga. Por eso, `is`
puede devolver `True` incluso si parecen creados por separado. Pero esto es un
detalle de implementación y no debe usarse en lógica de negocio.

Para `None`, usa siempre `is`.

**En resumen:**

- `==` trata sobre igualdad de valores.
- `is` trata sobre el mismo objeto en memoria.
- El interning puede producir un `is True` inesperado para `int` y `str` pequeños.
- `value is None` es la única forma correcta de comprobar `None`.

### Describe cómo funcionan los bucles anidados en Python. ¿Qué problemas de rendimiento pueden causar y cómo evitarlos?
#### Python

Un bucle anidado es un bucle dentro de otro. La complejidad suele convertirse
en `O(n*m)` o peor, lo que resulta crítico con grandes volúmenes de datos.

Optimizaciones:

- sustituir búsquedas en listas por `set` o `dict`;
- sacar los invariantes fuera del bucle interno;
- usar generadores, `itertools` y vectorización;
- perfilar las zonas calientes.

**En resumen:**

- Los bucles anidados multiplican rápidamente el coste computacional.
- Las estructuras de datos suelen ser más importantes que las microoptimizaciones.
- El perfilado muestra exactamente qué debe optimizarse.

### Explica el propósito y uso de `*args` y `**kwargs` en funciones de Python. ¿En qué se diferencian?
#### Python

`*args` recoge argumentos posicionales adicionales en un `tuple`. `**kwargs`
recoge argumentos nombrados adicionales en un `dict`.

```python
def log_event(event: str, *args: object, **kwargs: object) -> None:
    ...
```

Usos típicos: envoltorios, adaptadores de API, decoradores y reenvío de parámetros.

**En resumen:**

- `*args` significa posicionales adicionales.
- `**kwargs` significa nombrados adicionales.
- Hacen las funciones más flexibles, pero requieren validación clara.

### ¿Cuál es la diferencia entre variables locales y nonlocal en Python?
#### Python

`nonlocal` se usa dentro de una función anidada para modificar una variable del
alcance envolvente más cercano, no del alcance global.

```python
from collections.abc import Callable


def counter() -> Callable:
    value = 0

    def inc() -> int:
        nonlocal value
        value += 1
        return value

    return inc
```

**En resumen:**

- Una variable local pertenece a la función actual.
- `nonlocal` modifica el estado de la función externa.
- Es un mecanismo clave para cierres con estado.

### ¿Qué es un cierre y qué relación tiene con los decoradores?
#### Python

Un cierre es una función interna que "recuerda" las variables del alcance envolvente
incluso después de que la función externa haya terminado.

Un decorador suele implementarse precisamente mediante un cierre: la envoltura
conserva una referencia a la función original y a parámetros adicionales.

**En resumen:**

- Un cierre es función más contexto capturado.
- Un decorador suele ser una aplicación práctica de un cierre.
- Permite añadir comportamiento sin cambiar el cuerpo de la función.

### ¿Qué es un decorador en Python y cómo funciona?
#### Python

Un decorador es un objeto invocable que recibe una función o clase y devuelve una
versión modificada, una envoltura.

```python
from functools import wraps

def log_calls(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper
```

Aplicaciones típicas: registro, caché, autorización, reintentos y métricas.

**En resumen:**

- Un decorador añade comportamiento transversal.
- Funciona envolviendo un objeto invocable.
- Evita duplicar lógica técnica dentro del código de negocio.

### ¿Se pueden usar varios decoradores en una misma función?
#### Python

Sí, se pueden apilar varios decoradores. Se aplican de abajo hacia arriba: el
más cercano a `def` envuelve primero.

```python
@decorator_a
@decorator_b
def handler() -> None:
    ...
```

Equivalente: `handler = decorator_a(decorator_b(handler))`.

**En resumen:**

- Usar varios decoradores es válido y común.
- El orden de aplicación importa.
- La pila de decoradores debe documentarse para mantener claridad.

### Describe un posible problema con el orden de los decoradores al aplicarlos a una función.
#### Python

Un orden incorrecto puede cambiar la semántica: por ejemplo, aplicar caché antes
de una comprobación de acceso puede almacenar un resultado no deseado o saltarse
la lógica esperada.

Riesgos típicos:

- el registro ve argumentos ya modificados;
- los reintentos envuelven la excepción equivocada;
- la caché se aplica antes o después de la validación en el punto incorrecto.

**En resumen:**

- El orden de los decoradores afecta al comportamiento de la función.
- Es una causa frecuente de bugs ocultos.
- Las cadenas críticas necesitan pruebas sobre el orden de ejecución.

### ¿Se puede crear un decorador con una clase?
#### Python

Sí. Una clase decoradora implementa `__call__` para que su instancia se comporte
como una función.

```python
class CallCounter:
    def __init__(self, func):
        self.func = func
        self.calls = 0

    def __call__(self, *args, **kwargs):
        self.calls += 1
        return self.func(*args, **kwargs)
```

**En resumen:**

- Un decorador puede implementarse no solo con una función, sino también con una clase.
- La clase es útil cuando se necesita estado interno.
- El mecanismo clave es `__call__`.

### ¿Cómo definir un decorador que acepta parámetros?
#### Python

Hace falta una estructura de tres niveles: fábrica de decoradores, decorador y envoltura.

```python
from functools import wraps

def retry(times: int):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for _ in range(times - 1):
                try:
                    return func(*args, **kwargs)
                except Exception:
                    pass
            return func(*args, **kwargs)
        return wrapper
    return decorator
```

**En resumen:**

- Un decorador parametrizado es una función que devuelve otro decorador.
- A menudo se usa un cierre para conservar los parámetros.
- Este enfoque es cómodo para comportamiento configurable.

### ¿Para qué se usa `functools.wraps` en funciones decoradoras?
#### Python

`functools.wraps` copia los metadatos de la función original a la envoltura: nombre,
docstring, módulo y también `__wrapped__`.

Esto es importante para:

- depuración y logs correctos;
- introspección y documentación;
- compatibilidad con herramientas que leen la firma.

**En resumen:**

- `wraps` conserva la "identidad" de la función original.
- Sin él, las funciones decoradas pierden metadatos útiles.
- Es una buena práctica para todos los decoradores de envoltura.

### ¿Qué es un generador y en qué se diferencia de un iterador o de una función normal?
#### Python

Un generador es un iterador especial que se crea con una función que usa
`yield`. Genera valores uno por uno y conserva su estado interno entre llamadas.

Diferencias:

- frente a una función normal: no termina con un único `return`, sino que
  funciona con "pausa/reanudación";
- frente a un iterador manual: tiene una implementación más simple, sin una
  clase explícita con `__next__`.

**En resumen:**

- Un generador es la forma más cómoda de hacer iteración perezosa.
- Requiere menos código que una clase iteradora personalizada.
- Es especialmente útil para grandes flujos de datos.

### ¿Cómo se crea una función generadora?
#### Python

Hay que definir una función con `yield`.

```python
def countdown(start: int):
    current = start
    while current > 0:
        yield current
        current -= 1
```

La llamada `countdown(3)` devuelve un objeto generador que se puede iterar.

**En resumen:**

- La presencia de `yield` convierte la función en un generador.
- Un generador devuelve valores por etapas.
- El estado de la función se conserva entre iteraciones.

### ¿Cómo proporciona la palabra clave `yield` la funcionalidad de los generadores y por qué ahorran memoria?
#### Python

`yield` devuelve el siguiente valor y "congela" el contexto de la función
(variables locales, posición de ejecución). El siguiente `next()` reanuda la
ejecución desde ese punto.

El ahorro de memoria se debe a que los datos no se crean por completo de
antemano, sino que se calculan bajo demanda.

**En resumen:**

- `yield` implementa la pausa y la reanudación de la ejecución.
- Un generador soporta evaluación perezosa.
- Esto reduce el consumo de memoria en conjuntos de datos grandes.

### ¿Cuál es la diferencia entre `return` y `yield`?
#### Python

`return` finaliza la función y devuelve un único valor final. `yield` devuelve
un valor intermedio y conserva el estado para poder continuar después.

En un generador, `return` significa el final de la iteración (`StopIteration`).

**En resumen:**

- `return` -> finalización de la función.
- `yield` -> entrega de valores por etapas.
- `yield` se usa para procesamiento en flujo.

### ¿Cuál es la diferencia entre método de instancia, método de clase y método estático?
#### Python

- Método de instancia: tiene `self` y trabaja con una instancia concreta.
- Método de clase: tiene `cls` y trabaja con la clase en general.
- Método estático: no tiene `self/cls`; es una función utilitaria dentro del
  espacio de nombres de la clase.

**En resumen:**

- Instancia -> lógica de la instancia.
- Clase -> lógica de la clase o constructores alternativos.
- Static -> lógica auxiliar sin acceso al estado.

### ¿Cuál es la diferencia entre `@classmethod` y `@staticmethod` en las clases de Python?
#### Python

La diferencia está en el primer argumento y en el nivel de acceso:

- `@classmethod` recibe `cls` y puede trabajar con el estado de la clase;
- `@staticmethod` no recibe nada automáticamente.

`classmethod` se usa más a menudo para factorías o constructores polimórficos,
y `staticmethod` para utilidades.

**En resumen:**

- `classmethod` conoce la clase.
- `staticmethod` está aislado del estado de clase y de instancia.
- La elección depende de si necesitas acceso a `cls`.

### ¿Qué es `__slots__` en Python?
#### Python

`__slots__` limita el conjunto de atributos permitidos en una clase y puede
reducir el consumo de memoria al eliminar `__dict__` en las instancias.

```python
class Point:
    __slots__ = ("x", "y")
    def __init__(self, x: int, y: int) -> None:
        self.x = x
        self.y = y
```

**Matices de uso:**

- **Ahorro de memoria:** los objetos ocupan bastante menos espacio, porque los
  atributos se almacenan en un array fijo y no en la tabla hash `__dict__`.
- **Velocidad:** el acceso a atributos con `__slots__` suele ser un poco más rápido.
- **Ausencia de `__dict__`:** no podrás añadir dinámicamente nuevos atributos
  que no estén en la lista `__slots__` (a menos que añadas `"__dict__"` a la
  propia lista).
- **Referencias débiles:** si quieres usar `weakref`, debes añadir
  explícitamente `"__weakref__"` a `__slots__`.

**En resumen:**

- `__slots__` es útil para millones de objetos ligeros, por ejemplo nodos de un grafo.
- Elimina `__dict__` y `__weakref__` por defecto.
- Reduce flexibilidad a cambio de rendimiento y control.

### ¿Qué son los magic methods (métodos dunder) en las clases de Python y por qué se llaman "mágicos"?
#### Python

Los métodos dunder (`__init__`, `__str__`, `__len__`, `__eq__`, ...) son puntos
de enganche especiales que Python llama automáticamente en respuesta a
operadores y funciones integradas.

Se llaman "mágicos" porque integran tu clase en el comportamiento del lenguaje.

**En resumen:**

- Los métodos dunder definen el comportamiento protocolario del objeto.
- Permiten que tus clases se comporten "como tipos integrados".
- Úsalos solo cuando haya una necesidad semántica clara.

### ¿Qué es la herencia múltiple?
#### Python

La herencia múltiple es la herencia de una clase a partir de varias clases base.

```python
class A: ...
class B: ...
class C(A, B): ...
```

Da flexibilidad, pero exige disciplina en el diseño de métodos y en `super()`.

**En resumen:**

- Una clase puede heredar comportamiento de varias fuentes.
- Es útil para el enfoque basado en mixins.
- Puede hacer más difícil entender el MRO.

### ¿Cómo funciona el MRO (Method Resolution Order) en la herencia múltiple?
#### Python

El MRO define el orden de búsqueda de métodos en la jerarquía de clases. En
Python se usa el algoritmo de linealización C3.

**Diamond Problem (problema del diamante):** es el caso clásico en el que la
clase `D` hereda de `B` y `C`, y ambas heredan de `A`. El MRO garantiza que
`A` se revisará solo después de que se hayan revisado todos sus descendientes
(`B` y `C`).

```python
class A: pass
class B(A): pass
class C(A): pass
class D(B, C): pass

print(D.mro())
# [D, B, C, A, object]
```

El orden puede verse mediante `ClassName.__mro__` o `ClassName.mro()`.

**En resumen:**

- El MRO decide de qué clase base tomar un método.
- El orden es predecible y está definido formalmente (C3).
- Gracias al MRO, Python maneja correctamente el problema del diamante.
- Para la herencia cooperativa, todas las clases deben llamar a `super()`.

### ¿Cuáles son las ventajas y desventajas de usar herencia múltiple?
#### Python

Ventajas:

- reutilización de comportamiento desde varias fuentes;
- mixins cómodos para "añadir" capacidades.

Desventajas:

- MRO más complejo;
- riesgo de conflictos de nombres o comportamiento;
- depuración e incorporación más difíciles.

**En resumen:**

- La herencia múltiple es potente, pero exige reglas de diseño estrictas.
- Para la mayoría de casos, la composición es más simple.
- Usa herencia múltiple sobre todo para mixins pequeños.

### ¿Qué son los mixins?
#### Python

Un mixin es una clase pequeña con comportamiento adicional y específico, pensada
para combinarse mediante herencia y no para usarse por sí sola.

Ejemplos: `TimestampMixin`, `JsonSerializableMixin`.

**En resumen:**

- Un mixin añade una capacidad concreta.
- Normalmente no tiene su propio ciclo de vida completo.
- Encaja bien con la herencia múltiple.

### ¿Qué es la encapsulación en Python?
#### Python

La encapsulación es ocultar la implementación interna detrás de una API pública
estable. En Python se implementa principalmente con convenciones y `property`,
no con modificadores de acceso rígidos.

**En resumen:**

- El código cliente trabaja con la interfaz, no con los detalles.
- La encapsulación reduce el acoplamiento entre componentes.
- Facilita cambiar la implementación interna sin romper la API.

### ¿Cuál es la diferencia entre acceso público, privado y protegido?
#### Python

En Python esto son principalmente convenciones de nombres:

- `public`: `name` -> accesible en todas partes;
- `protected`: `_name` -> uso interno por convención;
- `private`: `__name` -> cambio interno de nombre (`_ClassName__name`), no protección
  absoluta.

**En resumen:**

- Python no tiene modificadores de acceso estrictos como Java o C#.
- `_name` y `__name` son señales de intención para desarrolladores.
- El control real de acceso se construye mediante diseño de API.

### ¿Qué es el polimorfismo y cómo se implementa en Python?
#### Python

El polimorfismo es la posibilidad de trabajar con distintos objetos a través de
una interfaz común. En Python suele implementarse con duck typing y protocolos.

```python
def render(obj) -> str:
    return obj.to_text()
```

Cualquier objeto con un método `to_text` sirve.

**En resumen:**

- Una interfaz, muchas implementaciones.
- En Python, el polimorfismo suele ser conductual, no jerárquico.
- Esto simplifica ampliar el sistema con nuevos tipos.

### ¿Qué es la abstracción en Python?
#### Python

La abstracción consiste en destacar la API esencial y ocultar detalles
innecesarios de implementación. El cliente trabaja con el contrato, no con los
pasos internos.

**En resumen:**

- La abstracción reduce la carga cognitiva.
- Facilita sustituir la implementación sin cambiar el código cliente.
- Se implementa mediante interfaces, ABC, protocolos y fachadas.

### ¿Cómo implementar abstracción de datos?
#### Python

Enfoque:

- ocultar el acceso directo a campos internos (`_field`);
- ofrecer una API controlada mediante métodos o `@property`;
- validar invariantes en la lógica del setter.

```python
class Temperature:
    def __init__(self, celsius: float) -> None:
        self.celsius = celsius

    @property
    def celsius(self) -> float:
        return self._celsius

    @celsius.setter
    def celsius(self, value: float) -> None:
        if value < -273.15:
            raise ValueError("invalid temperature")
        self._celsius = value
```

**En resumen:**

- La abstracción de datos protege los invariantes del objeto.
- `property` da acceso controlado al estado.
- Los detalles internos pueden cambiarse sin cambiar la API.

### ¿Qué es property en Python y cómo se usa?
#### Python

`property` convierte métodos de acceso en una API similar a atributos, con
posibilidad de validación, cálculos o lógica perezosa.

```python
class User:
    def __init__(self, name: str) -> None:
        self._name = name

    @property
    def name(self) -> str:
        return self._name
```

**En resumen:**

- `property` da control de acceso sin cambiar la sintaxis externa.
- Sirve para validación y valores derivados.
- Permite evolucionar la API sin romper a los clientes.

### ¿Qué es `@property`?
#### Python

`@property` es un decorador para un método getter. Junto con `@x.setter` y
`@x.deleter`, forma un atributo gestionado.

**En resumen:**

- `@property` permite leer un método como si fuera un campo.
- Ayuda a encapsular la implementación interna.
- A menudo se usa para APIs retrocompatibles.

### ¿Qué es un descriptor en Python?
#### Python

Un descriptor es un objeto que implementa `__get__`, `__set__` o `__delete__`
y controla el acceso a atributos de otra clase.

A través de descriptores funcionan `property`, `classmethod` y `staticmethod`.

**En resumen:**

- Un descriptor es un mecanismo de bajo nivel para acceso a atributos.
- Permite reutilizar lógica de validación o proxy de campos.
- Es la base de muchas técnicas de metaprogramación en Python.

### ¿Cuál es la diferencia entre property y descriptor?
#### Python

`property` es un descriptor de alto nivel ya preparado para un atributo. Un
descriptor personalizado es un mecanismo más general que puede reutilizarse en
muchos campos o clases.

**En resumen:**

- `property` es más simple y local.
- Un descriptor es más flexible y escalable.
- `property` está construido sobre el protocolo descriptor.

### ¿Cuándo conviene usar property y cuándo un descriptor?
#### Python

Usa `property` cuando la lógica afecta a uno o dos campos de una clase
concreta. Usa un descriptor cuando la misma lógica (validación, casting,
inicialización perezosa) debe reutilizarse en muchas clases.

**En resumen:**

- Lógica local de un campo -> `property`.
- Reutilización de la política de acceso -> descriptor.
- Un descriptor es ventajoso en modelos de dominio grandes.

### Explique el significado del método `__set_name__` en los descriptores de Python y dé un ejemplo de uso.
#### Python

`__set_name__(self, owner, name)` se llama durante la creación de la clase y
permite que el descriptor conozca el nombre del atributo al que está vinculado.

```python
class Field:
    def __set_name__(self, owner, name): self.name = name
```

**En resumen:**

- `__set_name__` inicializa el descriptor con el contexto de la clase.
- Permite crear validadores de campos reutilizables.
- Se ejecuta una sola vez en la etapa de creación de la clase.

### ¿Qué es `dataclass` y cuándo conviene usarlo?
#### Python

`@dataclass` genera automáticamente código repetitivo (`__init__`, `__repr__`,
`__eq__`). Es adecuado para modelos de datos sin comportamiento complejo.

```python
from dataclasses import dataclass
@dataclass(slots=True)
class User:
    name: str
    active: bool = True
```

**En resumen:**

- `dataclass` reduce código en modelos de datos.
- Es una buena opción para DTO y configuraciones.
- Para validación compleja, a menudo hacen falta otras herramientas.

### ¿Cuál es la diferencia entre `dataclass` y Pydantic?
#### Python

`dataclass` se centra en describir la estructura de forma cómoda. Pydantic
añade validación en tiempo de ejecución, análisis y serialización de datos.

**En resumen:**

- `dataclass` es más ligero y rápido para modelos internos.
- Pydantic es mejor para entrada externa y APIs.
- La elección depende de la necesidad de validación en ejecución.

### ¿Cómo garantizar seguridad de tipos en un proyecto Python?
#### Python

- añadir anotaciones de tipos de forma consistente en la API pública;
- activar `mypy`/`pyright` en CI;
- usar `TypedDict`, `Protocol` y genéricos;
- minimizar `Any` y los castings implícitos.

**En resumen:**

- La seguridad de tipos es un proceso, no una acción puntual.
- El mayor efecto lo da una puerta de CI para tipos.
- Aumentar el rigor de forma gradual funciona mejor que un "big bang".

### ¿Qué es `TypedDict`?
#### Python

`TypedDict` describe una forma tipada de diccionario: qué claves se esperan y
de qué tipo son sus valores.

```python
from typing import TypedDict
class UserPayload(TypedDict): name: str; active: bool
```

**En resumen:**

- `TypedDict` tipa un `dict` con claves fijas.
- Es cómodo para estructuras parecidas a JSON.
- Lo comprueba un analizador estático.

### ¿Qué es `Protocol` en typing?
#### Python

`Protocol` describe un contrato conductual (tipado estructural): un tipo es
compatible si tiene los métodos o atributos necesarios, independientemente de la
herencia.

**En resumen:**

- `Protocol` implementa duck typing en el tipado estático.
- Reduce el acoplamiento rígido a clases concretas.
- Es útil para APIs testeables y extensibles.

### ¿Qué son los genéricos en Python?
#### Python

Los genéricos permiten escribir tipos y funciones parametrizados por otros tipos.
En la sintaxis moderna: `class Box[T]: ...`, `def first[T](...) -> T`.

**En resumen:**

- Los genéricos hacen que los tipos sean reutilizables.
- Refuerzan la seguridad de tipos de colecciones y contenedores.
- Reducen la duplicación de código tipado.

### ¿Qué es Pydantic y para qué se usa?
#### Python

Pydantic es una biblioteca para describir esquemas de datos con validación en
tiempo de ejecución, conversión de tipos y serialización cómoda.

Casos típicos: modelos de solicitud y respuesta de FastAPI y configuración de la
aplicación.

**En resumen:**

- Pydantic valida datos externos durante la ejecución.
- Es cómodo para APIs e integraciones.
- Proporciona errores de validación claros y esquemas.

### ¿En qué se diferencia `raise` de simplemente imprimir un mensaje de error en Python?
#### Python

`raise` cambia el flujo de control y señala el error al llamador. `print` solo
muestra texto y no detiene el escenario erróneo.

**En resumen:**

- `raise` es un mecanismo de manejo de errores; `print`, no.
- Las exceptions pueden capturarse y registrarse de forma centralizada.
- `print` sirve para diagnóstico, no para contratos de error.

### ¿Por qué conviene limitar el uso de bloques try-except en programas Python y cómo afecta eso al rendimiento?
#### Python

`try/except` es necesario, pero no debería envolver bloques grandes "por si
acaso". Es especialmente costoso cuando las excepciones ocurren con frecuencia
(flujo guiado por excepciones).

**En resumen:**

- Captura solo errores esperados en un punto estrecho.
- Las excepciones frecuentes empeoran el rendimiento y la legibilidad.
- Prefiere comprobaciones explícitas cuando sea adecuado.

### ¿Cómo manejar errores al trabajar con archivos?
#### Python

Usa `with` y captura excepciones concretas (`FileNotFoundError`,
`PermissionError`, `UnicodeDecodeError`, `OSError`).

```python
try:
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
except FileNotFoundError:
    ...
```

**En resumen:**

- `with` garantiza el cierre del archivo.
- Maneja errores concretos de entrada y salida.
- Registra el contexto: ruta, modo y codificación.

### ¿Cómo escribir datos en un archivo en Python y cuál es la diferencia entre `w` (escritura) y `a` (anexar)?
#### Python

Escritura:

```python
with open("out.txt", "w", encoding="utf-8") as f:
    f.write("hello\n")
```

`w` sobrescribe el archivo desde el principio; `a` añade contenido nuevo al final.

**En resumen:**

- `w` borra los datos antiguos.
- `a` conserva el contenido existente.
- Para registros, normalmente se usa `a`.

### ¿Cómo trabajar de forma eficiente con archivos grandes?
#### Python

- leer en flujo, por líneas o por bloques;
- evitar cargar todo el archivo en memoria;
- usar búferes y generadores;
- para datos columnares o tabulares, elegir formatos y analizadores adecuados.

**En resumen:**

- La clave es la lectura en flujo en lugar de la lectura completa.
- Los generadores reducen el consumo de memoria.
- El algoritmo de procesamiento importa más que las microoptimizaciones.

### ¿Cómo crear un gestor de contexto propio?
#### Python

Hay dos enfoques:

- una clase con `__enter__` y `__exit__`;
- una función con `contextlib.contextmanager`.

```python
from contextlib import contextmanager

@contextmanager
def temp_flag():
    yield
```

**En resumen:**

- Una clase sirve para estado complejo.
- `contextmanager` es cómodo para escenarios cortos.
- Ambos garantizan la limpieza.

### ¿Cómo gestiona Python la memoria?
#### Python

CPython usa conteo de referencias y un recolector cíclico de basura. Además,
tiene un asignador interno (`pymalloc`) para objetos pequeños.

**En resumen:**

- El mecanismo básico es el conteo de referencias.
- El GC elimina referencias cíclicas.
- La memoria no siempre se libera de inmediato a nivel del sistema operativo.

### ¿Qué es el conteo de referencias en Python y por qué es importante para la gestión de memoria?
#### Python

Cada objeto tiene un contador de referencias. Cuando llega a cero, el objeto
puede liberarse. Esto permite liberar rápidamente la mayoría de objetos de vida corta.

**En resumen:**

- El conteo de referencias da un ciclo de vida predecible a los objetos.
- No resuelve por sí solo las referencias cíclicas.
- Junto con el GC, forma un modelo completo de gestión de memoria.

### ¿Qué es la recolección de basura en Python?
#### Python

La recolección de basura en CPython encuentra y elimina ciclos inalcanzables de
objetos que no pueden limpiarse solo con conteo de referencias.

**En resumen:**

- El GC complementa el conteo de referencias.
- Es especialmente importante para grafos cíclicos de referencias.
- Puede controlarse mediante el módulo `gc`.

### Explique con ejemplos la diferencia entre objetos mutables e inmutables en relación con el conteo de referencias y la gestión de memoria.
#### Python

Los objetos inmutables no cambian, así que una "modificación" crea un objeto
nuevo. Los objetos mutables cambian en el lugar, y todas las referencias ven el cambio.

```python
a = "x"; b = a; a += "y"   # nuevo objeto
x = [1]; y = x; y.append(2) # cambio del mismo objeto
```

**En resumen:**

- Los inmutables reducen efectos secundarios.
- Los mutables son más eficientes para modificaciones en el lugar.
- La diferencia es crítica para copiado y referencias compartidas.

### ¿Cuál es la diferencia entre copia superficial y copia profunda en Python, y cuándo conviene usar cada enfoque?
#### Python

La copia superficial copia solo el contenedor externo; los objetos anidados
siguen siendo compartidos. La copia profunda copia recursivamente toda la estructura.

```python
import copy
copy.copy(obj)
copy.deepcopy(obj)
```

**En resumen:**

- La copia superficial es suficiente para estructuras "planas".
- La copia profunda hace falta para trabajar de forma aislada con datos mutables anidados.
- La copia profunda es más costosa en tiempo y memoria.

### ¿Cuál es la diferencia entre importación absoluta y relativa?
#### Python

La importación absoluta empieza desde la raíz del paquete (`from app.utils import x`).
La importación relativa usa puntos (`from .utils import x`).

**En resumen:**

- Las importaciones absolutas son más legibles y estables.
- Las relativas son cómodas dentro del paquete, pero peores para refactorizar.
- En proyectos grandes, conviene usar absolutas por defecto.

### ¿Cómo organizar correctamente la estructura de un proyecto Python grande?
#### Python

- dividir el código en paquetes de dominio;
- tener capas separadas: `api`, `services`, `domain`, `infrastructure`;
- separar `tests/`, `scripts/`, `configs/`;
- mantener límites claros entre módulos y una API pública explícita.

**En resumen:**

- La estructura debe reflejar el dominio, no detalles técnicos accidentales.
- Los límites claros reducen dependencias cíclicas.
- Las pruebas y las herramientas deben ser una parte de primera clase del árbol.

### ¿Cuál es la diferencia entre las pruebas automatizadas y las manuales, y cuáles son las ventajas de las pruebas automatizadas?
#### Python

Las pruebas manuales las realiza una persona paso a paso. Las pruebas automatizadas
las ejecutan scripts o marcos de pruebas.

**En resumen:**

- Las pruebas automáticas son rápidas, repetibles y aptas para CI.
- Las pruebas manuales son útiles para escenarios exploratorios de UX.
- En producción hace falta una combinación de ambos enfoques.

### ¿Qué es TDD (Test-Driven Development)?
#### Python

TDD es un ciclo: escribir una prueba que falla -> implementación mínima -> refactorización.

**En resumen:**

- TDD moldea la API a través de pruebas.
- Da retroalimentación rápida sobre regresiones.
- Funciona mejor para lógica de negocio modular.

### ¿Cuál es la diferencia entre `setUp()` y `setUpClass()` en unittest?
#### Python

`setUp()` se ejecuta antes de **cada** método de prueba. `setUpClass()`
(classmethod) se ejecuta **una vez** antes de todas las pruebas de la clase.

**En resumen:**

- `setUp` sirve para el aislamiento por prueba.
- `setUpClass` sirve para recursos compartidos costosos.
- Demasiado estado compartido vía `setUpClass` puede complicar las pruebas.

### ¿Cuál es la diferencia entre usar `mock.patch` en unittest y `monkeypatch` en pytest para mockear objetos?
#### Python

`mock.patch` de `unittest.mock` parchea objetos por ruta de importación y tiene
una API completa para verificar llamadas. `monkeypatch` en pytest cambia de forma
más simple atributos, variables de entorno o diccionarios durante la prueba.

**En resumen:**

- `patch` es más potente para escenarios con aserciones sobre mocks.
- `monkeypatch` es cómodo para sustituciones rápidas en pruebas.
- A menudo se combinan según el caso.

### ¿Cómo funciona `lru_cache` y cuándo conviene usarlo?
#### Python

`functools.lru_cache` guarda en caché los resultados de una función según sus
argumentos y devuelve el valor ya preparado en llamadas repetidas.

**En resumen:**

- Es eficaz para funciones puras con entradas repetidas.
- No encaja en funciones con efectos secundarios.
- `maxsize` controla el tamaño de la caché en memoria.

### ¿Cómo perfilar el rendimiento de código Python?
#### Python

Herramientas básicas:

- `timeit` para micro-mediciones;
- `cProfile`/`pstats` para perfiles a nivel de llamadas;
- `py-spy`/`scalene` para análisis más cercanos a producción.

**En resumen:**

- Optimiza solo después de medir.
- Perfila escenarios de carga realistas.
- Fija una línea base antes y después de los cambios.

### ¿Cuándo conviene usar extensiones en C o PyPy?
#### Python

Las extensiones en C son adecuadas para puntos críticos de CPU muy concretos y
para integrarse con bibliotecas nativas. PyPy conviene cuando código Python
puro de larga duración se beneficia del JIT.

**En resumen:**

- Extensión en C: máximo rendimiento a costa de mayor complejidad de compilación.
- PyPy: mejora potencial sin reescribir en C.
- La elección debe basarse en pruebas comparativas de tu carga real.

### ¿Qué es el GIL (Global Interpreter Lock)?
#### Python

El GIL es un mecanismo de CPython que permite que solo un hilo ejecute
bytecode de Python al mismo tiempo dentro de un proceso.

**En resumen:**

- El GIL afecta al multihilo en tareas intensivas de CPU.
- Para tareas limitadas por I/O, los hilos siguen siendo útiles.
- Para paralelismo de CPU, suele usarse `multiprocessing`.

### ¿Cómo afecta el GIL a la concurrencia en CPython y qué consecuencias tiene para el multithreading?
#### Python

Debido al GIL, los hilos en CPython no ejecutan bytecode de Python en paralelo
real para código intensivo de CPU. Se alternan de forma cooperativa.

Consecuencias:

- para hilos limitados por I/O, el efecto es bueno porque la espera de I/O se solapa;
- para tareas intensivas de CPU, la mejora con hilos suele ser limitada.

**En resumen:**

- El GIL limita el paralelismo de hilos en escenarios intensivos de CPU.
- Los hilos siguen siendo útiles para red y disco.
- Para CPU, usa procesos o cómputo nativo.

### ¿Cómo afecta el GIL al rendimiento?
#### Python

El GIL casi no molesta en tareas limitadas por I/O, pero limita la capacidad de procesamiento de código
Python multihilo intensivo de CPU dentro de un proceso.

**En resumen:**

- El impacto del GIL depende del tipo de carga.
- El código intensivo de CPU con hilos en CPython a menudo no escala.
- La arquitectura debe elegirse según el perfil de tareas.

### Explique el concepto de threading en Python y en qué se diferencia de multiprocessing.
#### Python

`threading` ejecuta varios hilos dentro de un proceso con memoria compartida.
`multiprocessing` ejecuta procesos separados con memoria separada.

**En resumen:**

- Los hilos son más ligeros y cómodos para tareas limitadas por I/O.
- Los procesos dan paralelismo real de CPU.
- Los procesos tienen más sobrecarga de IPC y creación.

### ¿Cuál es la diferencia entre concurrencia y paralelismo y cuándo conviene usar cada uno?
#### Python

La concurrencia es el solapamiento de tareas en el tiempo. El paralelismo es la
ejecución física simultánea de tareas en varios núcleos.

**En resumen:**

- La concurrencia es útil para latencias de I/O.
- El paralelismo es necesario para cálculos intensivos de CPU.
- En Python, la herramienta depende del tipo de cuello de botella.

### ¿Cuál es la diferencia entre tareas limitadas por I/O y tareas intensivas de CPU?
#### Python

Las tareas limitadas por I/O esperan sobre todo red, disco o base de datos. Las tareas
intensivas de CPU gastan sobre todo tiempo en cálculo del procesador.

**En resumen:**

- Las tareas limitadas por I/O escalan bien con asyncio o hilos.
- Las tareas intensivas de CPU escalan mejor con multiprocessing o código nativo.
- Primero identifica el cuello de botella con perfilado.

### ¿Para qué sirve el módulo `asyncio` en Python y cómo permite implementar programación asíncrona?
#### Python

`asyncio` proporciona un bucle de eventos, planificación de tareas y primitivas asíncronas
para concurrencia cooperativa en tareas limitadas por I/O.

**En resumen:**

- Permite atender muchas operaciones de I/O de forma eficiente.
- Se basa en `async` y `await`.
- Encaja bien en servicios y clientes de red.

### ¿En qué se diferencian la programación síncrona y la asíncrona en Python?
#### Python

Síncrono: una llamada bloquea el hilo actual hasta completarse. Asíncrono:
`await` cede el control al bucle de eventos mientras la operación espera I/O.

**En resumen:**

- La asincronía reduce el tiempo ocioso durante I/O.
- El modelo síncrono es más simple para lógica lineal.
- La asincronía añade complejidad en gestión de tareas y cancelación.

### ¿Qué son `async` y `await`?
#### Python

`async def` define una corrutina. `await` pausa la corrutina hasta que
el objeto esperable esté listo y devuelve el control al bucle.

**En resumen:**

- Es la sintaxis de un modelo asíncrono cooperativo.
- Se usa junto con `asyncio` y bibliotecas asíncronas.
- `await` solo es válido dentro de `async def`.

### ¿Cómo funciona `asyncio`?
#### Python

`asyncio` ejecuta un bucle de eventos que procesa tareas (corrutinas), cambiando en
los puntos `await` y planificando operaciones I/O listas.

**Regla crítica:** El bucle de eventos funciona en un solo hilo. Cualquier operación
bloqueante (`time.sleep()`, peticiones síncronas con `requests`, cálculos
pesados) detiene **todo** el ciclo y todas las demás tareas.

**En resumen:**

- Un hilo puede atender muchas tareas I/O gracias a la cooperación.
- La planificación no expulsa tareas de forma preventiva.
- Las llamadas bloqueantes destruyen el rendimiento de `asyncio`.

### ¿Qué es el bucle de eventos?
#### Python

El bucle de eventos es un planificador que sigue eventos o disponibilidad de I/O y
ejecuta las devoluciones de llamada o corrutinas correspondientes.

**En resumen:**

- Es el componente central del modelo de `asyncio`.
- Gestiona el ciclo de vida de las tareas asíncronas.
- Determina cuándo cada corrutina continúa ejecutándose.

### ¿Cómo permite `asyncio` implementar programación asíncrona y qué componentes principales intervienen en código asyncio?
#### Python

Componentes clave:

- bucle de eventos;
- corrutina (`async def`);
- tarea (`asyncio.create_task`);
- objetos esperables (futures, tareas, corrutinas);
- primitivas de sincronización (`Lock`, `Queue`, `Semaphore`).

**En resumen:**

- `asyncio` combina planificación y API asíncrona en un solo modelo.
- Las tareas comparten un hilo de ejecución de forma cooperativa.
- La arquitectura debe tener en cuenta tiempos de espera, reintentos y cancelación.

### ¿Cuándo `asyncio` no aporta ventajas?
#### Python

Cuando la carga es intensiva de CPU o las bibliotecas principales son bloqueantes y no
tienen API asíncrona. Tampoco compensa en scripts simples y cortos.

**Solución para código bloqueante:** Si necesitas usar una biblioteca bloqueante
en un entorno asíncrono, usa `loop.run_in_executor(None, sync_func)`, que la
ejecutará en un hilo aparte sin bloquear el bucle de eventos.

**En resumen:**

- La asincronía no acelera cálculos puros.
- Sin bibliotecas I/O no bloqueantes, la ganancia es mínima.
- `run_in_executor` ayuda a integrar código heredado o síncrono.
- La complejidad asíncrona debe justificarse por la carga.

### ¿Cómo funciona la cancelación en asyncio?
#### Python

La cancelación de una tarea (`task.cancel()`) lanza `CancelledError` dentro de
la corrutina. El código debe manejar correctamente la limpieza en `try/finally`.

**En resumen:**

- La cancelación es un flujo de control normal en código asíncrono.
- Hay que diseñar las corrutinas teniendo en cuenta la cancelación.
- Ignorar la cancelación lleva a tareas colgadas.

### ¿Qué es `contextvars`?
#### Python

`contextvars` proporciona variables locales al contexto, seguras para
escenarios asíncronos e hilos. Es útil para identificador de solicitud,
identificador de correlación y contexto de inquilino.

**En resumen:**

- Es una alternativa al estado global en código concurrente.
- El valor queda aislado por contexto.
- Mejora el trazado y la observabilidad.
