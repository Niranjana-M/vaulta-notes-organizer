import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  setDoc
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { StudyResource, Subject, PRESET_SUBJECTS, ShareRecord } from '../types';
import { deleteFileFromStorage } from './storageService';

const SUBJECTS_COLLECTION = 'subjects';
const RESOURCES_COLLECTION = 'resources';

const LOCAL_SUBJECTS_KEY_PREFIX = 'vaulta_cache_subjects_';
const LOCAL_RESOURCES_KEY_PREFIX = 'vaulta_cache_resources_';

// Local Storage Helpers for Offline / Guest / Permission Resilience
function getLocalSubjects(userId: string): Subject[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_SUBJECTS_KEY_PREFIX}${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalSubjects(userId: string, subjects: Subject[]) {
  try {
    localStorage.setItem(`${LOCAL_SUBJECTS_KEY_PREFIX}${userId}`, JSON.stringify(subjects));
  } catch (e) {
    // ignore
  }
}

function getLocalResources(userId: string): StudyResource[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_RESOURCES_KEY_PREFIX}${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalResources(userId: string, resources: StudyResource[]) {
  try {
    localStorage.setItem(`${LOCAL_RESOURCES_KEY_PREFIX}${userId}`, JSON.stringify(resources));
  } catch (e) {
    // ignore
  }
}

// ==========================================
// SUBJECTS
// ==========================================

export async function fetchSubjects(userId: string): Promise<Subject[]> {
  try {
    const q = query(
      collection(db, SUBJECTS_COLLECTION),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    const subjects = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data()
    })) as Subject[];
    
    // Sort locally by name
    const sorted = subjects.sort((a, b) => a.name.localeCompare(b.name));
    saveLocalSubjects(userId, sorted);
    return sorted;
  } catch (error: any) {
    console.warn('Falling back to local subjects cache:', error);
    return getLocalSubjects(userId);
  }
}

export function subscribeSubjects(
  userId: string,
  onUpdate: (subjects: Subject[]) => void,
  onError: (error: Error) => void
) {
  // Emit local cache immediately so UI is responsive
  const cached = getLocalSubjects(userId);
  if (cached.length > 0) {
    onUpdate(cached);
  }

  const q = query(
    collection(db, SUBJECTS_COLLECTION),
    where('userId', '==', userId)
  );

  let isCancelled = false;

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      if (isCancelled) return;
      const subjects = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data()
      })) as Subject[];
      subjects.sort((a, b) => a.name.localeCompare(b.name));
      saveLocalSubjects(userId, subjects);
      onUpdate(subjects);
    },
    (err) => {
      if ((err as any)?.code === 'permission-denied' || err.message?.toLowerCase().includes('insufficient permissions')) {
        try {
          handleFirestoreError(err, OperationType.LIST, SUBJECTS_COLLECTION);
        } catch {
          // preserve error logging
        }
      }
      console.warn('Firestore subjects subscription notice (using local state):', err.message);
      // Seamlessly supply cached/local subjects on permission/network notice
      const local = getLocalSubjects(userId);
      onUpdate(local);
    }
  );

  return () => {
    isCancelled = true;
    unsubscribe();
  };
}

export async function createSubject(
  userId: string,
  data: { name: string; code?: string; description?: string; color?: string }
): Promise<Subject> {
  const docData = {
    userId,
    name: data.name.trim(),
    code: data.code?.trim() || '',
    description: data.description?.trim() || '',
    color: data.color || 'indigo',
    createdAt: Date.now()
  };

  let newId = 'subj_' + Math.random().toString(36).substring(2, 10);

  try {
    const docRef = await addDoc(collection(db, SUBJECTS_COLLECTION), docData);
    newId = docRef.id;
  } catch (error: any) {
    console.warn('Firestore subject write fallback to local storage:', error.message);
  }

  const createdSubject: Subject = {
    id: newId,
    ...docData
  };

  // Ensure local storage is updated
  const current = getLocalSubjects(userId);
  const updated = [...current.filter(s => s.id !== newId), createdSubject];
  updated.sort((a, b) => a.name.localeCompare(b.name));
  saveLocalSubjects(userId, updated);

  return createdSubject;
}

