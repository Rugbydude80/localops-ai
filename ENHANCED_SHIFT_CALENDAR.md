# Enhanced Shift Calendar System

## Overview

The Enhanced Shift Calendar is a comprehensive restaurant staff scheduling solution that combines AI-powered scheduling with manual override capabilities. It provides a visual calendar interface for managing shifts, staff assignments, and scheduling constraints.

## Features

### 🎯 Core Features

1. **AI-Powered Scheduling**
   - Intelligent staff assignment based on skills, availability, and business constraints
   - Confidence scoring for each assignment
   - Fallback to rule-based scheduling when AI is unavailable
   - Historical performance analysis

2. **Manual Override Capabilities**
   - Drag-and-drop staff assignment
   - Manual assignment/unassignment with override indicators
   - Real-time validation of scheduling constraints
   - Undo/redo functionality for changes

3. **Enhanced Calendar View**
   - Week-based calendar layout
   - Visual coverage indicators (green/amber/red)
   - Staff skill icons and status indicators
   - AI confidence indicators
   - Coverage percentage bars

4. **Staff Management**
   - Detailed staff profiles with skills and availability
   - Reliability scoring
   - Hourly rates and role information
   - Availability tracking

### 📊 Dashboard Features

1. **Summary Statistics**
   - Total shifts and staff coverage percentage
   - Understaffed shift count
   - AI-generated shift count
   - Current week date range

2. **Real-time Updates**
   - Live collaboration indicators
   - Conflict resolution
   - User presence tracking

3. **Business Intelligence**
   - Labor cost optimization
   - Staff utilization metrics
   - Coverage rate analysis

## Architecture

### Frontend Components

1. **EnhancedShiftCalendar.tsx**
   - Main calendar component with drag-and-drop functionality
   - Staff assignment and unassignment
   - Visual indicators for AI vs manual assignments
   - Coverage status display

2. **EnhancedShiftsPage.tsx**
   - Page wrapper with summary statistics
   - Modal management for shift creation and staff assignment
   - API integration for data management

3. **AutoScheduleModal.tsx**
   - AI scheduling configuration
   - Special events and staff notes
   - Constraint management
   - Notification preferences

### Backend Services

1. **AISchedulingEngine**
   - OpenAI integration for intelligent scheduling
   - Constraint solving with fallback mechanisms
   - Historical data analysis
   - Confidence scoring

2. **ConstraintSolver**
   - Business rule enforcement
   - Staff availability validation
   - Fair distribution algorithms
   - Labor cost optimization

3. **Database Models**
   - Staff, Shift, ShiftAssignment tables
   - ScheduleDraft and DraftShiftAssignment for AI-generated schedules
   - SchedulingConstraint and StaffPreference for business rules

## Setup Instructions

### 1. Environment Configuration

Create a `.env.local` file in the frontend directory:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8001
NEXT_PUBLIC_APP_URL=http://localhost:3000

# OpenAI Configuration
NEXT_PUBLIC_OPENAI_API_KEY=your_openai_key

# Feature Flags
NEXT_PUBLIC_ENABLE_AUTH=true
NEXT_PUBLIC_ENABLE_REAL_TIME=true
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_AI_FEATURES=true
```

### 2. Database Setup

Run the database migrations to create the required tables:

```bash
cd backend
python3 -m alembic upgrade head
```

### 3. Demo Data Setup

Run the enhanced restaurant data setup script:

```bash
cd frontend
npm install dotenv
node scripts/enhanced-restaurant-data.js
```

This will create:
- A demo restaurant business
- 12 staff members with realistic roles and availability
- 4 weeks of standard restaurant shifts
- Business constraints and staff preferences
- Initial shift assignments

### 4. Backend Server

Start the FastAPI backend server:

```bash
cd backend
python3 main.py
```

### 5. Frontend Development Server

Start the Next.js development server:

```bash
cd frontend
npm run dev
```

## Usage Guide

### Accessing the Enhanced Calendar

Navigate to `http://localhost:3000/enhanced-shifts` to access the enhanced shift calendar.

### Creating Shifts

1. Click the "Create Shift" button
2. Fill in the shift details:
   - Title (e.g., "Morning Kitchen", "Dinner Service")
   - Date and time range
   - Required skill (kitchen, front_of_house, bar, management)
   - Number of staff needed
   - Hourly rate
   - Notes

### AI Scheduling

1. Click the "AI Schedule" button
2. Configure the scheduling parameters:
   - Date range for scheduling
   - Special events (holidays, busy periods)
   - Staff notes (unavailability, preferences)
   - Business constraints
   - Notification preferences
3. Click "Generate Schedule" to create AI-powered assignments

### Manual Staff Assignment

1. **Drag and Drop**: Drag available staff from the left panel to shift cells
2. **Manual Override**: Click the override button to manually assign/unassign staff
3. **Visual Feedback**: 
   - Blue ring = AI-generated assignment
   - Purple ring = Manual override
   - Green = Confirmed assignment
   - Red = Called in sick

