import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { 
  Cog6ToothIcon as Settings, 
  UsersIcon as Users, 
  CurrencyDollarIcon as DollarSign, 
  ChartBarIcon as Activity, 
  EyeIcon as Eye, 
  PowerIcon as Power, 
  PowerIcon as PowerOff,
  ArrowPathIcon as RefreshCw,
  ChartBarIcon as TrendingUp,
  ExclamationTriangleIcon as AlertTriangle,
  CheckCircleIcon as CheckCircle,
  XCircleIcon as XCircle,
  ClockIcon as Clock,
  BoltIcon as Zap
} from '@heroicons/react/24/outline';
import { useAuth, useAuthenticatedAPI } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

interface BusinessBoltOnStatus {
  business_id: number;
  business_name: string;
  subscription_tier: string;
  bolt_on_type: string;
  is_enabled: boolean;
  is_entitled: boolean;
  last_sync_at: string | null;
  usage_30d: number | null;
  connection_status: string;
  error_message: string | null;
}

interface BoltOnAdminDashboard {
  bolt_on_type: string;
  platform_enabled: boolean;
  monthly_price: number;
  total_businesses: number;
  active_subscriptions: number;
  total_revenue: number;
  businesses: BusinessBoltOnStatus[];
}

interface BoltOnUsageAnalytics {
  business_id: number;
  business_name: string;
  period: string;
  total_sales: number;
  transaction_count: number;
  average_transaction: number;
  peak_hours: Array<{
    hour: number;
    sales: number;
    transactions: number;
  }>;
  top_items: Array<{
    item_name: string;
    total_quantity: number;
    total_revenue: number;
  }>;
  sync_errors: number;
  last_sync_success: boolean;
}

