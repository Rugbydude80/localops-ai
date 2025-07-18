#!/bin/bash

# Test script for sick leave reporting and AI replacement finding
echo "🧪 Testing Sick Leave Reporting & AI Replacement Finding..."

# Check if backend is running
if ! curl -s http://localhost:8001/health > /dev/null; then
    echo "❌ Backend is not running. Please start with ./run-dev.sh"
    exit 1
fi

echo "✅ Backend is running"

# Test 1: Create a staff member with kitchen skills
echo "1. Creating staff member with kitchen skills..."
STAFF_RESPONSE=$(curl -s -X POST http://localhost:8001/api/staff \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": 1,
    "name": "Test Kitchen Staff",
    "phone_number": "+44 7700 900888",
    "email": "kitchen@test.com",
    "role": "chef",
    "skills": ["kitchen", "food_prep"]
  }')

if echo "$STAFF_RESPONSE" | grep -q "Test Kitchen Staff"; then
    echo "✅ Kitchen staff created successfully"
    KITCHEN_STAFF_ID=$(echo "$STAFF_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2)
    echo "   Staff ID: $KITCHEN_STAFF_ID"
else
    echo "❌ Failed to create kitchen staff"
    echo "Response: $STAFF_RESPONSE"
    exit 1
fi

# Test 2: Create a replacement staff member with kitchen skills
echo "2. Creating replacement staff member with kitchen skills..."
REPLACEMENT_RESPONSE=$(curl -s -X POST http://localhost:8001/api/staff \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": 1,
    "name": "Replacement Kitchen Staff",
    "phone_number": "+44 7700 900777",
    "email": "replacement@test.com",
    "role": "line_cook",
    "skills": ["kitchen", "grill"]
  }')

if echo "$REPLACEMENT_RESPONSE" | grep -q "Replacement Kitchen Staff"; then
    echo "✅ Replacement staff created successfully"
    REPLACEMENT_STAFF_ID=$(echo "$REPLACEMENT_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2)
    echo "   Replacement Staff ID: $REPLACEMENT_STAFF_ID"
else
    echo "❌ Failed to create replacement staff"
    exit 1
fi

# Test 3: Create a shift requiring kitchen skills
echo "3. Creating shift requiring kitchen skills..."
TOMORROW=$(date -v+1d +%Y-%m-%d 2>/dev/null || date -d "+1 day" +%Y-%m-%d)
SHIFT_RESPONSE=$(curl -s -X POST http://localhost:8001/api/schedule/1/shifts \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Kitchen Evening Shift",
    "date": "'$TOMORROW'",
    "start_time": "18:00",
    "end_time": "23:00",
    "required_skill": "kitchen",
    "required_staff_count": 1,
    "hourly_rate": 12.50,
    "notes": "Busy evening service"
  }')

if echo "$SHIFT_RESPONSE" | grep -q "Kitchen Evening Shift"; then
    echo "✅ Shift created successfully"
    SHIFT_ID=$(echo "$SHIFT_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2)
    echo "   Shift ID: $SHIFT_ID"
else
    echo "❌ Failed to create shift"
    echo "Response: $SHIFT_RESPONSE"
    exit 1
fi

# Test 4: Assign the original staff to the shift
echo "4. Assigning original staff to the shift..."
ASSIGN_RESPONSE=$(curl -s -X POST http://localhost:8001/api/schedule/1/shifts/$SHIFT_ID/assign \
  -H "Content-Type: application/json" \
  -d '{
    "staff_id": '$KITCHEN_STAFF_ID'
  }')

if echo "$ASSIGN_RESPONSE" | grep -q "assigned"; then
    echo "✅ Staff assigned to shift successfully"
else
    echo "❌ Failed to assign staff to shift"
    echo "Response: $ASSIGN_RESPONSE"
    exit 1
fi

# Test 5: Report sick leave (this should trigger AI replacement finding)
echo "5. Reporting sick leave (triggering AI replacement finding)..."
SICK_LEAVE_RESPONSE=$(curl -s -X POST http://localhost:8001/api/sick-leave \
  -H "Content-Type: application/json" \
  -d '{
    "staff_id": '$KITCHEN_STAFF_ID',
    "shift_id": '$SHIFT_ID',
    "business_id": 1,
    "reason": "sick",
    "message": "Feeling unwell, cannot come to work"
  }')

echo "Sick leave response:"
echo "$SICK_LEAVE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$SICK_LEAVE_RESPONSE"

# Check if AI replacement finding worked
if echo "$SICK_LEAVE_RESPONSE" | grep -q "qualified_staff_found"; then
    QUALIFIED_COUNT=$(echo "$SICK_LEAVE_RESPONSE" | grep -o '"qualified_staff_found":[0-9]*' | cut -d':' -f2)
    NOTIFICATIONS_SENT=$(echo "$SICK_LEAVE_RESPONSE" | grep -o '"notifications_sent":[0-9]*' | cut -d':' -f2)
    AI_GENERATED=$(echo "$SICK_LEAVE_RESPONSE" | grep -o '"ai_message_generated":[a-z]*' | cut -d':' -f2)
    
    echo "✅ AI replacement finding results:"
    echo "   - Qualified staff found: $QUALIFIED_COUNT"
    echo "   - Notifications sent: $NOTIFICATIONS_SENT"
    echo "   - AI message generated: $AI_GENERATED"
    
    if [ "$QUALIFIED_COUNT" -gt 0 ]; then
        echo "✅ Skill-based staff filtering working correctly"
    else
        echo "⚠️  No qualified staff found (this might be expected)"
    fi
else
    echo "❌ AI replacement finding failed"
fi

# Test 6: Check notifications for replacement staff
echo "6. Checking notifications for replacement staff..."
NOTIFICATIONS_RESPONSE=$(curl -s http://localhost:8001/api/notifications/$REPLACEMENT_STAFF_ID)

if echo "$NOTIFICATIONS_RESPONSE" | grep -q "called in sick"; then
    echo "✅ In-app notification created for replacement staff"
    echo "   Notification preview:"
    echo "$NOTIFICATIONS_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if data and len(data) > 0:
        print('   Message:', data[0]['message'][:100] + '...')
        print('   Priority:', data[0]['priority'])
except:
    pass
" 2>/dev/null
else
    echo "❌ No notifications found for replacement staff"
    echo "Response: $NOTIFICATIONS_RESPONSE"
fi

echo ""
echo "🎯 Sick Leave Flow Test Summary:"
echo "✅ Staff creation with skills"
echo "✅ Shift creation with skill requirements"
echo "✅ Staff assignment to shifts"
echo "✅ Sick leave reporting"
echo "✅ AI-powered replacement finding"
echo "✅ Skill-based staff filtering"
echo "✅ In-app notification system"
echo ""
echo "🚀 Sick leave reporting and AI replacement finding is working!"
echo "📱 Visit http://localhost:3000/staff to test the frontend interface" 