### Calendar Navigation

- Use the arrow buttons to navigate between weeks
- Click "Today" to return to the current week
- The calendar shows the current week by default

### Staff Management

The left panel shows available staff with:
- Name and role
- Skills (with icons)
- Hourly rate
- Reliability score
- Availability status

### Coverage Monitoring

Each shift cell displays:
- Coverage percentage bar
- Staff count (assigned/required)
- Visual status indicators:
  - Green = Fully staffed
  - Amber = Partially staffed (70%+)
  - Red = Understaffed (<70%)

## API Endpoints

### Shift Management

- `GET /api/schedule/{business_id}/shifts` - Get shifts for date range
- `POST /api/schedule/{business_id}/shifts` - Create new shift
- `PUT /api/schedule/{business_id}/shifts/{shift_id}` - Update shift
- `DELETE /api/schedule/{business_id}/shifts/{shift_id}` - Delete shift

### Staff Assignment

- `POST /api/schedule/{business_id}/shifts/{shift_id}/assign` - Assign staff to shift
- `DELETE /api/schedule/{business_id}/assignments/{assignment_id}` - Unassign staff

### AI Scheduling

- `POST /api/auto-schedule/{business_id}/generate` - Generate AI schedule
- `GET /api/auto-schedule/{business_id}/draft/{draft_id}` - Get draft schedule
- `PUT /api/auto-schedule/{business_id}/draft/{draft_id}` - Update draft schedule

### Staff Management

- `GET /api/staff/{business_id}` - Get all staff
- `POST /api/staff` - Create new staff member
- `PUT /api/staff/{staff_id}` - Update staff member
- `DELETE /api/staff/{staff_id}` - Delete staff member

## Data Models

### Staff
```typescript
interface Staff {
  id: number
  name: string
  skills: string[]
  hourly_rate?: number
  is_available?: boolean
  reliability_score?: number
  role?: string
  availability?: Record<string, string[]>
}
```

### Shift
```typescript
interface Shift {
  id: number
  title: string
  date: string
  start_time: string
  end_time: string
  required_skill: string
  required_staff_count: number
  hourly_rate?: number
  status: 'open' | 'filled' | 'understaffed' | 'scheduled'
  assignments: ShiftAssignment[]
  confidence_score?: number
  ai_generated?: boolean
  notes?: string
}
```

### ShiftAssignment
```typescript
interface ShiftAssignment {
  id: number
  staff_id: number
  staff_name: string
  status: 'assigned' | 'called_in_sick' | 'no_show' | 'confirmed'
  confidence_score?: number
  reasoning?: string
  is_ai_generated?: boolean
  manual_override?: boolean
}
```

## Business Rules

### Scheduling Constraints

1. **Skill Matching**: Staff must have the required skills for the shift
2. **Availability**: Staff must be available during shift times
3. **Maximum Hours**: Staff cannot exceed weekly/daily hour limits
4. **Minimum Rest**: Required rest periods between shifts
5. **Fair Distribution**: Equal distribution of shifts among qualified staff
6. **Labor Cost**: Optimize for cost while maintaining quality

### AI Scheduling Logic

1. **Historical Analysis**: Consider past performance and reliability
2. **Staff Preferences**: Respect availability and preference settings
3. **Business Constraints**: Enforce all business rules
4. **Coverage Optimization**: Ensure adequate staffing levels
5. **Cost Efficiency**: Balance quality with labor costs

## Troubleshooting

### Common Issues

1. **Invalid Supabase Credentials**
   - Verify your Supabase URL and API keys
   - Ensure the service role key has proper permissions

2. **AI Scheduling Fails**
   - Check OpenAI API key configuration
   - Verify backend server is running
   - Check network connectivity

3. **Staff Not Available**
   - Verify staff availability settings
   - Check for conflicting assignments
   - Ensure staff have required skills

4. **Calendar Not Loading**
   - Check browser console for errors
   - Verify API endpoints are accessible
   - Ensure database is properly configured

### Performance Optimization

1. **Large Datasets**: Use pagination for staff and shift lists
2. **Real-time Updates**: Implement WebSocket connections for live updates
3. **Caching**: Cache frequently accessed data
4. **Database Indexing**: Index foreign keys and date fields

## Future Enhancements

### Planned Features

1. **Mobile App**: Native mobile application for staff
2. **Advanced Analytics**: Predictive scheduling and trend analysis
3. **Integration**: Connect with payroll and time tracking systems
4. **Notifications**: Push notifications for schedule changes
5. **Multi-location**: Support for multiple restaurant locations

### Technical Improvements

1. **Performance**: Optimize database queries and frontend rendering
2. **Scalability**: Support for larger staff and shift volumes
3. **Security**: Enhanced authentication and authorization
4. **Testing**: Comprehensive test coverage
5. **Documentation**: API documentation and user guides

## Support

For technical support or feature requests, please refer to the project documentation or contact the development team.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 