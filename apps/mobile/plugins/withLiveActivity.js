const { withXcodeProject, withInfoPlist, IOSConfig } = require('expo/config-plugins');
const path = require('path');
const fs = require('fs');

const WIDGET_NAME = 'PNLWidgets';
const WIDGET_BUNDLE_ID = 'com.pnl.app.PNLWidgets';
const DEVELOPMENT_TEAM = '3J9FNDASSV';
const WIDGET_DEPLOYMENT_TARGET = '16.1';

/**
 * Expo config plugin that adds the PNLWidgets extension target
 * for Dynamic Island / Live Activity support.
 */
const withLiveActivity = (config) => {
  // Step 1: Add NSSupportsLiveActivities to Info.plist
  config = withInfoPlist(config, (config) => {
    config.modResults.NSSupportsLiveActivities = true;
    config.modResults.NSSupportsLiveActivitiesFrequentUpdates = true;
    return config;
  });

  // Step 2: Add widget extension target to Xcode project
  config = withXcodeProject(config, (config) => {
    const project = config.modResults;
    const pbxProject = project.hash.project.objects;

    // Check if widget target already exists
    const targets = project.hash.project.objects.PBXNativeTarget || {};
    for (const key of Object.keys(targets)) {
      if (typeof targets[key] === 'object' && targets[key].name === `"${WIDGET_NAME}"`) {
        return config; // Already added
      }
    }

    const widgetSourceDir = path.join(config.modRequest.platformProjectRoot, WIDGET_NAME);

    // Copy widget extension source files if they don't exist in the build directory
    const sourceFiles = [
      'VoiceRoomActivityAttributes.swift',
      'VoiceRoomLiveActivity.swift',
      'PNLWidgetsBundle.swift',
      'Info.plist',
    ];

    if (!fs.existsSync(widgetSourceDir)) {
      fs.mkdirSync(widgetSourceDir, { recursive: true });
    }

    for (const file of sourceFiles) {
      const src = path.join(config.modRequest.platformProjectRoot, WIDGET_NAME, file);
      if (!fs.existsSync(src)) {
        // Files should already be in ios/PNLWidgets/ from the repo
        const repoSrc = path.join(__dirname, '..', 'ios', WIDGET_NAME, file);
        if (fs.existsSync(repoSrc)) {
          fs.copyFileSync(repoSrc, src);
        }
      }
    }

    // Add widget extension target
    const widgetTarget = project.addTarget(
      WIDGET_NAME,
      'app_extension',
      WIDGET_NAME,
      WIDGET_BUNDLE_ID
    );

    // Add source files to widget target
    const widgetGroupKey = project.addPbxGroup(
      sourceFiles.filter((f) => f.endsWith('.swift')),
      WIDGET_NAME,
      WIDGET_NAME
    );

    // Add the group to the main project group
    const mainGroupId = project.getFirstProject().firstProject.mainGroup;
    project.addToPbxGroup(widgetGroupKey.uuid, mainGroupId);

    // Add Swift files to widget target's build phase
    for (const file of sourceFiles) {
      if (file.endsWith('.swift')) {
        project.addSourceFile(
          `${WIDGET_NAME}/${file}`,
          { target: widgetTarget.uuid },
          widgetGroupKey.uuid
        );
      }
    }

    // Configure widget target build settings
    const configurations = project.pbxXCBuildConfigurationSection();
    for (const key in configurations) {
      const config_entry = configurations[key];
      if (typeof config_entry !== 'object') continue;

      const buildSettings = config_entry.buildSettings;
      if (!buildSettings) continue;

      // Check if this configuration belongs to the widget target
      if (
        buildSettings.PRODUCT_BUNDLE_IDENTIFIER === `"${WIDGET_BUNDLE_ID}"` ||
        buildSettings.PRODUCT_NAME === `"${WIDGET_NAME}"`
      ) {
        buildSettings.IPHONEOS_DEPLOYMENT_TARGET = WIDGET_DEPLOYMENT_TARGET;
        buildSettings.DEVELOPMENT_TEAM = DEVELOPMENT_TEAM;
        buildSettings.SWIFT_VERSION = '5.0';
        buildSettings.TARGETED_DEVICE_FAMILY = '"1,2"';
        buildSettings.CODE_SIGN_STYLE = 'Automatic';
        buildSettings.INFOPLIST_FILE = `${WIDGET_NAME}/Info.plist`;
        buildSettings.GENERATE_INFOPLIST_FILE = 'YES';
        buildSettings.MARKETING_VERSION = '1.0';
        buildSettings.CURRENT_PROJECT_VERSION = '1';
        buildSettings.SWIFT_EMIT_LOC_STRINGS = 'YES';
        buildSettings.ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = 'AccentColor';
        buildSettings.ASSETCATALOG_COMPILER_WIDGET_BACKGROUND_COLOR_NAME = 'WidgetBackground';
      }
    }

    // Add widget extension to the main app's embed frameworks build phase
    project.addBuildPhase(
      [],
      'PBXCopyFilesBuildPhase',
      'Embed App Extensions',
      project.getFirstTarget().uuid,
      'app_extension'
    );

    return config;
  });

  return config;
};

module.exports = withLiveActivity;
