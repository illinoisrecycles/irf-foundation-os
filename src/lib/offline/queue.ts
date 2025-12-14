/**
 * Offline Queue Utility for Background Sync
 * 
 * Queues actions when offline and syncs when connection is restored.
 * Uses IndexedDB for persistence.
 */

interface QueuedAction {
  id?: number
  type: string
  payload: Record<string, any>
  timestamp: number
  attempts: number
  maxAttempts: number
}

const DB_NAME = 'foundationos-offline'
const STORE_NAME = 'action-queue'
const DB_VERSION = 1

let db: IDBDatabase | null = null

async function openDB(): Promise<IDBDatabase> {
  if (db) return db

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
      }
    }
  })
}

export async function enqueueAction(
  type: string,
  payload: Record<string, any>,
  maxAttempts = 5
): Promise<number> {
  const database = await openDB()

  const action: QueuedAction = {
    type,
    payload,
    timestamp: Date.now(),
    attempts: 0,
    maxAttempts
  }

  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.add(action)

    request.onsuccess = () => {
      const id = request.result as number
      
      // Request background sync if available
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready.then(registration => {
          (registration as any).sync.register('sync-actions')
        })
      }
      
      resolve(id)
    }
    request.onerror = () => reject(request.error)
  })
}

export async function getQueuedActions(): Promise<QueuedAction[]> {
  const database = await openDB()

  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function removeQueuedAction(id: number): Promise<void> {
  const database = await openDB()

  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.delete(id)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function updateQueuedAction(
  id: number,
  updates: Partial<QueuedAction>
): Promise<void> {
  const database = await openDB()

  return new Promise(async (resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    
    const getRequest = store.get(id)
    getRequest.onsuccess = () => {
      const action = { ...getRequest.result, ...updates }
      const putRequest = store.put(action)
      putRequest.onsuccess = () => resolve()
      putRequest.onerror = () => reject(putRequest.error)
    }
    getRequest.onerror = () => reject(getRequest.error)
  })
}

export async function processQueue(): Promise<{
  processed: number
  failed: number
}> {
  const actions = await getQueuedActions()
  let processed = 0
  let failed = 0

  for (const action of actions) {
    if (action.attempts >= action.maxAttempts) {
      // Max attempts reached, remove from queue
      await removeQueuedAction(action.id!)
      failed++
      continue
    }

    try {
      // Attempt to sync the action
      const success = await syncAction(action)

      if (success) {
        await removeQueuedAction(action.id!)
        processed++
      } else {
        await updateQueuedAction(action.id!, { attempts: action.attempts + 1 })
        failed++
      }
    } catch (error) {
      console.error('Failed to process action:', error)
      await updateQueuedAction(action.id!, { attempts: action.attempts + 1 })
      failed++
    }
  }

  return { processed, failed }
}

async function syncAction(action: QueuedAction): Promise<boolean> {
  const endpoints: Record<string, string> = {
    'volunteer_signup': '/api/offline/sync-volunteer-signup',
    'event_registration': '/api/offline/sync-event-registration',
    'log_hours': '/api/offline/sync-volunteer-hours',
    'update_profile': '/api/offline/sync-profile',
    'donation': '/api/offline/sync-donation'
  }

  const endpoint = endpoints[action.type]
  if (!endpoint) {
    console.error(`Unknown action type: ${action.type}`)
    return false
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action.payload)
    })

    return response.ok
  } catch (error) {
    console.error('Sync request failed:', error)
    return false
  }
}

// Utility to check if online
export function isOnline(): boolean {
  return navigator.onLine
}

// Hook for React components
export function useOfflineQueue() {
  const enqueue = async (type: string, payload: Record<string, any>) => {
    if (isOnline()) {
      // Try to execute immediately
      try {
        const success = await syncAction({ type, payload, timestamp: Date.now(), attempts: 0, maxAttempts: 1 })
        if (success) return { success: true, queued: false }
      } catch {
        // Fall through to queue
      }
    }

    // Queue for later
    await enqueueAction(type, payload)
    return { success: true, queued: true }
  }

  return { enqueue, processQueue, getQueuedActions }
}
