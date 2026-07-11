---
stack: devops
id: devops-docker
title: "Docker: imágenes, capas y builds de producción"
area: Infraestructura
priority: high
resourceLabel: Docker Docs, Build with Docker
resourceUrl: https://docs.docker.com/build/
---

## Summary

Cómo Docker arma imágenes a partir de capas, qué aísla realmente un contenedor frente a una VM, y cómo diseñar Dockerfiles y Compose files pensados para builds rápidos e imágenes chicas.

## Concepts

### Imágenes, capas y layer caching

#### Details

Una imagen Docker no es un blob monolítico: es una pila de capas de solo lectura, cada una generada por una instrucción del Dockerfile, apiladas mediante un union filesystem (OverlayFS en la mayoría de los setups modernos). Cada capa guarda únicamente el diff respecto de la anterior. Cuando corrés un contenedor, Docker agrega una capa de escritura fina arriba de todo eso; el resto de la imagen se comparte entre contenedores, lo que ahorra disco y acelera arranques.

El punto que se evalúa en entrevista es el **build cache**: Docker cachea cada capa por separado y, al reconstruir, reutiliza las capas hasta la primera instrucción que cambió (o cuyo contexto cambió). Por eso el ORDEN de las instrucciones en el Dockerfile importa muchísimo: si copiás todo el código fuente antes de instalar dependencias, cualquier cambio de una línea invalida la capa de instalación de dependencias y Docker la vuelve a ejecutar desde cero en cada build. El patrón correcto es copiar primero los manifiestos de dependencias (`package.json`, `requirements.txt`, `go.mod`), instalar, y recién después copiar el resto del código fuente, que cambia con mucha más frecuencia.

Otro detalle que separa a alguien que solo "usó Docker" de alguien que lo entiende: el cache se invalida por contenido, no por timestamp. Un `COPY` compara un hash del contenido copiado; un `RUN` se invalida si la capa anterior cambió, independientemente de si el comando en sí es idéntico. Esto explica por qué reordenar instrucciones o usar `.dockerignore` para no copiar basura (como `node_modules` o `.git`) tiene impacto directo en la velocidad de build.

#### Examples

Dockerfile mal ordenado, invalida el cache de dependencias en cada cambio de código

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install
CMD ["npm", "start"]
```

Dockerfile bien ordenado, el cache de `npm install` sobrevive mientras no cambien los manifiestos

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
CMD ["npm", "start"]
```

`.dockerignore` para no invalidar capas con archivos irrelevantes

```
node_modules
.git
*.log
Dockerfile
.dockerignore
```

Inspeccionar las capas de una imagen ya construida

```bash
docker history myapp:latest
docker inspect myapp:latest --format '{{.RootFS.Layers}}'
```

#### Sources

