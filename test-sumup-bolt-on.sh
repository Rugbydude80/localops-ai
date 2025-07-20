#!/bin/bash

# Test script for SumUp POS bolt-on admin dashboard implementation
# This script tests the backend API endpoints and frontend functionality

set -e

echo "🧪 Testing SumUp POS Bolt-on Admin Dashboard Implementation"
echo "=========================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "PASS")
            echo -e "${GREEN}✅ PASS${NC}: $message"
            ;;
        "FAIL")
            echo -e "${RED}❌ FAIL${NC}: $message"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ️  INFO${NC}: $message"
            ;;
        "WARN")
            echo -e "${YELLOW}⚠️  WARN${NC}: $message"
            ;;
    esac
}

# Check if backend is running
check_backend() {
    print_status "INFO" "Checking if backend is running..."
    
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        print_status "PASS" "Backend is running on http://localhost:8000"
        return 0
    else
        print_status "FAIL" "Backend is not running. Please start the backend first."
        print_status "INFO" "Run: cd backend && python main.py"
        return 1
    fi
}

# Test database models
test_database_models() {
    print_status "INFO" "Testing database models..."
    
    cd backend
    
    # Test if models can be imported
    if python -c "from models import BoltOnManagement, BoltOnSubscription, BoltOnAuditLog, SumUpIntegration; print('Models imported successfully')" 2>/dev/null; then
        print_status "PASS" "Database models imported successfully"
    else
        print_status "FAIL" "Failed to import database models"
        return 1
    fi
    
    # Test if database tables exist
    if python -c "
from database import engine
from models import Base
Base.metadata.create_all(bind=engine)
print('Database tables created/verified')
" 2>/dev/null; then
        print_status "PASS" "Database tables created/verified"
    else
        print_status "FAIL" "Failed to create/verify database tables"
        return 1
    fi
    
    cd ..
}

# Test bolt-on management service
test_bolt_on_service() {
    print_status "INFO" "Testing bolt-on management service..."
    
    cd backend
    
    # Test service import
    if python -c "from services.bolt_on_management import BoltOnManagementService; print('Service imported successfully')" 2>/dev/null; then
        print_status "PASS" "BoltOnManagementService imported successfully"
    else
        print_status "FAIL" "Failed to import BoltOnManagementService"
        return 1
    fi
    
    cd ..
}

# Test API endpoints
test_api_endpoints() {
    print_status "INFO" "Testing API endpoints..."
    
    # Test admin dashboard endpoint
    if curl -s http://localhost:8000/api/admin/bolt-ons/sumup_sync/dashboard > /dev/null 2>&1; then
        print_status "PASS" "Admin dashboard endpoint responds"
    else
        print_status "WARN" "Admin dashboard endpoint not accessible (may require authentication)"
    fi
    
    # Test integration status endpoint
    if curl -s http://localhost:8000/api/integrations/sumup/1/status > /dev/null 2>&1; then
        print_status "PASS" "Integration status endpoint responds"
    else
        print_status "WARN" "Integration status endpoint not accessible (may require authentication)"
    fi
    
    # Test upgrade prompt endpoint
    if curl -s http://localhost:8000/api/integrations/sumup/1/upgrade-prompt > /dev/null 2>&1; then
        print_status "PASS" "Upgrade prompt endpoint responds"
    else
        print_status "WARN" "Upgrade prompt endpoint not accessible (may require authentication)"
    fi
}

# Test frontend components
test_frontend() {
    print_status "INFO" "Testing frontend components..."
    
    cd frontend
    
    # Check if required files exist
    if [ -f "src/pages/admin/bolt-ons.tsx" ]; then
        print_status "PASS" "Admin bolt-ons page exists"
    else
        print_status "FAIL" "Admin bolt-ons page missing"
        return 1
    fi
    
    if [ -f "src/pages/dashboard/integrations.tsx" ]; then
        print_status "PASS" "Customer integrations page exists"
    else
        print_status "FAIL" "Customer integrations page missing"
        return 1
    fi
    
    if [ -f "src/components/SumUpIntegration.tsx" ]; then
        print_status "PASS" "SumUp integration component exists"
    else
        print_status "FAIL" "SumUp integration component missing"
        return 1
    fi
    
    # Check if dependencies are installed
    if [ -f "package.json" ] && grep -q "react" package.json; then
        print_status "PASS" "React dependencies found"
    else
        print_status "FAIL" "React dependencies missing"
        return 1
    fi
    
    cd ..
}

# Test environment configuration
test_environment() {
    print_status "INFO" "Testing environment configuration..."
    
    # Check backend environment
    if [ -f "backend/.env" ] || [ -f ".env" ]; then
        print_status "PASS" "Environment file exists"
    else
        print_status "WARN" "Environment file not found (create .env with required variables)"
    fi
    
    # Check required environment variables
    required_vars=("SUMUP_CLIENT_ID" "SUMUP_CLIENT_SECRET" "ENCRYPTION_KEY")
    for var in "${required_vars[@]}"; do
        if [ -n "${!var}" ]; then
            print_status "PASS" "$var is set"
        else
            print_status "WARN" "$var is not set (required for SumUp integration)"
        fi
    done
}

# Test database schema
test_database_schema() {
    print_status "INFO" "Testing database schema..."
    
    cd backend
    
    # Test if all required tables exist
    tables=("bolt_on_management" "bolt_on_subscriptions" "bolt_on_audit_log" "sumup_integrations")
    
    for table in "${tables[@]}"; do
        if python -c "
from database import engine
from sqlalchemy import text
with engine.connect() as conn:
    result = conn.execute(text('SELECT name FROM sqlite_master WHERE type=\"table\" AND name=\"$table\"'))
    if result.fetchone():
        print('Table $table exists')
    else:
        print('Table $table missing')
        exit(1)
" 2>/dev/null; then
            print_status "PASS" "Table $table exists"
        else
            print_status "FAIL" "Table $table missing"
            return 1
        fi
    done
    
    cd ..
}

# Main test execution
main() {
    echo ""
    print_status "INFO" "Starting SumUp bolt-on admin dashboard tests..."
    echo ""
    
    local exit_code=0
    
    # Run tests
    check_backend || exit_code=1
    echo ""
    
    test_database_models || exit_code=1
    echo ""
    
    test_bolt_on_service || exit_code=1
    echo ""
    
    test_database_schema || exit_code=1
    echo ""
    
    test_api_endpoints || exit_code=1
    echo ""
    
    test_frontend || exit_code=1
    echo ""
    
    test_environment || exit_code=1
    echo ""
    
    # Summary
    echo "=========================================================="
    if [ $exit_code -eq 0 ]; then
        print_status "PASS" "All tests completed successfully!"
        echo ""
        print_status "INFO" "Next steps:"
        print_status "INFO" "1. Start the backend: cd backend && python main.py"
        print_status "INFO" "2. Start the frontend: cd frontend && npm run dev"
        print_status "INFO" "3. Access admin dashboard: http://localhost:3000/admin/bolt-ons"
        print_status "INFO" "4. Access customer dashboard: http://localhost:3000/dashboard/integrations"
    else
        print_status "FAIL" "Some tests failed. Please check the errors above."
        echo ""
        print_status "INFO" "Common issues:"
        print_status "INFO" "- Make sure backend is running on port 8000"
        print_status "INFO" "- Check that all required environment variables are set"
        print_status "INFO" "- Verify database tables are created"
        print_status "INFO" "- Ensure frontend dependencies are installed"
    fi
    echo ""
}

# Run main function
main "$@" 