#!/bin/bash

# LocalOps AI - Supabase Production Setup Script
# This script sets up LocalOps AI with Supabase for production use

set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print functions
print_status() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_header() {
    echo -e "${PURPLE}🚀 $1${NC}"
}

print_header "LocalOps AI - Supabase Production Setup"
echo "This script will set up LocalOps AI with Supabase for production use"
echo ""

# Check if required tools are installed
print_status "Checking prerequisites..."

if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is not installed. Please install Python 3 first."
    exit 1
fi

if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

print_success "Prerequisites check passed!"

# 1. Backend Setup
print_header "Setting up Backend with Supabase..."

cd backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    print_status "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
print_status "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
print_status "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Install additional Supabase dependencies
print_status "Installing Supabase dependencies..."
pip install supabase psycopg2-binary

print_success "Backend dependencies installed!"

# 2. Frontend Setup
print_header "Setting up Frontend..."

cd ../frontend

# Install dependencies
print_status "Installing Node.js dependencies..."
npm install

# Install Supabase client
print_status "Installing Supabase client..."
npm install @supabase/supabase-js

print_success "Frontend dependencies installed!"

# 3. Environment Configuration
print_header "Configuring Environment Variables..."

cd ..

# Create frontend .env.local with Supabase configuration
print_status "Creating frontend environment configuration..."
cat > frontend/.env.local << EOF
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://cpydmwtnyiygoarzxuub.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNweWRtd3RueWl5Z29hcnp4dXViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3NTU0NTIsImV4cCI6MjA2ODMzMTQ1Mn0.FXf_FFMaAQDdTfQKtSZiEMyFD3U3F3q4u1gpzg18R-M

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8001
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Feature Flags
NEXT_PUBLIC_ENABLE_AUTH=true
NEXT_PUBLIC_ENABLE_REAL_TIME=true
NEXT_PUBLIC_ENABLE_ANALYTICS=true
EOF

print_success "Environment configuration created!"

# 4. Database Setup Instructions
print_header "Database Setup Instructions"
echo ""
echo "📋 Next steps to complete Supabase setup:"
echo ""
echo "1. 🗄️  Set up your Supabase database:"
echo "   - Go to: https://cpydmwtnyiygoarzxuub.supabase.co"
echo "   - Click 'SQL Editor' in the sidebar"
echo "   - Copy and paste the contents of 'supabase-setup.sql'"
echo "   - Click 'Run' to create tables and sample data"
echo ""
echo "2. 🔐 Configure Row Level Security (RLS):"
echo "   - In Supabase Dashboard, go to 'Authentication' > 'Policies'"
echo "   - Enable RLS on tables that need it"
echo "   - Create appropriate policies for your use case"
echo ""
echo "3. 🚀 Start the application:"
echo "   - Backend: cd backend && source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8001 --reload"
echo "   - Frontend: cd frontend && npm run dev"
echo ""
echo "4. 🌐 Access your application:"
echo "   - Frontend: http://localhost:3000"
echo "   - Backend API: http://localhost:8001"
echo "   - API Docs: http://localhost:8001/docs"
echo "   - Supabase Dashboard: https://cpydmwtnyiygoarzxuub.supabase.co"
echo ""

# 5. Create startup scripts
print_header "Creating startup scripts..."

# Create production startup script
cat > start-supabase.sh << 'EOF'
#!/bin/bash

echo "🚀 Starting LocalOps AI with Supabase..."

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

echo "✅ LocalOps AI is starting up!"
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:8001"
echo "📚 API Docs: http://localhost:8001/docs"
echo "🗄️  Supabase: https://cpydmwtnyiygoarzxuub.supabase.co"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for user to stop
wait

# Cleanup
kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
echo "🛑 Servers stopped"
EOF

chmod +x start-supabase.sh

# Create health check script
cat > health-check-supabase.sh << 'EOF'
#!/bin/bash

echo "🏥 Health Check for LocalOps AI with Supabase"

