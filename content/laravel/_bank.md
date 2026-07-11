---
stack: laravel
kind: question-bank
source: curated
sourceUrl: https://laravel.com/docs
license: curated
copyright: Written from scratch citing laravel.com/docs
---

<!-- Questions inspired by common Laravel interview topics. All answers written from scratch
     citing laravel.com/docs (current version). DO NOT hand-edit, extend by adding sections. -->

## Interview Questions

### ¿Qué drivers de caché soporta Laravel y cuándo conviene usar cada uno?

Laravel soporta drivers de caché como `file`, `database`, `redis`, `memcached`, `array` y `dynamodb`. Para desarrollo o testing alcanza con `array` (sin persistencia) o `file`. En producción, `redis` o `memcached` son preferibles porque operan completamente en memoria, con latencias de microsegundos y soporte para estructuras avanzadas. `database` puede funcionar para tráfico moderado, pero introduce I/O de disco que anula el propósito del caché bajo carga alta. (laravel.com/docs/cache)

### ¿Qué hace `Cache::remember()` y cuándo lo usás?

`Cache::remember($key, $ttl, $callback)` intenta obtener el valor del caché y, si no existe, ejecuta el callback, almacena el resultado durante `$ttl` segundos y lo devuelve. Es el patrón cache-aside en una sola línea y evita tener que escribir el bloque `if/else` manualmente. Existe también `rememberForever()` cuando el dato no expira por tiempo sino por invalidación explícita. Usalo cuando generar el valor es costoso (query pesada, llamada a API externa) y el resultado es compartido entre múltiples usuarios. (laravel.com/docs/cache)

```php
$users = Cache::remember('active_users', 3600, fn() => User::active()->get());
```

### ¿Qué son los cache tags y cuándo los necesitás?

