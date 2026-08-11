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
import { MaterialIcons } from '@expo/vector-icons';

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
  // Complete menu items matching AdminDashboardScreen sections
  const menuItems = [
    { id: 'overview', label: 'Dashboard', icon: 'dashboard', color: '#DC2626' },
    { id: 'applications', label: 'Applications', icon: 'description', color: '#F59E0B' },
    { id: 'stalls', label: 'Stalls', icon: 'storefront', color: '#EC4899' },
    { id: 'products', label: 'Products', icon: 'inventory', color: '#3B82F6' },
    { id: 'orders', label: 'Orders', icon: 'shopping-cart', color: '#14B8A6' },
    { id: 'users', label: 'Users', icon: 'people', color: '#8B5CF6' },
    { id: 'vendors', label: 'Vendors', icon: 'store', color: '#10B981' },
    { id: 'announcements', label: 'Announcements', icon: 'campaign', color: '#F59E0B' },
    { id: 'violations', label: 'Violations', icon: 'warning', color: '#EF4444' },
    { id: 'complaints', label: 'Complaints', icon: 'chat-bubble-outline', color: '#EC4899' },
    { id: 'chats', label: 'Chats', icon: 'chat', color: '#06B6D4' },
    { id: 'price_monitoring', label: 'Price Monitoring', icon: 'attach-money', color: '#10B981' },
    { id: 'audit_trail', label: 'Audit Trail', icon: 'history', color: '#6B7280' },
    { id: 'reports', label: 'Reports', icon: 'analytics', color: '#6366F1' },
  ];

  return (
    <View style={[styles.sidebar, collapsed && styles.sidebarCollapsed]}>
      {/* Logo Section */}
      <LinearGradient
        colors={['#DC2626', '#8B0000']}
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
          <MaterialIcons 
            name={collapsed ? 'chevron-right' : 'chevron-left'} 
            size={16} 
            color="rgba(255,255,255,0.6)" 
          />
        </TouchableOpacity>
      )}

      {/* Scrollable Navigation Menu */}
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
            <View style={styles.navItemContent}>
              <MaterialIcons 
                name={item.icon} 
                size={20} 
                color={activeSection === item.id ? '#DC2626' : '#6B7280'} 
              />
              {!collapsed && (
                <Text style={[
                  styles.navLabel,
                  activeSection === item.id && styles.navLabelActive,
                ]} numberOfLines={1}>
                  {item.label}
                </Text>
              )}
            </View>
            {activeSection === item.id && (
              <View style={[styles.navIndicator, { backgroundColor: item.color }]} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* User Info & Logout - Fixed at bottom */}
      <View style={styles.userSection}>
        <View style={styles.userAvatar}>
          <MaterialIcons name="person" size={20} color="#DC2626" />
        </View>
        {!collapsed && (
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>{userName || 'Admin'}</Text>
            <Text style={styles.userEmail} numberOfLines={1}>{userEmail || 'admin@palengkehub.com'}</Text>
          </View>
        )}
        <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
          <MaterialIcons name="logout" size={18} color="#DC2626" />
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
    borderBottomColor: '#E5E7EB',
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
  // ScrollView styles
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
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 4,
    borderRadius: 10,
    gap: 10,
  },
  navItemActive: {
    backgroundColor: '#FEF3F2',
  },
  navItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
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
  },
  // User section - fixed at bottom
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
    backgroundColor: 'white',
    flexShrink: 0,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3F2',
    justifyContent: 'center',
    alignItems: 'center',
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
  logoutText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '500',
  },
});