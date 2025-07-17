#!/bin/bash

echo "🚀 Setting up LocalOps AI with Supabase..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Install frontend dependencies
echo "📦 Installing dependencies..."
cd frontend
npm install

echo ""
echo "✅ Dependencies installed!"
echo ""
echo "🗄️ Next: Set up your Supabase database"
echo "   1. Go to: https://qxemvzyrzddwsnzttdrv.supabase.co"
echo "   2. Click 'SQL Editor' in the sidebar"
echo "   3. Copy and paste the contents of 'supabase-setup.sql'"
echo "   4. Click 'Run' to create tables and sample data"
echo ""
echo "🌐 Then start the application:"
echo "   npm run dev"
echo ""
echo "   Visit: http://localhost:3000"
echo ""
echo "📊 View your data in Supabase Table Editor"