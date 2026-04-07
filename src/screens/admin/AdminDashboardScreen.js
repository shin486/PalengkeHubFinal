// src/screens/admin/AdminDashboardScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import { Header } from '../../components/Header';

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isTablet = width >= 768;
const isDesktop = width >= 1024;

export default function AdminDashboardScreen({ navigation }) {
  const { user, profile, logout } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalVendors: 0,
    totalConsumers: 0,
    pendingApplications: 0,
    totalStalls: 0,
    totalOrders: 0,
    totalSales: 0,
  });

  const fetchStats = async () => {
    try {
      const [usersCount, vendorsCount, consumersCount, pendingApps, stallsCount, ordersCount, salesData] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'vendor'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'consumer'),
        supabase.from('vendor_applications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('stalls').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('total_amount').eq('status', 'completed'),
      ]);

      const totalSales = salesData.data?.reduce((sum, o) => sum + o.total_amount, 0) || 0;

      setStats({
        totalUsers: usersCount.count || 0,
        totalVendors: vendorsCount.count || 0,
        totalConsumers: consumersCount.count || 0,
        pendingApplications: pendingApps.count || 0,
        totalStalls: stallsCount.count || 0,
        totalOrders: ordersCount.count || 0,
        totalSales: totalSales,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            const result = await logout();
            if (result.success) {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } else {
              Alert.alert('Error', result.error);
            }
          }
        }
      ]
    );
  };

  // Responsive layout: 2 columns on tablet, 3-4 columns on desktop
  const getStatCardWidth = () => {
    if (isDesktop) return '23%';
    if (isTablet) return '31%';
    return '31%';
  };

  // Responsive: side-by-side sections on desktop
  const renderManagementGrid = () => {
    if (isDesktop) {
      return (
        <View style={styles.desktopGrid}>
          <View style={styles.gridColumn}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>User Management</Text>
              <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('AdminVendorApplications')}>
                <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.actionGradient}>
                  <Text style={styles.actionText}>📋 Vendor Applications ({stats.pendingApplications})</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('AdminUsers')}>
                <LinearGradient colors={['#8B5CF6', '#7C3AED']} style={styles.actionGradient}>
                  <Text style={styles.actionText}>👥 Manage Users</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.gridColumn}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Market Management</Text>
              <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('AdminStallsManagement')}>
                <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.actionGradient}>
                  <Text style={styles.actionText}>🏪 Manage Stalls</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('AdminCategories')}>
                <LinearGradient colors={['#10B981', '#059669']} style={styles.actionGradient}>
                  <Text style={styles.actionText}>📂 Manage Categories</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.gridColumn}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Reports & Analytics</Text>
              <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('AdminReports')}>
                <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.actionGradient}>
                  <Text style={styles.actionText}>📊 Sales Reports</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('AdminUserReports')}>
                <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.actionGradient}>
                  <Text style={styles.actionText}>👥 User Activity</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.gridColumn}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>System</Text>
              <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('AdminAnnouncements')}>
                <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.actionGradient}>
                  <Text style={styles.actionText}>📢 Announcements</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('AdminSettings')}>
                <LinearGradient colors={['#6B7280', '#4B5563']} style={styles.actionGradient}>
                  <Text style={styles.actionText}>⚙️ Settings</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    // Mobile layout (stacked)
    return (
      <>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>User Management</Text>
          <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('AdminVendorApplications')}>
            <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.actionGradient}>
              <Text style={styles.actionText}>📋 Vendor Applications ({stats.pendingApplications})</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('AdminUsers')}>
            <LinearGradient colors={['#8B5CF6', '#7C3AED']} style={styles.actionGradient}>
              <Text style={styles.actionText}>👥 Manage Users</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Market Management</Text>
          <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('AdminStallsManagement')}>
            <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.actionGradient}>
              <Text style={styles.actionText}>🏪 Manage Stalls</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('AdminCategories')}>
            <LinearGradient colors={['#10B981', '#059669']} style={styles.actionGradient}>
              <Text style={styles.actionText}>📂 Manage Categories</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reports & Analytics</Text>
          <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('AdminReports')}>
            <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.actionGradient}>
              <Text style={styles.actionText}>📊 Sales Reports</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('AdminUserReports')}>
            <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.actionGradient}>
              <Text style={styles.actionText}>👥 User Activity</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System</Text>
          <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('AdminAnnouncements')}>
            <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.actionGradient}>
              <Text style={styles.actionText}>📢 Announcements</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('AdminSettings')}>
            <LinearGradient colors={['#6B7280', '#4B5563']} style={styles.actionGradient}>
              <Text style={styles.actionText}>⚙️ Settings</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#DC2626" />
      
      <Header 
        title="Admin Dashboard"
        subtitle={profile?.full_name || 'Market Administrator'}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} />}
      >
        {/* Stats Cards - Responsive Grid */}
        <View style={[styles.statsGrid, isDesktop && styles.statsGridDesktop]}>
          <View style={[styles.statCard, { width: getStatCardWidth() }]}>
            <Text style={styles.statValue}>{stats.totalUsers}</Text>
            <Text style={styles.statLabel}>Total Users</Text>
          </View>
          <View style={[styles.statCard, { width: getStatCardWidth() }]}>
            <Text style={styles.statValue}>{stats.totalVendors}</Text>
            <Text style={styles.statLabel}>Vendors</Text>
          </View>
          <View style={[styles.statCard, { width: getStatCardWidth() }]}>
            <Text style={styles.statValue}>{stats.totalConsumers}</Text>
            <Text style={styles.statLabel}>Customers</Text>
          </View>
          <View style={[styles.statCard, { width: getStatCardWidth() }]}>
            <Text style={styles.statValue}>{stats.pendingApplications}</Text>
            <Text style={styles.statLabel}>Pending Apps</Text>
          </View>
          <View style={[styles.statCard, { width: getStatCardWidth() }]}>
            <Text style={styles.statValue}>{stats.totalStalls}</Text>
            <Text style={styles.statLabel}>Stalls</Text>
          </View>
          <View style={[styles.statCard, { width: getStatCardWidth() }]}>
            <Text style={styles.statValue}>{stats.totalOrders}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
          <View style={[styles.statCard, { width: getStatCardWidth() }]}>
            <Text style={styles.statValue}>₱{stats.totalSales.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total Sales</Text>
          </View>
        </View>

        {/* Management Sections - Responsive */}
        {renderManagementGrid()}

        {/* Profile Section */}
        <View style={styles.section}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>👤</Text>
            </View>
            <Text style={styles.profileName}>{profile?.full_name || 'Admin User'}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>👑 Administrator</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Role</Text>
            <Text style={styles.infoValue}>Administrator</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Member Since</Text>
            <Text style={styles.infoValue}>
              {profile?.created_at 
                ? new Date(profile.created_at).toLocaleDateString() 
                : 'Recently'}
            </Text>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.logoutGradient}>
              <Text style={styles.logoutButtonText}>Logout</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 30,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  statsGridDesktop: {
    paddingHorizontal: 24,
  },
  statCard: {
    backgroundColor: 'white',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  desktopGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 16,
  },
  gridColumn: {
    flex: 1,
    minWidth: 250,
  },
  section: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  actionButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  actionGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF3F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 40,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  profileEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  roleBadge: {
    backgroundColor: '#FEF3F2',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 8,
  },
  roleText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  logoutButton: {
    marginTop: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  logoutGradient: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});