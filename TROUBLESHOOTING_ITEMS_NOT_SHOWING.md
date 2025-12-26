# Troubleshooting: Items Not Showing

## Issue
After logging in, the items page shows empty even though data exists in the database.

## Root Cause Analysis

✅ **Data Verified**: 5 items exist in database for your tenant
✅ **User Configuration**: tenant_id correctly set in auth metadata
✅ **Environment**: API and frontend correctly configured

⚠️ **Most Likely Issue**: Services need to be restarted to pick up the updated auth metadata

## Solution Steps

### Step 1: Stop All Running Services

Press `Ctrl+C` in all terminal windows running:
- API server (port 3100)
- Web frontend (port 3005)

### Step 2: Clear Browser Cache

1. Open your browser Developer Tools (F12)
2. Go to "Application" or "Storage" tab
3. Click "Clear site data" or "Clear storage"
4. **OR** Simply do a hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)

### Step 3: Restart API Server

```bash
cd C:\mnt\c\ClaudeWorkspace\ErpSystem2025-AI
cd apps/api
pnpm run dev
```

Wait for the message: `Server running on http://localhost:3100`

### Step 4: Restart Web Frontend

In a new terminal:

```bash
cd C:\mnt\c\ClaudeWorkspace\ErpSystem2025-AI
cd apps/web
pnpm run dev
```

Wait for: `ready - started server on 0.0.0.0:3005`

### Step 5: Clear Browser and Re-login

1. Open your browser to `http://localhost:3005`
2. If you're still logged in, **log out completely**
3. **Close the browser tab**
4. **Open a new tab** to `http://localhost:3005`
5. Log in with:
   - Email: `hosamsharif1990@gmail.com`
   - Password: `Hossam1990@`

### Step 6: Verify Items Load

1. Navigate to the Items page (الأصناف)
2. You should now see 5 items:
   - Anker USB-C Hub 7-in-1
   - Dell Laptop XPS 15
   - iPhone 15 Pro
   - Keychron K8 Pro
   - Logitech MX Master 3

## Still Not Working?

### Check API Server is Running

1. Open `http://localhost:3100/api/v1/health` in your browser
2. You should see: `{"status":"ok"}`
3. If not, the API server isn't running

### Check Browser Console

1. Press F12 to open Developer Tools
2. Go to "Console" tab
3. Look for any red error messages
4. Go to "Network" tab
5. Refresh the page
6. Look for a request to `/items`
7. Check if it returns 200 (success) or an error

Common errors:
- **401 Unauthorized**: Token issue - log out and log back in
- **403 Forbidden**: Permissions issue - check user role
- **404 Not Found**: API server not running
- **Network Error**: API server not accessible

### Manual API Test

You can test the API directly using curl:

```bash
# First, get your access token from browser:
# 1. Open Developer Tools (F12)
# 2. Go to Application > Local Storage
# 3. Look for supabase.auth.token
# 4. Copy the access_token value

curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  http://localhost:3100/api/v1/items
```

Expected response:
```json
{
  "success": true,
  "data": [
    {"id": "...", "name": "Anker USB-C Hub 7-in-1", ...},
    {"id": "...", "name": "Dell Laptop XPS 15", ...},
    ...
  ],
  "meta": {
    "total": 5,
    ...
  }
}
```

## Database Verification

You can verify the data exists in Supabase:

1. Go to https://ahcwylvsjnsmbhtdeqws.supabase.co
2. Navigate to Table Editor
3. Select `items` table
4. Apply filter: `tenant_id` equals `53db0ef1-db13-4e7e-9158-a7201b30678d`
5. You should see 5 items

## Need More Help?

If items still don't show after following all steps:

1. Check that both services are running on the correct ports
2. Verify no firewall is blocking localhost connections
3. Try using a different browser (incognito mode)
4. Check the terminal output for any error messages