export default function BoltOnAdminPage() {
  const { isAdmin, user } = useAuth();
  const { authenticatedFetch } = useAuthenticatedAPI();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<BoltOnAdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessBoltOnStatus | null>(null);
  const [analytics, setAnalytics] = useState<BoltOnUsageAnalytics | null>(null);
  const [configDialog, setConfigDialog] = useState(false);
  const [bulkActionDialog, setBulkActionDialog] = useState(false);
  const [monthlyPrice, setMonthlyPrice] = useState(29.99);
  const [platformEnabled, setPlatformEnabled] = useState(true);
  const [bulkAction, setBulkAction] = useState('enable_all');
  const [targetPlan, setTargetPlan] = useState('professional');

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

  useEffect(() => {
    if (!isAdmin()) {
      router.push('/login');
      return;
    }
    loadDashboard();
  }, [isAdmin, router]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch(`${API_BASE}/api/admin/bolt-ons/sumup_sync/dashboard`);
      const dashboardData = await response.json();
      setDashboard(dashboardData);
      setMonthlyPrice(dashboardData.monthly_price);
      setPlatformEnabled(dashboardData.platform_enabled);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const toggleBusinessBoltOn = async (businessId: number, enable: boolean) => {
    try {
      setSyncing(true);
      const response = await authenticatedFetch(`${API_BASE}/api/admin/bolt-ons/sumup_sync/toggle`, {
        method: 'POST',
        body: JSON.stringify({
          business_id: businessId,
          bolt_on_type: 'sumup_sync',
          enable,
          reason: `${enable ? 'Enabled' : 'Disabled'} by admin`
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success(result.message);
        loadDashboard(); // Refresh data
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error toggling bolt-on:', error);
      toast.error('Failed to toggle bolt-on');
    } finally {
      setSyncing(false);
    }
  };

  const loadBusinessAnalytics = async (business: BusinessBoltOnStatus) => {
    try {
      setSelectedBusiness(business);
      const response = await authenticatedFetch(`${API_BASE}/api/admin/bolt-ons/sumup_sync/business/${business.business_id}/analytics?period=30d`);
      const analyticsData = await response.json();
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast.error('Failed to load analytics');
    }
  };

  const updatePlatformConfig = async () => {
    try {
      const response = await authenticatedFetch(`${API_BASE}/api/admin/bolt-ons/sumup_sync/config`, {
        method: 'PUT',
        body: JSON.stringify({
          is_platform_enabled: platformEnabled,
          monthly_price: monthlyPrice
        })
      });
      
      if (response.ok) {
        toast.success('Configuration updated successfully');
        setConfigDialog(false);
        loadDashboard();
      } else {
        toast.error('Failed to update configuration');
      }
    } catch (error) {
      console.error('Error updating config:', error);
      toast.error('Failed to update configuration');
    }
  };

  const performBulkAction = async () => {
    try {
      const response = await authenticatedFetch(`${API_BASE}/api/admin/bolt-ons/sumup_sync/bulk-action`, {
        method: 'POST',
        body: JSON.stringify({
          bolt_on_type: 'sumup_sync',
          action: bulkAction,
          target_plan: targetPlan,
          reason: `Bulk ${bulkAction} by admin`
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success(result.message);
        setBulkActionDialog(false);
        loadDashboard();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error performing bulk action:', error);
      toast.error('Failed to perform bulk action');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">Active</span>;
      case 'inactive':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">Inactive</span>;
      case 'error':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">Error</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">Unknown</span>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'inactive':
        return <XCircle className="h-4 w-4 text-gray-600" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  if (!isAdmin()) {
    return <div>Access denied</div>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>SumUp Bolt-On Management - LocalOps AI</title>
        <meta name="description" content="Platform admin dashboard for SumUp POS bolt-on management" />
      </Head>

      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-xl">L</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">SumUp Bolt-On Management</h1>
                  <p className="text-sm text-gray-500">Platform Admin Dashboard</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setConfigDialog(true)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Configuration
                </button>
                <button
                  onClick={() => setBulkActionDialog(true)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Bulk Actions
                </button>
                <button
                  onClick={loadDashboard}
                  disabled={syncing}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {dashboard && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <Users className="h-6 w-6 text-gray-400" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Total Businesses</dt>
                          <dd className="text-lg font-medium text-gray-900">{dashboard.total_businesses}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <Activity className="h-6 w-6 text-gray-400" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Active Subscriptions</dt>
                          <dd className="text-lg font-medium text-gray-900">{dashboard.active_subscriptions}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <DollarSign className="h-6 w-6 text-gray-400" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Monthly Revenue</dt>
                          <dd className="text-lg font-medium text-gray-900">£{dashboard.monthly_price}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <TrendingUp className="h-6 w-6 text-gray-400" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">30-Day Sales</dt>
                          <dd className="text-lg font-medium text-gray-900">£{dashboard.total_revenue.toLocaleString()}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Platform Status */}
              <div className="bg-white shadow rounded-lg mb-8">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
                    <Zap className="h-5 w-5 mr-2" />
                    Platform Status
                  </h3>
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">
                        SumUp Bolt-On is currently{' '}
                        <span className={`font-medium ${platformEnabled ? 'text-green-600' : 'text-red-600'}`}>
                          {platformEnabled ? 'enabled' : 'disabled'}
                        </span>
                        {' '}platform-wide
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Monthly price: £{monthlyPrice} | Required plan: Professional+
                      </p>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={platformEnabled}
                        onChange={(e) => setPlatformEnabled(e.target.checked)}
                        disabled
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Businesses Table */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Business Bolt-On Status</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Business Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bolt-On Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Synced</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usage (30d)</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {dashboard.businesses.map((business) => (
                          <tr key={business.business_id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{business.business_name}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                                {business.subscription_tier}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-2">
                                {getStatusIcon(business.connection_status)}
                                {getStatusBadge(business.connection_status)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {business.last_sync_at ? (
                                <span>{new Date(business.last_sync_at).toLocaleString()}</span>
                              ) : (
                                <span className="text-gray-400">Never</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {business.usage_30d ? (
                                <span className="font-medium">£{business.usage_30d.toLocaleString()}</span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => loadBusinessAnalytics(business)}
                                  className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  View
                                </button>
                                <button
                                  onClick={() => toggleBusinessBoltOn(business.business_id, !business.is_enabled)}
                                  disabled={syncing}
                                  className={`inline-flex items-center px-3 py-1 border shadow-sm text-xs font-medium rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 ${
                                    business.is_enabled 
                                      ? 'border-red-300 text-red-700 bg-white hover:bg-red-50' 
                                      : 'border-transparent text-white bg-blue-600 hover:bg-blue-700'
                                  }`}
                                >
                                  {business.is_enabled ? (
                                    <>
                                      <PowerOff className="h-3 w-3 mr-1" />
                                      Disable
                                    </>
                                  ) : (
                                    <>
                                      <Power className="h-3 w-3 mr-1" />
                                      Enable
                                    </>
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Configuration Dialog */}
        {configDialog && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Platform Configuration</h3>
                <p className="text-sm text-gray-500 mb-4">Update SumUp bolt-on platform settings</p>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">Platform Enabled</label>
                    <input
                      type="checkbox"
                      checked={platformEnabled}
                      onChange={(e) => setPlatformEnabled(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Price (£)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={monthlyPrice}
                      onChange={(e) => setMonthlyPrice(parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="flex justify-end space-x-2 pt-4">
                    <button
                      onClick={() => setConfigDialog(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={updatePlatformConfig}
                      className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Action Dialog */}
        {bulkActionDialog && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Bulk Actions</h3>
                <p className="text-sm text-gray-500 mb-4">Perform actions on multiple businesses</p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                    <select
                      value={bulkAction}
                      onChange={(e) => setBulkAction(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="enable_all">Enable for All Businesses</option>
                      <option value="disable_all">Disable for All Businesses</option>
                      <option value="enable_for_plan">Enable for Professional Plan</option>
                      <option value="disable_for_plan">Disable for Professional Plan</option>
                    </select>
                  </div>
                  {(bulkAction === 'enable_for_plan' || bulkAction === 'disable_for_plan') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Target Plan</label>
                      <select
                        value={targetPlan}
                        onChange={(e) => setTargetPlan(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="starter">Starter</option>
                        <option value="professional">Professional</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </div>
                  )}
                  <div className="flex justify-end space-x-2 pt-4">
                    <button
                      onClick={() => setBulkActionDialog(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={performBulkAction}
                      className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Execute Action
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Analytics Dialog */}
        {selectedBusiness && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-3/4 max-w-4xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Analytics: {selectedBusiness.business_name}
                </h3>
                <p className="text-sm text-gray-500 mb-4">Usage analytics for the last 30 days</p>
                
                {analytics && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold">£{analytics.total_sales.toLocaleString()}</div>
                        <div className="text-sm text-gray-600">Total Sales</div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold">{analytics.transaction_count}</div>
                        <div className="text-sm text-gray-600">Transactions</div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold">£{analytics.average_transaction.toFixed(2)}</div>
                        <div className="text-sm text-gray-600">Avg Transaction</div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Peak Hours</h4>
                      <div className="space-y-2">
                        {analytics.peak_hours.map((hour, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span>{hour.hour}:00</span>
                            <span>£{hour.sales.toFixed(2)} ({hour.transactions} transactions)</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-sm">Sync Status:</span>
                      {analytics.last_sync_success ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span className="text-sm">
                        {analytics.sync_errors} errors in last 30 days
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => setSelectedBusiness(null)}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
} 