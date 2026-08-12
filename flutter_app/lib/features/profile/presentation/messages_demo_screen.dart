import 'package:flutter/material.dart';

import '../../../repositories/demo_repository.dart';
import '../../../theme/app_spacing.dart';
import '../../../widgets/message_bubble.dart';
import '../../../widgets/swiper_button.dart';
import '../../../widgets/swiper_section_card.dart';
import '../../../widgets/swiper_text_field.dart';

class MessagesDemoScreen extends StatelessWidget {
  MessagesDemoScreen({
    super.key,
    required this.repository,
  });

  final DemoRepository repository;
  final TextEditingController _controller = TextEditingController();

  @override
  Widget build(BuildContext context) {
    final messages = repository.getMessages();

    return ListView(
      padding: AppSpacing.screenPadding,
      children: [
        SwiperSectionCard(
          title: 'Conversation demo',
          subtitle: 'Message bubbles, spacing, and composer treatment only',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final message in messages) ...[
                Align(
                  alignment:
                      message.isMine ? Alignment.centerRight : Alignment.centerLeft,
                  child: MessageBubble(
                    text: message.text,
                    timeLabel: message.timeLabel,
                    isMine: message.isMine,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
              ],
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        SwiperSectionCard(
          title: 'Composer',
          child: Column(
            children: [
              SwiperTextField(
                label: 'Message',
                hintText: 'Type a message',
                controller: _controller,
                prefixIcon: const Icon(Icons.chat_bubble_outline_rounded),
              ),
              const SizedBox(height: AppSpacing.sm),
              const SwiperButton(label: 'Send message'),
            ],
          ),
        ),
      ],
    );
  }
}
