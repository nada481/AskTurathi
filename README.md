# AskTurathi

Interactive heritage characters for children's museum experiences.

## Local development

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy on Vercel

The Next.js app lives in the `web/` folder.

1. Import the GitHub repo in Vercel.
2. Set **Root Directory** to `web` (Project Settings → General).
3. Redeploy.

A root `vercel.json` is included with `"rootDirectory": "web"` so new deployments should pick this up automatically after you push.

If you still see `404: NOT_FOUND`, open the latest deployment in Vercel and confirm:

- Root Directory is `web`
- Build command is `next build` (default)
- The build logs show routes like `/` and `/kahoola`
