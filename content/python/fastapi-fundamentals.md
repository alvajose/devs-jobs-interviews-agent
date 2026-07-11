---
stack: python
id: fastapi-fundamentals
title: "FastAPI: routing, Pydantic y validación"
area: Backend
priority: high
resourceLabel: FastAPI, Tutorial
resourceUrl: https://fastapi.tiangolo.com/tutorial/
---

## Summary

FastAPI convierte type hints de Python en validación automática, serialización y documentación OpenAPI, eliminando código boilerplate sin sacrificar corrección.

## Concepts

### Path, query y body parameters

#### Details

FastAPI infiere el origen de cada parámetro por su posición en la firma de la función. Si el nombre coincide con un segmento del path (`{item_id}`), es un path parameter. Si es un tipo primitivo sin cuerpo, es query. Si es un `BaseModel` de Pydantic, FastAPI lo extrae del body JSON automáticamente.

Este diseño hace que la función sea testeable como cualquier función Python pura: pasás los valores directamente sin mockear un objeto `request`. La declaración de tipos no es solo documentación; es el contrato que FastAPI ejecuta en cada request.

Para parámetros query opcionales usás `Optional[str] = None` o el valor default directamente. Para query params con validación usás `Query(...)` con `min_length`, `regex`, etc. El mismo patrón aplica a path params con `Path(...)` y a campos de body con `Field(...)`.

#### Examples

Path parameter con validación de tipo

```python
from fastapi import FastAPI, Path

app = FastAPI()

@app.get("/items/{item_id}")
async def get_item(item_id: int = Path(..., ge=1, title="Item ID")):
    return {"item_id": item_id}
```

Query parameters opcionales y obligatorios

```python
from typing import Optional
from fastapi import FastAPI, Query

@app.get("/search")
async def search(
    q: str = Query(..., min_length=3, description="Search term"),
    skip: int = 0,
    limit: Optional[int] = Query(None, le=100),
):
    return {"q": q, "skip": skip, "limit": limit}
```

Body parameter con modelo Pydantic

```python
from pydantic import BaseModel

class ItemCreate(BaseModel):
    name: str
    price: float
    in_stock: bool = True

@app.post("/items/")
async def create_item(item: ItemCreate):
    return {"name": item.name, "price": item.price}
```

#### Sources

