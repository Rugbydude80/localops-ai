import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { 
  ChartBarIcon, 
  UsersIcon,
  CogIcon,
  CurrencyPoundIcon,
  CalendarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ClockIcon,
  AcademicCapIcon
} from '@heroicons/react/24/outline'

// Mock data for demonstration
const mockWorkspaceData = {
  name: "TechCorp Solutions",
  id: "techcorp",
  subscription_tier: "enterprise",
  staff_count: 15,
  active_projects: 12,
  velocity: 85,
  monthly_cost: 108.99
}

const mockTeamActivity = [
  { id: 1, user: "Alice Johnson", action: "Completed task", project: "Q4 Features", time: "2 hours ago" },
  { id: 2, user: "Bob Smith", action: "Started new story", project: "API Integration", time: "4 hours ago" },
  { id: 3, user: "Charlie Brown", action: "In meeting", project: "Sprint Planning", time: "6 hours ago" },
  { id: 4, user: "Diana Prince", action: "Updated documentation", project: "User Guide", time: "8 hours ago" }
]

const mockCurrentSprint = {
  name: "Sprint 23: Q4 Features",
  end_date: "Dec 15, 2024",
  total_stories: 12,
  completed_stories: 8,
  remaining_stories: 4,
  velocity: 85,
  burndown_data: [
    { day: "Mon", remaining: 12 },
    { day: "Tue", remaining: 10 },
    { day: "Wed", remaining: 8 },
    { day: "Thu", remaining: 6 },
    { day: "Fri", remaining: 4 }
  ]
}

const mockAnalytics = {
  team_productivity: 87,
  project_completion_rate: 92,
  average_cycle_time: 3.2,
  sprint_velocity: 85,
  team_satisfaction: 4.2
}

