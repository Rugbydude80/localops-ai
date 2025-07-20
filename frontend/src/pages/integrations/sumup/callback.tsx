import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';

interface OAuthResponse {
  success: boolean;
  message: string;
  integration_id?: number;
  error?: string;
}

export default function SumUpCallback() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [businessId, setBusinessId] = useState<number | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const { code, state, error } = router.query;
      
      if (error) {
        setStatus('error');
        setMessage('Authorization was denied or an error occurred.');
        return;
      }

      if (!code) {
        setStatus('error');
        setMessage('No authorization code received from SumUp.');
        return;
      }

      // Extract business ID from state parameter
      const businessIdFromState = state ? parseInt(state as string) : null;
      if (!businessIdFromState) {
        setStatus('error');
        setMessage('Invalid business ID in callback.');
        return;
      }

      setBusinessId(businessIdFromState);

      try {
        const response = await api.post<OAuthResponse>('/integrations/sumup/oauth', {
          business_id: businessIdFromState,
          authorization_code: code,
          redirect_uri: `${window.location.origin}/integrations/sumup/callback`
        });

        if (response.data.success) {
          setStatus('success');
          setMessage(response.data.message);
        } else {
          setStatus('error');
          setMessage(response.data.message || 'Failed to connect SumUp integration.');
        }
      } catch (error: any) {
        setStatus('error');
        setMessage(
          error.response?.data?.message || 
          'An error occurred while connecting to SumUp.'
        );
      }
    };

    if (router.isReady) {
      handleCallback();
    }
  }, [router.isReady, router.query]);

  const handleContinue = () => {
    if (businessId) {
      router.push(`/dashboard?business_id=${businessId}&tab=integrations`);
    } else {
      router.push('/dashboard');
    }
  };

  const handleRetry = () => {
    if (businessId) {
      router.push(`/integrations/sumup/connect?business_id=${businessId}`);
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {status === 'loading' && (
              <RefreshCw className="h-12 w-12 text-blue-600 animate-spin" />
            )}
            {status === 'success' && (
              <CheckCircle className="h-12 w-12 text-green-600" />
            )}
            {status === 'error' && (
              <XCircle className="h-12 w-12 text-red-600" />
            )}
          </div>
          <CardTitle>
            {status === 'loading' && 'Connecting to SumUp...'}
            {status === 'success' && 'Connection Successful!'}
            {status === 'error' && 'Connection Failed'}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {status === 'loading' && (
            <div className="text-center">
              <p className="text-muted-foreground">
                Please wait while we connect your SumUp account...
              </p>
            </div>
          )}

          {status === 'success' && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Success!</AlertTitle>
              <AlertDescription>
                {message}
              </AlertDescription>
            </Alert>
          )}

          {status === 'error' && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Connection Failed</AlertTitle>
              <AlertDescription>
                {message}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex space-x-2">
            {status === 'success' && (
              <Button onClick={handleContinue} className="flex-1">
                Continue to Dashboard
              </Button>
            )}
            
            {status === 'error' && (
              <>
                <Button onClick={handleRetry} variant="outline" className="flex-1">
                  Try Again
                </Button>
                <Button onClick={handleContinue} className="flex-1">
                  Go to Dashboard
                </Button>
              </>
            )}
          </div>

          {status === 'success' && (
            <div className="text-sm text-muted-foreground text-center">
              <p>Your SumUp integration is now active and will sync data automatically.</p>
              <p className="mt-2">
                You can manage your integration settings from the Integrations tab in your dashboard.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 