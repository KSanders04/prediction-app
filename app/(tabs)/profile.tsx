import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, Image, TouchableOpacity, ActivityIndicator, Alert,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ProfileStats } from '../../components/profileStats';
import { User } from '@/types';
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
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {uploading ? (
        <ActivityIndicator size="large" color="#3949AB" />
      ) : (
        <>
          <TouchableOpacity onPress={pickImageAndUpload} style={styles.imageWrapper}>
            <Image
              source={userData.profilePic ? { uri: userData.profilePic } : require('../../assets/images/head_alizarin.png')}
              style={styles.profileImage}
            />
            <Text style={styles.changePhotoText}>Change Photo</Text>
          </TouchableOpacity>

          <Text style={styles.name}>{userData.firstName} {userData.lastName}</Text>
          <Text style={styles.username}>@{userData.userName}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>Friends</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{userData.groups ? userData.groups.length : 0}</Text>
              <Text style={styles.statLabel}>Groups</Text>
            </View>
          </View>

          <View style={styles.statsContainer}>
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
    backgroundColor: '#f9fafe',
  },
  scrollContent: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 60,
  },
  imageWrapper: {
    alignItems: 'center',
    marginBottom: 15,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#e0e0e0',
  },
  changePhotoText: {
    marginTop: 8,
    color: '#5C6BC0',
    fontSize: 14,
    fontWeight: '600',
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2c3e50',
    marginTop: 10,
  },
  username: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 10,
  },
  statBox: {
    alignItems: 'center',
    marginHorizontal: 20,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A237E',
  },
  statLabel: {
    fontSize: 14,
    color: '#607D8B',
  },
  statsContainer: {
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 10,
  },
});