---
stack: go
id: go-concurrency
title: "Go: Patrones de concurrencia y context"
area: Backend
priority: high
resourceLabel: Go Concurrency Patterns
resourceUrl: https://go.dev/blog/pipelines
---

## Summary
Los patrones de concurrencia de producción en Go: sync primitives para estado compartido, el paquete context para cancelación y deadlines, patrones clásicos como fan-out/fan-in y worker pools, data races y cómo detectarlas, y las herramientas de profiling para entender el comportamiento de un programa en runtime.

## Concepts

### sync primitives
#### Details
El paquete `sync` provee los bloques de construcción para proteger estado compartido. `sync.Mutex` garantiza acceso exclusivo: `Lock` bloquea si ya está adquirido, `Unlock` lo libera. `sync.RWMutex` permite lecturas concurrentes (`RLock`/`RUnlock`) pero escrituras exclusivas (`Lock`/`Unlock`): ideal para caches y estructuras leídas con frecuencia pero raramente escritas. El patrón idiomático es `defer mu.Unlock()` inmediatamente después de `mu.Lock()` para garantizar la liberación incluso en caso de panic.

`sync.WaitGroup` coordina la finalización de un conjunto de goroutines: `Add(n)` antes de lanzar, `Done()` al terminar (típicamente con `defer`), `Wait()` para bloquear hasta que el contador llegue a cero. `sync.Once` garantiza que una función se ejecute exactamente una vez, incluso bajo concurrencia; es el mecanismo correcto para inicialización lazy de singletons. `sync.Pool` reduce la presión sobre el GC reutilizando objetos temporales; adecuado para buffers o structs de corta vida de alto throughput, pero con advertencia: el pool puede vaciarse en cualquier GC.

La elección entre Mutex y RWMutex no es trivial: `RWMutex` agrega overhead de coordinación y solo gana cuando hay dominancia clara de lecturas (típicamente ≥ 5:1 sobre escrituras). Para contadores de alta frecuencia, `sync/atomic` es más eficiente que un mutex.

#### Examples
Mutex y RWMutex con defer
```go
type SafeCache struct {
	mu    sync.RWMutex
	items map[string]string
}

func (c *SafeCache) Get(key string) (string, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	v, ok := c.items[key]
	return v, ok
}

func (c *SafeCache) Set(key, value string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.items[key] = value
}
```

sync.Once para inicialización lazy
```go
type DB struct{ conn *sql.DB }

var (
	instance *DB
	once     sync.Once
)

func GetDB() *DB {
	once.Do(func() {
		instance = &DB{conn: openConnection()}
	})
	return instance
}
```

sync.Pool para reutilizar buffers
```go
var bufPool = sync.Pool{
	New: func() any { return new(bytes.Buffer) },
}

func process(data []byte) string {
	buf := bufPool.Get().(*bytes.Buffer)
	buf.Reset()
	defer bufPool.Put(buf)
	buf.Write(data)
	return buf.String()
}
```

