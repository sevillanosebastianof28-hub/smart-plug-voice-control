import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Power, Mic, MicOff, Wifi, LogOut, Info } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { WiFiSetupDialog } from '@/components/WiFiSetupDialog';
import { useNavigate } from 'react-router-dom';
import logo from '@/assets/logo.png';

const Home = () => {
  const [plugStatus, setPlugStatus] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [feedback, setFeedback] = useState('Say "Hey Smart Plug" to start');
  const [wifiDialogOpen, setWifiDialogOpen] = useState(false);
  const [controlMode, setControlMode] = useState<'voice' | 'button'>('button');
  const [isConnected, setIsConnected] = useState(false);
  const { user, session, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const savedStatus = localStorage.getItem('plug-status');
    if (savedStatus) {
      setPlugStatus(savedStatus === 'true');
    }
    
    const esp32Ip = localStorage.getItem('esp32-ip');
    setIsConnected(!!esp32Ip);
  }, []);

  useEffect(() => {
    const handleStorageChange = () => {
      const esp32Ip = localStorage.getItem('esp32-ip');
      setIsConnected(!!esp32Ip);
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const togglePlug = () => {
    const newStatus = !plugStatus;
    setPlugStatus(newStatus);
    localStorage.setItem('plug-status', String(newStatus));
    
    // Send command to ESP32 if connected
    const esp32Ip = localStorage.getItem('esp32-ip');
    if (esp32Ip) {
      sendCommandToESP32(esp32Ip, newStatus);
    }
    
    toast({
      title: newStatus ? 'Plug turned ON' : 'Plug turned OFF',
      description: newStatus ? 'Device is now powered' : 'Device is now off'
    });
  };

  const sendCommandToESP32 = async (ip: string, status: boolean) => {
    try {
      // Validate IP format
      if (!ip || ip === 'null' || !ip.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
        console.error('Invalid ESP32 IP address:', ip);
        toast({
          title: 'Connection Error',
          description: 'Invalid ESP32 IP. Please configure WiFi settings.',
          variant: 'destructive'
        });
        return;
      }

      // Get authentication token from current session
      const authToken = session?.access_token;

      const response = await fetch(`http://${ip}/toggle`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        },
        body: JSON.stringify({ state: status ? 'ON' : 'OFF' })
      });
      
      if (!response.ok) throw new Error('Failed to send command');
      
      console.log('Command sent successfully to ESP32');
    } catch (error) {
      console.error('ESP32 communication error:', error);
      toast({
        title: 'Connection Failed',
        description: 'Could not reach ESP32. Check WiFi connection.',
        variant: 'destructive'
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

    recognition.onresult = (event: any) => {
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
        const transcriptLower = finalTranscript.toLowerCase();
        setFeedback(`You said: "${finalTranscript}"`);

        if (transcriptLower.includes('turn on') || transcriptLower.includes('on')) {
          const newStatus = true;
          setPlugStatus(newStatus);
          localStorage.setItem('plug-status', 'true');
          setFeedback('Command received: Turning ON');
          
          const esp32Ip = localStorage.getItem('esp32-ip');
          if (esp32Ip) sendCommandToESP32(esp32Ip, newStatus);
          
          toast({ title: 'Plug turned ON', description: 'Voice command executed' });
        } else if (transcriptLower.includes('turn off') || transcriptLower.includes('off')) {
          const newStatus = false;
          setPlugStatus(newStatus);
          localStorage.setItem('plug-status', 'false');
          setFeedback('Command received: Turning OFF');
          
          const esp32Ip = localStorage.getItem('esp32-ip');
          if (esp32Ip) sendCommandToESP32(esp32Ip, newStatus);
          
          toast({ title: 'Plug turned OFF', description: 'Voice command executed' });
        } else {
          setFeedback('Command not recognized. Try "turn on" or "turn off"');
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
        if (feedback.includes('Command received')) {
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
              className="transition-transform hover:scale-110"
            >
              <Info className="h-5 w-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setWifiDialogOpen(true)}
              title="WiFi Setup"
              className="transition-transform hover:scale-110"
            >
              <Wifi className="h-5 w-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={logout} 
              title="Logout"
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
          {/* Power Button */}
          <div className="flex flex-col items-center space-y-6">
            <button
              onClick={togglePlug}
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
            </button>

            <div className="text-center space-y-2 transition-all">
              <h2 className={`text-2xl sm:text-3xl md:text-4xl font-bold transition-all ${plugStatus ? 'text-glow' : ''}`}>
                Plug is {plugStatus ? 'ON' : 'OFF'}
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                {plugStatus ? 'Device is currently powered' : 'Device is currently off'}
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
                    onClick={() => {
                      setPlugStatus(true);
                      localStorage.setItem('plug-status', 'true');
                      const esp32Ip = localStorage.getItem('esp32-ip');
                      if (esp32Ip) sendCommandToESP32(esp32Ip, true);
                      toast({ title: 'Plug turned ON' });
                    }}
                    disabled={plugStatus}
                    className="h-16 sm:h-20 text-sm sm:text-lg transition-all hover:scale-105"
                    variant={plugStatus ? 'secondary' : 'default'}
                  >
                    <Power className="mr-1 sm:mr-2 h-5 w-5 sm:h-6 sm:w-6" />
                    Turn ON
                  </Button>
                  
                  <Button
                    onClick={() => {
                      setPlugStatus(false);
                      localStorage.setItem('plug-status', 'false');
                      const esp32Ip = localStorage.getItem('esp32-ip');
                      if (esp32Ip) sendCommandToESP32(esp32Ip, false);
                      toast({ title: 'Plug turned OFF' });
                    }}
                    disabled={!plugStatus}
                    className="h-16 sm:h-20 text-sm sm:text-lg transition-all hover:scale-105"
                    variant={!plugStatus ? 'secondary' : 'default'}
                  >
                    <Power className="mr-1 sm:mr-2 h-5 w-5 sm:h-6 sm:w-6" />
                    Turn OFF
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
                  "turn on" or "turn off"
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
