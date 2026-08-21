# Lumen — AI Productivity Dashboard

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
the domain root and **do not** add a build argument:

```bash
docker build --pull -t catalytic-private-test:latest .
docker run -d \
  --name catalytic-private-test \
  --restart unless-stopped \
  -p 3000:3000 \
  -e LOVABLE_API_KEY=your_key_here \
  catalytic-private-test:latest
```

Configure the ZTA private resource to target the VM's internal hostname/IP on port
`3000`. The public URL should open `/`, and the tunnel must preserve and forward
`/assets/*` and `/_serverFn/*` unchanged.

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
at `/`; doing so makes the HTML and asset routes disagree. Check the deployment
with `docker ps` (health should become `healthy`), `docker logs catalytic-private-test`,
and `curl -I http://127.0.0.1:3000/` on the VM before testing through ZTA.
