import React from "react";
import { createRoot } from "react-dom/client";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";
import App from "../../App";
// Credentials identify a synthetic user in the local emulator only.
await signInWithEmailAndPassword(
  auth,
  new URLSearchParams(location.search).get("staff")
    ? "beatakorzonek1@gmail.com"
    : "mywaymarcin@gmail.com",
  "local-preview-only",
);
createRoot(document.getElementById("root")!).render(<App />);
