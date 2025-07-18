#!/bin/bash

# Comprehensive Test Runner for Auto-Schedule System
# This script runs all test suites for the auto-schedule system

set -e

echo "🧪 Starting Comprehensive Test Suite for Auto-Schedule System"
echo "============================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
BACKEND_TESTS_PASSED=0
FRONTEND_TESTS_PASSED=0
TOTAL_TESTS=0
FAILED_TESTS=0

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "INFO")
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
        "SUCCESS")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "WARNING")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "ERROR")
            echo -e "${RED}❌ $message${NC}"
            ;;
    esac
}

# Function to run backend tests
run_backend_tests() {
    print_status "INFO" "Running Backend Tests..."
    cd backend
    
    # Check if virtual environment exists
    if [ ! -d "venv" ]; then
        print_status "WARNING" "Virtual environment not found. Creating one..."
        python -m venv venv
        source venv/bin/activate
        pip install -r requirements.txt
    else
        source venv/bin/activate
    fi
    
    # Install test dependencies
    pip install pytest pytest-cov pytest-asyncio pytest-mock psutil
    
    print_status "INFO" "Running Unit Tests..."
    if pytest -m "unit" --tb=short -v; then
        print_status "SUCCESS" "Unit tests passed"
        ((BACKEND_TESTS_PASSED++))
    else
        print_status "ERROR" "Unit tests failed"
        ((FAILED_TESTS++))
    fi
    
    print_status "INFO" "Running Integration Tests..."
    if pytest -m "integration" --tb=short -v; then
        print_status "SUCCESS" "Integration tests passed"
        ((BACKEND_TESTS_PASSED++))
    else
        print_status "ERROR" "Integration tests failed"
        ((FAILED_TESTS++))
    fi
    
    print_status "INFO" "Running Performance Tests..."
    if pytest -m "performance" --tb=short -v --timeout=60; then
        print_status "SUCCESS" "Performance tests passed"
        ((BACKEND_TESTS_PASSED++))
    else
        print_status "ERROR" "Performance tests failed"
        ((FAILED_TESTS++))
    fi
    
    print_status "INFO" "Running External Service Integration Tests..."
    if pytest test_external_service_integration.py --tb=short -v; then
        print_status "SUCCESS" "External service tests passed"
        ((BACKEND_TESTS_PASSED++))
    else
        print_status "ERROR" "External service tests failed"
        ((FAILED_TESTS++))
    fi
    
    print_status "INFO" "Running Complete Workflow Tests..."
    if pytest test_complete_workflow_integration.py --tb=short -v; then
        print_status "SUCCESS" "Workflow tests passed"
        ((BACKEND_TESTS_PASSED++))
    else
        print_status "ERROR" "Workflow tests failed"
        ((FAILED_TESTS++))
    fi
    
    # Generate coverage report
    print_status "INFO" "Generating coverage report..."
    pytest --cov=services --cov=models --cov=main --cov-report=html:htmlcov --cov-report=term-missing
    
    deactivate
    cd ..
}

# Function to run frontend tests
run_frontend_tests() {
    print_status "INFO" "Running Frontend Tests..."
    cd frontend
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        print_status "WARNING" "Node modules not found. Installing..."
        npm install
    fi
    
    print_status "INFO" "Running Component Unit Tests..."
    if npm run test:integration; then
        print_status "SUCCESS" "Component tests passed"
        ((FRONTEND_TESTS_PASSED++))
    else
        print_status "ERROR" "Component tests failed"
        ((FAILED_TESTS++))
    fi
    
    print_status "INFO" "Running End-to-End Tests..."
    if npm run test:e2e; then
        print_status "SUCCESS" "E2E tests passed"
        ((FRONTEND_TESTS_PASSED++))
    else
        print_status "ERROR" "E2E tests failed"
        ((FAILED_TESTS++))
    fi
    
    print_status "INFO" "Running Accessibility Tests..."
    if npm run test:accessibility; then
        print_status "SUCCESS" "Accessibility tests passed"
        ((FRONTEND_TESTS_PASSED++))
    else
        print_status "ERROR" "Accessibility tests failed"
        ((FAILED_TESTS++))
    fi
    
    print_status "INFO" "Running Visual Regression Tests..."
    if npm run test:visual; then
        print_status "SUCCESS" "Visual regression tests passed"
        ((FRONTEND_TESTS_PASSED++))
    else
        print_status "ERROR" "Visual regression tests failed"
        ((FAILED_TESTS++))
    fi
    
    # Generate coverage report
    print_status "INFO" "Generating frontend coverage report..."
    npm run test:coverage
    
    cd ..
}

