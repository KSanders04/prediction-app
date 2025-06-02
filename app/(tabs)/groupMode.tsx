import { View, Text, TouchableOpacity, StyleSheet, TextInput } from "react-native";
import { router } from "expo-router";
import React from "react";

import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { updateDoc, doc } from 'firebase/firestore';
interface Group {
  code: string;
  createdAt: Date;
  createdBy: string;
  members: string[];
  groupStatus: 'active' | 'closed'; // Adjust based on your requirements
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

    if (!currentUser?.email) {
      alert('You must be logged in to join a group');
      return;
    }

    const groupsRef = collection(db, 'groups');
    const q = query(groupsRef, 
      where('code', '==', code)) // Ensure the group is active;
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      alert('Group not found. Please check the code and try again.');
      return;
    }

    

    const groupDoc = querySnapshot.docs[0];
    const groupData = groupDoc.data();
    if (groupData.createdBy === currentUser.email) {
      alert('You cannot join your own group. Please create a new group instead.');
      return;
    }

    // Check if group is inactive
    if (groupData.groupStatus === 'closed') {
      alert('This group is no longer active and cannot accept new members.');
      return;
    }
    // Check if user is already in the group
    if (groupData.members?.includes(currentUser.email)) {
      alert('You are already a member of this group');
      router.push("/home");
      return;
    }

    // Add user to members array
    const updatedMembers = [...(groupData.members || []), currentUser.email];
    
    // Update the document with new members list
    await updateDoc(doc(db, 'groups', groupDoc.id), {
      members: updatedMembers
    });

    console.log(`✅ User ${currentUser.email} added to group ${code}`);
    alert('Successfully joined the group!');
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
    const alreadyHasGroup = query(groupsRef, where('createdBy', '==', currentUser?.email), where('groupStatus', '==', 'active'));
    const alreadyHasGroupSnapshot = await getDocs(alreadyHasGroup);
    // Check if user already has an active group
    if (!alreadyHasGroupSnapshot.empty) {
      const existingGroup = alreadyHasGroupSnapshot.docs[0].data();
      alert('You already have an active group. Here is the code: ' + existingGroup.code);
      router.push("/home");
      return;
    }
      const inGroupCreateGroup = query(groupsRef, where('members', 'array-contains', currentUser?.email), where('groupStatus', '==', 'active'));
      const createGroupSnapshot = await getDocs(inGroupCreateGroup);

      if (!createGroupSnapshot.empty) {
        alert('You are already in a group. Please leave the group before creating a new one.');
        return;
      }


    // Create new group document
    const groupData: Group = {
      code: randomCode.toString(),
      createdAt: new Date(),
      createdBy: currentUser?.email || '',  // Assuming you have currentUser from auth
      members: [],
      groupStatus: 'active', // You can set this based on your requirements
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
  const closeGroupButton = async () => {

    try {
      const groupsRef = collection(db, 'groups');
      const q = query(groupsRef, where('createdBy', '==', currentUser?.email), where('groupStatus', '==', 'active'));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        alert('You do not have an active group to close.');
        return;
      }
      const groupDoc = querySnapshot.docs[0];
      const groupData = groupDoc.data() as Group;

      if (groupData.createdBy !== currentUser?.email) {
        alert('You can only close your own groups.');
        return;
      }

      // Update the group status to closed
      await updateDoc(doc(db, 'groups', groupDoc.id), {
        groupStatus: 'closed',
        members: [] // Optionally clear members if you want
      });

      alert('Group closed successfully.');
      router.push("/home");
    } catch (error) {
      console.error("Error closing group:", error);
    }
  }
  const leaveGroupButton = async () => {
    try {
      const groupsRef = collection(db, 'groups');
      const q = query(groupsRef, where('members', 'array-contains', currentUser?.email), where('groupStatus', '==', 'active'));
      const querySnapshot = await getDocs(q);
      // Find the group where the user is a member
      if (!currentUser?.email) {
        alert('You must be logged in to leave a group');
        return;
      }

      
      if (querySnapshot.empty) {
        alert('You are not a member of any active group.');
        return;
      }
      const groupDoc = querySnapshot.docs[0];
      const groupData = groupDoc.data() as Group;


      
      await updateDoc(doc(db, 'groups', groupDoc.id), {

        members: groupData.members.filter(member => member !== currentUser.email)

      });

      alert('You have successfully left your group.');
      router.push("/home");
    } catch (error) {
      console.error("Error closing group:", error);
    }
  }

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
      <TouchableOpacity style={styles.button} onPress={closeGroupButton}>
        <Text style={styles.buttonText}>Close Group</Text>
      </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={leaveGroupButton}>
        <Text style={styles.buttonText}>Leave Group</Text>
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
