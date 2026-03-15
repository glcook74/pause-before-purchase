import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'services/intervention_service.dart';
import 'services/usage_tracking_service.dart';
import 'services/night_mode_service.dart';
import 'screens/home_screen.dart';
import 'screens/usage_stats_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/breathing_exercise_screen.dart';
import 'screens/night_owl_overlay_screen.dart';
import 'theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: AppTheme.surfaceDark,
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );
  runApp(const PauseBeforePurchaseApp());
}

class PauseBeforePurchaseApp extends StatelessWidget {
  const PauseBeforePurchaseApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Pause Before Purchase',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      home: const AppShell(),
    );
  }
}

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> with WidgetsBindingObserver {
  final InterventionService _interventionService = InterventionService();
  final UsageTrackingService _usageTrackingService = UsageTrackingService();
  final NightModeService _nightModeService = NightModeService();

  int _currentIndex = 0;
  bool _showBreathing = false;
  bool _showNightOverlay = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initialize();
  }

  Future<void> _initialize() async {
    await _interventionService.loadConfig();
    await _usageTrackingService.loadData();
    _nightModeService.checkNightMode(_interventionService.config);

    // Start a usage session
    _usageTrackingService.startSession();

    // Check if we should show night overlay
    if (_nightModeService.isNightMode) {
      setState(() => _showNightOverlay = true);
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      _usageTrackingService.endSession();
    } else if (state == AppLifecycleState.resumed) {
      _usageTrackingService.startSession();
      _nightModeService.checkNightMode(_interventionService.config);
      if (_nightModeService.isNightMode &&
          _interventionService.shouldIntervene()) {
        setState(() => _showNightOverlay = true);
      }
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _interventionService.dispose();
    _usageTrackingService.endSession();
    super.dispose();
  }

  void _startBreathing() {
    setState(() {
      _showBreathing = true;
      _showNightOverlay = false;
    });
    _interventionService.startBreathing();
  }

  void _onBreathingComplete() {
    setState(() => _showBreathing = false);
    // Start re-intervention timer
    _interventionService.startReInterventionTimer(() {
      if (mounted && _nightModeService.isNightMode) {
        setState(() => _showNightOverlay = true);
      }
    });
  }

  void _onPutDown() {
    setState(() => _showBreathing = false);
  }

  @override
  Widget build(BuildContext context) {
    // Show breathing exercise overlay
    if (_showBreathing) {
      return BreathingExerciseScreen(
        interventionService: _interventionService,
        usageTrackingService: _usageTrackingService,
        onComplete: _onBreathingComplete,
        onPutDown: _onPutDown,
      );
    }

    // Show night owl overlay
    if (_showNightOverlay) {
      return NightOwlOverlayScreen(
        nightModeService: _nightModeService,
        onDismiss: () {
          setState(() => _showNightOverlay = false);
          _usageTrackingService.recordIntervention(putDown: true);
        },
        onStartBreathing: _startBreathing,
      );
    }

    // Main app with bottom navigation
    final screens = [
      HomeScreen(
        interventionService: _interventionService,
        usageTrackingService: _usageTrackingService,
        nightModeService: _nightModeService,
        onStartBreathing: _startBreathing,
      ),
      UsageStatsScreen(
        usageTrackingService: _usageTrackingService,
      ),
      SettingsScreen(
        interventionService: _interventionService,
      ),
    ];

    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: screens,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) {
          setState(() => _currentIndex = index);
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.bar_chart_outlined),
            selectedIcon: Icon(Icons.bar_chart),
            label: 'Stats',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings),
            label: 'Settings',
          ),
        ],
      ),
    );
  }
}
