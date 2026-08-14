import 'dart:html' as html;

String? read(String key) => html.window.sessionStorage[key];

void write(String key, String value) {
  html.window.sessionStorage[key] = value;
}

void remove(String key) {
  html.window.sessionStorage.remove(key);
}
