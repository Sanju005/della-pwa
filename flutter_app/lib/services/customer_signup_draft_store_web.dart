import 'package:web/web.dart' as web;

String? read(String key) => web.window.sessionStorage.getItem(key);

void write(String key, String value) {
  web.window.sessionStorage.setItem(key, value);
}

void remove(String key) {
  web.window.sessionStorage.removeItem(key);
}
