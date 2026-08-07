// src/screens/admin/AdminDashboardScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Platform,
  FlatList,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Image,
  Dimensions,
  Animated,
  Easing,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { chatService } from '../../services/chatService';
import { supabase } from '../../../lib/supabase';
import { MaterialIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const { width, height } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isTablet = width >= 768 && width < 1024;

// Modern Color Palette
const MODERN_COLORS = {
  primary: '#DC2626',
  primaryLight: '#EF4444',
  primaryDark: '#B91C1C',
  secondary: '#F59E0B',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
  background: '#F8F9FA',
  surface: '#FFFFFF',
  text: {
    primary: '#111827',
    secondary: '#374151',
    tertiary: '#6B7280',
    muted: '#9CA3AF',
  },
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  shadow: 'rgba(0, 0, 0, 0.08)',
  shadowDark: 'rgba(0, 0, 0, 0.12)',
  gradientStart: '#DC2626',
  gradientEnd: '#EF4444',
};

// ============================================================
// PAGE DROPDOWN FILTER COMPONENT
// ============================================================
const PageFilterDropdown = ({ 
  label, 
  options, 
  selectedValue, 
  onSelect, 
  iconName,
  darkMode 
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleSelect = (value) => {
    onSelect(value);
    setIsOpen(false);
  };

  const selectedOption = options.find(opt => opt.value === selectedValue);
  const displayLabel = selectedOption ? selectedOption.label : 'All';

  return (
    <View style={[styles.pageFilterContainer, darkMode && styles.pageFilterContainerDark]}>
      <TouchableOpacity
        style={[styles.pageFilterHeader, darkMode && styles.pageFilterHeaderDark]}
        onPress={toggleDropdown}
        activeOpacity={0.7}
      >
        <View style={styles.pageFilterLeft}>
          {iconName && (
            <MaterialIcons 
              name={iconName} 
              size={18} 
              color="#C62828" 
              style={styles.pageFilterIcon}
            />
          )}
          <Text style={[styles.pageFilterLabel, darkMode && styles.pageFilterLabelDark]}>
            {label}:
          </Text>
          <Text style={[styles.pageFilterSelected, darkMode && styles.pageFilterSelectedDark]} numberOfLines={1}>
            {displayLabel}
          </Text>
        </View>
        <MaterialIcons 
          name={isOpen ? 'expand-less' : 'expand-more'} 
          size={22} 
          color="#666666" 
        />
      </TouchableOpacity>
      
      {isOpen && (
        <View style={[styles.pageFilterOptions, darkMode && styles.pageFilterOptionsDark]}>
          <ScrollView 
            style={styles.pageFilterScroll}
            showsVerticalScrollIndicator={true}
          >
            {options.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.pageFilterOption,
                  selectedValue === option.value && styles.pageFilterOptionActive,
                  darkMode && styles.pageFilterOptionDark,
                ]}
                onPress={() => handleSelect(option.value)}
              >
                <Text 
                  style={[
                    styles.pageFilterOptionText,
                    selectedValue === option.value && styles.pageFilterOptionTextActive,
                    darkMode && styles.pageFilterOptionTextDark,
                  ]}
                  numberOfLines={1}
                >
                  {option.label}
                </Text>
                {selectedValue === option.value && (
                  <MaterialIcons name="check" size={16} color="#C62828" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

// ============================================================
// DASHBOARD BACKGROUND - PalengkeHub Branded
// ============================================================
const DashboardBackground = ({ children, darkMode }) => {
  return (
    <View style={[styles.bgContainer, darkMode && styles.bgContainerDark]}>
      <Image
        source={require('../../../src/assets/Lipapublicmarket.jpg')}
        style={styles.fullScreenBackground}
        resizeMode="cover"
      />
      <View style={[styles.overlay, darkMode && styles.overlayDark]} />
      {children}
    </View>
  );
};

// ============================================================
// STATS CARD COMPONENT - Red & White Theme
// ============================================================
const StatsCard = ({ 
  title, 
  value, 
  iconName, 
  darkMode,
  color = '#C62828'
}) => {
  // Animated value for card entrance
  const animatedValue = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.spring(animatedValue, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, []);

  const scale = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1],
  });

  return (
    <Animated.View style={[styles.statCard, darkMode && styles.statCardDark, { transform: [{ scale }] }]}>
      <View style={styles.statCardHeader}>
        <View style={[styles.statCardIcon, { backgroundColor: color + '20' }]}>
          <MaterialIcons name={iconName} size={24} color={color} />
        </View>
      </View>
      <Text style={[styles.statCardValue, darkMode && styles.statCardValueDark]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statCardTitle, darkMode && styles.statCardTitleDark]} numberOfLines={1}>
        {title}
      </Text>
    </Animated.View>
  );
};

// ============================================================
// DASHBOARD OVERVIEW - Red & White Theme
// ============================================================
const DashboardOverview = ({ 
  stats, 
  setActiveSection, 
  recentActivity, 
  darkMode,
  deleteActivity 
}) => {
  const [hoveredPriority, setHoveredPriority] = useState(null);
  const [hoveredActivity, setHoveredActivity] = useState(null);

  const priorityData = [
    { 
      id: 'applications', 
      icon: 'description', 
      count: stats.pendingApplications || 0, 
      label: 'Pending Vendor Applications', 
      section: 'applications',
      color: '#C62828',
      bgColor: 'rgba(198,40,40,0.08)',
    },
    { 
      id: 'orders', 
      icon: 'shopping-cart', 
      count: stats.pendingOrders || 0, 
      label: 'Pending Orders', 
      section: 'orders',
      color: '#E65100',
      bgColor: 'rgba(230,81,0,0.08)',
    },
    { 
      id: 'complaints', 
      icon: 'chat-bubble-outline', 
      count: stats.pendingComplaints || 0, 
      label: 'Pending Complaints', 
      section: 'complaints',
      color: '#D32F2F',
      bgColor: 'rgba(211,47,47,0.08)',
    },
  ];

  const statsData = [
    { 
      label: 'Total Vendors', 
      value: stats.totalVendors || 0, 
      iconName: 'store',
      color: '#C62828'
    },
    { 
      label: 'Total Stalls', 
      value: stats.totalStalls || 0, 
      iconName: 'storefront',
      color: '#E65100'
    },
    { 
      label: 'Total Products', 
      value: stats.totalProducts || 0, 
      iconName: 'inventory',
      color: '#BF360C'
    },
    { 
      label: 'Total Orders', 
      value: stats.totalOrders || 0, 
      iconName: 'shopping-cart',
      color: '#C62828'
    },
    { 
      label: 'Registered Users', 
      value: stats.totalUsers || 0, 
      iconName: 'people',
      color: '#8D6E63'
    },
    { 
      label: 'Pending Applications', 
      value: stats.pendingApplications || 0, 
      iconName: 'description',
      color: '#D32F2F'
    },
    {
      label: 'Low Stock Alerts',
      value: stats.lowStockAlerts || 0,
      iconName: 'inventory_2',
      color: '#F57C00'
    },
    {
      label: 'Active Listings',
      value: stats.activeListings || 0,
      iconName: 'storefront',
      color: '#2E7D32'
    },
    {
      label: 'Inactive Listings',
      value: stats.inactiveListings || 0,
      iconName: 'storefront',
      color: '#9E9E9E'
    },
    {
      label: 'Monthly Growth',
      value: stats.monthlyGrowth || '0%',
      iconName: 'trending-up',
      color: '#1565C0'
    },
  ];

  return (
    <ScrollView 
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.overviewContainer}
    >
      {/* Header */}
      <View style={[styles.welcomeHeader, darkMode && styles.welcomeHeaderDark]}>
        <View>
          <Text style={[styles.welcomeTitle, darkMode && styles.welcomeTitleDark]}>
            PalengkeHub Admin Dashboard
          </Text>
          <Text style={[styles.welcomeSubtitle, darkMode && styles.welcomeSubtitleDark]}>
            Lipa City Public Market Management Information System
          </Text>
        </View>
        <View style={[styles.welcomeBadge, darkMode && styles.welcomeBadgeDark]}>
          <MaterialIcons name="calendar-today" size={14} color="#C62828" />
          <Text style={[styles.welcomeBadgeText, darkMode && styles.welcomeBadgeTextDark]}>
            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>
      </View>

      {/* Stats Grid with staggered animation */}
      <View style={styles.statsGrid}>
        {statsData.map((stat, index) => (
          <StatsCard
            key={index}
            title={stat.label}
            value={stat.value}
            iconName={stat.icon}
            darkMode={darkMode}
            color={stat.color}
          />
        ))}
      </View>

      {/* Pending Actions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <MaterialIcons name="notifications-active" size={24} color="#C62828" />
            <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>
              Pending Actions
            </Text>
          </View>
          <Text style={[styles.sectionSubtitle, darkMode && styles.sectionSubtitleDark]}>
            Items requiring your attention
          </Text>
        </View>
        
        {priorityData.map((item, index) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.priorityRow,
              darkMode && styles.priorityRowDark,
              hoveredPriority === index && styles.priorityRowHover,
              { borderLeftColor: item.color },
            ]}
            onPress={() => setActiveSection(item.section)}
            onMouseEnter={() => setHoveredPriority(index)}
            onMouseLeave={() => setHoveredPriority(null)}
            activeOpacity={0.7}
          >
            <View style={styles.priorityContent}>
              <View style={styles.priorityLeft}>
                <View style={[styles.priorityIconContainer, { backgroundColor: item.bgColor }]}>
                  <MaterialIcons name={item.icon} size={22} color={item.color} />
                </View>
                <View style={styles.priorityTextContainer}>
                  <Text style={[styles.priorityLabel, darkMode && styles.priorityLabelDark]}>
                    {item.label}
                  </Text>
                  <View style={styles.priorityCountContainer}>
                    <View style={[styles.priorityCountBadge, { backgroundColor: item.color + '20' }]}>
                      <Text style={[styles.priorityCount, { color: item.color }]}>
                        {item.count}
                      </Text>
                    </View>
                    <Text style={[styles.priorityCountLabel, darkMode && styles.priorityCountLabelDark]}>
                      {item.count === 1 ? 'item' : 'items'} pending
                    </Text>
                  </View>
                </View>
              </View>
              <View style={[styles.priorityAction, { backgroundColor: item.color }]}>
                <MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" />
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <MaterialIcons name="history" size={24} color="#C62828" />
            <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>
              Recent Activity
            </Text>
          </View>
          {recentActivity.length > 0 && (
            <TouchableOpacity onPress={() => setActiveSection('orders')} style={styles.viewAllButton}>
              <Text style={styles.viewAllText}>View All</Text>
              <MaterialIcons name="arrow-forward" size={16} color="#C62828" />
            </TouchableOpacity>
          )}
        </View>
        
        <View style={[styles.activityContainer, darkMode && styles.activityContainerDark]}>
          {recentActivity.length > 0 ? (
            recentActivity.map((activity, index) => {
              const isHovered = hoveredActivity === index;
              
              return (
                <View
                  key={index}
                  style={[
                    styles.activityRow,
                    darkMode && styles.activityRowDark,
                    isHovered && styles.activityRowHover,
                  ]}
                  onMouseEnter={() => setHoveredActivity(index)}
                  onMouseLeave={() => setHoveredActivity(null)}
                >
                  <View style={styles.activityIconContainer}>
                    <View style={[styles.activityDot, isHovered && styles.activityDotActive]}>
                      <View style={[styles.activityDotInner, isHovered && styles.activityDotInnerActive]} />
                    </View>
                  </View>
                  <View style={styles.activityContent}>
                    <View style={styles.activityHeader}>
                      <Text style={[styles.activityUser, darkMode && styles.activityUserDark]} numberOfLines={1}>
                        {activity.user}
                      </Text>
                      <View style={[styles.activityTimeContainer, darkMode && styles.activityTimeContainerDark]}>
                        <MaterialIcons name="access-time" size={12} color="#9CA3AF" />
                        <Text style={[styles.activityTime, darkMode && styles.activityTimeDark]}>
                          {activity.time}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.activityAction, darkMode && styles.activityActionDark]} numberOfLines={2}>
                      {activity.action}
                    </Text>
                    {activity.status && (
                      <View style={[
                        styles.activityStatus,
                        activity.status === 'pending' ? styles.statusPending : styles.statusCompleted
                      ]}>
                        <MaterialIcons 
                          name={activity.status === 'pending' ? 'schedule' : 'check-circle'} 
                          size={12} 
                          color="#FFFFFF" 
                        />
                        <Text style={styles.activityStatusText}>{activity.status}</Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.activityDeleteButton}
                    onPress={() => {
                      Alert.alert(
                        'Delete Activity',
                        'Are you sure you want to remove this activity?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { 
                            text: 'Delete', 
                            style: 'destructive',
                            onPress: () => {
                              deleteActivity(activity.id);
                            }
                          }
                        ]
                      );
                    }}
                  >
                    <MaterialIcons name="close" size={16} color="#D32F2F" />
                  </TouchableOpacity>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <MaterialIcons name="inbox" size={48} color="#D1D5DB" />
              <Text style={[styles.emptyStateText, darkMode && styles.emptyStateTextDark]}>
                No recent activity
              </Text>
              <Text style={[styles.emptyStateSubtext, darkMode && styles.emptyStateSubtextDark]}>
                Activity will appear here as actions are taken
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Footer */}
      <View style={[styles.overviewFooter, darkMode && styles.overviewFooterDark]}>
        <View style={styles.footerContent}>
          <MaterialIcons name="store" size={16} color="#C62828" />
          <Text style={[styles.overviewFooterText, darkMode && styles.overviewFooterTextDark]}>
            © 2026 PalengkeHub • Lipa City Public Market
          </Text>
        </View>
        <Text style={[styles.overviewFooterVersion, darkMode && styles.overviewFooterVersionDark]}>
          Version 2.0.0
        </Text>
      </View>
    </ScrollView>
  );
};

// ============================================================
// SIDEBAR - Red & White Theme with Logo
// ============================================================
const Sidebar = ({ 
  activeSection, 
  setActiveSection, 
  collapsed, 
  setCollapsed, 
  profile, 
  user, 
  handleLogout, 
  darkMode,
  toggleDarkMode 
}) => {
  const [hoveredItem, setHoveredItem] = useState(null);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogoutPress = () => {
    setLogoutModalVisible(true);
  };

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    await handleLogout();
    setIsLoggingOut(false);
    setLogoutModalVisible(false);
  };

  const menuItems = [
    { id: 'overview', label: 'Dashboard', icon: 'dashboard' },
    { id: 'applications', label: 'Applications', icon: 'description' },
    { id: 'stalls', label: 'Stalls', icon: 'storefront' },
    { id: 'products', label: 'Products', icon: 'inventory' },
    { id: 'orders', label: 'Orders', icon: 'shopping-cart' },
    { id: 'users', label: 'Users', icon: 'people' },
    { id: 'vendors', label: 'Vendors', icon: 'store' },
    { id: 'announcements', label: 'Announcements', icon: 'campaign' },
    { id: 'violations', label: 'Violations', icon: 'warning' },
    { id: 'complaints', label: 'Complaints', icon: 'chat-bubble-outline' },
    { id: 'chats', label: 'Chats', icon: 'chat' },
    { id: 'price_monitoring', label: 'Price Monitoring', icon: 'attach-money' },
    { id: 'audit_trail', label: 'Audit Trail', icon: 'history' },
    { id: 'reports', label: 'Reports', icon: 'analytics' },
  ];

  return (
    <View style={[styles.sidebar, collapsed && styles.sidebarCollapsed, darkMode && styles.sidebarDark]}>
      <LinearGradient
        colors={darkMode ? ['#1a1a1a', '#0d0d0d'] : ['#C62828', '#8B0000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.sidebarGradient}
      >
        {/* Logo Section */}
        <View style={styles.sidebarHeader}>
          <View style={styles.logoContainer}>
            {!collapsed ? (
              <View style={styles.logoWrapper}>
                <View style={styles.logoIcon}>
                  <Text style={styles.logoIconText}>PH</Text>
                </View>
                <View style={styles.logoTextWrapper}>
                  <Text style={[styles.logoText, darkMode && styles.logoTextDark]}>PalengkeHub</Text>
                  <Text style={[styles.logoSubText, darkMode && styles.logoSubTextDark]}>Lipa City Public Market</Text>
                </View>
              </View>
            ) : (
              <View style={styles.logoIconSmall}>
                <Text style={styles.logoIconTextSmall}>PH</Text>
              </View>
            )}
          </View>
          {isWeb && (
            <TouchableOpacity
              style={styles.collapseButton}
              onPress={() => setCollapsed(!collapsed)}
            >
              <MaterialIcons 
                name={collapsed ? 'chevron-right' : 'chevron-left'} 
                size={16} 
                color="rgba(255,255,255,0.6)" 
              />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          style={styles.navScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.navContent}
        >
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.navItem,
                activeSection === item.id && styles.navItemActive,
                hoveredItem === item.id && styles.navItemHover,
                darkMode && styles.navItemDark,
                activeSection === item.id && darkMode && styles.navItemActiveDark,
              ]}
              onPress={() => setActiveSection(item.id)}
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <View style={styles.navItemContent}>
                <MaterialIcons 
                  name={item.icon} 
                  size={20} 
                  color={activeSection === item.id ? '#FFFFFF' : 'rgba(255,255,255,0.6)'} 
                />
                {!collapsed && (
                  <Text style={[
                    styles.navLabel,
                    activeSection === item.id && styles.navLabelActive,
                    darkMode && styles.navLabelDark,
                    activeSection === item.id && darkMode && styles.navLabelActiveDark,
                  ]} numberOfLines={1}>
                    {item.label}
                  </Text>
                )}
              </View>
              {activeSection === item.id && (
                <View style={[styles.navIndicator, darkMode && styles.navIndicatorDark]} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={[styles.userSection, darkMode && styles.userSectionDark]}>
          <View style={[styles.userCard, darkMode && styles.userCardDark]}>
            <View style={[styles.userAvatar, darkMode && styles.userAvatarDark]}>
              <Text style={[styles.userAvatarText, darkMode && styles.userAvatarTextDark]}>
                {profile?.full_name?.charAt(0) || 'A'}
              </Text>
            </View>
            {!collapsed && (
              <View style={styles.userInfo}>
                <Text style={[styles.userName, darkMode && styles.userNameDark]} numberOfLines={1}>
                  {profile?.full_name || 'Admin'}
                </Text>
                <Text style={[styles.userEmail, darkMode && styles.userEmailDark]} numberOfLines={1}>
                  {user?.email}
                </Text>
              </View>
            )}
            <TouchableOpacity 
              style={[styles.logoutButton, darkMode && styles.logoutButtonDark]} 
              onPress={handleLogoutPress}
            >
              <MaterialIcons 
                name="logout" 
                size={20} 
                color={darkMode ? '#EF5350' : 'rgba(255,255,255,0.8)'} 
              />
            </TouchableOpacity>
          </View>
          
          {!collapsed && (
            <View style={[styles.darkModeToggle, darkMode && styles.darkModeToggleDark]}>
              <Text style={[styles.darkModeLabel, darkMode && styles.darkModeLabelDark]}>
                {darkMode ? 'Dark Mode' : 'Light Mode'}
              </Text>
              <Switch
                value={darkMode}
                onValueChange={toggleDarkMode}
                trackColor={{ false: 'rgba(255,255,255,0.3)', true: 'rgba(198,40,40,0.6)' }}
                thumbColor={darkMode ? '#FFFFFF' : '#FFFFFF'}
              />
            </View>
          )}
        </View>
      </LinearGradient>

      {/* Logout Modal */}
      <Modal
        visible={logoutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View style={styles.logoutModalOverlay}>
          <View style={[styles.logoutModalContainer, darkMode && styles.logoutModalContainerDark]}>
            <View style={styles.logoutModalHeader}>
              <View style={styles.logoutModalIcon}>
                <MaterialIcons name="logout" size={28} color="#C62828" />
              </View>
              <Text style={[styles.logoutModalTitle, darkMode && styles.logoutModalTitleDark]}>
                Confirm Logout
              </Text>
            </View>
            <Text style={[styles.logoutModalMessage, darkMode && styles.logoutModalMessageDark]}>
              Are you sure you want to log out?
            </Text>
            <View style={styles.logoutModalButtons}>
              <TouchableOpacity
                style={[styles.logoutModalCancel, darkMode && styles.logoutModalCancelDark]}
                onPress={() => setLogoutModalVisible(false)}
                disabled={isLoggingOut}
              >
                <Text style={[styles.logoutModalCancelText, darkMode && styles.logoutModalCancelTextDark]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.logoutModalConfirm, isLoggingOut && styles.logoutModalConfirmDisabled]}
                onPress={handleConfirmLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.logoutModalConfirmText}>Logout</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ============================================================
// MAIN COMPONENT - AdminDashboardScreen
// ============================================================
export default function AdminDashboardScreen({ navigation }) {
  const { user, profile } = useAuth();
  const [activeSection, setActiveSection] = useState('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Delete Modal States
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleteType, setDeleteType] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Report States
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportType, setReportType] = useState('stalls');
  const [reportData, setReportData] = useState([]);
  const [reportFormat, setReportFormat] = useState('csv');
  const [reportDateRange, setReportDateRange] = useState('all');
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportError, setReportError] = useState(null);
  const [dateError, setDateError] = useState('');

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalVendors: 0,
    totalConsumers: 0,
    pendingApplications: 0,
    totalStalls: 0,
    totalProducts: 0,
    totalOrders: 0,
    totalSales: 0,
    pendingOrders: 0,
    pendingComplaints: 0,
    pendingStalls: 0,
    activeListings: 0,
    inactiveListings: 0,
    lowStockAlerts: 0,
    monthlyGrowth: '0%',
  });
  const [users, setUsers] = useState([]);
  const [stalls, setStalls] = useState([]);
  const [applications, setApplications] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [violations, setViolations] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [orders, setOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);

  // Chat state
  const [conversations, setConversations] = useState([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  
  const [announcementModal, setAnnouncementModal] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [announcementAudience, setAnnouncementAudience] = useState('both');
  const [announcementDuration, setAnnouncementDuration] = useState('24');
  const [violationModal, setViolationModal] = useState(false);
  const [violationReason, setViolationReason] = useState('');
  const [complaintModal, setComplaintModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [resolutionMessage, setResolutionMessage] = useState('');
  const [stallModalVisible, setStallModalVisible] = useState(false);
  const [selectedStall, setSelectedStall] = useState(null);
  const [stallAction, setStallAction] = useState('');
  const [selectedVendor, setSelectedVendor] = useState(null);

  // User/Vendor Edit Modal States
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editFormData, setEditFormData] = useState({
    full_name: '',
    email: '',
    role: '',
    phone: '',
  });

  // User/Vendor/Stall Detail Modal States
  const [userDetailModalVisible, setUserDetailModalVisible] = useState(false);
  const [vendorDetailModalVisible, setVendorDetailModalVisible] = useState(false);
  const [stallDetailModalVisible, setStallDetailModalVisible] = useState(false);
  const [selectedUserForDetail, setSelectedUserForDetail] = useState(null);
  const [selectedVendorForDetail, setSelectedVendorForDetail] = useState(null);
  const [selectedStallForDetail, setSelectedStallForDetail] = useState(null);
  const [userDetailData, setUserDetailData] = useState({
    orders: [],
    totalOrders: 0,
    totalSpent: 0,
  });
  const [vendorDetailData, setVendorDetailData] = useState({
    stall: null,
    products: [],
    totalProducts: 0,
    orders: [],
    totalOrders: 0,
    totalRevenue: 0,
  });
  const [stallDetailData, setStallDetailData] = useState({
    vendor: null,
    products: [],
    totalProducts: 0,
    orders: [],
    totalOrders: 0,
    completedOrders: 0,
    totalRevenue: 0,
    recentTransactions: [],
  });
  const [detailLoading, setDetailLoading] = useState(false);

  // Filter States
  const [selectedStallCategory, setSelectedStallCategory] = useState('all');
  const [selectedProductCategory, setSelectedProductCategory] = useState('all');
  const [selectedProductStatus, setSelectedProductStatus] = useState('all');
  const [selectedOrderStatus, setSelectedOrderStatus] = useState('all');
  const [selectedVendorStatus, setSelectedVendorStatus] = useState('all');

  // Page filter options
  const stallFilterOptions = [
    { value: 'all', label: 'All Stalls' },
    ...Array.from(new Set(stalls.map(s => s.section).filter(Boolean))).map(s => ({ value: s, label: s })),
  ];

  const productFilterOptions = [
    { value: 'all', label: 'All Products' },
    { value: 'Fruits', label: 'Fruits' },
    { value: 'Vegetables', label: 'Vegetables' },
    { value: 'Meat', label: 'Meat' },
    { value: 'Seafood', label: 'Seafood' },
    { value: 'Rice', label: 'Rice' },
    { value: 'Bakery', label: 'Bakery' },
    { value: 'Others', label: 'Others' },
  ];

  const orderFilterOptions = [
    { value: 'all', label: 'All Orders' },
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'preparing', label: 'Preparing' },
    { value: 'ready', label: 'Ready' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  const vendorFilterOptions = [
    { value: 'all', label: 'All Vendors' },
    { value: 'active', label: 'Active Stall' },
    { value: 'inactive', label: 'Inactive Stall' },
    { value: 'nostall', label: 'No Stall' },
  ];

  const reportFilterOptions = [
    { value: 'stalls', label: 'Stall Report' },
    { value: 'products', label: 'Product Report' },
    { value: 'orders', label: 'Order Report' },
    { value: 'vendors', label: 'Vendor Report' },
    { value: 'users', label: 'User Report' },
    { value: 'applications', label: 'Application Report' },
    { value: 'recent_activity', label: 'Recent Activity Report' },
  ];

  // ============================================================
  // SEARCH FUNCTIONS
  // ============================================================
  const calculateSimilarity = (str1, str2) => {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1;
    if (s1.length === 0 || s2.length === 0) return 0;
    
    if (s1.includes(s2) || s2.includes(s1)) {
      const shorter = Math.min(s1.length, s2.length);
      const longer = Math.max(s1.length, s2.length);
      return 0.8 + (shorter / longer) * 0.2;
    }
    
    const track = Array(s2.length + 1).fill(null).map(() => 
      Array(s1.length + 1).fill(null)
    );
    
    for (let i = 0; i <= s1.length; i++) track[0][i] = i;
    for (let j = 0; j <= s2.length; j++) track[j][0] = j;
    
    for (let j = 1; j <= s2.length; j++) {
      for (let i = 1; i <= s1.length; i++) {
        const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j][i - 1] + 1,
          track[j - 1][i] + 1,
          track[j - 1][i - 1] + indicator
        );
      }
    }
    
    const distance = track[s2.length][s1.length];
    const maxLength = Math.max(s1.length, s2.length);
    return Math.round((1 - distance / maxLength) * 100) / 100;
  };

  const getSearchScore = (text, query) => {
    if (!text || !query) return 0;
    
    const lowerText = text.toLowerCase().trim();
    const lowerQuery = query.toLowerCase().trim();
    
    if (lowerText === lowerQuery) return 1.0;
    if (lowerText.startsWith(lowerQuery)) return 0.95;
    
    const words = lowerText.split(' ');
    for (const word of words) {
      if (word === lowerQuery) return 0.9;
    }
    
    if (lowerText.endsWith(lowerQuery)) return 0.85;
    for (const word of words) {
      if (word.startsWith(lowerQuery)) return 0.7;
    }
    
    if (lowerText.includes(lowerQuery)) return 0.3;
    
    const similarity = calculateSimilarity(lowerText, lowerQuery);
    if (similarity >= 0.9) return 0.6;
    if (similarity >= 0.6) return 0.4;
    
    return 0;
  };

  const performSearch = (query) => {
    setSearchQuery(query);
    
    if (!query || !query.trim()) {
      setSearchResults([]);
      return;
    }

    const lowerQuery = query.toLowerCase().trim();
    const uniqueResults = new Map();

    vendors.forEach(vendor => {
      const name = vendor.full_name || '';
      const email = vendor.email || '';
      const maxScore = Math.max(getSearchScore(name, lowerQuery), getSearchScore(email, lowerQuery));
      
      if (maxScore >= 0.7) {
        const key = vendor.id;
        if (!uniqueResults.has(key)) {
          uniqueResults.set(key, {
            type: 'Vendor',
            data: vendor,
            id: vendor.id,
            icon: 'store',
            score: maxScore,
            displayName: vendor.full_name || 'N/A',
            displaySub: vendor.email || ''
          });
        }
      }
    });

    users.forEach(user => {
      const name = user.full_name || '';
      const email = user.email || '';
      const maxScore = Math.max(getSearchScore(name, lowerQuery), getSearchScore(email, lowerQuery));
      
      if (maxScore >= 0.7) {
        const key = user.id;
        if (!uniqueResults.has(key)) {
          uniqueResults.set(key, {
            type: 'User',
            data: user,
            id: user.id,
            icon: 'person',
            score: maxScore,
            displayName: user.full_name || 'N/A',
            displaySub: user.email || ''
          });
        }
      }
    });

    allProducts.forEach(product => {
      const name = product.name || '';
      const category = product.category || '';
      const maxScore = Math.max(getSearchScore(name, lowerQuery), getSearchScore(category, lowerQuery));
      
      if (maxScore >= 0.7) {
        const key = `product_${product.id}`;
        if (!uniqueResults.has(key)) {
          uniqueResults.set(key, {
            type: 'Product',
            data: product,
            id: product.id,
            icon: 'inventory',
            score: maxScore,
            displayName: product.name || 'N/A',
            displaySub: `₱${product.price || 0} • ${product.category || 'Uncategorized'}`
          });
        }
      }
    });

    orders.forEach(order => {
      const orderNumber = order.order_number || '';
      const customerName = order.profiles?.full_name || '';
      const maxScore = Math.max(getSearchScore(orderNumber, lowerQuery), getSearchScore(customerName, lowerQuery));
      
      if (maxScore >= 0.7) {
        const key = `order_${order.id}`;
        if (!uniqueResults.has(key)) {
          uniqueResults.set(key, {
            type: 'Order',
            data: order,
            id: order.id,
            icon: 'shopping-cart',
            score: maxScore,
            displayName: `Order #${order.order_number?.slice(-8) || order.id.toString().slice(-8)}`,
            displaySub: `₱${order.total_amount || 0} • ${order.status || 'N/A'}`
          });
        }
      }
    });

    stalls.forEach(stall => {
      const name = stall.stall_name || '';
      const number = stall.stall_number?.toString() || '';
      const section = stall.section || '';
      const maxScore = Math.max(getSearchScore(name, lowerQuery), getSearchScore(number, lowerQuery), getSearchScore(section, lowerQuery));
      
      if (maxScore >= 0.7) {
        const key = `stall_${stall.id}`;
        if (!uniqueResults.has(key)) {
          uniqueResults.set(key, {
            type: 'Stall',
            data: stall,
            id: stall.id,
            icon: 'storefront',
            score: maxScore,
            displayName: stall.stall_name || 'Unnamed',
            displaySub: `#${stall.stall_number || 'N/A'} • ${stall.section || 'No section'}`
          });
        }
      }
    });

    applications.forEach(app => {
      const businessName = app.business_name || '';
      const applicantName = app.profiles?.full_name || '';
      const maxScore = Math.max(getSearchScore(businessName, lowerQuery), getSearchScore(applicantName, lowerQuery));
      
      if (maxScore >= 0.7) {
        const key = `app_${app.id}`;
        if (!uniqueResults.has(key)) {
          uniqueResults.set(key, {
            type: 'Application',
            data: app,
            id: app.id,
            icon: 'description',
            score: maxScore,
            displayName: app.business_name || 'N/A',
            displaySub: `${app.status || 'pending'} • ${app.profiles?.full_name || 'N/A'}`
          });
        }
      }
    });

    const allResults = Array.from(uniqueResults.values());
    allResults.sort((a, b) => b.score - a.score);
    
    setSearchResults(allResults.slice(0, 20));
  };

  useEffect(() => {
    if (!searchQuery || !searchQuery.trim()) {
      setSearchResults([]);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (searchQuery && searchQuery.trim() && vendors.length > 0) {
      performSearch(searchQuery);
    }
  }, [vendors, users, allProducts, orders, stalls, applications]);

  // ============================================================
  // TOGGLE DARK MODE
  // ============================================================
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  // ============================================================
  // CHAT WITH VENDOR
  // ============================================================
  const handleChatWithVendor = async (vendor) => {
    if (!user?.id) {
      console.warn('Admin user missing when starting chat with vendor', { user });
      Alert.alert('Chat unavailable', 'Your admin session is not ready yet. Please try again.');
      return;
    }

    if (!vendor?.stall?.id) {
      Alert.alert('Chat unavailable', 'Vendor has no stall assigned.');
      return;
    }

    try {
      console.log('Admin opening chat with vendor', {
        adminId: user.id,
        vendorId: vendor.id,
        stallId: vendor.stall.id,
      });

      const conversation = await chatService.getOrCreateConversation(user.id, vendor.stall.id);
      console.log('Admin chat conversation loaded', { conversationId: conversation?.id });

      navigation.navigate('ChatDetail', {
        conversationId: conversation.id,
        userRole: 'admin',
        vendor: {
          id: vendor.id,
          name: vendor.full_name || 'Vendor',
        },
        stall: {
          stall_name: vendor.stall.stall_name,
          stall_number: vendor.stall.stall_number,
          section: vendor.stall.section,
        },
      });
    } catch (error) {
      console.error('Error opening chat with vendor:', error);
      Alert.alert('Unable to open chat', 'Please try again later.');
    }
  };

  // ============================================================
  // LOGOUT FUNCTION
  // ============================================================
  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      if (isWeb) {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/login';
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to logout. Please try again.');
    }
  };

  // ============================================================
  // DELETE HANDLERS
  // ============================================================

  const showDeleteConfirmation = (item, type) => {
    setDeleteItem(item);
    setDeleteType(type);
    setDeleteModalVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteItem) {
      setIsDeleting(false);
      return;
    }
    
    setIsDeleting(true);
    
    try {
      let deleteSuccess = false;
      
      switch (deleteType) {
        case 'user':
          deleteSuccess = await handleDeleteUser(deleteItem);
          break;
        case 'vendor':
          deleteSuccess = await handleDeleteVendor(deleteItem);
          break;
        case 'announcement':
          deleteSuccess = await deleteAnnouncement(deleteItem.id);
          break;
        case 'violation':
          deleteSuccess = await handleDeleteViolation(deleteItem);
          break;
        case 'complaint':
          deleteSuccess = await handleDeleteComplaint(deleteItem);
          break;
        default:
          Alert.alert('Error', 'Unknown delete type');
          setIsDeleting(false);
          return;
      }
      
      if (deleteSuccess) {
        await fetchAllData();
        setDeleteModalVisible(false);
        setDeleteItem(null);
        setDeleteType('');
        Alert.alert('Success', `${deleteType.charAt(0).toUpperCase() + deleteType.slice(1)} deleted successfully`);
      }
      
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to delete item');
    } finally {
      setIsDeleting(false);
    }
  };

  const getDeleteTitle = () => {
    switch (deleteType) {
      case 'user': return 'Delete User';
      case 'vendor': return 'Delete Vendor';
      case 'announcement': return 'Delete Announcement';
      case 'violation': return 'Delete Violation';
      case 'complaint': return 'Delete Complaint';
      default: return 'Delete Item';
    }
  };

  const getDeleteMessage = () => {
    const name = deleteItem?.full_name || deleteItem?.business_name || deleteItem?.title || 'this item';
    switch (deleteType) {
      case 'user': return `Are you sure you want to delete "${name}"? This action cannot be undone.`;
      case 'vendor': return `Are you sure you want to delete "${name}"? This will also remove their stall and products.`;
      case 'announcement': return `Are you sure you want to delete "${name}"?`;
      case 'violation': return `Are you sure you want to delete this violation?`;
      case 'complaint': return `Are you sure you want to delete this complaint?`;
      default: return 'Are you sure you want to delete this item?';
    }
  };

  const handleDeleteUser = async (user) => {
    try {
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', user.id)
        .single();
      
      if (!existingUser) throw new Error('User not found');
      
      await supabase.from('conversations').delete().eq('customer_id', user.id);
      await supabase.from('messages').delete().eq('sender_id', user.id);
      await supabase.from('notifications').delete().eq('user_id', user.id);
      await supabase.from('carts').delete().eq('user_id', user.id);
      await supabase.from('ratings').delete().eq('consumer_id', user.id);
      await supabase.from('orders').delete().eq('consumer_id', user.id);
      await supabase.from('complaints').delete().eq('user_id', user.id);
      
      if (existingUser.role === 'vendor') {
        const { data: stall } = await supabase
          .from('stalls')
          .select('id')
          .eq('vendor_id', user.id)
          .single();
        
        if (stall) {
          await supabase.from('products').delete().eq('stall_id', stall.id);
          await supabase.from('stalls').delete().eq('id', stall.id);
        }
        
        await supabase.from('vendor_applications').delete().eq('applicant_id', user.id);
        await supabase.from('violations').delete().eq('vendor_id', user.id);
        await supabase.from('compliance_logs').delete().eq('vendor_id', user.id);
      }
      
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);
      
      if (error) throw error;
      return true;
      
    } catch (error) {
      throw error;
    }
  };

  const handleDeleteVendor = async (vendor) => {
    try {
      const { data: stall } = await supabase
        .from('stalls')
        .select('id')
        .eq('vendor_id', vendor.id)
        .single();
      
      if (stall) {
        await supabase.from('products').delete().eq('stall_id', stall.id);
        await supabase.from('stalls').delete().eq('id', stall.id);
      }
      
      await supabase.from('vendor_applications').delete().eq('applicant_id', vendor.id);
      await supabase.from('violations').delete().eq('vendor_id', vendor.id);
      await supabase.from('compliance_logs').delete().eq('vendor_id', vendor.id);
      await supabase.from('conversations').delete().eq('customer_id', vendor.id);
      await supabase.from('messages').delete().eq('sender_id', vendor.id);
      
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', vendor.id);
      
      if (error) throw error;
      return true;
      
    } catch (error) {
      throw error;
    }
  };

  const handleDeleteViolation = async (violation) => {
    try {
      const { error } = await supabase
        .from('violations')
        .delete()
        .eq('id', violation.id);
      
      if (error) throw error;
      return true;
      
    } catch (error) {
      throw error;
    }
  };

  const handleDeleteComplaint = async (complaint) => {
    try {
      const { error } = await supabase
        .from('complaints')
        .delete()
        .eq('id', complaint.id);
      
      if (error) throw error;
      return true;
      
    } catch (error) {
      throw error;
    }
  };

  const deleteAnnouncement = async (id) => {
    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
      
    } catch (error) {
      throw error;
    }
  };

  // ============================================================
  // DELETE RECENT ACTIVITY
  // ============================================================
  const deleteActivity = (id) => {
    console.log('🗑️ Deleting activity with ID:', id);
    console.log('📊 Current activity IDs:', recentActivity.map(a => a.id));
    
    const updatedActivity = recentActivity.filter((activity) => {
      return activity.id !== id;
    });
    
    console.log('📊 Before:', recentActivity.length, 'After:', updatedActivity.length);
    
    setRecentActivity(updatedActivity);
    Alert.alert('Success', 'Activity removed successfully');
  };

  // ============================================================
  // REPORT GENERATION
  // ============================================================
  const generateReport = async () => {
    setIsGeneratingReport(true);
    setReportError(null);
    setDateError('');
    
    if (reportDateRange === 'custom') {
      if (!reportStartDate || !reportEndDate) {
        setDateError('Please select both start and end dates');
        setIsGeneratingReport(false);
        return;
      }
      
      if (new Date(reportStartDate) > new Date(reportEndDate)) {
        setDateError('Start date must be before end date');
        setIsGeneratingReport(false);
        return;
      }
    }
    
    try {
      let data = [];
      let title = '';
      
      const getDateFilter = () => {
        if (reportDateRange === 'all') return null;
        if (reportDateRange === 'today') {
          const today = new Date().toISOString().split('T')[0];
          return { start: today, end: today };
        }
        if (reportDateRange === 'week') {
          const now = new Date();
          const weekAgo = new Date(now);
          weekAgo.setDate(now.getDate() - 7);
          return { start: weekAgo.toISOString().split('T')[0], end: now.toISOString().split('T')[0] };
        }
        if (reportDateRange === 'month') {
          const now = new Date();
          const monthAgo = new Date(now);
          monthAgo.setMonth(now.getMonth() - 1);
          return { start: monthAgo.toISOString().split('T')[0], end: now.toISOString().split('T')[0] };
        }
        if (reportDateRange === 'custom') {
          return { start: reportStartDate, end: reportEndDate };
        }
        return null;
      };
      
      const dateFilter = getDateFilter();
      
      // STALLS REPORT
      if (reportType === 'stalls') {
        let query = supabase
          .from('stalls')
          .select('*, profiles:vendor_id (full_name, email)');
        
        if (dateFilter) {
          query = query.gte('created_at', dateFilter.start).lte('created_at', dateFilter.end + 'T23:59:59');
        }
        
        const { data: stallsData, error } = await query.order('stall_number');
        if (error) throw error;
        
        if (!stallsData || stallsData.length === 0) {
          Alert.alert('No Data', 'No stall records found for the selected date range.');
          setIsGeneratingReport(false);
          return;
        }
        
        data = stallsData.map(s => ({
          'Stall #': s.stall_number || 'N/A',
          'Stall Name': s.stall_name || 'N/A',
          'Section': s.section || 'N/A',
          'Vendor': s.profiles?.full_name || 'Unassigned',
          'Status': s.is_active ? 'Active' : 'Inactive',
          'Created': new Date(s.created_at).toLocaleDateString(),
        }));
        title = 'Stall Report';
      }
      
      // PRODUCTS REPORT
      else if (reportType === 'products') {
        let query = supabase
          .from('products')
          .select('*, stalls (stall_name, stall_number)');
        
        if (dateFilter) {
          query = query.gte('created_at', dateFilter.start).lte('created_at', dateFilter.end + 'T23:59:59');
        }
        
        const { data: productsData, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        
        if (!productsData || productsData.length === 0) {
          Alert.alert('No Data', 'No product records found for the selected date range.');
          setIsGeneratingReport(false);
          return;
        }
        
        data = productsData.map(p => ({
          'Product Name': p.name || 'N/A',
          'Price': `₱${p.price || 0}`,
          'Category': p.category || 'Uncategorized',
          'Stall': p.stalls?.stall_name || 'No stall',
          'Status': p.is_available ? 'Available' : 'Unavailable',
          'Stock': p.stock_quantity || 0,
          'Created': new Date(p.created_at).toLocaleDateString(),
        }));
        title = 'Product Report';
      }
      
      // ORDERS REPORT
      else if (reportType === 'orders') {
        let query = supabase
          .from('orders')
          .select('*, profiles:consumer_id (full_name)');
        
        if (dateFilter) {
          query = query.gte('created_at', dateFilter.start).lte('created_at', dateFilter.end + 'T23:59:59');
        }
        
        const { data: ordersData, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        
        if (!ordersData || ordersData.length === 0) {
          Alert.alert('No Data', 'No order records found for the selected date range.');
          setIsGeneratingReport(false);
          return;
        }
        
        data = ordersData.map(o => ({
          'Order #': o.order_number?.slice(-8) || o.id.toString().slice(-8),
          'Customer': o.profiles?.full_name || 'N/A',
          'Total': `₱${o.total_amount || 0}`,
          'Status': o.status || 'N/A',
          'Date': new Date(o.created_at).toLocaleDateString(),
        }));
        title = 'Order Report';
      }
      
      // VENDORS REPORT
      else if (reportType === 'vendors') {
        let query = supabase
          .from('profiles')
          .select('*, stalls (stall_name, section)')
          .eq('role', 'vendor');
        
        if (dateFilter) {
          query = query.gte('created_at', dateFilter.start).lte('created_at', dateFilter.end + 'T23:59:59');
        }
        
        const { data: vendorsData, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        
        if (!vendorsData || vendorsData.length === 0) {
          Alert.alert('No Data', 'No vendor records found for the selected date range.');
          setIsGeneratingReport(false);
          return;
        }
        
        data = vendorsData.map(v => ({
          'Vendor Name': v.full_name || 'N/A',
          'Email': v.email || 'N/A',
          'Stall': v.stalls?.stall_name || 'No stall',
          'Section': v.stalls?.section || 'N/A',
          'Compliance': `${v.compliance_score || 0}%`,
          'Joined': new Date(v.created_at).toLocaleDateString(),
        }));
        title = 'Vendor Report';
      }
      
      // USERS REPORT
      else if (reportType === 'users') {
        let query = supabase
          .from('profiles')
          .select('*');
        
        if (dateFilter) {
          query = query.gte('created_at', dateFilter.start).lte('created_at', dateFilter.end + 'T23:59:59');
        }
        
        const { data: usersData, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        
        if (!usersData || usersData.length === 0) {
          Alert.alert('No Data', 'No user records found for the selected date range.');
          setIsGeneratingReport(false);
          return;
        }
        
        data = usersData.map(u => ({
          'Name': u.full_name || 'N/A',
          'Email': u.email || 'N/A',
          'Role': u.role || 'consumer',
          'Phone': u.phone || 'N/A',
          'Joined': new Date(u.created_at).toLocaleDateString(),
        }));
        title = 'User Report';
      }
      
      // APPLICATIONS REPORT
      else if (reportType === 'applications') {
        let query = supabase
          .from('vendor_applications')
          .select('*, profiles:applicant_id (full_name, email)');
        
        if (dateFilter) {
          query = query.gte('application_date', dateFilter.start).lte('application_date', dateFilter.end + 'T23:59:59');
        }
        
        const { data: appsData, error } = await query.order('application_date', { ascending: false });
        if (error) throw error;
        
        if (!appsData || appsData.length === 0) {
          Alert.alert('No Data', 'No application records found for the selected date range.');
          setIsGeneratingReport(false);
          return;
        }
        
        data = appsData.map(app => ({
          'Business Name': app.business_name || 'N/A',
          'Applicant': app.profiles?.full_name || 'N/A',
          'Email': app.profiles?.email || 'N/A',
          'Status': app.status || 'pending',
          'Date': new Date(app.application_date).toLocaleDateString(),
        }));
        title = 'Applications Report';
      }
      
      // RECENT ACTIVITY REPORT
      else if (reportType === 'recent_activity') {
        let query = supabase
          .from('orders')
          .select('*, profiles:consumer_id (full_name)')
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (dateFilter) {
          query = query.gte('created_at', dateFilter.start).lte('created_at', dateFilter.end + 'T23:59:59');
        }
        
        const { data: ordersData, error } = await query;
        if (error) throw error;
        
        if (!ordersData || ordersData.length === 0) {
          Alert.alert('No Data', 'No activity records found for the selected date range.');
          setIsGeneratingReport(false);
          return;
        }
        
        data = ordersData.map(o => ({
          'User': o.profiles?.full_name || 'Customer',
          'Action': `Order #${o.order_number?.slice(-6) || o.id.toString().slice(-6)}`,
          'Amount': `₱${o.total_amount || 0}`,
          'Status': o.status || 'N/A',
          'Date': new Date(o.created_at).toLocaleDateString(),
          'Time': new Date(o.created_at).toLocaleTimeString(),
        }));
        title = 'Recent Activity Report';
      }
      
      setReportData(data);
      Alert.alert('Success', `Generated ${title} with ${data.length} records`);
      
    } catch (error) {
      console.error('Report generation error:', error);
      setReportError(error.message);
      Alert.alert('Error', 'Failed to generate report. Please try again.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // ============================================================
  // DOWNLOAD CSV
  // ============================================================
  const downloadCSV = () => {
    if (reportData.length === 0) {
      Alert.alert('No Data', 'No data available to download.');
      return;
    }
    
    const headers = Object.keys(reportData[0]);
    const csvRows = [
      headers.join(','),
      ...reportData.map(row => headers.map(h => `"${String(row[h]).replace(/"/g, '""')}"`).join(','))
    ];
    const csv = csvRows.join('\n');
    
    try {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().slice(0,10);
      link.download = `${reportType}_report_${dateStr}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      Alert.alert('Success', 'CSV downloaded successfully!');
    } catch (error) {
      console.error('CSV download error:', error);
      Alert.alert('Error', 'Failed to download CSV.');
    }
  };

  // ============================================================
  // DOWNLOAD PDF - FIXED
  // ============================================================
  const downloadPDF = () => {
    if (reportData.length === 0) {
      Alert.alert('No Data', 'No data available to download.');
      return;
    }
    
    try {
      // Generate HTML content for PDF
      let html = `
        <html>
          <head>
            <meta charset="UTF-8">
            <title>PalengkeHub Report</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                font-family: Arial, Helvetica, sans-serif; 
                padding: 40px 30px; 
                background: #ffffff;
                color: #1a1a1a;
              }
              .header {
                text-align: center;
                border-bottom: 3px solid #C62828;
                padding-bottom: 20px;
                margin-bottom: 30px;
              }
              .logo {
                font-size: 28px;
                font-weight: 700;
                color: #C62828;
                letter-spacing: -0.5px;
              }
              .logo span {
                color: #1a1a1a;
              }
              .subtitle {
                font-size: 14px;
                color: #666;
                margin-top: 4px;
              }
              .report-title {
                font-size: 22px;
                font-weight: 600;
                color: #1a1a1a;
                margin: 20px 0 10px 0;
              }
              .meta {
                display: flex;
                justify-content: space-between;
                font-size: 13px;
                color: #666;
                margin-bottom: 25px;
                padding: 10px 0;
                border-bottom: 1px solid #eee;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 15px;
                font-size: 12px;
              }
              th {
                background-color: #C62828;
                color: #ffffff;
                padding: 10px 8px;
                text-align: left;
                font-weight: 600;
                border: 1px solid #C62828;
              }
              td {
                padding: 8px;
                border: 1px solid #ddd;
                vertical-align: top;
              }
              tr:nth-child(even) {
                background-color: #f9f9f9;
              }
              tr:hover {
                background-color: #f5f5f5;
              }
              .footer {
                margin-top: 30px;
                padding-top: 15px;
                border-top: 2px solid #C62828;
                text-align: center;
                font-size: 11px;
                color: #999;
              }
              .footer strong {
                color: #C62828;
              }
              .record-count {
                font-size: 13px;
                color: #666;
                margin: 10px 0;
              }
              @media print {
                body { padding: 20px; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="logo">Palengke<span>Hub</span></div>
              <div class="subtitle">Lipa City Public Market Management Information System</div>
            </div>
            
            <div class="report-title">${reportType.toUpperCase()} Report</div>
            
            <div class="meta">
              <span>Generated: ${new Date().toLocaleString()}</span>
              <span>Total Records: ${reportData.length}</span>
              ${reportDateRange !== 'all' ? `<span>Date Range: ${reportDateRange}</span>` : ''}
            </div>
            
            <table>
              <thead>
                <tr>
                  ${Object.keys(reportData[0]).map(key => `<th>${key}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${reportData.map(row => `
                  <tr>
                    ${Object.values(row).map(val => `<td>${String(val)}</td>`).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div class="footer">
              © 2026 <strong>PalengkeHub</strong> • Lipa City Public Market • All rights reserved
            </div>
          </body>
        </html>
      `;
      
      // Create a Blob with HTML content but rename to .pdf
      const blob = new Blob([html], { type: 'application/pdf;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().slice(0,10);
      link.download = `${reportType}_report_${dateStr}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      Alert.alert('Success', 'PDF downloaded successfully!');
    } catch (error) {
      console.error('PDF download error:', error);
      Alert.alert('Error', 'Failed to download PDF. Please try again.');
    }
  };

  // ============================================================
  // FETCH RECENT ACTIVITY
  // ============================================================
  const fetchRecentActivity = async () => {
    try {
      const { data: ordersData } = await supabase
        .from('orders')
        .select('*, profiles:consumer_id (full_name)')
        .order('created_at', { ascending: false })
        .limit(5);

      const { data: appsData } = await supabase
        .from('vendor_applications')
        .select('*, profiles:applicant_id (full_name)')
        .order('application_date', { ascending: false })
        .limit(3);

      const activities = [];

      ordersData?.forEach(order => {
        activities.push({
          id: `order_${order.id}`,
          user: order.profiles?.full_name || 'Customer',
          action: `placed order #${order.order_number?.slice(-6) || order.id.toString().slice(-6)}`,
          time: timeAgo(order.created_at),
          status: order.status,
          type: 'order',
        });
      });

      appsData?.forEach(app => {
        activities.push({
          id: `app_${app.id}`,
          user: app.profiles?.full_name || 'Vendor',
          action: `submitted vendor application - ${app.business_name}`,
          time: timeAgo(app.application_date),
          status: 'pending',
          type: 'application',
        });
      });

      activities.sort((a, b) => {
        const timeA = new Date(a.time);
        const timeB = new Date(b.time);
        return timeB - timeA;
      });

      setRecentActivity(activities.slice(0, 5));
    } catch (error) {
      console.error('Error fetching activity:', error);
    }
  };

  const timeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  // ============================================================
  // DATA FETCHING
  // ============================================================
  
  const fetchAllProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          stalls (
            id,
            stall_number,
            stall_name,
            section,
            vendor_id,
            profiles:vendor_id (full_name, email)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAllProducts(data || []);
      return data || [];
    } catch (error) {
      console.error('Error fetching products:', error);
      return [];
    }
  };

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const productsData = await fetchAllProducts();
      await fetchRecentActivity();
      
      const [usersCount, vendorsCount, consumersCount, pendingApps, stallsCount, ordersCount, salesData, pendingComplaints] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'vendor'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'consumer'),
        supabase.from('vendor_applications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('stalls').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('total_amount').eq('status', 'completed'),
        supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      const totalSales = salesData.data?.reduce((sum, o) => sum + o.total_amount, 0) || 0;

      const { data: pendingOrdersData } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'confirmed', 'preparing', 'ready']);

      const { count: productsCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      setStats({
        totalUsers: usersCount.count || 0,
        totalVendors: vendorsCount.count || 0,
        totalConsumers: consumersCount.count || 0,
        pendingApplications: pendingApps.count || 0,
        totalStalls: stallsCount.count || 0,
        totalProducts: productsCount || 0,
        totalOrders: ordersCount.count || 0,
        totalSales,
        pendingOrders: pendingOrdersData?.count || 0,
        pendingComplaints: pendingComplaints.count || 0,
        pendingStalls: 0,
      });

      const { data: usersData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      setUsers(usersData || []);

      const { data: ordersData } = await supabase
        .from('orders')
        .select('*, profiles:consumer_id (full_name)')
        .order('created_at', { ascending: false });
      setOrders(ordersData || []);

      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const ordersThisMonth = (ordersData || []).filter(o => {
        const created = new Date(o.created_at);
        return created >= thisMonthStart;
      }).length;
      const ordersLastMonth = (ordersData || []).filter(o => {
        const created = new Date(o.created_at);
        return created >= lastMonthStart && created < thisMonthStart;
      }).length;
      const monthlyGrowthValue = ordersLastMonth > 0
        ? `${(((ordersThisMonth - ordersLastMonth) / ordersLastMonth) * 100).toFixed(1)}%`
        : ordersThisMonth > 0 ? 'New' : '0%';

      const vendorsData = (usersData || []).filter(u => u.role === 'vendor');
      const vendorsWithStalls = await Promise.all(vendorsData.map(async (vendor) => {
        const { data: stall } = await supabase
          .from('stalls')
          .select('*')
          .eq('vendor_id', vendor.id)
          .maybeSingle();
        
        return {
          ...vendor,
          stall: stall || null,
          compliance_score: vendor.compliance_score || 100,
        };
      }));
      setVendors(vendorsWithStalls);

      const { data: stallsData } = await supabase
        .from('stalls')
        .select('*, profiles:vendor_id (id, email, full_name)')
        .order('stall_number');
      setStalls(stallsData || []);

      const activeListingsCount = (stallsData || []).filter(s => s.is_active).length;
      const inactiveListingsCount = (stallsData || []).filter(s => !s.is_active).length;
      const lowStockProductsList = (productsData || []).filter(p => typeof p.stock_quantity === 'number' && p.stock_quantity <= 5);
      setLowStockProducts(lowStockProductsList);

      setStats({
        totalUsers: usersCount.count || 0,
        totalVendors: vendorsCount.count || 0,
        totalConsumers: consumersCount.count || 0,
        pendingApplications: pendingApps.count || 0,
        totalStalls: stallsCount.count || 0,
        totalProducts: productsCount || 0,
        totalOrders: ordersCount.count || 0,
        totalSales,
        pendingOrders: pendingOrdersData?.count || 0,
        pendingComplaints: pendingComplaints.count || 0,
        pendingStalls: 0,
        activeListings: activeListingsCount,
        inactiveListings: inactiveListingsCount,
        lowStockAlerts: lowStockProductsList.length,
        monthlyGrowth: monthlyGrowthValue,
      });

      const { data: appsData } = await supabase
        .from('vendor_applications')
        .select('*, profiles:applicant_id (email, full_name, phone)')
        .eq('status', 'pending')
        .order('application_date', { ascending: false });
      setApplications(appsData || []);

      const { data: announcementsData } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      setAnnouncements(announcementsData || []);

      const { data: violationsData } = await supabase
        .from('violations')
        .select('*, profiles:vendor_id (email, full_name)')
        .order('created_at', { ascending: false });
      setViolations(violationsData || []);

      const { data: complaintsData } = await supabase
        .from('complaints')
        .select('*, profiles:user_id (email, full_name), stalls:stall_id (stall_name, stall_number)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      setComplaints(complaintsData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    fetchAllConversations();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
  };

  const exportToCSV = async (rows, fileName) => {
    if (!rows || rows.length === 0) {
      Alert.alert('No Data', 'No data available to export.');
      return;
    }

    const headers = Object.keys(rows[0]);
    const csvRows = [
      headers.join(','),
      ...rows.map(row => headers.map(header => `"${String(row[header] ?? '').replace(/"/g, '""')}"`).join(','))
    ];
    const csv = csvRows.join('\n');
    const sanitizedName = `${fileName.replace(/\s+/g, '_').toLowerCase()}.csv`;

    try {
      if (isWeb && typeof window !== 'undefined') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = sanitizedName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        const fileUri = `${FileSystem.cacheDirectory}${sanitizedName}`;
        await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv' });
      }
      Alert.alert('Success', 'CSV exported successfully.');
    } catch (error) {
      console.error('Export CSV error:', error);
      Alert.alert('Error', 'Unable to export CSV.');
    }
  };

  const exportVendorsCSV = async () => {
    const rows = vendors.map(vendor => ({
      'Vendor Name': vendor.full_name || 'N/A',
      Email: vendor.email || 'N/A',
      Stall: vendor.stall?.stall_name || 'No stall',
      Section: vendor.stall?.section || 'N/A',
      'Stall Status': vendor.stall ? (vendor.stall.is_active ? 'Active' : 'Inactive') : 'No stall',
      Joined: vendor.created_at ? new Date(vendor.created_at).toLocaleDateString() : 'N/A',
    }));
    await exportToCSV(rows, 'vendors_report');
  };

  const exportOrdersCSV = async () => {
    const rows = orders.map(order => ({
      'Order #': order.order_number || order.id,
      Customer: order.profiles?.full_name || 'N/A',
      Total: `₱${order.total_amount || 0}`,
      Status: order.status || 'N/A',
      Date: order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A',
    }));
    await exportToCSV(rows, 'orders_report');
  };

  // ============================================================
  // USER/VENDOR CRUD OPERATIONS
  // ============================================================
  
  const handleEditUser = (user) => {
    setEditUser(user);
    setEditFormData({
      full_name: user.full_name || '',
      email: user.email || '',
      role: user.role || 'consumer',
      phone: user.phone || '',
    });
    setEditModalVisible(true);
  };

  const handleUpdateUser = async () => {
    if (!editUser) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editFormData.full_name,
          phone: editFormData.phone,
          role: editFormData.role,
        })
        .eq('id', editUser.id);
      
      if (error) throw error;
      
      Alert.alert('Success', 'User updated successfully');
      setEditModalVisible(false);
      setEditUser(null);
      fetchAllData();
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  // ============================================================
  // ACTION FUNCTIONS
  // ============================================================
  
  const approveApplication = async (application) => {
    await supabase.from('vendor_applications').update({ status: 'approved', reviewed_at: new Date() }).eq('id', application.id);
    await supabase.from('profiles').update({ role: 'vendor' }).eq('id', application.applicant_id);
    Alert.alert('Success', `${application.business_name} is now a vendor`);
    fetchAllData();
  };

  const rejectApplication = async (application) => {
    await supabase.from('vendor_applications').update({ status: 'rejected', reviewed_at: new Date() }).eq('id', application.id);
    Alert.alert('Rejected', 'Application has been rejected');
    fetchAllData();
  };

  const postAnnouncement = async () => {
    if (!announcementTitle || !announcementContent) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    
    // Calculate expiry date based on duration
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + parseInt(announcementDuration));
    
    await supabase.from('announcements').insert({
      title: announcementTitle,
      content: announcementContent,
      created_by: user.id,
      audience: announcementAudience,
      duration_hours: parseInt(announcementDuration),
      expires_at: expiryDate.toISOString(),
    });
    setAnnouncementModal(false);
    setAnnouncementTitle('');
    setAnnouncementContent('');
    setAnnouncementAudience('both');
    setAnnouncementDuration('24');
    Alert.alert('Success', 'Announcement posted');
    fetchAllData();
  };

  const resolveComplaint = async () => {
    await supabase.from('complaints').update({
      status: 'resolved',
      resolution: resolutionMessage,
      resolved_at: new Date(),
      resolved_by: user.id,
    }).eq('id', selectedComplaint.id);
    setComplaintModal(false);
    setSelectedComplaint(null);
    setResolutionMessage('');
    Alert.alert('Resolved', 'Complaint has been marked as resolved');
    fetchAllData();
  };

  const confirmStallAction = (stall, action) => {
    setSelectedStall(stall);
    setStallAction(action);
    setStallModalVisible(true);
  };

  const executeStallAction = async () => {
    if (!selectedStall) return;
    
    const newIsActive = stallAction === 'activate';
    
    try {
      const { error } = await supabase
        .from('stalls')
        .update({ is_active: newIsActive })
        .eq('id', selectedStall.id);
      
      if (error) throw error;
      
      Alert.alert('Success', `Stall #${selectedStall.stall_number} has been ${stallAction}d`);
      setStallModalVisible(false);
      setSelectedStall(null);
      fetchAllData();
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  // ============================================================
  // USER/VENDOR DETAIL VIEW FUNCTIONS
  // ============================================================
  
  const viewUserDetails = async (user) => {
    setSelectedUserForDetail(user);
    setUserDetailModalVisible(true);
    setDetailLoading(true);
    
    try {
      // Fetch user's orders
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .eq('consumer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      const totalOrders = orders?.length || 0;
      const totalSpent = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
      
      setUserDetailData({
        orders: orders || [],
        totalOrders,
        totalSpent,
      });
    } catch (error) {
      console.error('Error fetching user details:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  const viewVendorDetails = async (vendor) => {
    setSelectedVendorForDetail(vendor);
    setVendorDetailModalVisible(true);
    setDetailLoading(true);
    
    try {
      // Fetch vendor's stall
      const { data: stall } = await supabase
        .from('stalls')
        .select('*')
        .eq('vendor_id', vendor.id)
        .maybeSingle();
      
      // Fetch vendor's products
      const stallId = stall?.id;
      let products = [];
      let totalProducts = 0;
      
      if (stallId) {
        const { data: productsData } = await supabase
          .from('products')
          .select('*')
          .eq('stall_id', stallId);
        products = productsData || [];
        totalProducts = products.length;
      }
      
      // Fetch vendor's orders
      let orders = [];
      let totalOrders = 0;
      let totalRevenue = 0;
      
      if (stallId) {
        const { data: ordersData } = await supabase
          .from('orders')
          .select('*')
          .eq('stall_id', stallId)
          .order('created_at', { ascending: false })
          .limit(10);
        
        orders = ordersData || [];
        totalOrders = orders.length;
        totalRevenue = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
      }
      
      setVendorDetailData({
        stall: stall || null,
        products: products.slice(0, 5),
        totalProducts,
        orders: orders.slice(0, 5),
        totalOrders,
        totalRevenue,
      });
    } catch (error) {
      console.error('Error fetching vendor details:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  // ============================================================
  // RENDER FUNCTIONS
  // ============================================================
  
  const renderUsers = () => (
    <View style={[styles.tableCard, darkMode && styles.tableCardDark]}>
      <View style={[styles.tableHeader, darkMode && styles.tableHeaderDark]}>
        <View>
          <Text style={[styles.tableTitle, darkMode && styles.tableTitleDark]}>Users</Text>
          <Text style={[styles.tableSubtitle, darkMode && styles.tableSubtitleDark]}>Manage all users</Text>
        </View>
        <Text style={styles.tableCount}>{users.length} users</Text>
      </View>
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.tableRow, darkMode && styles.tableRowDark]}
            onPress={() => viewUserDetails(item)}
            activeOpacity={0.7}
          >
            <View style={styles.userInfoCell}>
              <Text style={[styles.tableCell, darkMode && styles.tableCellDark]} numberOfLines={1}>{item.full_name || 'N/A'}</Text>
              <Text style={[styles.tableCellSub, darkMode && styles.tableCellSubDark]} numberOfLines={1}>{item.email}</Text>
            </View>
            <View style={[styles.roleBadge, { backgroundColor: item.role === 'admin' ? '#C62828' : item.role === 'vendor' ? '#E65100' : '#1565C0' }]}>
              <Text style={styles.roleText}>{item.role}</Text>
            </View>
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.editButtonSmall}
                onPress={(e) => {
                  e.stopPropagation();
                  handleEditUser(item);
                }}
              >
                <MaterialIcons name="edit" size={16} color="#1565C0" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.deleteButtonSmall}
                onPress={(e) => {
                  e.stopPropagation();
                  showDeleteConfirmation(item, 'user');
                }}
              >
                <MaterialIcons name="delete" size={16} color="#D32F2F" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="people" size={40} color="#CCCCCC" />
            <Text style={[styles.emptyText, darkMode && styles.emptyTextDark]}>No users found</Text>
          </View>
        }
        scrollEnabled={true}
        style={{ maxHeight: 500 }}
      />
    </View>
  );

  const renderVendors = () => {
    const filteredVendors = selectedVendorStatus === 'all'
      ? vendors
      : vendors.filter(vendor => {
          if (selectedVendorStatus === 'active') return vendor.stall?.is_active;
          if (selectedVendorStatus === 'inactive') return vendor.stall && !vendor.stall.is_active;
          if (selectedVendorStatus === 'nostall') return !vendor.stall;
          return true;
        });

    return (
      <View style={[styles.tableCard, darkMode && styles.tableCardDark]}>
        <View style={[styles.tableHeader, darkMode && styles.tableHeaderDark]}>
          <View>
            <Text style={[styles.tableTitle, darkMode && styles.tableTitleDark]}>Vendors</Text>
            <Text style={[styles.tableSubtitle, darkMode && styles.tableSubtitleDark]}>Manage vendors</Text>
          </View>
          <Text style={styles.tableCount}>{filteredVendors.length} vendors</Text>
        </View>

        <View style={styles.filterRow}>
          <PageFilterDropdown
            label="Vendor Status"
            options={vendorFilterOptions}
            selectedValue={selectedVendorStatus}
            onSelect={setSelectedVendorStatus}
            iconName="store"
            darkMode={darkMode}
          />
          <TouchableOpacity style={styles.exportButton} onPress={exportVendorsCSV}>
            <MaterialIcons name="download" size={18} color="#FFFFFF" />
            <Text style={styles.exportButtonText}>Export CSV</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={filteredVendors}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.tableRow, darkMode && styles.tableRowDark]}
              onPress={() => viewVendorDetails(item)}
              activeOpacity={0.7}
            >
              <View style={styles.userInfoCell}>
                <Text style={[styles.tableCell, darkMode && styles.tableCellDark]} numberOfLines={1}>{item.full_name || 'N/A'}</Text>
                <Text style={[styles.tableCellSub, darkMode && styles.tableCellSubDark]} numberOfLines={1}>{item.email}</Text>
              </View>
              <View style={styles.vendorStallInfo}>
                <Text style={[styles.tableCellSmall, darkMode && styles.tableCellSmallDark]} numberOfLines={1}>
                  {item.stall?.stall_name || 'No stall'}
                </Text>
                <Text style={[styles.tableCellSmall, darkMode && styles.tableCellSmallDark]} numberOfLines={1}>
                  {item.stall?.section || 'No section'}
                </Text>
              </View>
              <View style={styles.actionButtons}>
                {item.stall ? (
                  <TouchableOpacity 
                    style={[styles.actionButtonSmall, item.stall.is_active ? styles.deactivateButton : styles.activateButton]}
                    onPress={(e) => {
                      e.stopPropagation();
                      confirmStallAction(item.stall, item.stall.is_active ? 'deactivate' : 'activate');
                    }}
                  >
                    <Text style={styles.actionButtonText}>{item.stall.is_active ? 'Ban Stall' : 'Activate Stall'}</Text>
                  </TouchableOpacity>
                ) : null}
                {item.stall ? (
                  <TouchableOpacity 
                    style={styles.editButtonSmall}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleChatWithVendor(item);
                    }}
                  >
                    <MaterialIcons name="chat" size={16} color="#1565C0" />
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity 
                  style={styles.editButtonSmall}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleEditUser(item);
                  }}
                >
                  <MaterialIcons name="edit" size={16} color="#1565C0" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.deleteButtonSmall}
                  onPress={(e) => {
                    e.stopPropagation();
                    showDeleteConfirmation(item, 'vendor');
                  }}
                >
                  <MaterialIcons name="delete" size={16} color="#D32F2F" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="store" size={40} color="#CCCCCC" />
              <Text style={[styles.emptyText, darkMode && styles.emptyTextDark]}>No vendors found</Text>
            </View>
          }
          scrollEnabled={true}
          style={{ maxHeight: 500 }}
        />
      </View>
    );
  };

  // ============================================================
  // STALLS RENDER
  // ============================================================
  const renderStalls = () => {
    const filteredStalls = selectedStallCategory === 'all' 
      ? stalls 
      : stalls.filter(s => s.section === selectedStallCategory);

    const getSectionColor = (section) => {
      const colors = {
        'Meat': '#C62828',
        'Vegetable': '#2E7D32',
        'Fruits': '#E65100',
        'Seafood': '#1565C0',
        'Dry Goods': '#6A1B9A',
        'Other': '#6B7280',
        'Section A': '#C62828',
        'Section B': '#E65100',
        'Section C': '#1565C0',
        'Section D': '#2E7D32',
      };
      return colors[section] || '#6B7280';
    };

    return (
      <View style={[styles.tableCard, darkMode && styles.tableCardDark]}>
        <View style={[styles.tableHeader, darkMode && styles.tableHeaderDark]}>
          <View>
            <Text style={[styles.tableTitle, darkMode && styles.tableTitleDark]}>Stalls</Text>
            <Text style={[styles.tableSubtitle, darkMode && styles.tableSubtitleDark]}>Manage stalls</Text>
          </View>
          <Text style={styles.tableCount}>{filteredStalls.length} stalls</Text>
        </View>
        
        <PageFilterDropdown
          label="Category"
          options={stallFilterOptions}
          selectedValue={selectedStallCategory}
          onSelect={setSelectedStallCategory}
          iconName="storefront"
          darkMode={darkMode}
        />

        <FlatList
          data={filteredStalls}
          keyExtractor={(item) => item.id?.toString()}
          renderItem={({ item }) => (
            <View style={[styles.tableRow, darkMode && styles.tableRowDark]}>
              <Text style={[styles.tableCell, darkMode && styles.tableCellDark]}>#{item.stall_number}</Text>
              <Text style={[styles.tableCell, darkMode && styles.tableCellDark]} numberOfLines={1}>{item.stall_name || 'Unnamed'}</Text>
              <View style={[styles.categoryBadge, { backgroundColor: getSectionColor(item.section) }]}>
                <Text style={styles.categoryText} numberOfLines={1}>{item.section || 'Uncategorized'}</Text>
              </View>
              <View style={[styles.statusBadge, item.is_active ? styles.activeBadge : styles.inactiveBadge]}>
                <Text style={styles.statusText}>{item.is_active ? 'Active' : 'Inactive'}</Text>
              </View>
              <TouchableOpacity 
                style={[styles.actionButtonSmall, item.is_active ? styles.deactivateButton : styles.activateButton]}
                onPress={() => confirmStallAction(item, item.is_active ? 'deactivate' : 'activate')}
              >
                <Text style={styles.actionButtonText}>{item.is_active ? 'Deactivate' : 'Activate'}</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="storefront" size={40} color="#CCCCCC" />
              <Text style={[styles.emptyText, darkMode && styles.emptyTextDark]}>No stalls found in this category</Text>
            </View>
          }
          scrollEnabled={true}
          style={{ maxHeight: 500 }}
        />
      </View>
    );
  };

  // ============================================================
  // PRODUCTS RENDER
  // ============================================================
  const renderProducts = () => {
    const categoryFiltered = selectedProductCategory === 'all' 
      ? allProducts 
      : allProducts.filter(p => p.category === selectedProductCategory);
    const statusFiltered = selectedProductStatus === 'all'
      ? categoryFiltered
      : categoryFiltered.filter(p => p.is_available === (selectedProductStatus === 'available'));

    const getCategoryColor = (category) => {
      const colors = {
        'Meat': '#C62828',
        'Vegetable': '#2E7D32',
        'Fruits': '#E65100',
        'Seafood': '#1565C0',
        'Dry Goods': '#6A1B9A',
        'Food': '#C62828',
        'Clothing': '#1565C0',
        'Electronics': '#6A1B9A',
        'Household': '#2E7D32',
        'Jewelry': '#E65100',
        'Others': '#6B7280',
      };
      return colors[category] || '#6B7280';
    };

    return (
      <View style={[styles.tableCard, darkMode && styles.tableCardDark]}>
        <View style={[styles.tableHeader, darkMode && styles.tableHeaderDark]}>
          <View>
            <Text style={[styles.tableTitle, darkMode && styles.tableTitleDark]}>Products</Text>
            <Text style={[styles.tableSubtitle, darkMode && styles.tableSubtitleDark]}>Manage products</Text>
          </View>
          <Text style={styles.tableCount}>{statusFiltered.length} products</Text>
        </View>
        
        <PageFilterDropdown
          label="Category"
          options={productFilterOptions}
          selectedValue={selectedProductCategory}
          onSelect={setSelectedProductCategory}
          iconName="inventory"
          darkMode={darkMode}
        />

        <View style={[styles.statusFilterRow, darkMode && styles.statusFilterRowDark]}>
          {['all', 'available', 'unavailable'].map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.statusFilterChip,
                selectedProductStatus === status && styles.statusFilterChipActive,
              ]}
              onPress={() => setSelectedProductStatus(status)}
            >
              <Text style={[
                styles.statusFilterText,
                selectedProductStatus === status && styles.statusFilterTextActive,
              ]}>
                {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={statusFiltered}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View style={[styles.tableRow, darkMode && styles.tableRowDark]}>
              <View style={styles.productInfoCell}>
                <Text style={[styles.tableCell, darkMode && styles.tableCellDark]} numberOfLines={1}>{item.name}</Text>
                <Text style={[styles.tableCellSub, darkMode && styles.tableCellSubDark]} numberOfLines={1}>
                  {item.stalls?.stall_name || 'No stall'}
                </Text>
              </View>
              <Text style={[styles.tableCell, darkMode && styles.tableCellDark]}>₱{item.price}</Text>
              <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(item.category) }]}>
                <Text style={styles.categoryText} numberOfLines={1}>{item.category || 'Uncategorized'}</Text>
              </View>
              <View style={[styles.statusBadge, item.is_available ? styles.activeBadge : styles.inactiveBadge]}>
                <Text style={styles.statusText}>{item.is_available ? 'Available' : 'Unavailable'}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="inventory" size={40} color="#CCCCCC" />
              <Text style={[styles.emptyText, darkMode && styles.emptyTextDark]}>No products found</Text>
            </View>
          }
          scrollEnabled={true}
          style={{ maxHeight: 500 }}
        />
      </View>
    );
  };

  // ============================================================
  // ORDERS RENDER
  // ============================================================
  const renderOrders = () => {
    const filteredOrders = selectedOrderStatus === 'all'
      ? orders
      : orders.filter(o => o.status === selectedOrderStatus);

    const getOrderStatusStyle = (status) => {
      const stylesMap = {
        pending: { backgroundColor: '#FFF3E0' },
        confirmed: { backgroundColor: '#E3F2FD' },
        preparing: { backgroundColor: '#F3E5F5' },
        ready: { backgroundColor: '#E8F5E9' },
        completed: { backgroundColor: '#C8E6C9' },
        cancelled: { backgroundColor: '#FFEBEE' },
      };
      return stylesMap[status] || stylesMap.pending;
    };

    const getOrderStatusTextColor = (status) => {
      const colors = {
        pending: '#E65100',
        confirmed: '#0D47A1',
        preparing: '#4A148C',
        ready: '#1B5E20',
        completed: '#1B5E20',
        cancelled: '#C62828',
      };
      return colors[status] || '#E65100';
    };

    return (
      <View style={[styles.tableCard, darkMode && styles.tableCardDark]}>
        <View style={[styles.tableHeader, darkMode && styles.tableHeaderDark]}>
          <View>
            <Text style={[styles.tableTitle, darkMode && styles.tableTitleDark]}>Orders</Text>
            <Text style={[styles.tableSubtitle, darkMode && styles.tableSubtitleDark]}>View all orders</Text>
          </View>
          <Text style={styles.tableCount}>{filteredOrders.length} orders</Text>
        </View>

        <View style={styles.filterRow}>
          <PageFilterDropdown
            label="Status"
            options={orderFilterOptions}
            selectedValue={selectedOrderStatus}
            onSelect={setSelectedOrderStatus}
            iconName="shopping-cart"
            darkMode={darkMode}
          />
          <TouchableOpacity style={styles.exportButton} onPress={exportOrdersCSV}>
            <MaterialIcons name="download" size={18} color="#FFFFFF" />
            <Text style={styles.exportButtonText}>Export CSV</Text>
          </TouchableOpacity>
        </View>
        
        <PageFilterDropdown
          label="Status"
          options={orderFilterOptions}
          selectedValue={selectedOrderStatus}
          onSelect={setSelectedOrderStatus}
          iconName="shopping-cart"
          darkMode={darkMode}
        />

        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View style={[styles.tableRow, darkMode && styles.tableRowDark]}>
              <Text style={[styles.tableCell, darkMode && styles.tableCellDark]}>#{item.order_number?.slice(-8) || item.id.toString().slice(-8)}</Text>
              <Text style={[styles.tableCell, darkMode && styles.tableCellDark]} numberOfLines={1}>{item.profiles?.full_name || 'N/A'}</Text>
              <Text style={[styles.tableCell, darkMode && styles.tableCellDark]}>₱{item.total_amount}</Text>
              <View style={[styles.statusBadge, getOrderStatusStyle(item.status)]}>
                <Text style={[styles.statusText, { color: getOrderStatusTextColor(item.status) }]}>
                  {item.status}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="shopping-cart" size={40} color="#CCCCCC" />
              <Text style={[styles.emptyText, darkMode && styles.emptyTextDark]}>No orders found</Text>
            </View>
          }
          scrollEnabled={true}
          style={{ maxHeight: 500 }}
        />
      </View>
    );
  };

  // ============================================================
  // RENDER APPLICATIONS
  // ============================================================
  const renderApplications = () => (
    <ScrollView style={[styles.tableCard, darkMode && styles.tableCardDark]}>
      <View style={[styles.tableHeader, darkMode && styles.tableHeaderDark]}>
        <Text style={[styles.tableTitle, darkMode && styles.tableTitleDark]}>Applications</Text>
        <Text style={[styles.tableSubtitle, darkMode && styles.tableSubtitleDark]}>Review vendor applications</Text>
      </View>
      {applications.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="description" size={40} color="#CCCCCC" />
          <Text style={[styles.emptyText, darkMode && styles.emptyTextDark]}>No Pending Applications</Text>
        </View>
      ) : (
        applications.map(app => (
          <View key={app.id} style={[styles.appCard, darkMode && styles.appCardDark]}>
            <View style={styles.appHeader}>
              <Text style={[styles.appName, darkMode && styles.appNameDark]} numberOfLines={1}>{app.business_name}</Text>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingText}>Pending</Text>
              </View>
            </View>
            <Text style={[styles.appText, darkMode && styles.appTextDark]}>{app.profiles?.full_name || app.profiles?.email}</Text>
            <Text style={[styles.appText, darkMode && styles.appTextDark]}>{new Date(app.application_date).toLocaleDateString()}</Text>
            <View style={styles.appActions}>
              <TouchableOpacity style={styles.approveButton} onPress={() => approveApplication(app)}>
                <MaterialIcons name="check" size={16} color="#FFFFFF" />
                <Text style={styles.approveText}> Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectButton} onPress={() => rejectApplication(app)}>
                <MaterialIcons name="close" size={16} color="#FFFFFF" />
                <Text style={styles.rejectText}> Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  // ============================================================
  // RENDER ANNOUNCEMENTS
  // ============================================================
  const renderAnnouncements = () => (
    <ScrollView style={[styles.tableCard, darkMode && styles.tableCardDark]}>
      <View style={[styles.tableHeader, darkMode && styles.tableHeaderDark]}>
        <Text style={[styles.tableTitle, darkMode && styles.tableTitleDark]}>Announcements</Text>
        <Text style={[styles.tableSubtitle, darkMode && styles.tableSubtitleDark]}>Post announcements</Text>
      </View>
      <TouchableOpacity style={[styles.addButton, darkMode && styles.addButtonDark]} onPress={() => setAnnouncementModal(true)}>
        <MaterialIcons name="add" size={20} color="#FFFFFF" />
        <Text style={styles.addButtonText}> New Announcement</Text>
      </TouchableOpacity>
      {announcements.map(ann => (
        <View key={ann.id} style={[styles.announcementCard, darkMode && styles.announcementCardDark]}>
          <View style={styles.announcementHeader}>
            <Text style={[styles.announcementTitle, darkMode && styles.announcementTitleDark]} numberOfLines={1}>{ann.title}</Text>
            <TouchableOpacity 
              onPress={() => showDeleteConfirmation(ann, 'announcement')}
            >
              <MaterialIcons name="delete" size={20} color="#D32F2F" />
            </TouchableOpacity>
          </View>
          <Text style={[styles.announcementContent, darkMode && styles.announcementContentDark]}>{ann.content}</Text>
          <Text style={[styles.announcementDate, darkMode && styles.announcementDateDark]}>{new Date(ann.created_at).toLocaleDateString()}</Text>
        </View>
      ))}
    </ScrollView>
  );

  // ============================================================
  // RENDER VIOLATIONS
  // ============================================================
  const renderViolations = () => (
    <ScrollView style={[styles.tableCard, darkMode && styles.tableCardDark]}>
      <View style={[styles.tableHeader, darkMode && styles.tableHeaderDark]}>
        <Text style={[styles.tableTitle, darkMode && styles.tableTitleDark]}>Violations</Text>
        <Text style={[styles.tableSubtitle, darkMode && styles.tableSubtitleDark]}>Track violations</Text>
      </View>
      {violations.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="warning" size={40} color="#CCCCCC" />
          <Text style={[styles.emptyText, darkMode && styles.emptyTextDark]}>No Violations</Text>
        </View>
      ) : (
        violations.map(v => (
          <View key={v.id} style={[styles.violationCard, darkMode && styles.violationCardDark]}>
            <View style={styles.violationHeader}>
              <Text style={[styles.violationVendor, darkMode && styles.violationVendorDark]}>{v.profiles?.full_name || 'Unknown'}</Text>
              <TouchableOpacity 
                onPress={() => showDeleteConfirmation(v, 'violation')}
                style={styles.deleteButtonSmall}
              >
                <MaterialIcons name="delete" size={16} color="#D32F2F" />
              </TouchableOpacity>
            </View>
            <Text style={[styles.violationReason, darkMode && styles.violationReasonDark]}>{v.reason}</Text>
            <Text style={[styles.violationDate, darkMode && styles.violationDateDark]}>{new Date(v.created_at).toLocaleDateString()}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );

  // ============================================================
  // RENDER COMPLAINTS
  // ============================================================
  const renderComplaints = () => (
    <ScrollView style={[styles.tableCard, darkMode && styles.tableCardDark]}>
      <View style={[styles.tableHeader, darkMode && styles.tableHeaderDark]}>
        <Text style={[styles.tableTitle, darkMode && styles.tableTitleDark]}>Complaints</Text>
        <Text style={[styles.tableSubtitle, darkMode && styles.tableSubtitleDark]}>Resolve complaints</Text>
      </View>
      {complaints.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="chat-bubble-outline" size={40} color="#CCCCCC" />
          <Text style={[styles.emptyText, darkMode && styles.emptyTextDark]}>No Complaints</Text>
        </View>
      ) : (
        complaints.map(c => (
          <View key={c.id} style={[styles.complaintCard, darkMode && styles.complaintCardDark]}>
            <View style={styles.complaintHeader}>
              <Text style={[styles.complaintTitle, darkMode && styles.complaintTitleDark]}>{c.profiles?.full_name}</Text>
              <View style={styles.complaintActions}>
                <TouchableOpacity 
                  style={styles.resolveButtonSmall}
                  onPress={() => { setSelectedComplaint(c); setComplaintModal(true); }}
                >
                  <MaterialIcons name="check-circle" size={16} color="#FFFFFF" />
                  <Text style={styles.resolveButtonText}> Resolve</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => showDeleteConfirmation(c, 'complaint')}
                  style={styles.deleteButtonSmall}
                >
                  <MaterialIcons name="delete" size={16} color="#D32F2F" />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={[styles.complaintAbout, darkMode && styles.complaintAboutDark]}>{c.stalls?.stall_name || 'General'}</Text>
            <Text style={[styles.complaintMessage, darkMode && styles.complaintMessageDark]}>"{c.message}"</Text>
          </View>
        ))
      )}
    </ScrollView>
  );

  // ============================================================
  // ADMIN CHAT FUNCTIONS
  const fetchAllConversations = async () => {
    setLoadingChats(true);
    try {
      const data = await chatService.getAllConversations();
      setConversations(data || []);
    } catch (error) {
      console.error('Error fetching all conversations:', error);
    } finally {
      setLoadingChats(false);
    }
  };

  const handleOpenChat = (conv) => {
    setSelectedConversation(conv);
    chatService.getMessages(conv.id).then(setMessages);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedConversation) return;
    setSendingMessage(true);
    try {
      await chatService.sendMessage(selectedConversation.id, user.id, 'admin', messageText.trim());
      setMessageText('');
      const updated = await chatService.getMessages(selectedConversation.id);
      setMessages(updated);
    } catch (err) {
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  // RENDER CHATS
  const renderChats = () => {
    if (selectedConversation) {
      return (
        <View style={[styles.tableCard, darkMode && styles.tableCardDark]}>
          <View style={[styles.tableHeader, darkMode && styles.tableHeaderDark]}>
            <TouchableOpacity onPress={() => { setSelectedConversation(null); setMessages([]); }}>
              <MaterialIcons name="arrow-back" size={24} color={darkMode ? '#FFFFFF' : '#1A1A1A'} />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.tableTitle, darkMode && styles.tableTitleDark]}>
                {selectedConversation.customer?.full_name || 'Customer'} ↔ {selectedConversation.stall?.stall_name || 'Vendor'}
              </Text>
              <Text style={[styles.tableSubtitle, darkMode && styles.tableSubtitleDark]}>
                Stall #{selectedConversation.stall?.stall_number || 'N/A'}
              </Text>
            </View>
          </View>
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id.toString()}
            style={{ maxHeight: 400 }}
            renderItem={({ item }) => (
              <View style={[styles.chatBubble, item.sender_role === 'admin' ? styles.chatBubbleAdmin : styles.chatBubbleOther]}>
                <Text style={styles.chatSender}>{item.sender_role === 'admin' ? 'Admin' : item.sender_role}</Text>
                <Text style={styles.chatMessageText}>{item.message}</Text>
                <Text style={styles.chatTime}>{new Date(item.created_at).toLocaleTimeString()}</Text>
              </View>
            )}
          />
          <View style={styles.chatInputRow}>
            <TextInput
              style={[styles.modalInput, { flex: 1, marginBottom: 0 }]}
              placeholder="Type a message..."
              value={messageText}
              onChangeText={setMessageText}
              onSubmitEditing={handleSendMessage}
            />
            <TouchableOpacity style={styles.chatSendBtn} onPress={handleSendMessage} disabled={sendingMessage}>
              <Text style={styles.chatSendBtnText}>{sendingMessage ? '...' : 'Send'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.tableCard, darkMode && styles.tableCardDark]}>
        <View style={[styles.tableHeader, darkMode && styles.tableHeaderDark]}>
          <Text style={[styles.tableTitle, darkMode && styles.tableTitleDark]}>All Conversations</Text>
          <TouchableOpacity onPress={fetchAllConversations}>
            <MaterialIcons name="refresh" size={20} color={darkMode ? '#888888' : '#666666'} />
          </TouchableOpacity>
        </View>
        {loadingChats ? (
          <ActivityIndicator size="large" color="#C62828" style={{ padding: 30 }} />
        ) : conversations.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="chat-bubble-outline" size={40} color="#CCCCCC" />
            <Text style={[styles.emptyText, darkMode && styles.emptyTextDark]}>No conversations yet</Text>
          </View>
        ) : (
          conversations.map((conv) => (
            <TouchableOpacity key={conv.id} style={[styles.tableRow, darkMode && styles.tableRowDark]} onPress={() => handleOpenChat(conv)}>
              <View style={styles.userInfoCell}>
                <Text style={[styles.tableCell, darkMode && styles.tableCellDark]} numberOfLines={1}>
                  {conv.customer?.full_name || 'Customer'} ↔ {conv.stall?.stall_name || 'Vendor'}
                </Text>
                <Text style={[styles.tableCellSub, darkMode && styles.tableCellSubDark]} numberOfLines={1}>
                  {conv.last_message || 'No messages'}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color="#CCCCCC" />
            </TouchableOpacity>
          ))
        )}
      </View>
    );
  };

  // RENDER REPORTS
  // ============================================================
  const renderReports = () => {
    return (
      <View style={[styles.tableCard, darkMode && styles.tableCardDark]}>
        <View style={[styles.tableHeader, darkMode && styles.tableHeaderDark]}>
          <View>
            <Text style={[styles.tableTitle, darkMode && styles.tableTitleDark]}>Reports</Text>
            <Text style={[styles.tableSubtitle, darkMode && styles.tableSubtitleDark]}>Generate and download reports</Text>
          </View>
        </View>
        
        <View style={styles.reportsContainer}>
          <View style={styles.reportCard}>
            <View style={styles.reportCardIcon}>
              <MaterialIcons name="storefront" size={22} color="#C62828" />
            </View>
            <View style={styles.reportCardContent}>
              <Text style={[styles.reportCardTitle, darkMode && styles.reportCardTitleDark]}>Stall Report</Text>
              <Text style={[styles.reportCardSubtitle, darkMode && styles.reportCardSubtitleDark]}>
                Generate comprehensive stall report
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.reportGenerateButton}
              onPress={() => {
                setReportType('stalls');
                setReportModalVisible(true);
              }}
            >
              <Text style={styles.reportGenerateButtonText}>Generate →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.reportCard}>
            <View style={styles.reportCardIcon}>
              <MaterialIcons name="inventory" size={22} color="#E65100" />
            </View>
            <View style={styles.reportCardContent}>
              <Text style={[styles.reportCardTitle, darkMode && styles.reportCardTitleDark]}>Product Report</Text>
              <Text style={[styles.reportCardSubtitle, darkMode && styles.reportCardSubtitleDark]}>
                Generate comprehensive product report
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.reportGenerateButton}
              onPress={() => {
                setReportType('products');
                setReportModalVisible(true);
              }}
            >
              <Text style={styles.reportGenerateButtonText}>Generate →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.reportCard}>
            <View style={styles.reportCardIcon}>
              <MaterialIcons name="shopping-cart" size={22} color="#1565C0" />
            </View>
            <View style={styles.reportCardContent}>
              <Text style={[styles.reportCardTitle, darkMode && styles.reportCardTitleDark]}>Order Report</Text>
              <Text style={[styles.reportCardSubtitle, darkMode && styles.reportCardSubtitleDark]}>
                Generate comprehensive order report
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.reportGenerateButton}
              onPress={() => {
                setReportType('orders');
                setReportModalVisible(true);
              }}
            >
              <Text style={styles.reportGenerateButtonText}>Generate →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.reportCard}>
            <View style={styles.reportCardIcon}>
              <MaterialIcons name="store" size={22} color="#2E7D32" />
            </View>
            <View style={styles.reportCardContent}>
              <Text style={[styles.reportCardTitle, darkMode && styles.reportCardTitleDark]}>Vendor Report</Text>
              <Text style={[styles.reportCardSubtitle, darkMode && styles.reportCardSubtitleDark]}>
                Generate comprehensive vendor report
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.reportGenerateButton}
              onPress={() => {
                setReportType('vendors');
                setReportModalVisible(true);
              }}
            >
              <Text style={styles.reportGenerateButtonText}>Generate →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.reportCard}>
            <View style={styles.reportCardIcon}>
              <MaterialIcons name="people" size={22} color="#6A1B9A" />
            </View>
            <View style={styles.reportCardContent}>
              <Text style={[styles.reportCardTitle, darkMode && styles.reportCardTitleDark]}>User Report</Text>
              <Text style={[styles.reportCardSubtitle, darkMode && styles.reportCardSubtitleDark]}>
                Generate comprehensive user report
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.reportGenerateButton}
              onPress={() => {
                setReportType('users');
                setReportModalVisible(true);
              }}
            >
              <Text style={styles.reportGenerateButtonText}>Generate →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.reportCard}>
            <View style={styles.reportCardIcon}>
              <MaterialIcons name="description" size={22} color="#6B7280" />
            </View>
            <View style={styles.reportCardContent}>
              <Text style={[styles.reportCardTitle, darkMode && styles.reportCardTitleDark]}>Applications Report</Text>
              <Text style={[styles.reportCardSubtitle, darkMode && styles.reportCardSubtitleDark]}>
                Generate comprehensive applications report
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.reportGenerateButton}
              onPress={() => {
                setReportType('applications');
                setReportModalVisible(true);
              }}
            >
              <Text style={styles.reportGenerateButtonText}>Generate →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.reportCard}>
            <View style={styles.reportCardIcon}>
              <MaterialIcons name="history" size={22} color="#C62828" />
            </View>
            <View style={styles.reportCardContent}>
              <Text style={[styles.reportCardTitle, darkMode && styles.reportCardTitleDark]}>Recent Activity Report</Text>
              <Text style={[styles.reportCardSubtitle, darkMode && styles.reportCardSubtitleDark]}>
                Generate comprehensive recent activity report
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.reportGenerateButton}
              onPress={() => {
                setReportType('recent_activity');
                setReportModalVisible(true);
              }}
            >
              <Text style={styles.reportGenerateButtonText}>Generate →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // ============================================================
  // RENDER CONTENT
  // ============================================================
  const renderContent = () => {
    if (loading && !refreshing) {
      return (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#C62828" />
          <Text style={[styles.loadingText, darkMode && styles.loadingTextDark]}>Loading...</Text>
        </View>
      );
    }

    switch (activeSection) {
      case 'overview':
        return <DashboardOverview 
          stats={stats} 
          setActiveSection={setActiveSection} 
          recentActivity={recentActivity} 
          darkMode={darkMode} 
          deleteActivity={deleteActivity} 
        />;
      case 'users':
        return renderUsers();
      case 'products':
        return renderProducts();
      case 'vendors':
        return renderVendors();
      case 'applications':
        return renderApplications();
      case 'stalls':
        return renderStalls();
      case 'orders':
        return renderOrders();
      case 'announcements':
        return renderAnnouncements();
      case 'violations':
        return renderViolations();
      case 'complaints':
        return renderComplaints();
      case 'chats':
        return renderChats();
      case 'price_monitoring':
        return (
          <TouchableOpacity
            style={{ padding: 20, alignItems: 'center' }}
            onPress={() => navigation.navigate('AdminPriceMonitoring')}
          >
            <MaterialIcons name="attach-money" size={48} color="#DC2626" />
            <Text style={{ fontSize: 16, color: '#666', marginTop: 10 }}>
              Navigate to Price Monitoring Screen
            </Text>
          </TouchableOpacity>
        );
      case 'audit_trail':
        return (
          <TouchableOpacity
            style={{ padding: 20, alignItems: 'center' }}
            onPress={() => navigation.navigate('AdminAuditTrail')}
          >
            <MaterialIcons name="history" size={48} color="#DC2626" />
            <Text style={{ fontSize: 16, color: '#666', marginTop: 10 }}>
              Navigate to Audit Trail Screen
            </Text>
          </TouchableOpacity>
        );
      case 'reports':
        return renderReports();
      default:
        return <DashboardOverview 
          stats={stats} 
          setActiveSection={setActiveSection} 
          recentActivity={recentActivity} 
          darkMode={darkMode} 
          deleteActivity={deleteActivity} 
        />;
    }
  };

  // ============================================================
  // MAIN RENDER
  // ============================================================
  return (
    <DashboardBackground darkMode={darkMode}>
      <View style={[styles.container, darkMode && styles.containerDark]}>
        <StatusBar barStyle="light-content" backgroundColor="#C62828" translucent />

        <Sidebar
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
          profile={profile}
          user={user}
          handleLogout={handleLogout}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
        />

        <View style={[
          styles.mainContent,
          sidebarCollapsed && styles.mainContentExpanded,
          darkMode && styles.mainContentDark,
        ]}>
          <View style={[styles.header, darkMode && styles.headerDark]}>
            <View style={styles.headerLeft}>
              {!isWeb && (
                <TouchableOpacity
                  style={[styles.menuButton, darkMode && styles.menuButtonDark]}
                  onPress={() => setSidebarCollapsed(!sidebarCollapsed)}
                >
                  <MaterialIcons name="menu" size={24} color={darkMode ? '#FFFFFF' : '#C62828'} />
                </TouchableOpacity>
              )}
              <Text style={[styles.headerTitle, darkMode && styles.headerTitleDark]}>
                {activeSection === 'overview' ? 'Dashboard' : 
                 activeSection === 'users' ? 'Users' :
                 activeSection === 'vendors' ? 'Vendors' :
                 activeSection === 'applications' ? 'Applications' :
                 activeSection === 'stalls' ? 'Stalls' :
                 activeSection === 'products' ? 'Products' :
                 activeSection === 'orders' ? 'Orders' :
                 activeSection === 'announcements' ? 'Announcements' :
                 activeSection === 'violations' ? 'Violations' :
                 activeSection === 'complaints' ? 'Complaints' :
                 activeSection === 'chats' ? 'Chats' :
                 activeSection === 'reports' ? 'Reports' : 'Dashboard'}
              </Text>
            </View>
            
            <View style={styles.headerRight}>
              <TouchableOpacity 
                style={[styles.searchButton, darkMode && styles.searchButtonDark]} 
                onPress={() => setSearchVisible(true)}
              >
                <MaterialIcons name="search" size={18} color={darkMode ? '#888888' : '#666666'} />
                <Text style={[styles.searchButtonText, darkMode && styles.searchButtonTextDark]}>Search</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.refreshButton, darkMode && styles.refreshButtonDark]} 
                onPress={onRefresh}
              >
                <MaterialIcons name="refresh" size={20} color={darkMode ? '#888888' : '#666666'} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={[styles.content, darkMode && styles.contentDark]}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={true}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#C62828']}
                tintColor="#C62828"
              />
            }
          >
            {renderContent()}
          </ScrollView>
        </View>

        {/* SEARCH MODAL */}
        <Modal 
          visible={searchVisible} 
          transparent={true} 
          animationType="fade"
          onRequestClose={() => {
            setSearchVisible(false);
            setSearchQuery('');
            setSearchResults([]);
          }}
        >
          <TouchableOpacity 
            style={[styles.searchOverlay, darkMode && styles.searchOverlayDark]}
            activeOpacity={1}
            onPress={() => {
              setSearchVisible(false);
              setSearchQuery('');
              setSearchResults([]);
            }}
          >
            <TouchableOpacity 
              style={[styles.searchContainer, darkMode && styles.searchContainerDark]}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={[styles.searchHeader, darkMode && styles.searchHeaderDark]}>
                <MaterialIcons name="search" size={20} color={darkMode ? '#888888' : '#666666'} />
                <TextInput
                  style={[styles.searchInput, darkMode && styles.searchInputDark]}
                  placeholder="Search users, vendors, products, orders, stalls..."
                  placeholderTextColor={darkMode ? '#666' : '#999'}
                  value={searchQuery}
                  onChangeText={(text) => {
                    setSearchQuery(text);
                    performSearch(text);
                  }}
                  autoFocus={true}
                  editable={true}
                  selectTextOnFocus={true}
                  returnKeyType="search"
                  onSubmitEditing={() => {}}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity 
                    onPress={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    style={styles.searchClearButton}
                  >
                    <MaterialIcons name="close" size={20} color={darkMode ? '#888888' : '#666666'} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity 
                  onPress={() => {
                    setSearchVisible(false);
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  style={styles.searchCloseButton}
                >
                  <MaterialIcons name="close" size={24} color={darkMode ? '#888888' : '#666666'} />
                </TouchableOpacity>
              </View>
              
              {searchQuery.length > 0 && (
                <ScrollView 
                  style={styles.searchResultsList}
                  showsVerticalScrollIndicator={true}
                  keyboardShouldPersistTaps="handled"
                >
                  {searchResults.length > 0 ? (
                    searchResults.map((result, index) => (
                      <TouchableOpacity
                        key={result.id || index}
                        style={[
                          styles.searchResultItem,
                          index === 0 && styles.searchResultItemTop,
                          darkMode && styles.searchResultItemDark,
                        ]}
                        onPress={() => {
                          setSearchVisible(false);
                          setSearchQuery('');
                          setSearchResults([]);
                          const sectionMap = {
                            'User': 'users',
                            'Vendor': 'vendors',
                            'Product': 'products',
                            'Order': 'orders',
                            'Stall': 'stalls',
                            'Application': 'applications',
                          };
                          setActiveSection(sectionMap[result.type] || 'overview');
                        }}
                      >
                        <View style={styles.searchResultContent}>
                          <View style={styles.searchResultHeader}>
                            <View style={styles.searchResultIconContainer}>
                              <MaterialIcons name={result.icon || 'search'} size={16} color="#C62828" />
                            </View>
                            <Text style={styles.searchResultType}>{result.type}</Text>
                            {result.score >= 0.95 && (
                              <View style={styles.searchResultExactBadge}>
                                <Text style={styles.searchResultExactText}>Exact Match</Text>
                              </View>
                            )}
                            {result.score >= 0.9 && result.score < 0.95 && (
                              <View style={styles.searchResultMatchBadge}>
                                <Text style={styles.searchResultMatchText}>★ Top Match</Text>
                              </View>
                            )}
                            {index === 0 && result.score < 0.9 && (
                              <View style={styles.searchResultBestBadge}>
                                <Text style={styles.searchResultBestText}>Best Match</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.searchResultText} numberOfLines={1}>
                            {result.displayName}
                          </Text>
                          <Text style={styles.searchResultSubtext} numberOfLines={1}>
                            {result.displaySub}
                          </Text>
                          {result.score >= 0.8 && (
                            <View style={styles.searchResultScoreBar}>
                              <View style={[styles.searchResultScoreFill, { width: `${Math.round(result.score * 100)}%` }]} />
                            </View>
                          )}
                        </View>
                        <MaterialIcons name="chevron-right" size={20} color="#CCCCCC" />
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.searchEmptyState}>
                      <MaterialIcons name="search-off" size={48} color="#CCCCCC" />
                      <Text style={[styles.searchEmptyText, darkMode && styles.searchEmptyTextDark]}>
                        No results found
                      </Text>
                      <Text style={[styles.searchEmptySubtext, darkMode && styles.searchEmptySubtextDark]}>
                        Try adjusting your search terms or check your spelling
                      </Text>
                    </View>
                  )}
                </ScrollView>
              )}
              
              {searchQuery.length === 0 && searchResults.length === 0 && (
                <View style={styles.searchEmptyState}>
                  <MaterialIcons name="search" size={48} color="#CCCCCC" />
                  <Text style={[styles.searchEmptyText, darkMode && styles.searchEmptyTextDark]}>
                    Type to search...
                  </Text>
                  <Text style={[styles.searchEmptySubtext, darkMode && styles.searchEmptySubtextDark]}>
                    Search across users, vendors, products, orders, stalls, and applications
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* EDIT USER MODAL */}
        <Modal visible={editModalVisible} transparent animationType="slide">
          <View style={[styles.modalOverlay, darkMode && styles.modalOverlayDark]}>
            <View style={[styles.modalContainer, darkMode && styles.modalContainerDark]}>
              <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>Edit User</Text>
              <TextInput
                style={[styles.modalInput, darkMode && styles.modalInputDark]}
                placeholder="Full Name"
                value={editFormData.full_name}
                onChangeText={(text) => setEditFormData({...editFormData, full_name: text})}
              />
              <TextInput
                style={[styles.modalInput, darkMode && styles.modalInputDark]}
                placeholder="Email"
                value={editFormData.email}
                editable={false}
              />
              <TextInput
                style={[styles.modalInput, darkMode && styles.modalInputDark]}
                placeholder="Phone"
                value={editFormData.phone}
                onChangeText={(text) => setEditFormData({...editFormData, phone: text})}
              />
              <View style={styles.roleSelector}>
                {['consumer', 'vendor', 'admin'].map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[styles.roleOption, editFormData.role === role && styles.roleOptionActive]}
                    onPress={() => setEditFormData({...editFormData, role})}
                  >
                    <Text style={[styles.roleOptionText, editFormData.role === role && styles.roleOptionTextActive]}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.modalCancel, darkMode && styles.modalCancelDark]} onPress={() => setEditModalVisible(false)}>
                  <Text style={[styles.modalCancelText, darkMode && styles.modalCancelTextDark]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalSubmit, darkMode && styles.modalSubmitDark]} onPress={handleUpdateUser}>
                  <Text style={styles.modalSubmitText}>Update</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ANNOUNCEMENT MODAL */}
        <Modal visible={announcementModal} transparent animationType="fade">
          <View style={[styles.modalOverlay, darkMode && styles.modalOverlayDark]}>
            <View style={[styles.modalContainer, darkMode && styles.modalContainerDark]}>
              <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>New Announcement</Text>
              <TextInput style={[styles.modalInput, darkMode && styles.modalInputDark]} placeholder="Title" value={announcementTitle} onChangeText={setAnnouncementTitle} />
              <TextInput style={[styles.modalInput, styles.textArea, darkMode && styles.modalInputDark]} placeholder="Content" value={announcementContent} onChangeText={setAnnouncementContent} multiline numberOfLines={4} />
              
              {/* Audience Targeting */}
              <Text style={[styles.modalLabel, darkMode && styles.modalLabelDark]}>Audience</Text>
              <View style={styles.audienceSelector}>
                <TouchableOpacity
                  style={[
                    styles.audienceOption,
                    announcementAudience === 'vendors' && styles.audienceOptionActive,
                  ]}
                  onPress={() => setAnnouncementAudience('vendors')}
                >
                  <MaterialIcons name="store" size={16} color={announcementAudience === 'vendors' ? '#FFFFFF' : '#666666'} />
                  <Text style={[
                    styles.audienceOptionText,
                    announcementAudience === 'vendors' && styles.audienceOptionTextActive,
                  ]}>Vendors Only</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.audienceOption,
                    announcementAudience === 'consumers' && styles.audienceOptionActive,
                  ]}
                  onPress={() => setAnnouncementAudience('consumers')}
                >
                  <MaterialIcons name="people" size={16} color={announcementAudience === 'consumers' ? '#FFFFFF' : '#666666'} />
                  <Text style={[
                    styles.audienceOptionText,
                    announcementAudience === 'consumers' && styles.audienceOptionTextActive,
                  ]}>Consumers Only</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.audienceOption,
                    announcementAudience === 'both' && styles.audienceOptionActive,
                  ]}
                  onPress={() => setAnnouncementAudience('both')}
                >
                  <MaterialIcons name="public" size={16} color={announcementAudience === 'both' ? '#FFFFFF' : '#666666'} />
                  <Text style={[
                    styles.audienceOptionText,
                    announcementAudience === 'both' && styles.audienceOptionTextActive,
                  ]}>Both</Text>
                </TouchableOpacity>
              </View>
              
              {/* Duration Setting */}
              <Text style={[styles.modalLabel, darkMode && styles.modalLabelDark]}>Duration (hours)</Text>
              <View style={styles.durationSelector}>
                {[1, 6, 12, 24, 48, 72, 168].map((hours) => (
                  <TouchableOpacity
                    key={hours}
                    style={[
                      styles.durationOption,
                      announcementDuration === hours.toString() && styles.durationOptionActive,
                    ]}
                    onPress={() => setAnnouncementDuration(hours.toString())}
                  >
                    <Text style={[
                      styles.durationOptionText,
                      announcementDuration === hours.toString() && styles.durationOptionTextActive,
                    ]}>
                      {hours === 168 ? '1 week' : `${hours}h`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.modalCancel, darkMode && styles.modalCancelDark]} onPress={() => setAnnouncementModal(false)}>
                  <Text style={[styles.modalCancelText, darkMode && styles.modalCancelTextDark]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalSubmit, darkMode && styles.modalSubmitDark]} onPress={postAnnouncement}>
                  <Text style={styles.modalSubmitText}>Post</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* VIOLATION MODAL */}
        <Modal visible={violationModal} transparent animationType="fade">
          <View style={[styles.modalOverlay, darkMode && styles.modalOverlayDark]}>
            <View style={[styles.modalContainer, darkMode && styles.modalContainerDark]}>
              <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>Issue Warning</Text>
              <Text style={[styles.modalSubtitle, darkMode && styles.modalSubtitleDark]}>Vendor: {selectedVendor?.full_name}</Text>
              <TextInput style={[styles.modalInput, styles.textArea, darkMode && styles.modalInputDark]} placeholder="Reason" value={violationReason} onChangeText={setViolationReason} multiline numberOfLines={3} />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.modalCancel, darkMode && styles.modalCancelDark]} onPress={() => setViolationModal(false)}>
                  <Text style={[styles.modalCancelText, darkMode && styles.modalCancelTextDark]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalSubmit, styles.warningSubmit, darkMode && styles.modalSubmitDark]} onPress={() => {
                  Alert.alert('Warning Issued');
                  setViolationModal(false);
                }}>
                  <Text style={styles.modalSubmitText}>Issue Warning</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* COMPLAINT MODAL */}
        <Modal visible={complaintModal} transparent animationType="fade">
          <View style={[styles.modalOverlay, darkMode && styles.modalOverlayDark]}>
            <View style={[styles.modalContainer, darkMode && styles.modalContainerDark]}>
              <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>Resolve Complaint</Text>
              <Text style={[styles.modalSubtitle, darkMode && styles.modalSubtitleDark]}>Complaint: {selectedComplaint?.message}</Text>
              <TextInput style={[styles.modalInput, styles.textArea, darkMode && styles.modalInputDark]} placeholder="Resolution" value={resolutionMessage} onChangeText={setResolutionMessage} multiline numberOfLines={3} />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.modalCancel, darkMode && styles.modalCancelDark]} onPress={() => setComplaintModal(false)}>
                  <Text style={[styles.modalCancelText, darkMode && styles.modalCancelTextDark]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalSubmit, darkMode && styles.modalSubmitDark]} onPress={resolveComplaint}>
                  <Text style={styles.modalSubmitText}>Resolve</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* STALL MODAL */}
        <Modal visible={stallModalVisible} transparent animationType="fade">
          <View style={[styles.modalOverlay, darkMode && styles.modalOverlayDark]}>
            <View style={[styles.modalContainer, darkMode && styles.modalContainerDark]}>
              <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>
                {stallAction === 'activate' ? 'Activate Stall' : 'Deactivate Stall'}
              </Text>
              <Text style={[styles.modalSubtitle, darkMode && styles.modalSubtitleDark]}>Stall #{selectedStall?.stall_number}</Text>
              <Text style={[styles.modalText, darkMode && styles.modalTextDark]}>Are you sure you want to {stallAction} this stall?</Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.modalCancel, darkMode && styles.modalCancelDark]} onPress={() => setStallModalVisible(false)}>
                  <Text style={[styles.modalCancelText, darkMode && styles.modalCancelTextDark]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalSubmit, stallAction === 'activate' ? { backgroundColor: '#2E7D32' } : { backgroundColor: '#C62828' }, darkMode && styles.modalSubmitDark]} onPress={executeStallAction}>
                  <Text style={styles.modalSubmitText}>{stallAction === 'activate' ? 'Activate' : 'Deactivate'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* DELETE CONFIRMATION MODAL */}
        <Modal
          visible={deleteModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setDeleteModalVisible(false);
            setDeleteItem(null);
            setDeleteType('');
          }}
        >
          <View style={[styles.modalOverlay, darkMode && styles.modalOverlayDark]}>
            <View style={[styles.deleteModalContainer, darkMode && styles.deleteModalContainerDark]}>
              <View style={styles.deleteModalIconContainer}>
                <View style={[styles.deleteModalIcon, { backgroundColor: '#FFEBEE' }]}>
                  <MaterialIcons name="delete" size={40} color="#C62828" />
                </View>
              </View>
              
              <Text style={[styles.deleteModalTitle, darkMode && styles.deleteModalTitleDark]}>
                {getDeleteTitle()}
              </Text>
              
              <Text style={[styles.deleteModalMessage, darkMode && styles.deleteModalMessageDark]}>
                {getDeleteMessage()}
              </Text>
              
              <View style={styles.deleteModalButtons}>
                <TouchableOpacity
                  style={[styles.deleteModalCancel, darkMode && styles.deleteModalCancelDark]}
                  onPress={() => {
                    setDeleteModalVisible(false);
                    setDeleteItem(null);
                    setDeleteType('');
                  }}
                  disabled={isDeleting}
                >
                  <Text style={[styles.deleteModalCancelText, darkMode && styles.deleteModalCancelTextDark]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.deleteModalConfirm, isDeleting && styles.deleteModalConfirmDisabled]}
                  onPress={handleConfirmDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.deleteModalConfirmText}>Delete</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* USER DETAIL MODAL */}
        <Modal visible={userDetailModalVisible} transparent animationType="slide">
          <View style={[styles.modalOverlay, darkMode && styles.modalOverlayDark]}>
            <View style={[styles.modalContainer, darkMode && styles.modalContainerDark, { maxHeight: '85%', width: Platform.OS === 'web' ? 600 : '90%' }]}>
              <ScrollView showsVerticalScrollIndicator={true}>
                <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>User Details</Text>
                
                {selectedUserForDetail && (
                  <>
                    {/* User Info Section */}
                    <View style={[styles.detailSection, darkMode && styles.detailSectionDark]}>
                      <Text style={[styles.detailSectionTitle, darkMode && styles.detailSectionTitleDark]}>Profile Information</Text>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, darkMode && styles.detailLabelDark]}>Name</Text>
                        <Text style={[styles.detailValue, darkMode && styles.detailValueDark]}>{selectedUserForDetail.full_name || 'N/A'}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, darkMode && styles.detailLabelDark]}>Email</Text>
                        <Text style={[styles.detailValue, darkMode && styles.detailValueDark]}>{selectedUserForDetail.email || 'N/A'}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, darkMode && styles.detailLabelDark]}>Phone</Text>
                        <Text style={[styles.detailValue, darkMode && styles.detailValueDark]}>{selectedUserForDetail.phone || 'N/A'}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, darkMode && styles.detailLabelDark]}>Role</Text>
                        <View style={[styles.roleBadge, { backgroundColor: selectedUserForDetail.role === 'admin' ? '#C62828' : selectedUserForDetail.role === 'vendor' ? '#E65100' : '#1565C0' }]}>
                          <Text style={styles.roleText}>{selectedUserForDetail.role}</Text>
                        </View>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, darkMode && styles.detailLabelDark]}>Member Since</Text>
                        <Text style={[styles.detailValue, darkMode && styles.detailValueDark]}>
                          {selectedUserForDetail.created_at ? new Date(selectedUserForDetail.created_at).toLocaleDateString() : 'N/A'}
                        </Text>
                      </View>
                    </View>

                    {/* Stats Section */}
                    <View style={[styles.detailSection, darkMode && styles.detailSectionDark]}>
                      <Text style={[styles.detailSectionTitle, darkMode && styles.detailSectionTitleDark]}>Statistics</Text>
                      <View style={styles.statsGrid}>
                        <View style={styles.statItem}>
                          <Text style={styles.statValue}>{userDetailData.totalOrders}</Text>
                          <Text style={styles.statLabel}>Total Orders</Text>
                        </View>
                        <View style={styles.statItem}>
                          <Text style={styles.statValue}>₱{userDetailData.totalSpent.toFixed(2)}</Text>
                          <Text style={styles.statLabel}>Total Spent</Text>
                        </View>
                      </View>
                    </View>

                    {/* Recent Orders */}
                    <View style={[styles.detailSection, darkMode && styles.detailSectionDark]}>
                      <Text style={[styles.detailSectionTitle, darkMode && styles.detailSectionTitleDark]}>Recent Orders</Text>
                      {detailLoading ? (
                        <ActivityIndicator size="small" color="#C62828" style={{ padding: 20 }} />
                      ) : userDetailData.orders.length > 0 ? (
                        userDetailData.orders.map((order) => (
                          <View key={order.id} style={[styles.transactionCard, darkMode && styles.transactionCardDark]}>
                            <View style={styles.transactionHeader}>
                              <Text style={[styles.transactionId, darkMode && styles.transactionIdDark]}>
                                Order #{order.order_number?.slice(-8) || order.id.toString().slice(-8)}
                              </Text>
                              <View style={[styles.transactionStatus, { backgroundColor: order.status === 'completed' ? '#10B981' : order.status === 'cancelled' ? '#EF4444' : '#F59E0B' }]}>
                                <Text style={styles.transactionStatusText}>{order.status}</Text>
                              </View>
                            </View>
                            <Text style={[styles.transactionAmount, darkMode && styles.transactionAmountDark]}>
                              ₱{order.total_amount || 0}
                            </Text>
                            <Text style={[styles.transactionDate, darkMode && styles.transactionDateDark]}>
                              {new Date(order.created_at).toLocaleDateString()}
                            </Text>
                          </View>
                        ))
                      ) : (
                        <View style={styles.emptySection}>
                          <MaterialIcons name="shopping-cart" size={40} color="#CCCCCC" />
                          <Text style={[styles.emptySectionText, darkMode && styles.emptySectionTextDark]}>No orders yet</Text>
                        </View>
                      )}
                    </View>
                  </>
                )}

                <View style={styles.modalButtons}>
                  <TouchableOpacity style={[styles.modalCancel, darkMode && styles.modalCancelDark]} onPress={() => setUserDetailModalVisible(false)}>
                    <Text style={[styles.modalCancelText, darkMode && styles.modalCancelTextDark]}>Close</Text>
                  </TouchableOpacity>
                  {selectedUserForDetail && (
                    <TouchableOpacity style={[styles.modalSubmit, darkMode && styles.modalSubmitDark]} onPress={() => {
                      setUserDetailModalVisible(false);
                      handleEditUser(selectedUserForDetail);
                    }}>
                      <Text style={styles.modalSubmitText}>Edit User</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* VENDOR DETAIL MODAL */}
        <Modal visible={vendorDetailModalVisible} transparent animationType="slide">
          <View style={[styles.modalOverlay, darkMode && styles.modalOverlayDark]}>
            <View style={[styles.modalContainer, darkMode && styles.modalContainerDark, { maxHeight: '85%', width: Platform.OS === 'web' ? 700 : '90%' }]}>
              <ScrollView showsVerticalScrollIndicator={true}>
                <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>Vendor Details</Text>
                
                {selectedVendorForDetail && (
                  <>
                    {/* Vendor Info Section */}
                    <View style={[styles.detailSection, darkMode && styles.detailSectionDark]}>
                      <Text style={[styles.detailSectionTitle, darkMode && styles.detailSectionTitleDark]}>Vendor Information</Text>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, darkMode && styles.detailLabelDark]}>Name</Text>
                        <Text style={[styles.detailValue, darkMode && styles.detailValueDark]}>{selectedVendorForDetail.full_name || 'N/A'}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, darkMode && styles.detailLabelDark]}>Email</Text>
                        <Text style={[styles.detailValue, darkMode && styles.detailValueDark]}>{selectedVendorForDetail.email || 'N/A'}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, darkMode && styles.detailLabelDark]}>Phone</Text>
                        <Text style={[styles.detailValue, darkMode && styles.detailValueDark]}>{selectedVendorForDetail.phone || 'N/A'}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, darkMode && styles.detailLabelDark]}>Member Since</Text>
                        <Text style={[styles.detailValue, darkMode && styles.detailValueDark]}>
                          {selectedVendorForDetail.created_at ? new Date(selectedVendorForDetail.created_at).toLocaleDateString() : 'N/A'}
                        </Text>
                      </View>
                    </View>

                    {/* Stall Info Section */}
                    <View style={[styles.detailSection, darkMode && styles.detailSectionDark]}>
                      <Text style={[styles.detailSectionTitle, darkMode && styles.detailSectionTitleDark]}>Stall Information</Text>
                      {vendorDetailData.stall ? (
                        <>
                          <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, darkMode && styles.detailLabelDark]}>Stall Name</Text>
                            <Text style={[styles.detailValue, darkMode && styles.detailValueDark]}>{vendorDetailData.stall.stall_name || 'N/A'}</Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, darkMode && styles.detailLabelDark]}>Stall Number</Text>
                            <Text style={[styles.detailValue, darkMode && styles.detailValueDark]}>#{vendorDetailData.stall.stall_number || 'N/A'}</Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, darkMode && styles.detailLabelDark]}>Section</Text>
                            <Text style={[styles.detailValue, darkMode && styles.detailValueDark]}>{vendorDetailData.stall.section || 'N/A'}</Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, darkMode && styles.detailLabelDark]}>Status</Text>
                            <View style={[styles.statusBadge, vendorDetailData.stall.is_active ? styles.activeBadge : styles.inactiveBadge]}>
                              <Text style={styles.statusText}>{vendorDetailData.stall.is_active ? 'Active' : 'Inactive'}</Text>
                            </View>
                          </View>
                        </>
                      ) : (
                        <View style={styles.emptySection}>
                          <MaterialIcons name="storefront" size={40} color="#CCCCCC" />
                          <Text style={[styles.emptySectionText, darkMode && styles.emptySectionTextDark]}>No stall assigned</Text>
                        </View>
                      )}
                    </View>

                    {/* Stats Section */}
                    <View style={[styles.detailSection, darkMode && styles.detailSectionDark]}>
                      <Text style={[styles.detailSectionTitle, darkMode && styles.detailSectionTitleDark]}>Business Statistics</Text>
                      <View style={styles.statsGrid}>
                        <View style={styles.statItem}>
                          <Text style={styles.statValue}>{vendorDetailData.totalProducts}</Text>
                          <Text style={styles.statLabel}>Products</Text>
                        </View>
                        <View style={styles.statItem}>
                          <Text style={styles.statValue}>{vendorDetailData.totalOrders}</Text>
                          <Text style={styles.statLabel}>Orders</Text>
                        </View>
                        <View style={styles.statItem}>
                          <Text style={styles.statValue}>₱{vendorDetailData.totalRevenue.toFixed(2)}</Text>
                          <Text style={styles.statLabel}>Revenue</Text>
                        </View>
                      </View>
                    </View>

                    {/* Recent Products */}
                    {vendorDetailData.products.length > 0 && (
                      <View style={[styles.detailSection, darkMode && styles.detailSectionDark]}>
                        <Text style={[styles.detailSectionTitle, darkMode && styles.detailSectionTitleDark]}>Recent Products</Text>
                        {vendorDetailData.products.map((product) => (
                          <View key={product.id} style={[styles.transactionCard, darkMode && styles.transactionCardDark]}>
                            <View style={styles.transactionHeader}>
                              <Text style={[styles.transactionId, darkMode && styles.transactionIdDark]}>{product.name}</Text>
                              <View style={[styles.statusBadge, product.is_available ? styles.activeBadge : styles.inactiveBadge]}>
                                <Text style={styles.statusText}>{product.is_available ? 'Available' : 'Unavailable'}</Text>
                              </View>
                            </View>
                            <Text style={[styles.transactionAmount, darkMode && styles.transactionAmountDark]}>₱{product.price || 0}</Text>
                            <Text style={[styles.transactionDate, darkMode && styles.transactionDateDark]}>
                              Stock: {product.stock_quantity || 0} • {product.category || 'Uncategorized'}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Recent Orders */}
                    {vendorDetailData.orders.length > 0 && (
                      <View style={[styles.detailSection, darkMode && styles.detailSectionDark]}>
                        <Text style={[styles.detailSectionTitle, darkMode && styles.detailSectionTitleDark]}>Recent Orders</Text>
                        {vendorDetailData.orders.map((order) => (
                          <View key={order.id} style={[styles.transactionCard, darkMode && styles.transactionCardDark]}>
                            <View style={styles.transactionHeader}>
                              <Text style={[styles.transactionId, darkMode && styles.transactionIdDark]}>
                                Order #{order.order_number?.slice(-8) || order.id.toString().slice(-8)}
                              </Text>
                              <View style={[styles.transactionStatus, { backgroundColor: order.status === 'completed' ? '#10B981' : order.status === 'cancelled' ? '#EF4444' : '#F59E0B' }]}>
                                <Text style={styles.transactionStatusText}>{order.status}</Text>
                              </View>
                            </View>
                            <Text style={[styles.transactionAmount, darkMode && styles.transactionAmountDark]}>
                              ₱{order.total_amount || 0}
                            </Text>
                            <Text style={[styles.transactionDate, darkMode && styles.transactionDateDark]}>
                              {new Date(order.created_at).toLocaleDateString()}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </>
                )}

                <View style={styles.modalButtons}>
                  <TouchableOpacity style={[styles.modalCancel, darkMode && styles.modalCancelDark]} onPress={() => setVendorDetailModalVisible(false)}>
                    <Text style={[styles.modalCancelText, darkMode && styles.modalCancelTextDark]}>Close</Text>
                  </TouchableOpacity>
                  {selectedVendorForDetail && (
                    <TouchableOpacity style={[styles.modalSubmit, darkMode && styles.modalSubmitDark]} onPress={() => {
                      setVendorDetailModalVisible(false);
                      handleEditUser(selectedVendorForDetail);
                    }}>
                      <Text style={styles.modalSubmitText}>Edit Vendor</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* REPORT MODAL */}
        <Modal visible={reportModalVisible} transparent animationType="slide">
          <View style={[styles.modalOverlay, darkMode && styles.modalOverlayDark]}>
            <View style={[styles.modalContainer, darkMode && styles.modalContainerDark, { maxHeight: '85%' }]}>
              <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>
                Generate Report
              </Text>
              
              <View style={styles.reportForm}>
                <View style={styles.reportFormGroup}>
                  <Text style={[styles.reportFormLabel, darkMode && styles.reportFormLabelDark]}>Report Type</Text>
                  <View style={styles.reportTypeSelector}>
                    {['stalls', 'products', 'orders', 'vendors', 'users', 'applications', 'recent_activity'].map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.reportTypeOption,
                          reportType === type && styles.reportTypeOptionActive,
                          darkMode && styles.reportTypeOptionDark,
                        ]}
                        onPress={() => {
                          setReportType(type);
                          setDateError('');
                        }}
                      >
                        <Text style={[
                          styles.reportTypeText,
                          reportType === type && styles.reportTypeTextActive,
                          darkMode && styles.reportTypeTextDark,
                        ]}>
                          {type === 'recent_activity' ? 'Recent Activity' : 
                           type.charAt(0).toUpperCase() + type.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.reportFormGroup}>
                  <Text style={[styles.reportFormLabel, darkMode && styles.reportFormLabelDark]}>Date Range</Text>
                  <View style={styles.dateRangeSelector}>
                    {['all', 'today', 'week', 'month', 'custom'].map((range) => (
                      <TouchableOpacity
                        key={range}
                        style={[
                          styles.dateRangeOption,
                          reportDateRange === range && styles.dateRangeOptionActive,
                          darkMode && styles.dateRangeOptionDark,
                        ]}
                        onPress={() => {
                          setReportDateRange(range);
                          setDateError('');
                        }}
                      >
                        <Text style={[
                          styles.dateRangeText,
                          reportDateRange === range && styles.dateRangeTextActive,
                          darkMode && styles.dateRangeTextDark,
                        ]}>
                          {range === 'all' ? 'All Time' : 
                           range === 'today' ? 'Today' :
                           range === 'week' ? 'This Week' :
                           range === 'month' ? 'This Month' : 'Custom'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  
                  {reportDateRange === 'custom' && (
                    <View style={styles.customDateRange}>
                      <View style={styles.dateInputGroup}>
                        <Text style={[styles.dateInputLabel, darkMode && styles.dateInputLabelDark]}>Start Date</Text>
                        <TextInput
                          style={[styles.dateInput, darkMode && styles.dateInputDark]}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor={darkMode ? '#666' : '#999'}
                          value={reportStartDate}
                          onChangeText={(text) => {
                            setReportStartDate(text);
                            setDateError('');
                          }}
                        />
                      </View>
                      <View style={styles.dateInputGroup}>
                        <Text style={[styles.dateInputLabel, darkMode && styles.dateInputLabelDark]}>End Date</Text>
                        <TextInput
                          style={[styles.dateInput, darkMode && styles.dateInputDark]}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor={darkMode ? '#666' : '#999'}
                          value={reportEndDate}
                          onChangeText={(text) => {
                            setReportEndDate(text);
                            setDateError('');
                          }}
                        />
                      </View>
                    </View>
                  )}
                  
                  {dateError ? (
                    <Text style={styles.dateErrorText}>{dateError}</Text>
                  ) : null}
                </View>

                <View style={styles.reportFormGroup}>
                  <Text style={[styles.reportFormLabel, darkMode && styles.reportFormLabelDark]}>Export Format</Text>
                  <View style={styles.formatSelector}>
                    {['csv', 'pdf'].map((format) => (
                      <TouchableOpacity
                        key={format}
                        style={[
                          styles.formatOption,
                          reportFormat === format && styles.formatOptionActive,
                          darkMode && styles.formatOptionDark,
                        ]}
                        onPress={() => setReportFormat(format)}
                      >
                        <Text style={[
                          styles.formatText,
                          reportFormat === format && styles.formatTextActive,
                          darkMode && styles.formatTextDark,
                        ]}>
                          {format.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {reportData.length > 0 && (
                  <View style={styles.reportPreview}>
                    <Text style={[styles.reportPreviewTitle, darkMode && styles.reportPreviewTitleDark]}>
                      Preview ({reportData.length} records)
                    </Text>
                    <ScrollView style={styles.reportPreviewTable} horizontal>
                      <View>
                        <View style={styles.reportPreviewHeader}>
                          {Object.keys(reportData[0]).map((key) => (
                            <Text key={key} style={[styles.reportPreviewHeaderText, { minWidth: 100 }]}>
                              {key}
                            </Text>
                          ))}
                        </View>
                        {reportData.slice(0, 5).map((row, index) => (
                          <View key={index} style={styles.reportPreviewRow}>
                            {Object.values(row).map((value, i) => (
                              <Text key={i} style={[styles.reportPreviewCell, { minWidth: 100 }]} numberOfLines={1}>
                                {String(value)}
                              </Text>
                            ))}
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                )}

                {reportError && (
                  <View style={styles.reportError}>
                    <MaterialIcons name="error" size={16} color="#C62828" />
                    <Text style={styles.reportErrorText}> {reportError}</Text>
                  </View>
                )}
              </View>

              <View style={styles.reportModalButtons}>
                <TouchableOpacity 
                  style={[styles.modalCancel, darkMode && styles.modalCancelDark]} 
                  onPress={() => {
                    setReportModalVisible(false);
                    setReportError(null);
                    setDateError('');
                  }}
                >
                  <Text style={[styles.modalCancelText, darkMode && styles.modalCancelTextDark]}>Close</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.reportPreviewButton]} 
                  onPress={generateReport}
                  disabled={isGeneratingReport}
                >
                  <Text style={styles.reportPreviewButtonText}>
                    {isGeneratingReport ? 'Generating...' : 'Generate Report'}
                  </Text>
                </TouchableOpacity>

                {reportData.length > 0 && reportFormat === 'csv' && (
                  <TouchableOpacity style={[styles.modalSubmit, styles.reportDownloadButton]} onPress={downloadCSV}>
                    <MaterialIcons name="download" size={18} color="#FFFFFF" />
                    <Text style={styles.modalSubmitText}> Download CSV</Text>
                  </TouchableOpacity>
                )}

                {reportData.length > 0 && reportFormat === 'pdf' && (
                  <TouchableOpacity style={[styles.modalSubmit, styles.reportDownloadButton]} onPress={downloadPDF}>
                    <MaterialIcons name="picture-as-pdf" size={18} color="#FFFFFF" />
                    <Text style={styles.modalSubmitText}> Download PDF</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </DashboardBackground>
  );
}

// ============================================================
// STYLES - PalengkeHub Red & White Theme
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  containerDark: {
    backgroundColor: '#121212',
  },

  // Background
  bgContainer: {
    flex: 1,
  },
  bgContainerDark: {},
  fullScreenBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.88)',
  },
  overlayDark: {
    backgroundColor: 'rgba(10,10,10,0.92)',
  },

  // Sidebar - Red Theme
  sidebar: {
    width: 240,
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    height: '100%',
    zIndex: 100,
    backgroundColor: '#C62828',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  sidebarCollapsed: {
    width: 60,
  },
  sidebarDark: {
    backgroundColor: '#1a1a1a',
  },
  sidebarGradient: {
    flex: 1,
    paddingVertical: 20,
  },

  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  logoContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  logoIconText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#C62828',
    letterSpacing: -0.5,
  },
  logoIconSmall: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoIconTextSmall: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C62828',
    letterSpacing: -0.5,
  },
  logoTextWrapper: {
    flex: 1,
  },
  logoText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  logoTextDark: {
    color: '#FFFFFF',
  },
  logoSubText: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.2,
    marginTop: 1,
  },
  logoSubTextDark: {
    color: 'rgba(255,255,255,0.5)',
  },
  collapseButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  navScroll: {
    flex: 1,
    marginTop: 8,
  },
  navContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 2,
  },
  navItemActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  navItemHover: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  navItemDark: {},
  navItemActiveDark: {
    backgroundColor: 'rgba(198,40,40,0.3)',
  },
  navItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: -0.2,
    flex: 1,
  },
  navLabelActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  navLabelDark: {
    color: 'rgba(255,255,255,0.7)',
  },
  navLabelActiveDark: {
    color: '#FFFFFF',
  },
  navIndicator: {
    width: 3,
    height: 20,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  navIndicatorDark: {
    backgroundColor: '#C62828',
  },

  userSection: {
    paddingHorizontal: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  userSectionDark: {
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  userCardDark: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarDark: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  userAvatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  userAvatarTextDark: {
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  userNameDark: {
    color: '#FFFFFF',
  },
  userEmail: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 1,
  },
  userEmailDark: {
    color: 'rgba(255,255,255,0.4)',
  },
  logoutButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutButtonDark: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },

  darkModeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  darkModeToggleDark: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  darkModeLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  darkModeLabelDark: {
    color: 'rgba(255,255,255,0.5)',
  },

  // Main Content
  mainContent: {
    flex: 1,
    marginLeft: Platform.OS === 'web' ? 240 : 0,
    backgroundColor: '#f5f5f5',
  },
  mainContentExpanded: {
    marginLeft: Platform.OS === 'web' ? 60 : 0,
  },
  mainContentDark: {
    backgroundColor: '#121212',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 2,
  },
  headerDark: {
    backgroundColor: '#1a1a1a',
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuButtonDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    letterSpacing: -0.3,
  },
  headerTitleDark: {
    color: '#FFFFFF',
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  searchButtonDark: {
    backgroundColor: '#2a2a2a',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  searchButtonText: {
    fontSize: 13,
    color: '#666666',
    fontWeight: '500',
  },
  searchButtonTextDark: {
    color: '#888888',
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshButtonDark: {
    backgroundColor: '#2a2a2a',
  },

  content: {
    flex: 1,
  },
  contentDark: {},
  contentContainer: {
    padding: 24,
    paddingBottom: 40,
    flexGrow: 1,
  },

  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666666',
  },
  loadingTextDark: {
    color: '#888888',
  },

  // Page Filter Dropdown
  pageFilterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
    position: 'relative',
    zIndex: 10,
  },
  pageFilterContainerDark: {
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  pageFilterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    minHeight: 44,
  },
  pageFilterHeaderDark: {
    backgroundColor: '#2a2a2a',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  pageFilterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  pageFilterIcon: {
    marginRight: 4,
  },
  pageFilterLabel: {
    fontSize: 13,
    color: '#666666',
    fontWeight: '500',
  },
  pageFilterLabelDark: {
    color: '#888888',
  },
  pageFilterSelected: {
    fontSize: 13,
    color: '#1a1a1a',
    fontWeight: '600',
    flex: 1,
  },
  pageFilterSelectedDark: {
    color: '#FFFFFF',
  },
  pageFilterOptions: {
    position: 'absolute',
    top: '100%',
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    zIndex: 20,
    maxHeight: 200,
    marginTop: 4,
  },
  pageFilterOptionsDark: {
    backgroundColor: '#1a1a1a',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  pageFilterScroll: {
    maxHeight: 200,
  },
  pageFilterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
  },
  pageFilterOptionDark: {
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  pageFilterOptionActive: {
    backgroundColor: 'rgba(198,40,40,0.05)',
  },
  pageFilterOptionText: {
    fontSize: 13,
    color: '#1a1a1a',
    flex: 1,
  },
  pageFilterOptionTextDark: {
    color: '#FFFFFF',
  },
  pageFilterOptionTextActive: {
    color: '#C62828',
    fontWeight: '500',
  },

  // Dashboard Overview
  overviewContainer: {
    paddingBottom: 20,
  },
  
  welcomeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  welcomeHeaderDark: {
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.3,
  },
  welcomeTitleDark: {
    color: '#FFFFFF',
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  welcomeSubtitleDark: {
    color: '#888888',
  },
  welcomeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  welcomeBadgeDark: {
    backgroundColor: '#2a2a2a',
    borderColor: 'rgba(255,255,255,0.04)',
  },
  welcomeBadgeText: {
    fontSize: 13,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  welcomeBadgeTextDark: {
    color: '#FFFFFF',
  },

  // Stats Cards
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: isWeb ? '15%' : isTablet ? '30%' : '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  statCardDark: {
    backgroundColor: '#1a1a1a',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statCardHeader: {
    marginBottom: 8,
  },
  statCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statCardValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  statCardValueDark: {
    color: '#FFFFFF',
  },
  statCardTitle: {
    fontSize: 13,
    color: '#666666',
    marginTop: 2,
  },
  statCardTitleDark: {
    color: '#888888',
  },

  // Section
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  sectionTitleDark: {
    color: '#FFFFFF',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#666666',
  },
  sectionSubtitleDark: {
    color: '#888888',
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#C62828',
  },

  // Priority Rows
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderLeftWidth: 4,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  priorityRowDark: {
    backgroundColor: '#1a1a1a',
    borderColor: 'rgba(255,255,255,0.04)',
  },
  priorityRowHover: {
    backgroundColor: '#f8f9fa',
    shadowColor: 'rgba(0,0,0,0.05)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  priorityContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flex: 1,
  },
  priorityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priorityIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  priorityLabel: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  priorityLabelDark: {
    color: '#FFFFFF',
  },
  priorityCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  priorityAction: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  priorityActionText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Recent Activity
  activityContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    padding: 4,
  },
  activityContainerDark: {
    backgroundColor: '#1a1a1a',
    borderColor: 'rgba(255,255,255,0.04)',
  },
  activityRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
    alignItems: 'center',
  },
  activityRowDark: {
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  activityRowHover: {
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  activityDot: {
    marginRight: 12,
  },
  activityDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C62828',
    opacity: 0.3,
  },
  activityDotActive: {
    opacity: 1,
  },
  activityContent: {
    flex: 1,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  activityUser: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  activityUserDark: {
    color: '#FFFFFF',
  },
  activityTime: {
    fontSize: 11,
    color: '#888888',
  },
  activityTimeDark: {
    color: '#666666',
  },
  activityAction: {
    fontSize: 13,
    color: '#4a4a4a',
  },
  activityActionDark: {
    color: '#aaaaaa',
  },
  activityStatus: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  statusPending: {
    backgroundColor: 'rgba(230,81,0,0.12)',
  },
  statusCompleted: {
    backgroundColor: 'rgba(46,125,50,0.12)',
  },
  activityStatusText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  activityDeleteButton: {
    padding: 6,
    marginLeft: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(211,47,47,0.08)',
  },

  emptyState: {
    padding: 30,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
  },
  emptyStateTextDark: {
    color: '#888888',
  },
  emptyText: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
  },
  emptyTextDark: {
    color: '#888888',
  },

  overviewFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
  },
  overviewFooterDark: {
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  overviewFooterText: {
    fontSize: 11,
    color: '#888888',
  },
  overviewFooterTextDark: {
    color: '#666666',
  },
  overviewFooterVersion: {
    fontSize: 11,
    color: '#888888',
  },
  overviewFooterVersionDark: {
    color: '#666666',
  },

  // Tables
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  tableCardDark: {
    backgroundColor: '#1a1a1a',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  tableHeaderDark: {
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  tableTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    letterSpacing: -0.2,
  },
  tableTitleDark: {
    color: '#FFFFFF',
  },
  tableSubtitle: {
    fontSize: 13,
    color: '#888888',
    marginTop: 2,
  },
  tableSubtitleDark: {
    color: '#666666',
  },
  tableCount: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
  },

  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
    gap: 12,
  },
  tableRowDark: {
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  tableCell: {
    fontSize: 14,
    color: '#1a1a1a',
    flex: 1,
  },
  tableCellDark: {
    color: '#FFFFFF',
  },

  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  activeBadge: {
    backgroundColor: '#E8F5E9',
  },
  inactiveBadge: {
    backgroundColor: '#FFEBEE',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#1a1a1a',
  },

  actionButtonSmall: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activateButton: {
    backgroundColor: '#2E7D32',
  },
  deactivateButton: {
    backgroundColor: '#C62828',
  },
  actionButtonText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '500',
  },

  statusFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
    gap: 8,
  },
  statusFilterRowDark: {
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  statusFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  statusFilterChipActive: {
    backgroundColor: '#C62828',
  },
  statusFilterText: {
    fontSize: 11,
    color: '#666666',
    fontWeight: '500',
  },
  statusFilterTextActive: {
    color: '#FFFFFF',
  },

  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  userInfoCell: {
    flex: 2,
  },
  tableCellSub: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },
  tableCellSubDark: {
    color: '#666666',
  },

  vendorStallInfo: {
    flex: 1.5,
    alignItems: 'center',
  },
  tableCellSmall: {
    fontSize: 12,
    color: '#1a1a1a',
  },
  tableCellSmallDark: {
    color: '#FFFFFF',
  },

  productInfoCell: {
    flex: 2,
  },

  actionButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  editButtonSmall: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(21,101,192,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonSmall: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(198,40,40,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  appCard: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
  },
  appCardDark: {
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  appName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  appNameDark: {
    color: '#FFFFFF',
  },
  pendingBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  pendingText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#E65100',
  },
  appText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  appTextDark: {
    color: '#888888',
  },
  appActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  approveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E7D32',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
  },
  approveText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 14,
  },
  rejectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C62828',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
  },
  rejectText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 14,
  },

  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C62828',
    margin: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonDark: {
    backgroundColor: '#C62828',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 14,
  },

  announcementCard: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
  },
  announcementCardDark: {
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  announcementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  announcementTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  announcementTitleDark: {
    color: '#FFFFFF',
  },
  announcementContent: {
    fontSize: 14,
    color: '#1a1a1a',
    marginBottom: 8,
  },
  announcementContentDark: {
    color: '#FFFFFF',
  },
  announcementDate: {
    fontSize: 12,
    color: '#888888',
  },
  announcementDateDark: {
    color: '#666666',
  },

  violationCard: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
    backgroundColor: 'rgba(230,81,0,0.04)',
  },
  violationCardDark: {
    backgroundColor: 'rgba(230,81,0,0.02)',
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  violationVendor: {
    fontSize: 15,
    fontWeight: '500',
    color: '#E65100',
  },
  violationVendorDark: {
    color: '#E65100',
  },
  violationReason: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  violationReasonDark: {
    color: '#aaaaaa',
  },
  violationDate: {
    fontSize: 12,
    color: '#888888',
    marginTop: 4,
  },
  violationDateDark: {
    color: '#666666',
  },
  violationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  complaintCard: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
    backgroundColor: 'rgba(198,40,40,0.04)',
  },
  complaintCardDark: {
    backgroundColor: 'rgba(198,40,40,0.02)',
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  complaintTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#C62828',
  },
  complaintTitleDark: {
    color: '#EF5350',
  },
  complaintAbout: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  complaintAboutDark: {
    color: '#aaaaaa',
  },
  complaintMessage: {
    fontSize: 14,
    color: '#4a4a4a',
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 8,
  },
  complaintMessageDark: {
    color: '#aaaaaa',
  },
  complaintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  complaintActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resolveButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  resolveButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '500',
  },

  // Reports
  reportsContainer: {
    padding: 16,
    gap: 12,
  },
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    gap: 12,
  },
  reportCardDark: {
    backgroundColor: '#2a2a2a',
    borderColor: 'rgba(255,255,255,0.04)',
  },
  reportCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(198,40,40,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportCardContent: {
    flex: 1,
  },
  reportCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  reportCardTitleDark: {
    color: '#FFFFFF',
  },
  reportCardSubtitle: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  reportCardSubtitleDark: {
    color: '#888888',
  },
  reportGenerateButton: {
    backgroundColor: '#C62828',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  reportGenerateButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 12,
  },

  // Report Modal
  reportForm: {
    marginBottom: 16,
  },
  reportFormGroup: {
    marginBottom: 16,
  },
  reportFormLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  reportFormLabelDark: {
    color: '#FFFFFF',
  },
  reportTypeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  reportTypeOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  reportTypeOptionDark: {
    backgroundColor: '#2a2a2a',
    borderColor: 'rgba(255,255,255,0.04)',
  },
  reportTypeOptionActive: {
    backgroundColor: '#C62828',
    borderColor: '#C62828',
  },
  reportTypeText: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
  },
  reportTypeTextDark: {
    color: '#888888',
  },
  reportTypeTextActive: {
    color: '#FFFFFF',
  },

  dateRangeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dateRangeOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  dateRangeOptionDark: {
    backgroundColor: '#2a2a2a',
    borderColor: 'rgba(255,255,255,0.04)',
  },
  dateRangeOptionActive: {
    backgroundColor: '#C62828',
    borderColor: '#C62828',
  },
  dateRangeText: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
  },
  dateRangeTextDark: {
    color: '#888888',
  },
  dateRangeTextActive: {
    color: '#FFFFFF',
  },

  customDateRange: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  dateInputGroup: {
    flex: 1,
  },
  dateInputLabel: {
    fontSize: 11,
    color: '#666666',
    marginBottom: 4,
  },
  dateInputLabelDark: {
    color: '#888888',
  },
  dateInput: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 6,
    padding: 8,
    fontSize: 13,
    color: '#1a1a1a',
    backgroundColor: '#f9fafb',
  },
  dateInputDark: {
    borderColor: 'rgba(255,255,255,0.08)',
    color: '#FFFFFF',
    backgroundColor: '#2a2a2a',
  },
  dateErrorText: {
    fontSize: 12,
    color: '#C62828',
    marginTop: 6,
  },

  formatSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  formatOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  formatOptionDark: {
    backgroundColor: '#2a2a2a',
    borderColor: 'rgba(255,255,255,0.04)',
  },
  formatOptionActive: {
    backgroundColor: '#C62828',
    borderColor: '#C62828',
  },
  formatText: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
  },
  formatTextDark: {
    color: '#888888',
  },
  formatTextActive: {
    color: '#FFFFFF',
  },

  reportPreview: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f9fafb',
  },
  reportPreviewTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  reportPreviewTitleDark: {
    color: '#FFFFFF',
  },
  reportPreviewTable: {
    maxHeight: 200,
  },
  reportPreviewHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  reportPreviewHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1a1a1a',
    paddingHorizontal: 4,
  },
  reportPreviewRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
  },
  reportPreviewCell: {
    fontSize: 11,
    color: '#4a4a4a',
    paddingHorizontal: 4,
  },

  reportError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(198,40,40,0.08)',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  reportErrorText: {
    color: '#C62828',
    fontSize: 13,
  },

  reportModalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  reportPreviewButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#C62828',
    borderRadius: 6,
  },
  reportPreviewButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 14,
  },
  reportDownloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },

  // Search Modal
  searchOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-start',
    paddingTop: 60,
    alignItems: 'center',
  },
  searchOverlayDark: {
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  searchContainer: {
    width: Platform.OS === 'web' ? 600 : '90%',
    maxHeight: 500,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 10,
    overflow: 'hidden',
  },
  searchContainerDark: {
    backgroundColor: '#1a1a1a',
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
    gap: 12,
    backgroundColor: '#FFFFFF',
    zIndex: 10,
  },
  searchHeaderDark: {
    backgroundColor: '#1a1a1a',
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
    padding: 0,
    outline: 'none',
    minHeight: 30,
  },
  searchInputDark: {
    color: '#FFFFFF',
  },
  searchClearButton: {
    padding: 4,
    marginRight: 4,
  },
  searchCloseButton: {
    padding: 4,
  },
  searchResultsList: {
    maxHeight: 400,
    backgroundColor: '#FFFFFF',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
    backgroundColor: '#FFFFFF',
  },
  searchResultItemTop: {
    backgroundColor: 'rgba(198,40,40,0.03)',
  },
  searchResultItemDark: {
    backgroundColor: '#1a1a1a',
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  searchResultContent: {
    flex: 1,
    marginRight: 8,
  },
  searchResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  searchResultIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(198,40,40,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  searchResultType: {
    fontSize: 10,
    fontWeight: '600',
    color: '#C62828',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  searchResultExactBadge: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 4,
  },
  searchResultExactText: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  searchResultMatchBadge: {
    backgroundColor: 'rgba(198,40,40,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 4,
  },
  searchResultMatchText: {
    fontSize: 9,
    color: '#C62828',
    fontWeight: '600',
  },
  searchResultBestBadge: {
    backgroundColor: '#C62828',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 4,
  },
  searchResultBestText: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  searchResultText: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  searchResultSubtext: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },
  searchResultScoreBar: {
    height: 2,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 1,
    marginTop: 4,
    overflow: 'hidden',
    width: '100%',
  },
  searchResultScoreFill: {
    height: '100%',
    backgroundColor: '#C62828',
    borderRadius: 1,
  },
  searchEmptyState: {
    padding: 40,
    alignItems: 'center',
  },
  searchEmptyText: {
    fontSize: 14,
    color: '#666666',
    marginTop: 12,
  },
  searchEmptyTextDark: {
    color: '#888888',
  },
  searchEmptySubtext: {
    fontSize: 12,
    color: '#999999',
    marginTop: 4,
  },
  searchEmptySubtextDark: {
    color: '#666666',
  },

  // Delete Modal
  deleteModalContainer: {
    width: Platform.OS === 'web' ? 400 : '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 10,
  },
  deleteModalContainerDark: {
    backgroundColor: '#1a1a1a',
  },
  deleteModalIconContainer: {
    marginBottom: 16,
  },
  deleteModalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  deleteModalTitleDark: {
    color: '#FFFFFF',
  },
  deleteModalMessage: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  deleteModalMessageDark: {
    color: '#aaaaaa',
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  deleteModalCancel: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  deleteModalCancelDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#3a3a3a',
  },
  deleteModalCancelText: {
    color: '#4a4a4a',
    fontWeight: '500',
    fontSize: 14,
  },
  deleteModalCancelTextDark: {
    color: '#aaaaaa',
  },
  deleteModalConfirm: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#C62828',
    alignItems: 'center',
  },
  deleteModalConfirmDisabled: {
    opacity: 0.6,
  },
  deleteModalConfirmText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlayDark: {
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContainer: {
    width: Platform.OS === 'web' ? 450 : '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 10,
  },
  modalContainerDark: {
    backgroundColor: '#1a1a1a',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#C62828',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  modalTitleDark: {
    color: '#FFFFFF',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalSubtitleDark: {
    color: '#888888',
  },
  modalText: {
    fontSize: 14,
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalTextDark: {
    color: '#FFFFFF',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1a1a1a',
    marginBottom: 12,
    backgroundColor: '#f9fafb',
  },
  modalInputDark: {
    borderColor: 'rgba(255,255,255,0.08)',
    color: '#FFFFFF',
    backgroundColor: '#2a2a2a',
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  modalLabelDark: {
    color: '#FFFFFF',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  audienceSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  audienceOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  audienceOptionActive: {
    backgroundColor: '#C62828',
    borderColor: '#C62828',
  },
  audienceOptionText: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
  },
  audienceOptionTextActive: {
    color: '#FFFFFF',
  },
  durationSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  durationOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  durationOptionActive: {
    backgroundColor: '#C62828',
    borderColor: '#C62828',
  },
  durationOptionText: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
  },
  durationOptionTextActive: {
    color: '#FFFFFF',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  modalCancel: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
  },
  modalCancelDark: {
    backgroundColor: '#2a2a2a',
  },
  modalCancelText: {
    color: '#666666',
    fontWeight: '500',
    fontSize: 14,
  },
  modalCancelTextDark: {
    color: '#888888',
  },
  modalSubmit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#C62828',
    borderRadius: 6,
    gap: 4,
  },
  modalSubmitDark: {
    backgroundColor: '#C62828',
  },
  modalSubmitText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 14,
  },
  warningSubmit: {
    backgroundColor: '#E65100',
  },

  roleSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  roleOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  roleOptionActive: {
    backgroundColor: '#C62828',
    borderColor: '#C62828',
  },
  roleOptionText: {
    fontSize: 13,
    color: '#666666',
    fontWeight: '500',
  },
  roleOptionTextActive: {
    color: '#FFFFFF',
  },

  // Chat Styles
  chatBubble: {
    padding: 10,
    marginVertical: 4,
    marginHorizontal: 12,
    borderRadius: 10,
    maxWidth: '80%',
  },
  chatBubbleAdmin: {
    alignSelf: 'flex-end',
    backgroundColor: '#C62828',
  },
  chatBubbleOther: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0F0F0',
  },
  chatSender: {
    fontSize: 10,
    fontWeight: '600',
    color: '#999',
    marginBottom: 2,
  },
  chatMessageText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  chatTime: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
    textAlign: 'right',
  },
  chatInputRow: {
    flexDirection: 'row',
    padding: 10,
    gap: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  chatSendBtn: {
    backgroundColor: '#C62828',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  chatSendBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },

  // Logout Modal
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutModalContainer: {
    width: Platform.OS === 'web' ? 400 : '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 10,
  },
  logoutModalContainerDark: {
    backgroundColor: '#1a1a1a',
  },
  logoutModalHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  logoutModalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(198,40,40,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoutModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  logoutModalTitleDark: {
    color: '#FFFFFF',
  },
  logoutModalMessage: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  logoutModalMessageDark: {
    color: '#aaaaaa',
  },
  logoutModalButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  logoutModalCancel: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  logoutModalCancelDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#3a3a3a',
  },
  logoutModalCancelText: {
    color: '#4a4a4a',
    fontWeight: '500',
    fontSize: 14,
  },
  logoutModalCancelTextDark: {
    color: '#aaaaaa',
  },
  logoutModalConfirm: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#C62828',
    minWidth: 80,
    alignItems: 'center',
  },
  logoutModalConfirmDisabled: {
    opacity: 0.6,
  },
  logoutModalConfirmText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});