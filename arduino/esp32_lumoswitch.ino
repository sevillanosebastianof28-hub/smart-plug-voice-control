#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// Hardcoded WiFi credentials (fallback/default)
const char* hardcodedSSID = "Kuha ka sarili internet mo!";
const char* hardcodedPassword = "novjanaugjan!";

const char* firebaseHost = "https://smart-lumoswitch-v2-default-rtdb.asia-southeast1.firebasedatabase.app";
const char* firebaseAuth = ""; // Optional if public/test mode

int mainLedPin = 2;   // Main light control
int statusLedPin = 4; // Status indicator
int lastState = -1;

String ssid = "";
String password = "";

void setup() {
  Serial.begin(115200);
  pinMode(mainLedPin, OUTPUT);
  pinMode(statusLedPin, OUTPUT);
  
  // Blink status LED to show startup
  for(int i = 0; i < 3; i++) {
    digitalWrite(statusLedPin, HIGH);
    delay(200);
    digitalWrite(statusLedPin, LOW);
    delay(200);
  }
  
  connectWiFiFromFirebase();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    digitalWrite(statusLedPin, LOW); // Status LED OFF when disconnected
    Serial.println("WiFi disconnected. Reconnecting...");
    connectWiFiFromFirebase();
  } else {
    digitalWrite(statusLedPin, HIGH); // Status LED ON when connected
  }

  HTTPClient http;
  String url = String(firebaseHost) + "/device/light.json";
  http.begin(url);
  int httpCode = http.GET();

  if (httpCode == 200) {
    String payload = http.getString();
    int state = payload.toInt();

    if (state != lastState) {
      lastState = state;
      digitalWrite(mainLedPin, state ? HIGH : LOW);
      Serial.println(state ? "💡 MAIN LED ON" : "💡 MAIN LED OFF");
    }
  } else {
    Serial.println("Failed to fetch light state");
  }
  
  http.end();
  delay(2000);
}

void connectWiFiFromFirebase() {
  digitalWrite(statusLedPin, LOW); // Status LED OFF while connecting
  
  // FIRST: Connect using hardcoded WiFi to establish internet connection
  Serial.println("Connecting to hardcoded WiFi...");
  ssid = String(hardcodedSSID);
  password = String(hardcodedPassword);
  WiFi.begin(ssid.c_str(), password.c_str());
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    digitalWrite(statusLedPin, attempts % 2);
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() != WL_CONNECTED) {
    digitalWrite(statusLedPin, LOW);
    Serial.println("\n✗ Failed to connect to hardcoded WiFi");
    return;
  }
  
  digitalWrite(statusLedPin, HIGH);
  Serial.println("\n✓ Connected to: " + ssid);
  Serial.println("IP Address: " + WiFi.localIP().toString());
  
  // SECOND: Now that we have internet, check Firebase for updated WiFi credentials
  Serial.println("Checking Firebase for updated WiFi credentials...");
  HTTPClient http;
  String wifiUrl = String(firebaseHost) + "/device/wifi.json";
  
  http.begin(wifiUrl);
  int httpCode = http.GET();
  
  if (httpCode == 200) {
    String payload = http.getString();
    StaticJsonDocument<512> doc;
    deserializeJson(doc, payload);
    
    String newSsid = doc["ssid"].as<String>();
    String newPassword = doc["password"].as<String>();
    
    newSsid.trim();
    newPassword.trim();
    
    // If Firebase has different credentials, reconnect to the new WiFi
    if (newSsid.length() > 0 && newPassword.length() > 0 && newSsid != ssid) {
      Serial.println("Found new WiFi in Firebase: " + newSsid);
      Serial.println("Reconnecting to new WiFi...");
      
      WiFi.disconnect();
      delay(1000);
      
      ssid = newSsid;
      password = newPassword;
      WiFi.begin(ssid.c_str(), password.c_str());
      
      attempts = 0;
      while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        digitalWrite(statusLedPin, attempts % 2);
        delay(500);
        Serial.print(".");
        attempts++;
      }
      
      if (WiFi.status() == WL_CONNECTED) {
        digitalWrite(statusLedPin, HIGH);
        Serial.println("\n✓ Connected to new WiFi: " + ssid);
        Serial.println("IP Address: " + WiFi.localIP().toString());
      } else {
        digitalWrite(statusLedPin, LOW);
        Serial.println("\n✗ Failed to connect to new WiFi, reverting...");
        
        // Revert to hardcoded WiFi
        ssid = String(hardcodedSSID);
        password = String(hardcodedPassword);
        WiFi.begin(ssid.c_str(), password.c_str());
        delay(5000);
      }
    } else {
      Serial.println("No new WiFi credentials in Firebase, staying connected.");
    }
  } else {
    Serial.println("Could not fetch WiFi from Firebase (HTTP " + String(httpCode) + ")");
  }
  
  http.end();
}
