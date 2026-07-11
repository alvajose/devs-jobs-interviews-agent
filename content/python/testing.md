---
stack: python
id: python-testing
title: "Python: testing con pytest"
area: Testing
priority: high
resourceLabel: pytest, Documentation
resourceUrl: https://docs.pytest.org/en/stable/
---

## Summary
Cómo estructurar tests mantenibles con pytest: fixtures, parametrización, mocking selectivo y testing de APIs FastAPI con una base de datos aislada.

## Concepts

### Fixtures y su scope
#### Details
Las fixtures de pytest son funciones que proveen precondiciones a los tests. Su ventaja sobre `setUp`/`tearDown` de `unittest` es que son **composables** y **declarativas**: un test declara qué necesita en sus parámetros y pytest resuelve las dependencias automáticamente. Si dos tests necesitan la misma fixture, no hay código duplicado, y si una fixture necesita otra, simplemente la recibe como parámetro también.

El parámetro `scope` controla cuántas veces se instancia la fixture: `"function"` (default) crea una instancia por test, `"module"` crea una por archivo, `"session"` crea una sola por toda la corrida. Elegir el scope incorrecto tiene consecuencias directas: un scope `"session"` para una fixture que modifica estado (como una conexión a DB que inserta datos) va a causar que los tests se contaminen entre sí. La regla es: el scope más amplio posible que no comparta estado mutable entre tests.

La otra capacidad importante es el **teardown**: todo lo que está después del `yield` en una fixture se ejecuta al final del scope, sin importar si el test falló. Esto garantiza limpieza de recursos (conexiones, archivos temporales, mocks) incluso cuando hay excepciones, algo que `return` no puede hacer.

#### Examples
Fixture básica con teardown via yield
```python
import pytest
from myapp.db import create_session, drop_all_tables

@pytest.fixture
def db_session():
    session = create_session()
    yield session
    session.rollback()
    session.close()
```

Fixture de scope de módulo para recursos costosos (un engine de BD)
```python
@pytest.fixture(scope="module")
def db_engine():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()
```

Composición de fixtures: db_session usa db_engine
```python
@pytest.fixture
def db_session(db_engine):
    with Session(db_engine) as session:
        yield session
        session.rollback()  # deshacer cambios del test
```

