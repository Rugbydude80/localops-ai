import React, { useState, useEffect } from 'react'
import { 
  UsersIcon, 
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  ChartBarIcon,
  UserPlusIcon,
  CogIcon
} from '@heroicons/react/24/outline'

// Mock data for demonstration
const mockTeamMembers = [
  {
    id: 1,
    email: "alice@techcorp.com",
    first_name: "Alice",
    last_name: "Johnson",
    user_role: "admin",
    is_active: true,
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    last_login: new Date(Date.now() - 2 * 60 * 60 * 1000),
    activity_score: 95.2,
    permissions: ["read", "write", "delete", "manage_team", "manage_settings", "view_analytics"]
  },
  {
    id: 2,
    email: "bob@techcorp.com",
    first_name: "Bob",
    last_name: "Smith",
    user_role: "manager",
    is_active: true,
    created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
    last_login: new Date(Date.now() - 4 * 60 * 60 * 1000),
    activity_score: 87.8,
    permissions: ["read", "write", "manage_team", "view_analytics"]
  },
  {
    id: 3,
    email: "charlie@techcorp.com",
    first_name: "Charlie",
    last_name: "Brown",
    user_role: "supervisor",
    is_active: true,
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    last_login: new Date(Date.now() - 6 * 60 * 60 * 1000),
    activity_score: 76.5,
    permissions: ["read", "write", "view_analytics"]
  },
  {
    id: 4,
    email: "diana@techcorp.com",
    first_name: "Diana",
    last_name: "Prince",
    user_role: "staff",
    is_active: false,
    created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    last_login: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    activity_score: 45.2,
    permissions: ["read", "write"]
  }
]

const mockTeamAnalytics = {
  total_members: 15,
  active_members: 14,
  members_by_role: {
    admin: 2,
    manager: 3,
    supervisor: 4,
    staff: 6
  },
  recent_activity: [
    {
      id: 1,
      member: "Alice Johnson",
      action: "Completed task",
      project: "Q4 Features",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000)
    },
    {
      id: 2,
      member: "Bob Smith",
      action: "Started new story",
      project: "API Integration",
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000)
    }
  ],
  team_health_score: 87.5,
  average_activity_score: 76.3
}

export default function TeamManagement() {
  const [teamMembers, setTeamMembers] = useState(mockTeamMembers)
  const [teamAnalytics, setTeamAnalytics] = useState(mockTeamAnalytics)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [loading, setLoading] = useState(false)

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'text-purple-600 bg-purple-100'
      case 'manager': return 'text-blue-600 bg-blue-100'
      case 'supervisor': return 'text-green-600 bg-green-100'
      case 'staff': return 'text-gray-600 bg-gray-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getActivityColor = (score: number) => {
    if (score >= 90) return 'text-green-600'
    if (score >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const filteredMembers = teamMembers.filter(member => {
    const matchesSearch = member.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = roleFilter === 'all' || member.user_role === roleFilter
    return matchesSearch && matchesRole
  })

  const handleInviteMember = () => {
    setShowInviteModal(true)
  }

  const handleEditMember = (member: any) => {
    setSelectedMember(member)
    setShowEditModal(true)
  }

  const handleDeactivateMember = (memberId: number) => {
    if (confirm('Are you sure you want to deactivate this team member?')) {
      setTeamMembers(prev => prev.map(member => 
        member.id === memberId ? { ...member, is_active: false } : member
      ))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <UsersIcon className="h-8 w-8 text-blue-600 mr-3" />
          <h2 className="text-2xl font-bold text-gray-900">Team Management</h2>
        </div>
        <button
          onClick={handleInviteMember}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <UserPlusIcon className="h-4 w-4 mr-2" />
          Invite Member
        </button>
      </div>

      {/* Team Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <UsersIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Members</p>
              <p className="text-2xl font-bold text-gray-900">{teamAnalytics.total_members}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full" 
                style={{ width: `${(teamAnalytics.active_members / teamAnalytics.total_members) * 100}%` }}
              />
            </div>
            <span className="ml-2 text-sm text-gray-600">{teamAnalytics.active_members} active</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ChartBarIcon className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Team Health</p>
              <p className="text-2xl font-bold text-gray-900">{teamAnalytics.team_health_score}%</p>
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full" 
                style={{ width: `${teamAnalytics.team_health_score}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CogIcon className="h-8 w-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Avg Activity</p>
              <p className="text-2xl font-bold text-gray-900">{teamAnalytics.average_activity_score}%</p>
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full" 
                style={{ width: `${teamAnalytics.average_activity_score}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <EyeIcon className="h-8 w-8 text-indigo-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Recent Activity</p>
              <p className="text-2xl font-bold text-gray-900">{teamAnalytics.recent_activity.length}</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-600">Last 24 hours</p>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex-1 max-w-lg">
            <label htmlFor="search" className="sr-only">Search members</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <UsersIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="search"
                name="search"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Search team members..."
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="supervisor">Supervisor</option>
              <option value="staff">Staff</option>
            </select>
          </div>
        </div>
      </div>

      {/* Team Members Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {filteredMembers.map((member) => (
            <li key={member.id}>
              <div className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-700">
                          {member.first_name.charAt(0)}{member.last_name.charAt(0)}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="flex items-center">
                        <p className="text-sm font-medium text-gray-900">
                          {member.first_name} {member.last_name}
                        </p>
                        {!member.is_active && (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{member.email}</p>
                      <div className="flex items-center mt-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(member.user_role)}`}>
                          {member.user_role.charAt(0).toUpperCase() + member.user_role.slice(1)}
                        </span>
                        <span className={`ml-2 text-xs ${getActivityColor(member.activity_score)}`}>
                          Activity: {member.activity_score}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEditMember(member)}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    {member.is_active && (
                      <button
                        onClick={() => handleDeactivateMember(member.id)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-2 sm:flex sm:justify-between">
                  <div className="sm:flex">
                    <p className="flex items-center text-sm text-gray-500">
                      <UsersIcon className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                      Member since {formatDate(member.created_at)}
                    </p>
                    <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                      <EyeIcon className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                      Last login {formatDate(member.last_login)}
                    </p>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6">Recent Team Activity</h3>
        <div className="space-y-4">
          {teamAnalytics.recent_activity.map((activity) => (
            <div key={activity.id} className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <UsersIcon className="h-4 w-4 text-blue-600" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {activity.member}
                </p>
                <p className="text-sm text-gray-500">
                  {activity.action} - {activity.project}
                </p>
                <p className="text-xs text-gray-400">
                  {formatDate(activity.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Invite Team Member</h3>
              <form className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="colleague@company.com"
                  />
                </div>
                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                    Role
                  </label>
                  <select
                    id="role"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="staff">Staff</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Send Invitation
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 