# Check backend
echo "🔧 Checking backend..."
if curl -s http://localhost:8001/health > /dev/null; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend is not responding"
fi

# Check frontend
echo "⚛️  Checking frontend..."
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Frontend is healthy"
else
    echo "❌ Frontend is not responding"
fi

# Check Supabase connection
echo "🗄️  Checking Supabase connection..."
cd backend
source venv/bin/activate
python3 -c "
import os
from dotenv import load_dotenv
load_dotenv()
from supabase import create_client, Client

try:
    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_ANON_KEY')
    supabase: Client = create_client(url, key)
    
    # Test connection by querying a table
    response = supabase.table('businesses').select('*').limit(1).execute()
    print('✅ Supabase connection successful')
except Exception as e:
    print(f'❌ Supabase connection failed: {e}')
"
EOF

chmod +x health-check-supabase.sh

print_success "Startup scripts created!"

# 6. Create Supabase client configuration
print_header "Creating Supabase client configuration..."

# Create backend Supabase client
cat > backend/supabase_client.py << 'EOF'
"""
Supabase client configuration for LocalOps AI
"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Supabase configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# Create Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

# Create service role client for admin operations
supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

def get_supabase_client() -> Client:
    """Get the default Supabase client"""
    return supabase

def get_supabase_admin_client() -> Client:
    """Get the Supabase admin client with service role"""
    return supabase_admin
EOF

# Create frontend Supabase client
cat > frontend/src/lib/supabase.ts << 'EOF'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types (you can generate these from Supabase)
export interface Database {
  public: {
    Tables: {
      businesses: {
        Row: {
          id: number
          name: string
          type: string | null
          phone_number: string | null
          email: string | null
          address: string | null
          owner_name: string | null
          subscription_tier: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: number
          name: string
          type?: string | null
          phone_number?: string | null
          email?: string | null
          address?: string | null
          owner_name?: string | null
          subscription_tier?: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: number
          name?: string
          type?: string | null
          phone_number?: string | null
          email?: string | null
          address?: string | null
          owner_name?: string | null
          subscription_tier?: string
          is_active?: boolean
          created_at?: string
        }
      }
      staff: {
        Row: {
          id: number
          business_id: number
          name: string
          phone_number: string
          email: string | null
          role: string
          skills: any
          availability: any
          reliability_score: number
          is_active: boolean
          hired_date: string
          last_shift_date: string | null
        }
        Insert: {
          id?: number
          business_id: number
          name: string
          phone_number: string
          email?: string | null
          role: string
          skills?: any
          availability?: any
          reliability_score?: number
          is_active?: boolean
          hired_date?: string
          last_shift_date?: string | null
        }
        Update: {
          id?: number
          business_id?: number
          name?: string
          phone_number?: string
          email?: string | null
          role?: string
          skills?: any
          availability?: any
          reliability_score?: number
          is_active?: boolean
          hired_date?: string
          last_shift_date?: string | null
        }
      }
    }
  }
}
EOF

print_success "Supabase client configuration created!"

# 7. Final instructions
print_header "Setup Complete!"
echo ""
print_success "LocalOps AI has been configured for Supabase!"
echo ""
echo "📋 Next steps:"
echo ""
echo "1. 🗄️  Set up your database:"
echo "   - Run the SQL in supabase-setup.sql in your Supabase SQL Editor"
echo ""
echo "2. 🚀 Start the application:"
echo "   - Run: ./start-supabase.sh"
echo ""
echo "3. 🏥 Check health:"
echo "   - Run: ./health-check-supabase.sh"
echo ""
echo "4. 📊 Monitor in Supabase:"
echo "   - Dashboard: https://cpydmwtnyiygoarzxuub.supabase.co"
echo "   - Table Editor: https://cpydmwtnyiygoarzxuub.supabase.co/table-editor"
echo "   - SQL Editor: https://cpydmwtnyiygoarzxuub.supabase.co/sql-editor"
echo ""
echo "🎉 Your LocalOps AI application is ready for production with Supabase!" 