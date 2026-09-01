import 'package:web/web.dart' as web;

Future<void> ensureLoaded() async {}

String? read(String key) => web.window.localStorage.getItem(key);

void write(String key, String value) {
  web.window.localStorage.setItem(key, value);
}

void remove(String key) {
  web.window.localStorage.removeItem(key);
}
