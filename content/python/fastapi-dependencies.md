---
stack: python
id: fastapi-dependencies
title: "FastAPI: dependency injection, auth y middleware"
area: Backend
priority: high
resourceLabel: FastAPI, Dependencies
resourceUrl: https://fastapi.tiangolo.com/tutorial/dependencies/
---

## Summary

FastAPI resuelve dependencias automáticamente en cada request, lo que permite inyectar sesiones de base de datos, contexto de autenticación y configuración sin acoplar la lógica de negocio a los detalles de infraestructura.

## Concepts

### Dependency Injection con `Depends`

#### Details

`Depends` es el mecanismo central de DI en FastAPI. Declarás una función (la dependencia) y la referenciás con `Depends(fn)` en la firma de la path operation. FastAPI resuelve el grafo de dependencias antes de ejecutar la función: llama a cada dependencia en el orden correcto, con sus propias sub-dependencias si las tienen, y les pasa el resultado como argumento.

El beneficio más importante no es la conveniencia sino la testabilidad. Cuando una path operation declara su sesión de DB como `db: Session = Depends(get_db)`, en tests podés sobreescribir esa dependencia con `app.dependency_overrides[get_db] = get_test_db` sin tocar nada del código de producción. Esto hace que los tests de integración corran contra una DB de test sin mocks, de forma limpia.

Las dependencias pueden retornar cualquier valor, una conexión, un objeto de configuración, el usuario autenticado, y pueden ser funciones, callables, o clases. FastAPI cachea los resultados de una dependencia por request por defecto: si dos path operations en el mismo request usan la misma dependencia, la función se llama solo una vez.

#### Examples

Dependencia simple que extrae y valida un token

```python
from fastapi import Depends, FastAPI, HTTPException, Header

app = FastAPI()

async def get_api_key(x_api_key: str = Header(...)):
    if x_api_key != "secret-key":
        raise HTTPException(status_code=403, detail="Invalid API key")
    return x_api_key

@app.get("/protected")
async def protected_route(api_key: str = Depends(get_api_key)):
    return {"message": "Access granted"}
```

Sub-dependencias (dependencia que depende de otra)

```python
from fastapi import Depends

async def get_settings():
    return {"db_url": "postgresql://localhost/app"}

async def get_db_pool(settings: dict = Depends(get_settings)):
    pool = await create_pool(settings["db_url"])
    return pool

@app.get("/items")
async def list_items(pool=Depends(get_db_pool)):
    return await pool.fetch("SELECT * FROM items")
```

Dependency override en tests

```python
from fastapi.testclient import TestClient

def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)
```

#### Sources

