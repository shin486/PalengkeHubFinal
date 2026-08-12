// src/screens/admin/AdminAuditTrailScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  SafeAreaView,
  StatusBar,
  FlatList,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { Header } from '../../components/Header';

const AdminAuditTrailScreen = ({ navigation }) => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState(null);
  const [logDetailModal, setLogDetailModal] = useState(false);

  // Filter options
  const filterOptions = [
    { id: 'all', label: 'All Activities' },
    { id: 'price_update', label: 'Price Updates' },
    { id: 'product_update', label: 'Product Updates' },
    { id: 'stall_update', label: 'Stall Updates' },
    { id: 'user_update', label: 'User Updates' },
    { id: 'order_update', label: 'Order Updates' },
    { id: 'announcement', label: 'Announcements' },
    { id: 'complaint', label: 'Complaints' },
    { id: 'violation', label: 'Violations' },
  ];

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [auditLogs, searchQuery, activeFilter]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      
      // Try to fetch from audit_logs table if it exists
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`
          *,
          admin:admin_id (
            id,
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        // If audit_logs table doesn't exist, generate from existing data
        console.log('Audit logs table not found, generating from existing data');
        generateAuditLogsFromData();
        return;
      }
      
      setAuditLogs(data || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      generateAuditLogsFromData();
    } finally {
      setLoading(false);
    }
  };

  const generateAuditLogsFromData = async () => {
    try {
      const logs = [];
      
      // Fetch recent product updates
      const { data: products } = await supabase
        .from('products')
        .select('*, stalls (stall_name)')
        .order('updated_at', { ascending: false })
        .limit(20);
      
      products?.forEach(product => {
        if (product.updated_at && product.updated_at !== product.created_at) {
          logs.push({
            id: `product_${product.id}`,
            action_type: 'product_update',
            action: 'Product Updated',
            description: `Product "${product.name}" was updated`,
            details: {
              product_name: product.name,
              price: product.price,
              category: product.category,
              stall: product.stalls?.stall_name || 'Unknown',
            },
            created_at: product.updated_at,
            admin: null,
          });
        }
      });

      // Fetch recent stall updates
      const { data: stalls } = await supabase
        .from('stalls')
        .select('*, profiles:vendor_id (full_name)')
        .order('updated_at', { ascending: false })
        .limit(20);
      
      stalls?.forEach(stall => {
        if (stall.updated_at && stall.updated_at !== stall.created_at) {
          logs.push({
            id: `stall_${stall.id}`,
            action_type: 'stall_update',
            action: 'Stall Updated',
            description: `Stall "${stall.stall_name || `Stall #${stall.stall_number}`}" was updated`,
            details: {
              stall_name: stall.stall_name,
              stall_number: stall.stall_number,
              section: stall.section,
              is_active: stall.is_active,
              vendor: stall.profiles?.full_name || 'Unassigned',
            },
            created_at: stall.updated_at,
            admin: null,
          });
        }
      });

      // Fetch recent user updates
      const { data: users } = await supabase
        .from('profiles')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(20);
      
      users?.forEach(user => {
        if (user.updated_at && user.updated_at !== user.created_at) {
          logs.push({
            id: `user_${user.id}`,
            action_type: 'user_update',
            action: 'User Updated',
            description: `User "${user.full_name || user.email}" was updated`,
            details: {
              full_name: user.full_name,
              email: user.email,
              role: user.role,
              phone: user.phone,
            },
            created_at: user.updated_at,
            admin: null,
          });
        }
      });

      // Sort by date
      logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setAuditLogs(logs);
    } catch (error) {
      console.error('Error generating audit logs:', error);
      Alert.alert('Error', 'Failed to load audit logs');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAuditLogs();
    setRefreshing(false);
  };

  const applyFilters = () => {
    let filtered = [...auditLogs];

    // Apply action type filter
    if (activeFilter !== 'all') {
      filtered = filtered.filter(log => log.action_type === activeFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(log => {
        const action = (log.action || '').toLowerCase();
        const description = (log.description || '').toLowerCase();
        const adminName = (log.admin?.full_name || '').toLowerCase();
        const adminEmail = (log.admin?.email || '').toLowerCase();
        
        return (
          action.includes(query) ||
          description.includes(query) ||
          adminName.includes(query) ||
          adminEmail.includes(query)
        );
      });
    }

    setFilteredLogs(filtered);
  };

  const getActionIcon = (actionType) => {
    const icons = {
      price_update: 'attach-money',
      product_update: 'inventory',
      stall_update: 'storefront',
      user_update: 'person',
      order_update: 'shopping-cart',
      announcement: 'campaign',
      complaint: 'chat-bubble-outline',
      violation: 'warning',
    };
    return icons[actionType] || 'history';
  };

  const getActionColor = (actionType) => {
    const colors = {
      price_update: '#10B981',
      product_update: '#3B82F6',
      stall_update: '#EC4899',
      user_update: '#8B5CF6',
      order_update: '#14B8A6',
      announcement: '#F59E0B',
      complaint: '#06B6D4',
      violation: '#EF4444',
    };
    return colors[actionType] || '#6B7280';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderAuditLog = ({ item }) => {
    const icon = getActionIcon(item.action_type);
    const color = getActionColor(item.action_type);
    
    return (
      <TouchableOpacity
        style={styles.logCard}
        onPress={() => {
          setSelectedLog(item);
          setLogDetailModal(true);
        }}
      >
        <View style={styles.logHeader}>
          <View style={[styles.logIconContainer, { backgroundColor: color + '20' }]}>
            <MaterialIcons name={icon} size={20} color={color} />
          </View>
          <View style={styles.logInfo}>
            <Text style={styles.logAction}>{item.action || 'Unknown Action'}</Text>
            <Text style={styles.logDescription} numberOfLines={2}>
              {item.description || 'No description available'}
            </Text>
          </View>
          <View style={styles.logTimeContainer}>
            <Text style={styles.logTime}>{formatDate(item.created_at)}</Text>
            {item.admin && (
              <Text style={styles.logAdmin}>by {item.admin.full_name || 'Admin'}</Text>
            )}
          </View>
        </View>
        
        {item.details && (
          <View style={styles.logDetails}>
            {Object.entries(item.details).map(([key, value]) => (
              value !== null && value !== undefined && value !== '' ? (
                <View key={key} style={styles.logDetailRow}>
                  <Text style={styles.logDetailLabel}>{key}:</Text>
                  <Text style={styles.logDetailValue}>{String(value)}</Text>
                </View>
              ) : null
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
        <ActivityIndicator size="large" color="#DC2626" />
        <Text style={styles.loadingText}>Loading audit logs...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      <View style={styles.headerContainer}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#C62828" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Audit Trail</Text>
          <Text style={styles.headerSubtitle}>System activity logs and records</Text>
        </View>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={onRefresh}
        >
          <MaterialIcons name="refresh" size={22} color="#DC2626" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <MaterialIcons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search audit logs by action, description, or admin..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
        </View>
      </View>

      {/* Filter Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
      >
        {filterOptions.map((filter) => (
          <TouchableOpacity
            key={filter.id}
            style={[
              styles.filterTab,
              activeFilter === filter.id && styles.filterTabActive,
            ]}
            onPress={() => setActiveFilter(filter.id)}
          >
            <Text style={[
              styles.filterTabText,
              activeFilter === filter.id && styles.filterTabTextActive,
            ]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Results Count */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>
          {filteredLogs.length} log{filteredLogs.length !== 1 ? 's' : ''} found
        </Text>
        <TouchableOpacity onPress={onRefresh}>
          <MaterialIcons name="refresh" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Audit Logs List */}
      <FlatList
        data={filteredLogs}
        renderItem={renderAuditLog}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} />
        }
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="history" size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No Audit Logs Found</Text>
            <Text style={styles.emptyText}>
              {searchQuery ? 'Try adjusting your search' : 'No activity recorded yet'}
            </Text>
          </View>
        }
      />

      {/* Log Detail Modal */}
      <Modal
        visible={logDetailModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setLogDetailModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Audit Log Details</Text>
            <TouchableOpacity onPress={() => setLogDetailModal(false)}>
              <MaterialIcons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedLog && (
              <>
                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Action</Text>
                  <Text style={styles.modalValue}>{selectedLog.action || 'N/A'}</Text>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Description</Text>
                  <Text style={styles.modalValue}>{selectedLog.description || 'N/A'}</Text>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Action Type</Text>
                  <View style={[styles.actionTypeBadge, { backgroundColor: getActionColor(selectedLog.action_type) + '20' }]}>
                    <Text style={[styles.actionTypeText, { color: getActionColor(selectedLog.action_type) }]}>
                      {selectedLog.action_type || 'N/A'}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Timestamp</Text>
                  <Text style={styles.modalValue}>{formatDate(selectedLog.created_at)}</Text>
                </View>

                {selectedLog.admin && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalLabel}>Performed By</Text>
                    <Text style={styles.modalValue}>
                      {selectedLog.admin.full_name || selectedLog.admin.email || 'Admin'}
                    </Text>
                  </View>
                )}

                {selectedLog.details && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalLabel}>Details</Text>
                    <View style={styles.detailsContainer}>
                      {Object.entries(selectedLog.details).map(([key, value]) => (
                        <View key={key} style={styles.detailRow}>
                          <Text style={styles.detailKey}>{key}:</Text>
                          <Text style={styles.detailValue}>{String(value || 'N/A')}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF3F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF3F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 14,
    color: '#111827',
  },
  filterContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  filterTabActive: {
    backgroundColor: '#DC2626',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterTabTextActive: {
    color: 'white',
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  resultsCount: {
    fontSize: 14,
    color: '#6B7280',
  },
  listContainer: {
    padding: 16,
    gap: 12,
  },
  logCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  logIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logInfo: {
    flex: 1,
  },
  logAction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  logDescription: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  logTimeContainer: {
    alignItems: 'flex-end',
  },
  logTime: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  logAdmin: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  logDetails: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  logDetailRow: {
    flexDirection: 'row',
    gap: 6,
  },
  logDetailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  logDetailValue: {
    fontSize: 12,
    color: '#111827',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 12,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 48,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  modalContent: {
    padding: 16,
  },
  modalSection: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  modalValue: {
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
  },
  actionTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  actionTypeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  detailsContainer: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    gap: 8,
  },
  detailKey: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    minWidth: 100,
  },
  detailValue: {
    fontSize: 12,
    color: '#111827',
    flex: 1,
  },
});

export default AdminAuditTrailScreen;
