#!/bin/bash

echo "🚀 Starting LocalOps AI with Supabase..."

# Kill any existing servers
echo "🛑 Stopping existing servers..."
pkill -f "uvicorn main:app" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true

# Start backend
echo "🔧 Starting backend server..."
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8001 --reload &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start frontend
echo "⚛️  Starting frontend server..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ LocalOps AI is starting up!"
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:8001"
echo "📚 API Docs: http://localhost:8001/docs"
echo "🗄️  Supabase: https://cpydmwtnyiygoarzxuub.supabase.co"
echo ""
echo "🧪 Test the setup:"
echo "   curl -X GET 'http://localhost:8001/api/staff/1'"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for user to stop
wait

# Cleanup
kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
echo "�� Servers stopped" 