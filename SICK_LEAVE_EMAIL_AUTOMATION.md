# Automated Sick Leave Email Notification System

## Overview

The LocalOps AI platform now includes a fully automated sick leave notification system that automatically sends emails to available staff members with matching skills when someone calls in sick. This system ensures quick shift coverage and minimizes operational disruption.

## How It Works

### 1. Sick Leave Reporting
When a staff member reports sick leave:
- The system identifies the affected shift and required skills
- Automatically finds all available staff with matching skills
- Sends personalized email notifications to qualified staff
- Creates in-app notifications for real-time updates
- Notifies managers for oversight

### 2. Smart Staff Filtering
The system intelligently filters staff based on:
- **Skill Matching**: Only staff with the required skills receive notifications
- **Availability**: Excludes staff already assigned to overlapping shifts
- **Active Status**: Only considers active staff members
- **Reliability Score**: Prioritizes staff with higher reliability scores

### 3. Automated Email Notifications
Each qualified staff member receives a detailed email containing:
- **Urgent subject line** with shift details
- **Personalized greeting** with staff name
- **Complete shift information** (date, time, position, location)
- **Sick leave details** (who called in and why)
- **Staff qualifications** (skills and reliability score)
- **Clear response options** (YES/NO/MAYBE)
- **Professional formatting** with restaurant branding

## Email Template Example

```
Subject: URGENT: Kitchen Shift Coverage Needed - Monday, July 22

Dear John Smith,

URGENT: Chef Sarah called in food poisoning for Evening Kitchen Shift on Monday, July 22 from 17:00 to 23:00. Can you cover this kitchen shift? Please respond ASAP.

SHIFT DETAILS:
- Position: Kitchen
- Date: Monday, July 22, 2024
- Time: 17:00 - 23:00
- Location: Restaurant

SICK LEAVE DETAILS:
- Staff Member: Chef Sarah
- Reason: food poisoning

YOUR QUALIFICATIONS:
- Skills: kitchen, grill, food_prep
- Reliability Score: 8.9/10

RESPONSE OPTIONS:
1. Accept the shift (reply with "YES")
2. Decline the shift (reply with "NO")
3. Need more information (reply with "MAYBE")

Please respond as soon as possible. This is an urgent request.

Best regards,
Restaurant Management
```

## Technical Implementation

### Backend Components

#### 1. AppNotificationService (`backend/services/app_notification_service.py`)
- **`handle_sick_leave_notification()`**: Main orchestrator for sick leave processing
- **`_find_qualified_replacement_staff()`**: Identifies available staff with matching skills
- **`_is_staff_available()`**: Checks for schedule conflicts
- **`_send_sick_leave_email()`**: Sends personalized email notifications
- **`_generate_replacement_message()`**: Creates AI-powered message content

#### 2. EmailService (`backend/services/smart_communication.py`)
- **`send_email()`**: Handles email delivery via SMTP
- **Template formatting**: Professional HTML email templates
- **Delivery tracking**: Logs email delivery status
- **Error handling**: Graceful fallback for email failures

#### 3. API Endpoints (`backend/main.py`)
- **`POST /api/sick-leave`**: Reports sick leave and triggers automation
- **`GET /api/notifications/{staff_id}`**: Retrieves staff notifications
- **`POST /api/notifications/{notification_id}/respond`**: Handles staff responses

### Database Schema

#### MessageLog Table
```sql
CREATE TABLE message_logs (
    id SERIAL PRIMARY KEY,
    business_id INTEGER REFERENCES businesses(id),
    staff_id INTEGER REFERENCES staff(id),
    message_type VARCHAR(50), -- 'sick_leave_email', 'sick_leave_replacement'
    platform VARCHAR(20), -- 'email', 'app_notification'
    phone_number VARCHAR(50),
    message_content TEXT,
    status VARCHAR(20), -- 'sent', 'failed', 'delivered'
    priority VARCHAR(20), -- 'low', 'normal', 'high', 'urgent'
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    sent_at TIMESTAMP,
    read_at TIMESTAMP
);
```

#### SickLeaveRequest Table
```sql
CREATE TABLE sick_leave_requests (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER REFERENCES staff(id),
    shift_id INTEGER REFERENCES shifts(id),
    business_id INTEGER REFERENCES businesses(id),
    reason VARCHAR(50) DEFAULT 'sick',
    message TEXT,
    reported_at TIMESTAMP DEFAULT NOW(),
    replacement_found BOOLEAN DEFAULT false,
    replacement_staff_id INTEGER REFERENCES staff(id)
);
```

## Features

### 🎯 Smart Filtering
- **Skill-based targeting**: Only staff with required skills receive emails
- **Availability checking**: Excludes staff with conflicting shifts
- **Reliability scoring**: Prioritizes more reliable staff members
- **Active status filtering**: Only considers active staff

