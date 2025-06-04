import {Text,StyleSheet,TextInput,TouchableOpacity,SafeAreaView, KeyboardAvoidingView, Platform} from "react-native";
import React, { useState, useEffect } from "react";
import { auth, db } from "../firebaseConfig";
import {createUserWithEmailAndPassword,signInWithEmailAndPassword} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { doc, setDoc, getDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { View } from "@/components/Themed";

const index = () => {
    const [email, setEmail] = useState(""); // set up states for the email and password originally just empty strings
    const [password, setPassword] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [userName, setUserName] = useState("");

  const emailSignUp = async () => {
    try {
    //Check if username exists
    const usernameQuery = query(
      collection(db, 'users'),
      where('userName', '==', userName)
    );
    const usernameSnapshot = await getDocs(usernameQuery);
    console.log(usernameSnapshot.docs.length)

    if (!userName.trim()) {
      alert("Username cannot be empty.");
      return;
    }

    if (userName.trim().length < 6) {
        alert("Username must be at least 6 characters long.");
        return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      alert("First and last name cannot be empty.");
      return;
    }

    if (!email.trim() || !password.trim()) {
      alert("Email and password cannot be empty.");
      return;
    }

    if (!usernameSnapshot.empty) {
      alert("That username is already taken. Please choose another.");
      return;
    }

    if (password.length < 6) {
      alert("Password must be at least 6 characters long.");
      return;
    }

      //Check if email exists
      const emailQuery = query(
        collection(db, 'users'),
        where('email', '==', email)
      );
      const emailSnapshot = await getDocs(emailQuery);

      if (!emailSnapshot.empty) {
        alert("That email is already in use. Please choose another.");
        return;
      }

    //Account Creation
      const user = await createUserWithEmailAndPassword(auth, email, password); // take email and password and push to firebase
      const userCredential = user.user
      const userRef = doc(db, 'users', userCredential.uid)
      const userSnap = await getDoc(userRef)

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: userCredential.uid,
          firstName,
          lastName,
          userName,
          email: userCredential.email,
          createdAt: new Date().toISOString(),
          isAdmin: null,
          correctPredictions: 0,
          gamesPlayed: 0,
          totalPoints: 0,
          totalPredictions: 0
        });
      }

      router.replace("/selectMode")

    } catch (error: any) {
      console.log(error);
      alert("Sign up failed: " + error.message);
    }
  };
  

  // Sign in with google import did not work on expo go, needs to be within use of expo dev client
  return (
    <KeyboardAvoidingView style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Create An Account</Text>
          <View style={styles.nameContainer}>
            <TextInput
                style={styles.firstNameInput}
                placeholder="First Name"
                value={firstName}
                onChangeText={setFirstName}
                placeholderTextColor="#3C4858"
            />
            <TextInput
                style={styles.lastNameInput}
                placeholder="Last Name"
                value={lastName}
                onChangeText={setLastName}
                placeholderTextColor="#3C4858"
            />
          </View>
          <TextInput
              style={styles.textInput}
              placeholder="Username"
              value={userName}
              onChangeText={setUserName}
              placeholderTextColor="#3C4858"
          />
          <TextInput
              style={styles.textInput}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              placeholderTextColor="#3C4858"
          />
          <TextInput
              style={styles.textInput}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor="#3C4858"
          />
        <TouchableOpacity style={styles.button} onPress={(emailSignUp)}>
          <Text style={styles.text}>Create Account</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

export default index;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
  },
  nameContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: '90%',
    marginBottom: 10,
    backgroundColor: "#FAFAFA",
  },
  title: {
    fontSize: 29,
    fontWeight: "600",
    marginBottom: 40,
    color: "#1A237E",
    alignSelf: "center",
    letterSpacing: 2,
    textShadowColor: "#B0BEC5",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  headingTitle: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 8,
    color: "#3949AB",
    alignSelf: "flex-start",
    marginLeft: "5%",
    letterSpacing: 1,
  },
  subTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 50,
    color: "#5C6BC0",
    alignSelf: "flex-start",
    marginLeft: "5%",
    letterSpacing: 0.5,
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
  firstNameInput: {
    height: 50,
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderColor: "#E8EAF6",
    borderWidth: 2,
    borderRadius: 15,
    marginVertical: 0,
    paddingHorizontal: 25,
    fontSize: 16,
    color: "#3C4858",
    shadowColor: "#9E9E9E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  lastNameInput: {
    height: 50,
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderColor: "#E8EAF6",
    borderWidth: 2,
    borderRadius: 15,
    marginVertical: 0,
    paddingHorizontal: 25,
    fontSize: 16,
    color: "#3C4858",
    shadowColor: "#9E9E9E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  button: {
    width: "90%",
    marginVertical: 15,
    backgroundColor: "#5C6BC0",
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#5C6BC0",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 5,
  },
  text: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
});