Los cache tags permiten agrupar múltiples entradas bajo una o varias etiquetas y limpiarlas todas juntas con `Cache::tags(['tag'])->flush()`. Son útiles cuando tenés entradas relacionadas con un recurso (por ejemplo, todas las páginas paginadas de una lista de productos) y necesitás invalidarlas en bloque cuando ese recurso cambia. Solo están disponibles en drivers que lo soportan: `redis` y `memcached`; no funcionan con `file` ni `database`. (laravel.com/docs/cache#cache-tags)

```php
Cache::tags(['products', 'catalog'])->put('products.page.1', $data, 600);
Cache::tags(['products'])->flush(); // invalida todo lo taggeado con 'products'
```

### ¿Qué es un cache stampede y cómo lo prevenís en Laravel?

Un cache stampede ocurre cuando una entrada expira y múltiples procesos concurrentes intentan regenerarla al mismo tiempo, generando una avalancha de queries idénticas a la base de datos. Laravel ofrece `Cache::lock()` para implementar un lock distribuido: el primer proceso adquiere el lock, regenera el valor y el resto espera o devuelve el dato stale. Otra estrategia es usar TTLs con jitter (variación aleatoria) para evitar que muchas claves expiren en el mismo instante. (laravel.com/docs/cache#atomic-locks)

```php
Cache::lock('rebuild_users', 10)->block(5, function () {
    Cache::put('active_users', User::active()->get(), 3600);
});
```

### ¿Cuál es la diferencia entre una Collection y una LazyCollection en Laravel?

`Collection` carga todos los elementos en memoria de una vez y es ideal para datasets pequeños o medianos donde necesitás encadenar múltiples operaciones de forma expresiva. `LazyCollection` usa generators de PHP para procesar los elementos de a uno, sin cargar todo en memoria; es la opción correcta cuando trabajás con miles o millones de registros (archivos CSV, exports, `cursor()` de Eloquent). La API es casi idéntica, pero `LazyCollection` no tiene métodos que requieran todos los elementos a la vez, como `sortBy` con order ascendente sobre un cursor. (laravel.com/docs/collections#lazy-collections)

```php
// LazyCollection con cursor evita cargar todos los usuarios en RAM
User::cursor()->filter(fn($u) => $u->isActive())->each(fn($u) => processUser($u));
```

### ¿Qué son los higher-order messages en Collections?

Los higher-order messages son una sintaxis de acceso a propiedades en colecciones que delegan la operación al método correspondiente sobre cada elemento. En vez de escribir `$users->map(fn($u) => $u->email)`, podés escribir `$users->map->email`; o `$users->filter->isActive()` en lugar del closure explícito. Mejoran la legibilidad cuando la operación es simple y el elemento tiene el método o propiedad. No reemplazan los closures cuando la lógica es compleja. (laravel.com/docs/collections#higher-order-messages)

### ¿Cuándo conviene usar `chunk()` en vez de `LazyCollection::chunk()`?

`Collection::chunk($size)` divide una colección ya cargada en subgrupos y es útil para procesar lotes en memoria (por ejemplo, enviar emails de a 100). `LazyCollection` también tiene `chunk()`, pero como la colección es lazy, no materializa todo al inicio. En Eloquent, `chunkById()` es la forma preferida para paginar queries grandes porque evita el offset SQL (que se vuelve lento en tablas grandes) al paginar por el ID del último registro procesado. (laravel.com/docs/collections#method-chunk)

### ¿Cuándo usás eventos y listeners en lugar de llamadas directas entre clases?

Los eventos son ideales cuando una acción dispara múltiples efectos secundarios desacoplados: por ejemplo, al registrar un usuario podés tener listeners que envían el email de bienvenida, crean el perfil y notifican al equipo de ventas, sin que `UserController` conozca ninguno de esos detalles. El desacoplamiento facilita agregar o quitar comportamientos sin tocar la lógica principal. Si el efecto secundario es uno solo y siempre ocurre, una llamada directa suele ser más simple y rastreable. (laravel.com/docs/events)

### ¿Cómo se ejecutan listeners de forma asíncrona en Laravel?

Un listener implementa `ShouldQueue` para que Laravel lo despache en la cola configurada en vez de ejecutarlo sincrónicamente. Podés definir `$queue`, `$delay` y `$connection` como propiedades para controlar dónde y cuándo se procesa. Si el listener necesita reintentos, implementá `$tries` o el método `retryUntil()`. Para listeners que deben ejecutarse en la misma request (aunque el evento sea de cola), usá `ShouldHandleEventsAfterCommit` junto con transacciones DB para evitar que el listener corra antes de que la transacción se confirme. (laravel.com/docs/events#queued-event-listeners)

```php
class SendWelcomeEmail implements ShouldQueue
{
    public $queue = 'emails';
    public function handle(UserRegistered $event): void { /* ... */ }
}
```

### ¿Qué es un Event Subscriber y cuándo lo preferís a múltiples listeners separados?

Un Event Subscriber es una clase que registra múltiples listeners en su método `subscribe()`, agrupando en un solo lugar todos los handlers relacionados con un dominio. Es útil cuando varios eventos de la misma área (por ejemplo, `OrderPlaced`, `OrderShipped`, `OrderCancelled`) comparten dependencias o lógica de inicialización, y separarlos en clases individuales generaría demasiada fragmentación. Se registra en el array `$subscribe` del `EventServiceProvider`. (laravel.com/docs/events#event-subscribers)

### ¿Cómo testéas que un evento fue disparado sin ejecutar sus listeners?

Usás `Event::fake()` al inicio del test, que reemplaza el dispatcher real por un fake que captura los eventos sin ejecutar listeners. Luego podés afirmar con `Event::assertDispatched(UserRegistered::class)` o `Event::assertNotDispatched()`. Si necesitás que algunos listeners corran y otros no, usás `Event::fakeExcept([UserRegistered::class])`. (laravel.com/docs/events#testing)

```php
Event::fake();
$this->post('/register', [...]);
Event::assertDispatched(UserRegistered::class);
```

### ¿Cuál es la diferencia entre `bind()`, `singleton()` e `instance()` en el Service Container?

`bind($abstract, $concrete)` registra una factoría que crea una instancia nueva cada vez que se resuelve el binding. `singleton($abstract, $concrete)` registra la factoría pero guarda la primera instancia resuelta y la reutiliza en todas las resoluciones siguientes dentro del ciclo de vida de la request. `instance($abstract, $existing)` enlaza directamente un objeto ya creado, sin factoría; equivale a un singleton pre-construido. Usá `singleton` para servicios con estado compartido (conexiones, configuraciones) y `bind` cuando cada consumidor debe recibir su propia copia. (laravel.com/docs/container)

### ¿Qué es el contextual binding en el Service Container?

El contextual binding permite que el contenedor resuelva implementaciones distintas del mismo contrato según qué clase está siendo resuelta. Útil cuando dos controladores dependen de `FileSystem` pero uno usa el disco `local` y el otro el disco `s3`. Se configura con la API fluida `$this->app->when(...)->needs(...)->give(...)` en un Service Provider. (laravel.com/docs/container#contextual-binding)

```php
$this->app->when(PhotoController::class)
    ->needs(Filesystem::class)
    ->give(fn() => Storage::disk('s3'));
```

### ¿Para qué sirve el tagging de bindings en el Service Container?

El tagging permite registrar múltiples bindings bajo una etiqueta común y resolverlos todos juntos con `$this->app->tagged('reports')`. Es útil para plugins, drivers o estrategias intercambiables: registrás múltiples implementaciones bajo el tag `report-generators` y en el lugar de consumo iterás todas sin conocer cuáles están registradas. Se configura con `$this->app->tag([PdfReport::class, CsvReport::class], 'reports')`. (laravel.com/docs/container#tagging)

### ¿Cuándo usás broadcasting en Laravel y cómo autorizás canales privados?

Broadcasting es el mecanismo de Laravel para emitir eventos del servidor al cliente en tiempo real usando WebSockets (a través de Pusher, Ably o Laravel Reverb). Un evento implementa `ShouldBroadcast` y define el canal en `broadcastOn()`. Los canales privados requieren que el usuario esté autenticado y que la autorización se defina en `routes/channels.php` con un closure que recibe el usuario autenticado y retorna `true` o `false`. Los canales de presencia además proveen la lista de usuarios conectados. (laravel.com/docs/broadcasting)

```php
Broadcast::channel('orders.{orderId}', function ($user, $orderId) {
    return $user->id === Order::findOrNew($orderId)->user_id;
});
```

### ¿Qué diferencia hay entre un canal público, privado y de presencia?

Un canal **público** no requiere autenticación; cualquier cliente puede suscribirse. Un canal **privado** exige que el usuario esté autenticado y que la autorización del canal retorne `true`; se usa para datos sensibles de un usuario o recurso. Un canal de **presencia** extiende el privado y además expone la lista de suscriptores activos a todos los miembros del canal, lo que permite funcionalidades de "quién está en línea". (laravel.com/docs/broadcasting#channel-types)

### ¿Cómo configurás múltiples discos de almacenamiento en Laravel?

Los discos se definen en `config/filesystems.php` bajo la clave `disks`. Cada disco tiene un `driver` (`local`, `public`, `s3`, `ftp`, etc.) y sus parámetros de conexión. Accedés con `Storage::disk('s3')->put(...)`. El disco `public` es un alias del disco local con su raíz en `storage/app/public`, enlazado a `public/storage` vía `php artisan storage:link`. Para S3 y otros drivers cloud se requiere el paquete `league/flysystem-aws-s3-v3`. (laravel.com/docs/filesystem)

### ¿Cómo generás URLs temporales para archivos privados en S3?

`Storage::disk('s3')->temporaryUrl($path, now()->addMinutes(15))` genera una URL firmada con expiración. Esta URL permite acceso temporal sin hacer el archivo público de forma permanente, ideal para descargas bajo demanda donde el usuario debe estar autorizado. No todos los drivers soportan URLs temporales; `local` no las soporta por defecto. (laravel.com/docs/filesystem#temporary-urls)

### ¿Cómo manejás uploads grandes para evitar problemas de memoria?

Para archivos grandes conviene usar streaming en lugar de cargar el archivo completo en memoria. Con `$request->file('video')->storeAs()` Laravel ya usa streams internamente para Flysystem. Para uploads directos a S3 sin pasar por el servidor de Laravel, podés generar una URL de upload firmada con `Storage::disk('s3')->temporaryUploadUrl($path, now()->addMinutes(5))` y que el cliente suba directamente al bucket. También podés ajustar `upload_max_filesize` y `post_max_size` en `php.ini` según el contexto. (laravel.com/docs/filesystem#streaming-uploads)

### ¿Cuándo usás Notifications en vez de Events+Listeners para enviar mensajes?

Las Notifications están diseñadas específicamente para comunicaciones hacia usuarios a través de múltiples canales (mail, SMS, Slack, database, broadcast) usando una sola clase. Son convenientes cuando el foco es "avisarle algo a este usuario por todos sus canales preferidos". Events+Listeners son más apropiados cuando el disparo de la acción desencadena múltiples consecuencias de negocio (no solo comunicación) o cuando las acciones no están centradas en un notifiable. (laravel.com/docs/notifications)

### ¿Cómo enviás una notificación por múltiples canales a la vez?

En el método `via()` de la notificación retornás un array con los canales: `['mail', 'slack', 'database']`. Laravel invoca el método correspondiente (`toMail()`, `toSlack()`, `toDatabase()`) por cada canal. El usuario puede tener canales configurados dinámicamente si `via()` recibe el `$notifiable` y consulta sus preferencias. (laravel.com/docs/notifications#specifying-delivery-channels)

```php
public function via($notifiable): array
{
    return $notifiable->prefers_sms ? ['vonage', 'database'] : ['mail', 'database'];
}
```

### ¿Cómo guardás notificaciones en la base de datos y las marcás como leídas?

Agregás el canal `database` en `via()` e implementás `toDatabase()` que retorna un array con los datos a guardar. Laravel crea la tabla `notifications` vía `php artisan notifications:table`. En el modelo del usuario usás el trait `Notifiable` que expone `$user->notifications` (todas) y `$user->unreadNotifications`. Para marcar como leída: `$notification->markAsRead()` o `$user->unreadNotifications->markAsRead()`. (laravel.com/docs/notifications#database-notifications)

### ¿Cómo evitás enviar notificaciones duplicadas?

Laravel no tiene deduplicación nativa, pero podés implementarla verificando antes de enviar si ya existe una notificación similar en la tabla `notifications` para ese usuario en el período reciente. Otra estrategia es usar un cache lock (`Cache::lock()`) alrededor del `notify()` para evitar race conditions en entornos con múltiples workers. Para notificaciones por email, usar `ShouldQueue` con `uniqueId()` en el Job subyacente también ayuda a descartar duplicados en cola. (laravel.com/docs/notifications)

### ¿Cómo diseñás un Artisan command que pueda reanudarse si se interrumpe?

Guardás el estado de progreso en la base de datos o en caché (por ejemplo, el último ID procesado) al final de cada batch. Al inicio del comando verificás si existe un checkpoint y reanudás desde ahí. Esto es especialmente importante para imports o migraciones de datos que pueden tardar horas. `chunkById()` facilita este patrón porque siempre podés retomar desde el último ID guardado. (laravel.com/docs/artisan)

```php
public function handle(): void
{
    $lastId = Cache::get('import:last_id', 0);
    User::where('id', '>', $lastId)->chunkById(500, function ($users) {
        foreach ($users as $user) {
            processUser($user);
            Cache::put('import:last_id', $user->id);
        }
    });
}
```

### ¿Cómo compartís lógica entre un Artisan command y un controlador?

Extraés la lógica a un Action, Service o Use Case independiente e inyectás esa clase tanto en el comando como en el controlador. Los comandos no deben contener lógica de negocio directamente; deben delegar a la misma capa de aplicación que usan los controladores. Esto también facilita el testing de la lógica sin tener que invocar el comando. (laravel.com/docs/artisan#writing-commands)

### ¿Cómo testéas un Artisan command en Laravel?

Usás `$this->artisan('command:name', ['--option' => 'value'])` en un feature test que extiende `TestCase`. Podés encadenar `->assertExitCode(0)`, `->expectsOutput('text')` o `->expectsQuestion('¿Continuar?', 'yes')` para comandos interactivos. Para comandos que interactúan con la base de datos o servicios externos, usás el mismo setup de factories y fakes que en cualquier otro feature test. (laravel.com/docs/artisan#testing)

```php
$this->artisan('users:import', ['--dry-run' => true])
     ->expectsOutput('Dry run complete.')
     ->assertExitCode(0);
```

### ¿Qué es el `RateLimiter` facade y cómo lo usás para definir limitadores con nombre?

`RateLimiter::for('api', fn($request) => Limit::perMinute(60)->by($request->user()?->id ?: $request->ip()))` registra un limitador con nombre en `AppServiceProvider` o `RouteServiceProvider`. Luego lo aplicás a rutas con `->middleware('throttle:api')`. Separar los limitadores por nombre permite tener distintas políticas para distintos grupos de rutas sin repetir lógica. (laravel.com/docs/routing#rate-limiting)

### ¿Cómo diferenciás la limitación por usuario autenticado versus por IP?

En el callback del `RateLimiter::for()` usás `->by($request->user()?->id ?: $request->ip())`: si el usuario está autenticado, el límite se aplica por su ID (compartiendo cuota entre dispositivos); si no, por IP. Esto evita que usuarios no autenticados puedan eludir el rate limit cambiando de sesión. Para endpoints públicos sensibles (login, password reset) conviene limitar por IP independientemente de si hay usuario. (laravel.com/docs/routing#rate-limiting)

```php
RateLimiter::for('login', function ($request) {
    return Limit::perMinute(5)->by($request->ip());
});
```

### ¿Qué opciones avanzadas tiene `Limit` para personalizar la respuesta al superar el límite?

`Limit` permite encadenar `->response(fn() => response('Too Many Requests', 429))` para devolver una respuesta personalizada en vez de la excepción `ThrottleRequestsException` por defecto. También podés usar `Limit::none()` para deshabilitar el throttle condicionalmente (por ejemplo, para usuarios con rol admin). Para APIs conviene devolver el header `Retry-After` en la respuesta, lo cual Laravel hace automáticamente con el middleware `throttle`. (laravel.com/docs/routing#rate-limiting)

### ¿Cómo implementás rate limiting a nivel de Job en colas?

Usás `RateLimiter::attempt('key', $maxAttempts, $callback)` dentro del método `handle()` del Job, o implementás el método `middleware()` retornando `[new RateLimited('key')]` desde `Illuminate\Queue\Middleware`. Esto limita cuántos Jobs de ese tipo se procesan por ventana de tiempo, útil para APIs de terceros con cuotas. Si el Job no puede ejecutarse por el límite, se libera de vuelta a la cola con `$this->release($delay)`. (laravel.com/docs/queues#rate-limiting)

```php
public function middleware(): array
{
    return [(new RateLimited('stripe-api'))->dontRelease()];
}
```

### ¿Qué hace `Collection::lazy()` y cuándo conviene convertir una collection existente?

`collect($array)->lazy()` convierte una `Collection` estándar en una `LazyCollection` sin recargar los datos. Es útil cuando tenés un array o resultado ya en memoria pero querés encadenar operaciones que pueden cortarse anticipadamente (como `first()` o `take()`), evitando procesar los elementos restantes. Si los datos vienen de una query Eloquent, es mejor usar `cursor()` o `lazy()` directamente en el query builder para nunca cargarlos todos en memoria. (laravel.com/docs/collections#lazy-collections)

### ¿Cómo accedés a los canales de presencia desde el backend en Broadcasting?

Laravel no provee una API server-side nativa para listar miembros de un canal de presencia desde PHP; esa información la gestiona Pusher/Reverb en tiempo real. Para lógica que depende de quién está conectado, la práctica es que el cliente frontend envíe un evento al servidor cuando el usuario entra o sale, y el backend mantenga ese estado en la base de datos o caché. El canal de presencia por sí solo resuelve el problema en el frontend a través de los callbacks `here`, `joining` y `leaving` de Echo. (laravel.com/docs/broadcasting#presence-channels)

### ¿Cómo funcionan las URL públicas vs privadas en el disco `public` de Laravel?

El disco `public` almacena archivos en `storage/app/public/` y, después de correr `php artisan storage:link`, crea un symlink `public/storage` → `storage/app/public`. Generás URLs accesibles con `Storage::disk('public')->url($path)` o el helper `asset('storage/'.$path)`. Para archivos que no deben ser accesibles públicamente usás el disco `local` sin symlink, y servís los archivos a través de una ruta que valide el acceso antes de retornar el contenido con `Storage::download()`. (laravel.com/docs/filesystem#the-public-disk)

### ¿Qué ventaja tiene usar `Event::fakeFor()` en tests sobre `Event::fake()`?

`Event::fakeFor(fn() => ..., [OrderPlaced::class])` activa el fake solo durante la ejecución del closure y solo para los eventos especificados; fuera del closure el dispatcher real vuelve a operar. Esto es útil en tests de integración donde querés que la mayor parte del flujo ocurra de forma real pero necesitás asertar sobre un evento puntual sin que su listener afecte el test. `Event::fake()` sin argumentos es más agresivo y silencia todos los eventos, lo que puede ocultar bugs si el test dependía de efectos secundarios de otros listeners. (laravel.com/docs/events#testing)
