import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import '../services/night_mode_service.dart';
import '../theme.dart';

class NightOwlOverlayScreen extends StatefulWidget {
  final NightModeService nightModeService;
  final VoidCallback onDismiss;
  final VoidCallback onStartBreathing;

  const NightOwlOverlayScreen({
    super.key,
    required this.nightModeService,
    required this.onDismiss,
    required this.onStartBreathing,
  });

  @override
  State<NightOwlOverlayScreen> createState() => _NightOwlOverlayScreenState();
}

class _NightOwlOverlayScreenState extends State<NightOwlOverlayScreen>
    with TickerProviderStateMixin {
  late AnimationController _fadeController;
  late AnimationController _starController;
  late Animation<double> _fadeAnimation;
  Timer? _factTimer;
  final Random _random = Random();
  List<_Star> _stars = [];

  @override
  void initState() {
    super.initState();

    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );
    _fadeAnimation = CurvedAnimation(
      parent: _fadeController,
      curve: Curves.easeIn,
    );
    _fadeController.forward();

    _starController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat(reverse: true);

    // Generate stars
    _stars = List.generate(50, (_) => _Star.random(_random));

    // Rotate facts every 8 seconds
    widget.nightModeService.rotateFact();
    _factTimer = Timer.periodic(const Duration(seconds: 8), (_) {
      widget.nightModeService.rotateFact();
    });
  }

  @override
  void dispose() {
    _fadeController.dispose();
    _starController.dispose();
    _factTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final urgencyLevel = widget.nightModeService.getUrgencyLevel();
    final urgencyMessage = widget.nightModeService.getUrgencyMessage();

    return FadeTransition(
      opacity: _fadeAnimation,
      child: Scaffold(
        backgroundColor: const Color(0xFF0A0A1A),
        body: Stack(
          children: [
            // Starfield
            AnimatedBuilder(
              animation: _starController,
              builder: (context, _) {
                return CustomPaint(
                  size: MediaQuery.of(context).size,
                  painter: _StarFieldPainter(
                    stars: _stars,
                    twinkleProgress: _starController.value,
                  ),
                );
              },
            ),
            // Content
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Moon icon
                    Icon(
                      Icons.nightlight_round,
                      size: 64,
                      color: _getUrgencyColor(urgencyLevel),
                    ),
                    const SizedBox(height: 24),
                    // Time
                    Text(
                      TimeOfDay.now().format(context),
                      style: TextStyle(
                        color: AppTheme.textPrimary,
                        fontSize: 48,
                        fontWeight: FontWeight.w200,
                      ),
                    ),
                    const SizedBox(height: 16),
                    // Urgency message
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 500),
                      child: Text(
                        urgencyMessage,
                        key: ValueKey(urgencyMessage),
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: _getUrgencyColor(urgencyLevel),
                          fontSize: 18,
                          fontWeight: FontWeight.w400,
                          height: 1.5,
                        ),
                      ),
                    ),
                    const SizedBox(height: 40),
                    // Fact card
                    ListenableBuilder(
                      listenable: widget.nightModeService,
                      builder: (context, _) {
                        return AnimatedSwitcher(
                          duration: const Duration(milliseconds: 800),
                          child: Container(
                            key: ValueKey(
                                widget.nightModeService.currentFact),
                            width: double.infinity,
                            padding: const EdgeInsets.all(24),
                            decoration: BoxDecoration(
                              color: Colors.white.withAlpha(13),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: Colors.white.withAlpha(25),
                              ),
                            ),
                            child: Column(
                              children: [
                                Icon(
                                  Icons.lightbulb_outline,
                                  color: AppTheme.accentAmber,
                                  size: 24,
                                ),
                                const SizedBox(height: 12),
                                Text(
                                  widget.nightModeService.currentFact,
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    color: AppTheme.textSecondary,
                                    fontSize: 15,
                                    height: 1.6,
                                    fontWeight: FontWeight.w300,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                    const SizedBox(height: 48),
                    // Buttons
                    SizedBox(
                      width: double.infinity,
                      height: 56,
                      child: ElevatedButton.icon(
                        onPressed: widget.onStartBreathing,
                        icon: const Icon(Icons.self_improvement),
                        label: const Text('Start Breathing Exercise'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor:
                              AppTheme.accentCyan.withAlpha(40),
                          foregroundColor: AppTheme.accentCyan,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                            side: BorderSide(
                                color: AppTheme.accentCyan.withAlpha(100)),
                          ),
                          elevation: 0,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextButton(
                      onPressed: widget.onDismiss,
                      child: Text(
                        'I\'ll put my phone down',
                        style: TextStyle(
                          color: AppTheme.textSecondary.withAlpha(150),
                          fontSize: 14,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Color _getUrgencyColor(int level) {
    switch (level) {
      case 5:
        return const Color(0xFFFF6B6B);
      case 4:
        return const Color(0xFFFF9F43);
      case 3:
        return const Color(0xFFFFD93D);
      case 2:
        return AppTheme.accentAmber;
      case 1:
        return AppTheme.accentCyan;
      default:
        return AppTheme.textSecondary;
    }
  }
}

class _Star {
  final double x;
  final double y;
  final double size;
  final double twinkleOffset;

  _Star({
    required this.x,
    required this.y,
    required this.size,
    required this.twinkleOffset,
  });

  factory _Star.random(Random random) {
    return _Star(
      x: random.nextDouble(),
      y: random.nextDouble(),
      size: random.nextDouble() * 2 + 0.5,
      twinkleOffset: random.nextDouble(),
    );
  }
}

class _StarFieldPainter extends CustomPainter {
  final List<_Star> stars;
  final double twinkleProgress;

  _StarFieldPainter({
    required this.stars,
    required this.twinkleProgress,
  });

  @override
  void paint(Canvas canvas, Size size) {
    for (final star in stars) {
      final twinkle =
          (sin((twinkleProgress + star.twinkleOffset) * pi * 2) + 1) / 2;
      final opacity = 0.3 + twinkle * 0.7;
      final paint = Paint()
        ..color = Colors.white.withAlpha((opacity * 255).toInt())
        ..style = PaintingStyle.fill;
      canvas.drawCircle(
        Offset(star.x * size.width, star.y * size.height),
        star.size,
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _StarFieldPainter oldDelegate) {
    return oldDelegate.twinkleProgress != twinkleProgress;
  }
}
