# Cloudflare Pages Deployment Guide

## Overview
This repository is now configured to deploy the React frontend to Cloudflare Pages.

## Configuration
The deployment is configured in `wrangler.toml`:
- **Project Name**: `2027`
- **Build Output Directory**: `dist`

## Build Command
```bash
npm run build
```

This command uses Vite to build the React application and outputs to the `dist` directory.

## Deployment Options

### Option 1: Cloudflare Dashboard (Recommended for first-time setup)
1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Go to **Workers & Pages** > **Create application** > **Pages**
3. Connect your GitHub repository: `Bomussa/2027`
4. Configure the build settings:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/`
   - **Environment variables**: None required for frontend
5. Click **Save and Deploy**

### Option 2: Wrangler CLI
```bash
# Install Wrangler (if not already installed)
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy to Cloudflare Pages
wrangler pages deploy dist --project-name=2027
```

### Option 3: Direct Deployment (after first setup)
If your project is already connected to Cloudflare Pages:
```bash
# Build the project
npm run build

# Deploy using wrangler
wrangler pages deploy dist
```

## Automatic Deployments
Once connected to GitHub, Cloudflare Pages will automatically:
- Deploy when changes are pushed to the main branch
- Create preview deployments for pull requests

## Verification
After deployment, your site will be available at:
- Production: `https://2027.pages.dev` (or your custom domain)
- Preview: `https://[branch].[project].pages.dev`

## Important Notes
- The simple HTML interface has been removed from `public/index.html`
- The React application is now the primary frontend
- All public assets (images, manifests, etc.) are copied from the `public/` directory during build
- The `wrangler.toml` configuration is already set up correctly

## Required Dependencies
All dependencies are included in `package.json`:
- React and React DOM
- Vite (build tool)
- Tailwind CSS
- Radix UI components
- Additional utilities (axios, qrcode, lucide-react, etc.)

## Build Process
The build process:
1. Vite processes the React application from `src/`
2. Compiles JSX/JS files
3. Bundles assets and styles
4. Copies public assets to `dist/`
5. Generates optimized production build in `dist/`
