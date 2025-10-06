import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { createPaymentIntent, confirmPayment, PaymentIntent, formatAmount } from '@/lib/payments';
import { updateBookingStatus } from '@/lib/bookings';
import { useStripe } from '@stripe/stripe-react-native';
import { getStripeErrorMessage } from '@/lib/stripe';

interface PaymentSheetProps {
  visible: boolean;
  onClose: () => void;
  bookingId: string;
  amount: number;
  onSuccess: () => void;
  onFailure: (error: string) => void;
}

export default function PaymentSheet({
  visible,
  onClose,
  bookingId,
  amount,
  onSuccess,
  onFailure,
}: PaymentSheetProps) {
  const { user } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(false);
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntent | null>(null);
  const [paymentStep, setPaymentStep] = useState<'initial' | 'processing' | 'success' | 'error'>('initial');

  useEffect(() => {
    if (visible && !paymentIntent) {
      initializePayment();
    }
  }, [visible]);

  const initializePayment = async () => {
    if (!user) {
      onFailure('User not authenticated');
      return;
    }

    setLoading(true);
    try {
      const intent = await createPaymentIntent(bookingId, amount);
      setPaymentIntent(intent);
      setPaymentStep('initial');
    } catch (error) {
      console.error('Error initializing payment:', error);
      onFailure('Failed to initialize payment');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!paymentIntent) return;

    setLoading(true);
    setPaymentStep('processing');

    try {
      // Initialize Stripe Payment Sheet
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'ParkPal',
        paymentIntentClientSecret: paymentIntent.client_secret,
        allowsDelayedPaymentMethods: true,
      });

      if (initError) {
        throw new Error(initError.message);
      }

      // Present Payment Sheet
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code === 'Canceled') {
          setLoading(false);
          return; // User canceled, don't show error
        }
        throw new Error(presentError.message);
      }

      // Payment succeeded
      await confirmPayment(paymentIntent.id, 'stripe_payment_method');
      
      setPaymentStep('success');
      
      // Wait a moment to show success state
      setTimeout(() => {
        onSuccess();
        onClose();
        resetPayment();
      }, 1500);
      
    } catch (error: any) {
      console.error('Payment failed:', error);
      setPaymentStep('error');
      const errorMessage = getStripeErrorMessage(error);
      onFailure(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const resetPayment = () => {
    setPaymentIntent(null);
    setPaymentStep('initial');
  };

  const handleClose = () => {
    if (loading) return;
    onClose();
    resetPayment();
  };

  const renderPaymentContent = () => {
    if (loading && !paymentIntent) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Initializing payment...</Text>
        </View>
      );
    }

    if (paymentStep === 'processing') {
      return (
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.processingText}>Processing payment...</Text>
          <Text style={styles.processingSubtext}>Please don't close this window</Text>
        </View>
      );
    }

    if (paymentStep === 'success') {
      return (
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={64} color="#34C759" />
          </View>
          <Text style={styles.successTitle}>Payment Successful!</Text>
          <Text style={styles.successText}>Your booking has been confirmed</Text>
        </View>
      );
    }

    if (paymentStep === 'error') {
      return (
        <View style={styles.errorContainer}>
          <View style={styles.errorIcon}>
            <Ionicons name="close-circle" size={64} color="#FF3B30" />
          </View>
          <Text style={styles.errorTitle}>Payment Failed</Text>
          <Text style={styles.errorText}>Please try again or contact support</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setPaymentStep('initial');
              handlePayment();
            }}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.paymentContent}>
        <View style={styles.paymentHeader}>
          <Text style={styles.paymentTitle}>Complete Payment</Text>
          <Text style={styles.paymentSubtitle}>Secure payment powered by Stripe</Text>
        </View>

        <View style={styles.amountContainer}>
          <Text style={styles.amountLabel}>Total Amount</Text>
          <Text style={styles.amountValue}>{formatAmount(amount)}</Text>
        </View>

        <View style={styles.paymentMethods}>
          <Text style={styles.methodsTitle}>Payment Methods</Text>
          
          <View style={styles.methodItem}>
            <View style={styles.methodIcon}>
              <Ionicons name="card" size={24} color="#007AFF" />
            </View>
            <View style={styles.methodInfo}>
              <Text style={styles.methodName}>Credit or Debit Card</Text>
              <Text style={styles.methodDescription}>Visa, Mastercard, American Express</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </View>

          <View style={styles.methodItem}>
            <View style={styles.methodIcon}>
              <Ionicons name="phone-portrait" size={24} color="#007AFF" />
            </View>
            <View style={styles.methodInfo}>
              <Text style={styles.methodName}>Apple Pay</Text>
              <Text style={styles.methodDescription}>Fast and secure</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </View>

          <View style={styles.methodItem}>
            <View style={styles.methodIcon}>
              <Ionicons name="logo-google" size={24} color="#007AFF" />
            </View>
            <View style={styles.methodInfo}>
              <Text style={styles.methodName}>Google Pay</Text>
              <Text style={styles.methodDescription}>Fast and secure</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </View>
        </View>

        <View style={styles.securityInfo}>
          <Ionicons name="shield-checkmark" size={16} color="#34C759" />
          <Text style={styles.securityText}>Your payment information is secure and encrypted</Text>
        </View>

        <TouchableOpacity
          style={[styles.payButton, loading && styles.payButtonDisabled]}
          onPress={handlePayment}
          disabled={loading}
        >
          <Text style={styles.payButtonText}>
            {loading ? 'Processing...' : `Pay ${formatAmount(amount)}`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleClose}
          disabled={loading}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            disabled={loading}
          >
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payment</Text>
          <View style={styles.headerSpacer} />
        </View>

        {renderPaymentContent()}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  closeButton: {
    padding: 8,
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  processingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successIcon: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#34C759',
    marginBottom: 8,
  },
  successText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorIcon: {
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  paymentContent: {
    flex: 1,
    padding: 20,
  },
  paymentHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  paymentTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  paymentSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  amountContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  amountLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  paymentMethods: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  methodsTitle: {
    fontSize: 18,
    fontWeight: '600',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  methodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  methodInfo: {
    flex: 1,
  },
  methodName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  methodDescription: {
    fontSize: 14,
    color: '#666',
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  securityText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  payButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  payButtonDisabled: {
    opacity: 0.5,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
  },
}); 