/**
 * Tab Navigation Layout
 * 4 tabs: Feed, Explore, Notifications, Profile
 * Dark navy tab bar with cosmic theme
 */

import { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiUrl } from '@pnl/shared/utils';
import { useAuth } from '../../src/providers/AuthProvider';
import { colors } from '../../src/theme';

const TAB_BAR_BG = '#0b1228'; // Deep navy

type TabIconName = keyof typeof Ionicons.glyphMap;

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
  const [unreadCount, setUnreadCount] = useState(0);

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
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: 'transparent' },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: 'rgba(148, 163, 184, 0.6)',
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: TAB_BAR_BG,
          borderTopColor: 'rgba(99, 102, 241, 0.12)',
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : 8,
          paddingTop: 8,
          elevation: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
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
          title: 'Feed',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="flame-outline" focusedName="flame" color={color} focused={focused} />
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
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="person-outline" focusedName="person" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
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
    borderColor: TAB_BAR_BG,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
});
