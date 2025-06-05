import { Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, View, KeyboardAvoidingView, Platform, ScrollView, TouchableWithoutFeedback, Keyboard } from "react-native";
import React, { useState } from "react";
import { emailSignIn } from "@/components/firebaseFunctions";
import { router } from "expo-router";

const index = () => {
    // State for email and password input fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Handles user sign in with email and password
  const handleSignIn = async () => {
    try {
      const user = await emailSignIn(email, password);
      if (user) router.replace("/selectMode");
    } catch (error: any) {
      console.log(error);
      alert("Sign in failed: Wrong email or password");
    }
  };

  // Sign in with google import did not work on expo go, needs to be within use of expo dev client
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FAFAFA" }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            style={styles.container}
            contentContainerStyle={{
              alignItems: "center",
              justifyContent: "center",
              flexGrow: 1,
              paddingBottom: 40,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>Play By Play</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              placeholderTextColor="#3C4858"
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
            />
            <TextInput
              style={styles.textInput}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor="#3C4858"
              autoCapitalize="none"
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.button} onPress={handleSignIn} activeOpacity={0.8} testID="sign-in-button">
              <Text style={styles.text}>Sign In</Text>
            </TouchableOpacity>

            <View style={styles.createAccContainer}>
              <Text style={styles.createAccText}>Don't have an account?</Text>
              <TouchableOpacity onPress={() => router.push("/createAccount")}>
                <Text style={styles.createAccButtonText}> Create Account</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default index;

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  createAccButton: {
    width: "90%",
    marginVertical: 15,
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    shadowRadius: 5,
    elevation: 5,
  },
  text: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
createAccContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  createAccText: {
    color: "#34495e",
    fontSize: 16,
  },
  createAccButtonText: {
    color: "#5C6BC0",
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 4,
    textDecorationLine: "underline",
  },
});