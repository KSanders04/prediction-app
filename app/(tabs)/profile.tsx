import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, Image, TouchableOpacity, ActivityIndicator, Alert,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ProfileStats } from '../../components/profileStats';
import { User } from '@/types'; // Import User type
import {
  fetchUserData,
  uploadProfileImage,
  getCurrentUser,
  getCurrentUserRank,
  getRankSuffix,
  getAccuracy,
  formatLastPlayed
} from '../../components/firebaseFunctions';

export default function Profile() {
  // Update userData to match User type
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
  
  const [uploading, setUploading] = useState(false);
  const [authUser, setAuthUser] = useState<any>(null);

  useEffect(() => {
    const getUserData = async () => {
      const user = getCurrentUser();
      if (!user) return;
      setAuthUser(user);
      const data = await fetchUserData(user.uid);
      if (data) {
        // Map the fetched data to match User type
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

  // Image picker and upload
  const pickImageAndUpload = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "You need to give permission to access photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) {
      const imageUri = result.assets[0].uri;
      await handleUploadImage(imageUri);
    }
  };

  const handleUploadImage = async (uri: string) => {
    try {
      setUploading(true);
      const user = getCurrentUser();
      if (!user) return;
      const downloadURL = await uploadProfileImage(user.uid, uri);
      setUserData((prev) => ({ ...prev, profilePic: downloadURL }));
    } catch (err) {
      console.error("Image upload failed:", err);
      Alert.alert("Upload failed", "Could not upload image. Try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ alignItems: 'center', justifyContent: 'flex-start' }}
    >
      {uploading ? (
        <ActivityIndicator size="large" color="#3498db" />
      ) : (
        <>
          {/* Profile Picture */}
          <TouchableOpacity onPress={pickImageAndUpload}>
            <Image
              source={
                userData.profilePic
                  ? { uri: userData.profilePic }
                  : require('../../assets/images/head_alizarin.png')
              }
              style={styles.profileImage}
            />
          </TouchableOpacity>

          {/* Name */}
          <View style={{ alignItems: 'flex-start', marginBottom: -10 }}>
            <Text style={styles.name}>{userData.firstName} {userData.lastName}</Text>
          </View>

          {/* Friends & Groups Stats */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20, marginBottom: -10 }}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>Friends</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>
                {userData.groups ? userData.groups.length : 0}
              </Text>
              <Text style={styles.statLabel}>Groups</Text>
            </View>
          </View>

          {/* Profile Stats - Now properly typed */}
          <View style={{ marginTop: 10, width: '100%' }}>
            <ProfileStats
              currentUser={userData}
              authUser={authUser}
              getCurrentUserRank={getCurrentUserRank}
              getRankSuffix={getRankSuffix}
              getAccuracy={getAccuracy}
              formatLastPlayed={formatLastPlayed}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

Profile.navigationOptions = {
  headerShown: false,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    padding: 20,
    paddingTop: 60,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 10,
    justifyContent: 'center',
    backgroundColor: '#ecf0f1',
    marginTop: -55,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  statBox: {
    alignItems: 'center',
    marginHorizontal: 15,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginTop: 10,
  },
  statLabel: {
    fontSize: 14,
    color: 'black',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    paddingTop: 10,
  },
  id: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#3498db',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  usernameInput: {
    borderBottomWidth: 1,
    borderColor: '#3498db',
    fontSize: 14,
    padding: 4,
    color: 'black',
  },
  saveButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 5,
    marginRight: 5,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  cancelButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 5,
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  editUsernameButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 5,
    alignSelf: 'center',
    marginLeft: 10,
    height: 32,
    justifyContent: 'center',
  },
  editUsernameButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});