import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { 
  CreditCardIcon, 
  Cog6ToothIcon, 
  ExclamationTriangleIcon, 
  CheckCircleIcon, 
  XCircleIcon, 
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  BoltIcon,
  CurrencyDollarIcon,
  UsersIcon,
  ClockIcon,
  ChartBarIcon,
  DocumentTextIcon,
  PowerIcon,
  NoSymbolIcon,
  PlusIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../hooks/useAuth';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface SumUpStatus {
  is_connected: boolean;
  is_entitled: boolean;
  last_sync_at: string | null;
  sync_frequency_hours: number;
  merchant_id: string | null;
  location_count: number;
  total_transactions: number;
  last_7_days_sales: number;
  connection_status: string;
  error_message: string | null;
}

interface SumUpUpgradePrompt {
  show_upgrade: boolean;
  current_plan: string;
  required_plan: string;
  bolt_on_price: number;
  features_unlocked: string[];
  upgrade_url: string | null;
}

interface SalesAnalytics {
  period: {
    start_date: string;
    end_date: string;
    days: number;
  };
  daily_sales: Array<{
    date: string;
    total_sales: number;
    transaction_count: number;
    average_transaction: number;
  }>;
  hourly_patterns: Array<{
    hour: number;
    total_sales: number;
    transaction_count: number;
  }>;
  top_items: Array<{
    item_name: string;
    total_quantity: number;
    total_revenue: number;
  }>;
}

interface IntegrationLog {
  id: number;
  operation: string;
  status: string;
  message: string | null;
  details: any;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
}

