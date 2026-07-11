---
stack: angular
id: angular-advanced
title: "Angular: RxJS, routing, formularios y rendimiento"
area: Frontend
priority: high
resourceLabel: Angular, RxJS Interop
resourceUrl: https://angular.dev/ecosystem/rxjs-interop
---

## Summary
Los temas avanzados que separan a un Angular developer junior de uno senior: RxJS sin memory leaks, routing con lazy loading y guards, reactive forms con validación, change detection profunda con OnPush, y la migración hacia componentes standalone sin NgModule.

## Concepts

### RxJS en Angular
#### Details
Un `Observable` es lazy: no hace nada hasta que alguien se suscribe. Una `Promise` se ejecuta inmediatamente al crearse. La diferencia práctica: un Observable puede representar un stream infinito de valores y puede cancelarse; una Promise emite exactamente un valor (o error) y no puede cancelarse. En Angular, HttpClient retorna Observables porque permite cancelar pedidos HTTP en vuelo via `unsubscribe()`.

Los operadores de transformación más importantes son: `switchMap` (cancela el Observable anterior al llegar uno nuevo, ideal para búsquedas en tiempo real), `mergeMap` (ejecuta todos en paralelo, ideal para requests independientes), `concatMap` (espera que termine uno antes de empezar el siguiente, ideal para operaciones que deben ser ordenadas), y `exhaustMap` (ignora nuevos valores mientras el actual no terminó, ideal para evitar double-submit). Confundir estos operadores es fuente de bugs difíciles.

Los **memory leaks** por suscripciones no canceladas son el bug más común en Angular. Si un componente se suscribe a un Observable en `ngOnInit` y no cancela en `ngOnDestroy`, la suscripción sigue activa después de que el componente se destruye. Las soluciones modernas son: `AsyncPipe` (cancela automáticamente), `takeUntilDestroyed()` (Angular 16+), o mantener la referencia y llamar `unsubscribe()` manualmente en `ngOnDestroy`.

#### Examples
switchMap para búsqueda en tiempo real (cancela la request anterior)
```typescript
import { Component, OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { switchMap, debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, AsyncPipe],
  template: `
    <input [formControl]="search" placeholder="Search..." />
    <ul>
      @for (result of results$ | async; track result.id) {
        <li>{{ result.name }}</li>
      }
    </ul>
  `
})
export class SearchComponent {
  search = new FormControl('');

  results$ = this.search.valueChanges.pipe(
    debounceTime(300),
    distinctUntilChanged(),
    switchMap(query => this.http.get<Result[]>(`/api/search?q=${query}`))
    // Si el usuario escribe antes de que responda, switchMap cancela la request anterior
  );

  constructor(private http: HttpClient) {}
}
```

mergeMap vs concatMap vs exhaustMap
```typescript
// mergeMap, todos en paralelo (no garantiza orden)
ids$.pipe(mergeMap(id => this.http.get(`/api/item/${id}`))).subscribe();

// concatMap, uno a la vez, en orden
queue$.pipe(concatMap(task => this.taskService.execute(task))).subscribe();

// exhaustMap, ignora nuevos clicks hasta que el actual termine (anti double-submit)
clicks$.pipe(exhaustMap(() => this.http.post('/api/submit', payload))).subscribe();
```

takeUntilDestroyed para cancelación automática
```typescript
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({ standalone: true, template: '' })
export class DataComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private dataService = inject(DataService);

  ngOnInit() {
    this.dataService.liveUpdates$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => { /* se cancela automáticamente al destruir el componente */ });
  }
}
```

