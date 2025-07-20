# SumUp POS Bolt-on Admin Dashboard Implementation

## Overview

This implementation provides two separate admin dashboards for LocalOps AI's SumUp POS bolt-on integration:

1. **Platform Owner Admin Dashboard** (`/admin/bolt-ons`) - For platform administrators to manage bolt-on subscriptions across all businesses
2. **Business Customer Dashboard** (`/dashboard/integrations`) - For individual businesses to manage their SumUp integration

## Features

### Platform Owner Admin Dashboard
- **Summary Cards**: Total businesses, active subscriptions, monthly revenue, 30-day sales
- **Platform Controls**: Enable/disable bolt-on globally, set pricing, configure requirements
- **Business Management**: View all businesses with their bolt-on status, toggle per business
- **Bulk Actions**: Enable/disable for all businesses or specific subscription tiers
- **Analytics**: Detailed usage analytics per business
- **Audit Logs**: Complete audit trail of all admin actions

### Business Customer Dashboard
- **Integration Status**: Real-time connection status and error display
- **OAuth Connection**: Secure SumUp account connection via OAuth 2.0
- **Toggle Controls**: Enable/disable integration if entitled
- **Sales Analytics**: Daily charts, hourly patterns, top-selling items
- **Sync Management**: Manual sync triggers and sync status monitoring
- **Upgrade Prompts**: Clear upgrade flow for non-entitled businesses
- **Integration Logs**: Operation logs and error tracking

## Architecture

### Backend Components

#### Database Models
- `BoltOnManagement`: Platform-wide bolt-on configuration
- `BoltOnSubscription`: Business-specific subscription status
- `BoltOnAuditLog`: Complete audit trail of all actions
- `SumUpIntegration`: Integration configuration and OAuth tokens
- `SalesData`: Transaction data from SumUp
- `IntegrationLog`: Operation logs and error tracking

#### Services
- `BoltOnManagementService`: Platform owner bolt-on management
- `SumUpIntegrationService`: SumUp API integration and sync

#### API Endpoints

**Platform Owner Endpoints:**
```
GET    /api/admin/bolt-ons/{bolt_on_type}/dashboard
POST   /api/admin/bolt-ons/{bolt_on_type}/toggle
POST   /api/admin/bolt-ons/{bolt_on_type}/bulk-action
GET    /api/admin/bolt-ons/{bolt_on_type}/business/{business_id}/analytics
GET    /api/admin/bolt-ons/audit-logs
PUT    /api/admin/bolt-ons/{bolt_on_type}/config
```

**Customer Endpoints:**
```
GET    /api/integrations/sumup/{business_id}/status
GET    /api/integrations/sumup/{business_id}/upgrade-prompt
POST   /api/integrations/sumup/oauth
POST   /api/integrations/sumup/{business_id}/sync
POST   /api/integrations/sumup/{business_id}/disconnect
GET    /api/integrations/sumup/{business_id}/analytics
GET    /api/integrations/sumup/{business_id}/logs
POST   /api/business/{business_id}/integrations/{bolt_on_type}/toggle
```

### Frontend Components

#### Admin Dashboard (`/admin/bolt-ons`)
- **Summary Cards**: Key metrics and revenue overview
- **Business Table**: All businesses with status, toggle buttons, and actions
- **Configuration Dialog**: Platform-wide settings
- **Bulk Actions Dialog**: Mass enable/disable operations
- **Analytics Modal**: Detailed business usage analytics

#### Customer Dashboard (`/dashboard/integrations`)
- **Status Overview**: Connection status and key metrics
- **Action Buttons**: Connect, toggle, sync, disconnect
- **Upgrade Prompts**: Clear upgrade flow for non-entitled users
- **Analytics Tabs**: Overview, detailed analytics, and logs
- **Error Display**: Clear error messages and troubleshooting

## Setup Instructions

### 1. Environment Configuration

Create a `.env` file in the backend directory:

```bash
# SumUp API Configuration
SUMUP_CLIENT_ID=your_sumup_client_id
SUMUP_CLIENT_SECRET=your_sumup_client_secret

# Encryption (32-character key)
ENCRYPTION_KEY=your_32_character_encryption_key_here

# Frontend Configuration
NEXT_PUBLIC_SUMUP_CLIENT_ID=your_sumup_client_id
```

### 2. Database Setup

The database tables are automatically created when the backend starts. Ensure the backend is running:

```bash
cd backend
python main.py
```

### 3. Frontend Setup

Install dependencies and start the frontend:

```bash
cd frontend
npm install
npm run dev
```

### 4. SumUp Developer Setup

1. Create a SumUp developer account at https://developer.sumup.com
2. Register a new OAuth application
3. Set the redirect URI to: `http://localhost:3000/integrations/sumup/callback`
4. Copy the client ID and secret to your environment variables

## Usage Guide

### Platform Owner Workflow

1. **Access Admin Dashboard**: Navigate to `/admin/bolt-ons`
2. **Configure Platform Settings**: Set pricing, required plan, enable/disable globally
3. **Manage Business Subscriptions**: Toggle bolt-on for individual businesses
4. **Bulk Operations**: Enable/disable for multiple businesses at once
5. **Monitor Usage**: View analytics and audit logs

