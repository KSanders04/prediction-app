import { ScrollView, View, Text, TouchableOpacity, StyleSheet, TextInput, RefreshControl, Alert, Modal } from "react-native";
import { router } from "expo-router";
import React, { useEffect, useState, useCallback } from "react";
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../firebaseConfig';

import { Group } from '@/types';
import {
  fetchActiveGroup,
  createGroupFunction,
  joinGroupFunction,
  closeGroupFunction,
  leaveGroupFunction
} from '../../components/firebaseFunctions';

const GroupCreateModal = ({
  isModalVisible,
  setIsModalVisible,
  groupName,
  setGroupName,
  handleCreateGroup
}: {
  isModalVisible: boolean;
  setIsModalVisible: (visible: boolean) => void;
  groupName: string;
  setGroupName: (name: string) => void;
  handleCreateGroup: () => Promise<void>;
}) => (
  <Modal
    animationType="slide"
    transparent={true}
    visible={isModalVisible}
    onRequestClose={() => setIsModalVisible(false)}
  >
    <View style={styles.modalContainer}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Create New Group</Text>
        <TextInput
          style={styles.modalInput}
          placeholder="Enter group name"
          value={groupName}
          onChangeText={setGroupName}
          placeholderTextColor="#7f8c8d"
        />
        <View style={styles.modalButtons}>
          <TouchableOpacity
            style={[styles.modalButton, styles.cancelButton]}
            onPress={() => {
              setIsModalVisible(false);
              setGroupName('');
            }}
          >
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modalButton, styles.createButton]}
            onPress={handleCreateGroup}
          >
            <Text style={styles.buttonText}>Create</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

const GroupMode = () => {
  const [groupCode, setGroupCode] = useState('');
  const [code, setCode] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [groupName, setGroupName] = useState('');

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Fetch active group when user changes
  const loadActiveGroup = useCallback(async () => {
  if (!currentUser) {
    setActiveGroup(null);
    return;
  }
  
  try {
    const group = await fetchActiveGroup(currentUser);
    setActiveGroup(group as Group); // ADD 'as Group' type assertion
  } catch (error) {
    console.error('Error loading active group:', error);
    setActiveGroup(null);
  }
  }, [currentUser]);


  useEffect(() => {
    loadActiveGroup();
  }, [loadActiveGroup]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadActiveGroup();
    setRefreshing(false);
  };

  // Join group handler
  const joinGroupButton = async () => {
    try {
      const result = await joinGroupFunction(code, currentUser);
      Alert.alert('Success', result);
      setCode('');
      await loadActiveGroup();
      router.push("../groupHome");
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to join group');
    }
  };

  // Create group handler
  const handleCreateGroup = async () => {
    try {
      const groupCode = await createGroupFunction(groupName, currentUser);
      Alert.alert('Success', `Group "${groupName}" created! Your group code is: ${groupCode}`);
      setIsModalVisible(false);
      setGroupName('');
      await loadActiveGroup();
      router.push("../groupHome");
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create group');
    }
  };

  // Show create modal (with validation)
  const createGroupButton = async () => {
    try {
      // The validation is now done inside createGroupFunction
      setIsModalVisible(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create group');
    }
  };

  // Close group handler
  const closeGroupButton = async () => {
    try {
      const result = await closeGroupFunction(currentUser);
      Alert.alert('Success', result);
      await loadActiveGroup();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to close group');
    }
  };

  // Leave group handler
  const leaveGroupButton = async () => {
    try {
      const result = await leaveGroupFunction(currentUser);
      Alert.alert('Success', result);
      await loadActiveGroup();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to leave group');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ alignItems: 'center', justifyContent: 'center' }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Groups</Text>

      {activeGroup ? (
        <TouchableOpacity
          style={styles.section}
          onPress={() => {
            router.push("../groupHome");
          }}
        >
          <Text style={styles.infoText}>
            Active Group Code: <Text style={{ fontWeight: 'bold' }}>{activeGroup.code}</Text>
          </Text>
          <Text style={styles.infoText}>
            Group Name: {activeGroup.groupName}
          </Text>
          <Text style={styles.infoText}>
            Group Admin: {activeGroup.createdBy}
          </Text>
          <Text style={styles.infoText}>
            Group Members: {activeGroup.members.length}
          </Text>
          {/* Show Close Group if admin, else Leave Group */}
          {activeGroup.createdBy === currentUser?.email ? (
            <TouchableOpacity style={styles.button} onPress={closeGroupButton}>
              <Text style={styles.buttonText}>Close Group</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.button} onPress={leaveGroupButton}>
              <Text style={styles.buttonText}>Leave Group</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      ) : (
        <View style={styles.section}>
          <Text style={styles.infoText}>You are not in any active group.</Text>
        </View>
      )}

      <View style={styles.section}>
        <TextInput
          style={styles.textInput}
          placeholder="Enter Group Code"
          value={code}
          onChangeText={setCode}
          placeholderTextColor="#7f8c8d"
        />

        <TouchableOpacity style={styles.button} onPress={joinGroupButton}>
          <Text style={styles.buttonText}>Join Group</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={createGroupButton}>
          <Text style={styles.buttonText}>Create Group</Text>
        </TouchableOpacity>
      </View>
      
      <GroupCreateModal
        isModalVisible={isModalVisible}
        setIsModalVisible={setIsModalVisible}
        groupName={groupName}
        setGroupName={setGroupName}
        handleCreateGroup={handleCreateGroup}
      />
    </ScrollView>
  );
};

export default GroupMode;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#F5F5F5",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 40,
    color: '#2c3e50',
    textAlign: 'center',
  },
  button: {
    width: "90%",
    padding: 20,
    backgroundColor: "#3498db",
    borderRadius: 12,
    marginVertical: 10,
    alignItems: "center",
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "600",
  },
  textInput: {
    height: 50,
    width: "90%",
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#ecf0f1",
    borderRadius: 12,
    marginVertical: 15,
    paddingHorizontal: 25,
    fontSize: 16,
    color: "#2c3e50",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  section: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 15,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    width: '90%',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
    color: '#34495e',
    backgroundColor: '#e8f4fd',
    padding: 10,
    borderRadius: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 15,
    width: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ecf0f1',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    padding: 12,
    borderRadius: 8,
    width: '45%',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
  },
  createButton: {
    backgroundColor: '#3498db',
  },
});