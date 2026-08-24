class NotificationItem {
  const NotificationItem({
    required this.title,
    required this.body,
    required this.timeLabel,
    required this.isUnread,
    this.targetRoute,
    this.targetArgument,
  });

  final String title;
  final String body;
  final String timeLabel;
  final bool isUnread;
  final String? targetRoute;
  final String? targetArgument;
}
