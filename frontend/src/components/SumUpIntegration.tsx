import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Alert, 
  AlertDescription, 
  AlertTitle 
} from '@/components/ui/alert';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  CreditCard, 
  TrendingUp, 
  Settings, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  ExternalLink,
  Zap,
  DollarSign,
  Users,
  Clock
} from 'lucide-react';
import { api } from '@/lib/api';

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

interface SalesData {
  id: number;
  sumup_transaction_id: string;
  sumup_location_id: string;
  sale_time: string;
  sale_value: number;
  payment_type: string;
  customer_count: number;
  tip_amount: number;
  discount_amount: number;
  tax_amount: number;
  staff_id: number | null;
  shift_id: number | null;
  created_at: string;
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

interface SumUpLocation {
  id: number;
  sumup_location_id: string;
  sumup_location_name: string;
  localops_location_id: number | null;
  created_at: string;
}

interface SumUpIntegrationProps {
  businessId: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export const SumUpIntegration: React.FC<SumUpIntegrationProps> = ({ businessId }) => {
  const [status, setStatus] = useState<SumUpStatus | null>(null);
  const [upgradePrompt, setUpgradePrompt] = useState<SumUpUpgradePrompt | null>(null);
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [analytics, setAnalytics] = useState<SalesAnalytics | null>(null);
  const [logs, setLogs] = useState<IntegrationLog[]>([]);
  const [locations, setLocations] = useState<SumUpLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadIntegrationStatus();
  }, [businessId]);

