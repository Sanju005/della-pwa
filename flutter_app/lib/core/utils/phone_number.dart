/// A country's dial code, used by the phone entry field so the country
/// code box can show a matching flag as the provider types it. The flag
/// itself is derived from the ISO2 code (see [countryFlagEmoji]) rather
/// than hand-typed per entry.
class CountryDialCode {
  const CountryDialCode({
    required this.dialCode,
    required this.iso2,
    required this.name,
  });

  /// Digits only, e.g. `60` for Malaysia.
  final String dialCode;

  /// ISO 3166-1 alpha-2 code, e.g. `MY`.
  final String iso2;

  final String name;

  String get flag => countryFlagEmoji(iso2);
}

/// Renders a country flag emoji from its ISO 3166-1 alpha-2 code by
/// combining the two Unicode regional indicator symbols — no per-country
/// emoji strings to hand-maintain.
String countryFlagEmoji(String iso2) {
  if (iso2.length != 2) {
    return '🏳️';
  }
  const base = 0x1F1E6;
  final aCode = 'A'.codeUnitAt(0);
  final codePoints = iso2.toUpperCase().codeUnits.map(
    (c) => base + (c - aCode),
  );
  return String.fromCharCodes(codePoints);
}

/// Curated list of dial codes covering Della/Swiper's home market plus the
/// countries a provider or customer is most likely to be dialling from.
/// Not an exhaustive E.164 database — just enough for the flag-matching UI
/// to feel complete for real users.
const List<CountryDialCode> kCountryDialCodes = [
  CountryDialCode(dialCode: '60', iso2: 'MY', name: 'Malaysia'),
  CountryDialCode(dialCode: '65', iso2: 'SG', name: 'Singapore'),
  CountryDialCode(dialCode: '62', iso2: 'ID', name: 'Indonesia'),
  CountryDialCode(dialCode: '66', iso2: 'TH', name: 'Thailand'),
  CountryDialCode(dialCode: '63', iso2: 'PH', name: 'Philippines'),
  CountryDialCode(dialCode: '84', iso2: 'VN', name: 'Vietnam'),
  CountryDialCode(dialCode: '673', iso2: 'BN', name: 'Brunei'),
  CountryDialCode(dialCode: '855', iso2: 'KH', name: 'Cambodia'),
  CountryDialCode(dialCode: '856', iso2: 'LA', name: 'Laos'),
  CountryDialCode(dialCode: '95', iso2: 'MM', name: 'Myanmar'),
  CountryDialCode(dialCode: '86', iso2: 'CN', name: 'China'),
  CountryDialCode(dialCode: '852', iso2: 'HK', name: 'Hong Kong'),
  CountryDialCode(dialCode: '886', iso2: 'TW', name: 'Taiwan'),
  CountryDialCode(dialCode: '81', iso2: 'JP', name: 'Japan'),
  CountryDialCode(dialCode: '82', iso2: 'KR', name: 'South Korea'),
  CountryDialCode(dialCode: '91', iso2: 'IN', name: 'India'),
  CountryDialCode(dialCode: '92', iso2: 'PK', name: 'Pakistan'),
  CountryDialCode(dialCode: '880', iso2: 'BD', name: 'Bangladesh'),
  CountryDialCode(dialCode: '94', iso2: 'LK', name: 'Sri Lanka'),
  CountryDialCode(dialCode: '977', iso2: 'NP', name: 'Nepal'),
  CountryDialCode(dialCode: '61', iso2: 'AU', name: 'Australia'),
  CountryDialCode(dialCode: '64', iso2: 'NZ', name: 'New Zealand'),
  CountryDialCode(dialCode: '971', iso2: 'AE', name: 'United Arab Emirates'),
  CountryDialCode(dialCode: '966', iso2: 'SA', name: 'Saudi Arabia'),
  CountryDialCode(dialCode: '974', iso2: 'QA', name: 'Qatar'),
  CountryDialCode(dialCode: '965', iso2: 'KW', name: 'Kuwait'),
  CountryDialCode(dialCode: '44', iso2: 'GB', name: 'United Kingdom'),
  CountryDialCode(dialCode: '1', iso2: 'US', name: 'United States / Canada'),
  CountryDialCode(dialCode: '49', iso2: 'DE', name: 'Germany'),
  CountryDialCode(dialCode: '33', iso2: 'FR', name: 'France'),
  CountryDialCode(dialCode: '31', iso2: 'NL', name: 'Netherlands'),
  CountryDialCode(dialCode: '234', iso2: 'NG', name: 'Nigeria'),
  CountryDialCode(dialCode: '27', iso2: 'ZA', name: 'South Africa'),
];

