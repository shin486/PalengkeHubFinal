// src/components/admin/AdminSidebar.js
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius, shadows, gradients } from '../../theme/adminTheme';

const isWeb = Platform.OS === 'web';

const MENU_ITEMS = [
  { id: 'overview', label: 'Overview', icon: '📊', color: colors.primary[500] },
  { id: 'users', label: 'Users', icon: '👥', color: colors.info[500] },
  { id: 'vendors', label: 'Vendors', icon: '🏪', color: colors.success[500] },
  { id: 'compliance', label: 'Compliance', icon: '✅', color: colors.warning[500] },
  { id: 'applications', label: 'Applications', icon: '📋', color: colors.primary[400] },
  { id: 'stalls', label: 'Stalls', icon: '📍', color: colors.info[500] },
  { id: 'orders', label: 'Orders', icon: '📦', color: colors.success[500] },
  { id: 'announcements', label: 'Announcements', icon: '📢', color: colors.warning[500] },
  { id: 'violations', label: 'Violations', icon: '⚠️', color: colors.danger[500] },
  { id: 'complaints', label: 'Complaints', icon: '💬', color: colors.info[500] },
  { id: 'reports', label: 'Reports', icon: '📄', color: colors.neutral[500] },
];

export const AdminSidebar = ({
  activeSection,
  setActiveSection,
  collapsed,
  setCollapsed,
  onLogout,
  userName,
  userEmail,
}) => {
  return (
    <View style={[styles.sidebar, collapsed && styles.sidebarCollapsed]}>
      {/* Logo Section */}
      <LinearGradient
        colors={gradients.primary}
        style={styles.logoContainer}
      >
        <View style={styles.logoIcon}>
          <Text style={styles.logoEmoji}>🛒</Text>
        </View>
        {!collapsed && (
          <View style={styles.logoTextContainer}>
            <Text style={styles.logoText}>PalengkeHub</Text>
            <Text style={styles.logoSubtext}>Admin Panel</Text>
          </View>
        )}
      </LinearGradient>

      {/* Collapse Toggle */}
      {isWeb && (
        <TouchableOpacity 
          style={styles.collapseButton} 
          onPress={() => setCollapsed(!collapsed)}
        >
          <Text style={styles.collapseIcon}>{collapsed ? '→' : '←'}</Text>
        </TouchableOpacity>
      )}

      {/* Navigation Menu */}
      <ScrollView
        style={styles.navScroll}
        contentContainerStyle={styles.navContent}
        showsVerticalScrollIndicator={false}
      >
        {MENU_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.navItem,
              activeSection === item.id && styles.navItemActive,
              collapsed && styles.navItemCollapsed,
            ]}
            onPress={() => setActiveSection(item.id)}
          >
            <Text style={styles.navIcon}>{item.icon}</Text>
            {!collapsed && (
              <View style={styles.navTextContainer}>
                <Text style={[
                  styles.navLabel,
                  activeSection === item.id && styles.navLabelActive
                ]}>
                  {item.label}
                </Text>
                {activeSection === item.id && (
                  <View style={[styles.navIndicator, { backgroundColor: item.color }]} />
                )}
              </View>
            )}
            {activeSection === item.id && collapsed && (
              <View style={[styles.activeDot, { backgroundColor: item.color }]} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* User Section */}
      <View style={styles.userSection}>
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>
            {userName?.[0] || 'A'}
          </Text>
        </View>
        {!collapsed && (
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {userName || 'Admin'}
            </Text>
            <Text style={styles.userEmail} numberOfLines={1}>
              {userEmail || 'admin@palengkehub.com'}
            </Text>
          </View>
        )}
        <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutIcon}>🚪</Text>
          {!collapsed && <Text style={styles.logoutText}>Logout</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sidebar: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 280,
    backgroundColor: colors.surface.default,
    borderRightWidth: 1,
    borderRightColor: colors.neutral[200],
    zIndex: 100,
    elevation: 5,
    ...shadows.md,
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarCollapsed: {
    width: 80,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    flexShrink: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  logoIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoEmoji: {
    fontSize: 20,
  },
  logoTextContainer: {
    flexShrink: 1,
  },
  logoText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.surface.default,
    letterSpacing: -0.5,
  },
  logoSubtext: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  collapseButton: {
    position: 'absolute',
    right: -12,
    top: 80,
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 101,
    ...shadows.sm,
  },
  collapseIcon: {
    fontSize: 12,
    color: colors.surface.default,
    fontWeight: 'bold',
  },
  navScroll: {
    flex: 1,
  },
  navContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: 2,
    borderRadius: radius.md,
    gap: spacing.md,
  },
  navItemActive: {
    backgroundColor: colors.primary[50],
    borderLeftWidth: 3,
    borderLeftColor: colors.primary[500],
  },
  navItemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
    marginHorizontal: 0,
  },
  navIcon: {
    fontSize: 20,
    width: 32,
    textAlign: 'center',
  },
  navTextContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 0,
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.neutral[500],
    flexShrink: 1,
  },
  navLabelActive: {
    color: colors.primary[500],
    fontWeight: '600',
  },
  navIndicator: {
    width: 3,
    height: 16,
    borderRadius: 2,
    marginLeft: spacing.sm,
  },
  activeDot: {
    position: 'absolute',
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    gap: spacing.sm,
    backgroundColor: colors.surface.default,
    flexShrink: 0,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary[500],
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[900],
  },
  userEmail: {
    fontSize: 11,
    color: colors.neutral[500],
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.danger[50],
  },
  logoutIcon: {
    fontSize: 16,
  },
  logoutText: {
    fontSize: 12,
    color: colors.danger[500],
    fontWeight: '500',
  },
});