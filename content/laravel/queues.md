---
stack: laravel
id: laravel-queues
title: Laravel: Queues, jobs y eventos
area: Backend
priority: high
resourceLabel: Laravel, Queues
resourceUrl: https://laravel.com/docs/queues
---

## Summary
Mover trabajo pesado fuera del request/response: queues y jobs, tareas programadas, y eventos para desacoplar.

## Concepts

### Queues y jobs
#### Details
Una queue permite diferir trabajo costoso (enviar emails, procesar imágenes, llamar APIs externas) para que la request responda rápido. Encolás un **job** con `dispatch()`; un **worker** (`php artisan queue:work`, supervisado por Supervisor o Horizon) lo procesa en segundo plano. El driver puede ser database, Redis, SQS, etc.

Lo importante en entrevista es la confiabilidad: configurar **reintentos** (`$tries`, `backoff`), manejar fallos (`failed()`, tabla `failed_jobs`) y diseñar jobs **idempotentes** (que correr dos veces no duplique efectos), porque un job puede reintentarse. Para tareas largas, `timeout`. Horizon da dashboard y métricas para Redis.

#### Examples
Job encolable con reintentos
```php
class ProcessPodcast implements ShouldQueue
{
    public int $tries = 3;
    public int $backoff = 10;

    public function handle(): void { /* trabajo pesado */ }
    public function failed(\Throwable $e): void { /* notificar */ }
}

ProcessPodcast::dispatch($podcast)->onQueue('media');
```

#### Sources
- [Laravel, Queues](https://laravel.com/docs/queues)
- [Laravel, Horizon](https://laravel.com/docs/horizon)

### Tareas programadas (scheduling)
#### Details
El scheduler define tareas recurrentes en código (`->daily()`, `->everyFiveMinutes()`) en vez de editar crontab por cada una. En el servidor configurás **un solo cron** que corre `schedule:run` cada minuto, y Laravel decide qué toca ejecutar. Para que no se solapen tareas largas, `withoutOverlapping()`; para una sola instancia en multi-servidor, `onOneServer()`.

Combinación típica: el scheduler dispara un job que se encola y procesan los workers, separando "cuándo" (schedule) de "cómo se ejecuta" (queue). Es un tema muy preguntado en producción.

#### Examples
Tarea programada que encola trabajo
```php
// routes/console.php / Kernel
Schedule::command('reports:generate')
    ->dailyAt('02:00')
    ->withoutOverlapping();
```

#### Sources
- [Laravel, Task Scheduling](https://laravel.com/docs/scheduling)

### Eventos y listeners
#### Details
Los eventos desacoplan: en vez de que un controlador haga 5 cosas tras registrar un usuario (mandar mail, crear perfil, notificar a Slack), dispara un evento `UserRegistered` y varios **listeners** reaccionan. Eso mantiene el código abierto a extensión sin tocar el flujo principal.

Los listeners pueden implementar `ShouldQueue` para correr en background, uniendo eventos + queues. En entrevista, el valor es la arquitectura: eventos para efectos secundarios desacoplados, no para el flujo crítico que necesita respuesta inmediata.

#### Examples
Evento + listener encolado
```php
event(new UserRegistered($user));

class SendWelcomeEmail implements ShouldQueue
{
    public function handle(UserRegistered $event): void
    {
        Mail::to($event->user)->send(new WelcomeMail());
    }
}
```

#### Sources
- [Laravel, Events](https://laravel.com/docs/events)

## Interview Questions

### ¿Cuándo mandarías trabajo a una queue en vez de hacerlo en la request?
Cuando el trabajo es lento o no necesita bloquear la respuesta: emails, procesamiento de archivos/imágenes, llamadas a APIs externas, generación de reportes. Lo encolo para que la request responda rápido y un worker lo procese en background. Lo que necesita respuesta inmediata (validación, autorización, el resultado que el usuario espera ya) se queda síncrono.

### ¿Cómo asegurás que un job sea confiable ante reintentos?
Configuro `$tries`/`backoff` y manejo `failed()` para no perder fallos (van a `failed_jobs`). Diseño el job **idempotente**: que ejecutarlo dos veces no duplique efectos (ej. chequear si el email ya se envió, usar IDs únicos, upserts). Pongo `timeout` para jobs largos. Con Horizon monitoreo throughput y fallos.

### Scheduler de Laravel vs cron del sistema: ¿cómo se relacionan?
Defino las tareas recurrentes en el scheduler de Laravel (en código, versionado), y en el servidor pongo UN solo cron que corre `schedule:run` cada minuto. Laravel decide qué tarea toca. Así no edito crontab por cada tarea, y uso `withoutOverlapping()`/`onOneServer()` para evitar solapamientos y duplicados en multi-servidor.

### ¿Para qué usarías eventos y listeners?
Para desacoplar efectos secundarios del flujo principal. Tras registrar un usuario, en vez de encadenar todo en el controlador, disparo `UserRegistered` y listeners independientes mandan el mail, crean el perfil, notifican. Puedo agregar/quitar reacciones sin tocar el registro, y los listeners pesados van con `ShouldQueue`. Para flujo crítico que necesita respuesta inmediata, no uso eventos.
