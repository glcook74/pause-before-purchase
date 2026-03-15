import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import '../services/intervention_service.dart';
import '../services/usage_tracking_service.dart';
import '../theme.dart';

class BreathingExerciseScreen extends StatefulWidget {
  final InterventionService interventionService;
  final UsageTrackingService usageTrackingService;
  final VoidCallback? onComplete;
  final VoidCallback? onPutDown;

  const BreathingExerciseScreen({
    super.key,
    required this.interventionService,
    required this.usageTrackingService,
    this.onComplete,
    this.onPutDown,
  });

  @override
  State<BreathingExerciseScreen> createState() =>
      _BreathingExerciseScreenState();
}

class _BreathingExerciseScreenState extends State<BreathingExerciseScreen>
    with TickerProviderStateMixin {
  late AnimationController _breathController;
  late AnimationController _glowController;
  late Animation<double> _breathAnimation;
  late Animation<double> _glowAnimation;
  Timer? _countdownTimer;
  int _secondsRemaining = 0;
  bool _isComplete = false;
  String _breathPhase = 'Get Ready';
  static const _breathInDuration = 4;
  static const _holdDuration = 2;
  static const _breathOutDuration = 4;
  int _cyclePhase = 0; // 0=in, 1=hold, 2=out

  @override
  void initState() {
    super.initState();
    _secondsRemaining =
        widget.interventionService.config.breathingDurationSeconds;

    _breathController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: _breathInDuration),
    );

    _glowController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);

    _breathAnimation = Tween<double>(begin: 0.4, end: 1.0).animate(
      CurvedAnimation(parent: _breathController, curve: Curves.easeInOut),
    );

    _glowAnimation = Tween<double>(begin: 0.3, end: 0.7).animate(
      CurvedAnimation(parent: _glowController, curve: Curves.easeInOut),
    );

    _startBreathingCycle();
    _startCountdown();
  }

  void _startBreathingCycle() {
    _cyclePhase = 0;
    _breathPhase = 'Breathe In';
    _breathController.duration = const Duration(seconds: _breathInDuration);
    _breathController.forward().then((_) {
      if (!mounted) return;
      setState(() {
        _cyclePhase = 1;
        _breathPhase = 'Hold';
      });
      Future.delayed(const Duration(seconds: _holdDuration), () {
        if (!mounted) return;
        setState(() {
          _cyclePhase = 2;
          _breathPhase = 'Breathe Out';
        });
        _breathController.duration =
            const Duration(seconds: _breathOutDuration);
        _breathController.reverse().then((_) {
          if (!mounted || _isComplete) return;
          _startBreathingCycle();
        });
      });
    });
  }

  void _startCountdown() {
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      setState(() {
        _secondsRemaining--;
        if (_secondsRemaining <= 0) {
          _isComplete = true;
          timer.cancel();
          widget.interventionService.completeBreathing();
        }
      });
    });
  }

  @override
  void dispose() {
    _breathController.dispose();
    _glowController.dispose();
    _countdownTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundDark,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                _isComplete ? 'Well done' : 'Take a moment',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      color: AppTheme.textPrimary,
                      fontWeight: FontWeight.w300,
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                _isComplete
                    ? 'How do you feel?'
                    : 'Focus on your breathing',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: AppTheme.textSecondary,
                    ),
              ),
              const SizedBox(height: 60),
              // Breathing circle
              AnimatedBuilder(
                animation: Listenable.merge(
                    [_breathAnimation, _glowAnimation]),
                builder: (context, child) {
                  final breathScale = _breathAnimation.value;
                  final glowOpacity = _glowAnimation.value;
                  return SizedBox(
                    width: 250,
                    height: 250,
                    child: CustomPaint(
                      painter: _BreathingCirclePainter(
                        scale: breathScale,
                        glowOpacity: glowOpacity,
                        isComplete: _isComplete,
                      ),
                      child: Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              _isComplete ? 'Done' : _breathPhase,
                              style: TextStyle(
                                color: AppTheme.accentCyan,
                                fontSize: 20,
                                fontWeight: FontWeight.w300,
                              ),
                            ),
                            if (!_isComplete) ...[
                              const SizedBox(height: 8),
                              Text(
                                '$_secondsRemaining',
                                style: TextStyle(
                                  color: AppTheme.textPrimary,
                                  fontSize: 36,
                                  fontWeight: FontWeight.w200,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
              const SizedBox(height: 60),
              if (_isComplete) ...[
                _buildChoiceButton(
                  'Put my phone down',
                  AppTheme.accentCyan,
                  Icons.nightlight_round,
                  () async {
                    await widget.usageTrackingService
                        .recordIntervention(putDown: true);
                    widget.onPutDown?.call();
                  },
                ),
                const SizedBox(height: 16),
                _buildChoiceButton(
                  'Continue scrolling',
                  AppTheme.textSecondary.withAlpha(150),
                  Icons.phone_android,
                  () async {
                    await widget.usageTrackingService
                        .recordIntervention(putDown: false);
                    widget.interventionService
                        .startReInterventionTimer(() {
                      // Timer will fire re-intervention
                    });
                    widget.onComplete?.call();
                  },
                ),
              ] else
                Text(
                  'Complete the breathing exercise to continue',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppTheme.textSecondary.withAlpha(150),
                      ),
                  textAlign: TextAlign.center,
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildChoiceButton(
    String label,
    Color color,
    IconData icon,
    VoidCallback onTap,
  ) {
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: ElevatedButton.icon(
        onPressed: onTap,
        icon: Icon(icon, color: color),
        label: Text(label),
        style: ElevatedButton.styleFrom(
          backgroundColor: color.withAlpha(25),
          foregroundColor: color,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(color: color.withAlpha(75)),
          ),
          elevation: 0,
        ),
      ),
    );
  }
}

class _BreathingCirclePainter extends CustomPainter {
  final double scale;
  final double glowOpacity;
  final bool isComplete;

  _BreathingCirclePainter({
    required this.scale,
    required this.glowOpacity,
    required this.isComplete,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final maxRadius = size.width / 2;
    final radius = maxRadius * scale;

    // Outer glow
    final glowPaint = Paint()
      ..color = AppTheme.accentCyan.withAlpha((glowOpacity * 50).toInt())
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 30);
    canvas.drawCircle(center, radius + 20, glowPaint);

    // Main circle
    final circlePaint = Paint()
      ..color = AppTheme.accentCyan.withAlpha(isComplete ? 100 : 50)
      ..style = PaintingStyle.fill;
    canvas.drawCircle(center, radius, circlePaint);

    // Border
    final borderPaint = Paint()
      ..color = AppTheme.accentCyan.withAlpha(isComplete ? 200 : 120)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    canvas.drawCircle(center, radius, borderPaint);

    // Inner ring
    final innerPaint = Paint()
      ..color = AppTheme.accentCyan.withAlpha(40)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    canvas.drawCircle(center, radius * 0.7, innerPaint);
  }

  @override
  bool shouldRepaint(covariant _BreathingCirclePainter oldDelegate) {
    return oldDelegate.scale != scale ||
        oldDelegate.glowOpacity != glowOpacity ||
        oldDelegate.isComplete != isComplete;
  }
}
