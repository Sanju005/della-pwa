class MessageItem {
  const MessageItem({
    required this.text,
    required this.timeLabel,
    required this.isMine,
  });

  final String text;
  final String timeLabel;
  final bool isMine;
}
