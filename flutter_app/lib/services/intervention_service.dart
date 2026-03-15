import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/intervention_config.dart';

class InterventionService extends ChangeNotifier {
  static const String _configKey = 'intervention_config';

  InterventionConfig _config = const InterventionConfig();
  Timer? _reInterventionTimer;
  bool _isBreathingActive = false;
  DateTime? _lastInterventionTime;

  InterventionConfig get config => _config;
  bool get isBreathingActive => _isBreathingActive;

  Future<void> loadConfig() async {
    final prefs = await SharedPreferences.getInstance();
    final configJson = prefs.getString(_configKey);
    if (configJson != null) {
      _config = InterventionConfig.fromJson(jsonDecode(configJson));
      notifyListeners();
    }
  }

  Future<void> saveConfig(InterventionConfig newConfig) async {
    _config = newConfig;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_configKey, jsonEncode(_config.toJson()));
    notifyListeners();
  }

  void startBreathing() {
    _isBreathingActive = true;
    notifyListeners();
  }

  void completeBreathing() {
    _isBreathingActive = false;
    _lastInterventionTime = DateTime.now();
    notifyListeners();
  }

  void startReInterventionTimer(VoidCallback onTrigger) {
    _reInterventionTimer?.cancel();
    _reInterventionTimer = Timer(
      Duration(minutes: _config.reInterventionMinutes),
      () {
        onTrigger();
        notifyListeners();
      },
    );
  }

  void cancelReInterventionTimer() {
    _reInterventionTimer?.cancel();
  }

  bool shouldIntervene() {
    if (_lastInterventionTime == null) return true;
    final elapsed = DateTime.now().difference(_lastInterventionTime!);
    return elapsed.inMinutes >= _config.reInterventionMinutes;
  }

  bool isBedtime() {
    return _config.isInBedtimeRange(DateTime.now());
  }

  @override
  void dispose() {
    _reInterventionTimer?.cancel();
    super.dispose();
  }
}