export async function updateSubject(
  subjectId: string,
  data: Partial<Omit<Subject, 'id' | 'userId' | 'createdAt'>>
): Promise<void> {
  try {
    const docRef = doc(db, SUBJECTS_COLLECTION, subjectId);
    await updateDoc(docRef, data);
  } catch (error: any) {
    console.warn('Firestore subject update fallback:', error.message);
  }

  // Update local cache across all subject storages
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(LOCAL_SUBJECTS_KEY_PREFIX)) {
      try {
        const subjects: Subject[] = JSON.parse(localStorage.getItem(key) || '[]');
        const idx = subjects.findIndex(s => s.id === subjectId);
        if (idx !== -1) {
          subjects[idx] = { ...subjects[idx], ...data };
          localStorage.setItem(key, JSON.stringify(subjects));
        }
      } catch (e) {
        // ignore
      }
    }
  }
}

export async function deleteSubject(subjectId: string): Promise<void> {
  try {
    const docRef = doc(db, SUBJECTS_COLLECTION, subjectId);
    await deleteDoc(docRef);
  } catch (error: any) {
    console.warn('Firestore subject delete fallback:', error.message);
  }

  // Remove from local cache
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(LOCAL_SUBJECTS_KEY_PREFIX)) {
      try {
        const subjects: Subject[] = JSON.parse(localStorage.getItem(key) || '[]');
        const filtered = subjects.filter(s => s.id !== subjectId);
        localStorage.setItem(key, JSON.stringify(filtered));
      } catch (e) {
        // ignore
      }
    }
  }
}

// Quick initialize sample/common college subjects if the user has 0 subjects
export async function seedSuggestedSubjects(userId: string): Promise<void> {
  for (const preset of PRESET_SUBJECTS) {
    await createSubject(userId, preset);
  }
}

// ==========================================
// RESOURCES
// ==========================================

export async function fetchResources(userId: string): Promise<StudyResource[]> {
  try {
    const q = query(
      collection(db, RESOURCES_COLLECTION),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    const resources = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data()
    })) as StudyResource[];

    const sorted = resources.sort((a, b) => (b.uploadDate || 0) - (a.uploadDate || 0));
    saveLocalResources(userId, sorted);
    return sorted;
  } catch (error: any) {
    console.warn('Falling back to local resources cache:', error);
    return getLocalResources(userId);
  }
}

export function subscribeResources(
  userId: string,
  onUpdate: (resources: StudyResource[]) => void,
  onError: (error: Error) => void
) {
  // Emit local cache immediately
  const cached = getLocalResources(userId);
  if (cached.length > 0) {
    onUpdate(cached);
  }

  const handleLocalUpdate = () => {
    const current = getLocalResources(userId);
    onUpdate(current);
  };

  window.addEventListener('vaulta_resources_updated', handleLocalUpdate);

  const q = query(
    collection(db, RESOURCES_COLLECTION),
    where('userId', '==', userId)
  );

  let isCancelled = false;

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      if (isCancelled) return;
      const resources = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data()
      })) as StudyResource[];
      resources.sort((a, b) => (b.uploadDate || 0) - (a.uploadDate || 0));
      saveLocalResources(userId, resources);
      onUpdate(resources);
    },
    (err) => {
      if ((err as any)?.code === 'permission-denied' || err.message?.toLowerCase().includes('insufficient permissions')) {
        try {
          handleFirestoreError(err, OperationType.LIST, RESOURCES_COLLECTION);
        } catch {
          // preserve error logging
        }
      }
      console.warn('Firestore resources subscription notice (using local state):', err.message);
      const local = getLocalResources(userId);
      onUpdate(local);
    }
  );

  return () => {
    isCancelled = true;
    window.removeEventListener('vaulta_resources_updated', handleLocalUpdate);
    unsubscribe();
  };
}

/**
 * Checks for existing duplicate file name or URL for this user
 */