- [Docker Build, Understanding the build cache](https://docs.docker.com/build/cache/)
- [Dockerfile reference](https://docs.docker.com/reference/dockerfile/)
- [Docker Build, .dockerignore files](https://docs.docker.com/build/concepts/context/#dockerignore-files)

### Contenedores vs. máquinas virtuales

#### Details

Una VM virtualiza hardware: cada VM corre su propio kernel completo sobre un hypervisor, lo que da un aislamiento muy fuerte pero implica minutos de arranque y overhead de memoria/CPU por cada instancia. Un contenedor, en cambio, comparte el kernel del host y aísla procesos usando mecanismos nativos de Linux: **namespaces** (que hacen que un proceso vea su propio árbol de PIDs, su propia red, su propio filesystem montado, etc., como si estuviera solo en la máquina) y **cgroups** (que limitan y contabilizan cuánta CPU, memoria e I/O puede consumir un grupo de procesos).

La consecuencia práctica de esto es que un contenedor arranca en milisegundos porque no hay que bootear un kernel, y el overhead de recursos es mucho menor porque no hay un sistema operativo completo duplicado por instancia. El costo es un aislamiento más débil que el de una VM: si hay un kernel exploit, en teoría podría afectar a todos los contenedores del host, porque todos comparten ese mismo kernel. Por eso en entornos multi-tenant de alta sensibilidad se suelen combinar contenedores con capas adicionales de aislamiento (gVisor, Kata Containers, VMs dedicadas por tenant).

En una entrevista, la respuesta madura no es "los contenedores son más livianos" a secas, sino explicar el mecanismo: namespaces dan la ilusión de aislamiento (qué ve el proceso), cgroups dan el control de recursos (cuánto puede usar), y ambos son features del kernel de Linux, no una tecnología inventada por Docker, Docker es la herramienta que empaqueta y orquesta esos primitivos de forma ergonómica.

#### Examples

Ver que un contenedor comparte el kernel del host

```bash
uname -r                     # en el host
docker run --rm alpine uname -r   # mismo kernel version, distinto userland
```

Límites de recursos vía cgroups, expuestos como flags de Docker

```bash
docker run -d --name api \
  --memory="512m" --cpus="1.5" \
  myapp:latest
```

Ver el aislamiento de procesos (namespace de PID) desde dentro del contenedor

```bash
docker run --rm alpine sh -c "ps aux"   # el proceso principal es PID 1 dentro del contenedor
```

#### Sources

- [Docker overview, What is a container?](https://docs.docker.com/get-started/docker-overview/)
- [Docker docs, Runtime options with Memory, CPUs, and GPUs](https://docs.docker.com/engine/containers/resource_constraints/)

### Multi-stage builds

#### Details

Un multi-stage build usa varias instrucciones `FROM` en un mismo Dockerfile, donde cada `FROM` arranca una etapa nueva. La idea central es separar el entorno de **build** (compiladores, herramientas de test, dependencias de desarrollo) del entorno de **runtime** (solo lo necesario para ejecutar la app). Con `COPY --from=<stage>` podés traer artefactos ya compilados de una etapa anterior a la etapa final, sin arrastrar el resto de esa etapa.

El beneficio directo es el tamaño de la imagen final: una imagen de producción de un binario Go compilado puede pesar unos pocos MB sobre `scratch` o `alpine`, en vez de arrastrar el SDK completo de Go (cientos de MB) que solo hacía falta para compilar. Menos tamaño de imagen significa pulls más rápidos, menor superficie de ataque (menos herramientas y librerías que un atacante podría abusar si compromete el contenedor) y menos costo de almacenamiento en el registry.

El ángulo de entrevista senior es justificar CUÁNDO conviene: en lenguajes compilados (Go, Rust, Java con build de Maven/Gradle) el ahorro es enorme porque el toolchain de build es pesado y no se necesita en runtime. En lenguajes interpretados como Node o Python el beneficio es menor pero sigue existiendo (no necesitás `devDependencies`, headers de compilación para paquetes nativos, etc. en la imagen final).

#### Examples

Multi-stage para una app Go, la imagen final no tiene el compilador

```dockerfile
FROM golang:1.22 AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /app ./cmd/server

FROM alpine:3.19
COPY --from=builder /app /app
ENTRYPOINT ["/app"]
```

Multi-stage para Node, separa devDependencies de la imagen de producción

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
RUN npm ci --omit=dev
CMD ["node", "dist/index.js"]
```

Comparar el tamaño resultante

```bash
docker build -t myapp:multistage .
docker images myapp:multistage --format "{{.Size}}"
```

#### Sources

- [Docker Build, Multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
- [Dockerfile reference, FROM ... AS](https://docs.docker.com/reference/dockerfile/#from)

### Docker Compose para entornos multi-contenedor

#### Details

Docker Compose describe, en un único archivo YAML, un conjunto de servicios (contenedores), sus redes y sus volúmenes, para levantar un entorno completo con un solo comando. Cada servicio definido en `compose.yaml` corre en una red bridge dedicada que Compose crea automáticamente, y dentro de esa red los servicios se resuelven entre sí **por nombre de servicio** vía DNS interno, no hace falta conocer IPs ni exponer puertos al host para que un servicio hable con otro.

Los **volúmenes** resuelven el problema de persistencia: el filesystem de un contenedor es efímero por defecto (vive y muere con la capa de escritura del contenedor), así que cualquier dato que deba sobrevivir a un restart o rebuild,una base de datos, uploads de usuarios, necesita un volumen nombrado o un bind mount al filesystem del host. La diferencia entre ambos: un volumen nombrado lo gestiona Docker (vive en su propio espacio, portable entre hosts en ciertos drivers), mientras que un bind mount apunta a una ruta específica del host, típica en desarrollo para tener hot-reload del código fuente.

En entrevista, el punto fino es explicar la diferencia entre Compose para desarrollo local y para producción: Compose es excelente para reproducir un entorno multi-servicio en la laptop de un dev (app + Postgres + Redis con un solo `docker compose up`), pero no reemplaza un orquestador como Kubernetes para producción real, porque no maneja scheduling multi-nodo, self-healing avanzado, ni rolling updates con las mismas garantías.

#### Examples

`compose.yaml` con red implícita entre servicios y persistencia con volumen

```yaml
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://user:pass@db:5432/app
    depends_on:
      - db

  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: app
    volumes:
      - db_data:/var/lib/postgresql/data

volumes:
  db_data:
```

Bind mount para desarrollo con hot-reload

```yaml
services:
  api:
    build: .
    volumes:
      - ./src:/app/src
    command: npm run dev
```

Comandos básicos del ciclo de vida

```bash
docker compose up -d
docker compose logs -f api
docker compose down          # borra contenedores y red, conserva volúmenes nombrados
docker compose down -v       # borra también los volúmenes
```

#### Sources

- [Docker Compose overview](https://docs.docker.com/compose/intro/compose-application-model/)
- [Docker Compose, Networking](https://docs.docker.com/compose/how-tos/networking/)
- [Docker docs, Volumes](https://docs.docker.com/engine/storage/volumes/)

## Interview Questions

### Un Dockerfile que antes tardaba 20 segundos en reconstruirse ahora tarda 3 minutos cada vez que se cambia una línea de código. ¿Cómo lo diagnosticás y qué cambiarías?

Primero miraría el orden de las instrucciones con `docker history` o revisando el Dockerfile: si `COPY . .` está antes de instalar dependencias, cualquier cambio en el código invalida el cache de esa capa de instalación y todo lo que viene después se reconstruye desde cero. La solución es copiar primero solo los manifiestos de dependencias (`package.json`, `go.mod`, etc.), correr la instalación, y recién después copiar el resto del código fuente. También revisaría el `.dockerignore` por si se está copiando `node_modules`, `.git` u otros directorios pesados que no deberían formar parte del build context.

### Tenés que llevar a producción una app compilada en Go y te piden que la imagen final sea lo más chica posible. ¿Qué estrategia usarías y por qué?

Usaría un multi-stage build: una etapa `builder` con la imagen completa de Go para compilar el binario, y una etapa final basada en `alpine` o incluso `scratch` que solo copia el binario ya compilado con `COPY --from=builder`. Esto elimina el compilador, el caché de módulos y todo el toolchain de build de la imagen final, dejando solo el binario y sus dependencias runtime mínimas. El resultado es una imagen de pocos MB en vez de cientos, lo que acelera los despliegues y reduce la superficie de ataque.

### ¿Qué diferencia real hay entre correr una app en un contenedor y correrla en una VM, más allá de "los contenedores son más livianos"?

La VM virtualiza hardware y corre un kernel propio arriba de un hypervisor, dando aislamiento fuerte pero con overhead de arranque y recursos. Un contenedor comparte el kernel del host y logra aislamiento mediante namespaces (aíslan qué ve el proceso: su árbol de PIDs, su red, su filesystem) y cgroups (limitan cuánta CPU/memoria/IO puede usar). Eso hace que un contenedor arranque en milisegundos y consuma menos recursos, a costa de un aislamiento más débil que el de una VM, porque un kernel exploit puede en teoría afectar a todos los contenedores que comparten ese kernel.

### Tenés una app con API, base de datos Postgres y Redis, y querés que un nuevo desarrollador levante todo el entorno local con un solo comando. ¿Cómo lo resolverías?

Definiría un `compose.yaml` con los tres servicios: la API con su `build`, Postgres y Redis con sus imágenes oficiales. Al estar en la misma red que Compose crea automáticamente, la API puede resolver `db` y `redis` por nombre de servicio sin configurar IPs. Para que los datos de Postgres sobrevivan a un `docker compose down`, le agregaría un volumen nombrado montado en el directorio de datos de Postgres. Con eso, `docker compose up` deja todo el entorno funcionando de punta a punta.

### Un contenedor que "funcionaba en mi máquina" falla en el servidor de CI con el mismo Dockerfile. ¿Qué revisarías primero?

Empezaría descartando diferencias de build context: si el `.dockerignore` difiere entre entornos, o si hay archivos locales sin trackear que el Dockerfile asume que existen. Después revisaría si el Dockerfile usa tags flotantes como `latest` en la imagen base, lo que puede traer una versión distinta del sistema operativo o del runtime entre el build local y el de CI, la corrección es fijar versiones exactas (`node:20.11-alpine` en vez de `node:latest`). También chequearía variables de entorno o secretos que existen localmente pero no están configurados en el pipeline de CI.

### ¿Cuándo Docker Compose deja de ser suficiente y hace falta pasar a un orquestador como Kubernetes?

Compose es ideal para reproducir un entorno multi-servicio en un solo host, típicamente en desarrollo local. Deja de alcanzar cuando necesitás correr en múltiples nodos con scheduling automático, self-healing real (reiniciar y reprogramar contenedores caídos en otro nodo), rolling updates con health checks, escalado horizontal dinámico, o gestión centralizada de secretos y configuración a nivel de clúster. En esos escenarios, Kubernetes (u otro orquestador) aporta garantías de disponibilidad y operación que Compose, pensado para un solo host, no ofrece.
