# 🚀 VERCEL DEPLOYMENT GUIDE - Notification System

## 📋 Pre-Deployment Checklist

### ✅ Required Files (Already Created)
- [x] `vercel.json` - Cron job configuration
- [x] `app/api/notifications/cron/route.ts` - Cron endpoint
- [x] `.env.production` - Production environment variables
- [x] All notification system components implemented

## 🔧 Step-by-Step Vercel Setup

### Step 1: Deploy to Vercel
```bash
# Install Vercel CLI if not already installed
npm install -g vercel

# Login to Vercel
vercel login

# Link your project (if not already linked)
vercel link

# Deploy to production
vercel --prod
```

### Step 2: Configure Environment Variables in Vercel Dashboard

Go to [Vercel Dashboard](https://vercel.com/dashboard) → Your Project → **Settings** → **Environment Variables**

Add ALL these variables for **Production, Preview, and Development**:

#### 🗄️ Supabase Configuration
| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xsovqvbigdettnpeisjs.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhzb3ZxdmJpZ2RldHRucGVpc2pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwNzUzODIsImV4cCI6MjA2NTY1MTM4Mn0.QY4L0oKNEjJE5dv7dok2zz4TouiehxqibbfBGnmjLO8` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhzb3ZxdmJpZ2RldHRucGVpc2pzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDA3NTM4MiwiZXhwIjoyMDY1NjUxMzgyfQ.fQwRgeoLFCGqw9A-eL3uXOGJhtT6kK0gskUj4BRYna4` |

#### 🔔 Push Notification Configuration
| Name | Value |
|------|-------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `BHj-i8zkoLKbBrtik7xSjAuLbUES_TK5DzBpIjjIGKapmE_6FDXwP9B99OscznBvb_pUSom3HFfVvof_2DjVcSc` |
| `VAPID_PRIVATE_KEY` | `WAf-gAafwykS3KQ4C5ivfveTdmcq7wVqPfY7O5ypfSo` |
| `VAPID_EMAIL` | `mailto:asif@notqwerty.com` |

#### 🕐 Cron Job Security
| Name | Value |
|------|-------|
| `CRON_SECRET` | `rbs-restaurant-cron-2025-secure-key-x7n9m4p8q2L` |

#### 🗺️ External APIs
| Name | Value |
|------|-------|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | `AIzaSyCDuRjdx7YfYc0Y46fcEisE6YbY0zVY7jk` |

#### 🌐 App Configuration
| Name | Value |
|------|-------|
| `NEXT_PUBLIC_APP_URL` | `https://rbs-restaurant.vercel.app` |

#### ⚡ Redis Configuration (Upstash)
| Name | Value |
|------|-------|
| `REDIS_HOST` | `precious-collie-22493.upstash.io` |
| `REDIS_PORT` | `6379` |
| `REDIS_PASSWORD` | `AVfdAAIjcDFhNWRiNTgzZWMxODQ0MWQ0OWQwZmQ4ZjUyMjgyNDMzMnAxMA` |
| `REDIS_DB` | `0` |
| `UPSTASH_REDIS_REST_URL` | `https://precious-collie-22493.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | `AVfdAAIjcDFhNWRiNTgzZWMxODQ0MWQ0OWQwZmQ4ZjUyMjgyNDMzMnAxMA` |

#### ⚙️ Performance & Cache Settings
| Name | Value |
|------|-------|
| `CACHE_TTL_MENU_ITEMS` | `3600` |
| `CACHE_TTL_RESTAURANT_SETTINGS` | `1800` |
| `CACHE_TTL_KITCHEN_ORDERS` | `30` |
| `CACHE_TTL_TABLE_STATUS` | `60` |
| `CACHE_TTL_ANALYTICS` | `900` |
| `DB_QUERY_TIMEOUT` | `10000` |
| `DB_MAX_CONNECTIONS` | `15` |
| `REALTIME_EVENTS_PER_SECOND` | `10` |
| `KITCHEN_DISPLAY_REFRESH_INTERVAL` | `30000` |
| `ENABLE_PERFORMANCE_MONITORING` | `true` |
| `LOG_LEVEL` | `info` |
| `LOG_REDIS_ERRORS` | `false` |
| `TABLET_MAX_CONCURRENT_REQUESTS` | `5` |
| `TABLET_CACHE_SIZE_LIMIT` | `50MB` |

### Step 3: Verify Deployment

#### A. Check the Application
1. Visit your deployed app: `https://rbs-restaurant.vercel.app`
2. Test login functionality
3. Check notification permissions work

#### B. Verify Cron Job Setup
1. Go to Vercel Dashboard → Your Project → **Functions**
2. Look for `/api/notifications/cron` in the functions list
3. Check **Cron Jobs** section shows the scheduled job

#### C. Test Notification API
```bash
# Test the status endpoint
curl https://rbs-restaurant.vercel.app/api/notifications/status

# Test cron job manually (optional)
curl -X POST https://rbs-restaurant.vercel.app/api/notifications/cron \
  -H "Authorization: Bearer rbs-restaurant-cron-2025-secure-key-x7n9m4p8q2L" \
  -H "Content-Type: application/json"
```

## 🔍 Post-Deployment Verification

### Test Notification System in Production
1. **Login to your app**: `https://rbs-restaurant.vercel.app`
2. **Grant notification permission** when prompted
3. **Create a test booking** to trigger notifications
4. **Check browser notifications** appear correctly

### Monitor Cron Job Execution
- **First Run**: Wait for next 6-hour interval (00:00, 06:00, 12:00, 18:00)
- **Check Logs**: Vercel Dashboard → Functions → `/api/notifications/cron` → Invocations
- **Expected Output**: Successful cleanup logs with database statistics

## 🚨 Troubleshooting Common Issues

### Issue 1: "Service Worker Not Registered"
**Solution**: Clear browser cache and reload the page

### Issue 2: "Push Notifications Not Working"
**Check**: 
- VAPID keys are correctly set in environment variables
- Browser has notification permission granted
- Service worker is registered successfully

### Issue 3: "Cron Job Not Running"
**Check**:
- `CRON_SECRET` environment variable is set
- Vercel plan supports cron jobs (Pro plan required)
- `vercel.json` is correctly configured

### Issue 4: "Database Connection Failed"
**Check**:
- Supabase service role key has correct permissions
- All Supabase environment variables are set
- Supabase project is active and accessible

## 🎯 Production Readiness Checklist

- [ ] All environment variables added to Vercel
- [ ] Application deployed and accessible
- [ ] Login/authentication working
- [ ] Push notifications permission granted
- [ ] Service worker registered successfully
- [ ] Cron job visible in Vercel Functions
- [ ] API endpoints responding correctly
- [ ] Database connections working
- [ ] Test booking triggers notifications

## 🔄 Updating the System

### For Code Changes
```bash
# Make your changes
git add .
git commit -m "Update notification system"
git push origin main

# Vercel will automatically deploy
```

### For Environment Variable Changes
1. Update in Vercel Dashboard → Settings → Environment Variables
2. Redeploy: `vercel --prod` or wait for next git push

## 📊 Monitoring & Maintenance

### Regular Checks
- **Weekly**: Check cron job execution logs
- **Monthly**: Review notification delivery rates
- **Quarterly**: Update VAPID keys if needed

### Performance Monitoring
- Monitor function execution times in Vercel dashboard
- Check Supabase database performance
- Review Redis cache hit rates

---

## ✅ **YOUR NOTIFICATION SYSTEM IS NOW PRODUCTION READY!** 🎉

After following these steps, your comprehensive notification system will be fully operational in production with:
- ✅ Real-time push notifications
- ✅ Automatic database maintenance 
- ✅ PWA functionality
- ✅ Multi-tenant security
- ✅ High-performance caching
- ✅ Comprehensive monitoring