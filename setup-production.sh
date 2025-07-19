#!/bin/bash

# LocalOps AI Production Setup Script
# This script sets up a production-ready LocalOps AI system with authentication, roles, and all features

set -e

echo "🚀 Setting up LocalOps AI Production System"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "README.md" ]; then
    print_error "Please run this script from the LocalOps AI root directory"
    exit 1
fi

print_status "Starting production setup..."

# 1. Backend Setup
print_status "Setting up backend..."
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

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    print_status "Creating .env file..."
    cat > .env << EOF
# Database Configuration
DATABASE_URL=sqlite:///./localops_ai.db

# JWT Configuration
JWT_SECRET_KEY=$(openssl rand -hex 32)
ACCESS_TOKEN_EXPIRE_MINUTES=1440
REFRESH_TOKEN_EXPIRE_DAYS=7

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# WhatsApp Configuration (optional)
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=

# Email Configuration (optional)
RESEND_API_KEY=
SENDGRID_API_KEY=
FROM_EMAIL=noreply@localops.ai

# Environment
ENVIRONMENT=production
DEBUG=false
EOF
    print_warning "Please update the .env file with your actual API keys"
fi

# Initialize database
print_status "Initializing database..."
python init_db.py

cd ..

# 2. Frontend Setup
print_status "Setting up frontend..."
cd frontend

# Install dependencies
print_status "Installing Node.js dependencies..."
npm install

# Create .env.local file if it doesn't exist
if [ ! -f ".env.local" ]; then
    print_status "Creating .env.local file..."
    cat > .env.local << EOF
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8001

# Supabase Configuration (if using Supabase)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Environment
NODE_ENV=production
EOF
    print_warning "Please update the .env.local file with your actual configuration"
fi

cd ..

# 3. Database Setup
print_status "Setting up database schema and initial data..."

# Run database setup scripts
cd frontend/scripts

print_status "Setting up user roles and permissions..."
node setup-roles.js

print_status "Setting up staff columns..."
node add-staff-columns.js

print_status "Creating demo data..."
node demo-data-setup.js

cd ../..

# 4. Create default admin user
print_status "Creating default admin user..."

# Create a script to add the admin user
cat > create-admin-user.py << 'EOF'
#!/usr/bin/env python3
import sqlite3
import bcrypt
import os
from datetime import datetime

