import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wifi } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const FIREBASE_URL = "https://smart-lumoswitch-v2-default-rtdb.asia-southeast1.firebasedatabase.app";

interface WiFiSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WiFiSetupDialog({ open, onOpenChange }: WiFiSetupDialogProps) {
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Load saved WiFi credentials when dialog opens
  useEffect(() => {
    if (open) {
      const savedSsid = localStorage.getItem("wifi-ssid");
      const savedPassword = localStorage.getItem("wifi-password");
      setSsid(savedSsid || "");
      setPassword(savedPassword || "");
    }
  }, [open]);

  const handleSaveWiFi = async () => {
    if (!ssid || !password) {
      toast({
        title: "Missing Information",
        description: "Please enter both WiFi name and password",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      // Send WiFi credentials to Firebase
      const response = await fetch(`${FIREBASE_URL}/device/wifi.json`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ssid: ssid,
          password: password
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to save WiFi settings`);
      }

      // Save locally for reference
      localStorage.setItem("wifi-ssid", ssid);
      localStorage.setItem("wifi-password", password);
      localStorage.setItem("wifi-configured", "true");

      toast({
        title: "WiFi Settings Saved",
        description: "ESP32 will connect to your WiFi network automatically",
      });

      setIsSaving(false);
      onOpenChange(false);
    } catch (error: any) {
      console.error("[WiFi Setup] Error:", error);

      toast({
        title: "Save Failed",
        description: error.message || "Could not save WiFi settings to cloud",
        variant: "destructive",
      });
      setIsSaving(false);
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
            <DialogTitle>WiFi Settings</DialogTitle>
          </div>
          <DialogDescription>Configure your ESP32's WiFi connection via the cloud</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="wifi-ssid">WiFi Name (SSID)</Label>
            <Input
              id="wifi-ssid"
              placeholder="e.g. MyHomeWiFi"
              value={ssid}
              onChange={(e) => setSsid(e.target.value)}
              className="bg-background text-foreground border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wifi-password">WiFi Password</Label>
            <Input
              id="wifi-password"
              type="password"
              placeholder="Enter WiFi password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-background text-foreground border-border"
            />
          </div>

          <Button 
            onClick={handleSaveWiFi} 
            disabled={isSaving} 
            className="w-full"
          >
            {isSaving ? "Saving..." : "Save WiFi Settings"}
          </Button>

          <div className="bg-muted/50 border border-border rounded-lg p-3">
            <p className="text-xs text-muted-foreground">
              💡 Your ESP32 will automatically connect to this WiFi network. Make sure your ESP32 is powered on and running the Firebase-enabled code.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
