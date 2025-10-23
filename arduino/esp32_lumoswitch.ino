#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// LED Pins
const int mainLedPin = 2;    // Main LED control
const int statusLedPin = 4;  // Status indicator LED

// Hardcoded WiFi credentials (fallback)
const char* defaultSSID = "Kuha ka sarili internet mo!";
const char* defaultPassword = "novjanaugjan!";

// Firebase Configuration
const char* firebaseHost = "https://smart-lumoswitch-v2-default-rtdb.asia-southeast1.firebasedatabase.app";
const char* devicePath = "/device.json";

// Variables
String currentSSID = "";
String currentPassword = "";
bool ledState = false;
unsigned long lastFirebaseCheck = 0;
const unsigned long firebaseCheckInterval = 2000; // Check every 2 seconds

void setup() {
  Serial.begin(115200);
  pinMode(mainLedPin, OUTPUT);
  pinMode(statusLedPin, OUTPUT);
  
  // Startup blink sequence on status LED
  Serial.println("\n=== ESP32 LumoSwitch Starting ===");
  for(int i = 0; i < 3; i++) {
    digitalWrite(statusLedPin, HIGH);
    delay(200);
    digitalWrite(statusLedPin, LOW);
    delay(200);
  }
  
  digitalWrite(mainLedPin, LOW);
  digitalWrite(statusLedPin, LOW);
  
  // Try to connect with default WiFi first
  connectWiFi(defaultSSID, defaultPassword);
  
  // If connected, fetch WiFi credentials from Firebase
  if(WiFi.status() == WL_CONNECTED) {
    checkForNewWiFiCredentials();
  }
}

void loop() {
  // Update status LED based on WiFi connection
  digitalWrite(statusLedPin, WiFi.status() == WL_CONNECTED ? HIGH : LOW);
  
  // If WiFi disconnected, try to reconnect
  if(WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected. Reconnecting...");
    connectWiFi(currentSSID.isEmpty() ? defaultSSID : currentSSID.c_str(), 
                currentPassword.isEmpty() ? defaultPassword : currentPassword.c_str());
    delay(5000);
    return;
  }
  
  // Check Firebase periodically
  if(millis() - lastFirebaseCheck >= firebaseCheckInterval) {
    lastFirebaseCheck = millis();
    
    // Check for new WiFi credentials
    checkForNewWiFiCredentials();
    
    // Check light state
    checkLightState();
  }
  
  delay(100);
}

void connectWiFi(const char* ssid, const char* password) {
  Serial.println("\n--- Connecting to WiFi ---");
  Serial.print("SSID: ");
  Serial.println(ssid);
  
  digitalWrite(statusLedPin, LOW);
  WiFi.disconnect();
  delay(100);
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while(WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    // Blink status LED while connecting
    digitalWrite(statusLedPin, !digitalRead(statusLedPin));
    attempts++;
  }
  
  Serial.println();
  
  if(WiFi.status() == WL_CONNECTED) {
    digitalWrite(statusLedPin, HIGH);
    Serial.println("✓ Connected to: " + String(ssid));
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    currentSSID = String(ssid);
    currentPassword = String(password);
  } else {
    digitalWrite(statusLedPin, LOW);
    Serial.println("✗ Failed to connect to: " + String(ssid));
  }
}

void checkForNewWiFiCredentials() {
  if(WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  String url = String(firebaseHost) + "/device/wifi.json";
  
  http.begin(url);
  int httpCode = http.GET();
  
  if(httpCode == 200) {
    String payload = http.getString();
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, payload);
    
    if(!error) {
      String newSSID = doc["ssid"] | "";
      String newPassword = doc["password"] | "";
      
      // Check if credentials have changed and are not empty
      if(newSSID.length() > 0 && newPassword.length() > 0) {
        if(newSSID != currentSSID || newPassword != currentPassword) {
          Serial.println("\n🔄 New WiFi credentials detected!");
          Serial.println("New SSID: " + newSSID);
          
          // Try to connect with new credentials
          connectWiFi(newSSID.c_str(), newPassword.c_str());
        }
      }
    }
  }
  
  http.end();
}

void checkLightState() {
  if(WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  String url = String(firebaseHost) + "/device/light.json";
  
  http.begin(url);
  int httpCode = http.GET();
  
  if(httpCode == 200) {
    String payload = http.getString();
    int lightValue = payload.toInt();
    bool newState = (lightValue == 1);
    
    if(newState != ledState) {
      ledState = newState;
      digitalWrite(mainLedPin, ledState ? HIGH : LOW);
      Serial.println(ledState ? "💡 MAIN LED ON" : "💡 MAIN LED OFF");
    }
  }
  
  http.end();
}