def create_admin_user():
    # Connect to database
    conn = sqlite3.connect('backend/localops_ai.db')
    cursor = conn.cursor()
    
    # Check if admin user already exists
    cursor.execute("SELECT id FROM staff WHERE email = 'admin@localops.ai'")
    if cursor.fetchone():
        print("Admin user already exists")
        return
    
    # Hash password
    password = "admin123"
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Create admin user
    cursor.execute("""
        INSERT INTO staff (
            business_id, name, email, phone_number, role, user_role,
            password_hash, skills, reliability_score, is_active, hired_date,
            can_assign_shifts, can_manage_staff, can_view_all_shifts
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        1,  # business_id
        'System Administrator',
        'admin@localops.ai',
        '+44 20 7000 0000',
        'admin',
        'superadmin',
        hashed_password,
        '["management", "admin"]',
        10.0,
        1,
        datetime.now().isoformat(),
        1,  # can_assign_shifts
        1,  # can_manage_staff
        1   # can_view_all_shifts
    ))
    
    conn.commit()
    conn.close()
    print("Admin user created successfully")
    print("Email: admin@localops.ai")
    print("Password: admin123")

if __name__ == "__main__":
    create_admin_user()
EOF

# Run the admin user creation script
python3 create-admin-user.py

# Clean up
rm create-admin-user.py

# 5. Create production startup script
print_status "Creating production startup script..."

cat > start-production.sh << 'EOF'
#!/bin/bash

echo "🚀 Starting LocalOps AI Production System"
echo "========================================"

# Start backend
echo "Starting backend server..."
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8001 --workers 4 &
BACKEND_PID=$!

# Wait for backend to start
sleep 5

# Start frontend
echo "Starting frontend server..."
cd ../frontend
npm run build
npm start &
FRONTEND_PID=$!

echo "✅ LocalOps AI is running!"
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:8001"
echo "📚 API Docs: http://localhost:8001/docs"
echo ""
echo "Default admin credentials:"
echo "Email: admin@localops.ai"
echo "Password: admin123"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for user to stop
wait

# Cleanup
kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
echo "Shutting down LocalOps AI..."
EOF

chmod +x start-production.sh

# 6. Create development startup script
print_status "Creating development startup script..."

cat > start-dev.sh << 'EOF'
#!/bin/bash

echo "🚀 Starting LocalOps AI Development System"
echo "========================================="

# Start backend
echo "Starting backend server..."
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8001 --reload &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start frontend
echo "Starting frontend server..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo "✅ LocalOps AI is running in development mode!"
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:8001"
echo "📚 API Docs: http://localhost:8001/docs"
echo ""
echo "Default admin credentials:"
echo "Email: admin@localops.ai"
echo "Password: admin123"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for user to stop
wait

# Cleanup
kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
echo "Shutting down LocalOps AI..."
EOF

chmod +x start-dev.sh

# 7. Create health check script
print_status "Creating health check script..."

cat > health-check.sh << 'EOF'
#!/bin/bash

echo "🏥 LocalOps AI Health Check"
echo "=========================="

# Check backend
echo "Checking backend..."
if curl -s http://localhost:8001/health > /dev/null; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend is not responding"
fi

# Check frontend
echo "Checking frontend..."
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Frontend is healthy"
else
    echo "❌ Frontend is not responding"
fi

# Check database
echo "Checking database..."
if [ -f "backend/localops_ai.db" ]; then
    echo "✅ Database file exists"
else
    echo "❌ Database file not found"
fi

echo "Health check complete!"
EOF

chmod +x health-check.sh

# 8. Create backup script
print_status "Creating backup script..."

cat > backup.sh << 'EOF'
#!/bin/bash

echo "💾 Creating LocalOps AI Backup"
echo "============================="

# Create backup directory
BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

# Backup database
echo "Backing up database..."
cp backend/localops_ai.db $BACKUP_DIR/

# Backup configuration files
echo "Backing up configuration..."
cp backend/.env $BACKUP_DIR/backend.env
cp frontend/.env.local $BACKUP_DIR/frontend.env

# Create backup info
cat > $BACKUP_DIR/backup-info.txt << EOL
LocalOps AI Backup
Created: $(date)
Version: 1.0.0
Database: localops_ai.db
Configuration: backend.env, frontend.env
EOL

echo "✅ Backup created in $BACKUP_DIR"
EOF

chmod +x backup.sh

# 9. Final setup
print_status "Finalizing setup..."

# Create logs directory
mkdir -p logs

# Set proper permissions
chmod +x run-dev.sh
chmod +x run-tests.sh

print_success "🎉 LocalOps AI Production Setup Complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Update configuration files with your API keys:"
echo "   - backend/.env"
echo "   - frontend/.env.local"
echo ""
echo "2. Start the system:"
echo "   - Development: ./start-dev.sh"
echo "   - Production: ./start-production.sh"
echo ""
echo "3. Access the application:"
echo "   - Frontend: http://localhost:3000"
echo "   - API Docs: http://localhost:8001/docs"
echo ""
echo "4. Default admin credentials:"
echo "   - Email: admin@localops.ai"
echo "   - Password: admin123"
echo ""
echo "5. Additional scripts:"
echo "   - Health check: ./health-check.sh"
echo "   - Backup: ./backup.sh"
echo ""
echo "🔒 Security Notes:"
echo "- Change the default admin password immediately"
echo "- Update JWT_SECRET_KEY in production"
echo "- Configure proper CORS settings for production"
echo "- Set up SSL/TLS certificates for production"
echo ""
print_success "Setup complete! 🚀" 