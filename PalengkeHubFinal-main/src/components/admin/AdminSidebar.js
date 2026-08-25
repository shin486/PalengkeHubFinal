// src/components/admin/AdminSidebar.js
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
 ScrollView, // ADD THIS
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const isWeb = Platform.OS === 'web';

export const AdminSidebar = ({ 
  activeSection, 
  setActiveSection, 
  collapsed, 
  setCollapsed,
  onLogout,
  userName,
  userEmail,
}) => {
  // Complete menu items (Ionicons names)
  const menuItems = [
    { id: 'overview', label: 'Overview', icon: 'stats-chart', color: '#DC2626' },
    { id: 'users', label: 'Users', icon: 'people', color: '#3B82F6' },
    { id: 'vendors', label: 'Vendors', icon: 'storefront', color: '#10B981' },
    { id: 'compliance', label: 'Compliance', icon: 'shield-checkmark', color: '#8B5CF6' },
    { id: 'applications', label: 'Applications', icon: 'clipboard', color: '#F59E0B' },
    { id: 'stalls', label: 'Stalls', icon: 'location', color: '#EC4899' },
    { id: 'orders', label: 'Orders', icon: 'cube', color: '#14B8A6' },
    { id: 'announcements', label: 'Announcements', icon: 'megaphone', color: '#8B5CF6' },
    { id: 'violations', label: 'Violations', icon: 'warning', color: '#EF4444' },
    { id: 'complaints', label: 'Complaints', icon: 'chatbubble', color: '#EC4899' },
    { id: 'reports', label: 'Reports', icon: 'document-text', color: '#6B7280' },
  ];

  return (
    <View style={[styles.sidebar, collapsed && styles.sidebarCollapsed]}>
      {/* Logo Section */}
      <LinearGradient
        colors={['#DC2626', '#EF4444']}
        style={styles.logoContainer}
      >
        <Image 
          source={require('../../assets/palengkehublogo.jpg')}
          style={styles.logo}
          resizeMode="contain"
        />
        {!collapsed && (
          <View style={styles.logoTextContainer}>
            <Text style={styles.logoText}>PalengkeHub</Text>
            <Text style={styles.logoSubtext}>Admin Panel</Text>
          </View>
        )}
      </LinearGradient>

      {/* Collapse Toggle (Web only) */}
      {isWeb && (
        <TouchableOpacity style={styles.collapseButton} onPress={() => setCollapsed(!collapsed)}>
          <Ionicons name={collapsed ? 'chevron-forward' : 'chevron-back'} size={14} color="white" />
        </TouchableOpacity>
      )}

      {/*  FIXED: Scrollable Navigation Menu */}
      <ScrollView 
        style={styles.navScrollView}
        contentContainerStyle={styles.navScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.navItem,
              activeSection === item.id && styles.navItemActive,
            ]}
            onPress={() => setActiveSection(item.id)}
          >
            <Ionicons name={item.icon} size={18} color={activeSection === item.id ? item.color : '#6B7280'} style={styles.navIcon} />
            {!collapsed && (
              <View style={styles.navTextContainer}>
                <Text style={[styles.navLabel, activeSection === item.id && styles.navLabelActive]}>
                  {item.label}
                </Text>
                {activeSection === item.id && (
                  <View style={[styles.navIndicator, { backgroundColor: item.color }]} />
                )}
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* User Info & Logout - Fixed at bottom */}
      <View style={styles.userSection}>
        <View style={styles.userAvatar}>
          <Ionicons name="person" size={16} color="#DC2626" />
        </View>
        {!collapsed && (
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>{userName || 'Admin'}</Text>
            <Text style={styles.userEmail} numberOfLines={1}>{userEmail || 'admin@palengkehub.com'}</Text>
          </View>
        )}
        <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
          <Ionicons name="log-out" size={16} color="#DC2626" />
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
    width: 260,
    backgroundColor: 'white',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    zIndex: 100,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    //  Make sidebar a flex container
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarCollapsed: {
    width: 70,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    //  Keep logo at top
    flexShrink: 0,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  logoTextContainer: {
    flexShrink: 1,
  },
  logoText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  logoSubtext: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.8)',
  },
  collapseButton: {
    position: 'absolute',
    right: -12,
    top: 70,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 101,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  collapseIcon: {
    fontSize: 12,
    color: 'white',
    fontWeight: 'bold',
  },
  //  NEW: ScrollView styles
  navScrollView: {
    flex: 1,
  },
  navScrollContent: {
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 4,
    borderRadius: 10,
    gap: 10,
  },
  navItemActive: {
    backgroundColor: '#FEF3F2',
  },
  navIcon: {
    fontSize: 18,
    width: 28,
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
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
    flexShrink: 1,
  },
  navLabelActive: {
    color: '#DC2626',
    fontWeight: '600',
  },
  navIndicator: {
    width: 3,
    height: 16,
    borderRadius: 1.5,
    marginLeft: 8,
  },
  //  User section - fixed at bottom
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
    backgroundColor: 'white',
 flexShrink: 0, // Prevents user section from shrinking
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    fontSize: 16,
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  userEmail: {
    fontSize: 10,
    color: '#6B7280',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#FEF3F2',
  },
  logoutIcon: {
    fontSize: 14,
  },
  logoutText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '500',
  },
});