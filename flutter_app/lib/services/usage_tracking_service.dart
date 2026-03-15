import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/usage_session.dart';
import '../models/usage_stats.dart';

class UsageTrackingService extends ChangeNotifier {
  static const String _sessionsKey = 'usage_sessions';
  static const String _streakKey = 'streak_data';

  List<UsageSession> _sessions = [];
  UsageSession? _currentSession;
  int _currentStreak = 0;
  int _bestStreak = 0;
  DateTime? _lastHealthyDay;

  List<UsageSession> get sessions => _sessions;
  UsageSession? get currentSession => _currentSession;
  int get currentStreak => _currentStreak;
  int get bestStreak => _bestStreak;

  Future<void> loadData() async {
    final prefs = await SharedPreferences.getInstance();

    final sessionsJson = prefs.getString(_sessionsKey);
    if (sessionsJson != null) {
      final List<dynamic> decoded = jsonDecode(sessionsJson);
      _sessions = decoded.map((e) => UsageSession.fromJson(e)).toList();
    }

    _currentStreak = prefs.getInt('current_streak') ?? 0;
    _bestStreak = prefs.getInt('best_streak') ?? 0;
    final lastHealthy = prefs.getString('last_healthy_day');
    if (lastHealthy != null) {
      _lastHealthyDay = DateTime.parse(lastHealthy);
    }

    notifyListeners();
  }

  Future<void> _saveSessions() async {
    final prefs = await SharedPreferences.getInstance();
    final json = jsonEncode(_sessions.map((s) => s.toJson()).toList());
    await prefs.setString(_sessionsKey, json);
  }

  Future<void> _saveStreak() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('current_streak', _currentStreak);
    await prefs.setInt('best_streak', _bestStreak);
    if (_lastHealthyDay != null) {
      await prefs.setString(
          'last_healthy_day', _lastHealthyDay!.toIso8601String());
    }
  }

  void startSession() {
    _currentSession = UsageSession(startTime: DateTime.now());
    notifyListeners();
  }

  Future<void> endSession() async {
    if (_currentSession != null) {
      final ended = _currentSession!.copyWith(endTime: DateTime.now());
      _sessions.add(ended);
      _currentSession = null;
      await _saveSessions();
      notifyListeners();
    }
  }

  Future<void> recordIntervention({required bool putDown}) async {
    if (_currentSession != null) {
      _currentSession = _currentSession!.copyWith(
        interventionCount: _currentSession!.interventionCount + 1,
        putDownCount:
            _currentSession!.putDownCount + (putDown ? 1 : 0),
        continueCount:
            _currentSession!.continueCount + (putDown ? 0 : 1),
      );

      if (putDown) {
        await _updateStreak();
      }

      notifyListeners();
    }
  }

  Future<void> _updateStreak() async {
    final today = DateTime.now();
    final todayDate = DateTime(today.year, today.month, today.day);

    if (_lastHealthyDay == null) {
      _currentStreak = 1;
      _lastHealthyDay = todayDate;
    } else {
      final diff = todayDate.difference(_lastHealthyDay!).inDays;
      if (diff == 1) {
        _currentStreak++;
        _lastHealthyDay = todayDate;
      } else if (diff > 1) {
        _currentStreak = 1;
        _lastHealthyDay = todayDate;
      }
      // diff == 0 means same day, no change
    }

    if (_currentStreak > _bestStreak) {
      _bestStreak = _currentStreak;
    }

    await _saveStreak();
  }

  UsageStats getTodayStats() {
    final now = DateTime.now();
    final todayStart = DateTime(now.year, now.month, now.day);
    return _getStatsForRange(todayStart, now);
  }

  UsageStats getWeeklyStats() {
    final now = DateTime.now();
    final weekStart = now.subtract(Duration(days: now.weekday - 1));
    final weekStartDate =
        DateTime(weekStart.year, weekStart.month, weekStart.day);
    return _getStatsForRange(weekStartDate, now);
  }

  UsageStats _getStatsForRange(DateTime start, DateTime end) {
    final rangeSessions = _sessions.where((s) {
      return s.startTime.isAfter(start) &&
          s.startTime.isBefore(end.add(const Duration(days: 1)));
    }).toList();

    var totalTime = Duration.zero;
    var totalInterventions = 0;
    var totalPutDowns = 0;
    var totalContinues = 0;
    final hourlyActivity = <int, Duration>{};
    final dailyActivity = <String, Duration>{};

    for (final session in rangeSessions) {
      totalTime += session.duration;
      totalInterventions += session.interventionCount;
      totalPutDowns += session.putDownCount;
      totalContinues += session.continueCount;

      // Hourly breakdown
      final hour = session.startTime.hour;
      hourlyActivity[hour] =
          (hourlyActivity[hour] ?? Duration.zero) + session.duration;

      // Daily breakdown
      final dateKey =
          '${session.startTime.year}-${session.startTime.month.toString().padLeft(2, '0')}-${session.startTime.day.toString().padLeft(2, '0')}';
      dailyActivity[dateKey] =
          (dailyActivity[dateKey] ?? Duration.zero) + session.duration;
    }

    return UsageStats(
      totalScreenTime: totalTime,
      sessionCount: rangeSessions.length,
      totalInterventions: totalInterventions,
      totalPutDowns: totalPutDowns,
      totalContinues: totalContinues,
      hourlyActivity: hourlyActivity,
      dailyActivity: dailyActivity,
      currentStreak: _currentStreak,
      bestStreak: _bestStreak,
    );
  }
}
