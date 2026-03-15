import 'package:flutter/foundation.dart';
import '../models/intervention_config.dart';

class NightModeService extends ChangeNotifier {
  bool _isNightMode = false;
  String _currentFact = '';
  int _factIndex = 0;

  bool get isNightMode => _isNightMode;
  String get currentFact => _currentFact;

  static const List<String> sleepFacts = [
    'Blue light from screens suppresses melatonin production by up to 50%.',
    'Adults need 7-9 hours of sleep for optimal health.',
    'Sleep deprivation affects your brain like alcohol intoxication.',
    'Your phone triggers dopamine hits that keep you scrolling.',
    'Poor sleep increases risk of anxiety and depression by 60%.',
    'Screen time before bed delays sleep onset by 30+ minutes.',
    'Your body repairs itself during deep sleep cycles.',
    'Late-night scrolling disrupts your circadian rhythm for days.',
    'Quality sleep improves memory consolidation and learning.',
    'Every hour of lost sleep compounds cognitive decline.',
    'Dopamine from scrolling creates a cycle that gets harder to break.',
    'Your future self will thank you for putting the phone down now.',
    'The content will still be there tomorrow. Your sleep won\'t wait.',
    'Night owls who fix their sleep report 25% better mood.',
    'Even 15 minutes less screen time before bed improves sleep quality.',
  ];

  void checkNightMode(InterventionConfig config) {
    final wasNightMode = _isNightMode;
    _isNightMode = config.isInBedtimeRange(DateTime.now());
    if (_isNightMode && !wasNightMode) {
      rotateFact();
    }
    notifyListeners();
  }

  void rotateFact() {
    _currentFact = sleepFacts[_factIndex % sleepFacts.length];
    _factIndex++;
    notifyListeners();
  }

  String getUrgencyMessage() {
    final hour = DateTime.now().hour;
    if (hour >= 3 && hour < 6) {
      return 'It\'s very late. Your body desperately needs rest. Please put your phone down.';
    } else if (hour >= 1 && hour < 3) {
      return 'It\'s past 1 AM. Tomorrow will be much harder without sleep.';
    } else if (hour >= 0 && hour < 1) {
      return 'It\'s past midnight. Every minute of scrolling costs you rest.';
    } else if (hour >= 23) {
      return 'It\'s getting late. Consider winding down for better sleep.';
    } else if (hour >= 22) {
      return 'Bedtime is approaching. This is a great time to start relaxing.';
    }
    return 'Take a moment to consider if you really need your phone right now.';
  }

  int getUrgencyLevel() {
    final hour = DateTime.now().hour;
    if (hour >= 3 && hour < 6) return 5;
    if (hour >= 1 && hour < 3) return 4;
    if (hour >= 0 && hour < 1) return 3;
    if (hour >= 23) return 2;
    if (hour >= 22) return 1;
    return 0;
  }
}