export default function WorkspaceDashboard() {
  const router = useRouter()
  const { workspace } = router.query
  
  const [workspaceData, setWorkspaceData] = useState(mockWorkspaceData)
  const [teamActivity, setTeamActivity] = useState(mockTeamActivity)
  const [currentSprint, setCurrentSprint] = useState(mockCurrentSprint)
  const [analytics, setAnalytics] = useState(mockAnalytics)
  const [loading, setLoading] = useState(false)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount)
  }

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'enterprise': return 'text-purple-600 bg-purple-100'
      case 'professional': return 'text-blue-600 bg-blue-100'
      case 'starter': return 'text-green-600 bg-green-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getCompletionPercentage = () => {
    return Math.round((currentSprint.completed_stories / currentSprint.total_stories) * 100)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>{workspaceData.name} - Workspace Admin</title>
        <meta name="description" content={`${workspaceData.name} Workspace Administration`} />
      </Head>

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                <span className="text-white font-bold text-lg">
                  {workspaceData.name.charAt(0)}
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{workspaceData.name}</h1>
                <p className="text-sm text-gray-500">Workspace Administration</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${getTierColor(workspaceData.subscription_tier)}`}>
                {workspaceData.subscription_tier.charAt(0).toUpperCase() + workspaceData.subscription_tier.slice(1)}
              </div>
              <div className="flex items-center space-x-2">
                <CogIcon className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-600">Admin</span>
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
                <UsersIcon className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Team Members</p>
                <p className="text-2xl font-bold text-gray-900">{workspaceData.staff_count}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <CheckCircleIcon className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-sm text-green-600">All active</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Active Projects</p>
                <p className="text-2xl font-bold text-gray-900">{workspaceData.active_projects}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <ArrowTrendingUpIcon className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-sm text-green-600">{workspaceData.velocity}% velocity</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CurrencyPoundIcon className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Monthly Cost</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(workspaceData.monthly_cost)}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <CheckCircleIcon className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-sm text-green-600">Up to date</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AcademicCapIcon className="h-8 w-8 text-indigo-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Team Satisfaction</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.team_satisfaction}/5</p>
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <ArrowTrendingUpIcon className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-sm text-green-600">+0.3 vs last month</span>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Current Sprint */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900">Current Sprint</h3>
              <div className="flex items-center space-x-2">
                <CalendarIcon className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-500">Ends {currentSprint.end_date}</span>
              </div>
            </div>
            
            <div className="mb-6">
              <h4 className="text-xl font-semibold text-gray-900 mb-2">{currentSprint.name}</h4>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{currentSprint.completed_stories}</p>
                    <p className="text-sm text-gray-500">Completed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-600">{currentSprint.remaining_stories}</p>
                    <p className="text-sm text-gray-500">Remaining</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{currentSprint.velocity}</p>
                    <p className="text-sm text-gray-500">Velocity</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-900">{getCompletionPercentage()}%</div>
                  <div className="text-sm text-gray-500">Complete</div>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
              <div 
                className="bg-blue-600 h-3 rounded-full transition-all duration-300" 
                style={{ width: `${getCompletionPercentage()}%` }}
              ></div>
            </div>

            {/* Burndown Chart (simplified) */}
            <div className="mt-6">
              <h5 className="text-sm font-medium text-gray-700 mb-3">Burndown Chart</h5>
              <div className="flex items-end space-x-2 h-20">
                {currentSprint.burndown_data.map((data, index) => (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div 
                      className="w-full bg-blue-200 rounded-t"
                      style={{ height: `${(data.remaining / 12) * 100}%` }}
                    ></div>
                    <span className="text-xs text-gray-500 mt-1">{data.day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Team Activity */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Team Activity</h3>
            <div className="space-y-4">
              {teamActivity.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{activity.user}</p>
                    <p className="text-sm text-gray-600">{activity.action}</p>
                    <p className="text-xs text-gray-500">{activity.project} • {activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                View all activity →
              </button>
            </div>
          </div>
        </div>

        {/* Analytics Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          {/* Team Performance */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Team Performance</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Productivity</span>
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-900 mr-2">{analytics.team_productivity}%</span>
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full" 
                      style={{ width: `${analytics.team_productivity}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Project Completion</span>
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-900 mr-2">{analytics.project_completion_rate}%</span>
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${analytics.project_completion_rate}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Sprint Velocity</span>
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-900 mr-2">{analytics.sprint_velocity}</span>
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-purple-600 h-2 rounded-full" 
                      style={{ width: `${analytics.sprint_velocity}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Avg Cycle Time</span>
                <span className="text-sm font-medium text-gray-900">{analytics.average_cycle_time} days</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button className="w-full flex items-center justify-between p-3 text-left bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                <div className="flex items-center">
                  <UsersIcon className="h-5 w-5 text-blue-600 mr-3" />
                  <span className="text-sm font-medium text-gray-900">Manage Team</span>
                </div>
                <span className="text-sm text-gray-500">→</span>
              </button>
              
              <button className="w-full flex items-center justify-between p-3 text-left bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
                <div className="flex items-center">
                  <ChartBarIcon className="h-5 w-5 text-green-600 mr-3" />
                  <span className="text-sm font-medium text-gray-900">Agile Board</span>
                </div>
                <span className="text-sm text-gray-500">→</span>
              </button>
              
              <button className="w-full flex items-center justify-between p-3 text-left bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors">
                <div className="flex items-center">
                  <CogIcon className="h-5 w-5 text-purple-600 mr-3" />
                  <span className="text-sm font-medium text-gray-900">Workspace Settings</span>
                </div>
                <span className="text-sm text-gray-500">→</span>
              </button>
              
              <button className="w-full flex items-center justify-between p-3 text-left bg-yellow-50 hover:bg-yellow-100 rounded-lg transition-colors">
                <div className="flex items-center">
                  <CurrencyPoundIcon className="h-5 w-5 text-yellow-600 mr-3" />
                  <span className="text-sm font-medium text-gray-900">Billing & Usage</span>
                </div>
                <span className="text-sm text-gray-500">→</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 