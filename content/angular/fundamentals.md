---
stack: angular
id: angular-fundamentals
title: "Angular: Componentes, DI y lifecycle"
area: Frontend
priority: high
resourceLabel: Angular, Documentation
resourceUrl: https://angular.dev/overview
---

## Summary
Los fundamentos de Angular que aparecen en toda entrevista: cómo se arman los componentes, cómo el sistema de DI provee servicios, el orden exacto del lifecycle, la diferencia entre directivas estructurales y de atributo, y qué cambia con Signals en v17+.

## Concepts

### Componentes y la arquitectura Angular
#### Details
Un componente es la unidad básica de Angular: combina una clase TypeScript decorada con `@Component`, un template HTML y estilos encapsulados. El selector define la etiqueta HTML que instancia el componente. La arquitectura Angular es jerárquica: la app se organiza en un árbol de componentes donde los datos fluyen hacia abajo vía `@Input` y los eventos fluyen hacia arriba vía `@Output` y `EventEmitter`.

El **template syntax** tiene cuatro formas de binding: interpolación `{{ expr }}` para texto, property binding `[prop]="value"` para pasar datos al DOM o a un hijo, event binding `(event)="handler()"` para escuchar eventos del DOM, y two-way binding `[(ngModel)]="field"` (que es azúcar sintáctico para `[ngModel]` + `(ngModelChange)`). El two-way binding requiere importar `FormsModule`.

`@Input()` define una propiedad que el componente padre puede pasar. `@Output()` expone un `EventEmitter` para comunicar eventos al padre. `@ViewChild` da acceso a un hijo directo en el template del mismo componente; `@ContentChild` da acceso a contenido proyectado via `<ng-content>`. Ambos están disponibles a partir del hook `ngAfterViewInit`.

#### Examples
Componente con @Input, @Output y two-way binding
```typescript
import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-counter',
  standalone: true,
  template: `
    <p>Count: {{ count }}</p>
    <button (click)="increment()">+</button>
    <button (click)="reset.emit()">Reset</button>
  `
})
export class CounterComponent {
  @Input() count = 0;
  @Output() reset = new EventEmitter<void>();
  @Output() countChange = new EventEmitter<number>();

  increment() {
    this.count++;
    this.countChange.emit(this.count);
  }
}
```

ViewChild para acceder a un elemento del DOM
```typescript
import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';

@Component({
  selector: 'app-focus',
  standalone: true,
  template: `<input #myInput type="text" />`
})
export class FocusComponent implements AfterViewInit {
  @ViewChild('myInput') inputRef!: ElementRef<HTMLInputElement>;

  ngAfterViewInit() {
    this.inputRef.nativeElement.focus();
  }
}
```

#### Sources
- [Angular Components](https://angular.dev/guide/components)
- [Angular Template Syntax](https://angular.dev/guide/templates)
- [Angular Inputs](https://angular.dev/guide/components/inputs)
- [Angular Outputs](https://angular.dev/guide/components/outputs)

---

### Dependency Injection
#### Details
El sistema de Dependency Injection de Angular es jerárquico: existe un injector raíz (root), injectors por módulo/entorno, e injectors por componente. Cuando Angular necesita un token, recorre el árbol hacia arriba hasta encontrar un proveedor. Si no lo encuentra, lanza un error.

`@Injectable({ providedIn: 'root' })` registra el servicio en el injector raíz como singleton: toda la app comparte la misma instancia. Es el patrón recomendado para servicios stateless o con estado global. Proveer el servicio en un componente (`providers: [MyService]`) crea una instancia nueva para ese componente y sus descendientes, lo que permite estado aislado por subtree.

`InjectionToken` sirve para inyectar valores que no son clases: configuración, strings, funciones, o interfaces. Se define fuera de la clase y se inyecta con `inject(TOKEN)` o via el decorador `@Inject(TOKEN)` en el constructor. Con la API funcional `inject()` (disponible desde Angular 14+), se puede usar DI fuera del constructor, incluso en funciones standalone.

#### Examples
Servicio singleton vs. servicio scoped
```typescript
// Singleton, una sola instancia para toda la app
@Injectable({ providedIn: 'root' })
export class AuthService {
  private user = signal<User | null>(null);
  isAuthenticated = computed(() => this.user() !== null);
}

// Scoped, instancia nueva por componente
@Component({
  selector: 'app-cart',
  providers: [CartService],  // nueva instancia aquí
  template: `...`
})
export class CartComponent {}
```

InjectionToken para configuración
```typescript
import { InjectionToken, inject } from '@angular/core';

export const API_URL = new InjectionToken<string>('API_URL');

