# Fuentes del contenido

De dónde sale la información de cada módulo, y bajo qué política. La regla de oro: el contenido
es **propio, escrito y basado en documentación oficial citable**, y cada cita verificable vive
inline en el `#### Sources` de cada módulo. Este archivo resume la política y el mapa general.

## Política de fuentes (3 niveles)

1. **Contenido curado (lo que mostramos como módulo)**, escrito por nosotros, basado en
   **documentación oficial** (react.dev, laravel.com, MDN, php.net) y citado inline. Nunca se
   copia texto de terceros sin licencia.
2. **Repos comunitarios = guía de temario, NO contenido**, los usamos solo para decidir
   _qué temas/preguntas_ son frecuentes (las ideas no son copyrightables). NO copiamos su texto.
3. **Bancos ingestados (`_bank.md`)**, única redistribución de texto de terceros, y solo bajo
   **licencia permisiva** (MIT, ISC, Apache, BSD, CC0, CC-BY). El ingester
   (`scripts/ingest/`) **rechaza** cualquier fuente sin licencia redistribuible y preserva la
   atribución (autor, licencia, URL) en el frontmatter del archivo.

> ⚠️ "Repo público" NO significa "libre para copiar". Un repo de GitHub **sin archivo LICENSE
> es todos-los-derechos-reservados** por defecto. Por eso esos repos solo se usan como guía de
> temario, nunca se copian.

## Fuentes primarias por stack

