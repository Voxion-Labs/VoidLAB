"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type UserSocialLinks = { github: string; instagram: string; linkedin: string; x: string; };
export type UserProfile = { avatar: string; bio: string; email: string; githubConnected: boolean; githubLogin: string; id: string; name: string; phone: string; providers: { github: boolean; google: boolean; x: boolean; }; region: string; socials: UserSocialLinks; };
export type UserActivity = { createdAt: string; detail: string; id: string; title: string; type: "ai" | "command" | "profile" | "run" | "save" | "workspace"; };

type UserContextValue = { activities: UserActivity[]; isReady: boolean; logout: () => Promise<void>; profile: UserProfile | null; recordActivity: (activity: Omit<UserActivity, "createdAt" | "id">) => void; refreshProfile: () => Promise<UserProfile | null>; saveAvatar: (avatar: string) => void; saveProfile: (profile: Partial<Pick<UserProfile, "bio" | "phone" | "region" | "socials">>) => Promise<UserProfile | null>; };

const activityStorageKey = "voidlab-user-activities";
const profileStorageKey = "voidlab-local-profile";
const storageLimit = 40;

const defaultProfile: UserProfile = {
  id: "local-user-1",
  name: "Local Dev",
  email: "hacker@voidlab.local",
  avatar: "",
  bio: "Building the future, locally.",
  githubConnected: false,
  githubLogin: "",
  phone: "",
  providers: { github: false, google: false, x: false },
  region: "Localhost",
  socials: { github: "", instagram: "", linkedin: "", x: "" }
};

const UserContext = createContext<UserContextValue | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // 100% Backend-less Profile Load
    const storedProfile = window.localStorage.getItem(profileStorageKey);
    setProfile(storedProfile ? JSON.parse(storedProfile) : defaultProfile);

    const storedActivities = window.localStorage.getItem(activityStorageKey);
    if (storedActivities) setActivities(JSON.parse(storedActivities));
    
    setIsReady(true);
  }, []);

  const recordActivity = (activity: Omit<UserActivity, "createdAt" | "id">) => {
    const entry: UserActivity = { ...activity, createdAt: new Date().toISOString(), id: `act-${Date.now()}` };
    setActivities((current) => {
      const next = [entry, ...current].slice(0, storageLimit);
      window.localStorage.setItem(activityStorageKey, JSON.stringify(next));
      return next;
    });
  };

  const saveAvatar = (avatar: string) => {
    if (!profile) return;
    const updated = { ...profile, avatar };
    setProfile(updated);
    window.localStorage.setItem(profileStorageKey, JSON.stringify(updated));
  };

  const saveProfile = async (updates: Partial<Pick<UserProfile, "bio" | "phone" | "region" | "socials">>) => {
    if (!profile) return null;
    const updated = { ...profile, ...updates } as UserProfile;
    setProfile(updated);
    window.localStorage.setItem(profileStorageKey, JSON.stringify(updated));
    return updated;
  };

  const refreshProfile = async () => profile;
  
  const logout = async () => {
    window.localStorage.removeItem(profileStorageKey);
    setProfile(defaultProfile);
  };

  return (
    <UserContext.Provider value={{ activities, isReady, logout, profile, recordActivity, refreshProfile, saveAvatar, saveProfile }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used within UserProvider");
  return context;
}