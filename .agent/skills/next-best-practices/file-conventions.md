# File Conventions

Next.js App Router uses file-based routing with special file conventions.

## Project Structure

Reference: https://nextjs.org/docs/app/getting-started/project-structure

```
app/
â”œâ”€â”€ layout.tsx          # Root layout (required)
â”œâ”€â”€ page.tsx            # Home page (/)
â”œâ”€â”€ loading.tsx         # Loading UI
â”œâ”€â”€ error.tsx           # Error UI
â”œâ”€â”€ not-found.tsx       # 404 UI
â”œâ”€â”€ global-error.tsx    # Global error UI
â”œâ”€â”€ route.ts            # API endpoint
â”œâ”€â”€ template.tsx        # Re-rendered layout
â”œâ”€â”€ default.tsx         # Parallel route fallback
â”œâ”€â”€ blog/
â”‚   â”œâ”€â”€ page.tsx        # /blog
â”‚   â””â”€â”€ [slug]/
â”‚       â””â”€â”€ page.tsx    # /blog/:slug
â””â”€â”€ (group)/            # Route group (no URL impact)
    â””â”€â”€ page.tsx
```

## Special Files

| File | Purpose |
|------|---------|
| `page.tsx` | UI for a route segment |
| `layout.tsx` | Shared UI for segment and children |
| `loading.tsx` | Loading UI (Suspense boundary) |
| `error.tsx` | Error UI (Error boundary) |
| `not-found.tsx` | 404 UI |
| `route.ts` | API endpoint |
| `template.tsx` | Like layout but re-renders on navigation |
| `default.tsx` | Fallback for parallel routes |

## Route Segments

```
app/
â”œâ”€â”€ blog/               # Static segment: /blog
â”œâ”€â”€ [slug]/             # Dynamic segment: /:slug
â”œâ”€â”€ [...slug]/          # Catch-all: /a/b/c
â”œâ”€â”€ [[...slug]]/        # Optional catch-all: / or /a/b/c
â””â”€â”€ (marketing)/        # Route group (ignored in URL)
```

## Parallel Routes

```
app/
â”œâ”€â”€ @analytics/
â”‚   â””â”€â”€ page.tsx
â”œâ”€â”€ @sidebar/
â”‚   â””â”€â”€ page.tsx
â””â”€â”€ layout.tsx          # Receives { analytics, sidebar } as props
```

## Intercepting Routes

```
app/
â”œâ”€â”€ feed/
â”‚   â””â”€â”€ page.tsx
â”œâ”€â”€ @modal/
â”‚   â””â”€â”€ (.)photo/[id]/  # Intercepts /photo/[id] from /feed
â”‚       â””â”€â”€ page.tsx
â””â”€â”€ photo/[id]/
    â””â”€â”€ page.tsx
```

Conventions:
- `(.)` - same level
- `(..)` - one level up
- `(..)(..)` - two levels up
- `(...)` - from root

## Private Folders

```
app/
â”œâ”€â”€ _components/        # Private folder (not a route)
â”‚   â””â”€â”€ Button.tsx
â””â”€â”€ page.tsx
```

Prefix with `_` to exclude from routing.

## Middleware / Proxy

### Next.js 14-15: `middleware.ts`

```ts
// middleware.ts (root of project)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Auth, redirects, rewrites, etc.
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
```

### Next.js 16+: `proxy.ts`

Renamed for clarity - same capabilities, different names:

```ts
// proxy.ts (root of project)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // Same logic as middleware
  return NextResponse.next();
}

export const proxyConfig = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
```

| Version | File | Export | Config |
|---------|------|--------|--------|
| v14-15 | `middleware.ts` | `middleware()` | `config` |
| v16+ | `proxy.ts` | `proxy()` | `proxyConfig` |

**Migration**: Run `npx @next/codemod@latest upgrade` to auto-rename.

## File Conventions Reference

Reference: https://nextjs.org/docs/app/api-reference/file-conventions
