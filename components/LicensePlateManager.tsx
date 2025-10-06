import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc, getDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

interface LicensePlate {
  id: string;
  plateNumber: string;
  state: string;
  isDefault: boolean;
  createdAt: string;
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

export default function LicensePlateManager() {
  const { user } = useAuth();
  const [licensePlates, setLicensePlates] = useState<LicensePlate[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [plateNumber, setPlateNumber] = useState('');
  const [selectedState, setSelectedState] = useState('CA');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadLicensePlates();
  }, []);

  const loadLicensePlates = async () => {
    if (!user?.uid) return;
    
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setLicensePlates(data.licensePlates || []);
      }
    } catch (error) {
      console.error('Error loading license plates:', error);
      Alert.alert('Error', 'Failed to load license plates');
    }
  };

  const validatePlateNumber = (plate: string): boolean => {
    // Remove spaces and convert to uppercase
    const cleanPlate = plate.replace(/\s/g, '').toUpperCase();
    
    // Basic validation: 2-8 characters, alphanumeric
    if (cleanPlate.length < 2 || cleanPlate.length > 8) {
      return false;
    }
    
    // Check if it contains only letters, numbers, and common symbols
    const validPattern = /^[A-Z0-9\-\.]+$/;
    return validPattern.test(cleanPlate);
  };

  const addLicensePlate = async () => {
    if (!user?.uid) return;
    
    const cleanPlate = plateNumber.replace(/\s/g, '').toUpperCase();
    
    if (!validatePlateNumber(cleanPlate)) {
      Alert.alert('Invalid Plate Number', 'Please enter a valid license plate number (2-8 characters, letters and numbers only)');
      return;
    }

    // Check for duplicates
    const isDuplicate = licensePlates.some(plate => 
      plate.plateNumber === cleanPlate && plate.state === selectedState
    );
    
    if (isDuplicate) {
      Alert.alert('Duplicate Plate', 'This license plate is already registered');
      return;
    }

    setLoading(true);
    try {
      const newPlate: LicensePlate = {
        id: Date.now().toString(),
        plateNumber: cleanPlate,
        state: selectedState,
        isDefault: licensePlates.length === 0, // First plate becomes default
        createdAt: new Date().toISOString(),
      };

      const updatedPlates = [...licensePlates, newPlate];
      
      await updateDoc(doc(db, 'users', user.uid), {
        licensePlates: updatedPlates,
        updatedAt: new Date(),
      });

      setLicensePlates(updatedPlates);
      setPlateNumber('');
      setModalVisible(false);
      Alert.alert('Success', 'License plate added successfully');
    } catch (error) {
      console.error('Error adding license plate:', error);
      Alert.alert('Error', 'Failed to add license plate');
    } finally {
      setLoading(false);
    }
  };

  const removeLicensePlate = async (plateId: string) => {
    if (!user?.uid) return;
    
    Alert.alert(
      'Remove License Plate',
      'Are you sure you want to remove this license plate?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedPlates = licensePlates.filter(plate => plate.id !== plateId);
              
              // If removing the default plate, make the first remaining plate default
              const removedPlate = licensePlates.find(plate => plate.id === plateId);
              if (removedPlate?.isDefault && updatedPlates.length > 0) {
                updatedPlates[0].isDefault = true;
              }
              
              await updateDoc(doc(db, 'users', user.uid), {
                licensePlates: updatedPlates,
                updatedAt: new Date(),
              });

              setLicensePlates(updatedPlates);
              Alert.alert('Success', 'License plate removed successfully');
            } catch (error) {
              console.error('Error removing license plate:', error);
              Alert.alert('Error', 'Failed to remove license plate');
            }
          },
        },
      ]
    );
  };

  const setDefaultPlate = async (plateId: string) => {
    if (!user?.uid) return;
    
    try {
      const updatedPlates = licensePlates.map(plate => ({
        ...plate,
        isDefault: plate.id === plateId,
      }));
      
      await updateDoc(doc(db, 'users', user.uid), {
        licensePlates: updatedPlates,
        updatedAt: new Date(),
      });

      setLicensePlates(updatedPlates);
      Alert.alert('Success', 'Default license plate updated');
    } catch (error) {
      console.error('Error setting default plate:', error);
      Alert.alert('Error', 'Failed to update default plate');
    }
  };

  const formatPlateNumber = (plate: string): string => {
    // Add spaces for better readability
    return plate.replace(/(.{3})/g, '$1 ').trim();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>License Plates</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.platesList}>
        {licensePlates.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="car-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No license plates registered</Text>
            <Text style={styles.emptySubtext}>Add your first license plate to get started</Text>
          </View>
        ) : (
          licensePlates.map((plate) => (
            <View key={plate.id} style={styles.plateItem}>
              <View style={styles.plateInfo}>
                <View style={styles.plateNumberContainer}>
                  <Text style={styles.plateNumber}>
                    {formatPlateNumber(plate.plateNumber)}
                  </Text>
                  <View style={styles.stateBadge}>
                    <Text style={styles.stateText}>{plate.state}</Text>
                  </View>
                </View>
                {plate.isDefault && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultText}>DEFAULT</Text>
                  </View>
                )}
              </View>
              
              <View style={styles.plateActions}>
                {!plate.isDefault && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => setDefaultPlate(plate.id)}
                  >
                    <Ionicons name="star-outline" size={20} color="#007AFF" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionButton, styles.removeButton]}
                  onPress={() => removeLicensePlate(plate.id)}
                >
                  <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add License Plate</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                disabled={loading}
              >
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>License Plate Number</Text>
              <TextInput
                style={styles.textInput}
                value={plateNumber}
                onChangeText={setPlateNumber}
                placeholder="Enter plate number"
                placeholderTextColor="#999"
                autoCapitalize="characters"
                maxLength={10}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>State</Text>
              <View style={styles.statePicker}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {US_STATES.map((state) => (
                    <TouchableOpacity
                      key={state}
                      style={[
                        styles.stateOption,
                        selectedState === state && styles.stateOptionSelected,
                      ]}
                      onPress={() => setSelectedState(state)}
                    >
                      <Text
                        style={[
                          styles.stateOptionText,
                          selectedState === state && styles.stateOptionTextSelected,
                        ]}
                      >
                        {state}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              onPress={addLicensePlate}
              disabled={loading}
            >
              <Text style={styles.saveButtonText}>
                {loading ? 'Adding...' : 'Add License Plate'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: '#007AFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  platesList: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  plateItem: {
    backgroundColor: '#fff',
    margin: 8,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  plateInfo: {
    flex: 1,
  },
  plateNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  plateNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  stateBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stateText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  defaultBadge: {
    backgroundColor: '#34C759',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  defaultText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  plateActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  removeButton: {
    backgroundColor: '#FFE5E5',
    borderRadius: 8,
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
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: '#333',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  statePicker: {
    marginTop: 8,
  },
  stateOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  stateOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  stateOptionText: {
    fontSize: 14,
    color: '#333',
  },
  stateOptionTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 