### Business Customer Workflow

1. **Access Integration Dashboard**: Navigate to `/dashboard/integrations`
2. **Check Entitlement**: Verify subscription tier meets requirements
3. **Connect SumUp Account**: Complete OAuth flow to connect POS system
4. **Enable Integration**: Toggle integration on/off as needed
5. **Monitor Performance**: View sales analytics and sync status

## API Documentation

### Platform Owner API

#### Get Admin Dashboard
```http
GET /api/admin/bolt-ons/sumup_sync/dashboard
```

Response:
```json
{
  "bolt_on_type": "sumup_sync",
  "platform_enabled": true,
  "monthly_price": 29.99,
  "total_businesses": 150,
  "active_subscriptions": 45,
  "total_revenue": 1349.55,
  "businesses": [
    {
      "business_id": 1,
      "business_name": "Sample Restaurant",
      "subscription_tier": "professional",
      "is_enabled": true,
      "is_entitled": true,
      "last_sync_at": "2024-01-15T10:30:00Z",
      "usage_30d": 12500.50,
      "connection_status": "active",
      "error_message": null
    }
  ]
}
```

#### Toggle Business Bolt-on
```http
POST /api/admin/bolt-ons/sumup_sync/toggle
Content-Type: application/json

{
  "business_id": 1,
  "bolt_on_type": "sumup_sync",
  "enable": true,
  "reason": "Customer requested activation"
}
```

#### Bulk Action
```http
POST /api/admin/bolt-ons/sumup_sync/bulk-action
Content-Type: application/json

{
  "bolt_on_type": "sumup_sync",
  "action": "enable_for_plan",
  "target_plan": "professional",
  "reason": "Bulk enable for professional tier"
}
```

### Customer API

#### Get Integration Status
```http
GET /api/integrations/sumup/1/status
```

Response:
```json
{
  "is_connected": true,
  "is_entitled": true,
  "last_sync_at": "2024-01-15T10:30:00Z",
  "sync_frequency_hours": 1,
  "merchant_id": "merchant_123",
  "location_count": 2,
  "total_transactions": 1250,
  "last_7_days_sales": 8500.75,
  "connection_status": "active",
  "error_message": null
}
```

#### Get Upgrade Prompt
```http
GET /api/integrations/sumup/1/upgrade-prompt
```

Response:
```json
{
  "show_upgrade": true,
  "current_plan": "starter",
  "required_plan": "professional",
  "bolt_on_price": 29.99,
  "features_unlocked": [
    "Automated sales data sync",
    "Staff performance analytics",
    "Demand-driven scheduling",
    "Inventory insights",
    "Revenue optimization"
  ],
  "upgrade_url": "/billing/upgrade?bolt_on=sumup_sync"
}
```

## Security Features

### OAuth 2.0 Integration
- Secure token exchange with SumUp API
- Encrypted token storage using Fernet encryption
- Automatic token refresh handling
- Proper token revocation on disconnect

### Role-Based Access Control
- Platform owner access to `/admin/bolt-ons`
- Business customer access to `/dashboard/integrations`
- Entitlement checking for all operations
- Audit logging of all actions

### Data Protection
- Encrypted OAuth tokens
- Secure API endpoints with authentication
- Audit trail for compliance
- Error handling and logging

## Testing

Run the comprehensive test script:

```bash
./test-sumup-bolt-on.sh
```

This script tests:
- Backend API endpoints
- Database models and schema
- Frontend components
- Environment configuration
- Service functionality

## Troubleshooting

### Common Issues

1. **OAuth Connection Fails**
   - Verify SumUp client ID and secret
   - Check redirect URI configuration
   - Ensure encryption key is set

2. **Database Errors**
   - Run database migrations
   - Check table creation
   - Verify model imports

3. **Frontend Issues**
   - Install dependencies: `npm install`
   - Check environment variables
   - Verify API endpoints are accessible

4. **Sync Failures**
   - Check SumUp API credentials
   - Verify merchant account status
   - Review integration logs

### Debug Mode

Enable debug logging in the backend:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Deployment

### Production Checklist

- [ ] Set production environment variables
- [ ] Configure production database
- [ ] Set up SSL certificates
- [ ] Configure production SumUp OAuth app
- [ ] Set up monitoring and logging
- [ ] Test all endpoints and workflows
- [ ] Configure backup and recovery

### Environment Variables

```bash
# Production
SUMUP_CLIENT_ID=prod_client_id
SUMUP_CLIENT_SECRET=prod_client_secret
ENCRYPTION_KEY=prod_32_char_encryption_key
DATABASE_URL=postgresql://user:pass@host:port/db
NEXT_PUBLIC_SUMUP_CLIENT_ID=prod_client_id
```

## Support

For issues and questions:

1. Check the troubleshooting section above
2. Review the audit logs for error details
3. Test with the provided test script
4. Check SumUp API documentation for integration issues

## License

This implementation is part of LocalOps AI and follows the project's licensing terms. 