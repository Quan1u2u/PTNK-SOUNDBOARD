import { AudioFileConfig, PtnkEventProfile } from "../types";

const DB_NAME = "PtnkEventPlaybackDB";
const DB_VERSION = 1;

export interface AppSettings {
  activeProfileId: string;
  masterVolume: number;
  crossfadeTime: number;
  fadeInTime: number;
  fadeOutTime: number;
  isDucked: boolean;
}

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains("config")) {
        db.createObjectStore("config");
      }
      if (!db.objectStoreNames.contains("audioFiles")) {
        db.createObjectStore("audioFiles");
      }
      if (!db.objectStoreNames.contains("profiles")) {
        db.createObjectStore("profiles", { keyPath: "id" });
      }
    };
  });
}

// Save binary audio blob
export async function saveAudioFile(id: string, fileBlob: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("audioFiles", "readwrite");
    const store = tx.objectStore("audioFiles");
    const req = store.put(fileBlob, id);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Get binary audio blob
export async function getAudioFile(id: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("audioFiles", "readonly");
    const store = tx.objectStore("audioFiles");
    const req = store.get(id);

    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

// Delete binary audio blob
export async function deleteAudioFile(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("audioFiles", "readwrite");
    const store = tx.objectStore("audioFiles");
    const req = store.delete(id);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Clear all audio files
export async function clearAllAudioFiles(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("audioFiles", "readwrite");
    const store = tx.objectStore("audioFiles");
    const req = store.clear();

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Save App settings
export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("config", "readwrite");
    const store = tx.objectStore("config");
    const req = store.put(settings, "appSettings");

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Get App settings
export async function getSettings(): Promise<AppSettings | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("config", "readonly");
    const store = tx.objectStore("config");
    const req = store.get("appSettings");

    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

// Save Profile
export async function saveProfile(profile: PtnkEventProfile): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("profiles", "readwrite");
    const store = tx.objectStore("profiles");
    const req = store.put(profile);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Get Profile by ID
export async function getProfile(id: string): Promise<PtnkEventProfile | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("profiles", "readonly");
    const store = tx.objectStore("profiles");
    const req = store.get(id);

    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

// Get All Profiles
export async function getAllProfiles(): Promise<PtnkEventProfile[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("profiles", "readonly");
    const store = tx.objectStore("profiles");
    const req = store.getAll();

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