# Function to run specific test suite
run_specific_tests() {
    local test_type=$1
    case $test_type in
        "backend")
            run_backend_tests
            ;;
        "frontend")
            run_frontend_tests
            ;;
        "unit")
            print_status "INFO" "Running only unit tests..."
            cd backend && source venv/bin/activate && pytest -m "unit" --tb=short -v && deactivate && cd ..
            cd frontend && npm run test:integration && cd ..
            ;;
        "integration")
            print_status "INFO" "Running only integration tests..."
            cd backend && source venv/bin/activate && pytest -m "integration" --tb=short -v && deactivate && cd ..
            cd frontend && npm run test:e2e && cd ..
            ;;
        "performance")
            print_status "INFO" "Running only performance tests..."
            cd backend && source venv/bin/activate && pytest -m "performance" --tb=short -v && deactivate && cd ..
            ;;
        "accessibility")
            print_status "INFO" "Running only accessibility tests..."
            cd frontend && npm run test:accessibility && cd ..
            ;;
        "visual")
            print_status "INFO" "Running only visual regression tests..."
            cd frontend && npm run test:visual && cd ..
            ;;
        *)
            print_status "ERROR" "Unknown test type: $test_type"
            echo "Available options: backend, frontend, unit, integration, performance, accessibility, visual"
            exit 1
            ;;
    esac
}

# Function to generate test report
generate_report() {
    print_status "INFO" "Generating Test Report..."
    
    local total_suites=$((BACKEND_TESTS_PASSED + FRONTEND_TESTS_PASSED + FAILED_TESTS))
    local success_rate=0
    
    if [ $total_suites -gt 0 ]; then
        success_rate=$(( (BACKEND_TESTS_PASSED + FRONTEND_TESTS_PASSED) * 100 / total_suites ))
    fi
    
    echo ""
    echo "📊 Test Results Summary"
    echo "======================"
    echo "Backend Test Suites Passed: $BACKEND_TESTS_PASSED"
    echo "Frontend Test Suites Passed: $FRONTEND_TESTS_PASSED"
    echo "Failed Test Suites: $FAILED_TESTS"
    echo "Total Test Suites: $total_suites"
    echo "Success Rate: $success_rate%"
    echo ""
    
    if [ $FAILED_TESTS -eq 0 ]; then
        print_status "SUCCESS" "All tests passed! 🎉"
        echo ""
        echo "📋 Test Coverage:"
        echo "- ✅ End-to-end auto-schedule workflow"
        echo "- ✅ External service integrations (WhatsApp, SMS, Email)"
        echo "- ✅ Performance with large datasets (100+ staff)"
        echo "- ✅ Accessibility compliance"
        echo "- ✅ Visual regression testing"
        echo "- ✅ Real-time collaboration features"
        echo "- ✅ Error handling and recovery"
        echo "- ✅ Multi-channel notifications"
        echo ""
        return 0
    else
        print_status "ERROR" "$FAILED_TESTS test suite(s) failed"
        echo ""
        echo "🔍 Check the logs above for detailed error information"
        echo "📁 Coverage reports available in:"
        echo "   - Backend: backend/htmlcov/index.html"
        echo "   - Frontend: frontend/coverage/index.html"
        echo ""
        return 1
    fi
}

# Main execution
main() {
    # Parse command line arguments
    if [ $# -eq 0 ]; then
        # Run all tests
        print_status "INFO" "Running all test suites..."
        run_backend_tests
        run_frontend_tests
    else
        # Run specific test type
        run_specific_tests $1
    fi
    
    generate_report
    exit $?
}

# Help function
show_help() {
    echo "Auto-Schedule System Test Runner"
    echo ""
    echo "Usage: $0 [test_type]"
    echo ""
    echo "Test Types:"
    echo "  backend       - Run all backend tests"
    echo "  frontend      - Run all frontend tests"
    echo "  unit          - Run unit tests only"
    echo "  integration   - Run integration tests only"
    echo "  performance   - Run performance tests only"
    echo "  accessibility - Run accessibility tests only"
    echo "  visual        - Run visual regression tests only"
    echo ""
    echo "Examples:"
    echo "  $0                    # Run all tests"
    echo "  $0 backend           # Run backend tests only"
    echo "  $0 accessibility     # Run accessibility tests only"
    echo ""
    echo "Test Coverage Includes:"
    echo "  ✓ Complete auto-schedule workflow (generation to publishing)"
    echo "  ✓ External API integrations (WhatsApp, SMS, Email)"
    echo "  ✓ Performance testing with large datasets"
    echo "  ✓ Accessibility compliance (WCAG 2.1)"
    echo "  ✓ Visual regression testing"
    echo "  ✓ Real-time collaboration features"
    echo "  ✓ Error handling and recovery scenarios"
    echo ""
}

# Check for help flag
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_help
    exit 0
fi

# Run main function
main "$@"