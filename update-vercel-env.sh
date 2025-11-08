#!/bin/bash

# Update Vercel Environment Variables
# This script updates the environment variables for the love project on Vercel

PROJECT_NAME="love"
SUPABASE_URL="https://rujwuruuosffcxazymit.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1and1cnV1b3NmZmN4YXp5bWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA5ODkxNzEsImV4cCI6MjA0NjU2NTE3MX0.Qxr5sBPFgDVvQCJCQrIiE8RiIzfEiE8RiIzfEiE8Ri"

echo "🔧 Updating Vercel environment variables..."

# Update SUPABASE_URL
vercel env rm SUPABASE_URL production --yes 2>/dev/null || true
echo "$SUPABASE_URL" | vercel env add SUPABASE_URL production

# Update SUPABASE_ANON_KEY
vercel env rm SUPABASE_ANON_KEY production --yes 2>/dev/null || true
echo "$SUPABASE_ANON_KEY" | vercel env add SUPABASE_ANON_KEY production

# Update VITE_SUPABASE_URL
vercel env rm VITE_SUPABASE_URL production --yes 2>/dev/null || true
echo "$SUPABASE_URL" | vercel env add VITE_SUPABASE_URL production

# Update VITE_SUPABASE_ANON_KEY
vercel env rm VITE_SUPABASE_ANON_KEY production --yes 2>/dev/null || true
echo "$SUPABASE_ANON_KEY" | vercel env add VITE_SUPABASE_ANON_KEY production

echo "✅ Environment variables updated successfully!"
echo "🚀 Triggering new deployment..."

# Trigger new deployment
vercel --prod

echo "✅ Deployment triggered!"
