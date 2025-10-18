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
import { supabase } from '@/integrations/supabase/client';

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
  const [isScanning, setIsScanning] = useState(false);
  const [foundDevices, setFoundDevices] = useState<string[]>([]);

  // Update current IP when dialog opens
  useEffect(() => {
    if (open) {
      const savedIp = localStorage.getItem('esp32-ip');
      setCurrentIp(savedIp);
      // Set default to new ESP32 IP
      setEsp32Ip(savedIp || '192.168.254.118');
      setTestResults([]);
      setFoundDevices([]);
    }
  }, [open]);

  const scanForESP32 = async () => {
    setIsScanning(true);
    setTestResults(['🔍 Scanning local network for ESP32 devices...']);
    const found: string[] = [];
    
    // Get the base IP from current network (assume 192.168.x.x)
    const baseIPs = [
      '192.168.1.',
      '192.168.0.',
      '192.168.254.',
      '192.168.100.',
      '10.0.0.'
    ];
    
    // Common IP ranges to check
    const commonIPs = [100, 101, 102, 110, 111, 112, 118, 150, 200];
    
    let checkedCount = 0;
    const totalToCheck = baseIPs.length * commonIPs.length;
    
    for (const base of baseIPs) {
      for (const last of commonIPs) {
        const testIp = `${base}${last}`;
        checkedCount++;
        
        setTestResults([
          '🔍 Scanning local network for ESP32 devices...',
          `📡 Checked ${checkedCount}/${totalToCheck} addresses`,
          `🔎 Currently testing: ${testIp}`,
          ...found.map(ip => `✅ Found: ${ip}`)
        ]);
        
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1000);
          
          const response = await fetch(`http://${testIp}/status`, {
            method: 'GET',
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const data = await response.json();
            // Check if it looks like our ESP32 (has "status" field)
            if (data && 'status' in data) {
              found.push(testIp);
              setFoundDevices(prev => [...prev, testIp]);
            }
          }
        } catch {
          // Ignore errors, just move to next IP
        }
      }
    }
    
    setTestResults([
      `✅ Scan complete! Checked ${totalToCheck} addresses`,
      '',
      found.length > 0 
        ? `🎉 Found ${found.length} ESP32 device(s):`
        : '❌ No ESP32 devices found',
      ...found.map(ip => `  • ${ip}`),
      '',
      found.length === 0 ? '💡 Tips:' : '',
      found.length === 0 ? '  • Make sure ESP32 is powered on' : '',
      found.length === 0 ? '  • Check Serial Monitor for actual IP' : '',
      found.length === 0 ? '  • Verify both devices on same WiFi' : '',
      found.length === 0 ? '  • Arduino code must have CORS headers' : ''
    ].filter(Boolean));
    
    // If found exactly one device, auto-fill it
    if (found.length === 1) {
      setEsp32Ip(found[0]);
      toast({
        title: 'ESP32 Found!',
        description: `Automatically set IP to ${found[0]}`
      });
    }
    
    setIsScanning(false);
  };

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

    // Test 2: Try via backend proxy (solves Mixed Content)
    try {
      results.push(`🔌 Testing connection via secure proxy...`);
      setTestResults([...results]);

      const response = await fetch('/functions/v1/esp32-proxy', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({ ip: esp32Ip, endpoint: 'status' })
      });

      const data = await response.json();
      
      if (response.ok && data.status) {
        results.push(`✅ ESP32 responded successfully!`);
        results.push(`📊 LED Status: ${data.status}`);
        results.push('🎉 Connection test PASSED - You can connect!');
        setTestResults([...results]);
      } else {
        results.push(`❌ Error: ${data.error || 'Unknown error'}`);
        results.push(`💡 Check: ESP32 powered on & on same WiFi network`);
        setTestResults([...results]);
      }
    } catch (error: any) {
      results.push(`❌ Connection failed: ${error.message}`);
      results.push('');
      results.push('🔧 Troubleshooting:');
      results.push('1. Is ESP32 powered on?');
      results.push('2. Check Serial Monitor - does it show "Server started!"?');
      results.push('3. Are you on the same WiFi network?');
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
      console.log(`[WiFi Setup] Attempting to connect to ESP32 at: ${esp32Ip}`);
      
      // Use backend proxy to avoid Mixed Content issues
      const response = await fetch('/functions/v1/esp32-proxy', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({ ip: esp32Ip, endpoint: 'status' }),
        signal: AbortSignal.timeout(8000)
      });

      console.log(`[WiFi Setup] Response status: ${response.status}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to connect to ESP32`);
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
      
      if (error.name === 'AbortError') {
        errorMessage += 'Connection timed out. Check if ESP32 is powered on and on the same network.';
      } else {
        errorMessage += error.message || 'Please verify IP address and ensure device is connected.';
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
            <div className="flex gap-2">
              <Input
                id="esp32-ip"
                placeholder="192.168.254.118"
                value={esp32Ip}
                onChange={(e) => setEsp32Ip(e.target.value)}
                className="bg-background text-foreground border-border font-mono text-base"
              />
              <Button
                onClick={scanForESP32}
                disabled={isScanning || isConnecting}
                variant="outline"
                size="icon"
                title="Auto-detect ESP32"
              >
                {isScanning ? '...' : '🔍'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Click 🔍 to auto-detect, or check Arduino Serial Monitor for IP
            </p>
          </div>

          {foundDevices.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs">Found Devices (click to select):</Label>
              <div className="flex flex-wrap gap-2">
                {foundDevices.map((ip) => (
                  <Button
                    key={ip}
                    onClick={() => setEsp32Ip(ip)}
                    variant={esp32Ip === ip ? "default" : "outline"}
                    size="sm"
                    className="font-mono text-xs"
                  >
                    {ip}
                  </Button>
                ))}
              </div>
            </div>
          )}

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
