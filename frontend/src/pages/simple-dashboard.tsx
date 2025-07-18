import { useState, useEffect } from 'react'
import Head from 'next/head'
import { 
  CalendarIcon, 
  UserGroupIcon, 
  ClockIcon 
} from '@heroicons/react/24/outline'

export default function SimpleDashboard() {
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setCurrentTime(new Date())
    
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    
    return () => clearInterval(timer)
  }, [])

  return (
    <>
      <Head>
        <title>LocalOps AI - Simple Dashboard</title>
        <meta name="description" content="Simple restaurant operations dashboard" />
      </Head>

      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-xl">L</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">LocalOps AI</h1>
                  <p className="text-gray-500">Restaurant Operations Dashboard</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-500">
                  {mounted && currentTime ? currentTime.toLocaleTimeString() : '--:--:--'}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Staff Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Staff Management</h3>
                  <p className="text-gray-500">Manage your team</p>
                </div>
                <UserGroupIcon className="w-8 h-8 text-blue-600" />
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold text-gray-900">6</p>
                <p className="text-sm text-gray-500">Active staff members</p>
              </div>
            </div>

            {/* Shifts Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Today's Shifts</h3>
                  <p className="text-gray-500">Current schedule</p>
                </div>
                <CalendarIcon className="w-8 h-8 text-green-600" />
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold text-gray-900">8</p>
                <p className="text-sm text-gray-500">Scheduled shifts</p>
              </div>
            </div>

            {/* Hours Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Operating Hours</h3>
                  <p className="text-gray-500">Current status</p>
                </div>
                <ClockIcon className="w-8 h-8 text-purple-600" />
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold text-green-600">Open</p>
                <p className="text-sm text-gray-500">9:00 AM - 10:00 PM</p>
              </div>
            </div>
          </div>

          {/* Status Message */}
          <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">✓</span>
                </div>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">
                  System Status: All systems operational
                </h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>
                    Frontend: Running on port 3000<br />
                    Backend: Running on port 8001<br />
                    Database: SQLite (Local Development)
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <a 
              href="/dashboard" 
              className="block bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:bg-gray-50 transition-colors"
            >
              <h4 className="font-semibold text-gray-900">Full Dashboard</h4>
              <p className="text-sm text-gray-500">Complete operations dashboard with all features</p>
            </a>
            <a 
              href="/enhanced-dashboard" 
              className="block bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:bg-gray-50 transition-colors"
            >
              <h4 className="font-semibold text-gray-900">Enhanced Dashboard</h4>
              <p className="text-sm text-gray-500">8 AI-powered feature modules</p>
            </a>
          </div>
        </main>
      </div>
    </>
  )
} 