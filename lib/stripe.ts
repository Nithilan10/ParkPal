import { StripeProvider, useStripe } from '@stripe/stripe-react-native';

// Stripe configuration
export const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_your_key_here';

// Stripe payment methods
export const PAYMENT_METHODS = {
  CARD: 'card',
  APPLE_PAY: 'apple_pay',
  GOOGLE_PAY: 'google_pay',
} as const;

// Payment intent configuration
export const PAYMENT_INTENT_CONFIG = {
  currency: 'usd',
  automatic_payment_methods: {
    enabled: true,
  },
} as const;

// Error messages
export const STRIPE_ERRORS = {
  CARD_DECLINED: 'Your card was declined. Please try a different payment method.',
  INSUFFICIENT_FUNDS: 'Your card has insufficient funds.',
  EXPIRED_CARD: 'Your card has expired. Please use a different card.',
  INCORRECT_CVC: 'Your card\'s security code is incorrect.',
  PROCESSING_ERROR: 'An error occurred while processing your payment. Please try again.',
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
} as const;

// Helper function to get user-friendly error messages
export const getStripeErrorMessage = (error: any): string => {
  if (error?.code) {
    switch (error.code) {
      case 'card_declined':
        return STRIPE_ERRORS.CARD_DECLINED;
      case 'insufficient_funds':
        return STRIPE_ERRORS.INSUFFICIENT_FUNDS;
      case 'expired_card':
        return STRIPE_ERRORS.EXPIRED_CARD;
      case 'incorrect_cvc':
        return STRIPE_ERRORS.INCORRECT_CVC;
      case 'processing_error':
        return STRIPE_ERRORS.PROCESSING_ERROR;
      default:
        return error.message || STRIPE_ERRORS.PROCESSING_ERROR;
    }
  }
  return error?.message || STRIPE_ERRORS.PROCESSING_ERROR;
};
