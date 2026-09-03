# Catalytic Private Test — Enterprise AI Workspace

A clean, modern, single-page AI productivity workspace. Draft emails, summarize meetings, and plan your day — all powered by AI.

![Screenshot](https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/623296fe-dcf3-40a9-ad19-532f505c5fdc)

## Features

- **Smart Email Generator** — Pick your audience (client, manager, team) and tone (formal, informal, persuasive), list your key points, and get a polished email draft instantly.
- **Meeting Summarizer** — Paste raw meeting notes and get a structured summary with key points, decisions, action items, and important dates.
- **AI Task Planner** — List your tasks and optional time constraints. The AI prioritizes them using Eisenhower logic and generates a time-blocked schedule with optimization tips.

## Tech Stack

- **Framework:** [TanStack Start](https://tanstack.com/start) (React 19 + Vite + SSR/SSG)
- **Styling:** Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com) components
- **State:** TanStack Query + client-side state (no external database)
- **AI:** Google Gemini via [Lovable AI Gateway](https://docs.lovable.dev/features/ai-gateway) (`google/gemini-3-flash-preview`)
- **Icons:** Lucide React

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (recommended) or Node.js 20+

### Install & Run

```bash
# Install dependencies
bun install

# Start the dev server
bun run dev
```

The dev server starts at `http://localhost:8080` by default.

### Build for Production

```bash
bun run build
```

## Project Structure

```
src/
  routes/                 # File-based routing (TanStack Start)
    __root.tsx            # Root layout with sidebar, providers, SEO meta
    index.tsx             # Dashboard landing page
    email.tsx             # Smart Email Generator
    summarize.tsx         # Meeting Summarizer
    plan.tsx              # AI Task Planner
  components/
    app-sidebar.tsx       # Collapsible navigation sidebar
    output-card.tsx         # Shared output panel with copy, loading, error states
    ai-disclaimer.tsx       # AI usage disclaimer & footer
    ui/                     # shadcn/ui primitives (Button, Card, Textarea, Select, etc.)
  lib/
    ai.functions.ts         # Centralized AI server function (createServerFn)
  styles.css               # Global styles, Tailwind theme, Inter font
```

## AI Configuration

This app uses the **Lovable AI Gateway**. No manual API key setup is required — the `LOVABLE_API_KEY` is auto-provisioned when running inside Lovable.

If you want to use your own Google Gemini API key instead:

1. Add `GEMINI_API_KEY` to your environment variables.
2. Update `src/lib/ai.functions.ts` to call the Google Generative AI SDK directly instead of the Lovable Gateway.

## Deployment

This project is built and deployed via [Lovable](https://lovable.dev). Connect your GitHub repository in Lovable and publish with one click.

Live preview: [https://aura-pilot-app.lovable.app](https://aura-pilot-app.lovable.app)

## Scripts

| Command            | Description                          |
|--------------------|--------------------------------------|
| `bun run dev`      | Start the Vite dev server            |
| `bun run build`    | Build for production                 |
| `bun run build:dev`| Build for development                |
| `bun run preview`  | Preview the production build locally |
| `bun run lint`     | Run ESLint                           |
| `bun run format`   | Format code with Prettier            |

## License

MIT

## Docker and Cisco Secure Access ZTA

Cisco Secure Access normally gives the private application its own public hostname
and preserves request paths. For that recommended setup, publish the container at
the domain root and **do not** add a build argument. Use a unique image tag for each
release so the running container cannot be mistaken for an older build:

```bash
docker build --pull --no-cache -t catalytic-private-test:2026-08-27 .
docker stop catalytic-private-test 2>/dev/null || true
docker rm catalytic-private-test 2>/dev/null || true
docker run -d \
  --name catalytic-private-test \
  --restart unless-stopped \
  -p 3000:3000 \
  -e LOVABLE_API_KEY=your_key_here \
  catalytic-private-test:2026-08-27
```

Configure the ZTA private resource to target the VM's internal hostname/IP on port
`3000`. The public URL should open `/`, and the tunnel must preserve and forward
`/assets/*` and `/_serverFn/*` unchanged. Do not cache HTML at the tunnel: documents
are explicitly returned with `Cache-Control: no-store`, while hashed assets remain
safe to cache as immutable files.

Only use a prefix when the browser's public URL literally includes it, such as
`https://apps.example.com/catalytic/`. The same prefix must be supplied at build
and runtime:

```bash
docker build --pull \
  --build-arg APP_BASE_PATH=/catalytic/ \
  -t catalytic-private-test:latest .

docker run -d \
  --name catalytic-private-test \
  --restart unless-stopped \
  -p 3000:3000 \
  -e APP_BASE_PATH=/catalytic/ \
  -e NITRO_APP_BASE_URL=/catalytic/ \
  -e LOVABLE_API_KEY=your_key_here \
  catalytic-private-test:latest
```

Do not use the prefixed build for a dedicated ZTA hostname whose public URL starts
at `/`; doing so makes the HTML and asset routes disagree.

### Verify every generated asset

The container health check now loads the live HTML and verifies every local script
and stylesheet referenced by it. After starting the container, wait for it to become
healthy and run the same diagnostic manually:

```bash
docker ps
docker logs catalytic-private-test
docker exec catalytic-private-test \
  node scripts/verify-assets.mjs http://127.0.0.1:3000/ --compare-identity
```

Then run the diagnostic from a machine that reaches the site through Cisco, replacing
the example with the actual Cisco-published HTTPS URL:

```bash
bun run verify:assets -- https://your-cisco-app.example.com/ --compare-identity
```

The report includes status, elapsed time, redirects, MIME type, response size,
content encoding, and cache headers for each referenced asset. Interpret it as follows:

- **Local and Cisco checks pass:** the deployment is ready.
- **Local passes, Cisco times out:** the container is healthy; check the ZTA private
  resource/connector and bypass response caching or content rewriting for HTML and
  JavaScript.
- **Normal requests time out but `IDENTITY` succeeds:** disable compression/content
  transformation for this private application in Cisco.
- **Local returns 404:** rebuild without a path prefix and recreate the container;
  the HTML and asset set inside the running image do not match.

The browser-visible Cisco URL determines the base path. A direct origin such as
`http://<public-ip>:3000/` is a root deployment, so use the default build with no
`APP_BASE_PATH` argument.

### Response compression (fixes "pending forever" JS requests)

Uncompressed bundles are the most common cause of a JavaScript request that stays
pending behind an inspecting proxy: the tunnel buffers and scans the full body
before releasing a single byte. The build now ships precompressed `.gz`/`.br`
copies of every static asset (`nitro.config.ts` → `compressPublicAssets`), and the
SSR HTML is gzipped on the fly in `src/server.ts`. The main bundle drops from
~465 KB to ~124 KB brotli / ~144 KB gzip.

Identity responses are still served correctly when a client sends
`Accept-Encoding: identity`, so `--compare-identity` remains a valid A/B test.

### After every rebuild, force a fresh HTML load

Asset filenames are content-hashed, so an old cached `index.html` points at chunk
names that no longer exist in the new image. HTML is now served with
`Cache-Control: no-store`, but a browser or tunnel that cached the previous HTML
must be flushed once: hard-reload (Ctrl+Shift+R) or clear the Cisco cache for the
application after recreating the container.

