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
  
  HTTPClient http;
  String wifiUrl = String(firebaseHost) + "/device/wifi.json";
  
  http.begin(wifiUrl);
  int httpCode = http.GET();
  
  if (httpCode == 200) {
    String payload = http.getString();
    StaticJsonDocument<512> doc;
    deserializeJson(doc, payload);
    
    ssid = doc["ssid"].as<String>();
    password = doc["password"].as<String>();
    
    ssid.trim();
    password.trim();
    
    // If Firebase WiFi credentials are empty, use hardcoded ones
    if (ssid.length() == 0 || password.length() == 0) {
      ssid = String(hardcodedSSID);
      password = String(hardcodedPassword);
      Serial.println("Using hardcoded WiFi credentials");
    }
    
    Serial.println("Connecting to Wi-Fi: " + ssid);
    WiFi.begin(ssid.c_str(), password.c_str());
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
      // Blink status LED while connecting
      digitalWrite(statusLedPin, attempts % 2);
      delay(500);
      Serial.print(".");
      attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
      digitalWrite(statusLedPin, HIGH); // Status LED solid ON when connected
      Serial.println("\n✓ Connected to: " + ssid);
      Serial.println("IP Address: " + WiFi.localIP().toString());
    } else {
      digitalWrite(statusLedPin, LOW);
      Serial.println("\n✗ Failed to connect");
    }
  } else {
    Serial.println("Failed to fetch WiFi credentials from Firebase");
    Serial.println("Trying hardcoded WiFi...");
    
    // Fallback to hardcoded WiFi
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
    
    if (WiFi.status() == WL_CONNECTED) {
      digitalWrite(statusLedPin, HIGH);
      Serial.println("\n✓ Connected to: " + ssid);
      Serial.println("IP Address: " + WiFi.localIP().toString());
    } else {
      digitalWrite(statusLedPin, LOW);
      Serial.println("\n✗ Failed to connect");
    }
  }
  
  http.end();
}
