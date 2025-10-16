import { Button } from "@/components/ui/button";
import { ArrowLeft, Mic } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from '@/assets/logo.png';

const About = () => {
  const navigate = useNavigate();

  const developers = [
    "Balmist John Balansag",
    "Erika Ramos",
    "Jonathan Lusica",
    "Jake Dela Cruz",
    "Jan Harold Feudo",
    "Jesryle Navarro",
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border p-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/home")}
            aria-label="Back to home"
            className="transition-transform hover:scale-110"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 glow-green">
              <img src={logo} alt="Smart LumoSwitch Logo" className="h-5 w-5 object-contain" />
            </div>
            <span className="font-semibold">Smart LumoSwitch</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8 relative">
        <div className="absolute inset-0 luminous-bg pointer-events-none" />
        <div className="max-w-2xl w-full space-y-6 animate-fade-in relative z-10">
          {/* Logo Section Outside Box */}
          <div className="flex flex-col items-center space-y-3">
            <div className="p-3 rounded-xl bg-primary/10 glow-green">
              <img src={logo} alt="Smart LumoSwitch Logo" className="h-12 w-12 sm:h-16 sm:w-16 object-contain" />
            </div>
            <p className="text-muted-foreground text-sm sm:text-base font-medium">Simple. Smart. Voice-Controlled.</p>
          </div>

          {/* About Section */}
          <div className="bg-card/80 backdrop-blur-sm border rounded-xl p-6 space-y-4 card-glow luminous-border">
            {/* Header */}
            <h2 className="text-xl sm:text-2xl font-bold text-center text-glow pb-4 border-b border-border/50">
              About Smart LumoSwitch
            </h2>

            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed text-center">
              Smart LumoSwitch is designed to simply control your smart plug through an intuitive app with two easy
              control methods:
            </p>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="bg-background/50 rounded-lg p-3 border border-border/50 transition-all hover:border-primary/30">
                <div className="flex items-center gap-2 mb-1">
                  <img src={logo} alt="Switch Control" className="h-4 w-4 object-contain" />
                  <h3 className="font-semibold text-foreground text-sm">Switch Control</h3>
                </div>
                <p className="text-xs text-muted-foreground">Instant ON/OFF control</p>
              </div>

              <div className="bg-background/50 rounded-lg p-3 border border-border/50 transition-all hover:border-primary/30">
                <div className="flex items-center gap-2 mb-1">
                  <Mic className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-foreground text-sm">Voice Control</h3>
                </div>
                <p className="text-xs text-muted-foreground">Hands-free operation</p>
              </div>
            </div>
          </div>

          {/* Developers Section */}
          <div className="bg-card/80 backdrop-blur-sm border rounded-xl p-4 sm:p-5 space-y-3 card-glow luminous-border">
            <h2 className="text-base sm:text-lg font-semibold text-center mb-3">Development Team</h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-2xl mx-auto">
              {developers.map((developer, index) => (
                <div
                  key={index}
                  className="bg-background/50 rounded-lg py-2.5 px-2 border border-border/50 text-center transition-all hover:border-primary/50 hover:scale-105"
                >
                  <p className="text-xs sm:text-sm font-medium leading-tight">{developer}</p>
                </div>
              ))}
            </div>

            <div className="pt-2.5 border-t border-border text-center mt-3">
              <p className="text-xs text-muted-foreground">© 2025 Smart LumoSwitch Team</p>
            </div>
          </div>

          {/* Back Button */}
          <div className="flex justify-center">
            <Button onClick={() => navigate("/home")} size="lg" className="transition-all hover:scale-105 glow-green">
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
