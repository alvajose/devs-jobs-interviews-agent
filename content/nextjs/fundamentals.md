---
stack: nextjs
id: nextjs-fundamentals
title: "Next.js: App Router, Server Components y data fetching"
area: Frontend
priority: high
resourceLabel: Next.js, Documentation
resourceUrl: https://nextjs.org/docs
---

## Summary
Los pilares del App Router que se asumen en cualquier entrevista senior de Next.js: file-system routing, el modelo de componentes server/client, las estrategias de data fetching, Server Actions y rendering strategies.

## Concepts

### App Router vs Pages Router
#### Details
El **App Router** (estable desde Next.js 13.4) introduce una convención basada en carpetas bajo `app/`. Cada ruta es un directorio con archivos especiales: `page.tsx` define la UI pública de la ruta, `layout.tsx` envuelve a todos los segmentos hijos y persiste entre navegaciones, `loading.tsx` activa un Suspense boundary automático mientras la data carga, y `error.tsx` captura errores dentro del segmento con un Error Boundary.

Los **route groups** `(folder)` permiten organizar rutas en carpetas sin añadir ese segmento a la URL: `app/(marketing)/about/page.tsx` resuelve a `/about`. Son útiles para aplicar distintos layouts a grupos de rutas sin afectar la URL. Las **parallel routes** con la convención `@slot` permiten renderizar múltiples páginas simultáneamente dentro del mismo layout (ideal para dashboards con paneles independientes).

La diferencia clave frente al Pages Router es que en el App Router **todos los componentes son Server Components por defecto**, lo que cambia el modelo mental: ya no hay `getServerSideProps` ni `getStaticProps`; el fetching de data ocurre directamente en el componente con `async/await`. La migración desde Pages a App Router tiene sentido cuando necesitás colocación de data con los componentes, layouts anidados sin re-render, o acceso a primitivas de streaming y Server Actions.

#### Examples
Estructura de ruta con archivos especiales
```
app/
  layout.tsx        ← layout raíz (persistent shell)
  page.tsx          ← ruta "/"
  dashboard/
    layout.tsx      ← layout de dashboard
    page.tsx        ← ruta "/dashboard"
    loading.tsx     ← Suspense automático
    error.tsx       ← Error Boundary del segmento
    @analytics/     ← parallel route slot
      page.tsx
  (marketing)/      ← route group, no aparece en la URL
    about/
      page.tsx      ← ruta "/about"
```

Layout raíz mínimo
```tsx
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
```

