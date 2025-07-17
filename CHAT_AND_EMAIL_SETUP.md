# Chat System & Email Notifications Setup

Your workforce management system now includes both **in-app chat** and **email notifications**! Here's how to get everything working.

## 🚀 Quick Setup

1. **Run the setup script:**
   ```bash
   cd frontend
   node scripts/setup-chat-and-notifications.js
   ```

2. **Configure email service** (add to `frontend/.env.local`):
   ```bash
   # For Resend (recommended)
   RESEND_API_KEY=re_your_api_key_here
   FROM_EMAIL=noreply@yourcompany.com
   
   # OR for SendGrid
   SENDGRID_API_KEY=SG.your_api_key_here
   FROM_EMAIL=noreply@yourcompany.com
   ```

3. **Start your app:**
   ```bash
   npm run dev
   ```

## 💬 In-App Chat Features

**What you get:**
- Real-time messaging between staff members
- Group conversations for team updates
- Direct messages between individuals
- Message history and read receipts
- System messages for shift updates

**How to use:**
1. Go to your Shifts page (`/shifts`)
2. Click the "Chat" button in the top right
3. Start messaging with your team!

**Technical details:**
- Uses Supabase Realtime for instant messaging
- Messages are stored in your database
- Works in web browsers (no app install needed)
- Supports emoji reactions and file sharing (extensible)

## 📧 Email Notifications

**Automatic notifications for:**
- ✅ Shift assignments
- ✅ Shift changes/updates  
- ✅ Emergency shift requests
- ✅ Weekly schedule summaries
- ✅ Sick leave reports

**Email services supported:**
- **Resend** (recommended) - Modern, reliable, great developer experience
- **SendGrid** - Enterprise-grade, widely used
- Easy to add others (Mailgun, Postmark, etc.)

## 🔧 Email Service Setup

### Option 1: Resend (Recommended)

1. Sign up at [resend.com](https://resend.com)
2. Get your API key from the dashboard
3. Add to `.env.local`:
   ```
   RESEND_API_KEY=re_your_key_here
   FROM_EMAIL=noreply@yourcompany.com
   ```

**Why Resend?**
- Modern, developer-friendly API
- Great deliverability
- Generous free tier (3,000 emails/month)
- Built by developers, for developers

### Option 2: SendGrid

1. Sign up at [sendgrid.com](https://sendgrid.com)
2. Create an API key in Settings > API Keys
3. Add to `.env.local`:
   ```
   SENDGRID_API_KEY=SG.your_key_here
   FROM_EMAIL=noreply@yourcompany.com
   ```

## 🎯 How It Works in Your App

### Chat Integration
- **Shifts Page**: Click "Chat" button to open team messaging
- **Real-time**: Messages appear instantly for all users
- **Persistent**: Message history is saved in your database

### Email Integration
- **Automatic**: Emails sent when staff are assigned to shifts
- **Customizable**: Easy to modify email templates
- **Logged**: All email activity tracked in your database

## 📊 Database Tables Added

The setup script creates these new tables:

```sql
conversations          -- Chat rooms/direct messages
conversation_participants -- Who's in each conversation
messages               -- All chat messages
message_reactions      -- Emoji reactions (optional)
```

Your existing `message_logs` table now also tracks email notifications.

## 🔍 Testing

1. **Test Chat:**
   - Go to `/shifts`
   - Click "Chat" button
   - Send a message to yourself

2. **Test Email:**
   - Create a shift
   - Assign staff to the shift
   - Check your email service dashboard for delivery

## 🛠 Customization

### Email Templates
Edit `frontend/src/lib/emailService.ts` to customize:
- Email subject lines
- HTML templates
- Text content
- Branding

### Chat Features
Extend `frontend/src/components/ChatSystem.tsx` to add:
- File uploads
- Voice messages
- Video calls
- Custom emoji reactions

## 💡 Pro Tips

1. **Cost Control**: Both chat and email are nearly free at small scale
2. **Reliability**: In-app chat works when users are online; email works always
3. **User Experience**: Chat for quick updates, email for important notifications
4. **Compliance**: All messages logged for audit trails

## 🚨 Troubleshooting

**Chat not working?**
- Check browser console for WebSocket errors
- Verify Supabase Realtime is enabled
- Ensure users are in the same conversation

**Emails not sending?**
- Check API key is correct in `.env.local`
- Verify FROM_EMAIL domain is configured
- Check email service dashboard for errors

**Need help?**
- Check the browser console for errors
- Look at your Supabase logs
- Verify environment variables are loaded

---

## 🎉 You're All Set!

Your workforce management system now has professional-grade communication features that rival WhatsApp for business use - but fully integrated into your platform and under your control.

**No per-message fees. No external dependencies. Just seamless team communication.**