| Stack                   | Fuente autoritativa del contenido                                                                                                                                                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React                   | [react.dev](https://react.dev) (oficial) + [MDN](https://developer.mozilla.org) (a11y/web) + docs de TanStack Query / SWR                                                                                                                                         |
| Laravel                 | [laravel.com/docs](https://laravel.com/docs) (oficial)                                                                                                                                                                                                            |
| PHP                     | [php.net/manual](https://www.php.net/manual/en/) (oficial)                                                                                                                                                                                                        |
| Python                  | [docs.python.org](https://docs.python.org/3/) (oficial) + [fastapi.tiangolo.com](https://fastapi.tiangolo.com) + [docs.pydantic.dev](https://docs.pydantic.dev) + [docs.sqlalchemy.org](https://docs.sqlalchemy.org) + [docs.pytest.org](https://docs.pytest.org) |
| JavaScript              | [MDN Web Docs](https://developer.mozilla.org)                                                                                                                                                                                                                     |
| TypeScript              | [typescriptlang.org/docs](https://www.typescriptlang.org/docs/) (oficial)                                                                                                                                                                                         |
| Java / Spring Boot      | [docs.oracle.com/javase](https://docs.oracle.com/javase/tutorial/) + [docs.spring.io](https://docs.spring.io/spring-boot/docs/current/reference/html/)                                                                                                            |
| C# / .NET               | [learn.microsoft.com/dotnet/csharp](https://learn.microsoft.com/dotnet/csharp/) + [learn.microsoft.com/aspnet](https://learn.microsoft.com/aspnet/core/)                                                                                                          |
| Rust                    | [doc.rust-lang.org/book](https://doc.rust-lang.org/book/) + [doc.rust-lang.org/std](https://doc.rust-lang.org/std/) + [rust-lang.github.io/async-book](https://rust-lang.github.io/async-book/)                                                                   |
| Go                      | [go.dev/ref/spec](https://go.dev/ref/spec) + [go.dev/doc](https://go.dev/doc/) + [pkg.go.dev](https://pkg.go.dev/)                                                                                                                                                |
| C++                     | [en.cppreference.com](https://en.cppreference.com/w/)                                                                                                                                                                                                             |
| Vue                     | [vuejs.org/guide](https://vuejs.org/guide/) (oficial)                                                                                                                                                                                                             |
| Angular                 | [angular.dev](https://angular.dev)                                                                                                                                                                                                                                |
| Next.js                 | [nextjs.org/docs](https://nextjs.org/docs)                                                                                                                                                                                                                        |
| Node.js                 | [nodejs.org/docs](https://nodejs.org/docs/latest/api/) (oficial)                                                                                                                                                                                                  |
| SQL / Bases de datos    | [postgresql.org/docs](https://www.postgresql.org/docs/current/) (oficial, referencia primaria) + [dev.mysql.com](https://dev.mysql.com/doc/refman/8.0/en/) (diferencias de vendor)                                                                                |
| DevOps (Docker/K8s/Git) | [docs.docker.com](https://docs.docker.com/) + [kubernetes.io/docs](https://kubernetes.io/docs/) + [git-scm.com](https://git-scm.com/doc) (oficiales)                                                                                                              |
| System Design           | [aws.amazon.com/architecture](https://aws.amazon.com/architecture/) + [cloud.google.com/architecture](https://cloud.google.com/architecture) (oficiales)                                                                                                          |
| General (estrategia)    | Buenas prácticas de entrevista (Tech Interview Handbook como referencia de enfoque)                                                                                                                                                                               |

## Módulos curados y su base

Cada módulo cita sus URLs exactas en su sección `#### Sources`. Resumen:

- **React**, `fundamentals`, `hooks`, `forms`, `patterns-performance`, `data-fetching`,
  `modern-features` (18/19 + RSC), `testing`, `error-boundaries`, `accessibility`.
  Base: react.dev; testing.dev; MDN/WAI-ARIA para accesibilidad.
- **Laravel**, `apis-rest`, `fundamentals`, `eloquent`, `middleware-auth`, `queues`,
  `security`, `testing`, `interview-essentials`. Base: laravel.com/docs. + `_bank.md` (34 Qs curadas, caching/events/broadcasting/notifications/artisan/rate-limiting).
- **PHP**, `fundamentals` (type juggling, arrays como HashTable, superglobales, excepciones),
  `oop` (interfaces vs abstractas, traits, magic methods, late static binding, readonly),
  `internals-performance` (Zval/copy-on-write, OPcache, generators, GC cíclico), `security`
  (SQL injection/PDO, password_hash, XSS, CSRF/sesión). Base: php.net/manual. Temario guiado
  por xianyunyh/PHP-Interview y colinlet/PHP-Interview-QA (solo temario, texto propio, ver
  política de fuentes abajo).
- **Python**, `fundamentals`, `async` (GIL/asyncio), `fastapi-fundamentals` (routing/Pydantic v2),
  `fastapi-dependencies` (DI/auth/middleware), `data-orm` (SQLAlchemy 2.0/diseño relacional),
  `testing` (pytest), `patterns-performance`. Base: docs.python.org, fastapi.tiangolo.com,
  docs.pydantic.dev, docs.sqlalchemy.org, docs.pytest.org.
- **JavaScript**, `fundamentals`. Base: MDN. + `_bank.md` (43 Qs: closures, prototipos, event loop, async, WeakMap, generators, Proxy, memory leaks).
- **TypeScript**, `fundamentals` (interfaces vs type aliases/tipado estructural, uniones discriminadas, narrowing, genéricos), `advanced-types` (utility types y cómo están construidos, mapped types, conditional types/`infer`, template literal types, `satisfies`). Base: typescriptlang.org/docs. Temario guiado por aershov24/typescript-interview-questions (solo temario, texto propio, ver política de fuentes abajo).
- **Java / Spring Boot**, `fundamentals` (OOP, generics, collections, streams, memory model), `spring-boot` (IoC/DI, auto-config, REST, JPA, Security). Base: docs.oracle.com/javase, docs.spring.io. + `_bank.md` (41 Qs).
- **C# / .NET**, `fundamentals` (value/ref types, generics, LINQ, async/await, GC), `aspnet` (middleware, DI, EF Core, minimal APIs, auth). Base: learn.microsoft.com/dotnet. + `_bank.md` (43 Qs).
- **Rust**, `fundamentals` (ownership/borrowing/lifetimes, enums, traits, error handling, iterators), `systems` (concurrencia, async/Futures, smart pointers, unsafe, performance). Base: doc.rust-lang.org. + `_bank.md` (37 Qs).
- **Go**, `fundamentals` (goroutines, channels, interfaces, errors, slices/maps), `concurrency` (sync, context, patrones fan-out/worker pool, race detector, pprof). Base: go.dev. + `_bank.md` (39 Qs).
- **C++**, `fundamentals` (RAII, smart pointers, move semantics, templates, herencia/vtable), `modern` (STL, lambdas, concurrencia, UB, patrones modernos). Base: en.cppreference.com. + `_bank.md` (40 Qs).
- **Vue**, `fundamentals` (reactividad Proxy-based con ref/reactive, Composition API vs Options API, computed vs watch, v-model/v-for internals), `advanced` (props/emits vs provide/inject, lifecycle hooks de Composition API y cleanup, performance con v-memo/KeepAlive/defineAsyncComponent, Pinia). Base: vuejs.org/guide, pinia.vuejs.org. Temario guiado por sudheerj/vuejs-interview-questions (sin archivo LICENSE → solo guía de temario).
- **Angular**, `fundamentals` (componentes, DI, lifecycle hooks, directivas/pipes, Signals v17+), `advanced` (RxJS, routing/lazy loading, reactive forms, change detection, standalone components). Base: angular.dev. + `_bank.md` (37 Qs).
- **Next.js**, `fundamentals` (App Router, Server vs Client Components, data fetching, Server Actions, rendering strategies), `advanced` (image/font optimization, middleware, auth, Route Handlers, 4 capas de caché). Base: nextjs.org/docs. + `_bank.md` (39 Qs).
- **Node.js**, `fundamentals` (fases del event loop de libuv, CommonJS vs ESM/interop, streams y backpressure, Buffer/binario), `async-performance` (worker_threads vs cluster vs child_process, EventEmitter y memory leaks, graceful shutdown/señales, diagnóstico con perf_hooks/diagnostics_channel/clinic.js). Base: nodejs.org/docs. Temario guiado por ElemeFE/node-interview y Devinterview-io/node-interview-questions (solo temario, texto propio, ver política de fuentes abajo).
- **SQL**, `fundamentals` (tipos de JOIN, normalización 1FN-3FN vs desnormalización deliberada,
  índices B-tree y leftmost prefix rule, PK/FK e integridad referencial), `query-optimization`
  (lectura de EXPLAIN ANALYZE, problema N+1, transacciones y niveles de aislamiento, paginación
  OFFSET vs keyset), `schema-design` (relaciones uno-a-muchos/muchos-a-muchos, soft vs hard
  deletes, diseño por patrones de acceso, cuándo NO usar relacional). Base: postgresql.org/docs
  como referencia primaria, dev.mysql.com/doc para diferencias de vendor. Temario guiado por
  PavelGrigoryevDS/awesome-data-analysis (solo temario, texto propio, ver política de fuentes
  abajo).
- **DevOps**, `docker` (imágenes/capas y layer caching, contenedores vs VMs, multi-stage builds,
  Docker Compose), `kubernetes-basics` (Pod/Deployment/Service, ConfigMaps/Secrets, liveness vs
  readiness probes, réplicas/HorizontalPodAutoscaler), `git-advanced` (rebase vs merge, rebase
  interactivo, git bisect, recuperación con reflog y limpieza de secretos con filter-repo). Base:
  docs.docker.com, kubernetes.io/docs, git-scm.com/doc (Pro Git). Temario derivado solo de esas
  docs oficiales (texto propio); no se usaron repos CC BY-NC ni sin licencia como guía de autoría.
- **System Design**, `fundamentals` (escalado vertical vs horizontal, balanceo de carga,
  estrategias de caching, CAP theorem en la práctica), `data-and-messaging` (escalado de bases
  de datos con réplicas vs sharding, SQL vs NoSQL como decisión de sistema, colas de mensajes y
  procesamiento asíncrono, replicación leader-follower), `scenarios-and-reliability` (escenario
  completo de acortador de URLs clarify→estimate→design→tradeoffs, diseño de APIs a escala,
  patrones de confiabilidad). Base: aws.amazon.com/architecture, docs.aws.amazon.com/wellarchitected,
  cloud.google.com/architecture, developer.mozilla.org, redis.io/docs, postgresql.org/docs.
  Temario guiado también por donnemartin/system-design-primer (CC BY 4.0, ver nota especial
  en "Repos usados SOLO como guía de temario" abajo).
- **General**, `technical-interview-strategy`. Base: buenas prácticas de entrevista +
  [Tech Interview Handbook](https://www.techinterviewhandbook.org/) (MIT) como referencia de
  enfoque, citada inline. No se usan repos sin licencia.

## Bancos ingestados (texto de terceros, atribuido)

| Archivo               | Fuente                                                                                                                 | Licencia                               | Notas                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `react/_bank.md`      | [sudheerj/reactjs-interview-questions](https://github.com/sudheerj/reactjs-interview-questions)                        | MIT (© Sudheer Jonna)                  | Filtrado a preguntas de señal (se descartó trivia/legacy). 96 preguntas. Ver `scripts/ingest/adapters/react-sudheerj.mjs`.                                                                                                                                                                                                                                                                              |
| `python/_bank.md`     | [DevLoversTeam/python-interview-questions](https://github.com/DevLoversTeam/python-interview-questions) (README.es.md) | MIT (© 2026 DevLovers)                 | Edición en español. Filtrado a señal (80/250; se descartó trivia de métodos básicos/definicional). Ver `scripts/ingest/adapters/python-devlovers.mjs`.                                                                                                                                                                                                                                                  |
| `laravel/_bank.md`    | [laravel.com/docs](https://laravel.com/docs) (curado)                                                                  | Curado, sin redistribución de terceros | 34 preguntas escritas desde cero citando docs oficiales. Temas: caching, collections, events, service container avanzado, broadcasting, file storage, notifications, artisan, rate limiting.                                                                                                                                                                                                            |
| `javascript/_bank.md` | [developer.mozilla.org](https://developer.mozilla.org) (curado)                                                        | Curado, sin redistribución de terceros | 43 preguntas escritas desde cero citando MDN. Temas no cubiertos por fundamentals.md: TDZ, hoisting detallado, microtasks, bind/call/apply, currying, debounce/throttle, WeakMap/WeakSet, generators, ES modules, Proxy/Reflect, memory leaks, structuredClone. Repos consultados solo como guía de temario: sudheerj/javascript-interview-questions, greatfrontend/top-javascript-interview-questions. |
| `java/_bank.md`       | [docs.spring.io](https://docs.spring.io) + [docs.oracle.com/javase](https://docs.oracle.com/javase/tutorial/) (curado) | Curado, sin redistribución de terceros | 41 preguntas escritas desde cero. Temas: OOP, generics, Collections, Streams, JMM, IoC/DI, auto-config, @Transactional, JPA N+1, Spring Security/JWT, Actuator, Caching, Profiles, testing. Repos consultados solo como guía: anjitagargi/JavaSpringBoot_Interview_Questions, aatul/Java-Interview-Questions-Answers.                                                                                   |
| `csharp/_bank.md`     | [learn.microsoft.com/dotnet](https://learn.microsoft.com/dotnet) (curado)                                              | Curado, sin redistribución de terceros | 43 preguntas escritas desde cero. Temas: value/ref types, boxing, generics, LINQ, async/await, GC, IDisposable, Span<T>, middleware, DI lifetimes, JWT, EF Core, IHostedService, IMemoryCache. Repos consultados solo como guía: hackerheap/dotnet-interviews, aershov24/c-sharp-interview-questions.                                                                                                   |
| `rust/_bank.md`       | [doc.rust-lang.org](https://doc.rust-lang.org) (curado)                                                                | Curado, sin redistribución de terceros | 37 preguntas escritas desde cero. Temas: ownership/borrow checker, lifetimes, enums/pattern matching, traits, generics, error handling, iteradores, concurrencia (Send/Sync), async/Futures, smart pointers, unsafe. Repo consultado solo como guía: imhq/rust-interview-handbook.                                                                                                                      |
| `go/_bank.md`         | [go.dev](https://go.dev) (curado)                                                                                      | Curado, sin redistribución de terceros | 39 preguntas escritas desde cero. Temas: goroutines/scheduler, channels, select, interfaces, nil interface gotcha, errores centinela/wrapping, defer/panic/recover, slices/maps internals, context, sync primitives, data races, patrones de concurrencia, pprof, HTTP server, testing. Repo consultado solo como guía: shomali11/go-interview (puzzles de código; no se copió texto). No se usó golang-design/go-questions (CC BY-NC). |
| `cpp/_bank.md`        | [en.cppreference.com](https://en.cppreference.com/w/) (curado)                                                         | Curado, sin redistribución de terceros | 40 preguntas escritas desde cero. Temas: RAII, smart pointers (unique/shared/weak), move semantics, Regla de 5/0, vtable/destructor virtual, slicing, templates, SFINAE, STL containers, lambdas, concurrencia, UB, CRTP, pimpl, variant, C++20 concepts. Repo consultado solo como guía: nidhiupman568/C-PLUS-PLUS (sin licencia MIT).                                                                 |
| `angular/_bank.md`    | [angular.dev](https://angular.dev) (curado)                                                                            | Curado, sin redistribución de terceros | 37 preguntas escritas desde cero. Temas: componentes, DI jerarquía, lifecycle hooks, directivas, pipes, Signals, RxJS operators, routing/lazy loading, guards funcionales, reactive forms, change detection/OnPush, standalone, HTTP interceptors, testing. Repos consultados solo como guía: sudheerj/angular-interview-questions, Yonet/Angular-Interview-Questions (sin licencia).                   |
| `nextjs/_bank.md`     | [nextjs.org/docs](https://nextjs.org/docs) (curado)                                                                    | Curado, sin redistribución de terceros | 39 preguntas escritas desde cero. Temas: App Router vs Pages Router, Server vs Client Components, data fetching, Server Actions, rendering strategies (SSG/SSR/ISR/PPR), 4 capas de caché, middleware, next/image, auth con Auth.js v5, Route Handlers, deployment. Repo consultado solo como guía: mrhrifat/nextjs-interview-questions (GPL-3.0 → solo guía de temario).                               |

## Repos usados SOLO como guía de temario (no copiados)

Sirvieron para decidir cobertura de temas/preguntas. Su texto **no** está en la KB:

- [roadmap.sh](https://roadmap.sh), taxonomía de temas por rol.
- [xianyunyh/PHP-Interview](https://github.com/xianyunyh/PHP-Interview), temario PHP (sin
  archivo LICENSE → solo guía de temario). La mayoría de sus temas ya viven en `general/`
  (DS&A, redes, Linux); el temario PHP-específico (Zval/HashTable, OOP) informó `php-oop` y
  `php-internals-performance`.
- [colinlet/PHP-Interview-QA](https://github.com/colinlet/PHP-Interview-QA), temario PHP.
  **Nota:** LICENSE Apache-2.0 (elegible para ingesta futura vía `_bank.md`). Por ahora solo
  guía de temario (seguridad, OOP); el contenido PHP está escrito desde cero citando php.net.
- [kdn251/interviews](https://github.com/kdn251/interviews), temario DS&A.
- [mostafaaElsherbiny/backend-interview-questions](https://github.com/mostafaaElsherbiny/backend-interview-questions), temario backend/Laravel (sin licencia → solo guía).
- [fgitpush/Top-Laravel-Interview-Questions-Wiki](https://github.com/fgitpush/Top-Laravel-Interview-Questions-Wiki), temario Laravel (sin licencia → solo guía).
- [aershov24/typescript-interview-questions](https://github.com/aershov24/typescript-interview-questions), temario TypeScript (sin archivo LICENSE → todos-los-derechos-reservados por defecto, solo guía de temario, texto escrito desde cero).
- [sudheerj/vuejs-interview-questions](https://github.com/sudheerj/vuejs-interview-questions), temario Vue (sin archivo LICENSE → solo guía de temario, no se copió texto).
- [ElemeFE/node-interview](https://github.com/ElemeFE/node-interview), temario Node.js. **Nota:** SÍ tiene licencia MIT, técnicamente elegible para ingesta futura vía `_bank.md`, pero acá se usó solo como guía de temario y el contenido está escrito desde cero citando nodejs.org.
- [Devinterview-io/node-interview-questions](https://github.com/Devinterview-io/node-interview-questions), temario Node.js (sin archivo LICENSE → todos-los-derechos-reservados por defecto, solo guía de temario, texto escrito desde cero).
- [PavelGrigoryevDS/awesome-data-analysis](https://github.com/PavelGrigoryevDS/awesome-data-analysis), lista curada de enlaces (sección `#sql-databases`) bajo licencia CC0-1.0. Usada únicamente como guía de qué temas/preguntas de SQL son frecuentes en entrevistas; no se fetcheó ni copió ningún texto del repo, el contenido de `sql/fundamentals.md`, `sql/query-optimization.md` y `sql/schema-design.md` está escrito desde cero citando solo postgresql.org/docs y dev.mysql.com/doc.
- [donnemartin/system-design-primer](https://github.com/donnemartin/system-design-primer), temario de system design (escalado, caching, balanceo, bases de datos, mensajería, disponibilidad). **Nota especial:** a diferencia de los demás repos de esta lista, este SÍ está licenciado de forma permisiva (CC BY 4.0), por lo que legalmente sería elegible incluso para citar o adaptar texto con atribución. Se lo mantiene en esta sección de "solo guía de temario" por CHOICE de house-style, no porque la copia estuviera bloqueada: todo el contenido de `system-design/fundamentals.md`, `system-design/data-and-messaging.md` y `system-design/scenarios-and-reliability.md` está escrito desde cero citando fuentes oficiales (AWS, Google Cloud, MDN, Redis, PostgreSQL), y el primer se referencia como fuente adicional opcional en `#### Sources` de los conceptos donde aporta cobertura de temario, siempre atribuido.

> **Fuera de guía (NC / no usar):** repos con CC BY-NC (p.ej. bregman-arie/devops-exercises,
> golang-design/go-questions) **no** se usan como guía de autoría ni se citan como provenance
> del temario. El contenido DevOps y Go se basa solo en documentación oficial.
