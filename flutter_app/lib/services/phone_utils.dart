String normalizePhoneNumber(String value) {
  final digits = value.replaceAll(RegExp(r'\D'), '');
  if (digits.isEmpty) {
    return '';
  }
  if (digits.startsWith('60')) {
    return digits;
  }
  return '60$digits';
}
