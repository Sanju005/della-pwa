class NotificationItem {
  const NotificationItem({
    required this.title,
    required this.body,
    required this.timeLabel,
    required this.isUnread,
  });

  final String title;
  final String body;
  final String timeLabel;
  final bool isUnread;
}
