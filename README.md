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

The Next.js app lives in the `web/` folder, not the repo root.

1. Open your Vercel project → **Settings** → **Build and Deployment**
2. Set **Root Directory** to `web`
3. Click **Save**
4. Redeploy (Deployments → … → Redeploy)

Do not add `rootDirectory` to `vercel.json` — Vercel rejects it. The Root Directory must be set in the dashboard.

After a successful deploy, build logs should list routes like `/` and `/kahoola`.
