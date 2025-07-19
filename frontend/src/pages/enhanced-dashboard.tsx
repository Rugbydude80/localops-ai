import { useState, useEffect } from 'react'
import Head from 'next/head'
import { 
  ChartBarIcon, 
  BoltIcon, 
  AcademicCapIcon, 
  ChatBubbleLeftRightIcon,
  CubeIcon,
  BuildingOffice2Icon,
  ExclamationTriangleIcon,
  StarIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'
import { useQuery } from '@tanstack/react-query'
import toast, { Toaster } from 'react-hot-toast'
import ProtectedRoute from '../components/ProtectedRoute'
import { useAuth } from '../hooks/useAuth'
import SmartMessageModal from '../components/SmartMessageModal'

import apiClient from '../lib/api'

// API functions for all 8 features using the new API client
const api = {
  // Feature 1: Predictive Scheduling
  getPredictiveSchedule: async (businessId: number, weekStart: string) => {
    return await apiClient.getPredictiveSchedule(businessId, weekStart)
  },

  // Feature 2: Smart Communication
  getCommunicationAnalytics: async (businessId: number) => {
    return await apiClient.getCommunicationAnalytics(businessId)
  },

  // Feature 3: Training Manager
  getTrainingAnalytics: async (businessId: number) => {
    return await apiClient.getTrainingAnalytics(businessId)
  },

  // Feature 4: Business Intelligence
  getRealTimeMetrics: async (businessId: number) => {
    return await apiClient.getRealTimeMetrics(businessId)
  },

  // Feature 5: Inventory Intelligence
  getInventoryDashboard: async (businessId: number) => {
    return await apiClient.getInventoryDashboard(businessId)
  },

  // Feature 6: Multi-Location
  getLocations: async (businessId: number) => {
    return await apiClient.getLocations(businessId)
  },

  getTransfers: async (businessId: number) => {
    return await apiClient.getTransfers(businessId)
  },

  // Feature 7: Emergency Response
  getEmergencyIncidents: async (businessId: number) => {
    return await apiClient.getEmergencyIncidents(businessId)
  },

  // Feature 8: Customer Experience
  getCustomerReviews: async (businessId: number) => {
    return await apiClient.getCustomerReviews(businessId)
  }
}

export default function EnhancedDashboard() {
  const { user } = useAuth()
  const [businessId] = useState(user?.business_id || 1)
  const [activeFeature, setActiveFeature] = useState('overview')

  // Queries for all features
  const { data: realTimeMetrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['real-time-metrics', businessId],
    queryFn: () => api.getRealTimeMetrics(businessId),
    refetchInterval: 30000 // Refresh every 30 seconds
  })

  const { data: communicationAnalytics } = useQuery({
    queryKey: ['communication-analytics', businessId],
    queryFn: () => api.getCommunicationAnalytics(businessId)
  })

  const { data: trainingAnalytics } = useQuery({
    queryKey: ['training-analytics', businessId],
    queryFn: () => api.getTrainingAnalytics(businessId)
  })

  const { data: inventoryDashboard } = useQuery({
    queryKey: ['inventory-dashboard', businessId],
    queryFn: () => api.getInventoryDashboard(businessId)
  })

  const { data: customerReviews } = useQuery({
    queryKey: ['customer-reviews', businessId],
    queryFn: () => api.getCustomerReviews(businessId)
  })

  const features = [
    {
      id: 'overview',
      name: 'Overview',
      icon: ChartBarIcon,
      color: 'blue',
      description: 'Real-time business metrics'
    },
    {
      id: 'predictive-scheduling',
      name: 'AI Scheduling',
      icon: BoltIcon,
      color: 'purple',
      description: 'Predictive staff scheduling'
    },
    {
      id: 'smart-communication',
      name: 'Smart Messaging',
      icon: ChatBubbleLeftRightIcon,
      color: 'green',
      description: 'Intelligent staff communication'
    },
    {
      id: 'training',
      name: 'Training Hub',
      icon: AcademicCapIcon,
      color: 'indigo',
      description: 'Digital training & certification'
    },
    {
      id: 'inventory',
      name: 'Smart Inventory',
      icon: CubeIcon,
      color: 'orange',
      description: 'AI-powered inventory management'
    },
    {
      id: 'multi-location',
      name: 'Multi-Location',
      icon: BuildingOffice2Icon,
      color: 'teal',
      description: 'Coordinate multiple locations'
    },
    {
      id: 'emergency',
      name: 'Emergency Response',
      icon: ExclamationTriangleIcon,
      color: 'red',
      description: 'Automated emergency protocols'
    },
    {
      id: 'customer-experience',
      name: 'Customer Experience',
      icon: StarIcon,
      color: 'yellow',
      description: 'Customer feedback integration'
    }
  ]

  return (
    <>
      <Head>
        <title>LocalOps AI - Enhanced Dashboard</title>
        <meta name="description" content="Next-level restaurant operations management" />
      </Head>

      <div className="min-h-screen bg-slate-50">
        <Toaster position="top-right" />
        
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-xl">L</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">LocalOps AI</h1>
                  <p className="text-sm text-gray-500">Next-Level Operations Platform</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <a
                  href="/simple-staff"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                  Staff Management
                </a>
                <a
                  href="/enhanced-shifts"
                  className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Enhanced Shifts
                </a>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">Professional Plan</div>
                  <div className="text-xs text-gray-500">All features unlocked</div>
                </div>
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Feature Navigation */}
          <div className="mb-8">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
              {features.map((feature) => {
                const Icon = feature.icon
                const isActive = activeFeature === feature.id
                return (
                  <button
                    key={feature.id}
                    onClick={() => setActiveFeature(feature.id)}
                    className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                      isActive
                        ? `border-${feature.color}-500 bg-${feature.color}-50 shadow-lg`
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                    }`}
                  >
                    <Icon className={`h-8 w-8 mx-auto mb-2 ${
                      isActive ? `text-${feature.color}-600` : 'text-gray-400'
                    }`} />
                    <div className={`text-sm font-medium ${
                      isActive ? `text-${feature.color}-900` : 'text-gray-700'
                    }`}>
                      {feature.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {feature.description}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Feature Content */}
          {activeFeature === 'overview' && (
            <OverviewDashboard 
              metrics={realTimeMetrics} 
              loading={metricsLoading}
              communication={communicationAnalytics}
              training={trainingAnalytics}
              inventory={inventoryDashboard}
              reviews={customerReviews}
            />
          )}

          {activeFeature === 'predictive-scheduling' && (
            <PredictiveSchedulingDashboard businessId={businessId} />
          )}

          {activeFeature === 'smart-communication' && (
            <SmartCommunicationDashboard 
              businessId={businessId} 
              analytics={communicationAnalytics} 
            />
          )}

          {activeFeature === 'training' && (
            <TrainingDashboard 
              businessId={businessId} 
              analytics={trainingAnalytics} 
            />
          )}

          {activeFeature === 'inventory' && (
            <InventoryDashboard 
              businessId={businessId} 
              dashboard={inventoryDashboard} 
            />
          )}

          {activeFeature === 'multi-location' && (
            <MultiLocationDashboard businessId={businessId} />
          )}

          {activeFeature === 'emergency' && (
            <EmergencyResponseDashboard businessId={businessId} />
          )}

          {activeFeature === 'customer-experience' && (
            <CustomerExperienceDashboard 
              businessId={businessId} 
              reviews={customerReviews} 
            />
          )}
        </div>
      </div>
    </>
  )
}

// Overview Dashboard Component
function OverviewDashboard({ metrics, loading, communication, training, inventory, reviews }: any) {
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
        <p className="mt-4 text-gray-600 font-medium">Loading real-time metrics...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Labour Cost"
          value={`${metrics?.labour_cost_percentage?.toFixed(1) || 0}%`}
          target="<30%"
          trend={metrics?.trends?.labour_cost_trend}
          color="blue"
        />
        <MetricCard
          title="Staff Utilisation"
          value={`${metrics?.staff_utilisation?.toFixed(1) || 0}%`}
          target=">85%"
          trend={metrics?.trends?.utilisation_trend}
          color="green"
        />
        <MetricCard
          title="Shift Coverage"
          value={`${metrics?.shift_coverage_rate?.toFixed(1) || 0}%`}
          target=">95%"
          trend={metrics?.trends?.coverage_trend}
          color="purple"
        />
        <MetricCard
          title="Customer Rating"
          value={`${reviews?.average_rating?.toFixed(1) || 0}/5`}
          target=">4.5"
          trend="stable"
          color="yellow"
        />
      </div>

      {/* Feature Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <FeatureStatusCard
          title="Smart Communication"
          status="Active"
          stats={[
            { label: "Messages Sent", value: communication?.total_messages || 0 },
            { label: "Response Rate", value: `${communication?.success_rates?.whatsapp?.read_rate?.toFixed(1) || 0}%` }
          ]}
          color="green"
        />
        <FeatureStatusCard
          title="Training Progress"
          status="On Track"
          stats={[
            { label: "Completion Rate", value: `${training?.overview?.completion_rate?.toFixed(1) || 0}%` },
            { label: "Active Modules", value: training?.overview?.total_modules || 0 }
          ]}
          color="indigo"
        />
        <FeatureStatusCard
          title="Inventory Health"
          status={inventory?.overview?.stock_health_score > 80 ? "Good" : "Needs Attention"}
          stats={[
            { label: "Stock Health", value: `${inventory?.overview?.stock_health_score?.toFixed(0) || 0}%` },
            { label: "Low Stock Items", value: inventory?.overview?.low_stock_items || 0 }
          ]}
          color={inventory?.overview?.stock_health_score > 80 ? "green" : "orange"}
        />
      </div>

      {/* Hourly Performance Chart */}
      {metrics?.hourly_data && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Performance</h3>
          <div className="h-64 flex items-end space-x-2">
            {metrics.hourly_data.map((hour: any, index: number) => (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div 
                  className="w-full bg-blue-500 rounded-t"
                  style={{ height: `${(hour.efficiency_score / 100) * 200}px` }}
                ></div>
                <div className="text-xs text-gray-500 mt-2">{hour.hour}:00</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Metric Card Component
function MetricCard({ title, value, target, trend, color }: any) {
  const getTrendIcon = () => {
    if (trend === 'increasing') return <ArrowTrendingUpIcon className="h-4 w-4 text-green-500" />
    if (trend === 'decreasing') return <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />
    return <div className="h-4 w-4 bg-gray-300 rounded-full"></div>
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        {getTrendIcon()}
      </div>
      <div className="space-y-2">
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-xs text-gray-500">Target: {target}</div>
      </div>
    </div>
  )
}

// Feature Status Card Component
function FeatureStatusCard({ title, status, stats, color }: any) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${color}-100 text-${color}-800`}>
          {status}
        </span>
      </div>
      <div className="space-y-3">
        {stats.map((stat: any, index: number) => (
          <div key={index} className="flex justify-between">
            <span className="text-sm text-gray-600">{stat.label}</span>
            <span className="text-sm font-medium text-gray-900">{stat.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Placeholder components for other features (would be fully implemented)
function PredictiveSchedulingDashboard({ businessId }: any) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <div className="text-center">
        <BoltIcon className="h-16 w-16 text-purple-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">AI-Powered Predictive Scheduling</h2>
        <p className="text-gray-600 mb-6">Generate optimal schedules based on demand predictions</p>
        <button className="bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700">
          Generate This Week's Schedule
        </button>
      </div>
    </div>
  )
}

function SmartCommunicationDashboard({ businessId, analytics }: any) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user } = useAuth();

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="text-center">
          <ChatBubbleLeftRightIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Smart Staff Communication Hub</h2>
          <p className="text-gray-600 mb-6">Intelligent messaging with AI optimization</p>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{analytics?.total_messages || 0}</div>
              <div className="text-sm text-gray-500">Messages Sent</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{analytics?.total_deliveries || 0}</div>
              <div className="text-sm text-gray-500">Deliveries</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {analytics?.success_rates?.whatsapp?.delivery_rate?.toFixed(1) || 0}%
              </div>
              <div className="text-sm text-gray-500">Success Rate</div>
            </div>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            Send Smart Message
          </button>
        </div>
      </div>

      <SmartMessageModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        businessId={businessId}
        senderId={user?.id || 1}
      />
    </>
  )
}

function TrainingDashboard({ businessId, analytics }: any) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <div className="text-center">
        <AcademicCapIcon className="h-16 w-16 text-indigo-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Digital Training & Certification</h2>
        <p className="text-gray-600 mb-6">Manage staff training and skill development</p>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{analytics?.overview?.total_modules || 0}</div>
            <div className="text-sm text-gray-500">Training Modules</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {analytics?.overview?.completion_rate?.toFixed(1) || 0}%
            </div>
            <div className="text-sm text-gray-500">Completion Rate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{analytics?.overview?.total_staff || 0}</div>
            <div className="text-sm text-gray-500">Active Staff</div>
          </div>
        </div>
        <button className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700">
          Create Training Module
        </button>
      </div>
    </div>
  )
}

