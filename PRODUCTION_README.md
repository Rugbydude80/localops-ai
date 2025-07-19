# LocalOps AI - Production Ready System

## 🚀 Overview

LocalOps AI is now a fully production-ready restaurant operations management platform with comprehensive authentication, role-based access control, and 8 advanced AI-powered features. This system is designed for real-world deployment with enterprise-grade security and scalability.

## ✨ Production Features

### 🔐 **Authentication & Authorization**
- **JWT-based authentication** with access and refresh tokens
- **Role-based access control** with 5 permission levels:
  - Super Admin (100) - Full system access
  - Admin (80) - Business administration
  - Manager (60) - Department management
  - Supervisor (40) - Team supervision
  - Staff (20) - Basic operations
- **Permission-based feature access** with granular controls
- **Secure password hashing** using bcrypt
- **Token refresh mechanism** for seamless user experience
- **Session management** with automatic logout

### 👥 **User Management**
- **Staff registration and onboarding**
- **Role assignment and management**
- **Permission-based feature access**
- **User profile management**
- **Password change functionality**
- **Account deactivation/reactivation**

### 🏢 **Business Operations**
- **Multi-business support** with isolated data
- **Business-specific configurations**
- **Cross-business analytics** (for super admins)
- **Business hierarchy management**

### 🛡️ **Security Features**
- **CORS protection** with configurable origins
- **Input validation** and sanitization
- **SQL injection prevention** with parameterized queries
- **XSS protection** with proper content encoding
- **Rate limiting** (configurable)
- **Audit logging** for security events

## 🏗️ Architecture

### Backend (FastAPI)
```
backend/
├── auth.py                 # Authentication system
├── main.py                 # Main API with protected endpoints
├── models.py               # Database models with auth fields
├── schemas.py              # Pydantic schemas
├── services/               # Business logic services
│   ├── ai_scheduling_engine.py
│   ├── business_intelligence.py
│   ├── inventory_intelligence.py
│   ├── smart_communication.py
│   └── training_manager.py
└── requirements.txt        # Production dependencies
```

### Frontend (Next.js)
```
frontend/
├── src/
│   ├── hooks/
│   │   └── useAuth.tsx     # Authentication hook
│   ├── components/
│   │   └── ProtectedRoute.tsx  # Route protection
│   ├── pages/
│   │   ├── login.tsx       # Authentication page
│   │   ├── staff-management.tsx  # Protected staff management
│   │   └── enhanced-dashboard.tsx  # Main dashboard
│   └── lib/
│       └── api.ts          # Authenticated API client
└── package.json
```

## 🚀 Quick Start

### 1. Automated Setup
```bash
# Run the production setup script
./setup-production.sh
```

This script will:
- Set up Python virtual environment
- Install all dependencies
- Create configuration files
- Initialize database with roles and permissions
- Create default admin user
- Generate startup scripts

### 2. Manual Setup

#### Backend Setup
```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env with your configuration

# Initialize database
python init_db.py
```

#### Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Create .env.local file
cp .env.example .env.local
# Edit .env.local with your configuration
```

### 3. Start the System

#### Development Mode
```bash
./start-dev.sh
```

#### Production Mode
```bash
./start-production.sh
```

## 🔧 Configuration

### Backend Environment Variables (.env)
```bash
# Database
DATABASE_URL=sqlite:///./localops_ai.db

# JWT Security
JWT_SECRET_KEY=your-secret-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=1440
REFRESH_TOKEN_EXPIRE_DAYS=7

# AI Services
OPENAI_API_KEY=your-openai-api-key

# Communication Services
WHATSAPP_ACCESS_TOKEN=your-whatsapp-token
WHATSAPP_PHONE_NUMBER_ID=your-phone-id

# Email Services
RESEND_API_KEY=your-resend-key
SENDGRID_API_KEY=your-sendgrid-key
FROM_EMAIL=noreply@yourdomain.com

# Environment
ENVIRONMENT=production
DEBUG=false
```

### Frontend Environment Variables (.env.local)
```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000

