import { getApps, initializeApp } from "firebase/app";

export const firebaseConfig = {
  apiKey: "AIzaSyCwMbT6fgxyQNH7c2642oh5eVrvgvHL4yQ",
  authDomain: "zones-cloud.firebaseapp.com",
  projectId: "zones-cloud",
  storageBucket: "zones-cloud.appspot.com",
  messagingSenderId: "336371362626",
  appId: "1:336371362626:web:81190ca1dbc91d460e76db",
  measurementId: "G-NC4PLYNRM0",
};

export function firebaseDisabledForRuntime() {
  return (
    process.env.NEXT_PUBLIC_GLITCH_DISABLE_GCP === "1" ||
    process.env.GLITCH_DISABLE_GCP === "1" ||
    process.env.NEXT_PUBLIC_GLITCH_RUNTIME === "1" ||
    process.env.GLITCH_RUNTIME === "1"
  );
}

export function initializeFirebaseIfNeeded() {
  if (firebaseDisabledForRuntime()) {
    return;
  }
  if (getApps().length > 0) {
    return;
  }
  initializeApp(firebaseConfig);
}