export async function checkDuplicateResource(
  userId: string,
  fileNameOrUrl: string
): Promise<StudyResource | null> {
  const searchTarget = fileNameOrUrl.trim().toLowerCase();
  if (!searchTarget) return null;

  // Check local cache first
  const localList = getLocalResources(userId);
  for (const item of localList) {
    if (
      (item.fileName && item.fileName.toLowerCase() === searchTarget) ||
      (item.fileUrl && item.fileUrl.toLowerCase() === searchTarget)
    ) {
      return item;
    }
  }

  try {
    const q = query(
      collection(db, RESOURCES_COLLECTION),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as StudyResource;
      if (
        (data.fileName && data.fileName.toLowerCase() === searchTarget) ||
        (data.fileUrl && data.fileUrl.toLowerCase() === searchTarget)
      ) {
        return { id: docSnap.id, ...data };
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

export async function createResource(
  data: Omit<StudyResource, 'id'>
): Promise<StudyResource> {
  // Ensure fileUrl is safe for Firestore (never store massive base64 in Firestore doc)
  let safeFileUrl = data.fileUrl;
  if (safeFileUrl && safeFileUrl.startsWith('data:') && safeFileUrl.length > 50000) {
    safeFileUrl = data.storagePath || `local://${data.userId}/${Date.now()}_${data.fileName || 'file'}`;
  }

  const resourceData: Omit<StudyResource, 'id'> = {
    userId: data.userId,
    title: data.title || data.fileName || 'Untitled Resource',
    subjectId: data.subjectId,
    subjectName: data.subjectName || 'General',
    resourceType: data.resourceType,
    fileName: data.fileName || '',
    fileUrl: safeFileUrl,
    storagePath: data.storagePath || '',
    fileSize: data.fileSize || 0,
    mimeType: data.mimeType || '',
    uploadDate: data.uploadDate || Date.now(),
    description: data.description || '',
    tags: Array.isArray(data.tags) ? data.tags : [],
    isFavorite: Boolean(data.isFavorite)
  };

  console.log('[FirestoreService] Creating resource:', {
    title: resourceData.title,
    fileName: resourceData.fileName,
    resourceType: resourceData.resourceType,
    subjectId: resourceData.subjectId,
    fileSize: resourceData.fileSize,
    storagePath: resourceData.storagePath
  });

  let newId = 'res_' + Math.random().toString(36).substring(2, 10);

  try {
    const docRef = await addDoc(collection(db, RESOURCES_COLLECTION), resourceData);
    newId = docRef.id;
    console.log('[FirestoreService] Successfully created Firestore doc with ID:', newId);
  } catch (error: any) {
    console.warn('[FirestoreService] Firestore write notice, persisting in local storage cache:', error.message);
  }

  const created: StudyResource = {
    id: newId,
    ...resourceData
  };

  const current = getLocalResources(data.userId);
  const updated = [created, ...current.filter(r => r.id !== newId)];
  updated.sort((a, b) => (b.uploadDate || 0) - (a.uploadDate || 0));
  saveLocalResources(data.userId, updated);

  // Dispatch custom update event for immediate UI reflection
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vaulta_resources_updated'));
  }

  return created;
}

export async function updateResource(
  resourceId: string,
  data: Partial<Omit<StudyResource, 'id' | 'userId' | 'uploadDate'>>
): Promise<void> {
  try {
    const docRef = doc(db, RESOURCES_COLLECTION, resourceId);
    await updateDoc(docRef, data);
  } catch (error: any) {
    console.warn('Firestore resource update fallback:', error.message);
  }

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(LOCAL_RESOURCES_KEY_PREFIX)) {
      try {
        const list: StudyResource[] = JSON.parse(localStorage.getItem(key) || '[]');
        const idx = list.findIndex(r => r.id === resourceId);
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...data };
          localStorage.setItem(key, JSON.stringify(list));
        }
      } catch (e) {
        // ignore
      }
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vaulta_resources_updated'));
  }
}

