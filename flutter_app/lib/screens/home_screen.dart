import 'package:flutter/material.dart';
import '../services/intervention_service.dart';
import '../services/usage_tracking_service.dart';
import '../services/night_mode_service.dart';
import '../theme.dart';

class HomeScreen extends StatelessWidget {
  final InterventionService interventionService;
  final UsageTrackingService usageTrackingService;
  final NightModeService nightModeService;
  final VoidCallback onStartBreathing;

  const HomeScreen({
    super.key,
    required this.interventionService,
    required this.usageTrackingService,
    required this.nightModeService,
    required this.onStartBreathing,
  });

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Listenable.merge([
        interventionService,
        usageTrackingService,
        nightModeService,
      ]),
      builder: (context, _) {
        final todayStats = usageTrackingService.getTodayStats();
        final isBedtime = interventionService.isBedtime();

        return Scaffold(
          backgroundColor: AppTheme.backgroundDark,
          body: SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 8),
                  // Greeting
                  Text(
                    _getGreeting(),
                    style:
                        Theme.of(context).textTheme.headlineSmall?.copyWith(
                              color: AppTheme.textPrimary,
                              fontWeight: FontWeight.w300,
                            ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _getSubGreeting(isBedtime),
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: AppTheme.textSecondary,
                        ),
                  ),
                  const SizedBox(height: 24),

                  // Night mode banner
                  if (isBedtime)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      margin: const EdgeInsets.only(bottom: 20),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            AppTheme.accentCyan.withAlpha(25),
                            AppTheme.surfaceDark,
                          ],
                        ),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: AppTheme.accentCyan.withAlpha(50),
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.nightlight_round,
                              color: AppTheme.accentCyan),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Night Mode Active',
                                  style: TextStyle(
                                    color: AppTheme.accentCyan,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'Interventions will be more frequent',
                                  style: TextStyle(
                                    color: AppTheme.textSecondary,
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                  // Quick stats row
                  Row(
                    children: [
                      Expanded(
                        child: _StatCard(
                          icon: Icons.timer_outlined,
                          label: 'Screen Time',
                          value: todayStats.formattedScreenTime,
                          color: AppTheme.accentCyan,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _StatCard(
                          icon: Icons.local_fire_department,
                          label: 'Streak',
                          value: '${usageTrackingService.currentStreak} days',
                          color: AppTheme.accentAmber,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _StatCard(
                          icon: Icons.shield_outlined,
                          label: 'Resistance',
                          value: todayStats.resistancePercentage,
                          color: AppTheme.accentGreen,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _StatCard(
                          icon: Icons.repeat,
                          label: 'Sessions',
                          value: '${todayStats.sessionCount}',
                          color: AppTheme.accentPurple,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),

                  // Breathing exercise button
                  SizedBox(
                    width: double.infinity,
                    height: 64,
                    child: ElevatedButton(
                      onPressed: onStartBreathing,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.accentCyan.withAlpha(30),
                        foregroundColor: AppTheme.accentCyan,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                          side: BorderSide(
                            color: AppTheme.accentCyan.withAlpha(80),
                          ),
                        ),
                        elevation: 0,
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.self_improvement, size: 28),
                          SizedBox(width: 12),
                          Text(
                            'Start Breathing Exercise',
                            style: TextStyle(
                                fontSize: 16, fontWeight: FontWeight.w500),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),

                  // Today's interventions
                  Text(
                    'Today\'s Activity',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          color: AppTheme.textPrimary,
                        ),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: AppTheme.surfaceDark,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      children: [
                        _ActivityRow(
                          label: 'Interventions completed',
                          value: '${todayStats.totalInterventions}',
                          icon: Icons.self_improvement,
                        ),
                        const Divider(
                            color: AppTheme.borderDark, height: 24),
                        _ActivityRow(
                          label: 'Times you put phone down',
                          value: '${todayStats.totalPutDowns}',
                          icon: Icons.nightlight_round,
                        ),
                        const Divider(
                            color: AppTheme.borderDark, height: 24),
                        _ActivityRow(
                          label: 'Times you continued',
                          value: '${todayStats.totalContinues}',
                          icon: Icons.phone_android,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  String _getGreeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    if (hour < 21) return 'Good evening';
    return 'Time to wind down';
  }

  String _getSubGreeting(bool isBedtime) {
    if (isBedtime) {
      return 'It\'s past your bedtime. Be mindful of your screen time.';
    }
    return 'Here\'s your mindful phone usage summary.';
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surfaceDark,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.borderDark),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(height: 10),
          Text(
            value,
            style: TextStyle(
              color: AppTheme.textPrimary,
              fontSize: 22,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              color: AppTheme.textSecondary,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

class _ActivityRow extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;

  const _ActivityRow({
    required this.label,
    required this.value,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: AppTheme.textSecondary, size: 20),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            label,
            style: TextStyle(color: AppTheme.textSecondary, fontSize: 14),
          ),
        ),
        Text(
          value,
          style: TextStyle(
            color: AppTheme.textPrimary,
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}
