import { initializeApp } from "firebase/app";
import {getFirestore} from "firebase/firestore";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getStorage } from 'firebase/storage'
const firebaseConfig = {
  apiKey: "AIzaSyCStXg0PgpO9S61Y65PFWWFTctcHdu5D7k",
  authDomain: "prediction-app-1fb7c.firebaseapp.com",
  projectId: "prediction-app-1fb7c",
  storageBucket: "prediction-app-1fb7c.firebasestorage.app",
  messagingSenderId: "182998242952",
  appId: "1:182998242952:web:ad6a38cd3bb19277eef13d",
  measurementId: "G-3DPR6ZBY5E"
};


const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});
export const db=getFirestore(app);
export const storage=getStorage(app);