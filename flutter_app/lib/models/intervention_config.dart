class InterventionConfig {
  final int breathingDurationSeconds;
  final int reInterventionMinutes;
  final int bedtimeStartHour;
  final int bedtimeEndHour;
  final bool grayscaleMode;
  final int dailyScreenTimeLimitMinutes;

  const InterventionConfig({
    this.breathingDurationSeconds = 10,
    this.reInterventionMinutes = 10,
    this.bedtimeStartHour = 22,
    this.bedtimeEndHour = 6,
    this.grayscaleMode = false,
    this.dailyScreenTimeLimitMinutes = 120,
  });

  InterventionConfig copyWith({
    int? breathingDurationSeconds,
    int? reInterventionMinutes,
    int? bedtimeStartHour,
    int? bedtimeEndHour,
    bool? grayscaleMode,
    int? dailyScreenTimeLimitMinutes,
  }) {
    return InterventionConfig(
      breathingDurationSeconds:
          breathingDurationSeconds ?? this.breathingDurationSeconds,
      reInterventionMinutes:
          reInterventionMinutes ?? this.reInterventionMinutes,
      bedtimeStartHour: bedtimeStartHour ?? this.bedtimeStartHour,
      bedtimeEndHour: bedtimeEndHour ?? this.bedtimeEndHour,
      grayscaleMode: grayscaleMode ?? this.grayscaleMode,
      dailyScreenTimeLimitMinutes:
          dailyScreenTimeLimitMinutes ?? this.dailyScreenTimeLimitMinutes,
    );
  }

  Map<String, dynamic> toJson() => {
        'breathingDurationSeconds': breathingDurationSeconds,
        'reInterventionMinutes': reInterventionMinutes,
        'bedtimeStartHour': bedtimeStartHour,
        'bedtimeEndHour': bedtimeEndHour,
        'grayscaleMode': grayscaleMode,
        'dailyScreenTimeLimitMinutes': dailyScreenTimeLimitMinutes,
      };

  factory InterventionConfig.fromJson(Map<String, dynamic> json) {
    return InterventionConfig(
      breathingDurationSeconds: json['breathingDurationSeconds'] ?? 10,
      reInterventionMinutes: json['reInterventionMinutes'] ?? 10,
      bedtimeStartHour: json['bedtimeStartHour'] ?? 22,
      bedtimeEndHour: json['bedtimeEndHour'] ?? 6,
      grayscaleMode: json['grayscaleMode'] ?? false,
      dailyScreenTimeLimitMinutes: json['dailyScreenTimeLimitMinutes'] ?? 120,
    );
  }

  bool isInBedtimeRange(DateTime time) {
    final hour = time.hour;
    if (bedtimeStartHour > bedtimeEndHour) {
      return hour >= bedtimeStartHour || hour < bedtimeEndHour;
    }
    return hour >= bedtimeStartHour && hour < bedtimeEndHour;
  }
}
