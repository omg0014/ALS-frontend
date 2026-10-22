// Starter programs for the code editor. Pins only where the PRD defines them
// (NodeMCU onboard LED = GPIO2, active LOW; red 30A relay on D5/GPIO14, active HIGH, as hardware type P2).
// group: heading the example is listed under.

export const EXAMPLES = [
  {
    id: 'hello',
    group: 'Getting started',
    title: 'Hello (Serial Monitor)',
    boards: ['esp32', 'esp8266'],
    code: `// Prints a message every second. Open the serial monitor at 115200 to see it.

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println();
  Serial.println("Hello from the ACLS code editor!");
}

void loop() {
  Serial.printf("Running for %lu seconds\\n", millis() / 1000);
  delay(1000);
}
`,
  },
  {
    id: 'wifi-scan',
    group: 'Getting started',
    title: 'WiFi scan (signal near this board)',
    boards: ['esp32', 'esp8266'],
    code: `// Lists the WiFi networks this board can hear, with their signal strength.
// Above about -75 dBm is good enough for a classroom device.

#ifdef ESP8266
#include <ESP8266WiFi.h>
#else
#include <WiFi.h>
#endif

void setup() {
  Serial.begin(115200);
  delay(300);
  WiFi.mode(WIFI_STA);
}

void loop() {
  int n = WiFi.scanNetworks();
  Serial.printf("\\n%d networks found:\\n", n);
  for (int i = 0; i < n; i++) {
    Serial.printf("  %-32s %4d dBm\\n", WiFi.SSID(i).c_str(), WiFi.RSSI(i));
  }
  delay(5000);
}
`,
  },
  {
    id: 'blink',
    group: 'Getting started',
    title: 'Blink the onboard LED (NodeMCU)',
    boards: ['esp8266'],
    code: `// Blinks the small blue LED on the NodeMCU (GPIO2, lit when LOW).

#define LED 2

void setup() {
  pinMode(LED, OUTPUT);
}

void loop() {
  digitalWrite(LED, LOW);   // on
  delay(500);
  digitalWrite(LED, HIGH);  // off
  delay(500);
}
`,
  },
  {
    id: 'relay30-click',
    group: 'ESP-12 + 30A relay',
    title: '30A relay: click test',
    boards: ['esp8266'],
    code: `// ESP-12 (NodeMCU) + red 30A relay: ON for 2 seconds, OFF for 2 seconds, again and again.
// You should hear a click each time and see the relay's red LED light up.
//
// Wiring (same as hardware type P2):
//   NodeMCU D5 (GPIO14) -> relay IN
//   5V supply +         -> relay VCC and NodeMCU VIN
//   5V supply -         -> relay GND and NodeMCU GND
// Set the relay's jumper to H: the relay is ON when the pin is HIGH.
// Use a proper 5V supply (HLK-5M05): a laptop USB port cannot power WiFi plus the 30A coil.
// Desk test only: nothing connected to the relay's COM / NO screws.

#define RELAY_PIN 14     // D5
#define RELAY_ON  HIGH
#define RELAY_OFF LOW

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, RELAY_OFF);  // always start OFF
  Serial.println();
  Serial.println("30A relay click test");
}

void loop() {
  digitalWrite(RELAY_PIN, RELAY_ON);
  Serial.println("Relay ON");
  delay(2000);

  digitalWrite(RELAY_PIN, RELAY_OFF);
  Serial.println("Relay OFF");
  delay(2000);
}
`,
  },
  {
    id: 'relay30-button',
    group: 'ESP-12 + 30A relay',
    title: '30A relay: FLASH button switches it',
    boards: ['esp8266'],
    code: `// ESP-12 (NodeMCU) + red 30A relay: press the FLASH button on the NodeMCU to switch the relay ON or OFF.
// The small blue LED on the NodeMCU is lit while the relay is ON.
// Handy for testing the box without a computer.
//
// Wiring (same as hardware type P2):
//   NodeMCU D5 (GPIO14) -> relay IN
//   5V supply +         -> relay VCC and NodeMCU VIN
//   5V supply -         -> relay GND and NodeMCU GND
// Set the relay's jumper to H: the relay is ON when the pin is HIGH.
// Use a proper 5V supply (HLK-5M05): a laptop USB port cannot power WiFi plus the 30A coil.
// Desk test only: nothing connected to the relay's COM / NO screws.

#define RELAY_PIN  14    // D5
#define RELAY_ON   HIGH
#define RELAY_OFF  LOW
#define BUTTON_PIN 0     // FLASH button: reads LOW while pressed
#define LED_PIN    2     // blue LED: lit when LOW

bool relayOn = false;

void apply() {
  digitalWrite(RELAY_PIN, relayOn ? RELAY_ON : RELAY_OFF);
  digitalWrite(LED_PIN, relayOn ? LOW : HIGH);
  Serial.println(relayOn ? "Relay ON" : "Relay OFF");
}

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  Serial.println();
  Serial.println("Press FLASH to switch the 30A relay");
  apply();  // start OFF
}

void loop() {
  static int last = HIGH;
  int now = digitalRead(BUTTON_PIN);
  if (last == HIGH && now == LOW) {  // just pressed
    relayOn = !relayOn;
    apply();
    delay(50);  // ignore the button bouncing
  }
  last = now;
}
`,
  },
  {
    id: 'relay30-web',
    group: 'ESP-12 + 30A relay',
    title: '30A relay: ON/OFF page on your phone',
    boards: ['esp8266'],
    code: `// ESP-12 (NodeMCU) + red 30A relay: the board joins your WiFi and shows a page with ON and OFF buttons.
// 1. Type your WiFi name and password below, then upload.
// 2. "What the board says" shows an address like http://192.168.1.50
// 3. Open that address on a phone or PC on the same WiFi.
//
// Wiring (same as hardware type P2):
//   NodeMCU D5 (GPIO14) -> relay IN
//   5V supply +         -> relay VCC and NodeMCU VIN
//   5V supply -         -> relay GND and NodeMCU GND
// Set the relay's jumper to H: the relay is ON when the pin is HIGH.
// Use a proper 5V supply (HLK-5M05): a laptop USB port cannot power WiFi plus the 30A coil.
// Desk test only: nothing connected to the relay's COM / NO screws.

#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>

const char* WIFI_NAME     = "your-wifi-name";
const char* WIFI_PASSWORD = "your-wifi-password";

#define RELAY_PIN 14     // D5
#define RELAY_ON  HIGH
#define RELAY_OFF LOW

ESP8266WebServer server(80);
bool relayOn = false;

void setRelay(bool on) {
  relayOn = on;
  digitalWrite(RELAY_PIN, on ? RELAY_ON : RELAY_OFF);
  Serial.println(on ? "Relay ON" : "Relay OFF");
}

void showPage() {
  String page = "<!doctype html><meta name='viewport' content='width=device-width'>";
  page += "<body style='font-family:sans-serif;text-align:center;padding:40px'>";
  page += "<h2>30A relay is ";
  page += relayOn ? "<span style='color:green'>ON</span>" : "<span style='color:gray'>OFF</span>";
  page += "</h2>";
  page += "<p><a href='/on'><button style='font-size:24px;padding:12px 40px'>ON</button></a></p>";
  page += "<p><a href='/off'><button style='font-size:24px;padding:12px 40px'>OFF</button></a></p>";
  server.send(200, "text/html", page);
}

void goHome() {
  server.sendHeader("Location", "/");
  server.send(303);
}

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  setRelay(false);  // always start OFF

  Serial.println();
  Serial.print("Joining WiFi ");
  Serial.println(WIFI_NAME);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_NAME, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("Open http://");
  Serial.println(WiFi.localIP());

  server.on("/", showPage);
  server.on("/on", []() { setRelay(true); goHome(); });
  server.on("/off", []() { setRelay(false); goHome(); });
  server.begin();
}

void loop() {
  server.handleClient();
}
`,
  },
]
