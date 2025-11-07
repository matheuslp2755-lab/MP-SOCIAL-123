// FIX: Changed to a namespace import to potentially resolve module resolution issues with TypeScript/bundlers.
import * as firebaseApp from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  limit, 
  doc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp,
  getDoc,
  updateDoc,
  addDoc,
  orderBy,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

const firebaseConfig = {
    apiKey: "AIzaSyBscsAkO_yJYfVVtCBh3rNF8Cm51_HLW54",
    authDomain: "teste-rede-fcb99.firebaseapp.com",
    projectId: "teste-rede-fcb99",
    storageBucket: "teste-rede-fcb99.appspot.com",
    messagingSenderId: "1006477304115",
    appId: "1:1006477304115:web:e88d8e5f2e75d1b4df5e46"
};

// Initialize Firebase using the modular SDK
const app = firebaseApp.initializeApp(firebaseConfig);

// Get services for the initialized app
const auth = getAuth(app);
const db = getFirestore(app);
// Explicitly initialize Storage with the bucket URL provided by the user.
// This is a direct fix for the upload issue, ensuring we target the correct bucket.
const storage = getStorage(app, 'gs://teste-rede-fcb99.appspot.com');

const formatTimestamp = (timestamp: { seconds: number; nanoseconds: number } | null | undefined): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp.seconds * 1000);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return date.toLocaleDateString();
};

export { 
  auth, 
  db,
  storage,
  collection,
  query,
  where,
  getDocs,
  limit,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  ref,
  uploadBytes,
  getDownloadURL,
  getDoc,
  updateDoc,
  addDoc,
  orderBy,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  writeBatch,
  deleteObject,
  formatTimestamp
};