export async function deleteResource(
  resourceId: string,
  storagePath?: string
): Promise<void> {
  try {
    // 1. Delete from Firestore
    const docRef = doc(db, RESOURCES_COLLECTION, resourceId);
    await deleteDoc(docRef);
  } catch (error: any) {
    console.warn('Firestore resource delete fallback:', error.message);
  }

  // 2. Delete associated file from Supabase Storage if present
  if (storagePath) {
    try {
      await deleteFileFromStorage(storagePath);
    } catch (e) {
      // ignore
    }
  }

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(LOCAL_RESOURCES_KEY_PREFIX)) {
      try {
        const list: StudyResource[] = JSON.parse(localStorage.getItem(key) || '[]');
        const filtered = list.filter(r => r.id !== resourceId);
        localStorage.setItem(key, JSON.stringify(filtered));
      } catch (e) {
        // ignore
      }
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vaulta_resources_updated'));
  }
}

export async function toggleFavoriteResource(
  resourceId: string,
  currentStatus: boolean
): Promise<void> {
  await updateResource(resourceId, {
    isFavorite: !currentStatus
  });
}

// Helper to clean undefined values recursively before writing to Firestore
function cleanFirestoreData<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = cleanFirestoreData(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Fetch a single study resource directly by its ID from Firestore.
 * Used for shared resource resolution and public access.
 */
export async function getResourceById(resourceId: string): Promise<StudyResource | null> {
  if (!resourceId) return null;

  try {
    const docRef = doc(db, RESOURCES_COLLECTION, resourceId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return {
        id: snap.id,
        ...snap.data()
      } as StudyResource;
    }
  } catch (error: any) {
    console.warn('[Firestore] Fetch resource by ID error:', error?.message);
    if (error?.code === 'permission-denied') {
      return null;
    }
    throw error;
  }

  return null;
}

// ==========================================
// SHARED RESOURCES
// ==========================================

const SHARES_COLLECTION = 'shares';
const LOCAL_SHARES_KEY_PREFIX = 'vaulta_cache_shares_';

/**
 * Fetch a single shared resource record by its unique shareId.
 * Supports public/unauthenticated access for reading the shared resource.
 */
export async function getShareRecord(shareId: string): Promise<ShareRecord | null> {
  if (!shareId || !shareId.trim()) return null;
  const cleanId = shareId.trim();

  // 1. Primary lookup: Query resources collection where shareId matches and isShared is true
  // Crucial: Firestore security rules allow unauthenticated reads only when isShared == true
  try {
    const q = query(
      collection(db, RESOURCES_COLLECTION),
      where('shareId', '==', cleanId),
      where('isShared', '==', true)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docSnap = snap.docs[0];
      const data = docSnap.data();
      const isEnabled = data.isShared !== false && data.shareEnabled !== false;
      const record: ShareRecord = {
        id: cleanId,
        shareId: cleanId,
        resourceId: docSnap.id,
        ownerId: data.userId,
        createdAt: data.sharedAt || data.uploadDate || Date.now(),
        enabled: isEnabled,
        resource: {
          id: docSnap.id,
          userId: data.userId,
          title: data.title || data.fileName || 'Shared Document',
          subjectId: data.subjectId || '',
          subjectName: data.subjectName || '',
          resourceType: data.resourceType || 'doc',
          fileName: data.fileName,
          fileUrl: data.fileUrl,
          storagePath: data.storagePath,
          fileSize: data.fileSize,
          mimeType: data.mimeType,
          uploadDate: data.uploadDate,
          description: data.description,
          tags: data.tags || [],
          isFavorite: false
        }
      };
      try {
        localStorage.setItem(`${LOCAL_SHARES_KEY_PREFIX}${cleanId}`, JSON.stringify(record));
      } catch (e) {
        // ignore
      }
      return record;
    }
  } catch (error: any) {
    console.warn('[Firestore] Query resources by shareId notice:', error?.message);
  }

  // 1b. Fallback query for authenticated owners if isShared was toggled
  try {
    const qOwner = query(
      collection(db, RESOURCES_COLLECTION),
      where('shareId', '==', cleanId)
    );
    const snapOwner = await getDocs(qOwner);
    if (!snapOwner.empty) {
      const docSnap = snapOwner.docs[0];
      const data = docSnap.data();
      const isEnabled = data.isShared !== false && data.shareEnabled !== false;
      const record: ShareRecord = {
        id: cleanId,
        shareId: cleanId,
        resourceId: docSnap.id,
        ownerId: data.userId,
        createdAt: data.sharedAt || data.uploadDate || Date.now(),
        enabled: isEnabled,
        resource: {
          id: docSnap.id,
          userId: data.userId,
          title: data.title || data.fileName || 'Shared Document',
          subjectId: data.subjectId || '',
          subjectName: data.subjectName || '',
          resourceType: data.resourceType || 'doc',
          fileName: data.fileName,
          fileUrl: data.fileUrl,
          storagePath: data.storagePath,
          fileSize: data.fileSize,
          mimeType: data.mimeType,
          uploadDate: data.uploadDate,
          description: data.description,
          tags: data.tags || [],
          isFavorite: false
        }
      };
      return record;
    }
  } catch (e) {
    // ignore
  }

  // 2. Secondary lookup: Direct document lookup in shares collection
  try {
    const docRef = doc(db, SHARES_COLLECTION, cleanId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      let resource = data.resource;
      // Always resolve original resource to get the freshest storagePath and fileUrl
      if (data.resourceId) {
        try {
          const freshRes = await getResourceById(data.resourceId);
          if (freshRes) {
            resource = {
              ...resource,
              ...freshRes,
              storagePath: freshRes.storagePath || resource?.storagePath,
              fileUrl: freshRes.fileUrl || resource?.fileUrl
            };
          }
        } catch (resErr) {
          // ignore
        }
      }
      const record: ShareRecord = {
        id: snap.id,
        shareId: data.shareId || snap.id,
        resourceId: data.resourceId,
        ownerId: data.ownerId,
        createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
        enabled: data.enabled !== false,
        resource: resource
      };
      try {
        localStorage.setItem(`${LOCAL_SHARES_KEY_PREFIX}${cleanId}`, JSON.stringify(record));
      } catch (e) {
        // ignore
      }
      return record;
    }
  } catch (error: any) {
    console.warn('[Firestore] Lookup shares collection notice:', error?.message);
  }

  // 3. Cache fallback
  try {
    const cached = localStorage.getItem(`${LOCAL_SHARES_KEY_PREFIX}${cleanId}`);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    // ignore
  }

  // Genuinely not found
  return null;
}

/**
 * Checks if a share record already exists for a specific resource.
 */
export async function getExistingShareRecordForResource(
  resourceId: string,
  ownerId?: string
): Promise<ShareRecord | null> {
  if (!resourceId) return null;
  const currentUid = auth.currentUser?.uid || ownerId;

  // 1. Check the resource document in Firestore directly
  try {
    const docRef = doc(db, RESOURCES_COLLECTION, resourceId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.shareId) {
        const isEnabled = data.isShared !== false && data.shareEnabled !== false;
        const record: ShareRecord = {
          id: data.shareId,
          shareId: data.shareId,
          resourceId: snap.id,
          ownerId: data.userId,
          createdAt: data.sharedAt || data.uploadDate || Date.now(),
          enabled: isEnabled,
          resource: {
            id: snap.id,
            userId: data.userId,
            title: data.title || data.fileName || 'Shared Document',
            subjectId: data.subjectId || '',
            subjectName: data.subjectName || '',
            resourceType: data.resourceType || 'doc',
            fileName: data.fileName,
            fileUrl: data.fileUrl,
            storagePath: data.storagePath,
            fileSize: data.fileSize,
            mimeType: data.mimeType,
            uploadDate: data.uploadDate,
            description: data.description,
            tags: data.tags || [],
            isFavorite: false
          }
        };
        try {
          localStorage.setItem(`${LOCAL_SHARES_KEY_PREFIX}${data.shareId}`, JSON.stringify(record));
        } catch (e) {}
        return record;
      }
    }
  } catch (e: any) {
    console.warn('[Firestore] Resource lookup for existing share notice:', e?.message);
  }

  // 2. Check local storage cache
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(LOCAL_SHARES_KEY_PREFIX)) {
      try {
        const item: ShareRecord = JSON.parse(localStorage.getItem(key) || '{}');
        if (item && item.resourceId === resourceId && (!currentUid || item.ownerId === currentUid)) {
          return item;
        }
      } catch (e) {
        // ignore
      }
    }
  }

  // 3. Query shares collection if available
  if (currentUid) {
    try {
      const q = query(
        collection(db, SHARES_COLLECTION),
        where('ownerId', '==', currentUid),
        where('resourceId', '==', resourceId)
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        const data = docSnap.data();
        const record: ShareRecord = {
          id: docSnap.id,
          shareId: data.shareId || docSnap.id,
          resourceId: data.resourceId,
          ownerId: data.ownerId,
          createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
          enabled: data.enabled !== false,
          resource: data.resource
        };
        return record;
      }
    } catch (error: any) {
      console.warn('[Firestore] Query shares notice:', error?.message);
    }
  }

  return null;
}