// En bootstrapApplication o providers del módulo:
providers: [{ provide: API_URL, useValue: 'https://api.example.com' }]

// En un servicio o componente:
@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = inject(API_URL);
}
```

#### Sources
- [Angular Dependency Injection](https://angular.dev/guide/di)
- [Angular Hierarchical Injectors](https://angular.dev/guide/di/hierarchical-dependency-injection)
- [InjectionToken](https://angular.dev/api/core/InjectionToken)

---

### Lifecycle hooks
#### Details
Angular ejecuta los lifecycle hooks en un orden determinístico. El orden completo es: `ngOnChanges` → `ngOnInit` → `ngDoCheck` → `ngAfterContentInit` → `ngAfterContentChecked` → `ngAfterViewInit` → `ngAfterViewChecked` → `ngOnDestroy`. `ngOnChanges` se ejecuta antes de `ngOnInit` si hay inputs, y luego en cada cambio de input.

El **constructor** debe usarse solo para inyectar dependencias vía DI. `ngOnInit` es el lugar correcto para inicializar lógica, llamar servicios, o suscribirse a observables, porque en ese punto los inputs ya tienen sus valores. Usar el constructor para llamadas HTTP o acceso a inputs es un error común: los inputs aún no están asignados en el constructor.

`ngOnDestroy` es crítico para evitar memory leaks: aquí se deben cancelar suscripciones a observables, timers, o event listeners manuales. Con Angular 16+ el operador `takeUntilDestroyed()` simplifica esto significativamente. `ngAfterViewInit` garantiza que las referencias de `@ViewChild` y `@ContentChild` están disponibles; antes de ese hook son `undefined`.

`ChangeDetectionStrategy.OnPush` le indica a Angular que solo ejecute change detection para este componente cuando sus `@Input` cambian por referencia, cuando un evento en el componente ocurre, o cuando se use `markForCheck()`. Es la optimización de rendimiento más impactante en componentes presentacionales.

#### Examples
Orden de hooks y diferencia constructor vs ngOnInit
```typescript
@Component({ selector: 'app-example', standalone: true, template: '' })
export class ExampleComponent implements OnInit, OnChanges, OnDestroy {
  @Input() userId!: string;
  private sub?: Subscription;

  constructor(private userService: UserService) {
    // ✅ Solo DI aquí
    // ❌ this.userId no está disponible todavía
  }

  ngOnChanges(changes: SimpleChanges) {
    // Se ejecuta antes de ngOnInit si hay @Input
    if (changes['userId']) {
      console.log('userId changed:', changes['userId'].currentValue);
    }
  }

  ngOnInit() {
    // ✅ Aquí this.userId ya tiene su valor
    this.sub = this.userService.getUser(this.userId).subscribe();
  }

  ngOnDestroy() {
    this.sub?.unsubscribe(); // ✅ cleanup obligatorio
  }
}
```

takeUntilDestroyed para cleanup automático (Angular 16+)
```typescript
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({ standalone: true, template: '' })
export class ModernComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(console.log);
    // Se cancela automáticamente al destruirse el componente
  }
}
```

#### Sources
- [Angular Lifecycle Hooks](https://angular.dev/guide/components/lifecycle)
- [Angular OnPush Change Detection](https://angular.dev/best-practices/skipping-component-subtrees)

---

### Directivas y Pipes
#### Details
Las **directivas estructurales** modifican el DOM: agregan, eliminan o repiten elementos. `*ngIf` (o el bloque `@if` moderno) controla si un elemento existe; `*ngFor` (o `@for`) itera sobre colecciones; `ng-template` define bloques de template que no se renderizan solos. El asterisco `*` en `*ngIf` es azúcar sintáctico que Angular desenvuelve en un `<ng-template>`.

Las **directivas de atributo** no modifican la estructura del DOM: cambian el aspecto o comportamiento de un elemento existente. `NgClass`, `NgStyle` son ejemplos built-in. Para crear una custom, se decora una clase con `@Directive({ selector: '[appHighlight]' })` e inyectas `ElementRef` y `Renderer2` para manipular el elemento de forma segura (nunca accedás directamente al DOM via `nativeElement` en código de producción).

Los **Pipes** transforman valores en los templates. Son puros por defecto: Angular solo los re-ejecuta si el valor de entrada cambia por referencia, lo que los hace eficientes. Un pipe **impuro** (`pure: false`) se re-ejecuta en cada ciclo de change detection, lo cual es costoso y debe evitarse salvo necesidad explícita. Para crear un custom pipe se implementa `PipeTransform` y se decora con `@Pipe({ name: 'myPipe' })`.

#### Examples
Directiva estructural moderna con @if/@for (Angular 17+)
```typescript
@Component({
  selector: 'app-list',
  standalone: true,
  imports: [NgFor, NgIf],  // no necesarios con bloques @if/@for
  template: `
    @if (items.length > 0) {
      <ul>
        @for (item of items; track item.id) {
          <li>{{ item.name }}</li>
        }
      </ul>
    } @else {
      <p>No items</p>
    }
  `
})
export class ListComponent {
  @Input() items: { id: number; name: string }[] = [];
}
```

Custom attribute directive
```typescript
import { Directive, ElementRef, HostListener, Input, Renderer2 } from '@angular/core';

