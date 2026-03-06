#!/bin/bash
# Comprehensive Analysis Script for MMC-MMS Project
# فحص شامل للمشروع بالكامل

echo "🔍 بدء الفحص الشامل للمشروع..."
echo "================================"

# 1. فحص جميع المكونات في AdminDashboard
echo ""
echo "📊 1. فحص مكونات AdminDashboard..."
grep -n "^const.*Management.*= ({" /app/love-frontend/frontend/src/components/AdminDashboardV2.jsx | head -30

# 2. فحص جميع استخدامات supabase.from
echo ""
echo "📊 2. فحص جميع استخدامات Supabase tables..."
grep -o "\.from('[^']*')" /app/love-frontend/frontend/src/components/AdminDashboardV2.jsx | sort | uniq -c | sort -rn

# 3. البحث عن استخدامات الأعمدة القديمة
echo ""
echo "🔴 3. البحث عن استخدامات الأعمدة الخاطئة..."
echo "clinic_code occurrences:"
grep -n "clinic_code" /app/love-frontend/frontend/src/components/AdminDashboardV2.jsx | wc -l
echo "is_active occurrences (في سياق pins):"
grep -n "is_active.*pin\|pin.*is_active" /app/love-frontend/frontend/src/components/AdminDashboardV2.jsx | wc -l
echo "generated_at occurrences:"
grep -n "generated_at" /app/love-frontend/frontend/src/components/AdminDashboardV2.jsx | wc -l
echo "expires_at occurrences (في سياق pins):"
grep -n "expires_at.*pin\|pin.*expires_at" /app/love-frontend/frontend/src/components/AdminDashboardV2.jsx | wc -l

# 4. فحص الدوال المكررة
echo ""
echo "📊 4. البحث عن دوال مكررة..."
grep -o "const [a-zA-Z_]* = async" /app/love-frontend/frontend/src/components/AdminDashboardV2.jsx | sort | uniq -c | sort -rn | head -20

# 5. فحص endpoints في Backend
echo ""
echo "📊 5. فحص Backend API endpoints..."
grep -n "app\.\(get\|post\|put\|delete\)" /app/love-backend/api/v1.js | head -20

echo ""
echo "✅ اكتمل الفحص الأولي!"