/**
 * Creates or retrieves the share record for a given resource.
 * Crucial: Persists the record in Firestore BEFORE returning, ensuring the link is live.
 */
export async function createOrGetShareRecord(
  resource: StudyResource,
  ownerId: string
): Promise<ShareRecord> {
  const currentAuthUid = auth.currentUser?.uid;
  const cleanOwnerId = currentAuthUid || ownerId || resource.userId || '';

  if (!resource || !resource.id) {
    throw new Error('A valid resource is required to create a share link.');
  }

  if (!cleanOwnerId) {
    throw new Error('You must be signed in to create a share link.');
  }

  // 1. Check if a share record already exists for this resource
  const existing = await getExistingShareRecordForResource(resource.id, cleanOwnerId);

  const resourceSnapshot = cleanFirestoreData({
    id: resource.id,
    userId: cleanOwnerId,
    title: resource.title || resource.fileName || 'Untitled Resource',
    subjectId: resource.subjectId || '',
    subjectName: resource.subjectName || '',
    resourceType: resource.resourceType || 'doc',
    fileName: resource.fileName || '',
    fileUrl: resource.fileUrl || '',
    storagePath: resource.storagePath || '',
    fileSize: typeof resource.fileSize === 'number' ? resource.fileSize : 0,
    mimeType: resource.mimeType || '',
    uploadDate: resource.uploadDate || Date.now(),
    description: resource.description || '',
    tags: Array.isArray(resource.tags) ? resource.tags : [],
    isFavorite: Boolean(resource.isFavorite)
  });

  if (existing && existing.shareId) {
    // If it exists, ensure sharing is enabled in Firestore
    const updated: ShareRecord = {
      ...existing,
      enabled: true,
      resource: resourceSnapshot
    };

    // Update resource in Firestore
    try {
      const resDocRef = doc(db, RESOURCES_COLLECTION, resource.id);
      await updateDoc(resDocRef, {
        shareId: existing.shareId,
        isShared: true,
        shareEnabled: true,
        sharedAt: Date.now()
      });
    } catch (e: any) {
      console.warn('[Firestore] Update resource share flag notice:', e?.message);
    }

    // Also attempt updating shares collection with setDoc merge
    try {
      const docRef = doc(db, SHARES_COLLECTION, existing.shareId);
      await setDoc(
        docRef,
        cleanFirestoreData({
          id: existing.shareId,
          shareId: existing.shareId,
          resourceId: resource.id,
          ownerId: cleanOwnerId,
          enabled: true,
          resource: resourceSnapshot
        }),
        { merge: true }
      );
    } catch (e: any) {
      console.warn('[Firestore] SetDoc shares collection notice:', e?.message);
    }

    try {
      localStorage.setItem(`${LOCAL_SHARES_KEY_PREFIX}${existing.shareId}`, JSON.stringify(updated));
    } catch (e) {}

    return updated;
  }

  // 2. Generate a unique URL-safe share ID
  const randomPart = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 8);
  const cleanPrefix = (resource.id || 'res').replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);
  const shareId = `sh_${cleanPrefix}_${randomPart}`;

  // 3. Persist directly to Firestore on the resource document
  const resDocRef = doc(db, RESOURCES_COLLECTION, resource.id);
  await updateDoc(resDocRef, {
    shareId,
    isShared: true,
    shareEnabled: true,
    sharedAt: Date.now()
  });

  // 4. Also write to shares collection (with try/catch so it doesn't fail if rule differs)
  const newRecordData = cleanFirestoreData({
    id: shareId,
    shareId,
    resourceId: resource.id,
    ownerId: cleanOwnerId,
    createdAt: Date.now(),
    enabled: true,
    resource: resourceSnapshot
  });

  try {
    const docRef = doc(db, SHARES_COLLECTION, shareId);
    await setDoc(docRef, newRecordData);
  } catch (e: any) {
    console.warn('[Firestore] SetDoc shares collection notice:', e?.message);
  }

  const createdRecord: ShareRecord = {
    id: shareId,
    shareId,
    resourceId: resource.id,
    ownerId: cleanOwnerId,
    createdAt: newRecordData.createdAt,
    enabled: true,
    resource: resourceSnapshot
  };

  try {
    localStorage.setItem(`${LOCAL_SHARES_KEY_PREFIX}${shareId}`, JSON.stringify(createdRecord));
  } catch (e) {}

  return createdRecord;
}

