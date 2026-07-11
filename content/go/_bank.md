---
stack: go
kind: question-bank
source: curated
sourceUrl: https://go.dev
license: curated
copyright: Written from scratch citing official documentation
---

## Interview Questions

### ¿Cuál es la diferencia entre una goroutine y un thread del sistema operativo?
Una goroutine comienza con un stack de aproximadamente 2 KB que crece y se contrae dinámicamente; un thread del SO tiene un stack fijo de 1-8 MB. El runtime de Go usa un scheduler M:N que multiplexa G goroutines sobre M threads del SO usando P procesadores lógicos, con cambios de contexto en espacio de usuario sin llamadas al kernel. Esto permite que una aplicación mantenga cientos de miles de goroutines activas simultáneamente con un uso de memoria y CPU razonable. El costo de crear una goroutine es una asignación de stack pequeña; crear un thread involucra syscalls y registros del kernel.
[go.dev/doc/faq#goroutines, go.dev/ref/mem]

### ¿Qué controla GOMAXPROCS y cuál es su valor por defecto?
`GOMAXPROCS` controla el número de procesadores lógicos (P) que el scheduler de Go usa simultáneamente, lo cual limita el paralelismo real: cuántas goroutines pueden ejecutarse físicamente al mismo tiempo. Desde Go 1.5, el valor por defecto es `runtime.NumCPU()`, el número de CPUs lógicas disponibles. Cambiar `GOMAXPROCS` a 1 fuerza ejecución secuencial entre goroutines (concurrencia sin paralelismo). En contenedores, Go 1.25+ lee el quota de CPU de cgroups automáticamente; en versiones anteriores puede ser necesario ajustarlo manualmente con `runtime.GOMAXPROCS`.
[go.dev/doc/faq#parallel_slow, pkg.go.dev/runtime#GOMAXPROCS]

### ¿Cuál es la diferencia entre un buffered y un unbuffered channel?
Un unbuffered channel (`make(chan T)`) requiere que emisor y receptor estén listos simultáneamente: el emisor bloquea hasta que alguien recibe, creando una sincronización punto a punto. Un buffered channel (`make(chan T, n)`) permite que el emisor continúe mientras haya capacidad en el buffer, bloqueando solo cuando está lleno. Los unbuffered son más seguros para sincronización explícita; los buffered ayudan a desacoplar productores y consumidores con velocidades diferentes. Usar un buffer demasiado grande puede ocultar problemas de backpressure.
[go.dev/ref/spec#Channel_types, go.dev/doc/effective_go#channels]

### ¿Cómo funciona el statement select y qué pasa cuando múltiples casos están listos?
`select` bloquea hasta que al menos uno de sus casos de channel pueda proceder. Si múltiples casos están listos simultáneamente, Go elige uno de forma aleatoria (no con prioridad ni FIFO), lo cual evita starvation sistemático. Un caso `default` hace que select sea no-bloqueante: si ningún channel está listo, ejecuta `default` inmediatamente. El patrón de cancelación con `done channel` usa select para que los workers detecten cierre: `case <-ctx.Done(): return`. Select solo opera sobre canales; no puede esperar por mutexes ni condiciones arbitrarias.
[go.dev/ref/spec#Select_statements]

### ¿Cómo implementarías cancelación de goroutines en Go? ¿Cuáles son los patrones disponibles?
El patrón idiomático es un **done channel** o, mejor aún, `context.WithCancel`. El caller crea un contexto cancelable y lo pasa a las goroutines; cuando llama `cancel()`, el channel `ctx.Done()` se cierra y todas las goroutines que lo monitorizan pueden terminar limpiamente. Para cancelación con timeout se usa `context.WithTimeout`. El antipatrón es matar goroutines externamente: Go no tiene ese mecanismo; las goroutines deben cooperar comprobando la señal de cancelación en sus puntos de bloqueo.

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
go worker(ctx)
```
[go.dev/blog/pipelines, pkg.go.dev/context]

### ¿Qué es el implicit interface satisfaction de Go y cómo difiere de Java o C#?
En Go no existe la palabra clave `implements`: un tipo satisface una interfaz si implementa todos sus métodos, punto. El compilador verifica esto en tiempo de compilación sin declaración explícita. Esto es duck typing estructural con verificación estática. La ventaja es el desacoplamiento: una librería puede definir una interfaz y cualquier tipo externo que tenga los métodos la satisface sin modificar el tipo. En Java/C# el tipo debe declarar `implements Interface`, creando acoplamiento al nombre de la interfaz. Go permite retrofitting: hacés que un tipo existente satisfaga una interfaz nueva sin tocar su código fuente.
[go.dev/ref/spec#Interface_types, go.dev/doc/effective_go#interfaces]

### ¿Qué son los errores centinela en Go y cuándo los usás?
Los errores centinela son variables de error exportadas que actúan como tokens de identidad: `var ErrNotFound = errors.New("not found")`. Se usan cuando el caller necesita tomar decisiones basadas en el tipo de error específico. Con `errors.Is(err, ErrNotFound)` el caller puede verificar si el error (o cualquier error que lo envuelva en la cadena de wrapping) es ese sentinela. El antipatrón es comparar cadenas de error: `err.Error() == "not found"` es frágil. Los errores centinela son el equivalente Go a las excepciones tipadas de otros lenguajes, pero sin el overhead del control flow de excepciones.
[go.dev/blog/go1.13-errors, pkg.go.dev/errors]

### ¿Qué hace `fmt.Errorf` con el verbo `%w` y cómo afecta a errors.Is/errors.As?
`%w` crea un error que envuelve al error original, preservando la cadena de errores. El error resultante implementa el método `Unwrap()` que retorna el error envuelto. `errors.Is` y `errors.As` recorren esta cadena de Unwrap hasta encontrar match. Esto permite agregar contexto a los errores en cada capa sin perder la capacidad de inspección del caller:

```go
err = fmt.Errorf("repo.FindUser: %w", ErrNotFound)
errors.Is(err, ErrNotFound) // true, aunque envuelto
```

Sin `%w` (usando `%v`), el error envuelto se convierte en un string y la cadena se rompe. La regla: usá `%w` siempre que quieras que el error sea inspeccionable; usá `%v` solo si querés ocultar el error original (por ejemplo, no exponer detalles internos).
[go.dev/blog/go1.13-errors, pkg.go.dev/fmt]

### ¿Cuándo usás panic y recover en Go? ¿Qué antipatrones deberías evitar?
`panic` es para condiciones que indican un bug en el programa (invariantes rotos, nil dereferences, index out of bounds). Las librerías no deberían hacer panic visible a los callers; en cambio, en funciones internas que solo pueden ser llamadas correctamente, panic con un mensaje claro ayuda al debugging. `recover` solo tiene sentido dentro de un `defer` y permite que un servidor HTTP o proceso long-running capture un panic y lo convierta en un error en lugar de crashear. El antipatrón es usar panic/recover como mecanismo de control flow normal en lugar de retornar `error`: complica la composición, viola las expectativas de los callers, y hace más difícil el análisis estático.
[go.dev/blog/defer-panic-and-recover, go.dev/doc/effective_go#panic]

### ¿Cuál es la diferencia entre `defer`, y cuándo se evalúan sus argumentos?
`defer` programa la ejecución de una función para cuando la función que la contiene retorne, en orden LIFO (el último defer declarado se ejecuta primero). Los **argumentos** de la función diferida se evalúan en el momento de la declaración `defer`, no al ejecutarse. Las **variables capturadas por closure** sí reflejan el valor al momento de ejecución:

```go
x := 1
defer fmt.Println(x) // imprime 1, x evaluado ahora
defer func() { fmt.Println(x) }() // imprime 2, x evaluado al retornar
x = 2
```

`defer` tiene un overhead pequeño per-call pero despreciable en la mayoría de los casos. En código de performance crítico en loops muy tight puede ser relevante.
[go.dev/blog/defer-panic-and-recover, go.dev/ref/spec#Defer_statements]

### ¿Cómo funciona internamente un slice en Go? ¿Qué contiene su header?
Un slice es un struct de tres campos: un puntero al array subyacente, la longitud (`len`) y la capacidad (`cap`). El array vive en el heap; el header puede estar en el stack. Al pasar un slice a una función se copia el header (3 words), no el array. Modificar elementos dentro de la función afecta al array original; reasignar el slice (append que excede cap) no afecta al caller porque el nuevo header queda en la función. Este modelo explica por qué `append` debe asignarse al resultado: `s = append(s, x)` actualiza el header del caller si el array creció.
[go.dev/blog/slices-intro, go.dev/ref/spec#Slice_types]

### ¿Qué pasa exactamente cuando `append` excede la capacidad de un slice?
Go asigna un nuevo array backing con capacidad mayor (heurísticamente el doble para slices pequeños; proporcionalmente menos para grandes), copia todos los elementos al nuevo array, y retorna un nuevo header con el nuevo puntero, la nueva longitud y la nueva capacidad. El array original no se libera inmediatamente; si algún otro slice apunta a él, seguirá vivo hasta que no haya referencias. Por eso un slice pequeño puede retener un array grande en memoria: si tenés `bigSlice[:5]`, el GC no puede colectar el array original. La solución es `copy` a un slice nuevo del tamaño exacto necesario.
[go.dev/blog/slices-intro, go.dev/ref/spec#Appending_and_copying_slices]

### ¿Por qué la iteración sobre un map en Go es no determinista?
El runtime de Go randomiza deliberadamente el orden de iteración de maps para evitar que el código dependa de un orden particular, lo cual sería un bug latente. La semántica oficial es que el orden de iteración no está definido. Esta decisión fue intencional: en versiones tempranas de Go el orden era accidentalmente consistente en muchos casos, y código que dependía de eso existía en producción. Si necesitás orden determinista, extrae las claves en un slice, ordénalas con `sort.Strings`, e itera el slice.
[go.dev/ref/spec#For_range, go.dev/blog/maps]

### ¿Cuál es la diferencia entre un nil map y un map inicializado vacío?
`var m map[string]int` declara un nil map: leer de él retorna el zero value del tipo (no panic), pero escribir produce panic. `m = make(map[string]int)` crea un map vacío listo para lecturas y escrituras. La distinción importa en structs: un campo map declarado como `map[K]V` es nil hasta que se inicializa. La forma idiomática de inicializar en la declaración es `map[string]int{}` o `make(map[string]int)`. Para verificar existencia usar el two-value form: `v, ok := m[key]`.
[go.dev/ref/spec#Map_types, go.dev/blog/maps]

### ¿Cómo funciona sync.Mutex y cuál es el patrón correcto para usarlo?
`sync.Mutex` garantiza exclusión mutua: solo una goroutine puede tener el lock en un momento dado. `Lock()` bloquea si el mutex ya está adquirido; `Unlock()` lo libera. El patrón correcto es `defer mu.Unlock()` inmediatamente después de `mu.Lock()`, lo que garantiza la liberación incluso si la función hace panic o retorna en múltiples puntos. No se debe copiar un Mutex después de primer uso (el `go vet` detecta esto). No se puede llamar `Lock` recursivamente desde la misma goroutine (deadlock). El zero value de `sync.Mutex` es un mutex no bloqueado listo para usar.
[pkg.go.dev/sync#Mutex, go.dev/ref/spec]

### ¿Qué es sync.Once y para qué casos lo usarías?
`sync.Once` garantiza que la función pasada a `Do` se ejecute exactamente una vez, incluso si múltiples goroutines la llaman concurrentemente. La primera goroutine en llegar ejecuta la función; las demás bloquean hasta que termina, y luego continúan sin ejecutarla. Es el mecanismo correcto para inicialización lazy de singletons y recursos costosos. A diferencia de un mutex con un flag booleano, `Once` es atómico y no tiene el problema de double-checked locking. No se puede reinicializar un `sync.Once`; si necesitás resetear, usá un nuevo `sync.Once`.
[pkg.go.dev/sync#Once]

### ¿Qué es context.WithTimeout vs context.WithDeadline? ¿Cuándo usarías cada uno?
`WithTimeout` recibe una duración relativa: `5 * time.Second` cancela el contexto 5 segundos después de la llamada. `WithDeadline` recibe un instante absoluto: `time.Now().Add(5 * time.Second)` es equivalente pero puede expresarse como `time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)` para un deadline fijo. Usás `WithTimeout` para "esta operación no puede tardar más de N segundos"; usás `WithDeadline` cuando hay un SLA o ventana de tiempo absoluta que respetar. En ambos casos el `cancel` retornado debe llamarse con `defer cancel()` para liberar recursos aunque la operación termine antes.
[pkg.go.dev/context, go.dev/blog/context]

### ¿Por qué el contexto en Go se pasa como parámetro y no se guarda en un struct?
Guardar el contexto en un struct lo oculta y rompe la propagación explícita por la cadena de llamadas. El propósito del contexto es transportar cancelación y deadlines a través de una request; si vive en un struct, es imposible saber qué contexto usan las operaciones internas sin leer la implementación. La convención Go de pasarlo como primer parámetro hace el alcance de cancelación explícito y auditable. La guía oficial es clara: "Do not store Contexts inside a struct type; instead, pass a Context explicitly to each function that needs it."
[go.dev/blog/context-and-structs, pkg.go.dev/context]

### ¿Qué es una data race en Go y cuál es el impacto en producción?
Una data race es acceso concurrente sin sincronización a la misma variable, con al menos una escritura. El impacto es no determinista: valores silenciosamente corrompidos, crashes esporádicos en producción difíciles de reproducir, o resultados inconsistentes que varían entre ejecuciones y entornos. El Go race detector (`-race`) detecta races en tiempo de ejecución pero no puede probar su ausencia. En producción, una data race en un map puede causar un panic con "concurrent map read and map write". Los canales y sync primitives correctamente usados son las soluciones.
[go.dev/doc/articles/race_detector, go.dev/blog/race-detector]

### ¿Cómo funciona el race detector de Go? ¿Qué overhead tiene?
El race detector instrumenta el binario compilado con `-race` para rastrear todos los accesos a memoria y construir happens-before edges entre operaciones sincronizadas (channel ops, mutex lock/unlock, etc.). En runtime, verifica si hay accesos concurrentes a la misma dirección sin una relación happens-before entre ellos; si los encuentra, imprime un reporte con los stack traces de ambas goroutines. El overhead es 5-10x en tiempo de CPU y 2-5x en memoria. Se usa en tests (`go test -race ./...`) y en builds de staging/CI pero raramente en binarios de producción.
[go.dev/doc/articles/race_detector, go.dev/blog/race-detector]

### ¿Qué es el fan-out/fan-in pattern en Go y cuándo lo usarías?
Fan-out distribuye trabajo de un canal de entrada a múltiples goroutines workers en paralelo. Fan-in recolecta resultados de múltiples canales de salida en uno solo. El patrón sirve para paralelizar operaciones I/O-bound o CPU-bound donde el throughput total supera lo que una goroutine puede procesar. Fan-in suele implementarse con una goroutine que usa `sync.WaitGroup` para esperar que todos los productores terminen antes de cerrar el canal de salida. La variante moderna usa `errgroup` para propagar errores y cancelar el contexto si algún worker falla.
[go.dev/blog/pipelines, pkg.go.dev/golang.org/x/sync/errgroup]

### ¿Cuál es la diferencia entre un worker pool y un semáforo con buffered channel?
Un worker pool crea N goroutines fijas que consumen de un canal de jobs compartido: las goroutines viven durante toda la vida del pool, ideal para trabajo de larga duración o cuando la overhead de crear goroutines es relevante. Un semáforo con buffered channel (`make(chan struct{}, N)`) limita la concurrencia sin reutilizar goroutines: cada tarea lanza su propia goroutine pero solo N pueden estar activas simultáneamente. El semáforo es más simple de implementar y adecuado cuando las goroutines son de vida corta. Ambos previenen que un burst de trabajo sature el sistema.
[go.dev/blog/pipelines, pkg.go.dev/golang.org/x/sync/semaphore]

### ¿Qué es el escape analysis en Go y por qué importa para la performance?
El escape analysis determina en tiempo de compilación si un valor puede vivir en el stack de la goroutine o debe escapar al heap. Los valores en stack no requieren GC y se asignan/liberan en O(1); los valores en heap generan presión sobre el GC. Un valor escapa cuando: se retorna su puntero, se asigna a una interfaz, o se almacena en una estructura que ya está en el heap. Se puede ver las decisiones con `go build -gcflags='-m' .`. Reducir escapes innecesarios mejora throughput al reducir allocations y pauses del GC.
[go.dev/doc/faq#stack_or_heap, go.dev/doc/diagnostics]

### ¿Cómo se escribe un benchmark en Go y qué métricas reporta?
Un benchmark es una función `func BenchmarkX(b *testing.B)` en un archivo `_test.go`. La función ejecuta el código bajo prueba en un loop `for i := 0; i < b.N; i++`; el framework ajusta `b.N` automáticamente para que la duración sea estadísticamente significativa. `b.ReportAllocs()` activa el reporte de allocations. Se corre con `go test -bench=. -benchmem`; reporta ns/op (nanosegundos por operación), B/op (bytes allocados por operación) y allocs/op (número de allocations). `b.ResetTimer()` descarta el tiempo de setup. `b.RunParallel` permite benchmarks de concurrencia.
[pkg.go.dev/testing#B, go.dev/doc/diagnostics]

### ¿Qué es pprof y cuándo lo activarías en producción?
`pprof` es el profiler integrado de Go. Importando `net/http/pprof` se registran handlers en `/debug/pprof/` que exponen perfiles de CPU, heap, goroutines, y bloqueos. En producción generalmente se habilita detrás de autenticación o en un puerto interno no expuesto al exterior. Para capturar un CPU profile de 30 segundos: `go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30`. El perfil de goroutines es útil para detectar goroutine leaks: si el número de goroutines crece indefinidamente con la carga, hay un leak.
[go.dev/blog/pprof, pkg.go.dev/net/http/pprof]

### ¿Cuál es la forma idiomática de estructurar un servidor HTTP en Go?
El paquete `net/http` incluye un servidor production-ready. El patrón estándar es registrar handlers con `http.HandleFunc` o en un `http.ServeMux` y llamar `http.ListenAndServe`. Para producción se prefiere crear un `http.Server` explícito con timeouts configurados (`ReadTimeout`, `WriteTimeout`, `IdleTimeout`) ya que los defaults de cero no protegen contra slow-loris attacks. Los handlers reciben `(http.ResponseWriter, *http.Request)` y el context de la request se accede con `r.Context()` para cancelación.

```go
srv := &http.Server{
	Addr:         ":8080",
	ReadTimeout:  5 * time.Second,
	WriteTimeout: 10 * time.Second,
	IdleTimeout:  120 * time.Second,
	Handler:      mux,
}
```
[pkg.go.dev/net/http, go.dev/doc/articles/wiki]

### ¿Cómo manejás shutdown graceful en un servidor HTTP Go?
El método `srv.Shutdown(ctx)` deja de aceptar nuevas conexiones, espera a que las conexiones activas terminen (respetando el deadline del contexto), y luego retorna. El patrón estándar es escuchar señales del OS con `signal.NotifyContext` o `signal.Notify`, y cuando llega `SIGTERM`/`SIGINT`, llamar a `Shutdown` con un contexto de timeout. `ListenAndServe` retorna `http.ErrServerClosed` después de un Shutdown exitoso; ese error debe tratarse como exitoso.

```go
ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
defer stop()
<-ctx.Done()
shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()
srv.Shutdown(shutdownCtx)
```
[pkg.go.dev/net/http#Server.Shutdown, go.dev/doc/faq]

### ¿Cómo escribís tests en Go? ¿Qué convenciones sigue el toolchain?
Los tests viven en archivos `*_test.go` y el toolchain los excluye del build normal. Las funciones de test tienen la firma `func TestX(t *testing.T)`. `t.Errorf` registra un fallo y continúa; `t.Fatalf` registra y detiene el test inmediatamente. Los table-driven tests son el patrón idiomático: un slice de structs con casos nombrados y un loop `for _, tc := range cases { t.Run(tc.name, ...) }`. Los subtests (`t.Run`) permiten correr un caso específico con `go test -run TestFoo/case_name`. No existe un framework de testing estándar distinto al built-in; librerías como `testify` son populares pero opcionales.
[pkg.go.dev/testing, go.dev/doc/code#Testing]

### ¿Qué es el table-driven testing y por qué es el patrón preferido en Go?
El table-driven testing organiza múltiples casos de prueba en un slice de structs: input, expected output, y nombre de caso. Un único loop itera los casos y llama `t.Run(tc.name, func(t *testing.T){...})` para que cada uno sea un subtest con nombre. Las ventajas son: agregar un caso nuevo requiere una línea; los fallos reportan el nombre del caso; los subtests pueden correrse individualmente; la lógica de assert está en un solo lugar. Es el patrón que usa la librería estándar de Go internamente y es el estilo esperado en code reviews.
[go.dev/doc/code#Testing, pkg.go.dev/testing]

### ¿Qué son los modules en Go y cómo reemplazaron a GOPATH?
Los Go modules (introducidos en Go 1.11, default desde 1.16) son el sistema de gestión de dependencias oficial. Un módulo está definido por un `go.mod` en la raíz del repositorio que declara el module path, la versión de Go requerida, y las dependencias con sus versiones exactas. `go.sum` contiene hashes criptográficos para verificar integridad. Los módulos eliminan la necesidad de GOPATH al permitir que proyectos vivan en cualquier directorio. El modelo de versioning sigue semver; para v2+ el module path incluye el major: `module github.com/pkg/v2`.
[go.dev/blog/using-go-modules, go.dev/ref/mod]

### ¿Qué hace `go mod tidy` y cuándo deberías correrlo?
`go mod tidy` sincroniza `go.mod` y `go.sum` con el código fuente actual: agrega dependencias importadas que faltan en `go.mod` y elimina dependencias declaradas que ya no se importan. Debe correrse después de agregar/remover imports, antes de commitear cambios a `go.mod`, y como paso en CI para detectar inconsistencias. También actualiza el `go.sum` con los hashes necesarios. En proyectos con múltiples módulos, `go work sync` cumple un rol similar para workspaces.
[go.dev/ref/mod#go-mod-tidy, go.dev/blog/using-go-modules]

### ¿Cuándo usás sync.Pool y cuáles son sus limitaciones?
`sync.Pool` reduce la presión del GC reutilizando objetos temporales de corta vida: buffers, encoders, structs de request. El caso clásico es un pool de `bytes.Buffer` para evitar allocations en paths de alta frecuencia. Las limitaciones son importantes: el pool puede vaciarse en cualquier GC cycle (no garantiza retención); los objetos recuperados del pool pueden ser nil si el pool está vacío (siempre verificar con type assertion); no se debe guardar punteros a objetos pooled fuera del scope de uso. `New func() any` se llama cuando el pool está vacío y hay que crear un objeto nuevo.
[pkg.go.dev/sync#Pool, go.dev/doc/faq]

### ¿Cómo se implementa el garbage collector de Go y qué impacto tiene en la latencia?
El GC de Go es un recolector concurrente tri-color de mark-and-sweep que corre mayormente en paralelo con el programa, con stop-the-world (STW) pausas breves para iniciar y finalizar cada ciclo. Desde Go 1.14+, las pausas STW son típicamente < 1ms. El GC se activa cuando el heap crece hasta el doble del tamaño al final del último GC (controlado por `GOGC`; default 100%). Para servicios con latencia estricta, reducir allocations (escape analysis, pools) es más efectivo que ajustar `GOGC`. En Go 1.21+ se puede usar `runtime/debug.SetMemoryLimit` para controlar cuándo el GC agresivamente.
[go.dev/doc/gc-guide, pkg.go.dev/runtime/debug]

### ¿Cómo funciona `defer` con valores de retorno nombrados?
Con valores de retorno nombrados, el `defer` puede modificar el valor de retorno de la función porque la variable existe en el scope de la función y el defer tiene acceso a ella en el momento de ejecución:

```go
func divide(a, b float64) (result float64, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("recovered: %v", r)
		}
	}()
	result = a / b
	return // retorna result y err tal como están en ese momento
}
```

Este patrón es la forma estándar de convertir panics en errores en funciones públicas de librerías. Sin retorno nombrado, el defer no puede modificar el valor de retorno ya que opera sobre una copia.
[go.dev/ref/spec#Defer_statements, go.dev/blog/defer-panic-and-recover]

### ¿Qué es una closure en Go y qué gotcha tiene en goroutines con loops?
Una closure es una función que captura variables de su entorno léxico por referencia. El gotcha clásico con goroutines en loops es capturar la variable del loop:

```go
// BUG: todas las goroutines capturan la misma variable 'i'
for i := 0; i < 5; i++ {
	go func() { fmt.Println(i) }() // puede imprimir 5,5,5,5,5
}

// Fix: pasar como argumento (copia)
for i := 0; i < 5; i++ {
	go func(n int) { fmt.Println(n) }(i)
}

// Fix alternativo (Go 1.22+): cada iteración tiene su propia 'i'
```

En Go 1.22+, las variables de loop tienen scope per-iteración, eliminando este bug. En versiones anteriores, la solución es siempre pasar la variable como argumento a la goroutine.
[go.dev/ref/spec#Function_literals, go.dev/doc/faq#closures_and_goroutines]

### ¿Qué es el método Stringer y cómo lo usás?
`fmt.Stringer` es la interfaz `{ String() string }` del paquete `fmt`. Cualquier tipo que implemente `String() string` controla cómo se representa cuando se imprime con `fmt.Println`, `%v`, `%s`, etc. Es el equivalente Go de `toString()` en Java. Implementarlo en tus tipos mejora la debuggabilidad y los logs:

```go
type Status int

const (
	Active Status = iota
	Inactive
	Banned
)

func (s Status) String() string {
	switch s {
	case Active: return "active"
	case Inactive: return "inactive"
	case Banned: return "banned"
	default: return fmt.Sprintf("Status(%d)", int(s))
	}
}
```
[pkg.go.dev/fmt#Stringer, go.dev/doc/effective_go#printing]

### ¿Cuál es el zero value de los tipos principales en Go y por qué importa?
Go garantiza que toda variable declarada sin inicializar tiene un **zero value** predecible: `0` para enteros, `0.0` para floats, `false` para bool, `""` para strings, `nil` para punteros, interfaces, slices, maps, channels y funciones. Los structs tienen el zero value de cada campo. Esto importa porque eliminó la clase entera de bugs de "variable no inicializada" de otros lenguajes. Un `sync.Mutex` declarado como `var mu sync.Mutex` es inmediatamente usable sin constructor. Un slice `nil` es iterable con `range` y pasable a funciones que usan `append`. Diseñar tipos cuyo zero value sea útil es una práctica Go importante.
[go.dev/ref/spec#The_zero_value, go.dev/doc/effective_go#zero_value]

### ¿Qué es goroutine leak y cómo lo detectás y prevenís?
Un goroutine leak ocurre cuando se lanzan goroutines que nunca terminan: quedan bloqueadas en un channel send/receive sin receiver/sender, o en un loop infinito sin señal de cancelación. Con el tiempo acumulan memoria y CPU. Se detectan con el profile de goroutines de pprof: si el número de goroutines crece monotónicamente con la carga o no decrece al terminar requests, hay un leak. La prevención es siempre pasar un context a las goroutines y verificar `ctx.Done()`, y siempre cerrar los channels de los que una goroutine está leyendo en range. La regla: quien lanza una goroutine es responsable de saber cómo termina.
[go.dev/doc/diagnostics, pkg.go.dev/net/http/pprof]

### ¿Cuándo usarías un puntero en Go y cuándo un valor?
Los punteros en Go son explícitos y tienen reglas claras. Usás puntero cuando: el tipo es grande y copiarlo es costoso, necesitás que la función mute el receptor, el zero value no es un valor válido (necesitás distinguir "no presente" de "cero"), o el tipo contiene mutex u otro tipo que no se debe copiar. Usás valor cuando: el tipo es pequeño (int, bool, pequeños structs), quiere semántica de copia inmutable, o es un tipo que el compilador puede optimizar en el stack. Los interfaces siempre almacenan punteros internamente cuando el tipo concreto es grande, por lo que no hay ventaja en pasar `*T` a una interfaz si `T` ya satisface la interfaz.
[go.dev/doc/faq#methods_on_values_or_pointers, go.dev/doc/effective_go#pointers_vs_values]
