import {
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import React, { useState, useEffect } from "react";
import { auth, db } from "../firebaseConfig";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { doc, setDoc, getDoc } from 'firebase/firestore';




const index = () => {
  const [email, setEmail] = useState(""); // set up states for the email and password originally just empty strings
  const [password, setPassword] = useState("");

  const emailSignIn = async () => {
    try {
      const user = await signInWithEmailAndPassword(auth, email, password); // take email and password and push to firebase
      if (user) router.replace("/(tabs)/home"); // if user exists send them to the next page
      const userCredential = user.user
      const userRef = doc(db, 'users', userCredential.uid)
      const userSnap = await getDoc(userRef)

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: userCredential.uid,
          email: userCredential.email,
          createdAt: new Date().toISOString(),
          isAdmin: null,
          correctPredictions: 0,
          gamesPlayed: 0,
          totalPoints: 0,
          totalPredictions: 0
        })
      }
    } catch (error: any) {
      console.log(error);
      alert("Sign in failed: " + error.message);
    }
  };

  const emailSignUp = async () => {
    try {
      const user = await createUserWithEmailAndPassword(auth, email, password); // take email and password and push to firebase
      if (user) router.replace("/(tabs)/home"); // if user exists send them to the next page
      const userCredential = user.user
      const userRef = doc(db, 'users', userCredential.uid)
      const userSnap = await getDoc(userRef)

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: userCredential.uid,
          email: userCredential.email,
          createdAt: new Date().toISOString(),
          isAdmin: null,
          correctPredictions: 0,
          gamesPlayed: 0,
          totalPoints: 0,
          totalPredictions: 0
        })
      }
    } catch (error: any) {
      console.log(error);
      alert("Sign in failed: " + error.message);
    }
  };

  // Sign in with google import did not work on expo go, needs to be within use of expo dev client
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Login</Text>
      <TextInput
        style={styles.textInput}
        placeholder="email"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.textInput}
        placeholder="password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity style={styles.button} onPress={emailSignIn}>
        <Text style={styles.text}>Login</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={emailSignUp}>
        <Text style={styles.text}>Make Account</Text>
      </TouchableOpacity>
    </SafeAreaView>
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
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 40,
    color: "#1A237E",
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
