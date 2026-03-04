/**
 * Tab Navigation Layout
 * 5 tabs: Feed, Explore, Launched, Alerts, Profile
 * Dark navy tab bar with cosmic theme
 */

import { useCallback, useEffect, useState } from 'react';
import { Tabs, router } from 'expo-router';
import { Platform, StyleSheet, View, Text, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiUrl } from '@pnl/shared/utils';
import { useAuth } from '../../src/providers/AuthProvider';
import { useProfile, resolveAvatarUrl } from '../../src/hooks/useProfile';
import { WelcomeCard } from '../../src/components';
import { colors } from '../../src/theme';

const TAB_BAR_BG = 'transparent';

type TabIconName = keyof typeof Ionicons.glyphMap;

function RingsIcon({ color, focused }: { color: string; focused: boolean }) {
  return (
    <View style={styles.ringsContainer}>
      <View style={[styles.ringOuter, { borderColor: color, borderWidth: focused ? 2 : 1.5 }]}>
        <View style={[styles.ringMiddle, { borderColor: color, borderWidth: focused ? 2 : 1.5 }]}>
          <View style={[styles.ringInner, { borderColor: color, borderWidth: focused ? 2 : 1.5 }]} />
        </View>
      </View>
    </View>
  );
}

function TabBarIcon({
  name,
  focusedName,
  color,
  focused,
  badge,
}: {
  name: TabIconName;
  focusedName: TabIconName;
  color: string;
  focused: boolean;
  badge?: number;
}) {
  return (
    <View style={styles.iconContainer}>
      <View>
        <Ionicons name={focused ? focusedName : name} size={24} color={color} />
        {badge != null && badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {badge > 9 ? '9+' : badge}
            </Text>
          </View>
        )}
      </View>
      {focused && <View style={styles.activeIndicator} />}
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 60 + (Platform.OS === 'ios' ? insets.bottom : 8);
  const { isAuthenticated, walletAddress } = useAuth();
  const { profile } = useProfile(walletAddress);
  const profileAvatarUrl = profile?.profilePhotoUrl
    ? resolveAvatarUrl(profile.profilePhotoUrl)
    : null;
  const [unreadCount, setUnreadCount] = useState(0);
  // Show welcome every time user is not logged in; dismiss lets them browse
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const showWelcome = !isAuthenticated && !welcomeDismissed;

  // Reset dismissed flag when user logs out so welcome shows again
  useEffect(() => {
    if (!isAuthenticated) setWelcomeDismissed(false);
  }, [isAuthenticated]);

  const dismissWelcome = useCallback(() => {
    setWelcomeDismissed(true);
  }, []);

  // Poll unread count
  useEffect(() => {
    if (!isAuthenticated || !walletAddress) {
      setUnreadCount(0);
      return;
    }
    let active = true;
    const fetchCount = async () => {
      try {
        const res = await fetch(apiUrl(`/api/notifications?wallet=${walletAddress}&limit=1`));
        if (!res.ok) return;
        const data = await res.json();
        if (active) setUnreadCount(data.unreadCount ?? 0);
      } catch {}
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000); // refresh every 30s
    return () => { active = false; clearInterval(interval); };
  }, [isAuthenticated, walletAddress]);

  return (
    <View style={styles.layoutRoot}>
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: 'transparent' },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: 'rgba(148, 163, 184, 0.6)',
        tabBarStyle: {
          backgroundColor: TAB_BAR_BG,
          borderTopColor: 'rgba(255, 255, 255, 0.06)',
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : 8,
          paddingTop: 8,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
          letterSpacing: 0.3,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Predict',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="pulse-outline" focusedName="pulse" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="search-outline" focusedName="search" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="launched"
        options={{
          title: 'Launched',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="diamond-outline" focusedName="diamond" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name="notifications-outline"
              focusedName="notifications"
              color={color}
              focused={focused}
              badge={unreadCount}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) =>
            profileAvatarUrl ? (
              <View style={styles.iconContainer}>
                <View
                  style={[
                    styles.profileAvatarRing,
                    focused && { borderColor: colors.primary },
                  ]}
                >
                  <Image
                    source={{ uri: profileAvatarUrl }}
                    style={styles.profileAvatar}
                  />
                </View>
                {focused && <View style={styles.activeIndicator} />}
              </View>
            ) : (
              <TabBarIcon name="person-outline" focusedName="person" color={color} focused={focused} />
            ),
        }}
      />
    </Tabs>

    {/* Full-screen welcome — covers tabs + tab bar */}
    {showWelcome && (
      <WelcomeCard
        onSignIn={() => {
          router.push('/login');
        }}
        onDismiss={dismissWelcome}
      />
    )}
    </View>
  );
}

const styles = StyleSheet.create({
  layoutRoot: {
    flex: 1,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginTop: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  ringsContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringMiddle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: '#ef4444',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#000',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
  profileAvatarRing: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(148, 163, 184, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
});