export default function IntegrationsDashboard() {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<SumUpStatus | null>(null);
  const [upgradePrompt, setUpgradePrompt] = useState<SumUpUpgradePrompt | null>(null);
  const [analytics, setAnalytics] = useState<SalesAnalytics | null>(null);
  const [logs, setLogs] = useState<IntegrationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [showConnectModal, setShowConnectModal] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadIntegrationStatus();
  }, [user, router]);

  const loadIntegrationStatus = async () => {
    try {
      setLoading(true);
      const [statusRes, upgradeRes] = await Promise.all([
        api.getSumUpStatus(user.business_id),
        api.getSumUpUpgradePrompt(user.business_id)
      ]);
      
      setStatus(statusRes);
      setUpgradePrompt(upgradeRes);
      
      if (statusRes.is_connected && statusRes.is_entitled) {
        loadConnectedData();
      }
    } catch (error) {
      console.error('Error loading integration status:', error);
      toast.error('Failed to load integration status');
    } finally {
      setLoading(false);
    }
  };

  const loadConnectedData = async () => {
    try {
      const [analyticsRes, logsRes] = await Promise.all([
        api.getSumUpAnalytics(user.business_id),
        api.getSumUpLogs(user.business_id)
      ]);
      
      setAnalytics(analyticsRes);
      setLogs(logsRes);
    } catch (error) {
      console.error('Error loading connected data:', error);
    }
  };

  const handleConnect = () => {
    // Redirect to SumUp OAuth
    const sumupClientId = process.env.NEXT_PUBLIC_SUMUP_CLIENT_ID;
    const redirectUri = `${window.location.origin}/integrations/sumup/callback`;
    const authUrl = `https://api.sumup.com/authorize?client_id=${sumupClientId}&redirect_uri=${redirectUri}&response_type=code&scope=payments.history`;
    
    window.location.href = authUrl;
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const response = await api.syncSumUp(user.business_id, {
        business_id: user.business_id,
        force_sync: true
      });

      if (response.success) {
        toast.success(`Sync completed: ${response.transactions_synced} transactions synced`);
        loadIntegrationStatus();
      } else {
        toast.error('Sync failed');
      }
    } catch (error) {
      console.error('Error syncing:', error);
      toast.error('Failed to sync data');
    } finally {
      setSyncing(false);
    }
  };

  const handleToggle = async (enable: boolean) => {
    try {
      const response = await api.toggleSumUpIntegration(user.business_id, {
        enable
      });

      if (response.success) {
        toast.success(enable ? 'Integration enabled' : 'Integration disabled');
        loadIntegrationStatus();
      } else {
        toast.error('Failed to toggle integration');
      }
    } catch (error) {
      console.error('Error toggling integration:', error);
      toast.error('Failed to toggle integration');
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your SumUp account? This will stop all data synchronization.')) {
      return;
    }

    try {
      const response = await api.disconnectSumUp(user.business_id, {
        business_id: user.business_id,
        revoke_tokens: true
      });

      if (response.success) {
        toast.success('Successfully disconnected from SumUp');
        loadIntegrationStatus();
      } else {
        toast.error('Failed to disconnect');
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error('Failed to disconnect');
    }
  };

  const getStatusBadge = () => {
    if (!status) return null;

    if (!status.is_entitled) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
          <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
          Upgrade Required
        </span>
      );
    }

    if (!status.is_connected) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
          <XCircleIcon className="h-3 w-3 mr-1" />
          Not Connected
        </span>
      );
    }

    switch (status.connection_status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
            <CheckCircleIcon className="h-3 w-3 mr-1" />
            Connected
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
            <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
            Error
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
            <ClockIcon className="h-3 w-3 mr-1" />
            Inactive
          </span>
        );
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading integration status...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Integrations - LocalOps AI</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
                <p className="text-gray-600">Connect your business tools and automate workflows</p>
              </div>
              <div className="flex items-center space-x-3">
                {getStatusBadge()}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* SumUp Integration Card */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <CreditCardIcon className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">SumUp POS Integration</h2>
                    <p className="text-gray-600">Automatically sync sales data and unlock advanced scheduling insights</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  {status?.is_entitled && status?.is_connected && (
                    <button
                      onClick={() => handleSync()}
                      disabled={syncing}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <ArrowPathIcon className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                      {syncing ? 'Syncing...' : 'Sync Now'}
                    </button>
                  )}
                  
                  {status?.is_entitled && status?.is_connected && (
                    <button
                      onClick={() => handleToggle(false)}
                      className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <NoSymbolIcon className="h-4 w-4 mr-2" />
                      Disable
                    </button>
                  )}
                  
                  {status?.is_entitled && !status?.is_connected && (
                    <button
                      onClick={() => handleToggle(true)}
                      className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <PowerIcon className="h-4 w-4 mr-2" />
                      Enable
                    </button>
                  )}
                  
                  {!status?.is_entitled && (
                    <button
                      onClick={() => router.push('/billing/upgrade?bolt_on=sumup_sync')}
                      className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <PlusIcon className="h-4 w-4 mr-2" />
                      Upgrade to Enable
                    </button>
                  )}
                  
                  {status?.is_entitled && !status?.is_connected && (
                    <button
                      onClick={handleConnect}
                      className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <ArrowTopRightOnSquareIcon className="h-4 w-4 mr-2" />
                      Connect Account
                    </button>
                  )}
                </div>
              </div>

              {/* Status Information */}
              {status && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center">
                      <CurrencyDollarIcon className="h-5 w-5 text-gray-400 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-gray-500">Last 7 Days Sales</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {formatCurrency(status.last_7_days_sales)}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center">
                      <UsersIcon className="h-5 w-5 text-gray-400 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-gray-500">Locations</p>
                        <p className="text-lg font-semibold text-gray-900">{status.location_count}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center">
                      <ChartBarIcon className="h-5 w-5 text-gray-400 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-gray-500">Total Transactions</p>
                        <p className="text-lg font-semibold text-gray-900">{status.total_transactions}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center">
                      <ClockIcon className="h-5 w-5 text-gray-400 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-gray-500">Last Sync</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {status.last_sync_at ? formatDate(status.last_sync_at) : 'Never'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {status?.error_message && (
                <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
                  <div className="flex">
                    <ExclamationCircleIcon className="h-5 w-5 text-red-400 mr-2 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-medium text-red-800">Integration Error</h3>
                      <p className="text-sm text-red-700 mt-1">{status.error_message}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Upgrade Prompt */}
              {upgradePrompt?.show_upgrade && (
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-md p-4">
                  <div className="flex">
                    <BoltIcon className="h-5 w-5 text-blue-400 mr-2 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-blue-800">Upgrade Required</h3>
                      <p className="text-sm text-blue-700 mt-1">
                        SumUp integration requires a {upgradePrompt.required_plan} plan or higher. 
                        Current plan: {upgradePrompt.current_plan}
                      </p>
                      <div className="mt-3">
                        <h4 className="text-sm font-medium text-blue-800 mb-2">Features you'll unlock:</h4>
                        <ul className="text-sm text-blue-700 space-y-1">
                          {upgradePrompt.features_unlocked.map((feature, index) => (
                            <li key={index} className="flex items-center">
                              <CheckCircleIcon className="h-3 w-3 mr-2" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="mt-4">
                        <button
                          onClick={() => router.push('/billing/upgrade?bolt_on=sumup_sync')}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          Upgrade Now - {formatCurrency(upgradePrompt.bolt_on_price)}/month
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tabs */}
              {status?.is_connected && status?.is_entitled && (
                <div className="border-t pt-6">
                  <div className="flex space-x-8">
                    <button
                      onClick={() => setActiveTab('overview')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        activeTab === 'overview'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Overview
                    </button>
                    <button
                      onClick={() => setActiveTab('analytics')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        activeTab === 'analytics'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Analytics
                    </button>
                    <button
                      onClick={() => setActiveTab('logs')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        activeTab === 'logs'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Logs
                    </button>
                  </div>

                  {/* Tab Content */}
                  <div className="mt-6">
                    {activeTab === 'overview' && analytics && (
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-lg font-medium text-gray-900 mb-4">Daily Sales Overview</h3>
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <p className="text-sm font-medium text-gray-500">Total Sales</p>
                                <p className="text-2xl font-bold text-gray-900">
                                  {formatCurrency(analytics.daily_sales.reduce((sum, day) => sum + day.total_sales, 0))}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-500">Transactions</p>
                                <p className="text-2xl font-bold text-gray-900">
                                  {analytics.daily_sales.reduce((sum, day) => sum + day.transaction_count, 0)}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-500">Average Transaction</p>
                                <p className="text-2xl font-bold text-gray-900">
                                  {formatCurrency(analytics.daily_sales.reduce((sum, day) => sum + day.average_transaction, 0) / analytics.daily_sales.length)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-lg font-medium text-gray-900 mb-4">Peak Hours</h3>
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <div className="grid grid-cols-6 gap-2">
                              {analytics.hourly_patterns.slice(0, 6).map((hour, index) => (
                                <div key={index} className="text-center">
                                  <p className="text-sm font-medium text-gray-900">{hour.hour}:00</p>
                                  <p className="text-xs text-gray-500">{formatCurrency(hour.total_sales)}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'analytics' && analytics && (
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-lg font-medium text-gray-900 mb-4">Top Selling Items</h3>
                          <div className="bg-white border rounded-lg overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {analytics.top_items.slice(0, 5).map((item, index) => (
                                  <tr key={index}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.item_name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.total_quantity}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(item.total_revenue)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'logs' && (
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Integration Logs</h3>
                        <div className="bg-white border rounded-lg overflow-hidden">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Operation</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {logs.slice(0, 10).map((log) => (
                                <tr key={log.id}>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {formatDate(log.created_at)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {log.operation}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                      log.status === 'success' 
                                        ? 'bg-green-100 text-green-800' 
                                        : log.status === 'error'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {log.status}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-sm text-gray-500">
                                    {log.message || log.error_message || '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 