#### Sources
- [Next.js docs, App Router: Routing Fundamentals](https://nextjs.org/docs/app/building-your-application/routing)
- [Next.js docs, Route Groups](https://nextjs.org/docs/app/building-your-application/routing/route-groups)
- [Next.js docs, Parallel Routes](https://nextjs.org/docs/app/building-your-application/routing/parallel-routes)

### Server Components vs Client Components
#### Details
En el App Router, **todos los componentes son Server Components por defecto**. Se ejecutan exclusivamente en el servidor: pueden acceder a bases de datos, sistemas de archivos y secretos de entorno directamente, sin exponer nada al cliente. No pueden usar hooks de React (`useState`, `useEffect`) ni event handlers, porque no tienen instancia en el browser.

Los **Client Components** se marcan con `"use client"` al inicio del archivo. Ese directive establece una "boundary": ese componente y sus imports descendentes se hidratan en el cliente. Pueden usar hooks, event handlers, APIs del browser y libraries que dependan de `window`. **El boundary solo "baja"**: agregar `"use client"` a un componente hace cliente a todos sus hijos importados directamente, pero no a los pasados como `children` (que siguen siendo Server Components).

El patrón clave es **"lifting the boundary up"**: si solo una parte de la UI necesita interactividad, extraés esa parte mínima a un Client Component y le pasás el resto (Server Components) como `children` props. Así el árbol de composición mantiene la mayor parte del rendering en el servidor, reduciendo el bundle del cliente. Un error común es marcar como `"use client"` componentes grandes que solo usan un hook en una esquina.

#### Examples
Server Component con acceso a DB (no necesita "use client")
```tsx
// app/products/page.tsx
import { db } from "@/lib/db";

export default async function ProductsPage() {
  const products = await db.product.findMany(); // acceso directo, sin exposición al cliente
  return <ProductList products={products} />;
}
```

Lifting the boundary: Client Component mínimo, Server Component como children
```tsx
// components/interactive-shell.tsx
"use client";
import { useState } from "react";

export function InteractiveShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(!open)}>Toggle</button>
      {open && children} {/* children puede ser un Server Component */}
    </div>
  );
}

// app/page.tsx (Server Component)
import { InteractiveShell } from "@/components/interactive-shell";
import { HeavyDataComponent } from "@/components/heavy-data"; // Server Component

export default function Page() {
  return (
    <InteractiveShell>
      <HeavyDataComponent /> {/* se ejecuta en el servidor */}
    </InteractiveShell>
  );
}
```

#### Sources
- [Next.js docs, Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [Next.js docs, Client Components](https://nextjs.org/docs/app/building-your-application/rendering/client-components)
- [Next.js docs, Composition Patterns](https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns)

### Data fetching en App Router
#### Details
En el App Router, el data fetching ocurre directamente en Server Components con `async/await`. Next.js extiende la API nativa `fetch` con dos opciones clave: `cache: 'no-store'` para data dinámica (equivalente a SSR: se refetch en cada request) y `next: { revalidate: N }` para ISR (se re-valida cada N segundos). El comportamiento por defecto de `fetch` es `cache: 'force-cache'` (se cachea indefinidamente como SSG), aunque en Next.js 15 este default cambió a `no-store`.

Para rutas dinámicas con páginas pre-generadas en build time, `generateStaticParams` reemplaza a `getStaticPaths`. Retorna un array de params y Next.js genera una página estática por cada uno. Para caching de operaciones arbitrarias (no solo `fetch`), existe `unstable_cache` que envuelve cualquier función async con las mismas semánticas de revalidación.

La elección entre `loading.tsx` y `<Suspense>` manual depende de la granularidad: `loading.tsx` wrappea toda la página automáticamente (streaming del layout + Suspense boundary a nivel de ruta), mientras que `<Suspense>` manual permite suspender partes específicas del árbol con sus propios fallbacks. Para una sección de la página que carga lento mientras el resto está disponible, Suspense manual es la herramienta correcta.

#### Examples
Fetch con revalidación (ISR en App Router)
```tsx
// app/posts/page.tsx
async function getPosts() {
  const res = await fetch("https://api.example.com/posts", {
    next: { revalidate: 3600 }, // revalida cada hora
  });
  return res.json();
}

export default async function PostsPage() {
  const posts = await getPosts();
  return <PostList posts={posts} />;
}
```

generateStaticParams para SSG de rutas dinámicas
```tsx
// app/posts/[slug]/page.tsx
export async function generateStaticParams() {
  const posts = await fetch("https://api.example.com/posts").then(r => r.json());
  return posts.map((post: { slug: string }) => ({ slug: post.slug }));
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  const post = await fetch(`https://api.example.com/posts/${params.slug}`).then(r => r.json());
  return <Article post={post} />;
}
```

Suspense manual para una sección específica
```tsx
import { Suspense } from "react";
import { ProductReviews } from "./product-reviews"; // async Server Component

export default function ProductPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <ProductDetails id={params.id} />
      <Suspense fallback={<ReviewsSkeleton />}>
        <ProductReviews id={params.id} />
      </Suspense>
    </div>
  );
}
```

#### Sources
- [Next.js docs, Data Fetching](https://nextjs.org/docs/app/building-your-application/data-fetching/fetching)
- [Next.js docs, generateStaticParams](https://nextjs.org/docs/app/api-reference/functions/generate-static-params)
- [Next.js docs, unstable_cache](https://nextjs.org/docs/app/api-reference/functions/unstable_cache)

### Server Actions
#### Details
Las **Server Actions** son funciones async que se ejecutan en el servidor y pueden invocarse directamente desde Client o Server Components. Se marcan con `"use server"` al inicio de la función (o del archivo para marcar todas sus exports). Son la alternativa recomendada para mutaciones en lugar de Route Handlers cuando la acción está acoplada a un componente específico: eliminan el boilerplate de crear una API route para cada mutación.

`useFormStatus` y `useActionState` (antes `useFormState`) son los hooks del lado cliente para integrarse con Server Actions en formularios: el primero provee el estado `pending` del form submission más cercano, el segundo acumula el estado de la acción (resultado anterior + estado de error) entre llamadas. Después de una mutación exitosa, hay que invalidar la caché con `revalidatePath('/ruta')` para que la UI refleje los cambios, o con `revalidateTag('tag')` para invalidar por etiqueta de forma más granular.

La pregunta clave en entrevista: **¿cuándo preferís Server Actions sobre Route Handlers?** Server Actions cuando la mutación está ligada a un formulario o acción de usuario y no necesita ser consumida por terceros. Route Handlers cuando necesitás un endpoint REST clásico (webhooks, apps mobile, consumo externo, CORS controlado).

#### Examples
Server Action con revalidación
```tsx
// app/todos/actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export async function createTodo(formData: FormData) {
  const title = formData.get("title") as string;
  await db.todo.create({ data: { title } });
  revalidatePath("/todos"); // invalida la caché del segmento
}
```

Formulario con useActionState y useFormStatus
```tsx
// app/todos/new-todo-form.tsx
"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createTodo } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending}>{pending ? "Guardando..." : "Crear"}</button>;
}

