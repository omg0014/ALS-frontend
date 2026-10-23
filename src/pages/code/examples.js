// Starter programs for the code editor. Pins only where the PRD defines them
// (NodeMCU onboard LED = GPIO2, active LOW; red 30A relay on D5/GPIO14, active HIGH, as hardware type P2).
// The IR examples follow the owner's own desk wiring (sensor OUT on GPIO14, IR LED on GPIO4, ESP32 or NodeMCU), not the PRD; same as firmware/tools/ir_*.
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
  {
    id: 'ir-read-remote',
    group: 'IR sensor / AC (ESP32 or ESP-12)',
    title: 'IR receiver: read your AC remote',
    boards: ['esp32', 'esp8266'],
    code: `// IR receiver test for ESP32 DevKit or NodeMCU (ESP-12E): reads your AC remote.
// New test program, not from the verified set. Not yet tried on real hardware.
// Wiring (GPIO14 on both boards):
//   ESP32 DevKit: sensor VCC -> 3V3, GND -> GND, OUT -> 14 (D14)
//   NodeMCU:      sensor VCC -> 3V,  GND -> G,   OUT -> D5
// Library: IRremoteESP8266 (Arduino IDE: Tools > Manage Libraries > search "IRremoteESP8266").
// Open Serial Monitor at 115200, point the AC remote at the sensor from ~30 cm and press a button.
#include <Arduino.h>
#include <IRremoteESP8266.h>
#include <IRrecv.h>
#include <IRutils.h>
#include <IRac.h>

const uint16_t kRecvPin = 14;              // ESP32: 14 (D14), NodeMCU: D5
#if defined(ESP32)
const uint8_t kLedPin = 2;                 // ESP32 DevKit blue LED, lit when HIGH
const uint8_t kLedOn = HIGH;
#else
const uint8_t kLedPin = LED_BUILTIN;       // NodeMCU blue LED, lit when LOW
const uint8_t kLedOn = LOW;
#endif
const uint16_t kCaptureBufferSize = 1024;  // AC remotes send long messages
const uint8_t kTimeout = 50;               // ms of silence that ends one message (AC needs a long one)

IRrecv irrecv(kRecvPin, kCaptureBufferSize, kTimeout, true);
decode_results results;

void setup() {
  Serial.begin(115200);
  delay(300);
  pinMode(kLedPin, OUTPUT);
  digitalWrite(kLedPin, !kLedOn);
  irrecv.enableIRIn();
  Serial.println();
  Serial.println("IR test ready. Point the AC remote at the sensor and press a button.");
}

void loop() {
  if (!irrecv.decode(&results)) return;
  digitalWrite(kLedPin, kLedOn);  // blink: something was received

  Serial.println("----------------------------------------");
  Serial.print(resultToHumanReadableBasic(&results));  // protocol name + code
  String ac = IRAcUtils::resultAcToString(&results);   // e.g. "Power: On, Mode: 1 (Cool), Temp: 24C"
  if (ac.length()) Serial.println("AC settings: " + ac);
  else Serial.println("AC settings: not recognised (raw timings below can still be replayed)");
  Serial.println(resultToSourceCode(&results));         // raw data, needed to send it back later

  irrecv.resume();
  delay(100);
  digitalWrite(kLedPin, !kLedOn);
}
`,
  },
  {
    id: 'ir-obstacle',
    group: 'IR sensor / AC (ESP32 or ESP-12)',
    title: 'IR obstacle sensor: test',
    boards: ['esp32', 'esp8266'],
    code: `// IR obstacle sensor test for ESP32 DevKit or NodeMCU (ESP-12E). No library needed.
// New test program, not from the verified set. Not yet tried on real hardware.
// Wiring (GPIO14 on both boards):
//   ESP32 DevKit: sensor VCC -> 3V3, GND -> GND, OUT -> 14 (D14)
//   NodeMCU:      sensor VCC -> 3V,  GND -> G,   OUT -> D5
// Open Serial Monitor at 115200 and move your hand 2-10 cm in front of the sensor.
const uint8_t kSensorPin = 14;  // ESP32: 14 (D14), NodeMCU: D5
#if defined(ESP32)
const uint8_t kLedPin = 2;      // ESP32 DevKit blue LED, lit when HIGH
const uint8_t kLedOn = HIGH;
#else
const uint8_t kLedPin = LED_BUILTIN;  // NodeMCU blue LED, lit when LOW
const uint8_t kLedOn = LOW;
#endif

bool last = false;

void setup() {
  Serial.begin(115200);
  delay(300);
  pinMode(kSensorPin, INPUT);
  pinMode(kLedPin, OUTPUT);
  Serial.println();
  Serial.println("Obstacle test ready. Move your hand in front of the sensor.");
}

void loop() {
  bool seen = digitalRead(kSensorPin) == LOW;  // these modules pull OUT low when they see something
  digitalWrite(kLedPin, seen ? kLedOn : !kLedOn);  // blue LED on while something is seen
  if (seen != last) {
    Serial.println(seen ? "Object detected" : "Clear");
    last = seen;
  }
  delay(20);
}
`,
  },
  {
    id: 'ir-ac-onoff',
    group: 'IR sensor / AC (ESP32 or ESP-12)',
    title: 'IR LED: switch the AC ON / OFF',
    boards: ['esp32', 'esp8266'],
    code: `// AC ON/OFF test for ESP32 DevKit or NodeMCU (ESP-12E) with an IR LED.
// New test program, not from the verified set. Not yet tried on real hardware.
// Wiring (GPIO4 on both boards): a ready IR transmitter module (KY-005): VCC -> 3V3/3V, GND -> GND/G, S -> ESP32: 4 (D4), NodeMCU: D2.
// For a whole room's range drive the IR LED through a transistor (BC547 / 2N2222) instead.
// Library: IRremoteESP8266.
// 1. Run ir_ac_read first and note the "Protocol" it prints for your AC remote (e.g. DAIKIN, VOLTAS, LG, GREE).
// 2. Put it in AC_PROTOCOL below, upload, open Serial Monitor at 115200 (line ending: Newline).
// 3. Point the IR LED at the AC (within 1-3 m) and press the board's BOOT / FLASH button: AC ON, press again: OFF.
//    In Arduino IDE's Serial Monitor you can also type: 1 = ON, 0 = OFF, u = 1 degree warmer, d = 1 degree cooler.
#include <Arduino.h>
#include <IRremoteESP8266.h>
#include <IRac.h>
#include <IRutils.h>

const char *AC_PROTOCOL = "DAIKIN";  // <-- change to what ir_ac_read printed
const char *AC_MODEL = "";           // only if ir_ac_read printed a model, e.g. "1"
const uint16_t kIrLedPin = 4;        // ESP32: 4 (D4), NodeMCU: D2
const uint8_t kButtonPin = 0;        // BOOT (ESP32) / FLASH (NodeMCU) button: reads LOW while pressed

IRac ac(kIrLedPin);

void send() {
  Serial.printf("Sending: power %s, cool, %d C ... ", ac.next.power ? "ON" : "OFF", (int)ac.next.degrees);
  Serial.println(ac.sendAc() ? "sent" : "FAILED (protocol not supported for sending)");
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println();
  decode_type_t protocol = strToDecodeType(AC_PROTOCOL);
  if (!IRac::isProtocolSupported(protocol)) {
    Serial.printf("\\"%s\\" is not an AC protocol this library can send. Check the name ir_ac_read printed.\\n", AC_PROTOCOL);
  }
  IRac::initState(&ac.next);
  ac.next.protocol = protocol;
  ac.next.model = IRac::strToModel(AC_MODEL, 1);
  ac.next.mode = stdAc::opmode_t::kCool;
  ac.next.celsius = true;
  ac.next.degrees = 24;
  ac.next.fanspeed = stdAc::fanspeed_t::kAuto;
  ac.next.power = false;
  pinMode(kButtonPin, INPUT_PULLUP);
  Serial.printf("AC test ready (%s). Press BOOT/FLASH to switch ON/OFF, or type 1 = ON, 0 = OFF, u = warmer, d = cooler.\\n", AC_PROTOCOL);
}

void loop() {
  static bool wasPressed = false;
  bool pressed = digitalRead(kButtonPin) == LOW;
  if (pressed && !wasPressed) {
    ac.next.power = !ac.next.power;
    send();
    delay(50);  // ignore the button's contact bounce
  }
  wasPressed = pressed;

  if (!Serial.available()) return;
  char c = Serial.read();
  if (c == '1') ac.next.power = true;
  else if (c == '0') ac.next.power = false;
  else if (c == 'u' && ac.next.degrees < 30) ac.next.degrees++;
  else if (c == 'd' && ac.next.degrees > 16) ac.next.degrees--;
  else return;  // ignore newlines and other keys
  send();
}
`,
  },
]
