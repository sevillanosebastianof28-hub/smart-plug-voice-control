import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Power, Mic, MicOff, Settings, LogOut } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const Home = () => {
  const [plugStatus, setPlugStatus] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [feedback, setFeedback] = useState('Say "Hey Smart Plug" to start');
  const { user, logout } = useAuth();

  useEffect(() => {
    const savedStatus = localStorage.getItem('plug-status');
    if (savedStatus) {
      setPlugStatus(savedStatus === 'true');
    }
  }, []);

  const togglePlug = () => {
    const newStatus = !plugStatus;
    setPlugStatus(newStatus);
    localStorage.setItem('plug-status', String(newStatus));
    toast({
      title: newStatus ? 'Plug turned ON' : 'Plug turned OFF',
      description: newStatus ? 'Device is now powered' : 'Device is now off'
    });
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
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setFeedback('Listening... Say "turn on" or "turn off"');
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      setFeedback(`You said: "${transcript}"`);

      if (transcript.includes('turn on') || transcript.includes('on')) {
        setPlugStatus(true);
        localStorage.setItem('plug-status', 'true');
        setFeedback('Command received: Turning ON');
        toast({ title: 'Plug turned ON', description: 'Voice command executed' });
      } else if (transcript.includes('turn off') || transcript.includes('off')) {
        setPlugStatus(false);
        localStorage.setItem('plug-status', 'false');
        setFeedback('Command received: Turning OFF');
        toast({ title: 'Plug turned OFF', description: 'Voice command executed' });
      } else {
        setFeedback('Command not recognized. Try "turn on" or "turn off"');
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 glow-green">
              <Power className="h-5 w-5 text-primary" />
            </div>
            <span className="font-semibold">Smart Plug Voice</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {user?.email}
            </span>
            <Button variant="ghost" size="icon" title="Settings">
              <Settings className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={logout} title="Logout">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full space-y-12">
          {/* Power Button */}
          <div className="flex flex-col items-center space-y-6">
            <button
              onClick={togglePlug}
              className={`relative w-48 h-48 rounded-full transition-all duration-300 ${
                plugStatus
                  ? 'bg-primary glow-green scale-105'
                  : 'bg-secondary hover:bg-secondary/80'
              }`}
            >
              <Power
                className={`absolute inset-0 m-auto h-24 w-24 transition-all duration-300 ${
                  plugStatus ? 'text-primary-foreground rotate-180' : 'text-muted-foreground'
                }`}
              />
            </button>

            <div className="text-center space-y-2">
              <h2 className={`text-3xl font-bold ${plugStatus ? 'text-glow' : ''}`}>
                Plug is {plugStatus ? 'ON' : 'OFF'}
              </h2>
              <p className="text-muted-foreground">
                Tap the button to toggle power
              </p>
            </div>
          </div>

          {/* Voice Control */}
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Voice Control</h3>
                {isListening && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-sm text-primary">Listening...</span>
                  </div>
                )}
              </div>

              <p className="text-sm text-muted-foreground min-h-[40px] flex items-center">
                {feedback}
              </p>

              <Button
                onClick={startListening}
                disabled={isListening}
                className={`w-full ${isListening ? 'glow-cyan' : ''}`}
                size="lg"
              >
                {isListening ? (
                  <>
                    <MicOff className="mr-2 h-5 w-5" />
                    Listening...
                  </>
                ) : (
                  <>
                    <Mic className="mr-2 h-5 w-5" />
                    Start Voice Command
                  </>
                )}
              </Button>
            </div>

            <div className="bg-card/50 border border-border/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground text-center">
                <span className="font-medium text-foreground">Voice Commands:</span>{' '}
                "turn on" or "turn off"
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;
