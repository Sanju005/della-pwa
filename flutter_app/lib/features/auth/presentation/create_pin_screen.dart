import 'package:flutter/material.dart';

import '../../../services/pin_service.dart';
import '../../../theme/app_colors.dart';
import 'auth_flow_scaffold.dart';
import 'pin_step_view.dart';

/// Shown right after a successful login for an account that has no Swiper
/// Security PIN yet (either brand new, during registration, or an existing
/// account migrated under Phase 1 — the "Case A: trusted legacy device"
/// path). Two steps: choose a 6-digit PIN, then confirm it.
///
/// [canSkip] defaults to false — PIN creation is mandatory by default, per
/// the Phase 1 requirement that it must not be dismissible. Both the
/// system back gesture and the AppBar back button are disabled while
/// [canSkip] is false: there is deliberately no way to leave this screen
/// without either completing it or force-quitting the app (in which case
/// the account remains without a PIN and this screen shows again on the
/// next login).
class CreatePinScreen extends StatefulWidget {
  const CreatePinScreen({super.key, this.canSkip = false});

  final bool canSkip;

  @override
  State<CreatePinScreen> createState() => _CreatePinScreenState();
}

enum _CreatePinStep { choose, confirm }

class _CreatePinScreenState extends State<CreatePinScreen> {
  static const _pinService = PinService();

  _CreatePinStep _step = _CreatePinStep.choose;
  String? _chosenPin;

  Future<void> _handleChosen(String pin) async {
    setState(() {
      _chosenPin = pin;
      _step = _CreatePinStep.confirm;
    });
  }

  Future<void> _handleConfirmed(String pin) async {
    if (pin != _chosenPin) {
      setState(() => _step = _CreatePinStep.choose);
      throw Exception('PINs did not match. Please try again.');
    }

    await _pinService.createOrChangePin(newPin: pin);
    if (!mounted) {
      return;
    }
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final subtitle = _step == _CreatePinStep.choose
        ? 'Your PIN helps protect your account when signing in from a new device.'
        : 'Enter your PIN again to confirm.';

    return PopScope(
      canPop: widget.canSkip,
      child: AuthFlowScaffold(
        hero: const AuthCircleHero(icon: Icons.pin_outlined),
        title: 'Create Swiper PIN',
        subtitle: widget.canSkip ? subtitle : '$subtitle This step is required to continue.',
        child: _step == _CreatePinStep.choose
            ? _ChoosePinStep(onChosen: _handleChosen)
            : PinStepView(
                key: const ValueKey('confirm'),
                title: 'Confirm your PIN',
                subtitle: 'Re-enter the 6-digit PIN you just chose.',
                onSubmit: _handleConfirmed,
              ),
        bottom: widget.canSkip
            ? TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text(
                  "I'll do this later",
                  style: TextStyle(color: AppColors.textSecondary),
                ),
              )
            : null,
      ),
    );
  }
}

class _ChoosePinStep extends StatelessWidget {
  const _ChoosePinStep({required this.onChosen});

  final Future<void> Function(String pin) onChosen;

  @override
  Widget build(BuildContext context) {
    return PinStepView(
      key: const ValueKey('choose'),
      title: '',
      subtitle: '',
      onSubmit: onChosen,
    );
  }
}
