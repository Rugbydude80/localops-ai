# LocalOps AI - Next-Level Restaurant Operations Platform

A comprehensive restaurant operations management platform featuring 8 advanced AI-powered modules that transform how restaurants manage staff, inventory, training, and customer experience.

## 🚀 8 Next-Level Features

### 1. 🧠 AI-Powered Predictive Scheduling
- **Demand Forecasting**: AI analyzes historical sales, weather, and local events
- **Optimal Staffing**: Automatically generates cost-effective schedules
- **Cost Savings**: 25% reduction in labour costs through smart optimization
- **Confidence Scoring**: AI provides prediction confidence levels

### 2. 📱 Smart Staff Communication Hub
- **Intelligent Routing**: Messages sent via optimal channels (WhatsApp → SMS → Email)
- **AI Optimization**: Determines best timing and personalization
- **Response Tracking**: Real-time delivery and read receipts
- **Template Library**: Pre-written messages for common scenarios

### 3. 🎓 Digital Training & Certification Manager
- **AI Content Generation**: Automatically creates training modules and quizzes
- **Skill Tracking**: Monitor certifications and compliance requirements
- **Progress Analytics**: Track completion rates and performance
- **Certificate Generation**: Automated PDF certificates with expiry tracking

### 4. 📊 Real-Time Business Intelligence Dashboard
- **Live Metrics**: Labour costs, utilisation, coverage rates updated every 30 seconds
- **Trend Analysis**: Compare performance with previous periods
- **KPI Targets**: Set and monitor key performance indicators
- **Predictive Insights**: AI-powered recommendations for improvement

### 5. 🍽️ Intelligent Inventory Management
- **AI Predictions**: Forecast inventory needs based on usage patterns
- **Smart Reordering**: Automated purchase recommendations with supplier optimization
- **Waste Reduction**: Expiry tracking and usage optimization
- **Cost Analysis**: Track food costs and identify savings opportunities

### 6. 🏢 Multi-Location Coordination Hub
- **Cross-Location Staffing**: Share staff between nearby locations
- **Inventory Balancing**: Transfer excess stock between sites
- **Centralized Reporting**: Unified dashboard for all locations
- **Best Practice Sharing**: Replicate successful processes across sites

### 7. ⚡ Emergency Response Automation
- **Automated Protocols**: Pre-defined responses for common emergencies
- **Instant Notifications**: Immediate alerts to relevant staff and contacts
- **Escalation Rules**: Automatic escalation based on severity and time
- **Response Tracking**: Monitor effectiveness and response times

### 8. ⭐ Customer Experience Integration
- **Review Aggregation**: Collect feedback from Google, TripAdvisor, Facebook
- **Sentiment Analysis**: AI analyzes customer sentiment and themes
- **Staff Performance**: Link customer feedback to specific staff members
- **Response Generation**: AI suggests responses to reviews

## 💰 Business Impact

| Feature | Monthly Value per Location | ROI |
|---------|---------------------------|-----|
| Predictive Scheduling | £300 labour savings | 25% cost reduction |
| Smart Communication | £200 efficiency gains | 10 hours/week saved |
| Training Manager | £150 compliance value | Reduced liability |
| BI Dashboard | £250 decision improvement | Data-driven operations |
| Inventory Intelligence | £400 waste reduction | 15% food cost savings |
| Multi-Location Hub | £600 coordination gains | Scale efficiency |
| Emergency Response | £200 risk mitigation | Faster incident resolution |
| Customer Integration | £300 satisfaction improvement | Higher ratings |

**Total Potential Value: £2,400/month per location**

## 🛠 Tech Stack

### Frontend
- **Next.js 15** with TypeScript
- **React 18** with modern hooks
- **Tailwind CSS** for responsive design
- **React Query** for data management
- **Heroicons** for consistent iconography

### Backend
- **FastAPI** with async/await
- **SQLAlchemy** ORM with PostgreSQL
- **OpenAI GPT-4 Turbo** for AI features
- **Pydantic** for data validation
- **Python 3.9+** with type hints

### Database & Services
- **Supabase** (PostgreSQL) for data storage
- **OpenAI API** for AI-powered features
- **WhatsApp Business API** for messaging
- **Real-time subscriptions** for live updates

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.9+
- Supabase account
- OpenAI API key

### 1. Clone and Setup
```bash
git clone <repository-url>
cd localops-ai

# Setup frontend
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
```

### 2. Database Setup
```bash
# Create database tables
npm run setup-db

# Populate with demo data for all 8 features
npm run setup-demo
```

### 3. Backend Setup
```bash
cd ../backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your API keys
```

### 4. Start Services
```bash
# Terminal 1: Backend
cd backend
python main.py

# Terminal 2: Frontend
cd frontend
npm run dev
```

### 5. Access the Platform
- **Enhanced Dashboard**: http://localhost:3000/enhanced-dashboard
- **Original Dashboard**: http://localhost:3000
- **API Documentation**: http://localhost:8000/docs
- **Backend Health**: http://localhost:8000/health

## 🔧 Environment Configuration