/// Finds the best-matching known dial code for whatever digits have been
/// typed into the country-code field so far — an exact match first, then
/// the longest known code that prefixes what's typed (so someone who pastes
/// the whole number into the code box still resolves to the right flag).
/// Returns null while the digits typed don't (yet) match anything known.
CountryDialCode? matchCountryCode(String typed) {
  final digits = typed.replaceAll(RegExp(r'\D'), '');
  if (digits.isEmpty) {
    return null;
  }

  for (final country in kCountryDialCodes) {
    if (country.dialCode == digits) {
      return country;
    }
  }

  CountryDialCode? prefixMatch;
  for (final country in kCountryDialCodes) {
    if (digits.startsWith(country.dialCode) &&
        (prefixMatch == null ||
            country.dialCode.length > prefixMatch.dialCode.length)) {
      prefixMatch = country;
    }
  }
  return prefixMatch;
}

/// Combines a country dial code with a raw subscriber number into a
/// canonical `+{countryCode}{digits}` form, stripping spaces/dashes and any
/// redundant leading `0`/country-code the subscriber field might contain.
///
/// Malaysia (`60`) — the app's home market — keeps its existing strict
/// local numbering-plan validation (must start with `1`, 9–10 digits).
/// Every other country code only gets a basic length sanity check (7–14
/// digits), since this app doesn't maintain a full numbering-plan database
/// per country. Returns null if the input isn't plausible.
String? normalizePhoneNumber(String countryCodeInput, String rawSubscriber) {
  final countryDigits = countryCodeInput.replaceAll(RegExp(r'\D'), '');
  var subscriber = rawSubscriber.replaceAll(RegExp(r'\D'), '');

  if (countryDigits.isEmpty || subscriber.isEmpty) {
    return null;
  }

  if (subscriber.startsWith(countryDigits)) {
    subscriber = subscriber.substring(countryDigits.length);
  } else if (countryDigits == '60' && subscriber.startsWith('0')) {
    subscriber = subscriber.substring(1);
  }

  if (countryDigits == '60') {
    if (subscriber.length < 9 || subscriber.length > 10) {
      return null;
    }
    if (!subscriber.startsWith('1')) {
      return null;
    }
  } else {
    if (subscriber.length < 7 || subscriber.length > 14) {
      return null;
    }
  }

  return '+$countryDigits$subscriber';
}

/// Formats a canonical `+{countryCode}{subscriber}` phone for display, e.g.
/// `+60 12 345 6789`. The country-code portion is recovered via
/// [matchCountryCode] against the known dial-code table, falling back to a
/// 2-digit guess for an unrecognised code.
String formatPhoneForDisplay(String normalizedPhone) {
  final digits = normalizedPhone.replaceAll(RegExp(r'\D'), '');
  if (digits.isEmpty) {
    return normalizedPhone;
  }

  final match = matchCountryCode(digits);
  final codeLength =
      match?.dialCode.length ?? (digits.length > 2 ? 2 : digits.length);
  final countryCode = digits.substring(0, codeLength);
  final subscriber = digits.substring(codeLength);

  if (subscriber.length <= 2) {
    return '+$countryCode $subscriber'.trimRight();
  }

  final prefix = subscriber.substring(0, 2);
  final remainder = subscriber.substring(2);
  if (remainder.length <= 4) {
    return '+$countryCode $prefix $remainder';
  }

  final splitPoint = remainder.length - 4;
  final middle = remainder.substring(0, splitPoint);
  final last = remainder.substring(splitPoint);
  return '+$countryCode $prefix $middle $last';
}
