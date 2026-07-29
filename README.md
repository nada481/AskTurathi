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

### Required settings

In **Settings → Build and Deployment**:

| Setting | Value |
|---------|--------|
| **Root Directory** | `web` |
| **Framework Preset** | `Next.js` |
| **Build Command** | leave default (`next build`) — override **OFF** |
| **Output Directory** | leave default — override **OFF** |
| **Install Command** | leave default — override **OFF** |

### Common 404 cause

If the build log shows routes like `/` and `/kahoola` but the live site returns `404: NOT_FOUND`, the framework is usually set to **Other** instead of **Next.js**. Vercel runs `next build` but then deploys the wrong output.

This repo includes `web/vercel.json` with `"framework": "nextjs"` so Vercel uses the Next.js runtime on each deploy.

After pushing, redeploy and open the **Visit** link on the latest **Ready** deployment (not an old preview URL).