# Supabase (if using)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Environment
NODE_ENV=production
```

## 👤 User Roles & Permissions

### Role Hierarchy
1. **Super Admin (100)** - Full system access
   - Manage all businesses
   - Create/delete admin users
   - Access all features
   - System configuration

2. **Admin (80)** - Business administration
   - Manage all staff in business
   - Access all business features
   - Configure business settings
   - View all data

3. **Manager (60)** - Department management
   - Assign shifts to all staff
   - Manage department staff
   - View department data
   - Create shifts

4. **Supervisor (40)** - Team supervision
   - Assign shifts to junior staff
   - View team data
   - Create shifts
   - Approve time off

5. **Staff (20)** - Basic operations
   - View own shifts
   - Manage own availability
   - Request time off
   - Self-assign to shifts

### Permission System
- **Granular permissions** for each feature
- **Role-based access control** (RBAC)
- **Permission inheritance** based on role level
- **Feature-specific permissions** (e.g., `manage_all_staff`, `assign_any_shift`)

## 🔐 Security Features

### Authentication
- **JWT tokens** with configurable expiration
- **Refresh token rotation** for security
- **Password hashing** with bcrypt
- **Account lockout** after failed attempts
- **Session management** with automatic cleanup

### Authorization
- **Role-based access control**
- **Permission-based feature access**
- **Business isolation** for multi-tenant setup
- **API endpoint protection** with decorators

### Data Protection
- **Input validation** with Pydantic
- **SQL injection prevention**
- **XSS protection**
- **CORS configuration**
- **Rate limiting**

## 📊 Features Overview

### 1. **AI-Powered Predictive Scheduling**
- Demand forecasting using AI
- Optimal staff scheduling
- Cost optimization
- Confidence scoring

### 2. **Smart Staff Communication**
- Multi-channel messaging (WhatsApp, SMS, Email)
- AI-optimized delivery timing
- Template library
- Response tracking

### 3. **Digital Training & Certification**
- AI-generated training content
- Progress tracking
- Certification management
- Compliance monitoring

### 4. **Real-Time Business Intelligence**
- Live metrics dashboard
- Performance analytics
- KPI tracking
- Predictive insights

### 5. **Intelligent Inventory Management**
- AI-powered demand prediction
- Smart reordering
- Waste reduction
- Cost analysis

### 6. **Multi-Location Coordination**
- Cross-location staffing
- Inventory balancing
- Centralized reporting
- Best practice sharing

### 7. **Emergency Response Automation**
- Automated protocols
- Instant notifications
- Escalation rules
- Response tracking

### 8. **Customer Experience Integration**
- Review aggregation
- Sentiment analysis
- Staff performance linking
- Response generation

## 🚀 Deployment

### Development
```bash
./start-dev.sh
```

### Production
```bash
./start-production.sh
```

### Docker Deployment
```bash
docker-compose up --build -d
```

### Cloud Deployment
- **Railway**: `railway up`
- **Heroku**: `git subtree push --prefix backend heroku main`
- **Vercel**: `vercel --prod`

## 🧪 Testing

### Health Check
```bash
./health-check.sh
```

### API Testing
```bash
# Test authentication
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@localops.ai", "password": "admin123"}'

# Test protected endpoint
curl -X GET http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Frontend Testing
```bash
cd frontend
npm run test
npm run test:e2e
```

## 📈 Monitoring & Maintenance

### Health Monitoring
- **Health check endpoint**: `/health`
- **Database connectivity** monitoring
- **API response time** tracking
- **Error rate** monitoring

### Backup & Recovery
```bash
# Create backup
./backup.sh

# Restore from backup
cp backups/TIMESTAMP/localops_ai.db backend/
```

### Logs
- **Application logs**: `logs/` directory
- **Error tracking**: Structured logging
- **Audit trails**: Security event logging

## 🔧 Troubleshooting

### Common Issues

#### Authentication Issues
```bash
# Check JWT configuration
echo $JWT_SECRET_KEY

# Verify token expiration
curl -X POST http://localhost:8000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "YOUR_REFRESH_TOKEN"}'
```

#### Database Issues
```bash
# Check database file
ls -la backend/localops_ai.db

# Verify database schema
sqlite3 backend/localops_ai.db ".schema"
```

#### Frontend Issues
```bash
# Check environment variables
cat frontend/.env.local

# Verify API connectivity
curl http://localhost:8000/health
```

### Performance Optimization
- **Database indexing** for frequently queried fields
- **Caching** for static data
- **Connection pooling** for database connections
- **CDN** for static assets

## 🔒 Security Best Practices

### Production Deployment
1. **Change default passwords** immediately
2. **Use strong JWT secrets** (32+ characters)
3. **Enable HTTPS** with valid certificates
4. **Configure proper CORS** settings
5. **Set up firewall rules**
6. **Enable rate limiting**
7. **Monitor security logs**
8. **Regular security updates**

### Data Protection
1. **Encrypt sensitive data** at rest
2. **Use secure communication** protocols
3. **Implement data retention** policies
4. **Regular backup** procedures
5. **Access logging** and monitoring

## 📞 Support

### Documentation
- **API Documentation**: http://localhost:8000/docs
- **Interactive API Explorer**: http://localhost:8000/redoc

### Default Credentials
- **Email**: admin@localops.ai
- **Password**: admin123

### Getting Help
1. Check the health status: `./health-check.sh`
2. Review logs in the `logs/` directory
3. Test API endpoints using the interactive docs
4. Verify configuration files

## 🎯 Next Steps

1. **Customize the system** for your specific needs
2. **Set up monitoring** and alerting
3. **Configure backup** procedures
4. **Train your team** on the new features
5. **Plan for scaling** as your business grows

---

**LocalOps AI** - Next-Level Restaurant Operations Management 🚀 