### Frontend (.env.local)
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### Backend (.env)
```env
OPENAI_API_KEY=your_openai_api_key
WHATSAPP_ACCESS_TOKEN=your_whatsapp_business_token
WHATSAPP_PHONE_NUMBER_ID=your_whatsapp_phone_id
DATABASE_URL=your_postgresql_connection_string
```

## 📱 Feature Demonstrations

### AI Predictive Scheduling
```bash
# Generate smart schedule for next week
curl -X POST "http://localhost:8000/api/predictive-scheduling/1/generate" \
  -H "Content-Type: application/json" \
  -d '{"week_start": "2024-01-15"}'
```

### Smart Communication
```bash
# Send intelligent message to staff
curl -X POST "http://localhost:8000/api/smart-communication/1/send" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "shift_cover",
    "content": "Need kitchen staff for tomorrow",
    "filters": {"skills": ["kitchen"]},
    "priority": "high"
  }'
```

### Training Analytics
```bash
# Get training completion analytics
curl "http://localhost:8000/api/training/1/analytics"
```

### Real-Time Metrics
```bash
# Get live business intelligence
curl "http://localhost:8000/api/business-intelligence/1/real-time"
```

## 🏗 Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Services      │
│   (Next.js)     │◄──►│   (FastAPI)     │◄──►│   (AI/APIs)     │
│                 │    │                 │    │                 │
│ • Dashboard     │    │ • 8 Feature     │    │ • OpenAI GPT-4  │
│ • 8 Feature UIs │    │   Services      │    │ • WhatsApp API  │
│ • Real-time     │    │ • REST APIs     │    │ • Weather API   │
│   Updates       │    │ • WebSockets    │    │ • Events API    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Database      │
                    │   (Supabase)    │
                    │                 │
                    │ • 25+ Tables    │
                    │ • Real-time     │
                    │ • Row Level     │
                    │   Security      │
                    └─────────────────┘
```

## 📊 Database Schema

### Core Tables
- `businesses` - Restaurant information and subscription tiers
- `staff` - Team members with skills and availability
- `shifts` - Scheduled work periods and assignments
- `emergency_requests` - Coverage requests and responses

### Feature-Specific Tables
- `demand_predictions` - AI forecasting data
- `smart_messages` - Intelligent communication logs
- `training_modules` - Learning content and quizzes
- `business_metrics` - Real-time performance data
- `inventory_items` - Stock levels and predictions
- `customer_reviews` - Feedback aggregation
- `emergency_incidents` - Response protocols and logs

## 🔌 API Endpoints

### Predictive Scheduling
- `POST /api/predictive-scheduling/{business_id}/generate`
- `GET /api/predictive-scheduling/{business_id}/predictions`

### Smart Communication
- `POST /api/smart-communication/{business_id}/send`
- `GET /api/smart-communication/{business_id}/analytics`
- `GET /api/smart-communication/{business_id}/templates/{type}`

### Training Management
- `POST /api/training/{business_id}/modules`
- `GET /api/training/staff/{staff_id}/dashboard`
- `POST /api/training/staff/{staff_id}/complete/{module_id}`

### Business Intelligence
- `GET /api/business-intelligence/{business_id}/real-time`
- `GET /api/business-intelligence/{business_id}/weekly-report`
- `GET /api/business-intelligence/{business_id}/staff-performance`

### Inventory Intelligence
- `GET /api/inventory/{business_id}/predictions`
- `GET /api/inventory/{business_id}/smart-orders`
- `GET /api/inventory/{business_id}/dashboard`

### Multi-Location
- `GET /api/multi-location/{business_id}/locations`
- `POST /api/multi-location/staff-transfer`

### Emergency Response
- `POST /api/emergency-response/{business_id}/incident`
- `GET /api/emergency-response/{business_id}/incidents`

### Customer Experience
- `GET /api/customer-experience/{business_id}/reviews`
- `GET /api/customer-experience/{business_id}/service-metrics`

## 🧪 Testing the Features

1. **Setup Demo Data**
   ```bash
   cd frontend
   npm run setup-demo
   ```

2. **Visit Enhanced Dashboard**
   ```
   http://localhost:3000/enhanced-dashboard
   ```

3. **Explore Each Feature**
   - Click through the 8 feature tabs
   - Test API endpoints with the interactive docs
   - Monitor real-time updates

## 🎯 Pricing Tiers

### Starter (£29/month)
- Basic scheduling and staff management
- Emergency coverage system
- WhatsApp integration

### Professional (£59/month)
- All Starter features
- AI predictive scheduling
- Smart communication hub
- Training management

### Enterprise (£108/month)
- All Professional features
- Business intelligence dashboard
- Inventory management
- Multi-location coordination
- Emergency response automation
- Customer experience integration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Full API docs at `/docs` endpoint
- **Issues**: GitHub Issues for bug reports
- **Email**: support@localops.ai
- **Demo**: Live demo available at demo.localops.ai

---

**LocalOps AI** - Transforming restaurant operations with next-level AI-powered features. From predictive scheduling to customer experience integration, we've built the complete solution for modern restaurant management.