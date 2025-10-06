import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import {
  getLicensePlateVerification,
  manualLicensePlateVerification,
  verifyLicensePlateForBooking,
  getVerificationStatusColor,
  getVerificationStatusText,
  LicensePlateVerification,
} from '@/lib/licensePlateVerification';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface LicensePlateVerificationProps {
  bookingId: string;
  onVerificationComplete?: () => void;
}

export default function LicensePlateVerificationComponent({
  bookingId,
  onVerificationComplete,
}: LicensePlateVerificationProps) {
  const { user } = useAuth();
  const [verification, setVerification] = useState<LicensePlateVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [showManualVerification, setShowManualVerification] = useState(false);
  const [manualNotes, setManualNotes] = useState('');
  const [bookingData, setBookingData] = useState<any>(null);

  useEffect(() => {
    loadVerificationData();
  }, [bookingId]);

  const loadVerificationData = async () => {
    try {
      setLoading(true);
      
      // Load booking data
      const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
      if (bookingDoc.exists()) {
        setBookingData(bookingDoc.data());
      }
      
      // Load verification data
      const verificationData = await getLicensePlateVerification(bookingId);
      setVerification(verificationData);
    } catch (error) {
      console.error('Error loading verification data:', error);
      Alert.alert('Error', 'Failed to load verification data');
    } finally {
      setLoading(false);
    }
  };

  const handleAutomaticVerification = async () => {
    if (!bookingData) return;
    
    setVerifying(true);
    try {
      const result = await verifyLicensePlateForBooking(
        bookingId,
        bookingData.license_plate,
        bookingData.license_plate_state
      );
      
      if (result.success) {
        Alert.alert('Verification Successful', result.message);
      } else {
        Alert.alert('Verification Failed', result.message);
      }
      
      // Reload verification data
      await loadVerificationData();
      onVerificationComplete?.();
    } catch (error) {
      console.error('Error during automatic verification:', error);
      Alert.alert('Error', 'Failed to perform automatic verification');
    } finally {
      setVerifying(false);
    }
  };

  const handleManualVerification = async (isVerified: boolean) => {
    if (!user?.uid) return;
    
    try {
      await manualLicensePlateVerification(
        bookingId,
        isVerified,
        user.uid,
        manualNotes
      );
      
      Alert.alert(
        'Verification Updated',
        `License plate has been marked as ${isVerified ? 'verified' : 'failed'}`
      );
      
      setShowManualVerification(false);
      setManualNotes('');
      await loadVerificationData();
      onVerificationComplete?.();
    } catch (error) {
      console.error('Error during manual verification:', error);
      Alert.alert('Error', 'Failed to update verification');
    }
  };

  const formatLicensePlate = (plate: string): string => {
    return plate.replace(/(.{3})/g, '$1 ').trim();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={styles.loadingText}>Loading verification...</Text>
      </View>
    );
  }

  if (!bookingData) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={24} color="#FF3B30" />
        <Text style={styles.errorText}>Booking data not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="car-outline" size={24} color="#007AFF" />
        <Text style={styles.title}>License Plate Verification</Text>
      </View>

      <View style={styles.licensePlateInfo}>
        <View style={styles.plateContainer}>
          <Text style={styles.plateNumber}>
            {formatLicensePlate(bookingData.license_plate)}
          </Text>
          <View style={styles.stateBadge}>
            <Text style={styles.stateText}>{bookingData.license_plate_state}</Text>
          </View>
        </View>
      </View>

      {verification && (
        <View style={styles.verificationStatus}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusLabel}>Verification Status</Text>
            <View style={[
              styles.statusBadge,
              { backgroundColor: getVerificationStatusColor(verification.verification_status) }
            ]}>
              <Text style={styles.statusText}>
                {getVerificationStatusText(verification.verification_status)}
              </Text>
            </View>
          </View>
          
          {verification.verification_notes && (
            <Text style={styles.verificationNotes}>
              Notes: {verification.verification_notes}
            </Text>
          )}
          
          {verification.verified_at && (
            <Text style={styles.verifiedAt}>
              Verified: {new Date(verification.verified_at).toLocaleString()}
            </Text>
          )}
        </View>
      )}

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.button, styles.autoVerifyButton]}
          onPress={handleAutomaticVerification}
          disabled={verifying}
        >
          {verifying ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
          )}
          <Text style={styles.buttonText}>
            {verifying ? 'Verifying...' : 'Auto Verify'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.manualVerifyButton]}
          onPress={() => setShowManualVerification(true)}
        >
          <Ionicons name="person-outline" size={20} color="#fff" />
          <Text style={styles.buttonText}>Manual Verify</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showManualVerification}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowManualVerification(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manual Verification</Text>
              <TouchableOpacity onPress={() => setShowManualVerification(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Verify the license plate: {formatLicensePlate(bookingData.license_plate)} ({bookingData.license_plate_state})
            </Text>

            <TextInput
              style={styles.notesInput}
              value={manualNotes}
              onChangeText={setManualNotes}
              placeholder="Add verification notes (optional)"
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.rejectButton]}
                onPress={() => handleManualVerification(false)}
              >
                <Ionicons name="close-circle" size={20} color="#fff" />
                <Text style={styles.modalButtonText}>Reject</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.approveButton]}
                onPress={() => handleManualVerification(true)}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.modalButtonText}>Approve</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#FF3B30',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  licensePlateInfo: {
    marginBottom: 16,
  },
  plateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  plateNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginRight: 12,
    letterSpacing: 2,
  },
  stateBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  stateText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  verificationStatus: {
    marginBottom: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '500',
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
  verificationNotes: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  verifiedAt: {
    fontSize: 12,
    color: '#999',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  autoVerifyButton: {
    backgroundColor: '#007AFF',
  },
  manualVerifyButton: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 20,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  rejectButton: {
    backgroundColor: '#FF3B30',
  },
  approveButton: {
    backgroundColor: '#34C759',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
});
