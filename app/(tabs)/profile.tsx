import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Image, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { auth, db, storage } from '../../firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import SignOut from './signout';
import { UserStats } from '../../components/userStats';

export default function Profile() {
  const [userData, setUserData] = useState({
    name: '', firstName: '', lastName: '', userName: '', profilePic: '',
    totalPoints: 0, correctPredictions: 0, totalPredictions: 0, gamesPlayed: 0, lastPlayed: null
  });
  const [uploading, setUploading] = useState(false);
  const [authUser, setAuthUser] = useState<any>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (!user) return;
      setAuthUser(user);

      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserData({
          name: data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim() || `User_${user.uid.slice(0, 6)}`,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          userName: data.userName || '',
          profilePic: data.profilePic || '',
          totalPoints: data.totalPoints || 0,
          correctPredictions: data.correctPredictions || 0,
          totalPredictions: data.totalPredictions || 0,
          gamesPlayed: data.gamesPlayed || 0,
          lastPlayed: data.lastPlayed || null,
        });
      }
    };
    fetchUserData();
  }, []);

  // Example helper functions (replace with your actual logic if needed)
  const getCurrentUserRank = () => 1; // Replace with real rank logic
  const getRankSuffix = (rank: number) => {
    if (rank % 100 >= 11 && rank % 100 <= 13) return 'th';
    switch (rank % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };
  const getAccuracy = (correct: number, total: number) =>
    total > 0 ? Math.round((correct / total) * 100) : 0;
  const formatLastPlayed = (timestamp: any) => {
    if (!timestamp) return 'Never';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
  };

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
    <ScrollView 
      style={styles.container}
      contentContainerStyle={{ alignItems: 'center', justifyContent: 'flex-start' }}
    >
      {uploading ? (
        <ActivityIndicator size="large" color="#3498db" />
      ) : (
        <>
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

          <View style={{ alignItems: 'center', marginBottom: -10 }}>
            <Text style={styles.name}>{userData.firstName} {userData.lastName}</Text>
            <Text style={styles.id}>{userData.userName}</Text>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>Friends</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>Groups</Text>
            </View>
          </View>

  <View style={{ marginTop: 10, width: '100%' }}>
    <UserStats
      currentUser={userData}
      authUser={authUser}
      getCurrentUserRank={getCurrentUserRank}
      getRankSuffix={getRankSuffix}
      getAccuracy={getAccuracy}
      formatLastPlayed={formatLastPlayed}
    />
  </View>
          <SignOut />
        </>
      )}
    </ScrollView>
  );
}


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
    marginBottom: 20,
    justifyContent: 'center',
    backgroundColor: '#ecf0f1',
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
  },
  statLabel: {
    fontSize: 14,
    color: '#7f8c8d',
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
});