#### Sources
- [Angular RxJS Interop](https://angular.dev/ecosystem/rxjs-interop)
- [Angular HTTP Client](https://angular.dev/guide/http)
- [RxJS Operators, switchMap](https://rxjs.dev/api/operators/switchMap)

---

### Routing y lazy loading
#### Details
El `Router` de Angular usa una configuración declarativa de rutas donde cada entrada define `path`, `component` (o `loadComponent` para lazy), y opcionalmente `children`, `guards`, y `resolve`. La navegación puede ser declarativa via `RouterLink` en el template o imperativa via `Router.navigate()` o `Router.navigateByUrl()` en el código. La diferencia: usa `RouterLink` cuando el destino se conoce en el template; usa navegación imperativa cuando la redirección depende de lógica (resultado de una llamada HTTP, por ejemplo).

Los **guards** controlan el acceso y la navegación. `CanActivate` (o la forma funcional `canActivate`) decide si se puede activar una ruta, el caso de uso principal es autenticación. `CanDeactivate` decide si se puede abandonar una ruta, útil para confirmar antes de cerrar un formulario con cambios sin guardar. `Resolve` prefetch datos antes de activar la ruta, para que el componente los reciba ya listos via `ActivatedRoute.data`. En Angular 15.2+ los guards reemplazaron la forma de clase por funciones puras, lo que es más simple y testeable.

El **lazy loading** divide el bundle inicial cargando módulos o componentes solo cuando se navega a esa ruta. `loadChildren` carga un conjunto de rutas (históricamente un NgModule, ahora puede ser un array de rutas standalone). `loadComponent` carga un único componente standalone. Esto es fundamental para el rendimiento de apps grandes: el bundle inicial puede reducirse 60-80% con una estrategia de lazy loading bien diseñada.

#### Examples
Routing standalone con lazy loading y guards funcionales (Angular 15+)
```typescript
// app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./home/home.component').then(m => m.HomeComponent) },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent),
    children: [
      { path: 'settings', loadComponent: () => import('./settings/settings.component').then(m => m.SettingsComponent) }
    ]
  },
  { path: '**', redirectTo: '' }
];

// auth.guard.ts, guard funcional
export const authGuard = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? true : router.createUrlTree(['/login']);
};
```

Resolve para prefetch de datos
```typescript
// user.resolver.ts
export const userResolver: ResolveFn<User> = (route) => {
  return inject(UserService).getUser(route.paramMap.get('id')!);
};

// En las rutas:
{ path: 'users/:id', component: UserDetailComponent, resolve: { user: userResolver } }

// En el componente:
export class UserDetailComponent {
  user = inject(ActivatedRoute).snapshot.data['user'] as User;
}
```

#### Sources
- [Angular Router](https://angular.dev/guide/routing)
- [Angular Lazy Loading](https://angular.dev/guide/ngmodules/lazy-loading)
- [Angular Route Guards](https://angular.dev/guide/routing/common-router-tasks#preventing-unauthorized-access)

---

### Formularios: Template-driven vs Reactive
#### Details
Los formularios **template-driven** definen la lógica de validación en el HTML usando directivas (`required`, `minlength`, `ngModel`). Son simples y apropiados para formularios pequeños con poca lógica dinámica. Requieren `FormsModule`. El acceso al estado del formulario se hace via referencias de template (`#form="ngForm"`).

Los formularios **reactivos** definen el modelo en TypeScript con `FormControl`, `FormGroup`, y `FormArray`. Son más predecibles, más testeables (el estado es un objeto JS puro), y más adecuados para formularios complejos con validaciones dinámicas. Requieren `ReactiveFormsModule`. Los **validators** síncronos reciben el control y retornan `null` (válido) o un objeto de error `{ [key: string]: any }`. Los **validators asíncronos** retornan un `Observable<ValidationErrors | null>` o `Promise`, úsalos para verificaciones en servidor (email único, username disponible).

`updateOn: 'blur'` o `updateOn: 'submit'` configura cuándo se actualiza el valor del control, lo que reduce la cantidad de eventos de cambio para validaciones costosas. El estado de un control incluye `valid`, `invalid`, `touched` (el usuario lo visitó), `dirty` (el usuario lo modificó), y `errors` (objeto con los errores activos). La práctica correcta para mostrar errores es verificar que el campo está `touched` o `dirty` antes de mostrarlos, para no abrumar con errores al cargar el formulario.

#### Examples
Reactive form con validators síncronos y asíncronos
```typescript
import { Component } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule, AbstractControl } from '@angular/forms';
import { map } from 'rxjs/operators';

// Validator asíncrono para email único
const uniqueEmailValidator = (http: HttpClient) => 
  (control: AbstractControl) =>
    http.get<{ exists: boolean }>(`/api/check-email?email=${control.value}`).pipe(
      map(res => res.exists ? { emailTaken: true } : null)
    );

@Component({
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()">
      <input formControlName="email" type="email" />
      @if (form.get('email')?.touched && form.get('email')?.hasError('email')) {
        <span>Email inválido</span>
      }
      @if (form.get('email')?.hasError('emailTaken')) {
        <span>Este email ya está registrado</span>
      }

      <input formControlName="password" type="password" />

      <button type="submit" [disabled]="form.invalid || form.pending">Submit</button>
    </form>
  `
})
export class RegisterComponent {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);

  form = this.fb.group({
    email: ['', {
      validators: [Validators.required, Validators.email],
      asyncValidators: [uniqueEmailValidator(this.http)],
      updateOn: 'blur'  // solo valida al perder foco, no en cada tecla
    }],
    password: ['', [Validators.required, Validators.minLength(8)]]
  });

  submit() {
    if (this.form.valid) console.log(this.form.value);
  }
}
```

FormArray para listas dinámicas
```typescript
form = this.fb.group({
  tags: this.fb.array([this.fb.control('angular')])
});

get tags() { return this.form.get('tags') as FormArray; }

addTag() { this.tags.push(this.fb.control('')); }
removeTag(i: number) { this.tags.removeAt(i); }
```

#### Sources
- [Angular Reactive Forms](https://angular.dev/guide/forms/reactive-forms)
- [Angular Template-driven Forms](https://angular.dev/guide/forms/template-driven-forms)
- [Angular Form Validation](https://angular.dev/guide/forms/form-validation)

---

### Change Detection y rendimiento
#### Details
Por defecto Angular usa **zone.js**, un parcheo del runtime que intercepta todas las APIs asíncronas del navegador (setTimeout, fetch, eventos del DOM) y dispara change detection en toda la app después de cada operación asíncrona. Esto es cómodo pero ineficiente en apps grandes: un click en cualquier parte puede disparar checks en cientos de componentes.

`ChangeDetectionStrategy.OnPush` limita cuándo Angular hace change detection en un componente: solo cuando un `@Input` cambia por referencia, cuando un evento en el template del componente ocurre, o cuando se llama explícitamente `ChangeDetectorRef.markForCheck()`. La consecuencia importante: con OnPush, mutar un objeto existente (`obj.name = 'new'`) NO dispara change detection porque la referencia del objeto es la misma. La solución es crear nuevas referencias (`{ ...obj, name: 'new' }`), lo que también favorece la inmutabilidad y hace el estado más predecible.

`trackBy` en `*ngFor` (o `track` en `@for`) le dice a Angular cómo identificar items de una lista. Sin él, cuando la lista cambia Angular destruye y recrea todos los DOM nodes. Con él, solo modifica los nodos que realmente cambiaron. Es una optimización obligatoria en listas que pueden actualizarse en tiempo real. `NgZone.runOutsideAngular()` sirve para ejecutar código que no debe disparar change detection (animaciones con requestAnimationFrame, WebSockets de alta frecuencia, etc.) y luego entrar a la zona solo cuando querés actualizar la UI.

#### Examples
OnPush con la restricción de referencias
```typescript
@Component({
  selector: 'app-user-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p>{{ user.name }}</p>`
})
export class UserCardComponent {
  @Input() user!: User;
}

// En el padre:
// ❌ NO dispara change detection en UserCardComponent con OnPush:
// this.user.name = 'Ana';

// ✅ SÍ dispara (nueva referencia):
// this.user = { ...this.user, name: 'Ana' };
```

trackBy para optimizar listas
```typescript
@Component({
  standalone: true,
  template: `
    <!-- Sintaxis moderna @for con track (obligatorio) -->
    @for (product of products; track product.id) {
      <app-product-card [product]="product" />
    }

    <!-- Sintaxis clásica con trackBy -->
    <li *ngFor="let item of items; trackBy: trackById">{{ item.name }}</li>
  `
})
export class ProductListComponent {
  @Input() products: Product[] = [];
  @Input() items: Item[] = [];

  trackById(_index: number, item: Item) {
    return item.id;  // Angular reutiliza el DOM node si el id no cambia
  }
}
```

NgZone.runOutsideAngular para evitar CD en operaciones de alta frecuencia
```typescript
@Component({ standalone: true, template: '<canvas #canvas></canvas>' })
export class AnimationComponent implements OnInit {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  private ngZone = inject(NgZone);

  ngOnInit() {
    this.ngZone.runOutsideAngular(() => {
      // El requestAnimationFrame no disparará CD
      const animate = () => {
        this.draw();
        requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    });
  }

  private draw() { /* renderizado del canvas */ }
}
```

#### Sources
- [Angular Change Detection](https://angular.dev/best-practices/runtime-performance)
- [Angular OnPush Change Detection](https://angular.dev/best-practices/skipping-component-subtrees)
- [Angular Zoneless](https://angular.dev/guide/experimental/zoneless)

---

### Standalone components (v15+) y el futuro sin módulos
#### Details
Los **standalone components** (estabilizados en Angular 15) eliminan la necesidad de declarar componentes en un `NgModule`. Un componente standalone se declara con `standalone: true` en el decorador `@Component` e importa directamente en su array `imports` todo lo que necesita: otros componentes, directivas, pipes, o módulos enteros. Esto hace que cada componente sea autocontenido y más fácil de razonar, testear, y reutilizar.

`bootstrapApplication()` reemplaza a `platformBrowserDynamic().bootstrapModule(AppModule)` para arrancar la app. La configuración global (router, HTTP, interceptores) se provee via funciones de configuración (`provideRouter(routes)`, `provideHttpClient()`, `provideAnimations()`) en el array `providers` de `bootstrapApplication`. `importProvidersFrom()` permite adoptar librerías que todavía usan NgModule sin tener que abandonar la arquitectura standalone.

La migración gradual es posible: componentes standalone pueden coexistir con NgModules. Para migrar un componente existente, se agrega `standalone: true`, se mueve lo que tenía declarado en el módulo al `imports` del componente, y se remueve del `declarations` del módulo. Angular CLI ofrece el schematic `ng generate @angular/core:standalone` para automatizar partes de la migración. La recomendación oficial es usar standalone por defecto en nuevos proyectos desde Angular 17.

#### Examples
Standalone bootstrap y configuración
```typescript
// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { AppComponent } from './app.component';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
  ]
});
```

Standalone component autocontenido
```typescript
import { Component, Input } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-invoice-card',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, RouterLink],  // todo lo que usa en el template
  template: `
    <article>
      <h3><a [routerLink]="['/invoices', invoice.id]">{{ invoice.reference }}</a></h3>
      <p>{{ invoice.amount | currency:'ARS' }}</p>
      <p>{{ invoice.date | date:'shortDate' }}</p>
    </article>
  `
})
export class InvoiceCardComponent {
  @Input() invoice!: Invoice;
}
```

importProvidersFrom para librerías con NgModule legacy
```typescript
bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(SomeLibraryModule.forRoot({ key: 'value' })),
    provideRouter(routes),
  ]
});
```

#### Sources
- [Angular Standalone Components](https://angular.dev/guide/components/importing)
- [Angular Standalone Migration](https://angular.dev/reference/migrations/standalone)
- [Angular bootstrapApplication](https://angular.dev/api/platform-browser/bootstrapApplication)