function InventoryDashboard({ businessId, dashboard }: any) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <div className="text-center">
        <CubeIcon className="h-16 w-16 text-orange-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Intelligent Inventory Management</h2>
        <p className="text-gray-600 mb-6">AI-powered inventory tracking and predictions</p>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{dashboard?.overview?.total_items || 0}</div>
            <div className="text-sm text-gray-500">Total Items</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {dashboard?.overview?.stock_health_score?.toFixed(0) || 0}%
            </div>
            <div className="text-sm text-gray-500">Stock Health</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">£{dashboard?.overview?.total_inventory_value || 0}</div>
            <div className="text-sm text-gray-500">Total Value</div>
          </div>
        </div>
        <button className="bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700">
          Generate Smart Orders
        </button>
      </div>
    </div>
  )
}

function MultiLocationDashboard({ businessId }: any) {
  const { data: locations, isLoading, error } = useQuery({
    queryKey: ['locations', businessId],
    queryFn: () => api.getLocations(businessId),
    enabled: !!businessId
  })

  const { data: transfers } = useQuery({
    queryKey: ['transfers', businessId],
    queryFn: () => api.getTransfers(businessId),
    enabled: !!businessId
  })

  // Type assertions for the data
  const locationsData = locations as any[] || []
  const transfersData = transfers as any[] || []

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading locations...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Locations</h2>
          <p className="text-gray-600 mb-6">Unable to load location data. Please try again.</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-red-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Multi-Location Coordination</h2>
            <p className="text-gray-600">Manage multiple restaurant locations efficiently</p>
          </div>
          <BuildingOffice2Icon className="h-12 w-12 text-teal-500" />
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{locationsData.length}</div>
            <div className="text-sm text-gray-500">Total Locations</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{transfersData.length}</div>
            <div className="text-sm text-gray-500">Active Transfers</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {locationsData.filter((loc: any) => loc.is_active).length}
            </div>
            <div className="text-sm text-gray-500">Active Locations</div>
          </div>
        </div>
      </div>

      {/* Locations List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Locations</h3>
        
        {locationsData.length > 0 ? (
          <div className="space-y-4">
            {locationsData.map((location: any) => (
              <div key={location.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">{location.name}</h4>
                    <p className="text-sm text-gray-600">{location.address}</p>
                    {location.phone && (
                      <p className="text-sm text-gray-500">{location.phone}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      location.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {location.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <button className="text-teal-600 hover:text-teal-700 text-sm font-medium">
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <BuildingOffice2Icon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No locations found</p>
            <button className="bg-teal-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-teal-700">
              Add First Location
            </button>
          </div>
        )}
      </div>

      {/* Staff Transfers */}
      {transfersData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Staff Transfers</h3>
          <div className="space-y-3">
            {transfersData.slice(0, 3).map((transfer: any) => (
              <div key={transfer.id} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Staff Transfer - {transfer.transfer_type}
                    </p>
                    <p className="text-xs text-gray-600">{transfer.reason}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(transfer.transfer_date).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    transfer.status === 'approved' 
                      ? 'bg-green-100 text-green-800'
                      : transfer.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {transfer.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex space-x-4">
          <button className="flex-1 bg-teal-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-teal-700 transition-colors">
            Add New Location
          </button>
          <button className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors">
            Request Staff Transfer
          </button>
          <button className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors">
            View Analytics
          </button>
        </div>
      </div>
    </div>
  )
}

function EmergencyResponseDashboard({ businessId }: any) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <div className="text-center">
        <ExclamationTriangleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Emergency Response Automation</h2>
        <p className="text-gray-600 mb-6">Automated protocols for restaurant emergencies</p>
        <button className="bg-red-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-red-700">
          View Emergency Protocols
        </button>
      </div>
    </div>
  )
}

function CustomerExperienceDashboard({ businessId, reviews }: any) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <div className="text-center">
        <StarIcon className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Customer Experience Integration</h2>
        <p className="text-gray-600 mb-6">Monitor customer feedback and service quality</p>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{reviews?.average_rating?.toFixed(1) || 0}/5</div>
            <div className="text-sm text-gray-500">Average Rating</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{reviews?.total_reviews || 0}</div>
            <div className="text-sm text-gray-500">Total Reviews</div>
          </div>
        </div>
        <button className="bg-yellow-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-yellow-700">
          Analyze Customer Feedback
        </button>
      </div>
    </div>
  )
}