import { ScrollView, View, Text, TouchableOpacity, StyleSheet, TextInput, RefreshControl } from "react-native";
import { router } from "expo-router";
import React from "react";
import { arrayUnion, arrayRemove } from 'firebase/firestore';

import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { updateDoc, doc } from 'firebase/firestore';
import { useEffect, useState } from "react";
interface Group {
  code: string;
  createdAt: Date;
  createdBy: string;
  members: string[];
  groupStatus: 'active' | 'closed'; // Adjust based on your requirements
  isAdmin: boolean;
  adminId: string;

}

const SelectedMode = () => {

  const [groupcode, setGroupCode] = useState('');
  const [code, setCode] = useState("");
  const currentUser = auth.currentUser;
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  

    const fetchActiveGroup = async () => {
      if (!currentUser) return;
      const groupsRef = collection(db, 'groups');
      // Find group where user is admin or member and group is active
      const q = query(
        groupsRef,
        where('groupStatus', '==', 'active'),
        where('members', 'array-contains', currentUser.uid)
      );
      const snapshot = await getDocs(q);

      // Also check if user is admin (createdBy)
      const adminQ = query(
        groupsRef,
        where('groupStatus', '==', 'active'),
        where('createdBy', '==', currentUser.email)
      );
      const adminSnapshot = await getDocs(adminQ);

      if (!snapshot.empty) {
        setActiveGroup(snapshot.docs[0].data() as Group);
      } else if (!adminSnapshot.empty) {
        setActiveGroup(adminSnapshot.docs[0].data() as Group);
      } else {
        setActiveGroup(null);
      }
  };

useEffect(() => {
  fetchActiveGroup();
}, [currentUser]);

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
      router.push("../groupHome");
      return;
    }

    // Add user to members array
    const updatedMembers = [...(groupData.members || []), currentUser.uid];
    
    // Update the document with new members list
    await updateDoc(doc(db, 'groups', groupDoc.id), {
      members: updatedMembers
    });

    //update user's groups array in Firestore ---
    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, {
      groups: arrayUnion(groupDoc.id)
    });
    // ---------------------------------------------------------

    console.log(`✅ User ${currentUser.email} added to group ${code}`);
    alert('Successfully joined the group!');
    router.push("../groupHome");
  } catch (error) {
    console.error("Error joining group:", error);
    alert('Failed to join group. Please try again.');
  }
};


  const onRefresh = async () => {
    setRefreshing(true);
    await fetchActiveGroup();
    setRefreshing(false);
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
      router.push("../groupHome");
      return;
    }
      const inGroupCreateGroup = query(groupsRef, where('members', 'array-contains', currentUser?.uid), where('groupStatus', '==', 'active'));
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
      isAdmin: true,
      adminId: currentUser?.uid || '',
    };

    await addDoc(collection(db, 'groups'), groupData);
    
    setGroupCode(randomCode.toString());
    alert(`Your group code is: ${randomCode}`);
    console.log("Group created with code:", randomCode);
    
    router.push("../groupHome");
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
      const q = query(groupsRef, where('members', 'array-contains', currentUser?.uid), where('groupStatus', '==', 'active'));
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

      //REMOVE group from user's groups array ---
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        groups: arrayRemove(groupDoc.id)
      });

      await fetchActiveGroup();

      // --------------------------------------------

      alert('You have successfully left your group.');
      router.push("/home");
    } catch (error) {
      console.error("Error closing group:", error);
    }
  }

  return (
    <ScrollView 
    style={styles.container}
    contentContainerStyle={{ alignItems: 'center', justifyContent: 'center' }}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Groups</Text>

      {activeGroup ? (
        <TouchableOpacity style={
          styles.section} 
          onPress={() => {
          router.push("../groupHome");
        }}>
          <Text style={styles.infoText}>
            Active Group Code: <Text style={{fontWeight: 'bold'}}>{activeGroup.code}</Text>
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

        <TouchableOpacity style={styles.button} onPress={closeGroupButton}>
          <Text style={styles.buttonText}>Close Group</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

export default SelectedMode;

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
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#2c3e50',
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
  welcomeText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#7f8c8d',
    fontStyle: 'italic',
  },
  gameButton: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
    width: '90%',
  },
  selectedGameButton: {
    borderLeftColor: '#27ae60',
    backgroundColor: '#f8fff8',
  },
  gameButtonContent: {
    flex: 1,
  },
  gameButtonTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  gameButtonSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 3,
  },
  selectedBadge: {
    position: 'absolute',
    top: 15,
    right: 15,
    backgroundColor: '#27ae60',
    color: 'white',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 'bold',
  }
});

function fetchActiveGames() {
  throw new Error("Function not implemented.");
}
