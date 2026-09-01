class NotificationItem {
  const NotificationItem({
    required this.title,
    required this.body,
    required this.timeLabel,
    required this.isUnread,
    this.id = '',
    this.targetRoute,
    this.targetArgument,
  });

  /// Backend notification id, used to mark it read via
  /// `PATCH /api/notifications/[id]`. Empty for demo-sourced items.
  final String id;
  final String title;
  final String body;
  final String timeLabel;
  final bool isUnread;
  final String? targetRoute;
  final String? targetArgument;
}
