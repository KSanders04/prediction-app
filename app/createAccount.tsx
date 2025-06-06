import { Text, View, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, TouchableWithoutFeedback, Keyboard } from "react-native";
import React, { useState } from "react";
import { router } from "expo-router";
import { emailSignUp } from "@/components/firebaseFunctions";

const index = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [userName, setUserName] = useState("");

  const handleSignUp = async () => {
    try {
      await emailSignUp(email, password, firstName, lastName, userName);
      router.replace("/selectMode");
    } catch (error: any) {
      console.log(error);
      alert("Sign up failed: " + error.message);
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
            <Text style={styles.title}>Create An Account</Text>
            <View style={styles.nameContainer}>
              <TextInput
                style={styles.firstNameInput}
                placeholder="First Name"
                value={firstName}
                onChangeText={setFirstName}
                placeholderTextColor="#3C4858"
                returnKeyType="next"
              />
              <TextInput
                style={styles.lastNameInput}
                placeholder="Last Name"
                value={lastName}
                onChangeText={setLastName}
                placeholderTextColor="#3C4858"
                returnKeyType="next"
              />
            </View>
            <TextInput
              style={styles.textInput}
              placeholder="Username"
              value={userName}
              onChangeText={setUserName}
              placeholderTextColor="#3C4858"
              autoCapitalize="none"
              returnKeyType="next"
            />
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
            <TouchableOpacity style={styles.button} onPress={handleSignUp} activeOpacity={0.8}>
              <Text style={styles.text}>Create Account</Text>
            </TouchableOpacity>

            <View style={styles.signInContainer}>
              <Text style={styles.signInText}>Already have an account?</Text>
              <TouchableOpacity onPress={() => router.replace("/")}>
                <Text style={styles.signInButtonText}>Sign In</Text>
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
    backgroundColor: "#3949AB",
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
  signInContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  signInText: {
    color: "#34495e",
    fontSize: 16,
  },
  signInButtonText: {
    color: "#3949AB",
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 4,
    textDecorationLine: "underline",
  },
});