- [Path Parameters](https://fastapi.tiangolo.com/tutorial/path-params/)
- [Query Parameters](https://fastapi.tiangolo.com/tutorial/query-params/)
- [Request Body](https://fastapi.tiangolo.com/tutorial/body/)

---

### Pydantic v2: modelos, validación declarativa y errores 422

#### Details

Pydantic v2 usa un core escrito en Rust, lo que lo hace significativamente más rápido que v1. El modelo mental central es: declarás la forma de los datos una sola vez con type hints y anotaciones, y Pydantic se encarga de parsear, coercionar y validar. Si los datos no pasan, levanta una `ValidationError` con todos los errores juntos (no solo el primero), lo que FastAPI convierte automáticamente en una respuesta HTTP 422 con detalles por campo.

Los validadores en v2 se definen con `@field_validator` y `@model_validator`. El decorador `@field_validator` recibe el valor ya casteado al tipo correcto; `@model_validator` recibe el modelo completo y sirve para validaciones cruzadas entre campos (por ejemplo, que `end_date > start_date`). Ambos operan en el momento de construcción, no en un paso separado.

Un aspecto crítico de Pydantic v2 es la distinción entre `model_validate` (acepta dict o ORM instance) y la construcción directa `Model(**data)`. Para datos que vienen de una ORM como SQLAlchemy, necesitás `model_config = ConfigDict(from_attributes=True)` para que Pydantic lea atributos en vez de claves de diccionario.

#### Examples

Modelo con validaciones declarativas

```python
from pydantic import BaseModel, field_validator, EmailStr
from datetime import date

class UserCreate(BaseModel):
    email: EmailStr
    username: str
    birth_date: date

    @field_validator("username")
    @classmethod
    def username_alphanumeric(cls, v: str) -> str:
        if not v.isalnum():
            raise ValueError("Username must be alphanumeric")
        return v.lower()
```

Validación cruzada entre campos con model_validator

```python
from pydantic import BaseModel, model_validator
from datetime import date
from typing import Self

class DateRange(BaseModel):
    start: date
    end: date

    @model_validator(mode="after")
    def check_range(self) -> Self:
        if self.end <= self.start:
            raise ValueError("end must be after start")
        return self
```

Modelo con configuración para ORM (from_attributes)

```python
from pydantic import BaseModel, ConfigDict

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    username: str
```

#### Sources

- [Pydantic v2, Models](https://docs.pydantic.dev/latest/concepts/models/)
- [Pydantic v2, Validators](https://docs.pydantic.dev/latest/concepts/validators/)
- [FastAPI, Request Body](https://fastapi.tiangolo.com/tutorial/body/)

---

### response_model: separar modelos de entrada y salida

#### Details

`response_model` le dice a FastAPI qué forma tiene la respuesta HTTP. FastAPI instancia el modelo con los datos retornados por la función y serializa solo los campos declarados, filtrando cualquier dato extra. Esto es fundamental para no filtrar campos sensibles: si tu ORM retorna un objeto `User` con campo `hashed_password`, y tu `UserResponse` no lo declara, ese campo nunca llega al cliente.

El patrón idiomático es tener al menos dos modelos por entidad: uno de entrada (`UserCreate`) y uno de salida (`UserResponse`). A veces se agrega un tercero (`UserInDB`) que representa la entidad completa internamente. Esta separación hace explícito el contrato con el cliente y protege contra exposición accidental de campos internos.

`response_model_exclude_unset=True` es útil en operaciones PATCH: filtra los campos que no fueron seteados explícitamente en el modelo de respuesta, evitando que valores default llenen campos que el cliente no pidió actualizar. `response_model_exclude` y `response_model_include` permiten ajuste ad-hoc sin crear un nuevo modelo.

#### Examples

Modelos separados de entrada y salida

```python
from fastapi import FastAPI
from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    username: str

class UserResponse(BaseModel):
    id: int
    email: str
    username: str

    model_config = {"from_attributes": True}

@app.post("/users/", response_model=UserResponse, status_code=201)
async def create_user(user: UserCreate):
    # hashed_password nunca llega al cliente por response_model
    db_user = save_user_to_db(user)
    return db_user
```

response_model_exclude_unset en PATCH

```python
class UserUpdate(BaseModel):
    email: str | None = None
    username: str | None = None

@app.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    updates: UserUpdate,
):
    stored_user = get_user(user_id)
    update_data = updates.model_dump(exclude_unset=True)
    updated = stored_user.model_copy(update=update_data)
    return save(updated)
```

#### Sources

- [FastAPI, Response Model](https://fastapi.tiangolo.com/tutorial/response-model/)
- [FastAPI, Extra Models](https://fastapi.tiangolo.com/tutorial/extra-models/)

---

### async def vs def: cuándo usar cada uno

#### Details

FastAPI corre sobre Starlette, que usa un event loop de asyncio. Cuando declarás una path operation como `async def`, la función corre directamente en el event loop: si hacés una operación bloqueante ahí (I/O síncrono, `time.sleep`, acceso a archivos con `open()`), bloqueás el loop entero y todas las requests en vuelo se detienen. Para I/O asíncrono (bases de datos async, `httpx.AsyncClient`, `aiofiles`) siempre usás `async def`.

Cuando declarás la función como `def` (sin `async`), FastAPI la corre automáticamente en un threadpool usando `asyncio.run_in_executor`. Esto es correcto para llamadas síncronas bloqueantes: ORMs síncronos como SQLAlchemy clásico, librerías que no tienen API async, o código de CPU intensivo. El threadpool tiene un límite (por defecto el de `concurrent.futures.ThreadPoolExecutor`), así que no es gratis; es solo mejor que bloquear el event loop.

El error más frecuente es mezclar: hacer una path operation `async def` y dentro llamar a código sincrónico bloqueante. FastAPI no puede detectar esto en runtime; solo vas a ver latencia degradada bajo carga. La regla práctica: si usás `await` alguna vez dentro de la función, es `async def`; si todo el I/O es síncrono, es `def` para que FastAPI lo delegue al threadpool.

#### Examples

async def con cliente HTTP asíncrono

```python
import httpx
from fastapi import FastAPI

@app.get("/proxy/{item_id}")
async def proxy_item(item_id: int):
    async with httpx.AsyncClient() as client:
        response = await client.get(f"https://api.example.com/items/{item_id}")
    return response.json()
```

def para código síncrono bloqueante (FastAPI lo pone en threadpool)

```python
import time
from fastapi import FastAPI

@app.get("/report/{report_id}")
def generate_report(report_id: int):
    # CPU-bound o I/O síncrono: FastAPI usa threadpool
    result = run_synchronous_heavy_computation(report_id)
    return {"result": result}
```

#### Sources

- [FastAPI, Async](https://fastapi.tiangolo.com/async/)
- [FastAPI, Concurrency and async / await](https://fastapi.tiangolo.com/async/#very-technical-details)

---

### OpenAPI y documentación autogenerada

#### Details

FastAPI genera un esquema OpenAPI 3.x en `/openapi.json` automáticamente a partir de los type hints, modelos Pydantic y metadatos de los decoradores. Esto no es solo conveniencia: el esquema es la fuente de verdad del contrato de la API, lo que hace posible generar clientes tipados, validar contratos entre servicios y mantener documentación siempre sincronizada con el código.

La UI interactiva de Swagger está en `/docs` y ReDoc en `/redoc`. Podés enriquecer el esquema con `description` en `FastAPI()`, `tags` en los routers, `summary` y `description` en cada operación, y `example` en los modelos Pydantic usando `model_config` con `json_schema_extra`. En producción es común deshabilitar `/docs` y `/redoc` seteando `docs_url=None, redoc_url=None` en el constructor de `FastAPI`.

Los `APIRouter` te permiten organizar rutas en módulos separados con prefijos y tags propios, y luego registrarlos en la app principal con `app.include_router(...)`. Esto es el equivalente de los Blueprints de Flask o los módulos de NestJS: mantener la app escalable sin acumular todo en un solo archivo.

#### Examples

Configuración del esquema con metadata y tags

```python
from fastapi import FastAPI

app = FastAPI(
    title="Inventory API",
    description="Manages product inventory.",
    version="1.0.0",
    docs_url="/docs",       # None para deshabilitar en prod
    redoc_url="/redoc",
)
```

Organización con APIRouter

```python
from fastapi import APIRouter, FastAPI

router = APIRouter(prefix="/items", tags=["items"])

@router.get("/{item_id}")
async def read_item(item_id: int):
    return {"item_id": item_id}

app = FastAPI()
app.include_router(router)
```

Ejemplo en modelo Pydantic para OpenAPI

```python
from pydantic import BaseModel

class ItemCreate(BaseModel):
    name: str
    price: float

    model_config = {
        "json_schema_extra": {
            "examples": [{"name": "Widget", "price": 9.99}]
        }
    }
```

#### Sources

- [FastAPI, OpenAPI](https://fastapi.tiangolo.com/tutorial/metadata/)
- [FastAPI, Bigger Applications](https://fastapi.tiangolo.com/tutorial/bigger-applications/)

---

## Interview Questions

### ¿Por qué Pydantic da validación "gratis" y qué diferencia hay con validar manualmente en Flask?

Con Pydantic declarás el esquema una sola vez como type hints y obtenés parseo, coerción, validación y serialización sin escribir ningún código imperativo. En Flask tenés que escribir esa lógica explícitamente o depender de una librería como Marshmallow que tiene su propio DSL. La ventaja real no es la brevedad: es que el contrato está en el mismo lugar que el código, el IDE lo entiende, y los errores incluyen la ubicación exacta del campo inválido. Cuando el schema evoluciona, solo cambiás el modelo; no hay sincronización manual entre validación y documentación.

---

### ¿Cuándo usarías `async def` y cuándo `def` en una path operation de FastAPI?

Uso `async def` cuando toda la I/O que ejecuta esa operación tiene API asíncrona: bases de datos con drivers async (asyncpg, Motor), HTTP clients como `httpx.AsyncClient`, o cualquier cosa que soporte `await`. Uso `def` cuando trabajo con código síncrónico que no puedo cambiar, un ORM síncrono, una librería legacy, o cómputo CPU-bound, para que FastAPI lo delegue al threadpool y no bloquee el event loop. El error más caro es hacer `async def` y adentro llamar algo bloqueante: el loop se congela para todos los requests concurrentes.

---

### ¿Por qué separarías el modelo de entrada (`UserCreate`) del modelo de respuesta (`UserResponse`)?

Son contratos distintos con audiencias distintas. El modelo de entrada define qué acepta la API del cliente, incluyendo campos como `password` que nunca deberían salir. El modelo de respuesta define qué expone la API hacia afuera. Mezclarlos lleva a filtración accidental de campos sensibles o a exponer estructura interna que no debería ser parte del contrato público. Además, los modelos de respuesta suelen tener campos generados (como `id` o `created_at`) que no tienen sentido en la creación. La separación hace explícito el contrato y protege por defecto.

---

### ¿Qué pasa exactamente cuando FastAPI recibe un request con body malformado o con tipos incorrectos?

FastAPI delega la validación a Pydantic. Si `item_id` en el path debería ser `int` y llega `"abc"`, o si el body tiene un campo `price: float` y llega `"not-a-number"`, Pydantic levanta una `ValidationError` con todos los errores del request juntos. FastAPI intercepta esa excepción y devuelve automáticamente un HTTP 422 Unprocessable Entity con un JSON que describe cada error: el campo, la ubicación (body/query/path), y el mensaje. No tenés que escribir ningún handler para esto; es el comportamiento por defecto.

---

### ¿Cómo organizarías una API FastAPI que crece a 20+ endpoints en varios dominios?

Usaría `APIRouter` por dominio o feature: un router para `users`, otro para `items`, otro para `orders`. Cada router vive en su propio módulo con sus modelos, sus dependencias y sus tests. La app principal solo registra los routers con `app.include_router(...)`, prefijos y tags. Eso mantiene cohesión por dominio sin que ningún archivo crezca sin control. Si el proyecto escala más, el mismo patrón aplica a nivel de paquetes: cada dominio es un subpaquete con su propio `router.py`.

---

### ¿Qué ventajas concretas da el esquema OpenAPI autogenerado de FastAPI más allá de la documentación visual?

El esquema JSON en `/openapi.json` es la fuente de verdad del contrato. Podés usarlo para generar clientes tipados en TypeScript o Kotlin con herramientas como `openapi-generator`. En pipelines de CI, podés comparar el esquema del PR contra el esquema de `main` para detectar cambios de contrato rompedores antes de hacer deploy. En arquitecturas de microservicios podés validar que el consumidor y el productor están de acuerdo en el contrato sin correr ambos servicios juntos. La documentación interactiva es solo el caso de uso más visible, pero el valor de fondo es el contrato ejecutable y versionable.
