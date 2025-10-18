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

  // Update current IP when dialog opens
  useEffect(() => {
    if (open) {
      const savedIp = localStorage.getItem('esp32-ip');
      setCurrentIp(savedIp);
      // Set default to new ESP32 IP
      setEsp32Ip(savedIp || '192.168.254.118');
    }
  }, [open]);

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
      // Test actual connection to ESP32
      const response = await fetch(`http://${esp32Ip}/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (!response.ok) {
        throw new Error('Failed to connect to ESP32');
      }

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
    } catch (error) {
      console.error('ESP32 connection error:', error);
      toast({
        title: 'Connection Failed',
        description: 'Could not reach ESP32. Please verify the IP address and ensure the device is powered on and connected to your network.',
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
              className="bg-secondary border-border"
            />
            <p className="text-xs text-muted-foreground">
              Find your ESP32 IP in your router's device list
            </p>
          </div>

          <Button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full"
          >
            {isConnecting ? 'Connecting...' : 'Connect to Device'}
          </Button>

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
