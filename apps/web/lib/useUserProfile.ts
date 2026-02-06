"use client";

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb, isFirebaseConfigured } from "./firebase";
import { seedUserData } from "./seedUser";
import type { PlanId } from "./plans";

export type SelectedBot = { name: string; area: string };

type UserProfile = {
  plan?: PlanId;
  email?: string;
  selectedBots?: SelectedBot[];
  selectedBotName?: string;
  selectedBotArea?: string;
  whatsappNumber?: string;
  smsNumber?: string;
  paymentDueAt?: unknown;
  nextBillingAt?: unknown;
  createdAt?: unknown;
};

const normalizeSelectedBots = (data: UserProfile): SelectedBot[] => {
  if (Array.isArray(data.selectedBots)) {
    return data.selectedBots
      .filter((item) => item?.name && item?.area)
      .map((item) => ({ name: item.name, area: item.area }));
  }

  if (data.selectedBotName && data.selectedBotArea) {
    return [{ name: data.selectedBotName, area: data.selectedBotArea }];
  }

  return [];
};

export const useUserProfile = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [selectedBots, setSelectedBots] = useState<SelectedBot[]>([]);
  const [loading, setLoading] = useState(true);
  const seededRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    const auth = getFirebaseAuth();
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeDoc?.();
      if (!user) {
        setUserId(null);
        setProfile(null);
        setSelectedBots([]);
        setLoading(false);
        return;
      }

      setUserId(user.uid);
      if (seededRef.current !== user.uid) {
        seededRef.current = user.uid;
        seedUserData({ uid: user.uid, email: user.email }).catch(() => null);
      }
      const db = getFirebaseDb();
      setLoading(true);
      unsubscribeDoc = onSnapshot(doc(db, "users", user.uid), (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          setProfile(data);
          setSelectedBots(normalizeSelectedBots(data));
        } else {
          setProfile(null);
          setSelectedBots([]);
        }
        setLoading(false);
      });
    });

    return () => {
      unsubscribeDoc?.();
      unsubscribeAuth();
    };
  }, []);

  return { userId, profile, selectedBots, loading };
};
