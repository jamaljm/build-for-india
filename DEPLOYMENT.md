# 🚀 Deployment Documentation

## ✅ Live URL

**https://hackathon.lethimbuild.com**

---

## 📦 Deployment Details

### **Infrastructure:**
- **Server**: 194.164.148.11 (srv1375532)
- **Port**: 3457 (internal)
- **Domain**: hackathon.lethimbuild.com
- **SSL**: Auto-provisioned via Caddy + Let's Encrypt
- **Reverse Proxy**: Caddy v2
- **Service**: systemd (hackathon.service)

### **Application:**
- **Framework**: Next.js 15.1.4
- **Runtime**: Node.js v22.22.0
- **Build**: Production optimized
- **Environment**: Production (.env.local)

---

## 🔧 Service Management

### **Status:**
```bash
systemctl status hackathon
```

### **Logs:**
```bash
journalctl -u hackathon -f
```

### **Restart:**
```bash
systemctl restart hackathon
```

### **Stop:**
```bash
systemctl stop hackathon
```

### **Start:**
```bash
systemctl start hackathon
```

---

## 🔑 Environment Variables

**Location:** `/root/.openclaw/workspace/agentic-hackathon/.env.local`

**Current Status:**
```env
OPENAI_API_KEY=PLACEHOLDER_NEED_KEY_FROM_JAMAL  ← ⚠️ NEEDS UPDATING
OPENAI_MODEL=gpt-4o-realtime-preview-2024-12-17
```

### **⚠️ ACTION REQUIRED:**

The site is **live but non-functional** until you add the OpenAI API key.

**To fix:**
1. Get your OpenAI API key (must support Realtime API)
2. Edit `/root/.openclaw/workspace/agentic-hackathon/.env.local`
3. Replace `PLACEHOLDER_NEED_KEY_FROM_JAMAL` with actual key
4. Run: `systemctl restart hackathon`

**Example:**
```bash
cd /root/.openclaw/workspace/agentic-hackathon
nano .env.local  # Update OPENAI_API_KEY
systemctl restart hackathon
```

---

## 🌐 Caddy Configuration

**File:** `/etc/caddy/Caddyfile`

```caddy
hackathon.lethimbuild.com {
    reverse_proxy localhost:3457
}
```

**Reload Caddy after changes:**
```bash
systemctl reload caddy
```

---

## 📁 Project Location

**Directory:** `/root/.openclaw/workspace/agentic-hackathon/`

**Git Repository:** https://github.com/jamaljm/build-for-india.git

---

## 🔄 Deployment Workflow

### **Update Code:**
```bash
cd /root/.openclaw/workspace/agentic-hackathon
git pull origin main
npm install  # If dependencies changed
npm run build
systemctl restart hackathon
```

### **Quick Restart (no code changes):**
```bash
systemctl restart hackathon
```

---

## 📊 Performance

**Build Stats:**
- Route `/`: 19.2 kB (125 kB First Load JS)
- API routes: Dynamic server-rendered
- Static optimization: Enabled
- Ready time: ~300ms

---

## 🐛 Troubleshooting

### **Site won't load:**
```bash
# Check service status
systemctl status hackathon

# Check logs
journalctl -u hackathon -n 50

# Check if port is listening
ss -tulpn | grep 3457

# Check Caddy
systemctl status caddy
```

### **SSL issues:**
```bash
# Check Caddy logs
journalctl -u caddy -n 50

# Force SSL renewal
caddy reload --config /etc/caddy/Caddyfile
```

### **Environment variables not working:**
```bash
# Verify .env.local exists
ls -la /root/.openclaw/workspace/agentic-hackathon/.env.local

# Check service picks it up
systemctl cat hackathon | grep Environment
```

---

## 📝 Recent Changes

### **2026-02-27:**
- ✅ Initial deployment
- ✅ Systemd service created
- ✅ Caddy reverse proxy configured
- ✅ SSL certificate provisioned
- ✅ Build fixes (Suspense boundary, unused vars)
- ⚠️ Waiting for OpenAI API key

---

## 🔐 Security Notes

- No basic auth configured (public access)
- OpenAI API key stored in .env.local (gitignored)
- HTTPS enabled (Let's Encrypt)
- Runs as root user (consider changing for production)

---

## 📞 Support

**Issues?**
- Check service logs: `journalctl -u hackathon -f`
- Restart service: `systemctl restart hackathon`
- Rebuild: `cd /root/.openclaw/workspace/agentic-hackathon && npm run build && systemctl restart hackathon`

---

**Last Updated:** 2026-02-27 17:29 UTC
**Status:** 🟡 Live but needs OpenAI API key
