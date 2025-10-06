import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { getUserPayments, getHostPayments, Payment, formatAmount, getPaymentStatusColor } from '@/lib/payments';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { router } from 'expo-router';

export default function PaymentsScreen() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bookings, setBookings] = useState<any>({});

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    if (!user?.uid) return;
    
    try {
      setLoading(true);
      let userPayments: Payment[];
      
      if (user.role === 'host') {
        userPayments = await getHostPayments(user.uid);
      } else {
        userPayments = await getUserPayments(user.uid);
      }
      
      setPayments(userPayments);
      
      // Load booking details for each payment
      const bookingDetails: any = {};
      for (const payment of userPayments) {
        try {
          const bookingDoc = await getDoc(doc(db, 'bookings', payment.booking_id));
          if (bookingDoc.exists()) {
            bookingDetails[payment.booking_id] = bookingDoc.data();
          }
        } catch (error) {
          console.error('Error loading booking details:', error);
        }
      }
      setBookings(bookingDetails);
    } catch (error) {
      console.error('Error loading payments:', error);
      Alert.alert('Error', 'Failed to load payment history');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPayments();
    setRefreshing(false);
  };

  const getStatusText = (status: Payment['status']) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'processing':
        return 'Processing';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'refunded':
        return 'Refunded';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy hh:mm a');
    } catch (error) {
      return 'Invalid date';
    }
  };

  const handlePaymentPress = (payment: Payment) => {
    router.push(`/booking/${payment.booking_id}`);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading payment history...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment History</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {payments.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="card-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>No Payments Yet</Text>
            <Text style={styles.emptyText}>
              {user?.role === 'host' 
                ? 'You haven\'t received any payments yet.'
                : 'You haven\'t made any payments yet.'
              }
            </Text>
          </View>
        ) : (
          payments.map((payment) => {
            const booking = bookings[payment.booking_id];
            return (
              <TouchableOpacity
                key={payment.id}
                style={styles.paymentCard}
                onPress={() => handlePaymentPress(payment)}
              >
                <View style={styles.paymentHeader}>
                  <View style={styles.paymentInfo}>
                    <Text style={styles.paymentAmount}>
                      {formatAmount(payment.amount, payment.currency)}
                    </Text>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: getPaymentStatusColor(payment.status) }
                    ]}>
                      <Text style={styles.statusText}>
                        {getStatusText(payment.status)}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#ccc" />
                </View>

                {booking && (
                  <View style={styles.bookingInfo}>
                    <Text style={styles.bookingTitle}>
                      {booking.listing_title || 'Parking Space'}
                    </Text>
                    <Text style={styles.bookingDate}>
                      {formatDate(booking.start_time)} - {formatDate(booking.end_time)}
                    </Text>
                  </View>
                )}

                <View style={styles.paymentDetails}>
                  <Text style={styles.paymentDate}>
                    {formatDate(payment.created_at)}
                  </Text>
                  {payment.refunded_at && (
                    <Text style={styles.refundDate}>
                      Refunded: {formatDate(payment.refunded_at)}
                    </Text>
                  )}
                </View>

                {payment.license_plate && (
                  <View style={styles.licensePlateInfo}>
                    <Ionicons name="car-outline" size={16} color="#666" />
                    <Text style={styles.licensePlateText}>
                      {payment.license_plate} ({payment.license_plate_state})
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  backButton: {
    padding: 8,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 24,
  },
  paymentCard: {
    backgroundColor: '#fff',
    margin: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  paymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  paymentInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  bookingInfo: {
    marginBottom: 12,
  },
  bookingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  bookingDate: {
    fontSize: 14,
    color: '#666',
  },
  paymentDetails: {
    marginBottom: 8,
  },
  paymentDate: {
    fontSize: 14,
    color: '#666',
  },
  refundDate: {
    fontSize: 14,
    color: '#FF3B30',
    marginTop: 4,
  },
  licensePlateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  licensePlateText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#666',
  },
}); 