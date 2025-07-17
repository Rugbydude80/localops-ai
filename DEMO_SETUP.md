# LocalOps AI - Demo Setup Guide

## 🚀 Quick Demo Setup

This guide will help you set up a complete demo environment with sample data to showcase all LocalOps AI features.

### Prerequisites

1. **Database Setup**: Ensure your Supabase database is configured
2. **Environment Variables**: Make sure your `.env.local` file is properly configured
3. **Backend Running**: The FastAPI backend should be running on `http://localhost:8001`

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Setup Demo Data

Run the comprehensive demo setup script:

```bash
npm run setup-full-demo
```

This will:
- Create database tables
- Add 6 realistic staff members with different skills
- Generate 2 weeks of shifts (morning, lunch, evening, bar, management)
- Create shift assignments
- Add emergency coverage requests
- Generate WhatsApp message logs

### 3. Start the Application

```bash
# Terminal 1: Backend
cd backend
python main.py

# Terminal 2: Frontend
cd frontend
npm run dev
```

### 4. Demo Features

Visit these URLs to explore different features:

#### 🏠 **Staff Management** - `http://localhost:3000`
- View all staff members with reliability scores
- **Click on any staff member** to edit their details
- Add new staff members
- Create emergency coverage requests
- See WhatsApp messaging simulation

#### 📊 **Operations Dashboard** - `http://localhost:3000/dashboard`
- Overview of key metrics
- Today's shifts
- Upcoming shifts (next 3 days)
- Recent coverage requests
- Navigation between different views

#### 📅 **Shift Calendar** - `http://localhost:3000/shifts`
- Full calendar view of all shifts
- Week/Month view toggle
- Create new shifts
- Assign staff to shifts
- **Report sick leave** (triggers automatic WhatsApp messages)
- View shift status (scheduled, filled, understaffed)

#### 🎯 **Enhanced Dashboard** - `http://localhost:3000/enhanced-dashboard`
- 8 AI-powered feature modules
- Real-time business intelligence
- Smart communication analytics
- Training management
- Inventory intelligence
- Multi-location coordination
- Emergency response automation
- Customer experience integration

## 🎭 Demo Scenarios

### Scenario 1: Staff Management
1. Go to `http://localhost:3000`
2. **Click on "Emma Davis"** to edit her details
3. Update her phone number or add skills
4. Try adding a new staff member

### Scenario 2: Emergency Coverage
1. Click "Emergency Coverage" button
2. Create a request for tomorrow's kitchen shift
3. Watch the console for simulated WhatsApp messages
4. See the request appear in "Recent Requests"

### Scenario 3: Shift Management
1. Go to `http://localhost:3000/shifts`
2. Browse the calendar view
3. Click on any shift to manage assignments
4. Try reporting someone as sick - this will:
   - Mark them as unavailable
   - Automatically find qualified replacements
   - Send WhatsApp messages to available staff
   - Create an emergency request

### Scenario 4: WhatsApp Integration Demo
When you report sick leave or create emergency requests:
- Check the browser console for simulated WhatsApp messages
- Messages are logged to the database
- Qualified staff are automatically identified by skills
- AI-generated messages are sent (simulated)

## 📱 WhatsApp Integration

The system includes full WhatsApp Business API integration:

### Current Status: **Simulation Mode**
- Messages are logged to console and database
- All WhatsApp functionality is simulated for demo
- Real phone numbers are not contacted

### Production Setup:
To enable real WhatsApp messaging, add these environment variables:

```env
WHATSAPP_ACCESS_TOKEN=your_whatsapp_business_token
WHATSAPP_PHONE_NUMBER_ID=your_whatsapp_phone_id
```

### Message Flow:
1. **Sick Leave Reported** → System finds qualified staff → Sends WhatsApp messages
2. **Emergency Request** → AI generates personalized messages → Sends to relevant staff
3. **Staff Responses** → System processes YES/NO/MAYBE replies
4. **Confirmations** → Automatic confirmation messages sent

## 🎯 Key Demo Features

### ✅ **User Editing**
- Click any staff member to edit details
- Update name, phone, email, role, skills
- Remove staff members
- Real-time updates

### ✅ **Dashboard Views**
- Operations overview with key metrics
- Today's shifts and upcoming shifts
- Emergency request tracking
- Staff performance indicators

### ✅ **Shift Management**
- Visual calendar interface
- Drag-and-drop functionality
- Status tracking (scheduled/filled/understaffed)
- Staff assignment management

### ✅ **WhatsApp Automation**
- Automatic sick leave replacement
- Emergency coverage requests
- AI-generated messages
- Response tracking

### ✅ **Demo Data**
- 6 realistic staff members
- 2 weeks of varied shifts
- Emergency requests
- Message logs
- Shift assignments

## 🔧 Troubleshooting

### Database Issues
```bash
# Reset and recreate demo data
npm run setup-full-demo
```

### Backend Connection Issues
- Ensure backend is running on `http://localhost:8001`
- Check that all environment variables are set
- Verify Supabase connection

### Missing Data
```bash
# Just add shifts and assignments
npm run setup-shifts
```

## 📊 Sample Data Overview

### Staff Members (6 total):
- **Emma Davis** - Chef (Kitchen, Management) - 7.8 reliability
- **James Brown** - Bartender (Bar, Front of House) - 8.9 reliability  
- **Lisa Garcia** - Server (Front of House, Bar) - 6.5 reliability
- **Mike Taylor** - Cook (Kitchen) - 7.2 reliability
- **Sarah Johnson** - Manager (Management, Front of House) - 9.2 reliability
- **Tom Wilson** - Server (Front of House, Cleaning) - 8.5 reliability

### Shifts (14 days):
- Morning Kitchen (06:00-14:00)
- Lunch Service (11:00-16:00)
- Evening Kitchen (14:00-22:00)
- Bar Service (17:00-23:00)
- Dinner Service (17:00-23:00)
- Management (09:00-17:00)

### Emergency Requests:
- Kitchen staff sick leave
- Extra server needed
- Various urgency levels

## 🎉 Ready to Demo!

Your LocalOps AI demo environment is now ready with:
- ✅ Realistic staff data
- ✅ 2 weeks of shifts
- ✅ Emergency scenarios
- ✅ WhatsApp integration (simulated)
- ✅ Full CRUD operations
- ✅ Multiple dashboard views

Navigate between the different views to showcase the complete restaurant operations management platform!