#### Sources
- [pytest, Fixtures](https://docs.pytest.org/en/stable/reference/fixtures.html)
- [pytest, Fixture scopes](https://docs.pytest.org/en/stable/how-to/fixtures.html#fixture-scopes)

### Parametrización con `@pytest.mark.parametrize`
#### Details
`@pytest.mark.parametrize` permite correr el mismo test con múltiples conjuntos de inputs sin duplicar código. Cada conjunto de parámetros genera un test independiente con su propio nombre en el output, lo que facilita identificar exactamente qué caso falló. Es especialmente poderoso para testear lógica de validación, casos límite y equivalencias de formato donde el código bajo test no cambia pero los inputs sí.

El decorador acepta un string con los nombres de los parámetros y una lista de tuplas con los valores. Podés parametrizar múltiples dimensiones combinando varios decoradores (el resultado es el producto cartesiano), y podés agregar `ids` para nombrar cada caso en el output. Para casos de error esperados, combinás con `pytest.raises` dentro del test o usás el parámetro `marks=pytest.mark.xfail`.

En entrevista, el uso de `parametrize` señala que un candidato piensa en **cobertura de casos** en lugar de solo "el happy path funciona". La estrategia es: primero cubrir los casos límite (vacío, none, valor máximo, caracteres especiales), luego el happy path, luego los errores esperados, no al revés.

#### Examples
Test parametrizado con múltiples casos de validación
```python
import pytest
from myapp.validators import is_valid_email

@pytest.mark.parametrize("email, expected", [
    ("user@example.com", True),
    ("user+tag@sub.domain.org", True),
    ("notanemail", False),
    ("@nodomain.com", False),
    ("", False),
    (None, False),
])
def test_email_validation(email, expected):
    assert is_valid_email(email) == expected
```

Testear excepciones esperadas con parametrize
```python
@pytest.mark.parametrize("value, error_type", [
    (-1, ValueError),
    (None, TypeError),
    ("abc", TypeError),
])
def test_create_order_invalid_quantity(value, error_type):
    with pytest.raises(error_type):
        create_order(product_id=1, quantity=value)
```

IDs descriptivos para output legible en el CI
```python
@pytest.mark.parametrize("discount, total, expected", [
    (0.0, 100.0, 100.0),
    (0.1, 100.0, 90.0),
    (1.0, 100.0, 0.0),
], ids=["no-discount", "10-percent", "full-discount"])
def test_apply_discount(discount, total, expected):
    assert apply_discount(total, discount) == pytest.approx(expected)
```

#### Sources
- [pytest, Parametrize](https://docs.pytest.org/en/stable/how-to/parametrize.html)
- [pytest, pytest.approx](https://docs.pytest.org/en/stable/reference/api.html#pytest.approx)

### Mocking: qué mockear y qué no
#### Details
La regla de oro del mocking es: **mockear las dependencias externas que no podés controlar o que son lentas/costosas**, no la lógica que estás testeando. Si mockeas demasiado, tu test verifica que Python llama funciones, no que tu código hace lo correcto. Si mockeas muy poco, un test de unidad puede fallar por un problema de red o de base de datos que no tiene nada que ver con el bug que buscás.

`unittest.mock.patch` es el mecanismo estándar. La clave que confunde a muchos: hay que patchear **donde se usa el objeto, no donde está definido**. Si `myapp.services.email` importa `smtplib.SMTP` y vos patcheás `smtplib.SMTP`, el módulo ya tiene la referencia original, hay que patchear `myapp.services.email.SMTP`. pytest ofrece el fixture `monkeypatch` como alternativa: es más pythonico, se limpia automáticamente al terminar el test y no requiere decoradores.

Las cosas que conviene NO mockear: la lógica de negocio del módulo bajo test (eso es lo que estás verificando), las funciones puras sin side effects, y el código de tu dominio del que tenés control completo. Lo que SÍ conviene mockear: llamadas HTTP a APIs externas, envío de emails/SMS, lectura de archivos del sistema operativo, el reloj del sistema (`datetime.now()`), y la capa de base de datos en tests de unidad.

#### Examples
Mock de una llamada HTTP externa con `unittest.mock`
```python
from unittest.mock import patch, MagicMock

def test_fetch_user_profile():
    mock_response = MagicMock()
    mock_response.json.return_value = {"id": 1, "name": "Ana"}
    mock_response.status_code = 200

    with patch("myapp.clients.requests.get", return_value=mock_response):
        result = fetch_user_profile(user_id=1)

    assert result["name"] == "Ana"
```

Mock del reloj con `monkeypatch` (fixture de pytest)
```python
from datetime import datetime

def test_order_timestamp(monkeypatch):
    fixed_now = datetime(2024, 6, 1, 12, 0, 0)
    monkeypatch.setattr("myapp.orders.datetime", MagicMock(now=lambda: fixed_now))

    order = create_order(product_id=1, quantity=2)

    assert order.created_at == fixed_now
```

Verificar que una función fue llamada con los parámetros correctos
```python
from unittest.mock import patch

def test_sends_confirmation_email():
    with patch("myapp.services.send_email") as mock_send:
        register_user(email="test@example.com", name="Carlos")

    mock_send.assert_called_once_with(
        to="test@example.com",
        subject="Bienvenido",
        template="welcome",
    )
```

#### Sources
- [Python, unittest.mock](https://docs.python.org/3/library/unittest.mock.html)
- [pytest, monkeypatch](https://docs.pytest.org/en/stable/how-to/monkeypatch.html)

### Testing de una API FastAPI con base de datos aislada
#### Details
FastAPI provee `TestClient` (basado en `httpx`) que permite hacer requests HTTP a la app sin levantar un servidor real. El desafío en tests de integración es **aislar la base de datos**: no querés que los tests usen la DB de producción o de desarrollo, y querés que cada corrida empiece con un estado conocido. La solución canónica de FastAPI es usar `dependency_overrides` para reemplazar la función que provee la sesión de DB por una que use una base de datos en memoria o de test.

El patrón más robusto es: la app define una función `get_db()` que el router usa como dependencia. En el setup de tests, se define una `get_test_db()` que usa una sesión sobre una DB SQLite en memoria (o una base de datos de test con rollback por test). Luego se registra en `app.dependency_overrides[get_db] = get_test_db`. FastAPI inyectará la versión de test en todos los endpoints durante esa corrida.

La estrategia de aislamiento es clave: podés crear y destruir el schema completo por sesión de tests, o usar `ROLLBACK` al final de cada test para deshacer los cambios. Con SQLite en memoria, crear el schema por test es barato. Con PostgreSQL real, el rollback es más eficiente. En ambos casos el objetivo es el mismo: cada test empieza con un estado limpio y predecible.

#### Examples
Fixture de TestClient con override de la dependencia de DB
```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from myapp.main import app
from myapp.database import get_db, Base

TEST_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture(scope="module")
def test_engine():
    engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)

@pytest.fixture
def client(test_engine):
    def get_test_db():
        with Session(test_engine) as session:
            yield session
            session.rollback()

    app.dependency_overrides[get_db] = get_test_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```

Test de integración de un endpoint POST
```python
def test_create_user_returns_201(client):
    payload = {"name": "Lucía Torres", "email": "lucia@example.com"}

    response = client.post("/users", json=payload)

    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "lucia@example.com"
    assert "id" in data
```

Test de error de validación (422)
```python
def test_create_user_without_email_returns_422(client):
    payload = {"name": "Sin email"}

    response = client.post("/users", json=payload)

    assert response.status_code == 422
    errors = response.json()["detail"]
    assert any(e["loc"] == ["body", "email"] for e in errors)
```

#### Sources
- [FastAPI, Testing](https://fastapi.tiangolo.com/tutorial/testing/)
- [FastAPI, Override dependencies](https://fastapi.tiangolo.com/advanced/testing-dependencies/)

### Tests de unidad vs integración: la pirámide
#### Details
Un **test de unidad** verifica una función o clase en aislamiento, con todas sus dependencias mockeadas o reemplazadas por dobles de test. Son rápidos (millisegundos), deterministas y fáciles de mantener. Su debilidad es que no prueban que las piezas funcionan juntas: podés tener 100% de cobertura en tests unitarios y un bug en la integración entre dos módulos.

Un **test de integración** ejercita múltiples componentes reales a la vez, por ejemplo, un request HTTP completo que pasa por routing, validación, lógica de negocio y una base de datos real (aunque sea en memoria). Son más lentos y más costosos de mantener, pero detectan problemas de integración que los tests unitarios no pueden ver. La estrategia correcta no es elegir uno u otro: es la pirámide de tests, muchos tests unitarios en la base, menos tests de integración en el medio, y muy pocos tests end-to-end en la cima.

El error más común que se ve en entrevistas es mockear la base de datos incluso en los tests que precisamente deberían probar la interacción con ella. Si estás testeando que una query devuelve las órdenes filtradas por estado, usar un mock que retorna datos hardcodeados no prueba nada sobre tu query. El criterio: si lo que estás verificando ES la interacción con ese componente, no lo mockees, ejercitalo. Si el componente es externo a tu dominio (una API de terceros, un servicio de email), ahí sí mockeás.

#### Examples
Test unitario: lógica pura sin dependencias externas
```python
from myapp.pricing import calculate_final_price

def test_final_price_with_discount():
    price = calculate_final_price(base_price=100.0, discount_rate=0.15, tax_rate=0.21)
    assert price == pytest.approx(86.45)  # (100 * 0.85) * 1.21
```

Test de integración: query real contra SQLite en memoria
```python
def test_get_active_orders_filters_by_status(db_session):
    db_session.add_all([
        Order(status="active", user_id=1),
        Order(status="cancelled", user_id=1),
        Order(status="active", user_id=2),
    ])
    db_session.commit()

    result = get_active_orders(db_session)

    assert len(result) == 2
    assert all(o.status == "active" for o in result)
```

#### Sources
- [pytest, Good Integration Practices](https://docs.pytest.org/en/stable/explanation/goodpractices.html)
- [Python, unittest.mock, When to patch](https://docs.python.org/3/library/unittest.mock.html#quick-guide)

## Interview Questions

### ¿Qué mockeás en un test de unidad y qué dejás sin mockear? Dame un ejemplo concreto.
Mockeo lo que está fuera del dominio de mi función: llamadas HTTP, envío de emails, lectura del reloj, el filesystem. No mockeo la lógica que estoy testeando ni código de mi propio dominio que tiene comportamiento determinista. Por ejemplo, si testeo `create_order()`, mockeo el servicio de email que notifica al usuario pero dejo que la lógica de cálculo de precio y la validación de stock corran de verdad. Si mockeo el cálculo de precio, no estoy testeando la función, estoy testeando que Python puede llamar funciones.

### ¿Cómo aislás la base de datos en los tests de una API FastAPI para que no usen producción y no se contaminen entre sí?
Uso `dependency_overrides` para reemplazar la función `get_db()` de la app por una que use una sesión sobre una base SQLite en memoria. Cada test recibe su propia sesión y al final hago `rollback()`, así todos los cambios del test se deshacen y el siguiente empieza con el schema limpio. El schema lo creo una vez por módulo de tests para no pagar el costo de `create_all` por cada test individual.

### ¿Por qué elegiría `scope="module"` para una fixture de engine de base de datos, pero `scope="function"` para la sesión?
El engine es costoso de crear: abre el archivo de DB, inicializa el pool, crea el schema. Crearlo una vez por módulo es correcto porque no tiene estado mutable entre tests. La sesión, en cambio, SÍ tiene estado: rastrea los objetos que se agregaron, tiene una transacción abierta. Si comparto la sesión entre tests, los datos que inserta el test A pueden estar visibles para el test B. Scope function + rollback al final garantiza aislamiento completo sin pagar el costo de crear el engine cada vez.

### Te dan un suite de tests que tiene 300 tests parametrizados para validación de emails, pero falla uno solo. ¿Cómo identificás rápido cuál caso es y lo debuggeás?
pytest imprime el ID del test fallado en el output, si usé `ids=` en el `parametrize` el nombre es descriptivo, si no, incluye los valores del caso. Para debuggear un test específico corro `pytest tests/test_validators.py::test_email_validation[notanemail-False] -v -s` y si necesito introspección agrego `-pdb` para entrar al debugger en el punto de falla. El valor de `parametrize` es exactamente este: falla un caso, no el test entero.

### ¿Cuándo un test de integración puede darte falsa confianza? ¿Cuándo es indispensable?
Puede darte falsa confianza cuando el test cubre el happy path de la integración pero no los casos límite, sabés que los componentes hablan entre sí cuando todo está bien, pero no cuándo hay datos inválidos o un servicio falla. Es indispensable cuando el comportamiento que verificás ES la integración: que una query SQL devuelve los datos esperados, que el middleware de auth rechaza requests sin token, que la serialización de la respuesta tiene el formato correcto. Esas cosas no se pueden probar con mocks porque el mock devolvería exactamente lo que vos le programaste que devuelva.

### Un test del CI falla intermitentemente, a veces pasa, a veces falla. ¿Cuál es tu estrategia de diagnóstico?
Los tests "flaky" casi siempre tienen una de tres causas: dependencia de orden de ejecución (estado compartido entre tests, fixture con scope demasiado amplio), dependencia del tiempo (`datetime.now()` sin mockear, sleeps o timeouts arbitrarios) o no-determinismo en los datos (UUIDs, orden de resultados de una query sin `ORDER BY`). Primero corro el suite con `--randomly-seed=last` para reproducir el orden exacto que falló. Luego busco fixtures con scope module/session que muten estado. Si el test implica tiempo, lo mockeo. Si implica orden de resultados, agrego un `ORDER BY` explícito a la query o a la aserción.
