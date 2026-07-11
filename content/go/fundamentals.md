---
stack: go
id: go-fundamentals
title: "Go: Fundamentos, interfaces y errores"
area: Backend
priority: high
resourceLabel: The Go Programming Language Specification
resourceUrl: https://go.dev/ref/spec
---

## Summary
Los pilares del lenguaje Go que aparecen en toda entrevista técnica backend: el modelo de concurrencia basado en goroutines, la comunicación mediante channels, el sistema de interfaces implícitas, el manejo idiomático de errores, y los internals de slices y maps que explican comportamientos no obvios en producción.

## Concepts

### Goroutines y el scheduler de Go
#### Details
Una goroutine es una función que se ejecuta concurrentemente con otras goroutines en el mismo espacio de direcciones. A diferencia de un thread del sistema operativo, una goroutine comienza con un stack de aproximadamente 2 KB que crece dinámicamente según necesidad. Eso permite tener cientos de miles de goroutines activas sin agotar la memoria: un thread del SO consume típicamente 1-8 MB de stack fijo.

El runtime de Go implementa un **scheduler M:N**: multiplexa M goroutines sobre N threads del SO (llamados M), usando un conjunto de procesadores lógicos P. `GOMAXPROCS` controla cuántos P existen; por defecto equivale al número de CPUs disponibles. Más P significa más paralelismo real, pero no más concurrencia: dos goroutines en un único P se turnan cooperativamente, no corren en paralelo.

Un punto clave en entrevistas: tener múltiples goroutines no implica paralelismo automático. Si `GOMAXPROCS=1`, todas las goroutines corren en un único thread del SO. El paralelismo ocurre cuando hay más de un P y el sistema operativo asigna esos threads a distintos núcleos. La concurrencia es estructural (composición); el paralelismo es físico (ejecución simultánea).

#### Examples
Lanzar goroutines y esperar su finalización
```go
package main

import (
	"fmt"
	"sync"
)

func worker(id int, wg *sync.WaitGroup) {
	defer wg.Done()
	fmt.Printf("worker %d done\n", id)
}

func main() {
	var wg sync.WaitGroup
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go worker(i, &wg)
	}
	wg.Wait() // bloquea hasta que todos llamen Done()
}
```

Verificar y ajustar GOMAXPROCS
```go
import "runtime"

func main() {
	fmt.Println("CPUs:", runtime.NumCPU())
	fmt.Println("GOMAXPROCS:", runtime.GOMAXPROCS(0)) // 0 = solo leer, no cambiar
	runtime.GOMAXPROCS(2) // forzar 2 procesadores lógicos
}
```

