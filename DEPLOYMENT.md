# 🚀 Deployment Guide

This guide covers deploying LocalOps AI to various platforms.

## 📋 Prerequisites

- GitHub repository set up
- Supabase project configured
- Email service account (Resend/SendGrid)
- Domain name (optional, for custom domains)

## 🌐 Frontend Deployment (Vercel)

### Automatic Deployment
1. **Connect to Vercel:**
   ```bash
   npm i -g vercel
   cd frontend
   vercel --prod
   ```

2. **Configure Environment Variables in Vercel:**
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY` or `SENDGRID_API_KEY`
   - `FROM_EMAIL`

3. **Set Build Settings:**
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`
   - Root Directory: `frontend`

### Manual Deployment
1. **Build the project:**
   ```bash
   cd frontend
   npm run build
   npm run export  # For static export
   ```

2. **Deploy to any static hosting:**
   - Netlify
   - GitHub Pages
   - AWS S3 + CloudFront
   - Firebase Hosting

## 🐍 Backend Deployment

### Railway (Recommended)
1. **Connect to Railway:**
   ```bash
   npm i -g @railway/cli
   railway login
   railway init
   ```

2. **Configure Environment Variables:**
   ```bash
   railway variables set OPENAI_API_KEY=your_key
   railway variables set DATABASE_URL=your_supabase_url
   railway variables set WHATSAPP_ACCESS_TOKEN=your_token
   ```

3. **Deploy:**
   ```bash
   cd backend
   railway up
   ```

### Heroku
1. **Create Heroku app:**
   ```bash
   heroku create localops-ai-backend
   ```

2. **Set environment variables:**
   ```bash
   heroku config:set OPENAI_API_KEY=your_key
   heroku config:set DATABASE_URL=your_supabase_url
   ```

3. **Deploy:**
   ```bash
   git subtree push --prefix backend heroku main
   ```

### Docker Deployment
1. **Build and run:**
   ```bash
   docker-compose up --build -d
   ```

2. **For production:**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

## 🗄 Database Setup (Supabase)

### Production Configuration
1. **Enable Row Level Security:**
   ```sql
   -- Run in Supabase SQL Editor
   ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
   -- ... for all tables
   ```

2. **Create RLS Policies:**
   ```sql
   -- Example policy for businesses table
   CREATE POLICY "Users can view own business" ON public.businesses
     FOR SELECT USING (auth.uid() IN (
       SELECT user_id FROM public.staff WHERE business_id = businesses.id
     ));
   ```

3. **Set up database backups:**
   - Enable automatic backups in Supabase dashboard
   - Set up point-in-time recovery

### Environment Variables
```bash
# Production Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 📧 Email Service Setup

### Resend (Recommended)
1. **Get API key from Resend dashboard**
2. **Configure domain (optional):**
   - Add your domain in Resend
   - Set up DNS records
   - Verify domain

3. **Environment variables:**
   ```bash
   RESEND_API_KEY=re_your_key_here
   FROM_EMAIL=noreply@yourdomain.com
   ```

### SendGrid
1. **Get API key from SendGrid**
2. **Set up sender authentication**
3. **Environment variables:**
   ```bash
   SENDGRID_API_KEY=SG.your_key_here
   FROM_EMAIL=noreply@yourdomain.com
   ```

## 🔒 Security Configuration

### Environment Variables
Never commit these to Git:
```bash
# Database
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=

# AI Services
OPENAI_API_KEY=

# Email
RESEND_API_KEY=
SENDGRID_API_KEY=

# WhatsApp (if using)
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
```

### CORS Configuration
Update your Supabase CORS settings:
```json
{
  "origins": [
    "https://yourdomain.com",
    "https://www.yourdomain.com",
    "http://localhost:3000"
  ]
}
```

## 🌍 Custom Domain Setup

### Frontend (Vercel)
1. **Add domain in Vercel dashboard**
2. **Configure DNS:**
   ```
   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   
   Type: A
   Name: @
   Value: 76.76.19.61
   ```

### Backend (Railway/Heroku)
1. **Add custom domain in platform dashboard**
2. **Configure DNS:**
   ```
   Type: CNAME
   Name: api
   Value: your-app.railway.app
   ```

## 📊 Monitoring & Analytics

### Error Tracking
1. **Sentry integration:**
   ```bash
   npm install @sentry/nextjs @sentry/python
   ```

2. **Configure Sentry:**
   ```javascript
   // next.config.js
   const { withSentryConfig } = require('@sentry/nextjs');
   ```

### Performance Monitoring
1. **Vercel Analytics** (automatic)
2. **Google Analytics:**
   ```javascript
   // Add GA4 tracking code
   ```

### Uptime Monitoring
- UptimeRobot
- Pingdom
- StatusPage.io

## 🔄 CI/CD Pipeline

### GitHub Actions (Included)
The repository includes workflows for:
- **Continuous Integration:** Tests, linting, security scans
- **Preview Deployments:** Automatic preview for PRs
- **Production Deployment:** Deploy on merge to main

### Required Secrets
Add these to GitHub repository secrets:
```
VERCEL_TOKEN=your_vercel_token
VERCEL_ORG_ID=your_org_id
VERCEL_PROJECT_ID=your_project_id
```

## 🚨 Troubleshooting

### Common Issues

**Build Failures:**
- Check Node.js version (18+)
- Verify all environment variables
- Check for TypeScript errors

**Database Connection:**
- Verify Supabase URL and keys
- Check network connectivity
- Ensure RLS policies are correct

**Email Not Sending:**
- Verify API keys
- Check domain configuration
- Monitor email service logs

**Chat System Issues:**
- Ensure Supabase Realtime is enabled
- Check WebSocket connections
- Verify conversation setup

### Logs and Debugging
```bash
# Vercel logs
vercel logs

# Railway logs
railway logs

# Local debugging
npm run dev
python main.py --debug
```

## 📈 Scaling Considerations

### Database
- Monitor connection pool usage
- Set up read replicas for heavy read workloads
- Consider database indexing optimization

### Backend
- Use horizontal scaling (multiple instances)
- Implement caching (Redis)
- Monitor API response times

### Frontend
- Enable Vercel Edge Functions
- Implement proper caching headers
- Use CDN for static assets

## 💰 Cost Optimization

### Vercel
- Free tier: 100GB bandwidth
- Pro: $20/month for team features

### Railway
- Free tier: $5 credit monthly
- Pro: Pay per usage

### Supabase
- Free tier: 2 databases, 500MB storage
- Pro: $25/month per project

### Email Services
- Resend: 3,000 emails/month free
- SendGrid: 100 emails/day free

---

## 🎉 Deployment Checklist

- [ ] GitHub repository created and pushed
- [ ] Frontend deployed to Vercel
- [ ] Backend deployed to Railway/Heroku
- [ ] Database configured with RLS
- [ ] Email service configured and tested
- [ ] Environment variables set in all platforms
- [ ] Custom domains configured (optional)
- [ ] Monitoring and error tracking set up
- [ ] CI/CD pipeline working
- [ ] Security review completed

Your LocalOps AI platform is now ready for production! 🚀