---
stack: nextjs
id: nextjs-advanced
title: "Next.js: Performance, auth y deployment"
area: Frontend
priority: high
resourceLabel: Next.js, Optimizing
resourceUrl: https://nextjs.org/docs/app/building-your-application/optimizing
---

## Summary
Optimización de assets, middleware, autenticación con Auth.js, diseño de Route Handlers y el modelo de caché en capas: las áreas que separan a un dev Next.js intermedio de uno senior.

## Concepts

### Optimización de imágenes y fuentes
#### Details
`next/image` es un wrapper sobre `<img>` que agrega lazy loading por defecto, optimización de formato (WebP/AVIF automático), redimensionado en servidor y prevención de Cumulative Layout Shift (CLS). La prop `sizes` le dice al browser qué ancho esperar según el breakpoint (mapea 1:1 a `srcset`). `priority` desactiva el lazy loading y hace prefetch de la imagen, necesario para imágenes above the fold que impactan el **LCP**. `placeholder="blur"` con `blurDataURL` muestra un placeholder mientras carga, eliminando el salto de layout.

`next/font` descarga las fuentes en build time, las sirve self-hosted (sin requests a Google Fonts en runtime), hace subsetting automático (solo los caracteres usados), y agrega `font-display: swap` para evitar FOUT (Flash of Unstyled Text). Para variable fonts, un solo archivo cubre todos los weights, mejorando LCP al reducir requests. El impacto en Core Web Vitals es directo: `next/image` reduce CLS (tamaño reservado) y LCP (formato optimizado + priority); `next/font` reduce CLS (no hay layout shift por fuente) y elimina requests de terceros que bloquean el render.

#### Examples
`next/image` con priority y sizes responsive
```tsx
import Image from "next/image";

// Hero image, above the fold, usar priority
<Image
  src="/hero.jpg"
  alt="Hero banner"
  width={1200}
  height={600}
  priority
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 1200px"
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,..."
/>
```

`next/font` con Google Fonts y variable font
```tsx
// app/layout.tsx
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter", // expone como CSS variable
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
```

