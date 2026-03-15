import 'package:flutter/material.dart';
import '../services/intervention_service.dart';
import '../models/intervention_config.dart';
import '../theme.dart';

class SettingsScreen extends StatelessWidget {
  final InterventionService interventionService;

  const SettingsScreen({
    super.key,
    required this.interventionService,
  });

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: interventionService,
      builder: (context, _) {
        final config = interventionService.config;

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
                    'Settings',
                    style: Theme.of(context)
                        .textTheme
                        .headlineSmall
                        ?.copyWith(
                          color: AppTheme.textPrimary,
                          fontWeight: FontWeight.w300,
                        ),
                  ),
                  const SizedBox(height: 24),

                  // Breathing duration
                  _SettingsSection(
                    title: 'Breathing Exercise',
                    children: [
                      _SliderSetting(
                        label: 'Duration',
                        value: config.breathingDurationSeconds.toDouble(),
                        min: 3,
                        max: 30,
                        divisions: 27,
                        suffix: 'seconds',
                        onChanged: (val) {
                          interventionService.saveConfig(
                            config.copyWith(
                                breathingDurationSeconds: val.toInt()),
                          );
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // Re-intervention
                  _SettingsSection(
                    title: 'Re-intervention',
                    children: [
                      _SliderSetting(
                        label: 'Check-in interval',
                        value: config.reInterventionMinutes.toDouble(),
                        min: 1,
                        max: 60,
                        divisions: 59,
                        suffix: 'minutes',
                        onChanged: (val) {
                          interventionService.saveConfig(
                            config.copyWith(
                                reInterventionMinutes: val.toInt()),
                          );
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // Bedtime
                  _SettingsSection(
                    title: 'Bedtime Hours',
                    children: [
                      _TimeSetting(
                        label: 'Bedtime starts',
                        hour: config.bedtimeStartHour,
                        onChanged: (hour) {
                          interventionService.saveConfig(
                            config.copyWith(bedtimeStartHour: hour),
                          );
                        },
                      ),
                      const Divider(
                          color: AppTheme.borderDark, height: 1),
                      _TimeSetting(
                        label: 'Bedtime ends',
                        hour: config.bedtimeEndHour,
                        onChanged: (hour) {
                          interventionService.saveConfig(
                            config.copyWith(bedtimeEndHour: hour),
                          );
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // Screen time limit
                  _SettingsSection(
                    title: 'Daily Limits',
                    children: [
                      _SliderSetting(
                        label: 'Screen time limit',
                        value: config.dailyScreenTimeLimitMinutes
                            .toDouble(),
                        min: 15,
                        max: 480,
                        divisions: 31,
                        suffix: 'minutes',
                        displayFormatter: (val) {
                          final hours = val.toInt() ~/ 60;
                          final mins = val.toInt() % 60;
                          if (hours > 0 && mins > 0) {
                            return '${hours}h ${mins}m';
                          }
                          if (hours > 0) return '${hours}h';
                          return '${mins}m';
                        },
                        onChanged: (val) {
                          interventionService.saveConfig(
                            config.copyWith(
                                dailyScreenTimeLimitMinutes: val.toInt()),
                          );
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // Grayscale
                  _SettingsSection(
                    title: 'Display',
                    children: [
                      _ToggleSetting(
                        label: 'Grayscale mode',
                        subtitle:
                            'Makes screen less stimulating during bedtime',
                        value: config.grayscaleMode,
                        onChanged: (val) {
                          interventionService.saveConfig(
                            config.copyWith(grayscaleMode: val),
                          );
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),

                  // About
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: AppTheme.surfaceDark,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      children: [
                        Icon(
                          Icons.self_improvement,
                          color: AppTheme.accentCyan,
                          size: 32,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Pause Before Purchase',
                          style: TextStyle(
                            color: AppTheme.textPrimary,
                            fontSize: 16,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'v1.0.0',
                          style: TextStyle(
                            color: AppTheme.textSecondary,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Break the scroll-dopamine loop.\nBuild healthier phone habits.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: AppTheme.textSecondary,
                            fontSize: 13,
                            height: 1.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _SettingsSection extends StatelessWidget {
  final String title;
  final List<Widget> children;

  const _SettingsSection({
    required this.title,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: TextStyle(
            color: AppTheme.accentCyan,
            fontSize: 13,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(
            color: AppTheme.surfaceDark,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(children: children),
        ),
      ],
    );
  }
}

class _SliderSetting extends StatelessWidget {
  final String label;
  final double value;
  final double min;
  final double max;
  final int divisions;
  final String suffix;
  final String Function(double)? displayFormatter;
  final ValueChanged<double> onChanged;

  const _SliderSetting({
    required this.label,
    required this.value,
    required this.min,
    required this.max,
    required this.divisions,
    required this.suffix,
    this.displayFormatter,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final displayValue = displayFormatter != null
        ? displayFormatter!(value)
        : '${value.toInt()} $suffix';

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                label,
                style: TextStyle(
                    color: AppTheme.textPrimary, fontSize: 15),
              ),
              Text(
                displayValue,
                style: TextStyle(
                  color: AppTheme.accentCyan,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          SliderTheme(
            data: SliderThemeData(
              activeTrackColor: AppTheme.accentCyan,
              inactiveTrackColor: AppTheme.borderDark,
              thumbColor: AppTheme.accentCyan,
              overlayColor: AppTheme.accentCyan.withAlpha(30),
              trackHeight: 4,
            ),
            child: Slider(
              value: value.clamp(min, max),
              min: min,
              max: max,
              divisions: divisions,
              onChanged: onChanged,
            ),
          ),
        ],
      ),
    );
  }
}

class _TimeSetting extends StatelessWidget {
  final String label;
  final int hour;
  final ValueChanged<int> onChanged;

  const _TimeSetting({
    required this.label,
    required this.hour,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () async {
        final time = await showTimePicker(
          context: context,
          initialTime: TimeOfDay(hour: hour, minute: 0),
          builder: (context, child) {
            return Theme(
              data: ThemeData.dark().copyWith(
                colorScheme: ColorScheme.dark(
                  primary: AppTheme.accentCyan,
                  surface: AppTheme.surfaceDark,
                ),
              ),
              child: child!,
            );
          },
        );
        if (time != null) {
          onChanged(time.hour);
        }
      },
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              label,
              style:
                  TextStyle(color: AppTheme.textPrimary, fontSize: 15),
            ),
            Row(
              children: [
                Text(
                  _formatHour(hour),
                  style: TextStyle(
                    color: AppTheme.accentCyan,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(width: 8),
                Icon(
                  Icons.chevron_right,
                  color: AppTheme.textSecondary,
                  size: 20,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _formatHour(int hour) {
    if (hour == 0) return '12:00 AM';
    if (hour < 12) return '$hour:00 AM';
    if (hour == 12) return '12:00 PM';
    return '${hour - 12}:00 PM';
  }
}

class _ToggleSetting extends StatelessWidget {
  final String label;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _ToggleSetting({
    required this.label,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                      color: AppTheme.textPrimary, fontSize: 15),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: TextStyle(
                    color: AppTheme.textSecondary,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
            activeColor: AppTheme.accentCyan,
            activeTrackColor: AppTheme.accentCyan.withAlpha(80),
            inactiveThumbColor: AppTheme.textSecondary,
            inactiveTrackColor: AppTheme.borderDark,
          ),
        ],
      ),
    );
  }
}
