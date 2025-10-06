# ParkPal App Deployment Guide

## Prerequisites

1. **Stripe Account Setup**
   - Create a Stripe account at https://stripe.com
   - Get your test publishable key (starts with `pk_test_`)
   - Get your test secret key (starts with `sk_test_`)
   - For production, use live keys (starts with `pk_live_` and `sk_live_`)

2. **Firebase Project Setup**
   - Create a Firebase project at https://console.firebase.google.com
   - Enable Authentication, Firestore, and Storage
   - Get your Firebase configuration keys

3. **Environment Variables**
   Create a `.env` file in the root directory:
   ```env
   # Stripe Configuration
   EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
   STRIPE_SECRET_KEY=sk_test_your_secret_key_here

   # Firebase Configuration
   EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

## Features Implemented

### ✅ License Plate Management
- Add/edit/delete license plates
- Support for all US states
- Default plate selection
- Format validation

### ✅ Payment System (Stripe Integration)
- Real Stripe payment processing
- Multiple payment methods (Card, Apple Pay, Google Pay)
- Payment history tracking
- Automatic booking confirmation

### ✅ License Plate Verification
- Automatic verification against booking
- Manual verification by hosts
- Verification status tracking
- Dispute handling

### ✅ Complete Booking Flow
- Calendar-based time selection
- License plate association
- Payment processing
- Host verification
- Messaging system

## Development Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm start
   ```

3. **Run on Device/Simulator**
   ```bash
   # iOS
   npm run ios
   
   # Android
   npm run android
   
   # Web
   npm run web
   ```

## Production Deployment

### 1. Build for Production

**Install EAS CLI**
```bash
npm install -g @expo/eas-cli
```

**Login to Expo**
```bash
eas login
```

**Configure EAS**
```bash
eas build:configure
```

**Build for iOS**
```bash
eas build --platform ios --profile production
```

**Build for Android**
```bash
eas build --platform android --profile production
```

### 2. App Store Deployment

**Submit to App Store**
```bash
eas submit --platform ios
```

**Submit to Google Play**
```bash
eas submit --platform android
```

## Backend Setup (Required for Production)

### Stripe Webhook Setup

Create a backend endpoint to handle Stripe webhooks:

```javascript
// Example Node.js/Express endpoint
app.post('/webhook/stripe', express.raw({type: 'application/json'}), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      // Update booking status in Firestore
      await updateBookingStatus(paymentIntent.metadata.booking_id, 'confirmed');
      break;
    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      // Handle failed payment
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({received: true});
});
```

### Firebase Security Rules

Update your Firestore security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Listings can be read by anyone, written by hosts
    match /listings/{listingId} {
      allow read: if true;
      allow write: if request.auth != null && 
        request.auth.uid == resource.data.host_id;
    }
    
    // Bookings can be read/written by involved users
    match /bookings/{bookingId} {
      allow read, write: if request.auth != null && 
        (request.auth.uid == resource.data.user_id || 
         request.auth.uid == resource.data.host_id);
    }
    
    // Payments can be read/written by involved users
    match /payments/{paymentId} {
      allow read, write: if request.auth != null && 
        (request.auth.uid == resource.data.user_id || 
         request.auth.uid == resource.data.host_id);
    }
    
    // License plate verifications
    match /license_plate_verifications/{verificationId} {
      allow read, write: if request.auth != null;
    }
    
    // Messages
    match /messages/{messageId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Testing

### Test License Plate Verification

1. Create a booking with a license plate
2. As a host, go to the booking details
3. Use the license plate verification component
4. Test both automatic and manual verification

### Test Payment Flow

1. Create a booking
2. Complete the payment process
3. Verify booking status changes to "confirmed"
4. Check payment history

### Test User Roles

1. **Driver Flow**: Register → Add license plate → Browse listings → Book → Pay
2. **Host Flow**: Register → Create listing → Manage bookings → Verify license plates

## Troubleshooting

### Common Issues

1. **Stripe Keys Not Working**
   - Ensure you're using the correct test/live keys
   - Check that keys are properly set in environment variables
   - Verify Stripe account is activated

2. **Firebase Permission Errors**
   - Check Firestore security rules
   - Ensure user is authenticated
   - Verify user has correct role permissions

3. **License Plate Verification Issues**
   - Check that license plate format is valid
   - Ensure booking has associated license plate
   - Verify verification records are created

### Debug Mode

Enable debug logging by setting:
```javascript
// In your app configuration
console.log('Stripe Key:', process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY);
console.log('Firebase Config:', firebaseConfig);
```

## Production Checklist

- [ ] Replace test Stripe keys with live keys
- [ ] Set up production Firebase project
- [ ] Configure Stripe webhooks
- [ ] Update app store metadata
- [ ] Test all payment flows
- [ ] Verify license plate verification works
- [ ] Test on real devices
- [ ] Set up monitoring and analytics
- [ ] Configure push notifications
- [ ] Set up customer support

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review Firebase and Stripe documentation
3. Check app logs for error messages
4. Test with different user accounts and roles

## License

This project is licensed under the MIT License.
