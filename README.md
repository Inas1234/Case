This is a Next.js 16 application for managing investigation boards with Supabase persistence.

## Getting Started

1. Create your environment file from the template:

```bash
cp .env.example .env.local
```

2. Set required values in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `DB_PASSWORD`
- `OPENROUTER_API_KEY`

Optional OpenRouter settings:
- `OPENROUTER_MODEL` (defaults to `openai/gpt-4o-mini`)
- `OPENROUTER_FALLBACK_MODEL` (optional second model if primary fails/returns empty)
- `OPENROUTER_SITE_URL` and `OPENROUTER_SITE_NAME` (for OpenRouter app attribution)

3. Run the app:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## AI Agent Route

Board AI actions call:

- `POST /api/ai/board-action`

This route runs server-side, sends board context to OpenRouter, and returns structured board operations (new cards, card tag/type updates, summary updates, and status suggestions) aligned to the five board actions.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