#### Sources
- [pkg.go.dev/sync](https://pkg.go.dev/sync)
- [Go blog, Share memory by communicating](https://go.dev/blog/codelab-share)
- [Go spec, Package sync](https://go.dev/ref/spec)

---

### El paquete `context`
#### Details
El paquete `context` propaga cancelación, deadlines y valores a lo largo de una cadena de llamadas. La convención en Go es que el primer parámetro de cualquier función que haga I/O, llame a servicios externos, o pueda bloquearse por tiempo indeterminado sea `ctx context.Context`. Esto no es una sugerencia de estilo: es el mecanismo que permite que un handler HTTP cancele todas las operaciones en curso cuando el cliente desconecta.

`context.WithCancel` retorna un contexto hijo y una función `cancel()`; llamar a `cancel` cierra el channel `ctx.Done()`. `context.WithTimeout` y `context.WithDeadline` hacen lo mismo pero también cancelan automáticamente cuando expira el tiempo. La diferencia: **timeout** es una duración relativa al momento de la llamada (`5 * time.Second`); **deadline** es un instante absoluto (`time.Now().Add(5s)` es equivalente pero se puede expresar como hora concreta). Ambos retornan un cancel que igual debe llamarse con `defer cancel()` para liberar recursos inmediatamente si termina antes del timeout.

Los valores en context (`context.WithValue`) deben usarse con moderación: solo para datos que atraviesan límites de proceso (request ID, auth token, trace ID), no como substituto de parámetros de función. Las keys deben ser tipos no exportados para evitar colisiones entre paquetes.

#### Examples
WithCancel y propagación a workers
```go
func doWork(ctx context.Context) error {
	for {
		select {
		case <-ctx.Done():
			return ctx.Err() // context.Canceled o context.DeadlineExceeded
		default:
			// hacer trabajo...
		}
	}
}

ctx, cancel := context.WithCancel(context.Background())
defer cancel()
go doWork(ctx)

time.Sleep(100 * time.Millisecond)
cancel() // detiene doWork
```

WithTimeout en llamada HTTP
```go
func fetchData(url string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel() // libera recursos si termina antes del timeout

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetchData: %w", err)
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}
```

Values para request-scoped metadata
```go
type contextKey string

const requestIDKey contextKey = "requestID"

func WithRequestID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, requestIDKey, id)
}

func RequestIDFromContext(ctx context.Context) (string, bool) {
	id, ok := ctx.Value(requestIDKey).(string)
	return id, ok
}
```

#### Sources
- [pkg.go.dev/context](https://pkg.go.dev/context)
- [Go blog, Go Concurrency Patterns: Context](https://go.dev/blog/context)
- [Go blog, Contexts and structs](https://go.dev/blog/context-and-structs)

---

### Patrones de concurrencia
#### Details
**Fan-out/fan-in**: el fan-out distribuye trabajo de un canal de entrada a múltiples workers goroutines; el fan-in merge múltiples canales de salida en uno solo. El patrón es poderoso para paralelizar trabajo CPU-bound o I/O-bound: N workers procesan en paralelo y sus resultados se consolidan. El fan-in suele implementarse con `sync.WaitGroup` y una goroutine que cierra el canal de output cuando todos terminan.

El **pipeline pattern** encadena etapas donde cada una es una función que consume de un channel y produce a otro. Cada etapa puede tener múltiples instancias (fan-out). El canal `done`/`context` fluye ortogonalmente para cancelar el pipeline entero. El **worker pool** es una variante donde N goroutines fijas consumen de un canal de jobs compartido: limita el paralelismo y evita crear goroutines sin bound.

Un **semáforo con buffered channel** limita la concurrencia sin un pool explícito: `sem := make(chan struct{}, maxConcurrent)` y antes de cada operación `sem <- struct{}{}` (adquirir) y al terminar `<-sem` (liberar). Es más liviano que un pool cuando las goroutines son de vida corta. `errgroup.Group` del paquete `golang.org/x/sync/errgroup` extiende `sync.WaitGroup` con cancelación de context y propagación del primer error; es el patrón recomendado para goroutines que pueden fallar.

#### Examples
Fan-out con worker pool
```go
func workerPool(ctx context.Context, jobs <-chan Job, results chan<- Result, n int) {
	var wg sync.WaitGroup
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for job := range jobs {
				select {
				case <-ctx.Done():
					return
				case results <- process(job):
				}
			}
		}()
	}
	wg.Wait()
	close(results)
}
```

errgroup para goroutines con errores
```go
import "golang.org/x/sync/errgroup"

func fetchAll(ctx context.Context, urls []string) ([][]byte, error) {
	g, ctx := errgroup.WithContext(ctx)
	results := make([][]byte, len(urls))

	for i, url := range urls {
		i, url := i, url // capturar para closure
		g.Go(func() error {
			data, err := fetchData(ctx, url)
			if err != nil {
				return err
			}
			results[i] = data
			return nil
		})
	}
	return results, g.Wait() // cancela todas si alguna falla
}
```

Semáforo con buffered channel
```go
sem := make(chan struct{}, 10) // máximo 10 concurrentes

for _, item := range items {
	sem <- struct{}{} // adquirir
	go func(item Item) {
		defer func() { <-sem }() // liberar
		processItem(item)
	}(item)
}
// drenar el semáforo para esperar que terminen
for i := 0; i < cap(sem); i++ {
	sem <- struct{}{}
}
```

#### Sources
- [Go blog, Pipelines and cancellation](https://go.dev/blog/pipelines)
- [pkg.go.dev/golang.org/x/sync/errgroup](https://pkg.go.dev/golang.org/x/sync/errgroup)
- [Go blog, Concurrency is not parallelism](https://go.dev/blog/waza-talk)

---

### Data races y el race detector
#### Details
Una data race ocurre cuando dos goroutines acceden a la misma variable concurrentemente y al menos una de las operaciones es una escritura, sin sincronización entre ellas. Las data races producen comportamiento no determinista: valores corrompidos, crashes esporádicos, o resultados que varían entre ejecuciones. Son difíciles de reproducir porque dependen del scheduling del OS y de la carga del sistema.

Go incluye un **race detector** basado en el algoritmo ThreadSanitizer, activado con el flag `-race`: `go test -race ./...` o `go run -race main.go`. El detector instrumenta el binario en tiempo de compilación para rastrear todos los accesos a memoria y sus happens-before relations. Cuando detecta un acceso concurrente sin sincronización, imprime un reporte con los stack traces de ambas goroutines y el offset de la variable afectada. El overhead es 5-10x en tiempo de ejecución y 2-5x en memoria, por lo que no se usa en producción pero es estándar en CI.

Los patrones que evitan data races son: usar channels para transferir datos entre goroutines, proteger state compartido con `sync.Mutex`/`sync.RWMutex`, usar `sync/atomic` para variables de un word de tamaño, y no compartir punteros a datos mutables entre goroutines sin sincronización. La regla más simple: si dos goroutines pueden acceder a la misma variable y alguna escribe, necesitás sincronización.

#### Examples
Data race clásica y su fix
```go
// BUG: data race, múltiples goroutines escriben counter sin sincronización
var counter int
var wg sync.WaitGroup
for i := 0; i < 1000; i++ {
	wg.Add(1)
	go func() {
		defer wg.Done()
		counter++ // READ + WRITE no atómica
	}()
}
wg.Wait()
// counter puede ser cualquier valor < 1000

// Fix con atomic
var atomicCounter int64
for i := 0; i < 1000; i++ {
	wg.Add(1)
	go func() {
		defer wg.Done()
		atomic.AddInt64(&atomicCounter, 1)
	}()
}
wg.Wait()
fmt.Println(atomicCounter) // siempre 1000
```

Correr el race detector
```go
// go test -race ./...
// go build -race -o myapp .
// go run -race main.go
```

#### Sources
- [Go blog, Introducing the Go Race Detector](https://go.dev/blog/race-detector)
- [Go doc, Data Race Detector](https://go.dev/doc/articles/race_detector)
- [pkg.go.dev/sync/atomic](https://pkg.go.dev/sync/atomic)

---

### Profiling y performance
#### Details
Go incluye profiling de primera clase en el paquete `runtime/pprof` y a través de `net/http/pprof` para servidores HTTP. Los perfiles más relevantes son: **CPU profile** (dónde pasa tiempo el programa), **heap profile** (qué asignaciones existen en el heap), **goroutine profile** (stack traces de todas las goroutines activas, útil para detectar goroutine leaks), y **block profile** (goroutines bloqueadas esperando channels o mutexes). Se analizan con `go tool pprof` que ofrece visualizaciones interactivas y flame graphs.

El **escape analysis** determina si un valor asignado en una función "escapa" al heap o puede vivir en el stack. Si el compilador puede demostrar que la vida del valor está contenida en la función, lo asigna en el stack (O(1) allocation, sin GC). Los valores escapan al heap cuando: se retorna un puntero a una variable local, se asigna a una interfaz, o se almacena en un struct que ya está en el heap. Ver las decisiones del compilador con `go build -gcflags='-m' .` ayuda a identificar asignaciones inesperadas.

Los benchmarks se escriben en archivos `_test.go` con funciones `func BenchmarkX(b *testing.B)` que ejecutan el código bajo prueba en un loop `for i := 0; i < b.N; i++`. `b.ReportAllocs()` añade estadísticas de allocs/op. `go test -bench=. -benchmem` corre todos los benchmarks y reporta ns/op, B/op y allocs/op. `go tool trace` captura un trace completo del runtime (goroutine scheduling, GC, syscalls) para análisis detallado de latencias.

#### Examples
Habilitar profiling HTTP en un servidor
```go
import (
	_ "net/http/pprof" // registra handlers en /debug/pprof/
	"net/http"
)

func main() {
	go http.ListenAndServe(":6060", nil)
	// analizar con: go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30
	runServer()
}
```

Benchmark con reporte de allocs
```go
func BenchmarkProcess(b *testing.B) {
	b.ReportAllocs()
	data := generateTestData()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = processData(data)
	}
}
// go test -bench=BenchmarkProcess -benchmem -count=5
```

Ver escape analysis
```go
// go build -gcflags='-m=2' ./...
// Output: ./main.go:12:6: &User{} escapes to heap
//         ./main.go:18:5: s does not escape
```

#### Sources
- [Go blog, Profiling Go Programs](https://go.dev/blog/pprof)
- [pkg.go.dev/runtime/pprof](https://pkg.go.dev/runtime/pprof)
- [Go doc, Diagnostics](https://go.dev/doc/diagnostics)

## Interview Questions

### ¿Cuándo usarías sync.RWMutex en lugar de sync.Mutex?
`RWMutex` solo gana cuando las lecturas son significativamente más frecuentes que las escrituras, típicamente en caches o registros de configuración. El mecanismo de `RWMutex` tiene overhead de coordinación adicional; en workloads con escrituras frecuentes puede ser más lento que un `Mutex` simple. Como regla práctica: empezá con `Mutex`, medí con benchmarks, y cambiá a `RWMutex` solo si el profile muestra contención y la ratio lectura/escritura es alta.

### ¿Por qué el primer parámetro de las funciones Go suele ser context.Context?
Porque el contexto propaga cancelación y deadlines a través de toda la cadena de llamadas. Si un handler HTTP recibe un contexto que se cancela cuando el cliente desconecta, ese contexto necesita fluir hasta la query de base de datos, la llamada al servicio externo, y cualquier operación I/O intermedia. Pasarlo como primer parámetro (en lugar de guardarlo en un struct) es la convención acordada en la comunidad Go y permite que cada función decida cómo reaccionar ante la cancelación.

### ¿Qué es una data race y cómo la detectás en Go?
Una data race es acceso concurrente sin sincronización a la misma variable, con al menos una escritura. Produce comportamiento no determinista difícil de reproducir. Go incluye el flag `-race` que instrumenta el binario con ThreadSanitizer: `go test -race ./...` detecta races en tiempo de ejecución y reporta los stack traces de ambas goroutines involucradas. El overhead es 5-10x, por lo que se usa en tests y CI pero no en producción.

### ¿Cuál es la diferencia entre context.WithTimeout y context.WithDeadline?
`WithTimeout` recibe una duración relativa al momento de la llamada (`5 * time.Second`). `WithDeadline` recibe un instante absoluto (`time.Now().Add(5 * time.Second)` es equivalente pero puede expresarse como una hora específica). La diferencia práctica: si querés que una operación expire en 5 segundos desde ahora, ambas sirven; si querés que expire en un momento fijo del día, necesitás `WithDeadline`. En ambos casos el cancel retornado debe llamarse con `defer cancel()` para liberar recursos si la operación termina antes del plazo.

### ¿Cómo funciona errgroup y cuándo lo preferís sobre sync.WaitGroup?
`errgroup.Group` es `sync.WaitGroup` con dos capacidades adicionales: recoge el primer error retornado por cualquier goroutine y cancela automáticamente el context compartido cuando alguna falla. Con `WaitGroup` tenés que manejar errores manualmente con un channel o variable protegida por mutex. Preferís `errgroup` cuando las goroutines pueden fallar y querés que el fallo de una detenga las demás y propague el error al caller. Es el patrón recomendado para fan-out con manejo de errores en llamadas a APIs o queries paralelas.
