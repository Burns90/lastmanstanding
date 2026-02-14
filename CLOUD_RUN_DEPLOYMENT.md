# Cloud Run Deployment Instructions

## Deploy to Google Cloud Run

Your Next.js app with Cloud Functions requires a Node.js runtime. Firebase Hosting is static-only, so we'll use **Cloud Run** instead.

### Prerequisites
- Google Cloud SDK installed: https://cloud.google.com/sdk/docs/install
- Authenticated: `gcloud auth login`

### Deploy Steps

1. **Set your project:**
```bash
gcloud config set project last-man-standing-6cc93
```

2. **Deploy to Cloud Run:**
```bash
gcloud run deploy last-man-standing \
  --source ./web \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

3. **Note the URL** - Cloud Run will provide a URL like:
```
https://last-man-standing-[hash].run.app
```

### What This Does
- Builds the Dockerfile
- Deploys Next.js app to Cloud Run
- Makes app publicly accessible
- Automatically handles HTTPS

### Cost
Cloud Run: **~$0.20-2/month** for typical small apps (free tier included)

### After Deployment
The app will be live at the Cloud Run URL and can connect to:
- Firestore (deployed)
- Cloud Functions (deployed)
- Firebase Auth (deployed)

---

**Alternative: Deploy to Vercel (Free)**
If you prefer, you can also deploy just the frontend to Vercel while keeping the backend on Firebase:
https://vercel.com/new

This project is already compatible with Vercel and would be a simpler setup.