export function NewTodoForm() {
  const [state, action] = useActionState(createTodo, null);
  return (
    <form action={action}>
      <input name="title" required />
      <SubmitButton />
      {state?.error && <p>{state.error}</p>}
    </form>
  );
}
```

#### Sources
- [Next.js docs, Server Actions and Mutations](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [Next.js docs, revalidatePath](https://nextjs.org/docs/app/api-reference/functions/revalidatePath)
- [Next.js docs, revalidateTag](https://nextjs.org/docs/app/api-reference/functions/revalidateTag)

### Rendering strategies
#### Details
Next.js ofrece cuatro estrategias de rendering por segmento de ruta. **SSG** (Static Site Generation): la página se genera en build time, se sirve desde CDN, latencia mínima. Ideal para contenido que no cambia por request (blog, docs, landing pages). **SSR** (Server-Side Rendering): se genera en cada request, permite personalización por usuario y acceso a cookies/headers. Mayor latencia que SSG. **ISR** (Incremental Static Regeneration): combina SSG con revalidación periódica (`next: { revalidate: N }`); la primera request después de que expire el TTL regenera la página en background. **Partial Prerendering (PPR)**: experimental en Next.js 14/15, pre-renderiza el shell estático de la página y hace streaming de partes dinámicas envueltas en Suspense, todo en un mismo request.

Las variables de segmento `export const dynamic = 'force-static'` y `'force-dynamic'` permiten sobreescribir el comportamiento inferido por Next.js. Por defecto, Next.js infiere la estrategia: si el segmento usa `headers()`, `cookies()` o `fetch` con `no-store`, se vuelve dinámico automáticamente. `force-static` fuerza SSG incluso si hay funciones dinámicas (devuelven valores vacíos). La caché opera a nivel de segmento: distintas partes del layout pueden tener estrategias distintas.

#### Examples
ISR con revalidación y fallback dinámico
```tsx
// app/products/[id]/page.tsx
export const revalidate = 3600; // ISR: revalida cada hora para todo el segmento

// Forzar SSR completo
export const dynamic = "force-dynamic";

// Forzar SSG incluso con funciones dinámicas
export const dynamic = "force-static";
```

Partial Prerendering (PPR), experimental
```tsx
// next.config.ts
const nextConfig = {
  experimental: { ppr: true },
};

// app/product/[id]/page.tsx
import { Suspense } from "react";
import { StaticProductInfo } from "./static-info";    // pre-rendered
import { DynamicRecommendations } from "./dynamic";    // streamed

export default function ProductPage({ params }: { params: { id: string } }) {
  return (
    <>
      <StaticProductInfo id={params.id} />
      <Suspense fallback={<Skeleton />}>
        <DynamicRecommendations id={params.id} />
      </Suspense>
    </>
  );
}
```

#### Sources
- [Next.js docs, Rendering Strategies](https://nextjs.org/docs/app/building-your-application/rendering)
- [Next.js docs, Partial Prerendering](https://nextjs.org/docs/app/building-your-application/rendering/partial-prerendering)
- [Next.js docs, Route Segment Config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config)

## Interview Questions

### ¿Cuál es la diferencia fundamental entre el App Router y el Pages Router?
El App Router introduce Server Components como default, layouts anidados que persisten entre navegaciones y data fetching colocado en los componentes con `async/await`. El Pages Router usa Client Components por defecto y separa el fetching en funciones especiales (`getServerSideProps`, `getStaticProps`). La diferencia más impactante es el modelo de rendering: en el App Router, el servidor hace más trabajo por defecto y el bundle del cliente es más pequeño.

### ¿Qué pasa si no ponés `"use client"` en un componente que usa `useState`?
Next.js lanza un error en build time porque `useState` solo existe en el cliente y los Server Components se ejecutan en el servidor donde no hay React runtime de cliente. El error es: "You're importing a component that needs useState. It only works in a Client Component but none of its parents are marked with `'use client'`". La solución es agregar `"use client"` al archivo del componente que usa el hook.

### ¿Cuándo usarías `revalidatePath` vs `revalidateTag`?
`revalidatePath('/ruta')` invalida la caché de un segmento específico: simple y directo cuando la mutación afecta exactamente esa ruta. `revalidateTag('tag')` invalida todas las llamadas `fetch` que tengan ese tag (`fetch(url, { next: { tags: ['products'] } })`), lo que es más granular cuando varios segmentos consumen la misma data. Para una mutación que afecta un recurso compartido por múltiples páginas, `revalidateTag` evita tener que listar cada ruta afectada.

### ¿Podés pasar un Server Component como prop a un Client Component?
Sí, pero solo como `children` u otras props de tipo `ReactNode`. No podés importar un Server Component dentro de un Client Component (se convertiría en cliente). El patrón correcto es componer desde un Server Component padre que importa ambos y pasa el Server Component como `children` al Client Component. Así el Server Component sigue ejecutándose en el servidor aunque "viva" dentro de un Client Component en el árbol de renderizado.