### 📧 Professional Email Notifications
- **Personalized content**: Staff names and qualifications included
- **Detailed shift information**: Complete shift details in each email
- **Clear call-to-action**: Simple YES/NO/MAYBE response options
- **Professional formatting**: Restaurant-branded email templates
- **Urgent subject lines**: Clear indication of urgency

### 🔄 Automated Response Handling
- **Response tracking**: Logs staff responses to notifications
- **Shift assignment**: Automatically assigns shifts when accepted
- **Manager notifications**: Alerts managers when replacements are found
- **Status updates**: Updates sick leave request status

### 📊 Comprehensive Logging
- **Email delivery tracking**: Records success/failure of each email
- **Response logging**: Tracks staff responses and timing
- **Metadata storage**: Stores shift details, skills, and context
- **Analytics support**: Enables reporting on notification effectiveness

## Configuration

### Email Settings
Configure email delivery in environment variables:
```bash
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=notifications@restaurant.com
```

### Staff Skills Configuration
Staff skills are stored as arrays in the database:
```json
{
  "skills": ["kitchen", "grill", "food_prep"],
  "role": "line_cook",
  "reliability_score": 8.9
}
```

### Shift Requirements
Shifts specify required skills:
```json
{
  "title": "Evening Kitchen Shift",
  "required_skill": "kitchen",
  "start_time": "17:00",
  "end_time": "23:00"
}
```

## Usage Examples

### 1. Report Sick Leave (Triggers Automation)
```bash
curl -X POST http://localhost:8001/api/sick-leave \
  -H "Content-Type: application/json" \
  -d '{
    "staff_id": 123,
    "shift_id": 456,
    "business_id": 1,
    "reason": "food poisoning",
    "message": "Cannot work due to food poisoning symptoms"
  }'
```

### 2. Check Staff Notifications
```bash
curl http://localhost:8001/api/notifications/789
```

### 3. Respond to Email Notification
```bash
curl -X POST http://localhost:8001/api/notifications/999/respond \
  -H "Content-Type: application/json" \
  -d '{
    "staff_id": 789,
    "response": "accept",
    "message": "I can cover this shift"
  }'
```

## Testing

### Automated Test Script
Run the comprehensive test script:
```bash
./test-sick-leave-email-automation.sh
```

This script:
1. Creates staff members with different skills
2. Creates a shift requiring specific skills
3. Assigns a staff member to the shift
4. Reports sick leave (triggers automation)
5. Verifies email notifications were sent
6. Checks skill-based filtering
7. Simulates staff response

### Manual Testing
1. **Create staff** with different skills (kitchen, front_of_house, etc.)
2. **Create a shift** with specific skill requirements
3. **Assign staff** to the shift
4. **Report sick leave** via API or UI
5. **Check email notifications** in the database
6. **Verify skill filtering** (only qualified staff received emails)

## Benefits

### For Restaurant Managers
- **Immediate coverage**: Automated notifications sent instantly
- **Skill matching**: Only qualified staff receive requests
- **Reduced workload**: No manual phone calls or text messages
- **Better tracking**: Complete audit trail of notifications and responses
- **Faster resolution**: Quick staff responses via email

### For Staff Members
- **Clear communication**: Detailed shift information in emails
- **Easy response**: Simple YES/NO/MAYBE options
- **Professional format**: Well-formatted, branded emails
- **Skill recognition**: System recognizes their qualifications
- **Fair distribution**: Based on reliability and availability

### For Operations
- **Reduced downtime**: Faster shift coverage
- **Better planning**: Complete visibility into coverage status
- **Data insights**: Analytics on notification effectiveness
- **Compliance**: Proper documentation of sick leave and coverage
- **Scalability**: Works for any number of staff and shifts

## Future Enhancements

### Planned Features
- **SMS notifications**: Backup SMS for urgent requests
- **WhatsApp integration**: Direct WhatsApp messaging
- **Response time tracking**: Analytics on response times
- **Automated escalation**: Manager notifications if no response
- **Shift swapping**: Allow staff to propose swaps
- **Mobile app notifications**: Push notifications to mobile app

### Advanced Features
- **AI-powered scheduling**: Automatic shift assignment based on responses
- **Predictive analytics**: Identify likely coverage needs
- **Staff preferences**: Respect staff communication preferences
- **Multi-language support**: Support for international staff
- **Integration with payroll**: Automatic overtime calculations

## Troubleshooting

### Common Issues
1. **No emails sent**: Check SMTP configuration
2. **Wrong staff notified**: Verify staff skills and availability
3. **Email delivery failures**: Check email server logs
4. **Response not processed**: Verify notification ID and staff ID

### Debug Steps
1. Check application logs for email delivery status
2. Verify staff skills match shift requirements
3. Confirm staff availability (no conflicting shifts)
4. Test SMTP configuration independently
5. Check database for notification records

---

*This automated sick leave email notification system is part of the LocalOps AI restaurant operations platform, designed to streamline staff communication and ensure optimal shift coverage.* 