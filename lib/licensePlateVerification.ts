import { db } from './firebase';
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';

export interface LicensePlateVerification {
  id: string;
  booking_id: string;
  license_plate: string;
  license_plate_state: string;
  verification_status: 'pending' | 'verified' | 'failed' | 'disputed';
  verified_by: 'host' | 'driver' | 'system' | 'admin';
  verified_at?: string;
  verification_method: 'manual' | 'automatic' | 'photo' | 'qr_code';
  verification_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface VerificationResult {
  success: boolean;
  message: string;
  confidence?: number;
  details?: any;
}

// Create a license plate verification record
export const createLicensePlateVerification = async (
  bookingId: string,
  licensePlate: string,
  licensePlateState: string
): Promise<string> => {
  try {
    const verificationData = {
      booking_id: bookingId,
      license_plate: licensePlate.toUpperCase().replace(/\s/g, ''),
      license_plate_state: licensePlateState.toUpperCase(),
      verification_status: 'pending',
      verified_by: 'system',
      verification_method: 'automatic',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const verificationRef = await addDoc(collection(db, 'license_plate_verifications'), verificationData);
    return verificationRef.id;
  } catch (error) {
    console.error('Error creating license plate verification:', error);
    throw error;
  }
};

// Verify license plate format and validity
export const validateLicensePlateFormat = (
  licensePlate: string,
  state: string
): VerificationResult => {
  const cleanPlate = licensePlate.toUpperCase().replace(/\s/g, '');
  
  // Basic format validation
  if (cleanPlate.length < 2 || cleanPlate.length > 8) {
    return {
      success: false,
      message: 'License plate must be 2-8 characters long',
    };
  }

  // Check for valid characters (letters, numbers, hyphens, periods)
  const validPattern = /^[A-Z0-9\-\.]+$/;
  if (!validPattern.test(cleanPlate)) {
    return {
      success: false,
      message: 'License plate contains invalid characters',
    };
  }

  // State-specific validation patterns (simplified)
  const statePatterns: { [key: string]: RegExp } = {
    'CA': /^[A-Z0-9]{1,7}$/, // California
    'NY': /^[A-Z0-9]{1,8}$/, // New York
    'TX': /^[A-Z0-9]{1,7}$/, // Texas
    'FL': /^[A-Z0-9]{1,7}$/, // Florida
    'IL': /^[A-Z0-9]{1,7}$/, // Illinois
    // Add more state patterns as needed
  };

  const pattern = statePatterns[state.toUpperCase()];
  if (pattern && !pattern.test(cleanPlate)) {
    return {
      success: false,
      message: `License plate format is not valid for ${state}`,
    };
  }

  return {
    success: true,
    message: 'License plate format is valid',
    confidence: 0.8,
  };
};

// Check if license plate matches booking
export const verifyLicensePlateForBooking = async (
  bookingId: string,
  providedLicensePlate: string,
  providedState: string
): Promise<VerificationResult> => {
  try {
    // Get booking details
    const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
    if (!bookingDoc.exists()) {
      return {
        success: false,
        message: 'Booking not found',
      };
    }

    const bookingData = bookingDoc.data();
    const expectedPlate = bookingData.license_plate?.toUpperCase().replace(/\s/g, '');
    const expectedState = bookingData.license_plate_state?.toUpperCase();
    const providedPlate = providedLicensePlate.toUpperCase().replace(/\s/g, '');
    const providedStateUpper = providedState.toUpperCase();

    // Exact match verification
    if (expectedPlate === providedPlate && expectedState === providedStateUpper) {
      // Update verification status
      await updateLicensePlateVerification(bookingId, 'verified', 'system', 'automatic');
      
      return {
        success: true,
        message: 'License plate matches booking',
        confidence: 1.0,
        details: {
          expected: { plate: expectedPlate, state: expectedState },
          provided: { plate: providedPlate, state: providedStateUpper },
        },
      };
    }

    // Partial match (same plate, different state)
    if (expectedPlate === providedPlate && expectedState !== providedStateUpper) {
      return {
        success: false,
        message: 'License plate matches but state is different',
        confidence: 0.5,
        details: {
          expected: { plate: expectedPlate, state: expectedState },
          provided: { plate: providedPlate, state: providedStateUpper },
        },
      };
    }

    // No match
    await updateLicensePlateVerification(bookingId, 'failed', 'system', 'automatic');
    
    return {
      success: false,
      message: 'License plate does not match booking',
      confidence: 0.0,
      details: {
        expected: { plate: expectedPlate, state: expectedState },
        provided: { plate: providedPlate, state: providedStateUpper },
      },
    };
  } catch (error) {
    console.error('Error verifying license plate:', error);
    return {
      success: false,
      message: 'Error during verification process',
    };
  }
};

// Update verification status
export const updateLicensePlateVerification = async (
  bookingId: string,
  status: LicensePlateVerification['verification_status'],
  verifiedBy: LicensePlateVerification['verified_by'],
  method: LicensePlateVerification['verification_method'],
  notes?: string
): Promise<void> => {
  try {
    // Find the verification record for this booking
    const verificationsRef = collection(db, 'license_plate_verifications');
    const verificationQuery = await getDocs(verificationsRef);
    
    let verificationId: string | null = null;
    verificationQuery.forEach((doc) => {
      if (doc.data().booking_id === bookingId) {
        verificationId = doc.id;
      }
    });

    if (verificationId) {
      const updateData: any = {
        verification_status: status,
        verified_by: verifiedBy,
        verification_method: method,
        updated_at: new Date().toISOString(),
      };

      if (status === 'verified' || status === 'failed') {
        updateData.verified_at = new Date().toISOString();
      }

      if (notes) {
        updateData.verification_notes = notes;
      }

      await updateDoc(doc(db, 'license_plate_verifications', verificationId), updateData);
    }
  } catch (error) {
    console.error('Error updating license plate verification:', error);
    throw error;
  }
};

// Get verification status for a booking
export const getLicensePlateVerification = async (
  bookingId: string
): Promise<LicensePlateVerification | null> => {
  try {
    const verificationsRef = collection(db, 'license_plate_verifications');
    const verificationQuery = await getDocs(verificationsRef);
    
    for (const doc of verificationQuery.docs) {
      const data = doc.data();
      if (data.booking_id === bookingId) {
        return {
          id: doc.id,
          ...data,
        } as LicensePlateVerification;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting license plate verification:', error);
    return null;
  }
};

// Manual verification by host
export const manualLicensePlateVerification = async (
  bookingId: string,
  isVerified: boolean,
  hostId: string,
  notes?: string
): Promise<void> => {
  const status = isVerified ? 'verified' : 'failed';
  await updateLicensePlateVerification(
    bookingId,
    status,
    'host',
    'manual',
    notes
  );
};

// Get verification status color for UI
export const getVerificationStatusColor = (status: LicensePlateVerification['verification_status']): string => {
  switch (status) {
    case 'pending':
      return '#f59e0b';
    case 'verified':
      return '#10b981';
    case 'failed':
      return '#ef4444';
    case 'disputed':
      return '#8b5cf6';
    default:
      return '#6b7280';
  }
};

// Get verification status text
export const getVerificationStatusText = (status: LicensePlateVerification['verification_status']): string => {
  switch (status) {
    case 'pending':
      return 'Pending Verification';
    case 'verified':
      return 'Verified';
    case 'failed':
      return 'Verification Failed';
    case 'disputed':
      return 'Disputed';
    default:
      return 'Unknown';
  }
};