/**
 * Re-enables sharing for a share record.
 */
export async function enableShareRecord(shareId: string): Promise<void> {
  const cleanId = shareId.trim();

  // 1. Update resource document in Firestore
  try {
    const q = query(
      collection(db, RESOURCES_COLLECTION),
      where('shareId', '==', cleanId)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const resDocRef = doc(db, RESOURCES_COLLECTION, snap.docs[0].id);
      await updateDoc(resDocRef, {
        isShared: true,
        shareEnabled: true
      });
    }
  } catch (e: any) {
    console.warn('[Firestore] enableShareRecord on resource error:', e?.message);
  }

  // 2. Also update shares collection
  try {
    const docRef = doc(db, SHARES_COLLECTION, cleanId);
    await updateDoc(docRef, { enabled: true });
  } catch (e: any) {
    console.warn('[Firestore] enableShareRecord on shares error:', e?.message);
  }

  // 3. Update localStorage
  try {
    const raw = localStorage.getItem(`${LOCAL_SHARES_KEY_PREFIX}${cleanId}`);
    if (raw) {
      const item: ShareRecord = JSON.parse(raw);
      item.enabled = true;
      localStorage.setItem(`${LOCAL_SHARES_KEY_PREFIX}${cleanId}`, JSON.stringify(item));
    }
  } catch (e) {}
}

