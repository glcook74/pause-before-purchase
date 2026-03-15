class UsageStats {
  final Duration totalScreenTime;
  final int sessionCount;
  final int totalInterventions;
  final int totalPutDowns;
  final int totalContinues;
  final Map<int, Duration> hourlyActivity; // hour -> duration
  final Map<String, Duration> dailyActivity; // date string -> duration
  final int currentStreak;
  final int bestStreak;

  const UsageStats({
    this.totalScreenTime = Duration.zero,
    this.sessionCount = 0,
    this.totalInterventions = 0,
    this.totalPutDowns = 0,
    this.totalContinues = 0,
    this.hourlyActivity = const {},
    this.dailyActivity = const {},
    this.currentStreak = 0,
    this.bestStreak = 0,
  });

  double get resistanceRate {
    if (totalInterventions == 0) return 0.0;
    return totalPutDowns / totalInterventions;
  }

  String get resistancePercentage {
    return '${(resistanceRate * 100).toStringAsFixed(0)}%';
  }

  String get formattedScreenTime {
    final hours = totalScreenTime.inHours;
    final minutes = totalScreenTime.inMinutes.remainder(60);
    if (hours > 0) {
      return '${hours}h ${minutes}m';
    }
    return '${minutes}m';
  }
}
