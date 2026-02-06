import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { env } from "./config.js";

let db: ReturnType<typeof getFirestore> | null = null;

const parseServiceAccount = () => {
  if (env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      return JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
    } catch {
      return null;
    }
  }

  if (env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    try {
      const decoded = Buffer.from(
        env.FIREBASE_SERVICE_ACCOUNT_BASE64,
        "base64"
      ).toString("utf8");
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }

  return null;
};

export function getAdminDb() {
  if (db) {
    return db;
  }

  const serviceAccount = parseServiceAccount();
  if (!serviceAccount) {
    return null;
  }

  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert(serviceAccount)
      });

  db = getFirestore(app);
  return db;
}

export { FieldValue };
