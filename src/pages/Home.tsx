import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Power, Mic, MicOff, Wifi, LogOut, Info } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { WiFiSetupDialog } from '@/components/WiFiSetupDialog';
import { useNavigate } from 'react-router-dom';
import logo from '@/assets/logo.png';
import { supabase } from '@/integrations/supabase/client';

const Home = () => {
  const [plugStatus, setPlugStatus] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [feedback, setFeedback] = useState('Say "Hey Smart Plug" to start');
  const [wifiDialogOpen, setWifiDialogOpen] = useState(false);
  const [controlMode, setControlMode] = useState<'voice' | 'button'>('button');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user, session, logout } = useAuth();
  const navigate = useNavigate();
  const isMountedRef = useRef(true);
  const lastCommandTimeRef = useRef(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchESP32Status = useCallback(async (ip: string) => {
    try {
      if (!ip || ip === 'null' || !ip.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
        return;
      }

      const { data, error } = await supabase.functions.invoke('esp32-proxy', {
        body: { ip, endpoint: 'status' }
      });

      if (!error && data && data.status) {
        const remoteStatus = data.status === 'on';
        
        // Update local state if different from remote (only if component is still mounted)
        if (isMountedRef.current) {
          setPlugStatus(prevStatus => {
            if (remoteStatus !== prevStatus) {
              localStorage.setItem('plug-status', String(remoteStatus));
              return remoteStatus;
            }
            return prevStatus;
          });
        }
        return data;
      }
    } catch (error) {
      // Silently fail for polling - don't show toasts for every poll failure
      console.log('ESP32 status check failed (device may be offline)');
    }
  }, []);

  const sendCommandToESP32 = useCallback(async (ip: string, status: boolean, retryCount = 0): Promise<boolean> => {
    // Rate limiting: prevent spam (2 second minimum between requests)
    const now = Date.now();
    if (now - lastCommandTimeRef.current < 2000) {
      toast({
        title: 'Too Fast',
        description: 'Please wait 2 seconds between commands',
        variant: 'destructive'
      });
      return false;
    }
    lastCommandTimeRef.current = now;

    try {
      // Validate IP format
      if (!ip || ip === 'null' || !ip.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
        console.error('[ESP32 Control] Invalid IP address:', ip);
        toast({
          title: 'Connection Error',
          description: 'Invalid ESP32 IP. Please configure WiFi settings.',
          variant: 'destructive'
        });
        return false;
      }

      setIsLoading(true);
      
      console.log(`[ESP32 Control] Sending ${status ? 'ON' : 'OFF'} command to ${ip}`);

      const { data, error } = await supabase.functions.invoke('esp32-proxy', {
        body: { 
          ip, 
          endpoint: 'control',
          status: status ? 'on' : 'off'
        }
      });
      
      console.log(`[ESP32 Control] Response:`, { data, error });
      
      if (error) {
        throw new Error(error.message || 'Failed to send command');
      }
      
      console.log('[ESP32 Control] Command sent successfully:', data);
      
      // Verify the response
      if (data && data.status === (status ? 'on' : 'off')) {
        setIsLoading(false);
        return true;
      } else {
        throw new Error('Status mismatch');
      }
    } catch (error: any) {
      console.error('[ESP32 Control] Communication error:', error);
      
      // Retry once on failure
      if (retryCount === 0) {
        console.log('[ESP32 Control] Retrying command...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return sendCommandToESP32(ip, status, 1);
      }
      
      if (isMountedRef.current) {
        setIsLoading(false);
        
        let errorMessage = '⚠️ Unable to reach the ESP32. ';
        errorMessage += error.message || 'Make sure ESP32 is powered on and on the same WiFi.';
        
        toast({
          title: 'Connection Failed',
          description: errorMessage,
          variant: 'destructive'
        });
      }
      return false;
    }
  }, []);

  useEffect(() => {
    const savedStatus = localStorage.getItem('plug-status');
    if (savedStatus) {
      setPlugStatus(savedStatus === 'true');
    }
    
    const esp32Ip = localStorage.getItem('esp32-ip');
    setIsConnected(!!esp32Ip);
    
    // Initial status sync
    if (esp32Ip) {
      fetchESP32Status(esp32Ip);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleStorageChange = () => {
      const esp32Ip = localStorage.getItem('esp32-ip');
      setIsConnected(!!esp32Ip);
      
      // Fetch status when connection changes
      if (esp32Ip) {
        fetchESP32Status(esp32Ip);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [fetchESP32Status]);

  // Real-time status polling from ESP32
  useEffect(() => {
    const esp32Ip = localStorage.getItem('esp32-ip');
    if (!esp32Ip || !isConnected) return;

    // Poll ESP32 status every 3 seconds
    const pollInterval = setInterval(() => {
      if (isMountedRef.current) {
        fetchESP32Status(esp32Ip);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [isConnected, fetchESP32Status]);

  const togglePlug = async () => {
    const newStatus = !plugStatus;
    setPlugStatus(newStatus);
    localStorage.setItem('plug-status', String(newStatus));
    
    // Send command to ESP32 if connected
    const esp32Ip = localStorage.getItem('esp32-ip');
    if (esp32Ip) {
      const success = await sendCommandToESP32(esp32Ip, newStatus);
      if (success) {
        toast({
          title: newStatus ? '✅ LED is ON' : '💤 LED is OFF',
          description: newStatus ? 'Device is now powered' : 'Device is now off'
        });
      }
    } else {
      toast({
        title: newStatus ? '✅ LED is ON' : '💤 LED is OFF',
        description: newStatus ? 'Device is now powered' : 'Device is now off'
      });
    }
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast({
        title: 'Not supported',
        description: 'Speech recognition is not supported in your browser',
        variant: 'destructive'
      });
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = true; // Enable interim results for real-time caption
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setFeedback('Listening...');
    };

    recognition.onresult = async (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Show real-time interim results
      if (interimTranscript) {
        setFeedback(`You said: "${interimTranscript}"`);
      }

      // Process final result
      if (finalTranscript) {
        const transcriptLower = finalTranscript.toLowerCase().trim();
        setFeedback(`You said: "${finalTranscript}"`);

        const esp32Ip = localStorage.getItem('esp32-ip');
        
        // Check for "turn on" commands
        if (
          transcriptLower.includes('turn on') || 
          transcriptLower.includes('switch on') ||
          transcriptLower.includes('activate') ||
          transcriptLower === 'on'
        ) {
          setFeedback('Sure! Turning on the LED now...');
          const newStatus = true;
          setPlugStatus(newStatus);
          localStorage.setItem('plug-status', 'true');
          
          if (esp32Ip) {
            const success = await sendCommandToESP32(esp32Ip, newStatus);
            if (success) {
              setFeedback('✅ The LED is now on.');
              toast({ 
                title: '✅ LED is ON', 
                description: 'Voice command executed successfully' 
              });
            }
          } else {
            toast({ 
              title: '✅ LED is ON', 
              description: 'Voice command executed (offline mode)' 
            });
          }
        } 
        // Check for "turn off" commands
        else if (
          transcriptLower.includes('turn off') || 
          transcriptLower.includes('switch off') ||
          transcriptLower.includes('deactivate') ||
          transcriptLower === 'off'
        ) {
          setFeedback('Sure! Turning off the LED now...');
          const newStatus = false;
          setPlugStatus(newStatus);
          localStorage.setItem('plug-status', 'false');
          
          if (esp32Ip) {
            const success = await sendCommandToESP32(esp32Ip, newStatus);
            if (success) {
              setFeedback('💤 The LED is now off.');
              toast({ 
                title: '💤 LED is OFF', 
                description: 'Voice command executed successfully' 
              });
            }
          } else {
            toast({ 
              title: '💤 LED is OFF', 
              description: 'Voice command executed (offline mode)' 
            });
          }
        }
        // Check for status commands
        else if (
          transcriptLower.includes('status') ||
          transcriptLower.includes('check') ||
          transcriptLower.includes('is the led') ||
          transcriptLower.includes('is the light') ||
          transcriptLower.includes('what') && transcriptLower.includes('led')
        ) {
          setFeedback('Checking LED status...');
          
          if (esp32Ip) {
            const statusData = await fetchESP32Status(esp32Ip);
            if (statusData) {
              const currentStatus = statusData.status === 'on';
              const statusText = currentStatus ? 'on' : 'off';
              const emoji = currentStatus ? '💡' : '💤';
              setFeedback(`${emoji} The LED is currently ${statusText}.`);
              toast({ 
                title: `LED Status: ${statusText.toUpperCase()}`,
                description: `${emoji} The LED is currently ${statusText}.`
              });
            }
          } else {
            const localStatus = plugStatus ? 'on' : 'off';
            const emoji = plugStatus ? '💡' : '💤';
            setFeedback(`${emoji} The LED is currently ${localStatus} (offline mode).`);
            toast({ 
              title: `LED Status: ${localStatus.toUpperCase()}`,
              description: `${emoji} The LED is currently ${localStatus} (offline mode).`
            });
          }
        }
        else {
          setFeedback('Command not recognized. Try: "turn on", "turn off", or "check status"');
          toast({
            title: 'Command Not Recognized',
            description: 'Try: "turn on the light", "turn off", or "check status"',
            variant: 'destructive'
          });
        }
      }
    };

    recognition.onerror = (event: any) => {
      setFeedback(`Error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setTimeout(() => {
        if (feedback.includes('✅') || feedback.includes('💤') || feedback.includes('💡')) {
          // Keep the success message visible
        } else if (!feedback.includes('Command')) {
          setFeedback('Say "Hey Smart Plug" to start');
        }
      }, 3000);
    };

    recognition.start();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      <div className="absolute inset-0 luminous-bg pointer-events-none" />
      
      {/* Header */}
      <header className="border-b border-border p-4 transition-all relative z-10 bg-background/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 glow-green transition-all hover:scale-110">
              <img src={logo} alt="Smart LumoSwitch Logo" className="h-7 w-7 object-contain" />
            </div>
            <span className="font-semibold text-sm sm:text-base">Smart LumoSwitch</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-xs sm:text-sm text-muted-foreground hidden md:inline">
              {user?.email}
            </span>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/about')}
              title="About"
              aria-label="About page"
              className="transition-transform hover:scale-110"
            >
              <Info className="h-5 w-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setWifiDialogOpen(true)}
              title="WiFi Setup"
              aria-label="Open WiFi setup"
              className="transition-transform hover:scale-110"
            >
              <Wifi className="h-5 w-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={logout} 
              title="Logout"
              aria-label="Logout"
              className="transition-transform hover:scale-110"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8 relative z-10">
        <div className="max-w-2xl w-full space-y-8 sm:space-y-12 animate-fade-in">
          
          {/* ESP32 Connection Status */}
          <div className={`bg-card/80 backdrop-blur-sm border rounded-xl p-4 transition-all luminous-border ${
            isConnected ? 'border-primary/30' : 'border-destructive/30'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-primary animate-pulse' : 'bg-destructive'}`} />
                <span className="text-sm font-medium">
                  {isConnected ? 'ESP32 Connected' : 'ESP32 Not Connected'}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setWifiDialogOpen(true)}
                className="text-xs"
              >
                {isConnected ? 'Reconfigure' : 'Setup WiFi'}
              </Button>
            </div>
            {!isConnected && (
              <p className="text-xs text-muted-foreground mt-2">
                Please connect to your ESP32 smart plug via WiFi Setup before controlling the device.
              </p>
            )}
          </div>
          <div className="flex flex-col items-center space-y-6">
            <Button
              onClick={togglePlug}
              variant="ghost"
              size="icon"
              aria-label={plugStatus ? 'Turn plug off' : 'Turn plug on'}
              className={`relative w-40 h-40 sm:w-48 sm:h-48 md:w-56 md:h-56 rounded-full transition-all duration-500 hover:scale-105 ${
                plugStatus
                  ? 'bg-primary glow-green scale-105'
                  : 'bg-secondary hover:bg-secondary/80'
              }`}
            >
              <Power
                className={`absolute inset-0 m-auto h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28 transition-all duration-500 ${
                  plugStatus ? 'text-primary-foreground rotate-180' : 'text-muted-foreground'
                }`}
              />
            </Button>

            <div className="text-center space-y-2 transition-all">
              <h2 className={`text-2xl sm:text-3xl md:text-4xl font-bold transition-all ${plugStatus ? 'text-glow' : ''}`}>
                {isLoading ? 'Sending...' : `Plug is ${plugStatus ? 'ON' : 'OFF'}`}
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                {isLoading 
                  ? '⏳ Communicating with ESP32...' 
                  : plugStatus 
                    ? '✅ Device is currently powered' 
                    : '💤 Device is currently off'
                }
              </p>
              <p className="text-xs text-muted-foreground/70">
                {controlMode === 'button' ? 'Tap the button to toggle' : 'Use voice commands below'}
              </p>
            </div>
          </div>

          {/* Control Mode Switcher */}
          <div className="flex gap-2 p-1 bg-card border border-border rounded-lg transition-all">
            <Button
              variant={controlMode === 'button' ? 'default' : 'ghost'}
              className="flex-1 transition-all text-xs sm:text-sm"
              onClick={() => setControlMode('button')}
            >
              <Power className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Button Control</span>
              <span className="sm:hidden">Button</span>
            </Button>
            <Button
              variant={controlMode === 'voice' ? 'default' : 'ghost'}
              className="flex-1 transition-all text-xs sm:text-sm"
              onClick={() => setControlMode('voice')}
            >
              <Mic className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Voice Control</span>
              <span className="sm:hidden">Voice</span>
            </Button>
          </div>

          {/* Button Control */}
          {controlMode === 'button' && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-card/80 backdrop-blur-sm border rounded-xl p-4 sm:p-6 space-y-4 card-glow luminous-border">
                <h3 className="text-base sm:text-lg font-semibold text-center">Manual Control</h3>
                <p className="text-xs sm:text-sm text-muted-foreground text-center">
                  Use the buttons below to control your smart plug
                </p>
                
                <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-2">
                  <Button
                    onClick={async () => {
                      setPlugStatus(true);
                      localStorage.setItem('plug-status', 'true');
                      const esp32Ip = localStorage.getItem('esp32-ip');
                      if (esp32Ip) {
                        const success = await sendCommandToESP32(esp32Ip, true);
                        if (success) {
                          toast({ title: '✅ LED is ON', description: 'Device is now powered' });
                        }
                      } else {
                        toast({ title: '✅ LED is ON', description: 'Device is now powered' });
                      }
                    }}
                    disabled={plugStatus || isLoading}
                    className="h-16 sm:h-20 text-sm sm:text-lg transition-all hover:scale-105"
                    variant={plugStatus ? 'secondary' : 'default'}
                  >
                    <Power className="mr-1 sm:mr-2 h-5 w-5 sm:h-6 sm:w-6" />
                    {isLoading && !plugStatus ? 'Sending...' : 'Turn ON'}
                  </Button>
                  
                  <Button
                    onClick={async () => {
                      setPlugStatus(false);
                      localStorage.setItem('plug-status', 'false');
                      const esp32Ip = localStorage.getItem('esp32-ip');
                      if (esp32Ip) {
                        const success = await sendCommandToESP32(esp32Ip, false);
                        if (success) {
                          toast({ title: '💤 LED is OFF', description: 'Device is now off' });
                        }
                      } else {
                        toast({ title: '💤 LED is OFF', description: 'Device is now off' });
                      }
                    }}
                    disabled={!plugStatus || isLoading}
                    className="h-16 sm:h-20 text-sm sm:text-lg transition-all hover:scale-105"
                    variant={!plugStatus ? 'secondary' : 'default'}
                  >
                    <Power className="mr-1 sm:mr-2 h-5 w-5 sm:h-6 sm:w-6" />
                    {isLoading && plugStatus ? 'Sending...' : 'Turn OFF'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Voice Control */}
          {controlMode === 'voice' && (
            <div className="space-y-4 sm:space-y-6 animate-fade-in">
              {/* Real-time Voice Caption */}
              {isListening && (
                <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 sm:p-6 animate-fade-in glow-cyan">
                  <div className="flex items-center gap-2 mb-2">
                    <Mic className="h-4 w-4 text-primary animate-pulse" />
                    <span className="text-sm font-semibold text-primary">You're saying:</span>
                  </div>
                  <p className="text-lg sm:text-xl font-medium text-foreground min-h-[32px]">
                    {feedback.includes('You said:') 
                      ? feedback.replace('You said: ', '').replace(/"/g, '') 
                      : feedback === 'Listening...' 
                      ? 'Speak now...' 
                      : feedback}
                  </p>
                </div>
              )}

              <div className="bg-card/80 backdrop-blur-sm border rounded-xl p-4 sm:p-6 space-y-4 card-glow luminous-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-base sm:text-lg font-semibold">Voice Control</h3>
                  {isListening && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      <span className="text-xs sm:text-sm text-primary">Listening...</span>
                    </div>
                  )}
                </div>

                {!isListening && (
                  <p className="text-xs sm:text-sm text-muted-foreground min-h-[40px] flex items-center transition-all">
                    {feedback}
                  </p>
                )}

                <Button
                  onClick={startListening}
                  disabled={isListening}
                  className={`w-full transition-all hover:scale-105 ${isListening ? 'glow-cyan' : ''}`}
                  size="lg"
                >
                  {isListening ? (
                    <>
                      <MicOff className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                      <span className="text-sm sm:text-base">Listening...</span>
                    </>
                  ) : (
                    <>
                      <Mic className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                      <span className="text-sm sm:text-base">Start Voice Command</span>
                    </>
                  )}
                </Button>
              </div>

              <div className="bg-card/50 border border-border/50 rounded-lg p-3 sm:p-4 transition-all luminous-border">
                <p className="text-xs sm:text-sm text-muted-foreground text-center">
                  <span className="font-medium text-foreground">Voice Commands:</span>{' '}
                  "turn on the light", "turn off", "activate", "deactivate", "check status"
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      <WiFiSetupDialog open={wifiDialogOpen} onOpenChange={setWifiDialogOpen} />
    </div>
  );
};

export default Home;
