# SumUp POS Integration Implementation

## Overview

This document outlines the complete implementation of the SumUp POS integration as a paid bolt-on feature for LocalOps AI. The integration allows businesses to connect their SumUp POS system to automatically sync sales data and unlock advanced scheduling insights.

## Architecture

### Backend Components

#### 1. Database Models (`backend/models.py`)

**SumUpIntegration**
- Stores OAuth tokens and integration configuration
- Tracks entitlement status and sync frequency
- Links to business and merchant information

**SumUpLocation**
- Maps SumUp locations to LocalOps stores
- Enables multi-location support

**SalesData**
- Stores transaction data from SumUp
- Links to staff and shifts for analytics
- Includes payment details and customer counts

**SalesItem**
- Individual items from transactions
- Enables inventory and product analytics

**IntegrationLog**
- Audit trail for all integration operations
- Tracks errors and sync status

**SalesAnalytics**
- Aggregated sales data for scheduling insights
- Hourly patterns and peak hour identification

**StaffSalesPerformance**
- Staff performance metrics based on sales data
- Enables performance-based scheduling

**BoltOnSubscription**
- Manages paid bolt-on subscriptions
- Tracks entitlement and billing information

#### 2. API Service (`backend/services/sumup_integration.py`)

**Key Features:**
- OAuth 2.0 authentication with SumUp
- Secure token encryption and storage
- Automatic token refresh
- Sales data synchronization
- Entitlement checking
- Integration status management

**Core Methods:**
- `exchange_authorization_code()` - Handle OAuth callback
- `sync_sales_data()` - Sync transactions from SumUp
- `check_entitlement()` - Verify paid subscription
- `get_integration_status()` - Current connection status
- `disconnect_integration()` - Remove integration

#### 3. API Endpoints (`backend/main.py`)

**Integration Management:**
- `GET /api/integrations/sumup/{business_id}/status` - Get integration status
- `GET /api/integrations/sumup/{business_id}/upgrade-prompt` - Show upgrade prompt
- `POST /api/integrations/sumup/oauth` - Handle OAuth callback
- `POST /api/integrations/sumup/{business_id}/sync` - Manual sync trigger
- `POST /api/integrations/sumup/{business_id}/disconnect` - Disconnect integration

**Data Access:**
- `GET /api/integrations/sumup/{business_id}/locations` - Get mapped locations
- `GET /api/integrations/sumup/{business_id}/sales` - Get sales data
- `GET /api/integrations/sumup/{business_id}/analytics` - Get sales analytics
- `GET /api/integrations/sumup/{business_id}/logs` - Get operation logs

#### 4. Background Sync Service (`backend/services/sumup_sync_scheduler.py`)

**Features:**
- Automated hourly data synchronization
- Subscription entitlement checking
- Error handling and retry logic
- Manual sync triggers

### Frontend Components

#### 1. Main Integration Component (`frontend/src/components/SumUpIntegration.tsx`)

**Features:**
- Integration status display
- Connection management UI
- Sales analytics dashboard
- Transaction history viewer
- Integration logs viewer
- Upgrade prompts for non-entitled users

**UI Sections:**
- **Overview Tab**: Daily sales charts, hourly patterns, top items
- **Analytics Tab**: Detailed sales metrics and peak hour analysis
- **Transactions Tab**: Recent transaction history
- **Logs Tab**: Integration operation audit trail

#### 2. OAuth Callback Page (`frontend/src/pages/integrations/sumup/callback.tsx`)

**Features:**
- Handles SumUp OAuth callback
- Exchanges authorization code for tokens
- Shows connection status and error handling
- Redirects to dashboard on success

## Business Logic

### Entitlement Management

1. **Subscription Check**: Only businesses with active "sumup_sync" bolt-on can use the feature
2. **Plan Requirements**: Requires "professional" or higher subscription tier
3. **Upgrade Flow**: Shows upgrade prompt for non-entitled users
4. **Automatic Disabling**: Disables integration if subscription expires

### Data Synchronization

1. **Initial Sync**: Fetches last 7 days of data on first connection
2. **Hourly Sync**: Automatically syncs new transactions every hour
3. **Duplicate Prevention**: Skips already synced transactions
4. **Error Handling**: Logs errors and retries failed operations

### Security Features

1. **Token Encryption**: OAuth tokens encrypted using Fernet
2. **Secure Storage**: Tokens stored in database with encryption
3. **Token Refresh**: Automatic refresh of expired tokens
4. **Revocation**: Proper token revocation on disconnect

## Configuration

### Environment Variables

```bash
# SumUp API Configuration
SUMUP_CLIENT_ID=your_sumup_client_id
SUMUP_CLIENT_SECRET=your_sumup_client_secret

# Encryption
ENCRYPTION_KEY=your_32_character_encryption_key

# Frontend Configuration
NEXT_PUBLIC_SUMUP_CLIENT_ID=your_sumup_client_id
```

