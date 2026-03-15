class UsageSession {
  final DateTime startTime;
  final DateTime? endTime;
  final int interventionCount;
  final int putDownCount;
  final int continueCount;

  const UsageSession({
    required this.startTime,
    this.endTime,
    this.interventionCount = 0,
    this.putDownCount = 0,
    this.continueCount = 0,
  });

  Duration get duration {
    final end = endTime ?? DateTime.now();
    return end.difference(startTime);
  }

  UsageSession copyWith({
    DateTime? startTime,
    DateTime? endTime,
    int? interventionCount,
    int? putDownCount,
    int? continueCount,
  }) {
    return UsageSession(
      startTime: startTime ?? this.startTime,
      endTime: endTime ?? this.endTime,
      interventionCount: interventionCount ?? this.interventionCount,
      putDownCount: putDownCount ?? this.putDownCount,
      continueCount: continueCount ?? this.continueCount,
    );
  }

  Map<String, dynamic> toJson() => {
        'startTime': startTime.toIso8601String(),
        'endTime': endTime?.toIso8601String(),
        'interventionCount': interventionCount,
        'putDownCount': putDownCount,
        'continueCount': continueCount,
      };

  factory UsageSession.fromJson(Map<String, dynamic> json) {
    return UsageSession(
      startTime: DateTime.parse(json['startTime']),
      endTime:
          json['endTime'] != null ? DateTime.parse(json['endTime']) : null,
      interventionCount: json['interventionCount'] ?? 0,
      putDownCount: json['putDownCount'] ?? 0,
      continueCount: json['continueCount'] ?? 0,
    );
  }
}