#### Sources
- [Next.js docs, Image Optimization](https://nextjs.org/docs/app/building-your-application/optimizing/images)
- [Next.js docs, Font Optimization](https://nextjs.org/docs/app/building-your-application/optimizing/fonts)

### Middleware
#### Details
`middleware.ts` en la raíz del proyecto (al mismo nivel que `app/`) intercepta requests antes de que lleguen a cualquier ruta. Se ejecuta en el **Edge runtime**: no tiene acceso a Node.js APIs, solo a las Web APIs del edge (Request, Response, Headers, cookies). La config `matcher` es un array de patrones que limita a qué rutas se aplica el middleware, evitando que se ejecute en assets estáticos o API routes internas.

Los casos de uso más comunes son: auth redirect (verificar sesión y redirigir a `/login` si no hay), feature flags y A/B testing (asignar variante en cookie y reescribir la URL a una variante diferente), i18n (detectar locale y redirigir/reescribir), y rate limiting (contar requests por IP en KV store edge). La diferencia con **Route Handlers** es que el middleware opera sobre el request/response pipeline antes del routing, mientras que Route Handlers definen endpoints que procesan la lógica de negocio. Una limitación importante: el middleware no puede importar módulos que usen APIs de Node.js (`fs`, `path`, `crypto` del módulo `node:`), hay que usar las alternativas de Web API.

#### Examples
Middleware de auth con matcher
```tsx
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const sessionToken = request.cookies.get("session-token");

  if (!sessionToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    // excluir archivos estáticos y api routes públicas
    "/((?!_next/static|_next/image|favicon.ico|api/auth).*)",
  ],
};
```

A/B testing con reescritura
```tsx
export function middleware(request: NextRequest) {
  const variant = request.cookies.get("ab-variant")?.value ?? (Math.random() > 0.5 ? "b" : "a");
  const response = NextResponse.rewrite(new URL(`/home-${variant}`, request.url));
  response.cookies.set("ab-variant", variant, { maxAge: 86400 });
  return response;
}
```

#### Sources
- [Next.js docs, Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [Next.js docs, Edge Runtime](https://nextjs.org/docs/app/building-your-application/rendering/edge-and-nodejs-runtimes)

### Autenticación
#### Details
**Auth.js** (NextAuth v5) es la librería estándar para autenticación en Next.js App Router. La configuración central vive en `auth.ts` usando `NextAuth()`, que expone las funciones `auth()`, `signIn()`, `signOut()`, y los handlers HTTP para el Route Handler de `app/api/auth/[...nextauth]/route.ts`. La función `auth()` es el reemplazo de `getServerSession`: puede usarse tanto en Server Components como en middleware y Route Handlers.

Proteger rutas tiene dos enfoques: **middleware** (centralizado, intercepta antes del routing, ideal para proteger secciones enteras) vs **Server Components** (granular por componente, con redirect condicional). El middleware es más eficiente para redirecciones masivas; los Server Components para lógica de acceso condicional dentro de una página ya autorizada. Las **session strategies** tienen trade-offs: JWT es stateless (no requiere DB para validar) pero no se puede invalidar sin workaround; DB sessions son invalidables (logout real) pero requieren una query por request.

#### Examples
Configuración básica de Auth.js v5
```tsx
// auth.ts
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { auth, signIn, signOut, handlers } = NextAuth({
  providers: [GitHub],
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user; // true = autorizado
    },
  },
});

// app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

Proteger rutas en middleware
```tsx
// middleware.ts
import { auth } from "@/auth";

export default auth((req) => {
  if (!req.auth && req.nextUrl.pathname.startsWith("/dashboard")) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }
});

export const config = { matcher: ["/dashboard/:path*"] };
```

`auth()` en un Server Component
```tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const session = await auth();
  if (!session) redirect("/login");
  return <UserProfile user={session.user} />;
}
```

#### Sources
- [Next.js docs, Authentication](https://nextjs.org/docs/app/building-your-application/authentication)
- [Auth.js docs, Next.js App Router](https://authjs.dev/getting-started/installation?framework=next.js)

### Route Handlers y API design
#### Details
Los **Route Handlers** viven en `app/api/.../route.ts` y definen funciones exportadas con el nombre del método HTTP: `GET`, `POST`, `PUT`, `DELETE`, etc. Usan `NextRequest` y `NextResponse` (extensiones de las Web API `Request`/`Response`). A diferencia del Pages Router donde un solo archivo manejaba todos los métodos con `req.method`, ahora cada método es una función exportada independiente, lo que mejora la tipabilidad y el tree-shaking.

Para CORS en Route Handlers, se configuran los headers manualmente en `NextResponse` o se usa un helper. Los **webhooks** son un caso de uso natural: el handler recibe el payload, verifica la firma (ej: Stripe `stripe.webhooks.constructEvent`), y procesa. La pregunta clave en entrevista: **Route Handlers vs Server Actions vs BFF**. Route Handlers cuando necesitás un endpoint consumible externamente (móvil, terceros, webhooks). Server Actions cuando la mutación es invocada desde tu propio frontend y no necesita ser un endpoint público. BFF (Backend for Frontend) cuando tenés lógica compleja de agregación de APIs que solo el frontend necesita.

#### Examples
Route Handler con GET y POST
```tsx
// app/api/products/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const products = await db.product.findMany({
    where: category ? { category } : undefined,
  });
  return NextResponse.json(products);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const product = await db.product.create({ data: body });
  return NextResponse.json(product, { status: 201 });
}
```

Webhook con verificación de firma
```tsx
// app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature")!;

  try {
    const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    // procesar evento...
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
}
```

#### Sources
- [Next.js docs, Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Next.js docs, CORS](https://nextjs.org/docs/app/building-your-application/routing/route-handlers#cors)

### Caching en Next.js
#### Details
Next.js App Router tiene **cuatro capas de caché** independientes. **Request Memoization**: durante un mismo render tree, llamadas `fetch` idénticas (misma URL + options) se deduplican automáticamente, útil cuando múltiples componentes del mismo render piden el mismo dato. **Data Cache**: resultado de `fetch` persistido entre requests y deployments en el servidor de Next.js; se controla con `cache` y `next.revalidate`. **Full Route Cache**: el HTML + RSC payload pre-renderizado de una ruta estática, guardado en el servidor y servido sin re-renderizar. **Router Cache**: caché del lado cliente en memoria del browser que guarda los RSC payloads de las rutas visitadas para navegación instantánea back/forward.

Para optar por no cachear: `fetch(url, { cache: 'no-store' })` o `export const dynamic = 'force-dynamic'` a nivel de segmento. `revalidatePath` invalida el Full Route Cache y Data Cache de una ruta. `revalidateTag` invalida el Data Cache de todas las requests con ese tag. El error más común: modificar datos en el servidor y ver la UI vieja porque olvidaste llamar `revalidatePath`, el Full Route Cache sirve el HTML anterior hasta que expire o se invalide explícitamente.

#### Examples
Fetch con tag para invalidación granular
```tsx
// Data fetching con tag
async function getProduct(id: string) {
  const res = await fetch(`https://api.example.com/products/${id}`, {
    next: { tags: [`product-${id}`, "products"] },
  });
  return res.json();
}

