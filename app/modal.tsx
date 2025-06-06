import { StyleSheet, TouchableOpacity, Text, View, Alert, TextInput, ScrollView } from 'react-native';
import SignOut from '../components/signout';
import { router } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { User } from '@/types';
import {
  fetchUserData,
  updateUsername,
  getCurrentUser,
} from '../components/firebaseFunctions';

export default function ModalScreen() {
  const [userData, setUserData] = useState<User>({
    id: '',
    name: '',
    firstName: '',
    lastName: '',
    userName: '',
    profilePic: '',
    totalPoints: 0,
    correctPredictions: 0,
    totalPredictions: 0,
    gamesPlayed: 0,
    lastPlayed: null,
    groups: [],
    email: '',
  });

  const [authUser, setAuthUser] = useState<any>(null);
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');

  useEffect(() => {
    const getUserData = async () => {
      const user = getCurrentUser();
      if (!user) return;
      setAuthUser(user);
      const data = await fetchUserData(user.uid);
      if (data) {
        setUserData({
          id: user.uid,
          name: data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim() || `User_${user.uid.slice(0, 6)}`,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          userName: data.userName || '',
          email: data.email || user.email || '',
          profilePic: data.profilePic || '',
          totalPoints: data.totalPoints || 0,
          correctPredictions: data.correctPredictions || 0,
          totalPredictions: data.totalPredictions || 0,
          gamesPlayed: data.gamesPlayed || 0,
          lastPlayed: data.lastPlayed || null,
          groups: data.groups || [],
        });
      }
    };
    getUserData();
  }, []);

  const handleUsernameUpdate = async () => {
    if (!newUsername.trim()) {
      Alert.alert('Invalid Username', 'Username cannot be empty.');
      return;
    }
    try {
      const user = getCurrentUser();
      if (!user) return;
      await updateUsername(user.uid, newUsername.trim());
      setUserData((prev) => ({ ...prev, userName: newUsername.trim() }));
      setEditingUsername(false);
      Alert.alert('Success', 'Username updated!');
    } catch (err) {
      Alert.alert('Error', 'Could not update username.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>⚙️Settings</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Username</Text>
        {!editingUsername ? (
          <View style={styles.rowBetween}>
            <Text style={styles.value}>{userData.userName || 'Not set'}</Text>
            <TouchableOpacity onPress={() => {
              setNewUsername(userData.userName || '');
              setEditingUsername(true);
            }}>
              <Text style={styles.editLink}>Edit</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.rowBetween}>
            <TextInput
              style={styles.input}
              value={newUsername}
              onChangeText={setNewUsername}
              placeholder="Enter new username"
              autoFocus
            />
            <View style={styles.inlineButtons}>
              <TouchableOpacity style={styles.saveButton} onPress={handleUsernameUpdate}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setEditingUsername(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Password</Text>
        <TouchableOpacity onPress={() => router.replace('/changePasswordPage')}>
          <Text style={styles.editLink}>Change</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Sign Out</Text>
        <SignOut />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    paddingTop: 60,
    flexGrow: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 30,
    color: '#2c3e50',
    alignSelf: 'center',
  },
  section: {
    marginBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEFF1',
    paddingBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#546E7A',
    marginBottom: 8,
  },
  value: {
    fontSize: 16,
    color: '#37474F',
  },
  editLink: {
    color: '#5C6BC0',
    fontWeight: '600',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  input: {
    borderBottomWidth: 1,
    borderColor: '#5C6BC0',
    flex: 1,
    paddingVertical: 4,
    marginRight: 10,
    fontSize: 16,
    color: '#263238',
  },
  inlineButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveButton: {
    backgroundColor: '#5C6BC0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  cancelButton: {
    backgroundColor: '#B0BEC5',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});