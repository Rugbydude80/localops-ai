import React, { useState, useEffect } from 'react'
import { 
  ShieldCheckIcon, 
  ExclamationTriangleIcon,
  EyeIcon,
  LockClosedIcon,
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'

// Mock data for demonstration
const mockSecurityMetrics = {
  failed_login_attempts: 23,
  suspicious_activities: 5,
  permission_violations: 2,
  data_access_events: 156,
  system_health_score: 87.3,
  security_alerts: [
    {
      id: 1,
      type: "high_failed_logins",
      severity: "warning",
      message: "High number of failed login attempts detected",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      affected_users: 5
    },
    {
      id: 2,
      type: "unusual_access_pattern",
      severity: "info",
      message: "Unusual access pattern detected from new IP",
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
      affected_users: 1
    }
  ]
}

const mockComplianceReport = {
  total_audit_logs: 15420,
  total_security_events: 342,
  unresolved_security_events: 8,
  events_by_severity: {
    info: 245,
    warning: 67,
    error: 23,
    critical: 7
  },
  events_by_type: {
    login_failed: 156,
    permission_denied: 45,
    suspicious_activity: 23,
    data_access: 118
  },
  recent_incidents: [
    {
      id: 1,
      type: "login_failed",
      severity: "warning",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      user_email: "user@example.com",
      ip_address: "192.168.1.100",
      resolved: false
    },
    {
      id: 2,
      type: "permission_denied",
      severity: "error",
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
      user_email: "admin@techcorp.com",
      ip_address: "10.0.0.50",
      resolved: true
    }
  ],
  compliance_score: 94.7,
  last_audit_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
}

const mockSecurityTrend = [
  { date: '2024-11-01', failed_logins: 5, suspicious_activities: 1, violations: 0 },
  { date: '2024-11-02', failed_logins: 8, suspicious_activities: 2, violations: 1 },
  { date: '2024-11-03', failed_logins: 3, suspicious_activities: 0, violations: 0 },
  { date: '2024-11-04', failed_logins: 12, suspicious_activities: 3, violations: 1 },
  { date: '2024-11-05', failed_logins: 7, suspicious_activities: 1, violations: 0 },
  { date: '2024-11-06', failed_logins: 9, suspicious_activities: 2, violations: 1 },
  { date: '2024-11-07', failed_logins: 4, suspicious_activities: 0, violations: 0 }
]

export default function SecurityDashboard() {
  const [securityMetrics, setSecurityMetrics] = useState(mockSecurityMetrics)
  const [complianceReport, setComplianceReport] = useState(mockComplianceReport)
  const [securityTrend, setSecurityTrend] = useState(mockSecurityTrend)
  const [loading, setLoading] = useState(false)

  const COLORS = ['#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100'
      case 'error': return 'text-orange-600 bg-orange-100'
      case 'warning': return 'text-yellow-600 bg-yellow-100'
      case 'info': return 'text-blue-600 bg-blue-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (resolved: boolean) => {
    return resolved ? (
      <CheckCircleIcon className="h-4 w-4 text-green-500" />
    ) : (
      <XCircleIcon className="h-4 w-4 text-red-500" />
    )
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const severityData = Object.entries(complianceReport.events_by_severity).map(([severity, count]) => ({
    name: severity.charAt(0).toUpperCase() + severity.slice(1),
    value: count
  }))

  const eventTypeData = Object.entries(complianceReport.events_by_type).map(([type, count]) => ({
    name: type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value: count
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <ShieldCheckIcon className="h-8 w-8 text-blue-600 mr-3" />
          <h2 className="text-2xl font-bold text-gray-900">Security & Compliance</h2>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <ChartBarIcon className="h-5 w-5 text-gray-400" />
            <span className="text-sm text-gray-600">Last updated: {formatDate(new Date())}</span>
          </div>
        </div>
      </div>

      {/* Security Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Failed Logins</p>
              <p className="text-2xl font-bold text-gray-900">{securityMetrics.failed_login_attempts}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <ExclamationTriangleIcon className="h-4 w-4 text-red-500 mr-1" />
            <span className="text-sm text-red-600">Last 24 hours</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <EyeIcon className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Suspicious Activities</p>
              <p className="text-2xl font-bold text-gray-900">{securityMetrics.suspicious_activities}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500 mr-1" />
            <span className="text-sm text-yellow-600">Requires attention</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <LockClosedIcon className="h-8 w-8 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Permission Violations</p>
              <p className="text-2xl font-bold text-gray-900">{securityMetrics.permission_violations}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <CheckCircleIcon className="h-4 w-4 text-green-500 mr-1" />
            <span className="text-sm text-green-600">Low risk</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ChartBarIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">System Health</p>
              <p className="text-2xl font-bold text-gray-900">{securityMetrics.system_health_score}%</p>
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <CheckCircleIcon className="h-4 w-4 text-green-500 mr-1" />
            <span className="text-sm text-green-600">Good</span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Security Trend Chart */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6">Security Events Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={securityTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="failed_logins" stroke="#EF4444" strokeWidth={2} />
              <Line type="monotone" dataKey="suspicious_activities" stroke="#F59E0B" strokeWidth={2} />
              <Line type="monotone" dataKey="violations" stroke="#8B5CF6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Compliance Score */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6">Compliance Score</h3>
          <div className="text-center">
            <div className="relative inline-flex items-center justify-center w-32 h-32">
              <svg className="w-32 h-32 transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  className="text-gray-200"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={`${(complianceReport.compliance_score / 100) * 352} 352`}
                  className="text-green-500"
                />
              </svg>
              <div className="absolute">
                <span className="text-2xl font-bold text-gray-900">{complianceReport.compliance_score}%</span>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-4">Overall compliance score</p>
            <div className="mt-4 text-left">
              <div className="flex justify-between text-sm">
                <span>Audit Logs</span>
                <span>{complianceReport.total_audit_logs.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Security Events</span>
                <span>{complianceReport.total_security_events}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Unresolved</span>
                <span className="text-red-600">{complianceReport.unresolved_security_events}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security Alerts and Recent Incidents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Security Alerts */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6">Active Security Alerts</h3>
          <div className="space-y-4">
            {securityMetrics.security_alerts.map((alert) => (
              <div key={alert.id} className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg">
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{alert.message}</p>
                  <div className="flex items-center space-x-4 mt-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                      {alert.severity}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatDate(alert.timestamp)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {alert.affected_users} users affected
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Incidents */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6">Recent Security Incidents</h3>
          <div className="space-y-4">
            {complianceReport.recent_incidents.map((incident) => (
              <div key={incident.id} className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg">
                {getStatusIcon(incident.resolved)}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">{incident.type.replace('_', ' ')}</p>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(incident.severity)}`}>
                      {incident.severity}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{incident.user_email}</p>
                  <p className="text-xs text-gray-500">{incident.ip_address}</p>
                  <p className="text-xs text-gray-500 mt-1">{formatDate(incident.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Event Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Events by Severity */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6">Events by Severity</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={severityData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {severityData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Events by Type */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6">Events by Type</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={eventTypeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
} 