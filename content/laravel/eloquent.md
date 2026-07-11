---
stack: laravel
id: laravel-eloquent
title: Laravel: Eloquent y base de datos
area: Backend
priority: high
resourceLabel: Laravel, Eloquent ORM
resourceUrl: https://laravel.com/docs/eloquent
---

## Summary
El ORM de Laravel a fondo: relaciones y migraciones, el problema N+1, Query Builder vs Eloquent, transacciones y mass assignment.

## Concepts

### Modelos, relaciones y migraciones
#### Details
Eloquent mapea cada tabla a un modelo. Las **migraciones** versionan el esquema (crear/alterar tablas) de forma reproducible: el equipo aplica los mismos cambios sin tocar la DB a mano. Las **relaciones** se declaran como métodos: `hasMany`, `belongsTo`, `belongsToMany` (muchos-a-muchos con tabla pivote), `hasManyThrough`, y polimórficas.

En entrevista hay que saber elegir la relación correcta y entender la tabla pivote en many-to-many (y cómo agregar columnas extra al pivote con `withPivot`). También conviene mencionar que las foreign keys deberían tener **índices** y restricciones (`constrained()`, `onDelete`) para integridad y rendimiento.

#### Examples
Relaciones declaradas en el modelo
```php
class Post extends Model
{
    public function user() { return $this->belongsTo(User::class); }
    public function tags() { return $this->belongsToMany(Tag::class); }
}
```

Migración con FK indexada
```php
Schema::create('posts', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->string('title');
    $table->timestamps();
});
```

#### Sources
- [Laravel, Eloquent: Relationships](https://laravel.com/docs/eloquent-relationships)
- [Laravel, Migrations](https://laravel.com/docs/migrations)

### N+1, eager loading y rendimiento
#### Details
El problema N+1 es la causa #1 de APIs Laravel lentas: iterás una colección y por cada item disparás una query para su relación. Con `with()` (eager loading) lo bajás a un par de queries. Para diagnosticarlo usás Telescope, Debugbar o `DB::listen`; en desarrollo podés activar `Model::preventLazyLoading()` para que un lazy load tire excepción y te obligue a hacer eager loading explícito.

Más allá de eager loading: `withCount()` para contar relaciones sin traerlas, constraints en el eager load (`with(['comments' => fn($q) => $q->latest()])`), y siempre **paginar** (`paginate`/`cursorPaginate`) en listados. A nivel DB, índices en las columnas de filtro/orden/join.

#### Examples
N+1 vs eager loading
```php
// N+1: 1 + N queries
foreach (Post::all() as $post) { echo $post->user->name; }

// Eager: 2 queries
foreach (Post::with('user')->get() as $post) { echo $post->user->name; }
```

Contar sin cargar la relación
```php
$users = User::withCount('posts')->get(); // $user->posts_count
```

#### Sources
- [Laravel, Eager Loading](https://laravel.com/docs/eloquent-relationships#eager-loading)
- [Laravel, Preventing Lazy Loading](https://laravel.com/docs/eloquent-relationships#preventing-lazy-loading)

### Query Builder, transacciones y mass assignment
#### Details
Eloquent es cómodo y expresivo; el **Query Builder** (`DB::table()`) es más cercano al SQL y conviene para queries complejas, bulk operations o cuando no necesitás el overhead de hidratar modelos. Saber cuándo bajar a Query Builder (o SQL crudo) es señal de criterio.

Para operaciones que deben ser atómicas (varias escrituras que tienen que pasar todas o ninguna) usás **transacciones** con `DB::transaction()`, que hace commit si todo sale bien y rollback ante una excepción. Y la seguridad clave del ORM: **mass assignment**. `Model::create($request->all())` sin protección permite que un atacante setee columnas que no debería (ej. `is_admin`). Te protegés con `$fillable` (whitelist) o `$guarded`, y validando antes con Form Requests.

#### Examples
Transacción atómica
```php
DB::transaction(function () use ($order) {
    $order->save();
    $order->items()->createMany($items);
    Inventory::decrement(...); // si algo falla, rollback de todo
});
```

Protección de mass assignment
```php
class User extends Model
{
    protected $fillable = ['name', 'email']; // is_admin NO está -> no asignable
}
```

#### Sources
- [Laravel, Database: Transactions](https://laravel.com/docs/database#database-transactions)
- [Laravel, Eloquent: Mass Assignment](https://laravel.com/docs/eloquent#mass-assignment)

## Interview Questions

### Tu API que lista recursos con relaciones está lenta. ¿Cómo lo diagnosticás y resolvés?
Confirmo que es N+1 mirando el conteo de queries (Telescope/Debugbar/`DB::listen`); si veo "1 + N", aplico eager loading con `with()` para las relaciones que el endpoint usa. Uso `withCount()` para conteos, agrego constraints al eager load, y paginо siempre. A nivel DB reviso índices en foreign keys y columnas de filtro. En dev activo `preventLazyLoading()` para que los N+1 salten como error.

### ¿Cuándo usarías Query Builder en vez de Eloquent?
Cuando necesito queries complejas, agregaciones, bulk inserts/updates o reportes donde hidratar modelos Eloquent es overhead innecesario. Eloquent lo uso para la lógica de dominio normal (CRUD, relaciones, eventos de modelo). No es uno u otro: en una misma app combino ambos según el caso.

### ¿Qué es el mass assignment y cómo te protegés?
Es asignar atributos masivamente desde input del usuario (`create($request->all())`). El riesgo es que el atacante mande campos que no debería poder setear, como `is_admin`. Me protejo con `$fillable` (whitelist de columnas asignables) o `$guarded`, y validando la entrada antes con un Form Request. Nunca paso `$request->all()` a un modelo sin control.

### ¿Cómo asegurás que varias operaciones de base de datos sean atómicas?
Las envuelvo en `DB::transaction()`: si todas las escrituras salen bien hace commit, y si alguna lanza una excepción hace rollback de todo, evitando estados inconsistentes (ej. cobrar sin crear la orden). Para casos con lógica de reintento o locks, manejo la transacción manualmente con `beginTransaction`/`commit`/`rollBack` y considero `lockForUpdate` en filas críticas.
