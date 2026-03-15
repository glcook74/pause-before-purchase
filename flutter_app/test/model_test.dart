import 'package:flutter_test/flutter_test.dart';
import 'package:pause_before_purchase/models/intervention_config.dart';
import 'package:pause_before_purchase/models/usage_session.dart';
import 'package:pause_before_purchase/models/usage_stats.dart';

void main() {
  group('InterventionConfig', () {
    test('default values are correct', () {
      const config = InterventionConfig();
      expect(config.breathingDurationSeconds, 10);
      expect(config.reInterventionMinutes, 10);
      expect(config.bedtimeStartHour, 22);
      expect(config.bedtimeEndHour, 6);
      expect(config.grayscaleMode, false);
      expect(config.dailyScreenTimeLimitMinutes, 120);
    });

    test('isInBedtimeRange works for overnight range', () {
      const config = InterventionConfig(
        bedtimeStartHour: 22,
        bedtimeEndHour: 6,
      );
      // 23:00 should be in bedtime
      expect(config.isInBedtimeRange(DateTime(2024, 1, 1, 23, 0)), true);
      // 03:00 should be in bedtime
      expect(config.isInBedtimeRange(DateTime(2024, 1, 1, 3, 0)), true);
      // 12:00 should not be in bedtime
      expect(config.isInBedtimeRange(DateTime(2024, 1, 1, 12, 0)), false);
    });

    test('serialization roundtrip', () {
      const config = InterventionConfig(
        breathingDurationSeconds: 15,
        reInterventionMinutes: 20,
      );
      final json = config.toJson();
      final restored = InterventionConfig.fromJson(json);
      expect(restored.breathingDurationSeconds, 15);
      expect(restored.reInterventionMinutes, 20);
    });
  });

  group('UsageSession', () {
    test('duration calculation', () {
      final session = UsageSession(
        startTime: DateTime(2024, 1, 1, 10, 0),
        endTime: DateTime(2024, 1, 1, 10, 30),
      );
      expect(session.duration.inMinutes, 30);
    });

    test('serialization roundtrip', () {
      final session = UsageSession(
        startTime: DateTime(2024, 1, 1, 10, 0),
        endTime: DateTime(2024, 1, 1, 10, 30),
        interventionCount: 3,
        putDownCount: 2,
        continueCount: 1,
      );
      final json = session.toJson();
      final restored = UsageSession.fromJson(json);
      expect(restored.interventionCount, 3);
      expect(restored.putDownCount, 2);
      expect(restored.continueCount, 1);
    });
  });

  group('UsageStats', () {
    test('resistance rate calculation', () {
      const stats = UsageStats(
        totalInterventions: 10,
        totalPutDowns: 7,
        totalContinues: 3,
      );
      expect(stats.resistanceRate, 0.7);
      expect(stats.resistancePercentage, '70%');
    });

    test('resistance rate with zero interventions', () {
      const stats = UsageStats();
      expect(stats.resistanceRate, 0.0);
    });

    test('formatted screen time', () {
      const stats = UsageStats(
        totalScreenTime: Duration(hours: 2, minutes: 30),
      );
      expect(stats.formattedScreenTime, '2h 30m');
    });
  });
}
