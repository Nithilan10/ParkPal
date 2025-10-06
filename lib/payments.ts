import { db, auth } from './firebase';
import { collection, addDoc, doc, updateDoc, getDoc, getDocs, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { STRIPE_PUBLISHABLE_KEY, getStripeErrorMessage } from './stripe';

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'requires_capture' | 'canceled' | 'succeeded';
  client_secret: string;
}

export interface PaymentMethod {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  billing_details?: {
    name: string;
    email: string;
  };
}

export interface Payment {
  id: string;
  booking_id: string;
  user_id: string;
  host_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  payment_intent_id?: string;
  payment_method_id?: string;
  license_plate?: string;
  license_plate_state?: string;
  created_at: string;
  updated_at: string;
  refunded_at?: string;
}

// Create a payment intent for a booking
export const createPaymentIntent = async (bookingId: string, amount: number): Promise<PaymentIntent> => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User must be authenticated to create payment');
    }

    // Get booking details
    const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
    if (!bookingDoc.exists()) {
      throw new Error('Booking not found');
    }

    const bookingData = bookingDoc.data();
    
    // Create payment record in Firestore
    const paymentData = {
      booking_id: bookingId,
      user_id: currentUser.uid,
      host_id: bookingData.host_id,
      amount: amount,
      currency: 'usd',
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const paymentRef = await addDoc(collection(db, 'payments'), paymentData);

    // Create Stripe Payment Intent via your backend
    // For now, we'll use a mock response, but in production you should call your backend
    const mockPaymentIntent: PaymentIntent = {
      id: `pi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount: amount * 100, // Stripe uses cents
      currency: 'usd',
      status: 'requires_payment_method',
      client_secret: `pi_${Date.now()}_secret_${Math.random().toString(36).substr(2, 9)}`,
    };

    // TODO: Replace with actual Stripe API call to your backend
    // const response = await fetch('https://your-backend.com/create-payment-intent', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     amount: amount * 100,
    //     currency: 'usd',
    //     booking_id: bookingId,
    //     user_id: currentUser.uid
    //   })
    // });
    // const paymentIntent = await response.json();

    // Update payment record with payment intent ID
    await updateDoc(doc(db, 'payments', paymentRef.id), {
      payment_intent_id: mockPaymentIntent.id,
    });

    return mockPaymentIntent;
  } catch (error) {
    console.error('Error creating payment intent:', error);
    throw error;
  }
};

// Confirm a payment
export const confirmPayment = async (paymentIntentId: string, paymentMethodId: string): Promise<Payment> => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User must be authenticated to confirm payment');
    }

    // Find the payment record
    const paymentsRef = collection(db, 'payments');
    const paymentsQuery = query(
      paymentsRef,
      where('payment_intent_id', '==', paymentIntentId),
      where('user_id', '==', currentUser.uid)
    );
    
    const paymentsSnapshot = await getDocs(paymentsQuery);

    if (paymentsSnapshot.empty) {
      throw new Error('Payment not found');
    }

    const paymentDoc = paymentsSnapshot.docs[0];
    const paymentData = paymentDoc.data();

    // In a real app, you would call your backend to confirm the payment with Stripe
    // For now, we'll simulate a successful payment
    const updatedPaymentData = {
      ...paymentData,
      status: 'completed',
      payment_method_id: paymentMethodId,
      updated_at: new Date().toISOString(),
    };

    await updateDoc(doc(db, 'payments', paymentDoc.id), updatedPaymentData);

    // Update booking status to confirmed
    await updateDoc(doc(db, 'bookings', paymentData.booking_id), {
      status: 'confirmed',
      payment_id: paymentDoc.id,
      updated_at: serverTimestamp(),
    });

    return {
      id: paymentDoc.id,
      ...updatedPaymentData,
    } as Payment;
  } catch (error) {
    console.error('Error confirming payment:', error);
    throw error;
  }
};

// Get payment by ID
export const getPayment = async (paymentId: string): Promise<Payment | null> => {
  try {
    const paymentDoc = await getDoc(doc(db, 'payments', paymentId));
    if (!paymentDoc.exists()) {
      return null;
    }

    return {
      id: paymentDoc.id,
      ...paymentDoc.data(),
    } as Payment;
  } catch (error) {
    console.error('Error getting payment:', error);
    throw error;
  }
};

// Get payments for a user
export const getUserPayments = async (userId: string): Promise<Payment[]> => {
  try {
    const paymentsRef = collection(db, 'payments');
    const paymentsQuery = query(
      paymentsRef,
      where('user_id', '==', userId),
      orderBy('created_at', 'desc')
    );
    
    const paymentsSnapshot = await getDocs(paymentsQuery);

    return paymentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as Payment));
  } catch (error) {
    console.error('Error getting user payments:', error);
    throw error;
  }
};

// Get payments for a host
export const getHostPayments = async (hostId: string): Promise<Payment[]> => {
  try {
    const paymentsRef = collection(db, 'payments');
    const paymentsQuery = query(
      paymentsRef,
      where('host_id', '==', hostId),
      orderBy('created_at', 'desc')
    );
    
    const paymentsSnapshot = await getDocs(paymentsQuery);

    return paymentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as Payment));
  } catch (error) {
    console.error('Error getting host payments:', error);
    throw error;
  }
};

// Process refund
export const processRefund = async (paymentId: string, amount?: number): Promise<Payment> => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User must be authenticated to process refund');
    }

    const paymentDoc = await getDoc(doc(db, 'payments', paymentId));
    if (!paymentDoc.exists()) {
      throw new Error('Payment not found');
    }

    const paymentData = paymentDoc.data();

    // Check if user is authorized to refund (host or admin)
    if (paymentData.user_id !== currentUser.uid && paymentData.host_id !== currentUser.uid) {
      throw new Error('Not authorized to refund this payment');
    }

    // In a real app, you would call your backend to process the refund with Stripe
    // For now, we'll simulate a successful refund
    const updatedPaymentData = {
      ...paymentData,
      status: 'refunded',
      refunded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await updateDoc(doc(db, 'payments', paymentId), updatedPaymentData);

    // Update booking status if it's a full refund
    if (!amount || amount >= paymentData.amount) {
      await updateDoc(doc(db, 'bookings', paymentData.booking_id), {
        status: 'cancelled',
        updated_at: serverTimestamp(),
      });
    }

    return {
      id: paymentId,
      ...updatedPaymentData,
    } as Payment;
  } catch (error) {
    console.error('Error processing refund:', error);
    throw error;
  }
};

// Format amount for display
export const formatAmount = (amount: number, currency: string = 'usd'): string => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  });
  return formatter.format(amount / 100); // Convert cents to dollars
};

// Get payment status color
export const getPaymentStatusColor = (status: Payment['status']): string => {
  switch (status) {
    case 'pending':
      return '#f59e0b';
    case 'processing':
      return '#3b82f6';
    case 'completed':
      return '#10b981';
    case 'failed':
      return '#ef4444';
    case 'refunded':
      return '#6b7280';
    default:
      return '#6b7280';
  }
}; 