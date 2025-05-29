import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Image, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { auth, db, storage} from '../../firebaseConfig'; // adjust path to your config
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';


export default function Profile() {
  const [userData, setUserData] = useState({ id: '', name: '', profilePic: '' });
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
    // Ask for permission
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "You need to give permission to access photos.");
      return;
    }

    // Launch image picker
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

      // Update Firestore
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { profilePic: downloadURL });

      // Update local state
      setUserData((prev) => ({ ...prev, profilePic: downloadURL }));
    } catch (err) {
      console.error("Image upload failed:", err);
      Alert.alert("Upload failed", "Could not upload image. Try again.");
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
          <Image
            source={
              userData.profilePic
                ? { uri: userData.profilePic }
                : require('../../assets/images/head_alizarin.png') // fallback image
            }
            style={styles.profileImage}
          />

          <Text style={styles.name}>{userData.name}</Text>
          <Text style={styles.id}>ID: {userData.id}</Text>

          <TouchableOpacity style={styles.button} onPress={pickImageAndUpload}>
            <Text style={styles.buttonText}>Change Profile Picture</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 20,
    backgroundColor: '#ecf0f1',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
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
});
