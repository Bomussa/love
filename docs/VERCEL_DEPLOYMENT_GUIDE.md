# Vercel Deployment Quick Start

This document provides step-by-step instructions for deploying the MMC-MMS system to Vercel.

## Prerequisites

- GitHub account (connected to this repository)
- Vercel account (sign up at https://vercel.com)

## Step 1: Connect Repository to Vercel

1. Go to https://vercel.com/dashboard
2. Click "Add New..." → "Project"
3. Import your GitHub repository: `Bomussa/love`
4. Select the repository and click "Import"

## Step 2: Configure Build Settings

Vercel should auto-detect these settings from `vercel.json`:
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

If not, set them manually.

## Step 3: Set Up Vercel KV (Storage)

### Option A: Create New Vercel KV (Recommended)

1. In your Vercel project, go to **Storage** tab
2. Click **Create Database**
3. Select **KV** (Key-Value Store)
4. Choose a name (e.g., `mmc-mms-kv`)
5. Select region closest to your users
6. Click **Create**
7. Vercel automatically links it to your project

### Option B: Use Existing Upstash Redis

1. Go to https://upstash.com and create a Redis database
2. Copy the REST API credentials
3. In Vercel project settings, add environment variables:
   ```
   KV_REST_API_URL=https://your-db.upstash.io
   KV_REST_API_TOKEN=your-token
   ```

### Option C: No KV (Development Only)

- Skip KV setup
- System will use in-memory storage (data not persistent)
- Only for testing/development

## Step 4: Configure Environment Variables

In Vercel project **Settings** → **Environment Variables**, add:

### Required for Production
```bash
FRONTEND_ORIGIN=https://your-domain.vercel.app
```

### Optional
```bash
# Only if using external Upstash (Option B above)
KV_REST_API_URL=https://your-db.upstash.io
KV_REST_API_TOKEN=your-token
```

## Step 5: Deploy

### Automatic Deployment (Recommended)
```bash
git push origin main
```
Vercel automatically deploys on every push.

### Manual Deployment
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to production
vercel --prod
```

## Step 6: Verify Deployment

After deployment completes:

1. **Open your deployment URL** (e.g., `https://your-app.vercel.app`)
2. **Test API endpoints**:
   ```bash
   curl https://your-app.vercel.app/api/v1/status
   ```
3. **Test frontend**: Navigate to the URL in browser
4. **Run health check**:
   ```bash
   DEPLOY_URL=https://your-app.vercel.app npm run health:check
   ```

## Expected Results

✅ Frontend loads at `https://your-app.vercel.app`
✅ API responds at `https://your-app.vercel.app/api/v1/status`
✅ All endpoints return JSON with CORS headers
✅ Frontend can call backend APIs

## Troubleshooting

### "Cannot connect to backend"
- **Check**: Environment variable `FRONTEND_ORIGIN` matches your domain
- **Check**: API endpoints respond at `/api/v1/*`
- **Fix**: Redeploy after setting environment variables

### "Using in-memory storage" warning in logs
- **Cause**: Vercel KV not configured
- **Impact**: Data will not persist
- **Fix**: Set up Vercel KV (Step 3)

### CORS errors
- **Check**: `FRONTEND_ORIGIN` is set correctly
- **Check**: No trailing slash in URL
- **Fix**: Update environment variable and redeploy

### 404 on API routes
- **Check**: Files exist in `api/v1/[...path].ts`
- **Check**: File has `export const config = { runtime: 'edge' }`
- **Fix**: Ensure all API files are committed and pushed

### Build fails
- **Check**: Run `npm run build` locally to reproduce
- **Check**: All dependencies in `package.json`
- **Fix**: Install missing dependencies with `npm install`

## Performance Optimization

### Cold Starts
Edge Functions have <100ms cold starts by default.

### Caching
Static assets (dist/) are cached on Vercel CDN automatically.

### Region Selection
Vercel KV: Choose region closest to your users:
- Qatar/UAE: Europe (Frankfurt or London)
- Global: US East (Virginia)

## Custom Domain (Optional)

1. Go to **Project Settings** → **Domains**
2. Add your custom domain: `www.mmc-mms.com`
3. Configure DNS records as instructed
4. Update `FRONTEND_ORIGIN` to match new domain

## Monitoring

### Vercel Dashboard
- View deployments: https://vercel.com/dashboard
- Check logs: Click deployment → "Logs" tab
- Monitor performance: "Analytics" tab

### API Health Check
Schedule automated checks:
```bash
# Run every 5 minutes
*/5 * * * * curl https://your-app.vercel.app/api/v1/status
```

## Rollback (If Needed)

1. Go to **Deployments** in Vercel dashboard
2. Find the last working deployment
3. Click **⋯** → **Promote to Production**

## Support

- **Vercel Documentation**: https://vercel.com/docs
- **Upstash Documentation**: https://upstash.com/docs/redis
- **Migration Guide**: `docs/VERCEL_BACKEND_MIGRATION.md`
- **API Documentation**: `api/README.md`

## Post-Deployment Checklist

- [ ] Deployment successful
- [ ] Frontend loads
- [ ] API endpoints respond
- [ ] Health check passes
- [ ] KV storage configured (if needed)
- [ ] Environment variables set
- [ ] Custom domain configured (optional)
- [ ] Monitoring set up
- [ ] Team has access to Vercel project

## Next Steps

1. **Test all features** in production
2. **Monitor logs** for errors
3. **Check KV usage** in Upstash dashboard
4. **Configure alerts** for downtime
5. **Set up backup strategy** for critical data

## Cost Estimate

### Vercel (with Hobby/Pro plan)
- **Hobby**: Free for personal projects
  - 100 GB bandwidth/month
  - Unlimited deployments
  - 6,000 build minutes/month

- **Pro**: $20/month per member
  - 1 TB bandwidth/month
  - Unlimited deployments
  - 24,000 build minutes/month

### Vercel KV (Upstash)
- **Free Tier**: 
  - 10,000 commands/day
  - 256 MB storage
  - Perfect for development/testing

- **Pay-as-you-go**: $0.2 per 100K commands
  - Based on actual usage
  - No minimum commitment

### Estimated Total
- **Development**: $0/month (free tiers)
- **Production (small)**: $20/month (Vercel Pro)
- **Production (large)**: $20-50/month (Vercel Pro + KV usage)

---

**You're ready to deploy!** 🚀

For detailed technical information, see `docs/VERCEL_BACKEND_MIGRATION.md`.
