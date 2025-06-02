#include <WiFi.h>
#include <time.h>
#include <HTTPClient.h>

#include "config.h"

// Analog pins of the 4 pressure sensors
const int fsrPinA0 = A0;  
const int fsrPinA3 = A3;
const int fsrPinA4 = A4;
const int fsrPinA5 = A5;

// Variables where I save the read values
int fsrPinA0Value = 0;
int fsrPinA3Value = 0;
int fsrPinA4Value = 0;
int fsrPinA5Value = 0;

String date_time = "";
unsigned long lastRead = 0;
const unsigned long interval = 1000;


/*  - Initializes serial, Wi-Fi connection and time sync
    - Check if there is WiFi connection
    - Sets up sensor pins
    parameters: none
    return: void
    */
void setup() {

  Serial.begin(115200);

  // Set Wi-Fi mode to station (client)
  WiFi.mode(WIFI_STA);

  // Check if we are connected
  checkWiFiConnection();

  // Configure time synchronization using NTP server
  // Sets timezone to UTC+1 (3600 seconds offset) for Central European Time
  configTime(3600, 0, "pool.ntp.org");
  
  // Setup pin sensori
  pinMode(fsrPinA0, INPUT);
  pinMode(fsrPinA3, INPUT);
  pinMode(fsrPinA4, INPUT);
  pinMode(fsrPinA5, INPUT);

}


/*  Checks if the ESP32 is currently connected to a Wi-Fi network
    - If not connected, it attempt to connect to the specified hotspot using SSID and password
    - Tries up to 20 times with 500ms delay between each attempt
    - Prints the connection result and ESP32's assigned IP address
    parameters: none
    return: void
    */
void checkWiFiConnection() {

  // Check if the ESP32 is not connected to Wi-Fi
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected. Attempting to connect..."); // Debug

    // Force a disconnection to reset the Wi-Fi state
    WiFi.disconnect(true);
    delay(1000);

    // Attempt to connect to the hotspot using predefined SSID and password
    WiFi.begin(ssidHotspot, passwordHotspot);

    int retry = 0;

    // Try to connect for up to 20 attempts (approx. 10 seconds)
    while (WiFi.status() != WL_CONNECTED && retry < 20) {
      delay(500);
      Serial.print(".");
      retry++;
    }

    // Check if connection was successful
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\nConnected to WiFi. IP ESP32: " + WiFi.localIP().toString()); // Debug
    } 
    else {
      Serial.println("\nFailed to connect to HOTSPOT after 20 attempts!."); // Debug
    }
  }
}


/*  Gets the current date and time
      - Formats it as a string "YYYY-MM-DD HH:MM:SS"
    parameters: none
    return: String containing the formatted date and time 
    */
String getDateTime() {
  time_t now = time(nullptr);
  struct tm* timeinfo = localtime(&now);

  char buffer[30];
  strftime(buffer, sizeof(buffer), "%Y-%m-%d %H:%M:%S", timeinfo);
  return String(buffer);
}


/*  Builds a JSON string with ID chair, sensor values, timestamp and source of data
    parameters: none
    return: String containing the JSON data 
    */
String handleJSON() {
  String json = "{";
  json += "\"id\": \"" + IDchair + "\",";
  json += "\"sensors\": [";
  json += "{\"value\": " + String(fsrPinA3Value) + "},";
  json += "{\"value\": " + String(fsrPinA5Value) + "},";
  json += "{\"value\": " + String(fsrPinA0Value) + "},";
  json += "{\"value\": " + String(fsrPinA4Value) + "}";
  json += "],";
  json += "\"timestamp\": \"" + date_time + "\",";
  json += "\"source\": \"sensors\"";
  json += "}";

  return json;
}


/*  Sends JSON data to a server via HTTP POST
      - Tries to connect to the IP server (local)
      - Prints server response or error
    parameters: jsonData (String with JSON payload)
    return: void
    */
void sendDataToServer(String jsonData) {

  // Check if ESP32 is connected to Wi-Fi before attempting to send data
  if (WiFi.status() == WL_CONNECTED) {

    HTTPClient http;

    // Construct the server URL using the saved IP address
    String serverURL = "http://" + serverIP + ":3000/chair";

    // Start the HTTP connection with the server using the specified URL
    http.begin(serverURL);

    // Set a timeout of 5 seconds for the server to respond
    // If the server doesn't reply within this time, the request will fail
    http.setTimeout(5000);

    // Add a header to tell the server that we are sending JSON data
    http.addHeader("Content-Type", "application/json");

    // Send JSON data via POST and store the HTTP response code
    int httpResponseCode = http.POST(jsonData);
    Serial.print("HTTP Response Code: "); // Debug
    Serial.println(httpResponseCode);     // Debug
    
    // If the response code is positive, server responded successfully
    if (httpResponseCode > 0) {

      // Get and print the response from the server
      String response = http.getString();
      Serial.println("Server response: " + response); // Debug
    } 
    else {
      Serial.printf("Error sending to %s. Error: %s\n",
                    serverIP.c_str(),
                    http.errorToString(httpResponseCode).c_str());

      // Close the connection to free resources
      http.end();
      delay(100);
    }
    
  } 
  else {
    Serial.println("WiFi not connected!"); // Debug
  }
}


/* 
  Loop function:
    - Reads sensor values at regular intervals
    - Sends collected data as JSON to the server
    parameters: none
    return: void
    */
void loop() {
  
  // Make sure the ESP32 is connected to Wi-Fi
  checkWiFiConnection();

  // Check if the defined time interval has passed before reading sensors again
  unsigned long currentMillis = millis();
  if (currentMillis - lastRead >= interval) {
    lastRead = currentMillis;

    fsrPinA0Value = analogRead(fsrPinA0);
    fsrPinA3Value = analogRead(fsrPinA3);
    fsrPinA4Value = analogRead(fsrPinA4);
    fsrPinA5Value = analogRead(fsrPinA5);
   
    // Get current date and time
    date_time = getDateTime();

    // Generate JSON data and send to server
    String json = handleJSON();

    Serial.println("Invio JSON al server: " + json);  // Debug

    sendDataToServer(json);
    
  }
}