@Directive({ selector: '[appHighlight]', standalone: true })
export class HighlightDirective {
  @Input() appHighlight = 'yellow';

  constructor(private el: ElementRef, private renderer: Renderer2) {}

  @HostListener('mouseenter') onEnter() {
    this.renderer.setStyle(this.el.nativeElement, 'backgroundColor', this.appHighlight);
  }

  @HostListener('mouseleave') onLeave() {
    this.renderer.removeStyle(this.el.nativeElement, 'backgroundColor');
  }
}
```

Custom pipe puro
```typescript
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'truncate', standalone: true })
export class TruncatePipe implements PipeTransform {
  transform(value: string, limit = 100, trail = '...'): string {
    return value.length > limit ? value.slice(0, limit) + trail : value;
  }
}

// En template:
// {{ description | truncate:50 }}
```

#### Sources
- [Angular Structural Directives](https://angular.dev/guide/directives/structural-directives)
- [Angular Attribute Directives](https://angular.dev/guide/directives/attribute-directives)
- [Angular Pipes](https://angular.dev/guide/pipes)
- [Angular Built-in Control Flow](https://angular.dev/guide/templates/control-flow)

---

### Angular Signals (v17+)
#### Details
Los **Signals** son la primitiva reactiva nativa de Angular, introducida en v16 como developer preview y estabilizada en v17. Un `signal()` es un contenedor de valor que notifica a sus consumidores cuando cambia. `computed()` deriva un valor a partir de uno o más signals y se recalcula automáticamente (y lazily) cuando sus dependencias cambian. `effect()` ejecuta una función como side-effect cada vez que alguna de sus dependencias signals cambia.

La diferencia clave con `BehaviorSubject` de RxJS es la granularidad: Angular puede actualizar solo el componente exacto que depende de un signal, sin necesidad de zone.js ni de `markForCheck()`. Esto habilita la arquitectura **zoneless** (experimental en v17, progresando en v18+): apps sin zone.js que detectan cambios por signal graph, lo que mejora el rendimiento de arranque y el SSR.

La interoperabilidad con RxJS se hace via `toSignal()` (convierte un Observable a Signal) y `toObservable()` (convierte un Signal a Observable), ambos disponibles en `@angular/core/rxjs-interop`. La regla práctica: usá Signals para estado local del componente y estado UI sincrónico; usá Observables (y RxJS) para streams asíncronos, peticiones HTTP, y pipelines complejos donde los operadores de RxJS aportan valor real.

#### Examples
signal, computed y effect básicos
```typescript
import { Component, signal, computed, effect } from '@angular/core';

@Component({
  selector: 'app-cart',
  standalone: true,
  template: `
    <p>Items: {{ itemCount() }}</p>
    <p>Total: {{ total() | currency }}</p>
    <button (click)="addItem(9.99)">Add item</button>
  `
})
export class CartComponent {
  private prices = signal<number[]>([]);

  itemCount = computed(() => this.prices().length);
  total = computed(() => this.prices().reduce((a, b) => a + b, 0));

  constructor() {
    effect(() => {
      // Se ejecuta cada vez que `total` cambia
      console.log('New cart total:', this.total());
    });
  }

  addItem(price: number) {
    this.prices.update(p => [...p, price]);
  }
}
```

Interop RxJS, toSignal y toObservable
```typescript
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';

@Component({ standalone: true, template: '{{ user()?.name }}' })
export class ProfileComponent {
  private http = inject(HttpClient);

  // Observable → Signal (requiere injection context)
  user = toSignal(this.http.get<User>('/api/me'), { initialValue: null });

  // Signal → Observable (para componer con operadores RxJS)
  private search = signal('');
  search$ = toObservable(this.search).pipe(debounceTime(300));
}
```

#### Sources
- [Angular Signals](https://angular.dev/guide/signals)
- [Angular RxJS Interop](https://angular.dev/ecosystem/rxjs-interop)
- [Angular Zoneless](https://angular.dev/guide/experimental/zoneless)
