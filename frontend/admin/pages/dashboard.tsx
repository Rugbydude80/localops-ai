import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import { 
  ChartBarIcon, 
  BuildingOffice2Icon, 
  CurrencyPoundIcon,
  UsersIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CogIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'

// Mock data for demonstration
const mockAnalytics = {
  total_businesses: 1247,
  active_businesses: 1189,
  total_revenue_monthly: 45230.50,
  revenue_growth_percentage: 12.5,
  churn_rate: 2.3,
  new_businesses_this_month: 45,
  top_performing_businesses: [
    { id: 1, name: "TechCorp Solutions", revenue: 108.99, health_score: 94.2, staff_count: 15 },
    { id: 2, name: "Innovation Labs", revenue: 108.99, health_score: 91.8, staff_count: 12 },
    { id: 3, name: "Digital Dynamics", revenue: 59.99, health_score: 89.5, staff_count: 8 }
  ],
  subscription_distribution: {
    starter: 456,
    professional: 623,
    enterprise: 168
  }
}

const mockRevenueData = [
  { date: '2024-11-01', revenue: 1550, new_subscriptions: 2, cancellations: 0 },
  { date: '2024-11-02', revenue: 1600, new_subscriptions: 0, cancellations: 1 },
  { date: '2024-11-03', revenue: 1650, new_subscriptions: 1, cancellations: 0 },
  { date: '2024-11-04', revenue: 1700, new_subscriptions: 3, cancellations: 0 },
  { date: '2024-11-05', revenue: 1750, new_subscriptions: 0, cancellations: 1 },
  { date: '2024-11-06', revenue: 1800, new_subscriptions: 2, cancellations: 0 },
  { date: '2024-11-07', revenue: 1850, new_subscriptions: 1, cancellations: 0 }
]

const mockRecentActivity = [
  { id: 1, type: 'business_upgrade', message: 'Business "TechCorp" upgraded to Enterprise', timestamp: '2 hours ago', severity: 'info' },
  { id: 2, type: 'support_ticket', message: '3 new support tickets received', timestamp: '4 hours ago', severity: 'warning' },
  { id: 3, type: 'revenue_milestone', message: 'Monthly revenue milestone reached', timestamp: '6 hours ago', severity: 'success' },
  { id: 4, type: 'system_alert', message: 'Database load at 92%', timestamp: '8 hours ago', severity: 'error' }
]

const mockSystemHealth = {
  overall: 'operational',
  components: [
    { name: 'API Gateway', status: 'operational', uptime: 99.9 },
    { name: 'Database', status: 'warning', uptime: 99.5 },
    { name: 'AI Models', status: 'operational', uptime: 99.8 },
    { name: 'Payment System', status: 'operational', uptime: 99.9 }
  ]
}

export default function PlatformDashboard() {
  const [analytics, setAnalytics] = useState(mockAnalytics)
  const [revenueData, setRevenueData] = useState(mockRevenueData)
  const [recentActivity, setRecentActivity] = useState(mockRecentActivity)
  const [systemHealth, setSystemHealth] = useState(mockSystemHealth)
  const [loading, setLoading] = useState(false)

  // Colors for charts
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444']

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'success': return 'text-green-600 bg-green-100'
      case 'warning': return 'text-yellow-600 bg-yellow-100'
      case 'error': return 'text-red-600 bg-red-100'
      default: return 'text-blue-600 bg-blue-100'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational': return 'text-green-600'
      case 'warning': return 'text-yellow-600'
      case 'error': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount)
  }

  const subscriptionData = Object.entries(analytics.subscription_distribution).map(([tier, count]) => ({
    name: tier.charAt(0).toUpperCase() + tier.slice(1),
    value: count
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Platform Dashboard - SynqForge Admin</title>
        <meta name="description" content="SynqForge Platform Administration Dashboard" />
      </Head>

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <BuildingOffice2Icon className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">SynqForge Platform Admin</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <ShieldCheckIcon className="h-5 w-5 text-green-600" />
                <span className="text-sm text-gray-600">2FA Enabled</span>
              </div>
              <div className="flex items-center space-x-2">
                <CogIcon className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-600">Admin User</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BuildingOffice2Icon className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Businesses</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.total_businesses.toLocaleString()}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <CheckCircleIcon className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-sm text-green-600">{analytics.active_businesses} active</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CurrencyPoundIcon className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Monthly Revenue</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(analytics.total_revenue_monthly)}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <ArrowTrendingUpIcon className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-sm text-green-600">+{analytics.revenue_growth_percentage}% growth</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UsersIcon className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">New This Month</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.new_businesses_this_month}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <ArrowTrendingUpIcon className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-sm text-green-600">+12% vs last month</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-8 w-8 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Churn Rate</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.churn_rate}%</p>
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <ArrowTrendingDownIcon className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-sm text-green-600">-0.5% vs last month</span>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Revenue Chart */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Revenue Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Line type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* System Health */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">System Health</h3>
            <div className="space-y-4">
              {systemHealth.components.map((component) => (
                <div key={component.name} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-3 ${getStatusColor(component.status).replace('text-', 'bg-')}`}></div>
                    <span className="text-sm font-medium text-gray-900">{component.name}</span>
                  </div>
                  <span className="text-sm text-gray-500">{component.uptime}%</span>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">Overall Status</span>
                <span className={`text-sm font-medium ${getStatusColor(systemHealth.overall)}`}>
                  {systemHealth.overall.charAt(0).toUpperCase() + systemHealth.overall.slice(1)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          {/* Recent Activity */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${getSeverityColor(activity.severity).split(' ')[1]}`}></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">{activity.message}</p>
                    <p className="text-xs text-gray-500">{activity.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Subscription Distribution */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Subscription Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={subscriptionData}
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {subscriptionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Performing Businesses */}
        <div className="mt-8 bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Top Performing Businesses</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Business</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Health Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analytics.top_performing_businesses.map((business) => (
                  <tr key={business.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{business.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatCurrency(business.revenue)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="text-sm text-gray-900">{business.health_score}</div>
                        <div className="ml-2 w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full" 
                            style={{ width: `${business.health_score}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{business.staff_count}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
} 