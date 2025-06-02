import { View, Text, TouchableOpacity, StyleSheet, TextInput } from "react-native";
import { router } from "expo-router";
import React from "react";

import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';

interface Group {
  code: string;
  createdAt: Date;
  createdBy: string;
  members: string[];
}

const SelectedMode = () => {

  const [groupcode, setGroupCode] = React.useState('');
  const [code, setCode] = React.useState("");
  const currentUser = auth.currentUser;

const joinGroupButton = async () => {
  try {
    if (!code.trim()) {
      alert('Please enter a group code');
      return;
    }

    const groupsRef = collection(db, 'groups');
    const q = query(groupsRef, where('code', '==', code));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      alert('Group not found. Please check the code and try again.');
      return;
    }

    // Group exists, proceed to home
    router.push("/home");
  } catch (error) {
    console.error("Error joining group:", error);
    alert('Failed to join group. Please try again.');
  }
};
  const createGroupButton = async () => { 
  try {
    const min = 100000;
    const max = 999999;
    const randomCode = Math.floor(Math.random() * (max - min + 1)) + min;
    
    // Check if code already exists
    const groupsRef = collection(db, 'groups');
    const q = query(groupsRef, where('code', '==', randomCode.toString()));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      alert('Code already exists, please try again');
      return;
    }

    // Create new group document
    const groupData: Group = {
      code: randomCode.toString(),
      createdAt: new Date(),
      createdBy: currentUser?.email || '',  // Assuming you have currentUser from auth
      members: []
    };

    await addDoc(collection(db, 'groups'), groupData);
    
    setGroupCode(randomCode.toString());
    alert(`Your group code is: ${randomCode}`);
    console.log("Group created with code:", randomCode);
    
    router.push("/home");
  } catch (error) {
    console.error("Error creating group:", error);
    alert('Failed to create group. Please try again.');
  }
};

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter Group Code</Text>
            <TextInput
              style={styles.textInput}
              placeholder="CODE"
              value={code}
              onChangeText={setCode}
            />
      <TouchableOpacity style={styles.button} onPress={joinGroupButton}>
        <Text style={styles.buttonText}>Join Group</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={createGroupButton}>
        <Text style={styles.buttonText}>Create Group</Text>
      </TouchableOpacity>

    </View>
  );
};

export default SelectedMode;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#F5F5F5",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 40,
  },
  button: {
    width: "90%",
    padding: 20,
    backgroundColor: "#3949AB",
    borderRadius: 12,
    marginVertical: 10,
    alignItems: "center",
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
    borderColor: "#E8EAF6",
    borderWidth: 2,
    borderRadius: 15,
    marginVertical: 15,
    paddingHorizontal: 25,
    fontSize: 16,
    color: "#3C4858",
    shadowColor: "#9E9E9E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});