#### Sources
- [The Go Memory Model](https://go.dev/ref/mem)
- [Go runtime, goroutines](https://go.dev/doc/faq#goroutines)
- [Go spec, Go statements](https://go.dev/ref/spec#Go_statements)

---

### Channels: comunicación entre goroutines
#### Details
Un channel es el mecanismo idiomático de Go para compartir datos entre goroutines: "no comunicar compartiendo memoria; compartir memoria comunicando". Un **unbuffered channel** (`make(chan T)`) sincroniza emisor y receptor: el emisor bloquea hasta que alguien recibe, y viceversa. Un **buffered channel** (`make(chan T, n)`) permite que el emisor continúe mientras haya capacidad, bloqueando solo cuando el buffer está lleno.

El statement `select` permite a una goroutine esperar en múltiples operaciones de channel simultáneamente, eligiendo la primera que esté lista. Si ninguna lo está y hay un `default`, se ejecuta sin bloquear. El **done channel** es el patrón estándar de cancelación: se crea un `chan struct{}` que se cierra cuando el trabajo debe terminar; los workers verifican `<-done` con `select` para detectar el cierre.

`range` sobre un channel itera hasta que el channel se cierra con `close()`. Cerrar un channel sin receivers pendientes es seguro; enviar a un channel cerrado produce panic. La elección entre channels y mutex no es doctrinaria: los channels expresan propiedad y transferencia de datos; los mutex protegen estado compartido al que acceden múltiples goroutines simultáneamente sin transferencia.

#### Examples
Unbuffered vs buffered channel
```go
// Unbuffered: emisor bloquea hasta que receptor lee
ch := make(chan int)
go func() { ch <- 42 }()
v := <-ch // sincronización garantizada

// Buffered: emisor no bloquea mientras haya espacio
bch := make(chan int, 3)
bch <- 1
bch <- 2
bch <- 3
// bch <- 4 // bloquearía aquí
```

Select con done channel para cancelación
```go
func generate(done <-chan struct{}) <-chan int {
	out := make(chan int)
	go func() {
		defer close(out)
		for i := 0; ; i++ {
			select {
			case out <- i:
			case <-done: // el caller cerró done: paramos
				return
			}
		}
	}()
	return out
}
```

Range sobre channel
```go
func produce(ch chan<- int) {
	for i := 0; i < 5; i++ {
		ch <- i
	}
	close(ch) // sin esto, range bloquea para siempre
}

ch := make(chan int)
go produce(ch)
for v := range ch {
	fmt.Println(v) // 0 1 2 3 4
}
```

#### Sources
- [Effective Go, Channels](https://go.dev/doc/effective_go#channels)
- [Go spec, Channel types](https://go.dev/ref/spec#Channel_types)
- [Go blog, Pipelines and cancellation](https://go.dev/blog/pipelines)

---

### Interfaces e implicit implementation
#### Details
Go implementa interfaces por satisfacción implícita: un tipo satisface una interfaz si implementa todos sus métodos, sin declarar `implements` explícitamente. Este es el **duck typing estructural** del sistema de tipos estático de Go. El compilador verifica la satisfacción en tiempo de compilación, no en runtime, lo que da seguridad de tipos sin acoplamiento.

La filosofía de Go favorece interfaces pequeñas. `io.Reader` tiene un solo método (`Read`); `io.Writer` tiene uno (`Write`); `io.ReadWriter` es su composición. Interfaces grandes crean acoplamiento innecesario; interfaces de un método maximizan la reutilización. Una regla práctica: si una interfaz tiene más de tres métodos, probablemente está modelando un objeto en vez de un comportamiento.

Un valor de interfaz en Go es internamente un par `(type, value)`. Si el tipo concreto es un puntero `*T`, el campo `type` contiene `*T`; si es un valor `T`, contiene `T`. El **nil interface gotcha** ocurre cuando se retorna un puntero `nil` de tipo concreto como una interfaz: la interfaz no es `nil` porque su campo `type` no es nulo, solo su campo `value` lo es. Esto produce panics en producción que desconciertan a quienes no conocen los internals.

#### Examples
Satisfacción implícita de interfaz
```go
type Stringer interface {
	String() string
}

type Point struct{ X, Y float64 }

// Point satisface Stringer sin declaración explícita
func (p Point) String() string {
	return fmt.Sprintf("(%.1f, %.1f)", p.X, p.Y)
}

var s Stringer = Point{1.5, 2.3} // compila: satisface la interfaz
fmt.Println(s.String())
```

El nil interface gotcha
```go
type MyError struct{ msg string }
func (e *MyError) Error() string { return e.msg }

func getError(fail bool) error {
	var err *MyError // nil puntero concreto
	if fail {
		err = &MyError{"algo falló"}
	}
	return err // BUG: retorna interfaz no-nil con value=nil cuando fail=false
}

e := getError(false)
fmt.Println(e == nil) // false ← sorpresa
// Fix: retornar nil directamente, no una variable tipada
```

Verificar satisfacción en tiempo de compilación
```go
// Afirmación en blank identifier: falla en compilación si no satisface
var _ io.Reader = (*os.File)(nil)
var _ fmt.Stringer = Point{}
```

#### Sources
- [Go spec, Interface types](https://go.dev/ref/spec#Interface_types)
- [Effective Go, Interfaces](https://go.dev/doc/effective_go#interfaces)
- [Go FAQ, Interface satisfaction](https://go.dev/doc/faq#nil_error)

---

### Manejo de errores idiomático
#### Details
En Go, `error` es una interfaz built-in con un solo método: `Error() string`. Los errores son valores ordinarios que se retornan como último valor de retorno de una función. El patrón idiomático es verificar `if err != nil` inmediatamente después de cada llamada que pueda fallar, lo que hace el flujo de errores explícito y trazable sin el overhead de excepciones.

El paquete `errors` (Go 1.13+) introduce **error wrapping**: `fmt.Errorf("context: %w", err)` encapsula un error con contexto adicional preservando el error original. `errors.Is(err, target)` recorre la cadena de wrapping para verificar si algún error en la cadena es igual al target. `errors.As(err, &target)` busca en la cadena el primer error que sea del tipo concreto de `target`. Los **errores centinela** son variables exportadas (`var ErrNotFound = errors.New("not found")`) que actúan como tokens de identidad comparables con `errors.Is`.

La distinción entre `error` y `panic`/`recover` es intencional: `panic` es para errores no recuperables o invariantes rotos del programa (index out of bounds, nil dereference); `error` es para condiciones de fallo esperadas y operacionales. Usar `panic` para flujo de errores de negocio es un antipatrón en Go que complica el mantenimiento y la composición de librerías.

#### Examples
Errores centinela con errors.Is
```go
var ErrNotFound = errors.New("not found")
var ErrPermission = errors.New("permission denied")

func findUser(id int) (*User, error) {
	if id == 0 {
		return nil, ErrNotFound
	}
	return &User{}, nil
}

_, err := findUser(0)
if errors.Is(err, ErrNotFound) {
	// manejar ausencia del recurso
}
```

Wrapping con contexto y errors.As
```go
type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("validation error on %s: %s", e.Field, e.Message)
}

func validate(email string) error {
	if !strings.Contains(email, "@") {
		return fmt.Errorf("validate: %w", &ValidationError{Field: "email", Message: "invalid format"})
	}
	return nil
}

err := validate("notanemail")
var ve *ValidationError
if errors.As(err, &ve) {
	fmt.Println(ve.Field, ve.Message)
}
```

defer/panic/recover para invariantes internos
```go
func mustParse(s string) int {
	n, err := strconv.Atoi(s)
	if err != nil {
		panic(fmt.Sprintf("mustParse: invalid int %q", s))
	}
	return n
}

func safeCall() (err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("recovered panic: %v", r)
		}
	}()
	_ = mustParse("not-a-number")
	return nil
}
```

#### Sources
- [Go blog, Error handling and Go](https://go.dev/blog/error-handling-and-go)
- [Go blog, Working with errors in Go 1.13](https://go.dev/blog/go1.13-errors)
- [pkg.go.dev/errors](https://pkg.go.dev/errors)

---

### Slices y maps: internals
#### Details
Un slice en Go es un **header de tres campos**: puntero al array subyacente, longitud (`len`) y capacidad (`cap`). El array subyacente vive en el heap; el header puede estar en el stack. Cuando `append` excede la capacidad, Go asigna un nuevo array (típicamente con capacidad doblada para slices pequeños, y crecimiento proporcional para grandes), copia los elementos y retorna un nuevo header. Por eso `append` debe siempre asignarse al resultado: `s = append(s, x)`.

Slices derivados de otro slice **comparten el backing array**: `s2 := s1[2:5]` apunta al mismo array. Mutar `s2[0]` muta `s1[2]`. Para evitar esto se usa la expresión de tres índices `s1[2:5:5]` que limita la capacidad del slice derivado, o `copy` para crear una copia independiente. Este comportamiento es la fuente de bugs sutiles en funciones que reciben slices y los modifican.

Un map en Go es una **hash table** con comportamiento no determinista en la iteración: el runtime deliberadamente randomiza el orden para evitar que el código dependa de él. El zero value de un map es `nil`; leer de un map `nil` devuelve el zero value del tipo (no panic), pero escribir en él sí produce panic. La forma idiomática de verificar existencia es el two-value assignment: `v, ok := m[key]`. Para maps concurrentes, el runtime detecta accesos simultáneos y hace panic; la solución es `sync.RWMutex` o `sync.Map`.

#### Examples
Slice header y append con reasignación
```go
s := make([]int, 3, 5) // len=3, cap=5
fmt.Println(len(s), cap(s)) // 3 5

s = append(s, 10, 20)       // len=5, cap=5, cabe
s = append(s, 30)            // len=6, cap=10, nuevo backing array
```

Slices compartiendo backing array
```go
original := []int{1, 2, 3, 4, 5}
derived := original[1:3]   // [2, 3], comparte array

derived[0] = 99
fmt.Println(original) // [1 99 3 4 5] ← mutado

// Fix: usar full slice expression para limitar cap
safe := original[1:3:3]
safe = append(safe, 100) // ya no afecta a original
```

Map: zero value, nil y two-value lookup
```go
var m map[string]int // nil map
v := m["key"]        // 0, no panic
// m["key"] = 1      // panic: assignment to entry in nil map

m = make(map[string]int)
m["hits"] = 42

count, ok := m["hits"]
fmt.Println(count, ok) // 42 true

count, ok = m["misses"]
fmt.Println(count, ok) // 0 false
```

#### Sources
- [Go blog, Go Slices: usage and internals](https://go.dev/blog/slices-intro)
- [Go spec, Slice types](https://go.dev/ref/spec#Slice_types)
- [Go spec, Map types](https://go.dev/ref/spec#Map_types)

## Interview Questions

### ¿Cuál es la diferencia entre una goroutine y un thread del SO? ¿Por qué Go puede tener millones de goroutines?
Las goroutines comienzan con un stack de ~2 KB que crece dinámicamente; un thread del SO usa 1-8 MB de stack fijo. El runtime de Go multiplexa goroutines sobre threads con un scheduler M:N cooperativo/preemptivo, lo que evita el overhead de context-switch del kernel. Un servidor con 100 000 conexiones puede tener 100 000 goroutines activas con un consumo de memoria manejable, algo imposible con un thread por conexión. La clave es que el scheduler de Go opera en espacio de usuario y tiene información sobre los puntos de bloqueo (I/O, channel ops, syscalls) para redistribuir trabajo eficientemente.

### ¿Cuándo usarías channels en lugar de un mutex, y viceversa?
Los channels son idiomáticos cuando hay transferencia de ownership de datos entre goroutines o cuando querés coordinar la secuencia de ejecución (pipeline, señales, cancelación). Un mutex es más apropiado cuando múltiples goroutines acceden a un estado compartido sin transferir ownership, como un contador o un cache. La heurística es: si estás pasando datos de A a B, usá channel; si protegés el acceso a un struct compartido, usá mutex. Combinar ambos sin criterio claro suele indicar un diseño confuso.

### ¿Qué es el nil interface gotcha y cómo lo evitás?
Cuando retornás un puntero nil de tipo concreto como `error`, la interfaz resultante no es nil porque tiene su campo type no nulo. `err == nil` devuelve false aunque el valor subyacente sea nil. Se evita retornando `nil` directamente sin asignarlo a una variable con tipo concreto. La señal de alarma es una función que tiene `var err *MiTipoError` y la retorna como `error` sin asignarle nada.

### ¿Qué diferencia hay entre errors.Is y errors.As? ¿Cuándo usás cada uno?
`errors.Is` verifica identidad: recorre la cadena de wrapping buscando un error que sea igual (por `==` o método `Is`) al target. Se usa con errores centinela: `errors.Is(err, ErrNotFound)`. `errors.As` verifica tipo: busca en la cadena el primer error que sea asignable al tipo apuntado por target. Se usa cuando necesitás acceder a los campos del error concreto: `errors.As(err, &myErr)` para leer `myErr.Field`. Ambos atraviesan el wrapping creado por `fmt.Errorf("%w", ...)`, lo que hace que agregar contexto con `%w` sea transparente para los callers.

### ¿Qué pasa cuando dos slices comparten el mismo backing array y qué bugs puede causar?
Si derivás un slice con `s2 := s1[low:high]`, ambos apuntan al mismo array subyacente. Mutar elementos en `s2` muta el array que `s1` también ve. El bug clásico es una función que recibe un slice, lo modifica "internamente" y el caller ve cambios inesperados en el original. La solución es usar `copy` o la expresión de tres índices `s1[low:high:max]` que limita la cap del slice derivado, forzando que el próximo `append` asigne un array nuevo en lugar de pisar el del original.
