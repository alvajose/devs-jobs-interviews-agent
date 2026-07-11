# Content sources

Where each module's information comes from, and under what policy. The golden rule: content
is **our own, written and grounded in citable official documentation**, and every verifiable
citation lives inline in each module's `#### Sources`. This file summarizes the policy and the
overall map.

## Source policy (3 tiers)

1. **Curated content (what we show as a module)** — written by us, grounded in **official
   documentation** (react.dev, laravel.com, MDN, php.net) and cited inline. We never copy
   third-party text without a license.
2. **Community repos = topic guide, NOT content** — used only to decide _which topics/questions_
   are common (ideas aren't copyrightable). We do NOT copy their text.
3. **Ingested banks (`_bank.md`)** — the only redistribution of third-party text, and only under
   a **permissive license** (MIT, ISC, Apache, BSD, CC0, CC-BY). The ingester
   (`scripts/ingest/`) **rejects** any source without a redistributable license and preserves
   attribution (author, license, URL) in the file's frontmatter.

> ⚠️ "Public repo" does NOT mean "free to copy". A GitHub repo **with no LICENSE file is
> all-rights-reserved** by default. That's why those repos are used only as a topic guide,
> never copied.

## Primary sources per stack

| Stack                   | Authoritative content source                                                                                                                                                                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React                   | [react.dev](https://react.dev) (official) + [MDN](https://developer.mozilla.org) (a11y/web) + TanStack Query / SWR docs                                                                                                                                           |
| Laravel                 | [laravel.com/docs](https://laravel.com/docs) (official)                                                                                                                                                                                                           |
| PHP                     | [php.net/manual](https://www.php.net/manual/en/) (official)                                                                                                                                                                                                       |
| Python                  | [docs.python.org](https://docs.python.org/3/) (official) + [fastapi.tiangolo.com](https://fastapi.tiangolo.com) + [docs.pydantic.dev](https://docs.pydantic.dev) + [docs.sqlalchemy.org](https://docs.sqlalchemy.org) + [docs.pytest.org](https://docs.pytest.org) |
| JavaScript              | [MDN Web Docs](https://developer.mozilla.org)                                                                                                                                                                                                                     |
| TypeScript              | [typescriptlang.org/docs](https://www.typescriptlang.org/docs/) (official)                                                                                                                                                                                        |
| Java / Spring Boot      | [docs.oracle.com/javase](https://docs.oracle.com/javase/tutorial/) + [docs.spring.io](https://docs.spring.io/spring-boot/docs/current/reference/html/)                                                                                                            |
| C# / .NET               | [learn.microsoft.com/dotnet/csharp](https://learn.microsoft.com/dotnet/csharp/) + [learn.microsoft.com/aspnet](https://learn.microsoft.com/aspnet/core/)                                                                                                          |
| Rust                    | [doc.rust-lang.org/book](https://doc.rust-lang.org/book/) + [doc.rust-lang.org/std](https://doc.rust-lang.org/std/) + [rust-lang.github.io/async-book](https://rust-lang.github.io/async-book/)                                                                   |
| Go                      | [go.dev/ref/spec](https://go.dev/ref/spec) + [go.dev/doc](https://go.dev/doc/) + [pkg.go.dev](https://pkg.go.dev/)                                                                                                                                                |
| C++                     | [en.cppreference.com](https://en.cppreference.com/w/)                                                                                                                                                                                                             |
| Vue                     | [vuejs.org/guide](https://vuejs.org/guide/) (official)                                                                                                                                                                                                            |
| Angular                 | [angular.dev](https://angular.dev)                                                                                                                                                                                                                                |
| Next.js                 | [nextjs.org/docs](https://nextjs.org/docs)                                                                                                                                                                                                                        |
| Node.js                 | [nodejs.org/docs](https://nodejs.org/docs/latest/api/) (official)                                                                                                                                                                                                 |
| SQL / Databases         | [postgresql.org/docs](https://www.postgresql.org/docs/current/) (official, primary reference) + [dev.mysql.com](https://dev.mysql.com/doc/refman/8.0/en/) (vendor differences)                                                                                    |
| DevOps (Docker/K8s/Git) | [docs.docker.com](https://docs.docker.com/) + [kubernetes.io/docs](https://kubernetes.io/docs/) + [git-scm.com](https://git-scm.com/doc) (official)                                                                                                               |
| System Design           | [aws.amazon.com/architecture](https://aws.amazon.com/architecture/) + [cloud.google.com/architecture](https://cloud.google.com/architecture) (official)                                                                                                           |
| General (strategy)      | Interview best practices (Tech Interview Handbook as an approach reference)                                                                                                                                                                                       |

## Curated modules and their basis

Every module cites its exact URLs in its `#### Sources` section. Summary:

- **React** — `fundamentals`, `hooks`, `forms`, `patterns-performance`, `data-fetching`,
  `modern-features` (18/19 + RSC), `testing`, `error-boundaries`, `accessibility`.
  Basis: react.dev; testing.dev; MDN/WAI-ARIA for accessibility.
- **Laravel** — `apis-rest`, `fundamentals`, `eloquent`, `middleware-auth`, `queues`,
  `security`, `testing`, `interview-essentials`. Basis: laravel.com/docs. + `_bank.md` (34 curated Qs: caching/events/broadcasting/notifications/artisan/rate-limiting).
- **PHP** — `fundamentals` (type juggling, arrays as HashTable, superglobals, exceptions),
  `oop` (interfaces vs abstract classes, traits, magic methods, late static binding, readonly),
  `internals-performance` (Zval/copy-on-write, OPcache, generators, cyclic GC), `security`
  (SQL injection/PDO, password_hash, XSS, CSRF/session). Basis: php.net/manual. Topics guided
  by xianyunyh/PHP-Interview and colinlet/PHP-Interview-QA (topic guide only, our own text, see
  source policy below).
- **Python** — `fundamentals`, `async` (GIL/asyncio), `fastapi-fundamentals` (routing/Pydantic v2),
  `fastapi-dependencies` (DI/auth/middleware), `data-orm` (SQLAlchemy 2.0/relational design),
  `testing` (pytest), `patterns-performance`. Basis: docs.python.org, fastapi.tiangolo.com,
  docs.pydantic.dev, docs.sqlalchemy.org, docs.pytest.org.
- **JavaScript** — `fundamentals`. Basis: MDN. + `_bank.md` (43 Qs: closures, prototypes, event loop, async, WeakMap, generators, Proxy, memory leaks).
- **TypeScript** — `fundamentals` (interfaces vs type aliases/structural typing, discriminated unions, narrowing, generics), `advanced-types` (utility types and how they're built, mapped types, conditional types/`infer`, template literal types, `satisfies`). Basis: typescriptlang.org/docs. Topics guided by aershov24/typescript-interview-questions (topic guide only, our own text, see source policy below).
- **Java / Spring Boot** — `fundamentals` (OOP, generics, collections, streams, memory model), `spring-boot` (IoC/DI, auto-config, REST, JPA, Security). Basis: docs.oracle.com/javase, docs.spring.io. + `_bank.md` (41 Qs).
- **C# / .NET** — `fundamentals` (value/ref types, generics, LINQ, async/await, GC), `aspnet` (middleware, DI, EF Core, minimal APIs, auth). Basis: learn.microsoft.com/dotnet. + `_bank.md` (43 Qs).
- **Rust** — `fundamentals` (ownership/borrowing/lifetimes, enums, traits, error handling, iterators), `systems` (concurrency, async/Futures, smart pointers, unsafe, performance). Basis: doc.rust-lang.org. + `_bank.md` (37 Qs).
- **Go** — `fundamentals` (goroutines, channels, interfaces, errors, slices/maps), `concurrency` (sync, context, fan-out/worker pool patterns, race detector, pprof). Basis: go.dev. + `_bank.md` (39 Qs).
- **C++** — `fundamentals` (RAII, smart pointers, move semantics, templates, inheritance/vtable), `modern` (STL, lambdas, concurrency, UB, modern patterns). Basis: en.cppreference.com. + `_bank.md` (40 Qs).
- **Vue** — `fundamentals` (Proxy-based reactivity with ref/reactive, Composition API vs Options API, computed vs watch, v-model/v-for internals), `advanced` (props/emits vs provide/inject, Composition API lifecycle hooks and cleanup, performance with v-memo/KeepAlive/defineAsyncComponent, Pinia). Basis: vuejs.org/guide, pinia.vuejs.org. Topics guided by sudheerj/vuejs-interview-questions (no LICENSE file → topic guide only).
- **Angular** — `fundamentals` (components, DI, lifecycle hooks, directives/pipes, Signals v17+), `advanced` (RxJS, routing/lazy loading, reactive forms, change detection, standalone components). Basis: angular.dev. + `_bank.md` (37 Qs).
- **Next.js** — `fundamentals` (App Router, Server vs Client Components, data fetching, Server Actions, rendering strategies), `advanced` (image/font optimization, middleware, auth, Route Handlers, 4 caching layers). Basis: nextjs.org/docs. + `_bank.md` (39 Qs).
- **Node.js** — `fundamentals` (libuv event loop phases, CommonJS vs ESM/interop, streams and backpressure, Buffer/binary), `async-performance` (worker_threads vs cluster vs child_process, EventEmitter and memory leaks, graceful shutdown/signals, diagnostics with perf_hooks/diagnostics_channel/clinic.js). Basis: nodejs.org/docs. Topics guided by ElemeFE/node-interview and Devinterview-io/node-interview-questions (topic guide only, our own text, see source policy below).
- **SQL** — `fundamentals` (JOIN types, 1NF-3NF normalization vs deliberate denormalization,
  B-tree indexes and the leftmost prefix rule, PK/FK and referential integrity), `query-optimization`
  (reading EXPLAIN ANALYZE, the N+1 problem, transactions and isolation levels, OFFSET vs keyset
  pagination), `schema-design` (one-to-many/many-to-many relationships, soft vs hard
  deletes, access-pattern-driven design, when NOT to use relational). Basis: postgresql.org/docs
  as the primary reference, dev.mysql.com/doc for vendor differences. Topics guided by
  PavelGrigoryevDS/awesome-data-analysis (topic guide only, our own text, see source policy
  below).
- **DevOps** — `docker` (images/layers and layer caching, containers vs VMs, multi-stage builds,
  Docker Compose), `kubernetes-basics` (Pod/Deployment/Service, ConfigMaps/Secrets, liveness vs
  readiness probes, replicas/HorizontalPodAutoscaler), `git-advanced` (rebase vs merge, interactive
  rebase, git bisect, recovery with reflog and secret cleanup with filter-repo). Basis:
  docs.docker.com, kubernetes.io/docs, git-scm.com/doc (Pro Git). Topics derived only from those
  official docs (our own text); no CC BY-NC or unlicensed repos were used as an authoring guide.
- **System Design** — `fundamentals` (vertical vs horizontal scaling, load balancing,
  caching strategies, CAP theorem in practice), `data-and-messaging` (database scaling with
  replicas vs sharding, SQL vs NoSQL as a system decision, message queues and asynchronous
  processing, leader-follower replication), `scenarios-and-reliability` (full URL-shortener
  scenario clarify→estimate→design→tradeoffs, API design at scale, reliability patterns). Basis:
  aws.amazon.com/architecture, docs.aws.amazon.com/wellarchitected, cloud.google.com/architecture,
  developer.mozilla.org, redis.io/docs, postgresql.org/docs. Topics also guided by
  donnemartin/system-design-primer (CC BY 4.0, see the special note in "Repos used ONLY as a
  topic guide" below).
- **General** — `technical-interview-strategy`. Basis: interview best practices +
  [Tech Interview Handbook](https://www.techinterviewhandbook.org/) (MIT) as an approach
  reference, cited inline. No unlicensed repos are used.

## Ingested banks (third-party text, attributed)

| File                  | Source                                                                                                                 | License                                | Notes                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `react/_bank.md`      | [sudheerj/reactjs-interview-questions](https://github.com/sudheerj/reactjs-interview-questions)                        | MIT (© Sudheer Jonna)                  | Filtered to signal questions (trivia/legacy discarded). 96 questions. See `scripts/ingest/adapters/react-sudheerj.mjs`.                                                                                                                                                                                                                                                                                 |
| `python/_bank.md`     | [DevLoversTeam/python-interview-questions](https://github.com/DevLoversTeam/python-interview-questions) (README.es.md) | MIT (© 2026 DevLovers)                 | Spanish edition. Filtered to signal (80/250; basic-method/definitional trivia discarded). See `scripts/ingest/adapters/python-devlovers.mjs`.                                                                                                                                                                                                                                                           |
| `laravel/_bank.md`    | [laravel.com/docs](https://laravel.com/docs) (curated)                                                                 | Curated, no third-party redistribution | 34 questions written from scratch citing official docs. Topics: caching, collections, events, advanced service container, broadcasting, file storage, notifications, artisan, rate limiting.                                                                                                                                                                                                            |
| `javascript/_bank.md` | [developer.mozilla.org](https://developer.mozilla.org) (curated)                                                       | Curated, no third-party redistribution | 43 questions written from scratch citing MDN. Topics not covered by fundamentals.md: TDZ, detailed hoisting, microtasks, bind/call/apply, currying, debounce/throttle, WeakMap/WeakSet, generators, ES modules, Proxy/Reflect, memory leaks, structuredClone. Repos consulted as a topic guide only: sudheerj/javascript-interview-questions, greatfrontend/top-javascript-interview-questions. |
| `java/_bank.md`       | [docs.spring.io](https://docs.spring.io) + [docs.oracle.com/javase](https://docs.oracle.com/javase/tutorial/) (curated) | Curated, no third-party redistribution | 41 questions written from scratch. Topics: OOP, generics, Collections, Streams, JMM, IoC/DI, auto-config, @Transactional, JPA N+1, Spring Security/JWT, Actuator, Caching, Profiles, testing. Repos consulted as a guide only: anjitagargi/JavaSpringBoot_Interview_Questions, aatul/Java-Interview-Questions-Answers.                                                                                   |
| `csharp/_bank.md`     | [learn.microsoft.com/dotnet](https://learn.microsoft.com/dotnet) (curated)                                             | Curated, no third-party redistribution | 43 questions written from scratch. Topics: value/ref types, boxing, generics, LINQ, async/await, GC, IDisposable, Span<T>, middleware, DI lifetimes, JWT, EF Core, IHostedService, IMemoryCache. Repos consulted as a guide only: hackerheap/dotnet-interviews, aershov24/c-sharp-interview-questions.                                                                                                   |
| `rust/_bank.md`       | [doc.rust-lang.org](https://doc.rust-lang.org) (curated)                                                               | Curated, no third-party redistribution | 37 questions written from scratch. Topics: ownership/borrow checker, lifetimes, enums/pattern matching, traits, generics, error handling, iterators, concurrency (Send/Sync), async/Futures, smart pointers, unsafe. Repo consulted as a guide only: imhq/rust-interview-handbook.                                                                                                                       |
| `go/_bank.md`         | [go.dev](https://go.dev) (curated)                                                                                     | Curated, no third-party redistribution | 39 questions written from scratch. Topics: goroutines/scheduler, channels, select, interfaces, nil interface gotcha, sentinel/wrapping errors, defer/panic/recover, slices/maps internals, context, sync primitives, data races, concurrency patterns, pprof, HTTP server, testing. Repo consulted as a guide only: shomali11/go-interview (code puzzles; no text copied). golang-design/go-questions (CC BY-NC) was not used. |
| `cpp/_bank.md`        | [en.cppreference.com](https://en.cppreference.com/w/) (curated)                                                        | Curated, no third-party redistribution | 40 questions written from scratch. Topics: RAII, smart pointers (unique/shared/weak), move semantics, Rule of 5/0, vtable/virtual destructor, slicing, templates, SFINAE, STL containers, lambdas, concurrency, UB, CRTP, pimpl, variant, C++20 concepts. Repo consulted as a guide only: nidhiupman568/C-PLUS-PLUS (no MIT license).                                                                 |
| `angular/_bank.md`    | [angular.dev](https://angular.dev) (curated)                                                                           | Curated, no third-party redistribution | 37 questions written from scratch. Topics: components, DI hierarchy, lifecycle hooks, directives, pipes, Signals, RxJS operators, routing/lazy loading, functional guards, reactive forms, change detection/OnPush, standalone, HTTP interceptors, testing. Repos consulted as a guide only: sudheerj/angular-interview-questions, Yonet/Angular-Interview-Questions (unlicensed).                   |
| `nextjs/_bank.md`     | [nextjs.org/docs](https://nextjs.org/docs) (curated)                                                                   | Curated, no third-party redistribution | 39 questions written from scratch. Topics: App Router vs Pages Router, Server vs Client Components, data fetching, Server Actions, rendering strategies (SSG/SSR/ISR/PPR), 4 caching layers, middleware, next/image, auth with Auth.js v5, Route Handlers, deployment. Repo consulted as a guide only: mrhrifat/nextjs-interview-questions (GPL-3.0 → topic guide only).                               |

## Repos used ONLY as a topic guide (not copied)

They helped decide topic/question coverage. Their text is **not** in the KB:

- [roadmap.sh](https://roadmap.sh) — topic taxonomy by role.
- [xianyunyh/PHP-Interview](https://github.com/xianyunyh/PHP-Interview) — PHP topics (no
  LICENSE file → topic guide only). Most of its topics already live in `general/`
  (DS&A, networking, Linux); the PHP-specific topics (Zval/HashTable, OOP) informed `php-oop`
  and `php-internals-performance`.
- [colinlet/PHP-Interview-QA](https://github.com/colinlet/PHP-Interview-QA) — PHP topics.
  **Note:** Apache-2.0 LICENSE (eligible for future ingestion via `_bank.md`). For now, topic
  guide only (security, OOP); the PHP content is written from scratch citing php.net.
- [kdn251/interviews](https://github.com/kdn251/interviews) — DS&A topics.
- [mostafaaElsherbiny/backend-interview-questions](https://github.com/mostafaaElsherbiny/backend-interview-questions) — backend/Laravel topics (unlicensed → guide only).
- [fgitpush/Top-Laravel-Interview-Questions-Wiki](https://github.com/fgitpush/Top-Laravel-Interview-Questions-Wiki) — Laravel topics (unlicensed → guide only).
- [aershov24/typescript-interview-questions](https://github.com/aershov24/typescript-interview-questions) — TypeScript topics (no LICENSE file → all-rights-reserved by default, topic guide only, text written from scratch).
- [sudheerj/vuejs-interview-questions](https://github.com/sudheerj/vuejs-interview-questions) — Vue topics (no LICENSE file → topic guide only, no text copied).
- [ElemeFE/node-interview](https://github.com/ElemeFE/node-interview) — Node.js topics. **Note:** it DOES have an MIT license, technically eligible for future ingestion via `_bank.md`, but here it was used only as a topic guide and the content is written from scratch citing nodejs.org.
- [Devinterview-io/node-interview-questions](https://github.com/Devinterview-io/node-interview-questions) — Node.js topics (no LICENSE file → all-rights-reserved by default, topic guide only, text written from scratch).
- [PavelGrigoryevDS/awesome-data-analysis](https://github.com/PavelGrigoryevDS/awesome-data-analysis) — curated link list (`#sql-databases` section) under CC0-1.0. Used only as a guide to which SQL topics/questions are common in interviews; no text was fetched or copied from the repo — the content of `sql/fundamentals.md`, `sql/query-optimization.md` and `sql/schema-design.md` is written from scratch citing only postgresql.org/docs and dev.mysql.com/doc.
- [donnemartin/system-design-primer](https://github.com/donnemartin/system-design-primer) — system design topics (scaling, caching, load balancing, databases, messaging, availability). **Special note:** unlike the other repos in this list, this one IS permissively licensed (CC BY 4.0), so it would legally be eligible even to cite or adapt text with attribution. It's kept in this "topic guide only" section by house-style CHOICE, not because copying was blocked: all content in `system-design/fundamentals.md`, `system-design/data-and-messaging.md` and `system-design/scenarios-and-reliability.md` is written from scratch citing official sources (AWS, Google Cloud, MDN, Redis, PostgreSQL), and the primer is referenced as an optional additional source in the `#### Sources` of the concepts where it adds topic coverage, always attributed.

> **Out of scope (NC / do not use):** repos under CC BY-NC (e.g. bregman-arie/devops-exercises,
> golang-design/go-questions) are **not** used as an authoring guide nor cited as topic
> provenance. The DevOps and Go content is based only on official documentation.
