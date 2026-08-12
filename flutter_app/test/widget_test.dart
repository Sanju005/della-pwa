import 'package:flutter_test/flutter_test.dart';

import 'package:flutter_app/app.dart';

void main() {
  testWidgets('shows Flutter demo login entry', (WidgetTester tester) async {
    await tester.pumpWidget(const SwiperApp());

    expect(find.text('Welcome back to Swiper'), findsOneWidget);
    expect(find.text('Open customer demo'), findsOneWidget);
  });
}
