# ParkPal - Parking Space Marketplace

ParkPal is a comprehensive mobile application that serves as a two-sided marketplace for parking spaces. The app connects parking space hosts with drivers looking for convenient parking spots, featuring license plate registration and secure payment processing.

## Features

### 🚗 **License Plate Management**
- Add and manage multiple vehicle license plates
- Support for all US states
- Set default license plate for quick booking
- License plate validation and formatting
- Secure storage in user profile

### 💳 **Payment System**
- Secure payment processing with Stripe integration
- Multiple payment methods (Credit/Debit cards, Apple Pay, Google Pay)
- Payment history and transaction tracking
- Automatic booking confirmation upon successful payment
- Refund processing capabilities

### 🏠 **Parking Space Management**
- Create and manage parking space listings
- Upload photos and detailed descriptions
- Set pricing per hour
- Configure availability schedules
- Real-time availability updates

### 📅 **Booking System**
- Calendar-based time slot selection
- Real-time availability checking
- Booking confirmation and management
- License plate association with bookings
- Booking status tracking (pending, confirmed, cancelled, completed)

### 👥 **User Management**
- Role-based authentication (Host/Driver)
- User profiles with contact information
- Public profile viewing
- Secure authentication with Firebase

### 💬 **Communication**
- In-app messaging between hosts and drivers
- Booking notifications
- Payment confirmations
- Status updates

### 📱 **Mobile-First Design**
- Native iOS and Android support
- Responsive design
- Intuitive user interface
- Offline capability for basic features

## Tech Stack

- **Frontend**: React Native with Expo
- **Backend**: Firebase (Authentication, Firestore, Storage)
- **Payment Processing**: Stripe
- **Navigation**: Expo Router
- **State Management**: React Context API
- **UI Components**: Custom themed components
- **Maps**: React Native Maps
- **Image Handling**: Expo Image Picker

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- Firebase account
- Stripe account (for payment processing)

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/ParkPalApp.git
   cd ParkPalApp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   - Create a new Firebase project
   - Enable Authentication, Firestore, and Storage
   - Update `lib/firebase.ts` with your Firebase configuration

4. **Configure Stripe** (for production)
   - Create a Stripe account
   - Add your Stripe publishable key to the app
   - Set up webhook endpoints for payment processing

5. **Update app configuration**
   - Update `app.json` with your app details
   - Configure bundle identifiers for iOS and Android
   - Set up EAS project ID in `eas.json`

## Development

### Start the development server
```bash
npm start
```

### Run on iOS simulator
```bash
npm run ios
```

### Run on Android emulator
```bash
npm run android
```

### Run on web
```bash
npm run web
```

## Project Structure

```
ParkPalApp/
├── app/                    # Main application screens
│   ├── (tabs)/            # Tab navigation screens
│   ├── auth/              # Authentication screens
│   ├── booking/           # Booking management
│   ├── listing/           # Listing management
│   ├── profile/           # User profile screens
│   └── payments.tsx       # Payment history
├── components/            # Reusable components
│   ├── LicensePlateManager.tsx
│   ├── PaymentSheet.tsx
│   └── ui/               # UI components
├── lib/                  # Utility libraries
│   ├── firebase.ts       # Firebase configuration
│   ├── payments.ts       # Payment processing
│   ├── bookings.ts       # Booking management
│   └── listings.ts       # Listing management
├── contexts/             # React contexts
│   └── AuthContext.tsx   # Authentication context
└── constants/            # App constants
    └── Colors.ts         # Color definitions
```

## Firebase Setup

### Firestore Collections

1. **users**
   - `uid`: User ID
   - `email`: User email
   - `role`: 'host' or 'driver'
   - `displayName`: Display name
   - `description`: User description
   - `contactInfo`: Contact information
   - `licensePlates`: Array of license plates
   - `createdAt`: Account creation date
   - `updatedAt`: Last update date

2. **listings**
   - `id`: Listing ID
   - `host_id`: Host user ID
   - `title`: Listing title
   - `description`: Listing description
   - `address`: Parking location
   - `price_per_hour`: Hourly rate
   - `availability`: Availability schedule
   - `images`: Array of image URLs
   - `createdAt`: Listing creation date

3. **bookings**
   - `id`: Booking ID
   - `user_id`: Driver user ID
   - `host_id`: Host user ID
   - `listing_id`: Listing ID
   - `start_time`: Booking start time
   - `end_time`: Booking end time
   - `total_price`: Total booking cost
   - `status`: Booking status
   - `license_plate`: Associated license plate
   - `license_plate_state`: License plate state
   - `createdAt`: Booking creation date

4. **payments**
   - `id`: Payment ID
   - `booking_id`: Associated booking ID
   - `user_id`: Payer user ID
   - `host_id`: Payee user ID
   - `amount`: Payment amount
   - `currency`: Payment currency
   - `status`: Payment status
   - `payment_intent_id`: Stripe payment intent ID
   - `createdAt`: Payment creation date

5. **messages**
   - `id`: Message ID
   - `booking_id`: Associated booking ID
   - `sender_id`: Sender user ID
   - `receiver_id`: Receiver user ID
   - `content`: Message content
   - `createdAt`: Message creation date

## Deployment

### Using EAS Build

1. **Install EAS CLI**
   ```bash
   npm install -g @expo/eas-cli
   ```

2. **Login to Expo**
   ```bash
   eas login
   ```

3. **Configure EAS**
   ```bash
   eas build:configure
   ```

4. **Build for production**
   ```bash
   # iOS
   eas build --platform ios --profile production
   
   # Android
   eas build --platform android --profile production
   ```

### App Store Deployment

1. **Submit to App Store**
   ```bash
   eas submit --platform ios
   ```

2. **Submit to Google Play**
   ```bash
   eas submit --platform android
   ```

## Security Rules

### Firestore Security Rules
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
  }
}
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, email support@parkpal.app or create an issue in the GitHub repository.

## Roadmap

- [ ] Push notifications
- [ ] Advanced search and filtering
- [ ] Real-time map integration
- [ ] Social features (reviews, ratings)
- [ ] Subscription plans for hosts
- [ ] Analytics dashboard
- [ ] Multi-language support
- [ ] Accessibility improvements

---

**ParkPal** - Making parking easier, one space at a time.
