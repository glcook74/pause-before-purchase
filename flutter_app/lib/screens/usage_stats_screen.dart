import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../services/usage_tracking_service.dart';
import '../models/usage_stats.dart';
import '../theme.dart';

class UsageStatsScreen extends StatefulWidget {
  final UsageTrackingService usageTrackingService;

  const UsageStatsScreen({
    super.key,
    required this.usageTrackingService,
  });

  @override
  State<UsageStatsScreen> createState() => _UsageStatsScreenState();
}

class _UsageStatsScreenState extends State<UsageStatsScreen> {
  bool _showWeekly = false;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.usageTrackingService,
      builder: (context, _) {
        final stats = _showWeekly
            ? widget.usageTrackingService.getWeeklyStats()
            : widget.usageTrackingService.getTodayStats();

        return Scaffold(
          backgroundColor: AppTheme.backgroundDark,
          body: SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 8),
                  Text(
                    'Usage Statistics',
                    style: Theme.of(context)
                        .textTheme
                        .headlineSmall
                        ?.copyWith(
                          color: AppTheme.textPrimary,
                          fontWeight: FontWeight.w300,
                        ),
                  ),
                  const SizedBox(height: 20),

                  // Toggle
                  _buildToggle(),
                  const SizedBox(height: 24),

                  // Summary cards
                  _buildSummaryCards(stats),
                  const SizedBox(height: 24),

                  // Hourly activity chart
                  Text(
                    _showWeekly ? 'Daily Activity' : 'Hourly Activity',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(color: AppTheme.textPrimary),
                  ),
                  const SizedBox(height: 12),
                  _buildActivityChart(stats),
                  const SizedBox(height: 24),

                  // Resistance chart
                  Text(
                    'Resistance Rate',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(color: AppTheme.textPrimary),
                  ),
                  const SizedBox(height: 12),
                  _buildResistanceCard(stats),
                  const SizedBox(height: 24),

                  // Streak section
                  _buildStreakCard(stats),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildToggle() {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surfaceDark,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _showWeekly = false),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: !_showWeekly
                      ? AppTheme.accentCyan.withAlpha(30)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(12),
                  border: !_showWeekly
                      ? Border.all(
                          color: AppTheme.accentCyan.withAlpha(80))
                      : null,
                ),
                child: Center(
                  child: Text(
                    'Today',
                    style: TextStyle(
                      color: !_showWeekly
                          ? AppTheme.accentCyan
                          : AppTheme.textSecondary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),
            ),
          ),
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _showWeekly = true),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: _showWeekly
                      ? AppTheme.accentCyan.withAlpha(30)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(12),
                  border: _showWeekly
                      ? Border.all(
                          color: AppTheme.accentCyan.withAlpha(80))
                      : null,
                ),
                child: Center(
                  child: Text(
                    'This Week',
                    style: TextStyle(
                      color: _showWeekly
                          ? AppTheme.accentCyan
                          : AppTheme.textSecondary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryCards(UsageStats stats) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _SummaryCard(
                label: 'Screen Time',
                value: stats.formattedScreenTime,
                icon: Icons.timer_outlined,
                color: AppTheme.accentCyan,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _SummaryCard(
                label: 'Sessions',
                value: '${stats.sessionCount}',
                icon: Icons.repeat,
                color: AppTheme.accentPurple,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _SummaryCard(
                label: 'Interventions',
                value: '${stats.totalInterventions}',
                icon: Icons.self_improvement,
                color: AppTheme.accentAmber,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _SummaryCard(
                label: 'Put Phone Down',
                value: '${stats.totalPutDowns}',
                icon: Icons.nightlight_round,
                color: AppTheme.accentGreen,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildActivityChart(UsageStats stats) {
    List<BarChartGroupData> barGroups;

    if (_showWeekly) {
      // Daily bars
      barGroups = [];
      final now = DateTime.now();
      for (int i = 6; i >= 0; i--) {
        final date = now.subtract(Duration(days: i));
        final dateKey =
            '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
        final duration = stats.dailyActivity[dateKey] ?? Duration.zero;
        barGroups.add(
          BarChartGroupData(
            x: 6 - i,
            barRods: [
              BarChartRodData(
                toY: duration.inMinutes.toDouble(),
                color: AppTheme.accentCyan,
                width: 20,
                borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(6)),
              ),
            ],
          ),
        );
      }
    } else {
      // Hourly bars
      barGroups = [];
      for (int hour = 0; hour < 24; hour++) {
        final duration = stats.hourlyActivity[hour] ?? Duration.zero;
        barGroups.add(
          BarChartGroupData(
            x: hour,
            barRods: [
              BarChartRodData(
                toY: duration.inMinutes.toDouble(),
                color: hour >= 22 || hour < 6
                    ? AppTheme.accentAmber
                    : AppTheme.accentCyan,
                width: 8,
                borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(3)),
              ),
            ],
          ),
        );
      }
    }

    return Container(
      height: 200,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surfaceDark,
        borderRadius: BorderRadius.circular(16),
      ),
      child: barGroups.isEmpty || barGroups.every((g) => g.barRods.first.toY == 0)
          ? Center(
              child: Text(
                'No activity data yet',
                style: TextStyle(color: AppTheme.textSecondary),
              ),
            )
          : BarChart(
              BarChartData(
                gridData: const FlGridData(show: false),
                titlesData: FlTitlesData(
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 32,
                      getTitlesWidget: (value, meta) {
                        return Text(
                          '${value.toInt()}m',
                          style: TextStyle(
                            color: AppTheme.textSecondary,
                            fontSize: 10,
                          ),
                        );
                      },
                    ),
                  ),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      getTitlesWidget: (value, meta) {
                        if (_showWeekly) {
                          final days = [
                            'M', 'T', 'W', 'T', 'F', 'S', 'S'
                          ];
                          final now = DateTime.now();
                          final dayIndex =
                              (now.weekday - 7 + value.toInt()) % 7;
                          return Text(
                            days[dayIndex],
                            style: TextStyle(
                              color: AppTheme.textSecondary,
                              fontSize: 10,
                            ),
                          );
                        }
                        if (value.toInt() % 4 == 0) {
                          return Text(
                            '${value.toInt()}h',
                            style: TextStyle(
                              color: AppTheme.textSecondary,
                              fontSize: 10,
                            ),
                          );
                        }
                        return const SizedBox.shrink();
                      },
                    ),
                  ),
                  topTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false)),
                ),
                borderData: FlBorderData(show: false),
                barGroups: barGroups,
              ),
            ),
    );
  }

  Widget _buildResistanceCard(UsageStats stats) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.surfaceDark,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                stats.resistancePercentage,
                style: TextStyle(
                  color: AppTheme.accentGreen,
                  fontSize: 48,
                  fontWeight: FontWeight.w200,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'of the time you chose to put your phone down',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppTheme.textSecondary,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 16),
          // Visual bar
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: stats.resistanceRate,
              backgroundColor: AppTheme.borderDark,
              valueColor:
                  AlwaysStoppedAnimation<Color>(AppTheme.accentGreen),
              minHeight: 8,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStreakCard(UsageStats stats) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.surfaceDark,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.borderDark),
      ),
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: AppTheme.accentAmber.withAlpha(25),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(
              Icons.local_fire_department,
              color: AppTheme.accentAmber,
              size: 28,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${stats.currentStreak} Day Streak',
                  style: TextStyle(
                    color: AppTheme.textPrimary,
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  'Best: ${stats.bestStreak} days',
                  style: TextStyle(
                    color: AppTheme.textSecondary,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _SummaryCard({
    required this.label,
    required this.value,
    required this.icon,
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
          Icon(icon, color: color, size: 20),
          const SizedBox(height: 10),
          Text(
            value,
            style: TextStyle(
              color: AppTheme.textPrimary,
              fontSize: 20,
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