// Server Action que invalida por tag
"use server";
import { revalidateTag } from "next/cache";

export async function updateProduct(id: string, data: FormData) {
  await db.product.update({ where: { id }, data: Object.fromEntries(data) });
  revalidateTag(`product-${id}`); // invalida solo este producto
  // revalidateTag("products"); // o todos los productos
}
```

Optar por no cachear a nivel de segmento
```tsx
// app/dashboard/page.tsx
export const dynamic = "force-dynamic"; // SSR puro, sin Full Route Cache
// o equivalente:
export const revalidate = 0;
```

#### Sources
- [Next.js docs, Caching](https://nextjs.org/docs/app/building-your-application/caching)
- [Next.js docs, revalidateTag](https://nextjs.org/docs/app/api-reference/functions/revalidateTag)

## Interview Questions

### ¿Qué hace `priority` en `next/image` y cuándo lo usás?
`priority` desactiva el lazy loading y hace prefetch de la imagen como recurso de alta prioridad (equivale a `<link rel="preload">`). Lo uso en imágenes above the fold que son el LCP de la página, típicamente el hero, el logo principal o la imagen de producto en una PDP. Sin `priority`, esas imágenes cargan tarde y penalizan el LCP. La regla: si la imagen es visible sin scroll en viewport desktop, añadís `priority`.

### ¿Cuáles son las limitaciones del Edge runtime en Middleware?
El Edge runtime no tiene acceso a las APIs de Node.js: no podés usar `fs`, `path`, `crypto` (del módulo `node:`), ni librerías que dependan de ellas. Tampoco tenés acceso a conexiones de base de datos directas (los ORMs como Prisma no funcionan en edge sin el edge adapter). El runtime solo expone Web APIs estándar (Request, Response, Headers, URL, crypto de Web API). Para auth en middleware, Auth.js v5 usa JWT verificado con Web Crypto API justamente por esta limitación.

### ¿Cuándo preferís un Route Handler sobre una Server Action?
Un Route Handler cuando necesito un endpoint HTTP clásico consumible por terceros: webhooks de Stripe/GitHub, una app mobile, otra aplicación, o cuando necesito controlar headers de respuesta (CORS, content-type). Una Server Action cuando la mutación es invocada exclusivamente desde mi propio UI y quiero colocar la lógica junto al componente, con integración nativa con formularios React (`useActionState`, `useFormStatus`) sin crear un endpoint público.

### Explicá las 4 capas de caché de Next.js y qué controla cada una.
**Request Memoization**: deduplicación automática de `fetch` idénticos dentro del mismo render tree. **Data Cache**: persistencia del resultado de `fetch` entre requests, controlada con `next.revalidate` y `cache`. **Full Route Cache**: el HTML pre-renderizado del segmento, invalidado con `revalidatePath`. **Router Cache**: memoria en el browser del RSC payload de rutas visitadas, dura 30 segundos (páginas dinámicas) o 5 minutos (páginas estáticas). Cada capa tiene su propio mecanismo de invalidación, confundirlas es el origen de la mayoría de los bugs de "veo datos viejos".
