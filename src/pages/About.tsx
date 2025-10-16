import { Button } from '@/components/ui/button';
import { ArrowLeft, Power, Mic } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const About = () => {
  const navigate = useNavigate();

  const developers = [
    'Name 1',
    'Name 2',
    'Name 3',
    'Name 4',
    'Name 5',
    'Jake Dela Cruz'
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border p-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/home')}
            className="transition-transform hover:scale-110"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 glow-green">
              <Power className="h-5 w-5 text-primary" />
            </div>
            <span className="font-semibold">Smart LumoSwitch</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8">
        <div className="max-w-3xl w-full space-y-8 animate-fade-in">
          {/* App Title */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-glow">
              Smart LumoSwitch
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Simple. Smart. Voice-Controlled.
            </p>
          </div>

          {/* About Section */}
          <div className="bg-card border border-border rounded-xl p-6 sm:p-8 space-y-6 transition-all hover:border-primary/50">
            <h2 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
              <Power className="h-5 w-5 text-primary" />
              About This App
            </h2>
            
            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p className="text-sm sm:text-base">
                Smart LumoSwitch is designed to simply control your smart plug through an intuitive mobile and web application.
              </p>
              
              <p className="text-sm sm:text-base">
                With two easy control methods, you have complete flexibility:
              </p>

              <div className="grid sm:grid-cols-2 gap-4 my-6">
                <div className="bg-background/50 rounded-lg p-4 border border-border/50 transition-all hover:border-primary/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Power className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-foreground text-sm sm:text-base">Switch Control</h3>
                  </div>
                  <p className="text-xs sm:text-sm">
                    Simple ON/OFF buttons for instant control of your devices
                  </p>
                </div>

                <div className="bg-background/50 rounded-lg p-4 border border-border/50 transition-all hover:border-primary/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Mic className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-foreground text-sm sm:text-base">Voice Control</h3>
                  </div>
                  <p className="text-xs sm:text-sm">
                    Hands-free operation with natural voice commands
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Developers Section */}
          <div className="bg-card border border-border rounded-xl p-6 sm:p-8 space-y-6 transition-all hover:border-primary/50">
            <h2 className="text-xl sm:text-2xl font-semibold">Developed By</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {developers.map((developer, index) => (
                <div
                  key={index}
                  className="bg-background/50 rounded-lg p-3 sm:p-4 border border-border/50 text-center transition-all hover:border-primary/50 hover:scale-105"
                >
                  <p className="text-sm sm:text-base font-medium">{developer}</p>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-border text-center">
              <p className="text-sm text-muted-foreground">
                © 2025 Smart LumoSwitch Team
              </p>
            </div>
          </div>

          {/* Back Button */}
          <div className="flex justify-center pt-4">
            <Button
              onClick={() => navigate('/home')}
              size="lg"
              className="transition-all hover:scale-105"
            >
              <ArrowLeft className="mr-2 h-5 w-5" />
              Back to Home
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default About;
