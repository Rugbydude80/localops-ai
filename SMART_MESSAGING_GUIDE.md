# Smart Messaging Feature Guide

## Overview

The Smart Messaging feature allows restaurant managers to send intelligent, targeted messages to staff members with AI-powered optimization. This feature supports multiple message types, recipient filtering, and delivery channels.

## Features

### 🎯 Message Types
- **Reminder**: General reminders and announcements
- **Urgent Cover Request**: Emergency shift coverage needed
- **Shift Change**: Schedule modifications and updates
- **Training**: Training announcements and updates
- **Announcement**: General business announcements

### 👥 Recipient Selection
- **All Staff**: Send to everyone
- **Kitchen Staff**: Chefs, cooks, prep staff
- **Front of House**: Servers, hosts, bartenders
- **Management**: Managers and supervisors
- **Part-time Staff**: Part-time employees
- **Full-time Staff**: Full-time employees
- **Individual Staff**: Select specific staff members

### 📱 Delivery Channels
- **WhatsApp**: Primary channel for most messages
- **SMS**: Backup channel for urgent messages
- **Email**: For detailed communications

### ⚡ Priority Levels
- **Low**: Non-urgent communications
- **Normal**: Standard messages
- **High**: Important announcements
- **Urgent**: Critical communications

## How to Use

### 1. Access Smart Messaging
1. Navigate to the LocalOps AI dashboard
2. Click on the "Smart Messaging" module
3. Click "Send Smart Message" button

### 2. Step 1: Select Message Type
- Choose from 5 different message types
- Each type has different templates and optimization strategies
- Icons and colors help identify message urgency

### 3. Step 2: Select Recipients
- Choose recipient groups (e.g., "Kitchen Staff", "Front of House")
- Select individual staff members if needed
- View real-time count of selected recipients
- Preview which staff members will receive the message

### 4. Step 3: Compose Message
- Use pre-built templates or write custom messages
- Add optional subject line
- Set message priority
- Review recipient list before sending

### 5. Send Message
- Click "Send Message" to deliver
- Messages are sent immediately via WhatsApp and SMS
- Receive confirmation with delivery count

## Message Templates

### Reminder Template
```
Hi {name}, this is a friendly reminder about your upcoming shift on {date} at {time}.
```

### Urgent Cover Request Template
```
URGENT: We need {role} coverage for {date} {time}. Can you help? Please respond ASAP.
```

### Training Announcement Template
```
New training module available: {module_name}. Please complete by {deadline}.
```

### General Announcement Template
```
Important announcement: {message}. Please read and acknowledge.
```

## AI Optimization

The system automatically:
- **Optimizes delivery timing** based on staff availability
- **Chooses best channels** based on staff preferences
- **Personalizes messages** using staff names and roles
- **Schedules follow-ups** for unread messages
- **Tracks delivery success** and response rates

## Analytics

Track messaging performance with:
- **Total messages sent**
- **Delivery success rates**
- **Response times**
- **Channel performance**
- **Staff engagement metrics**

## Technical Details

### API Endpoints
- `GET /api/smart-communication/{business_id}/templates/{message_type}` - Get message templates
- `POST /api/smart-communication/{business_id}/send` - Send smart message
- `GET /api/smart-communication/{business_id}/analytics` - Get communication analytics

### Database Tables
- `smart_messages` - Stores message records
- `message_deliveries` - Tracks delivery status
- `staff` - Recipient information

### Integration
- **WhatsApp Business API** for primary messaging
- **SMS Gateway** for backup delivery
- **Email Service** for detailed communications

## Best Practices

### Message Composition
- Keep messages concise and clear
- Use appropriate priority levels
- Include specific details (dates, times, locations)
- Be professional but friendly

### Recipient Selection
- Use groups for general announcements
- Select individuals for specific requests
- Consider staff roles and skills
- Respect staff availability

### Timing
- Send urgent messages immediately
- Schedule reminders in advance
- Avoid sending during off-hours
- Use follow-ups for important messages

## Troubleshooting

### Common Issues
1. **Message not delivered**: Check staff phone numbers
2. **Wrong recipients**: Verify recipient selection
3. **Template not loading**: Refresh the page
4. **Send button disabled**: Ensure message content and recipients are selected

### Support
- Check the system status page
- Review delivery logs
- Contact support for persistent issues

## Future Enhancements

Planned features include:
- **Scheduled messaging** for future delivery
- **Message templates** with custom variables
- **Advanced analytics** with response tracking
- **Multi-language support** for international staff
- **Integration with scheduling system** for automatic reminders

---

*This feature is part of the LocalOps AI restaurant operations platform, designed to streamline staff communication and improve operational efficiency.* 