  const loadIntegrationStatus = async () => {
    try {
      setLoading(true);
      const [statusRes, upgradeRes] = await Promise.all([
        api.get(`/integrations/sumup/${businessId}/status`),
        api.get(`/integrations/sumup/${businessId}/upgrade-prompt`)
      ]);
      
      setStatus(statusRes.data);
      setUpgradePrompt(upgradeRes.data);
      
      if (statusRes.data.is_connected && statusRes.data.is_entitled) {
        loadConnectedData();
      }
    } catch (error) {
      console.error('Error loading integration status:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadConnectedData = async () => {
    try {
      const [salesRes, analyticsRes, logsRes, locationsRes] = await Promise.all([
        api.get(`/integrations/sumup/${businessId}/sales`),
        api.get(`/integrations/sumup/${businessId}/analytics`),
        api.get(`/integrations/sumup/${businessId}/logs`),
        api.get(`/integrations/sumup/${businessId}/locations`)
      ]);
      
      setSalesData(salesRes.data);
      setAnalytics(analyticsRes.data);
      setLogs(logsRes.data);
      setLocations(locationsRes.data);
    } catch (error) {
      console.error('Error loading connected data:', error);
    }
  };

  const handleConnect = () => {
    // Redirect to SumUp OAuth
    const clientId = process.env.NEXT_PUBLIC_SUMUP_CLIENT_ID;
    const redirectUri = `${window.location.origin}/integrations/sumup/callback`;
    const authUrl = `https://api.sumup.com/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=payments.history`;
    
    window.location.href = authUrl;
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      await api.post(`/integrations/sumup/${businessId}/sync`, {
        force_sync: true
      });
      
      // Reload data after sync
      await loadConnectedData();
      await loadIntegrationStatus();
    } catch (error) {
      console.error('Error syncing data:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (confirm('Are you sure you want to disconnect SumUp integration? This will stop all data syncing.')) {
      try {
        await api.post(`/integrations/sumup/${businessId}/disconnect`, {
          revoke_tokens: true
        });
        
        setStatus(null);
        setSalesData([]);
        setAnalytics(null);
        setLogs([]);
        setLocations([]);
      } catch (error) {
        console.error('Error disconnecting:', error);
      }
    }
  };

  const getStatusBadge = () => {
    if (!status) return <Badge variant="secondary">Loading...</Badge>;
    
    if (!status.is_entitled) {
      return <Badge variant="destructive">Subscription Required</Badge>;
    }
    
    if (!status.is_connected) {
      return <Badge variant="secondary">Not Connected</Badge>;
    }
    
    switch (status.connection_status) {
      case 'connected':
        return <Badge variant="default" className="bg-green-500">Connected</Badge>;
      case 'expired':
        return <Badge variant="destructive">Token Expired</Badge>;
      case 'error':
        return <Badge variant="destructive">Connection Error</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getStatusIcon = () => {
    if (!status) return <AlertTriangle className="h-4 w-4" />;
    
    if (!status.is_entitled) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    
    if (status.is_connected && status.connection_status === 'connected') {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    
    return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading SumUp integration...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CreditCard className="h-8 w-8 text-blue-600" />
              <div>
                <CardTitle className="text-xl">SumUp POS Integration</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Connect your SumUp POS to unlock sales-driven scheduling insights
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusIcon()}
              {getStatusBadge()}
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {!status?.is_entitled && upgradePrompt && (
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Upgrade Required</AlertTitle>
              <AlertDescription>
                SumUp integration requires a paid bolt-on subscription. 
                <Button 
                  variant="link" 
                  className="p-0 h-auto font-normal"
                  onClick={() => window.open(upgradePrompt.upgrade_url, '_blank')}
                >
                  Upgrade now for £{upgradePrompt.bolt_on_price}/month
                </Button>
              </AlertDescription>
            </Alert>
          )}
          
          {status?.is_entitled && !status?.is_connected && (
            <div className="space-y-4">
              <Alert>
                <Zap className="h-4 w-4" />
                <AlertTitle>Ready to Connect</AlertTitle>
                <AlertDescription>
                  Connect your SumUp account to start syncing sales data and unlock powerful scheduling insights.
                </AlertDescription>
              </Alert>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {upgradePrompt?.features_unlocked.map((feature, index) => (
                  <div key={index} className="flex items-center space-x-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
              
              <Button onClick={handleConnect} className="w-full md:w-auto">
                <ExternalLink className="h-4 w-4 mr-2" />
                Connect SumUp Account
              </Button>
            </div>
          )}
          
          {status?.is_connected && status?.is_entitled && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Last 7 Days</p>
                  <p className="font-semibold">£{status.last_7_days_sales.toFixed(2)}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <CreditCard className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Transactions</p>
                  <p className="font-semibold">{status.total_transactions}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-purple-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Locations</p>
                  <p className="font-semibold">{status.location_count}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Last Sync</p>
                  <p className="font-semibold">
                    {status.last_sync_at 
                      ? new Date(status.last_sync_at).toLocaleDateString()
                      : 'Never'
                    }
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connected Data Tabs */}
      {status?.is_connected && status?.is_entitled && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Integration Dashboard</CardTitle>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleSync}
                  disabled={syncing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync Now'}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleDisconnect}
                >
                  Disconnect
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
                <TabsTrigger value="transactions">Transactions</TabsTrigger>
                <TabsTrigger value="logs">Logs</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Daily Sales Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Daily Sales</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {analytics && (
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={analytics.daily_sales}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="total_sales" fill="#0088FE" />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                  
                  {/* Hourly Patterns */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Hourly Sales Patterns</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {analytics && (
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={analytics.hourly_patterns}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="hour" />
                            <YAxis />
                            <Tooltip />
                            <Line type="monotone" dataKey="total_sales" stroke="#00C49F" />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                </div>
                
                {/* Top Items */}
                {analytics && analytics.top_items.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Top Selling Items</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={analytics.top_items}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="total_revenue"
                            >
                              {analytics.top_items.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                        
                        <div className="space-y-2">
                          {analytics.top_items.map((item, index) => (
                            <div key={index} className="flex justify-between items-center p-2 border rounded">
                              <span className="font-medium">{item.item_name}</span>
                              <span className="text-sm text-muted-foreground">
                                £{item.total_revenue.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
              
              <TabsContent value="analytics" className="space-y-4">
                {analytics ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-2xl font-bold">
                            £{analytics.daily_sales.reduce((sum, day) => sum + day.total_sales, 0).toFixed(2)}
                          </div>
                          <p className="text-sm text-muted-foreground">Total Sales ({analytics.period.days} days)</p>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-2xl font-bold">
                            {analytics.daily_sales.reduce((sum, day) => sum + day.transaction_count, 0)}
                          </div>
                          <p className="text-sm text-muted-foreground">Total Transactions</p>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-2xl font-bold">
                            £{(analytics.daily_sales.reduce((sum, day) => sum + day.total_sales, 0) / 
                               analytics.daily_sales.reduce((sum, day) => sum + day.transaction_count, 1)).toFixed(2)}
                          </div>
                          <p className="text-sm text-muted-foreground">Average Transaction</p>
                        </CardContent>
                      </Card>
                    </div>
                    
                    {/* Peak Hours Analysis */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Peak Hours Analysis</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-6 gap-2">
                          {analytics.hourly_patterns.map((hour) => (
                            <div key={hour.hour} className="text-center">
                              <div className="text-sm font-medium">{hour.hour}:00</div>
                              <div className="text-xs text-muted-foreground">
                                £{hour.total_sales.toFixed(0)}
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full" 
                                  style={{ 
                                    width: `${(hour.total_sales / Math.max(...analytics.hourly_patterns.map(h => h.total_sales))) * 100}%` 
                                  }}
                                ></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No analytics data available</p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="transactions" className="space-y-4">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Recent Transactions</h3>
                    <span className="text-sm text-muted-foreground">
                      {salesData.length} transactions
                    </span>
                  </div>
                  
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Payment</TableHead>
                          <TableHead>Customers</TableHead>
                          <TableHead>Location</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salesData.slice(0, 10).map((sale) => (
                          <TableRow key={sale.id}>
                            <TableCell>
                              {new Date(sale.sale_time).toLocaleString()}
                            </TableCell>
                            <TableCell className="font-medium">
                              £{sale.sale_value.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{sale.payment_type}</Badge>
                            </TableCell>
                            <TableCell>{sale.customer_count}</TableCell>
                            <TableCell>{sale.sumup_location_id}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="logs" className="space-y-4">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Integration Logs</h3>
                    <span className="text-sm text-muted-foreground">
                      {logs.length} recent operations
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    {logs.map((log) => (
                      <div key={log.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center space-x-2">
                              <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                                {log.operation}
                              </Badge>
                              <Badge variant="outline">{log.status}</Badge>
                            </div>
                            {log.message && (
                              <p className="text-sm mt-1">{log.message}</p>
                            )}
                            {log.error_message && (
                              <p className="text-sm text-red-600 mt-1">{log.error_message}</p>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}; 