/**
 * Disables sharing for a share record.
 * Immediately invalidates the share link.
 */
export async function disableShareRecord(shareId: string): Promise<void> {
  const cleanId = shareId.trim();

  // 1. Update resource document in Firestore
  try {
    const q = query(
      collection(db, RESOURCES_COLLECTION),
      where('shareId', '==', cleanId)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const resDocRef = doc(db, RESOURCES_COLLECTION, snap.docs[0].id);
      await updateDoc(resDocRef, {
        isShared: false,
        shareEnabled: false
      });
    }
  } catch (e: any) {
    console.warn('[Firestore] disableShareRecord on resource error:', e?.message);
  }

  // 2. Also update shares collection
  try {
    const docRef = doc(db, SHARES_COLLECTION, cleanId);
    await updateDoc(docRef, { enabled: false });
  } catch (e: any) {
    console.warn('[Firestore] disableShareRecord on shares error:', e?.message);
  }

  // 3. Update localStorage
  try {
    const raw = localStorage.getItem(`${LOCAL_SHARES_KEY_PREFIX}${cleanId}`);
    if (raw) {
      const item: ShareRecord = JSON.parse(raw);
      item.enabled = false;
      localStorage.setItem(`${LOCAL_SHARES_KEY_PREFIX}${cleanId}`, JSON.stringify(item));
    }
  } catch (e) {}
}
