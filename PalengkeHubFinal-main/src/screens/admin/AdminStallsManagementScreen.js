// src/screens/admin/AdminStallsManagementScreen.js
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
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { Header } from '../../components/Header';

const AdminStallsManagementScreen = ({ navigation }) => {
  const [stalls, setStalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredStalls, setFilteredStalls] = useState([]);
  const [selectedStall, setSelectedStall] = useState(null);
  const [stallModalVisible, setStallModalVisible] = useState(false);
  const [stallAction, setStallAction] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsModalVisible, setTransactionsModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [stallDetails, setStallDetails] = useState({
    violations: [],
    complaints: [],
    ratings: [],
    totalOrders: 0,
    totalRevenue: 0,
  });
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Filter options
  const filterOptions = [
    { id: 'all', label: 'All Stalls' },
    { id: 'active', label: 'Active' },
    { id: 'inactive', label: 'Inactive' },
    { id: 'pending', label: 'Pending Approval' },
  ];

  useEffect(() => {
    fetchStalls();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [stalls, searchQuery, activeFilter]);

  const fetchStalls = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stalls')
        .select(`
          *,
          vendor:vendor_id (
            id,
            full_name,
            email,
            phone
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStalls(data || []);
    } catch (error) {
      console.error('Error fetching stalls:', error);
      Alert.alert('Error', 'Failed to load stalls');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchStalls();
    setRefreshing(false);
  };

  const applyFilters = () => {
    let filtered = [...stalls];

    // Apply status filter
    if (activeFilter !== 'all') {
      filtered = filtered.filter(stall => {
        if (activeFilter === 'active') return stall.is_active === true;
        if (activeFilter === 'inactive') return stall.is_active === false;
        if (activeFilter === 'pending') return stall.is_active === false && !stall.vendor;
        return true;
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(stall => {
        const stallName = (stall.stall_name || '').toLowerCase();
        const stallNumber = (stall.stall_number || '').toString().toLowerCase();
        const section = (stall.section || '').toLowerCase();
        const vendorName = (stall.vendor?.full_name || '').toLowerCase();
        const vendorEmail = (stall.vendor?.email || '').toLowerCase();
        
        return (
          stallName.includes(query) ||
          stallNumber.includes(query) ||
          section.includes(query) ||
          vendorName.includes(query) ||
          vendorEmail.includes(query)
        );
      });
    }

    setFilteredStalls(filtered);
  };

  const handleStallAction = (stall, action) => {
    setSelectedStall(stall);
    setStallAction(action);
    setStallModalVisible(true);
  };

  const confirmStallAction = async () => {
    if (!selectedStall) return;

    try {
      if (stallAction === 'approve') {
        const { error } = await supabase
          .from('stalls')
          .update({ is_active: true, approved_at: new Date().toISOString() })
          .eq('id', selectedStall.id);

        if (error) throw error;
        Alert.alert('Success', 'Stall approved successfully');
      } else if (stallAction === 'deactivate') {
        const { error } = await supabase
          .from('stalls')
          .update({ is_active: false })
          .eq('id', selectedStall.id);

        if (error) throw error;
        Alert.alert('Success', 'Stall deactivated successfully');
      } else if (stallAction === 'edit') {
        // Edit functionality - will open edit form
        Alert.alert('Edit Stall', 'Edit functionality will be implemented');
      }

      setStallModalVisible(false);
      setSelectedStall(null);
      setStallAction('');
      fetchStalls();
    } catch (error) {
      console.error('Error updating stall:', error);
      Alert.alert('Error', 'Failed to update stall');
    }
  };

  const fetchStallTransactions = async (stallId) => {
    try {
      setTransactionsLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          stall:stall_id (
            stall_name,
            stall_number,
            section
          ),
          vendor:vendor_id (
            full_name
          )
        `)
        .eq('stall_id', stallId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      Alert.alert('Error', 'Failed to load transactions');
    } finally {
      setTransactionsLoading(false);
    }
  };

  const viewStallTransactions = (stall) => {
    setSelectedStall(stall);
    setTransactionsModalVisible(true);
    fetchStallTransactions(stall.id);
  };

  const viewStallDetails = (stall) => {
    navigation.navigate('AdminStallDetails', { stallId: stall.id });
  };

  const fetchStallDetails = async (stallId) => {
    try {
      setDetailsLoading(true);
      
      // Fetch violations
      const { data: violations } = await supabase
        .from('violations')
        .select('*')
        .eq('stall_id', stallId)
        .order('created_at', { ascending: false })
        .limit(5);

      // Fetch complaints
      const { data: complaints } = await supabase
        .from('complaints')
        .select('*')
        .eq('stall_id', stallId)
        .order('created_at', { ascending: false })
        .limit(5);

      // Fetch ratings/reviews if available
      const { data: ratings } = await supabase
        .from('ratings')
        .select('*')
        .eq('stall_id', stallId)
        .order('created_at', { ascending: false })
        .limit(5);

      // Fetch order statistics
      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount, status')
        .eq('stall_id', stallId);

      const totalOrders = orders?.length || 0;
      const totalRevenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;

      setStallDetails({
        violations: violations || [],
        complaints: complaints || [],
        ratings: ratings || [],
        totalOrders,
        totalRevenue,
      });
    } catch (error) {
      console.error('Error fetching stall details:', error);
    } finally {
      setDetailsLoading(false);
    }
  };

  const viewStallLocation = (stall) => {
    Alert.alert(
      'Stall Location',
      `Stall: ${stall.stall_name || 'N/A'}\n` +
      `Number: ${stall.stall_number || 'N/A'}\n` +
      `Section: ${stall.section || 'Unassigned'}\n\n` +
      `Coordinates: ${stall.latitude || 'N/A'}, ${stall.longitude || 'N/A'}`,
      [{ text: 'OK' }]
    );
  };

  const getStatusBadge = (stall) => {
    if (stall.is_active) {
      return { text: 'Active', color: '#10B981', bgColor: '#D1FAE5' };
    }
    if (stall.vendor) {
      return { text: 'Inactive', color: '#F59E0B', bgColor: '#FEF3C7' };
    }
    return { text: 'Pending', color: '#EF4444', bgColor: '#FEE2E2' };
  };

  const renderStallCard = ({ item }) => {
    const status = getStatusBadge(item);
    return (
      <TouchableOpacity 
        style={[styles.stallCard, styles.stallCardTouchable]}
        onPress={() => viewStallDetails(item)}
        activeOpacity={0.7}
      >
        <View style={styles.stallCardHeader}>
          <View style={styles.stallInfo}>
            <Text style={styles.stallName}>{item.stall_name || 'Unnamed Stall'}</Text>
            <Text style={styles.stallDetails}>
              {item.stall_number ? `Stall #${item.stall_number}` : ''} • {item.section || 'Unassigned'}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
          </View>
        </View>

        {item.vendor && (
          <View style={styles.vendorInfo}>
            <MaterialIcons name="person" size={16} color="#6B7280" />
            <Text style={styles.vendorName}>{item.vendor.full_name || 'Unknown Vendor'}</Text>
            <Text style={styles.vendorEmail}>{item.vendor.email || ''}</Text>
          </View>
        )}

        <View style={styles.stallActions}>
          {!item.is_active && item.vendor && (
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={(e) => {
                e.stopPropagation();
                handleStallAction(item, 'approve');
              }}
            >
              <MaterialIcons name="check-circle" size={16} color="white" />
              <Text style={styles.actionButtonText}>Approve</Text>
            </TouchableOpacity>
          )}
          
          {item.is_active && (
            <TouchableOpacity
              style={[styles.actionButton, styles.deactivateButton]}
              onPress={(e) => {
                e.stopPropagation();
                handleStallAction(item, 'deactivate');
              }}
            >
              <MaterialIcons name="pause-circle" size={16} color="white" />
              <Text style={styles.actionButtonText}>Deactivate</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionButton, styles.viewButton]}
            onPress={(e) => {
              e.stopPropagation();
              viewStallTransactions(item);
            }}
          >
            <MaterialIcons name="receipt-long" size={16} color="white" />
            <Text style={styles.actionButtonText}>Transactions</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.locationButton]}
            onPress={(e) => {
              e.stopPropagation();
              viewStallLocation(item);
            }}
          >
            <MaterialIcons name="location-on" size={16} color="white" />
            <Text style={styles.actionButtonText}>Location</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tapHint}>
          <MaterialIcons name="touch-app" size={14} color="#DC2626" />
          <Text style={styles.tapHintText}>Tap anywhere to view full details</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
        <ActivityIndicator size="large" color="#DC2626" />
        <Text style={styles.loadingText}>Loading stalls...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      <Header 
        title="Stalls Management" 
        subtitle="Manage stall accounts and view transaction records"
      />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <MaterialIcons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search stalls by name, number, section, or vendor..."
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
          {filteredStalls.length} stall{filteredStalls.length !== 1 ? 's' : ''} found
        </Text>
        <TouchableOpacity onPress={onRefresh}>
          <MaterialIcons name="refresh" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Stalls List */}
      <FlatList
        data={filteredStalls}
        renderItem={renderStallCard}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} />
        }
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="storefront" size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No Stalls Found</Text>
            <Text style={styles.emptyText}>
              {searchQuery ? 'Try adjusting your search' : 'No stalls available'}
            </Text>
          </View>
        }
      />

      {/* Stall Action Modal */}
      <Modal
        visible={stallModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setStallModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {stallAction === 'approve' ? 'Approve Stall' : 
               stallAction === 'deactivate' ? 'Deactivate Stall' : 'Edit Stall'}
            </Text>
            <TouchableOpacity onPress={() => setStallModalVisible(false)}>
              <MaterialIcons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedStall && (
              <>
                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Stall Name</Text>
                  <Text style={styles.modalValue}>{selectedStall.stall_name || 'N/A'}</Text>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Stall Number</Text>
                  <Text style={styles.modalValue}>{selectedStall.stall_number || 'N/A'}</Text>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Section</Text>
                  <Text style={styles.modalValue}>{selectedStall.section || 'N/A'}</Text>
                </View>

                {selectedStall.vendor && (
                  <>
                    <View style={styles.modalSection}>
                      <Text style={styles.modalLabel}>Vendor Name</Text>
                      <Text style={styles.modalValue}>{selectedStall.vendor.full_name || 'N/A'}</Text>
                    </View>

                    <View style={styles.modalSection}>
                      <Text style={styles.modalLabel}>Vendor Email</Text>
                      <Text style={styles.modalValue}>{selectedStall.vendor.email || 'N/A'}</Text>
                    </View>

                    {selectedStall.vendor.phone && (
                      <View style={styles.modalSection}>
                        <Text style={styles.modalLabel}>Vendor Phone</Text>
                        <Text style={styles.modalValue}>{selectedStall.vendor.phone}</Text>
                      </View>
                    )}
                  </>
                )}

                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Status</Text>
                  <Text style={styles.modalValue}>
                    {selectedStall.is_active ? 'Active' : 'Inactive'}
                  </Text>
                </View>

                {selectedStall.created_at && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalLabel}>Created At</Text>
                    <Text style={styles.modalValue}>
                      {new Date(selectedStall.created_at).toLocaleString()}
                    </Text>
                  </View>
                )}

                {stallAction === 'edit' && (
                  <>
                    <View style={styles.modalSection}>
                      <Text style={styles.modalLabel}>Edit Stall Name</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Enter stall name"
                        defaultValue={selectedStall.stall_name || ''}
                      />
                    </View>

                    <View style={styles.modalSection}>
                      <Text style={styles.modalLabel}>Edit Section</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Enter section"
                        defaultValue={selectedStall.section || ''}
                      />
                    </View>
                  </>
                )}

                <TouchableOpacity 
                  style={styles.modalActionButton}
                  onPress={confirmStallAction}
                >
                  <LinearGradient 
                    colors={stallAction === 'deactivate' ? ['#EF4444', '#DC2626'] : ['#DC2626', '#EF4444']} 
                    style={styles.modalActionGradient}
                  >
                    <Text style={styles.modalActionText}>
                      {stallAction === 'approve' ? 'Approve Stall' : 
                       stallAction === 'deactivate' ? 'Deactivate Stall' : 'Save Changes'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Stall Details Modal */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Stall Details</Text>
            <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
              <MaterialIcons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedStall && (
              <>
                {/* Basic Information */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Basic Information</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Stall Name:</Text>
                    <Text style={styles.detailValue}>{selectedStall.stall_name || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Stall Number:</Text>
                    <Text style={styles.detailValue}>{selectedStall.stall_number || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Section:</Text>
                    <Text style={styles.detailValue}>{selectedStall.section || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status:</Text>
                    <View style={[styles.statusBadge, { 
                      backgroundColor: selectedStall.is_active ? '#D1FAE5' : selectedStall.is_active === false ? '#FEE2E2' : '#FEF3C7'
                    }]}>
                      <Text style={[styles.statusText, { 
                        color: selectedStall.is_active ? '#10B981' : selectedStall.is_active === false ? '#EF4444' : '#F59E0B'
                      }]}>
                        {selectedStall.is_active ? 'Active' : selectedStall.is_active === false ? 'Inactive' : 'Pending'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Owner/Vendor Information */}
                {selectedStall.vendor && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Owner Information</Text>
                    <View style={styles.ownerCard}>
                      <View style={styles.ownerAvatar}>
                        <MaterialIcons name="person" size={32} color="#DC2626" />
                      </View>
                      <View style={styles.ownerInfo}>
                        <Text style={styles.ownerName}>{selectedStall.vendor.full_name || 'N/A'}</Text>
                        <Text style={styles.ownerDetail}>{selectedStall.vendor.email || 'N/A'}</Text>
                        {selectedStall.vendor.phone && (
                          <Text style={styles.ownerDetail}>{selectedStall.vendor.phone}</Text>
                        )}
                      </View>
                    </View>
                  </View>
                )}

                {/* Statistics */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Performance Statistics</Text>
                  <View style={styles.statsGrid}>
                    <View style={styles.statItem}>
                      <MaterialIcons name="shopping-cart" size={24} color="#DC2626" />
                      <Text style={styles.statValue}>{stallDetails.totalOrders}</Text>
                      <Text style={styles.statLabel}>Total Orders</Text>
                    </View>
                    <View style={styles.statItem}>
                      <MaterialIcons name="payments" size={24} color="#10B981" />
                      <Text style={styles.statValue}>₱{stallDetails.totalRevenue.toFixed(0)}</Text>
                      <Text style={styles.statLabel}>Revenue</Text>
                    </View>
                  </View>
                </View>

                {/* Violations */}
                {stallDetails.violations.length > 0 && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Violations ({stallDetails.violations.length})</Text>
                    {stallDetails.violations.map((violation, index) => (
                      <View key={index} style={styles.violationCard}>
                        <View style={styles.violationHeader}>
                          <MaterialIcons name="warning" size={18} color="#EF4444" />
                          <Text style={styles.violationType}>{violation.violation_type || 'Violation'}</Text>
                        </View>
                        <Text style={styles.violationReason}>{violation.reason || 'No reason provided'}</Text>
                        <Text style={styles.violationDate}>
                          {new Date(violation.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Complaints */}
                {stallDetails.complaints.length > 0 && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Complaints ({stallDetails.complaints.length})</Text>
                    {stallDetails.complaints.map((complaint, index) => (
                      <View key={index} style={styles.complaintCard}>
                        <View style={styles.complaintHeader}>
                          <MaterialIcons name="chat-bubble-outline" size={18} color="#F59E0B" />
                          <Text style={styles.complaintType}>{complaint.complaint_type || 'Complaint'}</Text>
                        </View>
                        <Text style={styles.complaintReason}>{complaint.reason || 'No reason provided'}</Text>
                        <Text style={styles.complaintDate}>
                          {new Date(complaint.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Ratings */}
                {stallDetails.ratings.length > 0 && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Ratings & Reviews</Text>
                    {stallDetails.ratings.map((rating, index) => (
                      <View key={index} style={styles.ratingCard}>
                        <View style={styles.ratingHeader}>
                          <View style={styles.starsContainer}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <MaterialIcons
                                key={star}
                                name={star <= (rating.rating || 0) ? 'star' : 'star-border'}
                                size={18}
                                color="#F59E0B"
                              />
                            ))}
                          </View>
                          <Text style={styles.ratingDate}>
                            {new Date(rating.created_at).toLocaleDateString()}
                          </Text>
                        </View>
                        {rating.review && (
                          <Text style={styles.ratingReview}>{rating.review}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                {stallDetails.violations.length === 0 && 
                 stallDetails.complaints.length === 0 && 
                 stallDetails.ratings.length === 0 && (
                  <View style={styles.emptySection}>
                    <MaterialIcons name="check-circle" size={48} color="#10B981" />
                    <Text style={styles.emptySectionText}>No violations, complaints, or ratings yet</Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Transactions Modal */}
      <Modal
        visible={transactionsModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setTransactionsModalVisible(false)}
      >
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
          
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Transaction Records - {selectedStall?.stall_name || 'N/A'}
            </Text>
            <TouchableOpacity onPress={() => setTransactionsModalVisible(false)}>
              <MaterialIcons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {transactionsLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#DC2626" />
              <Text style={styles.loadingText}>Loading transactions...</Text>
            </View>
          ) : (
            <FlatList
              data={transactions}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <View style={styles.transactionCard}>
                  <View style={styles.transactionHeader}>
                    <Text style={styles.transactionId}>Order #{item.id.slice(0, 8)}</Text>
                    <View style={[styles.transactionStatus, styles[`status${item.status}`]]}>
                      <Text style={styles.transactionStatusText}>
                        {item.status?.toUpperCase() || 'PENDING'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.transactionAmount}>₱{item.total_amount || 0}</Text>
                  <Text style={styles.transactionDate}>
                    {new Date(item.created_at).toLocaleString()}
                  </Text>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <MaterialIcons name="receipt-long" size={48} color="#D1D5DB" />
                  <Text style={styles.emptyTitle}>No Transactions</Text>
                  <Text style={styles.emptyText}>No transaction records found for this stall</Text>
                </View>
              }
            />
          )}
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
  stallCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  stallCardTouchable: {
    marginBottom: 12,
  },
  stallCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stallInfo: {
    flex: 1,
  },
  stallName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  stallDetails: {
    fontSize: 13,
    color: '#6B7280',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  vendorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  vendorName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  vendorEmail: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 'auto',
  },
  stallActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    flex: 1,
    minWidth: '30%',
    justifyContent: 'center',
  },
  approveButton: {
    backgroundColor: '#10B981',
  },
  deactivateButton: {
    backgroundColor: '#F59E0B',
  },
  editButton: {
    backgroundColor: '#3B82F6',
  },
  viewButton: {
    backgroundColor: '#8B5CF6',
  },
  locationButton: {
    backgroundColor: '#14B8A6',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '500',
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  tapHintText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
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
  },
  modalInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 4,
  },
  modalActionButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 12,
    marginBottom: 32,
  },
  modalActionGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalActionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  transactionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  transactionId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  transactionStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  transactionStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#DC2626',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: '#6B7280',
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
  detailsButton: {
    backgroundColor: '#6366F1',
  },
  detailsButtonProminent: {
    backgroundColor: '#DC2626',
    minWidth: '40%',
    flex: 2,
  },
  detailSection: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  ownerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  ownerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEF3F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ownerInfo: {
    flex: 1,
  },
  ownerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  ownerDetail: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  violationCard: {
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  violationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  violationType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  violationReason: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 4,
  },
  violationDate: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  complaintCard: {
    padding: 12,
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  complaintHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  complaintType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
  },
  complaintReason: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 4,
  },
  complaintDate: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  ratingCard: {
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 8,
  },
  ratingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  ratingReview: {
    fontSize: 13,
    color: '#374151',
    fontStyle: 'italic',
  },
  emptySection: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  emptySectionText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
    textAlign: 'center',
  },
  statuspending: {
    backgroundColor: '#F59E0B',
  },
  statuscompleted: {
    backgroundColor: '#10B981',
  },
  statuscancelled: {
    backgroundColor: '#EF4444',
  },
  statusconfirmed: {
    backgroundColor: '#3B82F6',
  },
  statuspreparing: {
    backgroundColor: '#8B5CF6',
  },
  statusready: {
    backgroundColor: '#14B8A6',
  },
});

export default AdminStallsManagementScreen;
