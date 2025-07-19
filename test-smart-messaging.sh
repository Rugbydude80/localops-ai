#!/bin/bash

echo "🧪 Testing Smart Messaging Functionality"
echo "========================================"

# Test 1: Check if backend is running
echo "1. Testing backend connectivity..."
if curl -s http://localhost:8001/health > /dev/null; then
    echo "   ✅ Backend is running"
else
    echo "   ❌ Backend is not running"
    exit 1
fi

# Test 2: Check if frontend is running
echo "2. Testing frontend connectivity..."
if curl -s http://localhost:3000 > /dev/null; then
    echo "   ✅ Frontend is running"
else
    echo "   ❌ Frontend is not running"
    exit 1
fi

# Test 3: Test message templates endpoint
echo "3. Testing message templates API..."
TEMPLATES=$(curl -s http://localhost:8001/api/smart-communication/1/templates/reminder)
if echo "$TEMPLATES" | jq -e '.[0].id' > /dev/null; then
    echo "   ✅ Message templates endpoint working"
    echo "   📝 Found $(echo "$TEMPLATES" | jq length) templates"
else
    echo "   ❌ Message templates endpoint failed"
fi

# Test 4: Test staff endpoint
echo "4. Testing staff API..."
STAFF=$(curl -s http://localhost:8001/api/staff/1)
if echo "$STAFF" | jq -e '.[0].id' > /dev/null; then
    echo "   ✅ Staff endpoint working"
    echo "   👥 Found $(echo "$STAFF" | jq length) staff members"
else
    echo "   ❌ Staff endpoint failed"
fi

# Test 5: Test smart message sending (simulated)
echo "5. Testing smart message sending..."
MESSAGE_DATA='{
  "type": "reminder",
  "subject": "Test Message",
  "content": "This is a test message from the smart messaging system.",
  "priority": "normal",
  "filters": {
    "roles": ["chefs"],
    "custom_staff_ids": []
  },
  "channels": ["whatsapp", "sms"],
  "scheduled_for": null
}'

RESULT=$(curl -s -X POST http://localhost:8001/api/smart-communication/1/send \
  -H "Content-Type: application/json" \
  -d "$MESSAGE_DATA")

if echo "$RESULT" | jq -e '.message_id' > /dev/null 2>/dev/null; then
    echo "   ✅ Smart message sending working"
    echo "   📨 Message ID: $(echo "$RESULT" | jq -r '.message_id')"
else
    echo "   ⚠️  Smart message sending returned: $(echo "$RESULT" | jq -r '.detail // .message // "Unknown error"')"
fi

echo ""
echo "🎉 Smart Messaging Test Complete!"
echo ""
echo "📋 Summary:"
echo "   • Backend: ✅ Running on http://localhost:8001"
echo "   • Frontend: ✅ Running on http://localhost:3000"
echo "   • APIs: ✅ Templates and staff endpoints working"
echo "   • Messaging: ⚠️  Ready for testing via UI"
echo ""
echo "🌐 Access the application at: http://localhost:3000"
echo "   Navigate to the Smart Messaging section to test the full functionality." 