### Database Migration

Run the migration to create all required tables:

```bash
cd backend
alembic upgrade head
```

## Usage Flow

### 1. Business Setup

1. Business subscribes to "SumUp Sync" bolt-on (£29.99/month)
2. System creates `BoltOnSubscription` record
3. Integration becomes available in dashboard

### 2. Connection Process

1. User clicks "Connect SumUp Account" in dashboard
2. Redirected to SumUp OAuth authorization
3. User authorizes LocalOps to access their data
4. SumUp redirects back with authorization code
5. System exchanges code for access/refresh tokens
6. Integration status shows as "Connected"

### 3. Data Synchronization

1. Background service runs every hour
2. Checks all active integrations
3. Fetches new transactions from SumUp API
4. Stores data in `sales_data` and `sales_items` tables
5. Updates analytics and performance metrics

### 4. Dashboard Features

1. **Sales Overview**: Daily charts and revenue metrics
2. **Peak Hours**: Identify busiest times for staffing
3. **Staff Performance**: Sales-based performance tracking
4. **Inventory Insights**: Popular items and trends
5. **Scheduling Integration**: Use sales data for AI scheduling

## API Integration

### SumUp API Endpoints Used

- `GET /v0.1/me` - Get merchant information
- `GET /v0.1/me/locations` - Get merchant locations
- `GET /v0.1/me/transactions` - Get transaction history
- `POST /token` - OAuth token exchange
- `POST /revoke` - Revoke access tokens

### Data Mapping

| SumUp Field | LocalOps Field | Purpose |
|-------------|----------------|---------|
| `timestamp` | `sale_time` | Align with shift blocks |
| `amount` | `sale_value` | Revenue analytics |
| `location_id` | `sumup_location_id` | POS→LocalOps mapping |
| `items[]` | `sales_items` | Inventory insights |

## Testing

### Test Script

Run the test script to verify functionality:

```bash
cd backend
python test_sumup_integration.py
```

### Test Coverage

- Database table creation
- Entitlement checking
- Upgrade prompt generation
- Integration status
- Logging functionality
- Disconnect operations

## Deployment

### Prerequisites

1. SumUp Developer Account
2. OAuth application registered with SumUp
3. Database migration applied
4. Environment variables configured

### Steps

1. **Backend Deployment**:
   ```bash
   cd backend
   pip install -r requirements.txt
   alembic upgrade head
   python main.py
   ```

2. **Frontend Deployment**:
   ```bash
   cd frontend
   npm install
   npm run build
   npm start
   ```

3. **Background Service**:
   ```bash
   # Start the sync scheduler
   python -c "from services.sumup_sync_scheduler import start_sumup_scheduler; asyncio.run(start_sumup_scheduler())"
   ```

## Monitoring

### Integration Logs

Monitor integration health through:
- `GET /api/integrations/sumup/{business_id}/logs`
- Check for sync errors and OAuth issues
- Monitor sync frequency and success rates

### Key Metrics

- **Sync Success Rate**: Percentage of successful syncs
- **Data Freshness**: Time since last successful sync
- **Error Rates**: Failed operations and their causes
- **Usage Metrics**: Number of active integrations

## Troubleshooting

### Common Issues

1. **OAuth Errors**: Check client ID/secret configuration
2. **Token Expiry**: Verify token refresh logic
3. **Sync Failures**: Check SumUp API rate limits
4. **Entitlement Issues**: Verify subscription status

### Debug Commands

```bash
# Check integration status
curl "http://localhost:8001/api/integrations/sumup/1/status"

# View integration logs
curl "http://localhost:8001/api/integrations/sumup/1/logs"

# Manual sync trigger
curl -X POST "http://localhost:8001/api/integrations/sumup/1/sync"
```

## Future Enhancements

1. **Real-time Sync**: Webhook-based real-time updates
2. **Advanced Analytics**: Machine learning insights
3. **Multi-POS Support**: Integration with other POS systems
4. **Inventory Management**: Automated stock level tracking
5. **Customer Analytics**: Customer behavior insights

## Security Considerations

1. **Token Security**: All OAuth tokens encrypted at rest
2. **API Rate Limiting**: Respect SumUp API limits
3. **Data Privacy**: Only sync necessary transaction data
4. **Access Control**: Verify business ownership for all operations
5. **Audit Trail**: Complete logging of all integration operations

## Support

For technical support or questions about the SumUp integration:

1. Check integration logs for error details
2. Verify SumUp API credentials and permissions
3. Ensure subscription is active and paid
4. Contact support with business ID and error logs

---

This implementation provides a complete, production-ready SumUp POS integration that can be deployed as a paid bolt-on feature for LocalOps AI customers. 