- [FastAPI, Dependencies](https://fastapi.tiangolo.com/tutorial/dependencies/)
- [FastAPI, Dependencies in path operation decorators](https://fastapi.tiangolo.com/tutorial/dependencies/dependencies-in-path-operation-decorators/)

---

### Dependencias con `yield`: setup y teardown por request

#### Details

Cuando una dependencia necesita limpiar recursos después de que la path operation termine (cerrar una conexión de DB, hacer rollback si hubo error, liberar un lock), usás `yield` en vez de `return`. El código antes del `yield` corre antes de la operación; el código después corre en el teardown, después de que la respuesta fue enviada al cliente.

FastAPI maneja el ciclo de vida correctamente incluso si la path operation lanza una excepción: el bloque `finally` en la dependencia siempre se ejecuta. Esto garantiza que nunca se quede una sesión de DB abierta aunque el handler haya fallado. Es el patrón idiomático para sesiones de SQLAlchemy: abrís la sesión, la cedés al handler, y la cerrás en el finally.

Las dependencias con `yield` pueden encadenarse igual que las normales. Si una sub-dependencia también usa `yield`, FastAPI las deshace en orden inverso: primero se hace teardown de las dependencias más externas. Esto modela correctamente relaciones como "la sesión de DB pertenece a una transacción".

#### Examples

Sesión de SQLAlchemy como dependencia con yield

```python
from sqlalchemy.orm import Session
from fastapi import Depends
from .database import SessionLocal

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/users/{user_id}")
def read_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
```

Dependencia con manejo de transacción explícita

```python
from sqlalchemy.orm import Session

def get_db_transaction():
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
```

#### Sources

- [FastAPI, Dependencies with yield](https://fastapi.tiangolo.com/tutorial/dependencies/dependencies-with-yield/)

---

### Autenticación con dependencias: OAuth2 y JWT

#### Details

FastAPI provee esquemas de seguridad como `OAuth2PasswordBearer` que son dependencias que extraen el token del header `Authorization: Bearer <token>`. La dependencia retorna el token crudo; vos escribís otra dependencia encima que lo valida (verificá la firma JWT, extraé el subject, cargá el usuario desde la DB) y retorna el usuario autenticado. Las path operations que requieren auth declaran `current_user = Depends(get_current_user)`.

`Security` es una variante de `Depends` que también registra el esquema de seguridad en el esquema OpenAPI, lo que hace que la UI de Swagger muestre el botón "Authorize" y permita enviar el token desde la documentación interactiva. Funcionalmente es igual a `Depends` para la inyección, pero agrega metadatos al esquema.

Para RBAC (role-based access control), el patrón común es crear dependencias parametrizadas: una función que recibe los roles requeridos y retorna otra función que verifica si el usuario tiene esos roles. Esto permite declarar `Depends(require_roles(["admin"]))` directamente en la firma, manteniendo el control de acceso cerca de la definición del endpoint.

#### Examples

Extracción y validación de JWT como dependencia

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

SECRET_KEY = "your-secret-key"
ALGORITHM = "HS256"

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = get_user_from_db(user_id)
    if user is None:
        raise credentials_exception
    return user
```

Dependencia parametrizada para RBAC

```python
from fastapi import Depends, HTTPException

def require_roles(required_roles: list[str]):
    async def role_checker(current_user=Depends(get_current_user)):
        for role in required_roles:
            if role not in current_user.roles:
                raise HTTPException(status_code=403, detail="Forbidden")
        return current_user
    return role_checker

@app.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user=Depends(require_roles(["admin"])),
):
    return delete_from_db(user_id)
```

#### Sources

- [FastAPI, Security, OAuth2 with JWT](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/)
- [FastAPI, Security, First Steps](https://fastapi.tiangolo.com/tutorial/security/first-steps/)

---

### Middleware: cross-cutting concerns a nivel de aplicación

#### Details

Los middlewares en FastAPI (Starlette) interceptan todos los requests y responses de la aplicación, independientemente de la path operation. Se registran con `@app.middleware("http")` o con `app.add_middleware(...)`. Cada middleware recibe el `request` y un callable `call_next` que ejecuta el resto de la cadena (incluida la path operation); el middleware puede modificar el request antes, la response después, o ambas.

El caso de uso canónico del middleware es el comportamiento verdaderamente transversal: CORS, compresión, logging de latencia, X-Request-ID, rate limiting. La diferencia clave con las dependencias es el scope: el middleware aplica a TODOS los endpoints sin excepción, mientras que una dependencia se declara explícitamente en cada endpoint o router. Si necesitás algo que aplique al 90% de los endpoints pero no a todos (por ejemplo, autenticación que no aplica al endpoint de health check o login), una dependencia en un router es la herramienta correcta, no el middleware.

Un error frecuente es poner lógica de negocio en el middleware. El middleware no tiene acceso a los modelos Pydantic ni al resultado de `Depends`, solo ve el request/response crudos de Starlette. Para cualquier cosa que dependa del contexto de la operación (usuario autenticado, body validado), usás dependencias.

#### Examples

Middleware de logging con latencia

```python
import time
from fastapi import FastAPI, Request

app = FastAPI()

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    print(f"{request.method} {request.url.path}, {response.status_code} ({duration_ms:.1f}ms)")
    return response
```

CORS con CORSMiddleware de Starlette

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://app.example.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

#### Sources

- [FastAPI, Middleware](https://fastapi.tiangolo.com/tutorial/middleware/)
- [FastAPI, CORS](https://fastapi.tiangolo.com/tutorial/cors/)

---

### Background Tasks vs colas distribuidas

#### Details

`BackgroundTasks` permite ejecutar funciones después de que la respuesta HTTP fue enviada al cliente, en el mismo proceso de FastAPI. El caso de uso ideal es trabajo ligero, no crítico y de bajo volumen: enviar un email de bienvenida, registrar un evento de analytics, invalidar una cache. La ventaja es la simplicidad: no hay infraestructura adicional, la tarea tiene acceso al mismo contexto del request.

Las limitaciones son importantes: si el proceso FastAPI muere mientras la tarea corre, la tarea se pierde. No hay reintentos automáticos, no hay visibilidad del estado, no hay distribución entre workers. Para trabajo que debe completarse garantizadamente, procesamiento de pagos, generación de reportes grandes, envío de emails transaccionales críticos, necesitás una cola distribuida como Celery con Redis o RabbitMQ, o una solución más moderna como ARQ o Dramatiq.

El criterio de decisión es la durabilidad: si la pérdida de la tarea es aceptable (logging, analytics, cache warming), `BackgroundTasks` es suficiente. Si la pérdida de la tarea es un bug de negocio (el usuario pagó pero no recibió confirmación), usás una cola con persistencia y reintentos. Un error de diseño frecuente es usar `BackgroundTasks` para operaciones que deberían ser transaccionales.

#### Examples

Background task simple para envío de email

```python
from fastapi import BackgroundTasks, FastAPI

def send_welcome_email(email: str, username: str):
    # I/O bloqueante está bien aquí; corre en thread separado
    email_client.send(to=email, subject=f"Welcome, {username}!")

@app.post("/users/", status_code=201)
async def create_user(
    user: UserCreate,
    background_tasks: BackgroundTasks,
):
    db_user = save_to_db(user)
    background_tasks.add_task(send_welcome_email, user.email, user.username)
    return db_user
```

Background task con dependencias inyectadas

```python
from fastapi import BackgroundTasks, Depends

def process_report(report_id: int, db: Session):
    # Usa la misma sesión de DB del request o una nueva
    generate_and_save_report(db, report_id)

@app.post("/reports/{report_id}/generate")
async def trigger_report(
    report_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    background_tasks.add_task(process_report, report_id, db)
    return {"status": "queued", "report_id": report_id}
```

#### Sources

- [FastAPI, Background Tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/)

---

## Interview Questions

### ¿Cómo mejora la testabilidad de una API el uso de `Depends` versus importar las dependencias directamente?

Cuando una path operation importa directamente su sesión de DB o su cliente HTTP, no hay forma de sustituirlos en tests sin monkey-patching o mocks complejos. Con `Depends`, el grafo de dependencias es explícito y FastAPI provee `app.dependency_overrides`: en tests reemplazás `get_db` por `get_test_db` en una línea, sin tocar el código de producción. Las path operations ni saben que están siendo testeadas contra una DB diferente. Esto es DI real: el código declara lo que necesita, el framework lo resuelve, y en tests lo sustituís limpiamente.

---

### ¿Por qué una dependencia con `yield` es la forma correcta de manejar sesiones de DB en FastAPI?

Porque garantiza que la sesión se cierra aunque el handler lance una excepción. Si abrís la sesión al inicio de la función y la cerrás al final con `db.close()`, una excepción no manejada saltea esa línea y dejás la conexión abierta. Con `yield`, el código de teardown en el bloque `finally` siempre corre, independientemente de si la operación fue exitosa o falló. Además, el ciclo de vida de la sesión está encapsulado en la dependencia: la path operation solo usa `db`, no sabe cómo se creó ni cómo se destruye.

---

### ¿Cuándo usarías middleware versus una dependencia para autenticación?

Si necesitás autenticar todos los endpoints sin excepción (incluyendo health checks, si el servicio es interno), un middleware puede tener sentido. Pero en la práctica, la autenticación tiene excepciones: el endpoint de login, los endpoints públicos, el endpoint de health check. Con middleware, para excluirlos necesitás lógica condicional dentro del middleware mismo, lo que lo vuelve frágil. Con dependencias, declarás `Depends(get_current_user)` en cada router o endpoint que necesita auth, y los endpoints públicos simplemente no la declaran. Es más explícito, más fácil de razonar, y más fácil de testear.

---

### ¿Cuáles son los tradeoffs reales entre `BackgroundTasks` de FastAPI y Celery para procesar tareas asíncronas?

`BackgroundTasks` es simple y sin dependencias externas, pero no tiene durabilidad: si el proceso muere, la tarea se pierde. No hay reintentos, no hay visibilidad del estado, no hay distribución entre múltiples workers. Celery persiste las tareas en Redis o RabbitMQ, tiene reintentos configurables, resultados almacenados, y puede escalar los workers independientemente del proceso HTTP. El costo es infraestructura adicional y complejidad operacional. Mi criterio: si la pérdida de la tarea es aceptable (cache warm-up, logging no crítico), `BackgroundTasks` es suficiente. Si es una tarea de negocio con consecuencias si se pierde (confirmación de pago, generación de factura), necesitás Celery u otra cola con persistencia.

---

### ¿Cómo diseñarías el sistema de autenticación de una API FastAPI con múltiples roles?

Usaría OAuth2 con JWT como capa de transporte. La dependencia `get_current_user` valida el token y retorna el usuario con sus roles. Encima de eso, una función factory `require_roles(["admin", "editor"])` retorna una dependencia que verifica si el usuario tiene al menos uno de los roles requeridos. Los routers o endpoints declaran esa dependencia directamente. En tests, overrideo `get_current_user` para devolver un usuario con los roles que necesito testear. Así el sistema de roles es transparente para el código de negocio y testeable sin emitir tokens reales.

---

### ¿Qué problema resuelve `Security` vs `Depends` y cuándo importa la diferencia?

Funcionalmente son equivalentes para la inyección en sí. La diferencia es que `Security` registra el esquema de seguridad (OAuth2, API key, etc.) en el esquema OpenAPI del endpoint. Eso hace que Swagger muestre el candado en ese endpoint y permita autenticarse desde la UI interactiva. Si exposo la API a consumidores externos o a un equipo de frontend que usa la documentación para explorar la API, `Security` mejora significativamente la experiencia. En servicios internos donde la documentación interactiva no se usa, la diferencia es cosmética.
