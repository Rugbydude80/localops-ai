#!/bin/bash

echo "🧪 Basic Functionality Test"
echo "=========================="

# Test Backend Core
echo "📡 Testing Backend Core..."
cd backend
source venv/bin/activate

echo "✅ Testing main module import..."
python -c "import main; print('Main module: OK')"

echo "✅ Testing database models..."
python -c "import models; print('Models: OK')"

echo "✅ Testing schemas..."
python -c "import schemas; print('Schemas: OK')"

echo "✅ Testing core API tests..."
pytest test_auto_schedule_api.py -v --tb=short -q

echo "✅ Testing constraint solver..."
pytest test_constraint_solver.py -v --tb=short -q

cd ..

# Test Frontend Core
echo "📱 Testing Frontend Core..."
cd frontend

echo "✅ Testing TypeScript compilation..."
npx tsc --noEmit --skipLibCheck

echo "✅ Testing Next.js build (basic)..."
npm run build

cd ..

echo "🎉 Basic functionality tests completed!"