import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wifi } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { z } from 'zod';

const ipSchema = z.string().ip({ version: 'v4', message: 'Invalid IPv4 address' });

interface WiFiSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WiFiSetupDialog({ open, onOpenChange }: WiFiSetupDialogProps) {
  const [esp32Ip, setEsp32Ip] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentIp, setCurrentIp] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<string[]>([]);

  // Update current IP when dialog opens
  useEffect(() => {
    if (open) {
      const savedIp = localStorage.getItem('esp32-ip');
      setCurrentIp(savedIp);
      // Set default to new ESP32 IP
      setEsp32Ip(savedIp || '192.168.254.118');
      setTestResults([]);
    }
  }, [open]);

  const handleTestConnection = async () => {
    const results: string[] = [];
    
    if (!esp32Ip) {
      toast({
        title: 'IP Required',
        description: 'Please enter an IP address to test',
        variant: 'destructive'
      });
      return;
    }

    setIsConnecting(true);
    setTestResults(['🔍 Starting connection test...']);
    results.push('🔍 Starting connection test...');

    // Test 1: IP format validation
    const validation = ipSchema.safeParse(esp32Ip);
    if (!validation.success) {
      results.push('❌ Invalid IP format');
      setTestResults(results);
      setIsConnecting(false);
      return;
    }
    results.push('✅ IP format is valid');
    setTestResults([...results]);

    // Test 2: Check if running on HTTPS
    const isHttps = window.location.protocol === 'https:';
    if (isHttps) {
      results.push('⚠️ Running on HTTPS - Mixed Content may block HTTP requests');
      results.push('💡 Try: Access http://192.168.254.118/status directly in browser');
    } else {
      results.push('✅ Running on HTTP - No Mixed Content issues');
    }
    setTestResults([...results]);

    // Test 3: Try to connect
    try {
      results.push(`🔌 Attempting to connect to http://${esp32Ip}/status...`);
      setTestResults([...results]);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`http://${esp32Ip}/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      results.push(`📡 Response received: HTTP ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        results.push(`✅ ESP32 responded successfully!`);
        results.push(`📊 Data: ${JSON.stringify(data)}`);
        results.push('🎉 Connection test PASSED - You can connect!');
        setTestResults([...results]);
      } else {
        results.push(`❌ HTTP error: ${response.status} ${response.statusText}`);
        setTestResults([...results]);
      }
    } catch (error: any) {
      results.push(`❌ Connection failed: ${error.name}`);
      results.push(`📝 ${error.message}`);
      
      if (error.name === 'TypeError' || error.message.includes('Failed to fetch')) {
        results.push('');
        results.push('🔧 Possible causes:');
        results.push('1. Mixed Content: HTTPS site blocking HTTP request');
        results.push('2. CORS: Arduino code missing CORS headers');
        results.push('3. Network: ESP32 not on same WiFi');
        results.push('4. ESP32: Device is offline or IP changed');
        results.push('');
        results.push('💡 Quick test: Open http://192.168.254.118/status in new tab');
      }
      
      setTestResults([...results]);
    }

    setIsConnecting(false);
  };

  const handleConnect = async () => {
    if (!esp32Ip) {
      toast({
        title: 'IP Required',
        description: 'Please enter your ESP32 IP address',
        variant: 'destructive'
      });
      return;
    }

    // Validate IP format
    const validation = ipSchema.safeParse(esp32Ip);
    if (!validation.success) {
      toast({
        title: 'Invalid IP Address',
        description: 'Please enter a valid IPv4 address (e.g., 192.168.1.100)',
        variant: 'destructive'
      });
      return;
    }

    setIsConnecting(true);

    try {
      console.log(`[WiFi Setup] Attempting to connect to ESP32 at: http://${esp32Ip}/status`);
      
      // Test actual connection to ESP32
      const response = await fetch(`http://${esp32Ip}/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      console.log(`[WiFi Setup] Response status: ${response.status}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to connect to ESP32`);
      }

      const data = await response.json();
      console.log('[WiFi Setup] ESP32 responded with:', data);

      // Connection successful
      localStorage.setItem('esp32-ip', esp32Ip);
      setCurrentIp(esp32Ip);
      
      // Trigger storage event for other components
      window.dispatchEvent(new Event('storage'));
      
      toast({
        title: 'Connected to ESP32',
        description: `Successfully connected to ${esp32Ip}`
      });
      
      setIsConnecting(false);
      onOpenChange(false);
    } catch (error: any) {
      console.error('[WiFi Setup] ESP32 connection error:', error);
      console.error('[WiFi Setup] Error type:', error.name);
      console.error('[WiFi Setup] Error message:', error.message);
      
      let errorMessage = 'Could not reach ESP32. ';
      
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        errorMessage += 'This may be due to:\n\n' +
          '1. Mixed Content: Your browser blocks HTTP requests from HTTPS sites\n' +
          '2. CORS: Missing CORS headers in Arduino code\n' +
          '3. Network: ESP32 not on same WiFi network\n' +
          '4. Firewall: Local firewall blocking the connection\n\n' +
          'Try accessing this app via HTTP (not HTTPS) or check ESP32 code has CORS headers.';
      } else if (error.name === 'AbortError') {
        errorMessage += 'Connection timed out. Check if ESP32 is powered on and on the same network.';
      }
      
      toast({
        title: 'Connection Failed',
        description: errorMessage,
        variant: 'destructive'
      });
      setIsConnecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Wifi className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>Connect to ESP32</DialogTitle>
          </div>
          <DialogDescription>
            Enter your ESP32 smart plug IP address to establish connection
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="esp32-ip">ESP32 IP Address</Label>
            <Input
              id="esp32-ip"
              placeholder="192.168.254.118"
              value={esp32Ip}
              onChange={(e) => setEsp32Ip(e.target.value)}
              className="bg-background text-foreground border-border font-mono text-base"
            />
            <p className="text-xs text-muted-foreground">
              Find your ESP32 IP in your router's device list
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleTestConnection}
              disabled={isConnecting}
              variant="outline"
              className="flex-1"
            >
              {isConnecting ? 'Testing...' : 'Test Connection'}
            </Button>
            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              className="flex-1"
            >
              {isConnecting ? 'Connecting...' : 'Connect'}
            </Button>
          </div>

          {testResults.length > 0 && (
            <div className="bg-muted/50 border border-border rounded-lg p-3 max-h-64 overflow-y-auto">
              <div className="space-y-1 font-mono text-xs">
                {testResults.map((result, index) => (
                  <div key={index} className="text-foreground/90">
                    {result}
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentIp && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
              <p className="text-sm">
                <span className="font-medium">Current Device:</span>{' '}
                <span className="text-primary">{currentIp}</span>
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
