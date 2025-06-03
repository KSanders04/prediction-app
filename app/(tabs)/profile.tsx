import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { auth, db, storage } from '../../firebaseConfig'; // adjust path as needed
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import SignOut from './signout';

export default function Profile() {
  const [userData, setUserData] = useState<{ id: string; name: string; profilePic: string }>({
    id: '',
    name: '',
    profilePic: '',
  });
  const [uploading, setUploading] = useState(false);

  // Load user info from Firestore
  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserData({
          id: user.uid,
          name: data.name || data.email || `User_${user.uid.slice(0, 6)}`,
          profilePic: data.profilePic || '',
        });
      }
    };

    fetchUserData();
  }, []);

  const pickImageAndUpload = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'You need to give permission to access photos.');
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
      await uploadImage(imageUri);
    }
  };

  const uploadImage = async (uri: string) => {
    try {
      setUploading(true);
      const response = await fetch(uri);
      const blob = await response.blob();
      const user = auth.currentUser;
      if (!user) return;

      const storageRef = ref(storage, `profilePics/${user.uid}.jpg`);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);

      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { profilePic: downloadURL });

      setUserData((prev) => ({ ...prev, profilePic: downloadURL }));
    } catch (err) {
      console.error('Image upload failed:', err);
      Alert.alert('Upload failed', 'Could not upload image. Try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      {uploading ? (
        <ActivityIndicator size="large" color="#3498db" />
      ) : (
        <>
          {/* Profile & Stats */}
          <View style={styles.header}>
            <Image
              source={
                userData.profilePic
                  ? { uri: userData.profilePic }
                  : require('../../assets/images/head_alizarin.png')
              }
              style={styles.profileImage}
            />

            <View style={styles.statsContainer}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>0</Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>0</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>0</Text>
                <Text style={styles.statLabel}>Following</Text>
              </View>
            </View>
          </View>
          

          {/* Name & ID */}
          <Text style={styles.name}>{userData.name}</Text>
          <Text style={styles.id}>@{userData.id}</Text>

          {/* Edit Profile Button */}
          <TouchableOpacity style={styles.editButton} onPress={pickImageAndUpload}>
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>

          {/* Sign Out Button */}
          <View style={styles.signOutWrapper}>
            <SignOut />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    padding: 20,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#ecf0f1',
    marginRight: 20,
    borderWidth: 2,
    borderColor: '#3498db',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
  },
  statBox: {
    alignItems: 'center',
    marginHorizontal: 10,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  statLabel: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
    alignSelf: 'flex-start',
  },
  id: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 30,
    alignSelf: 'flex-start',
  },
  editButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#3498db',
    paddingHorizontal: 30,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  editButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  signOutWrapper: {
    alignItems: 'center',
    marginTop: 10,
  },
});
