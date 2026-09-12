const DATABASE_NAME = "patchmark-workspace";
const DATABASE_VERSION = 1;
const HANDLE_STORE = "file-handles";
const DEFAULT_DOCUMENT_DIRECTORY_KEY = "__patchmark_default_document_directory__";

type WritableFileSystemHandle = FileSystemFileHandle | FileSystemDirectoryHandle;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(HANDLE_STORE)) database.createObjectStore(HANDLE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(HANDLE_STORE, mode);
      const request = operation(transaction.objectStore(HANDLE_STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

export async function rememberFileHandle(documentId: string, handle: FileSystemFileHandle): Promise<void> {
  if (!("indexedDB" in window)) return;
  await withStore("readwrite", (store) => store.put(handle, documentId));
}

export async function recallFileHandle(documentId: string): Promise<FileSystemFileHandle | undefined> {
  if (!("indexedDB" in window)) return undefined;
  return withStore<FileSystemFileHandle | undefined>("readonly", (store) => store.get(documentId));
}

export async function forgetFileHandle(documentId: string): Promise<void> {
  if (!("indexedDB" in window)) return;
  await withStore("readwrite", (store) => store.delete(documentId));
}

export async function rememberDefaultDocumentDirectory(handle: FileSystemDirectoryHandle): Promise<void> {
  if (!("indexedDB" in window)) return;
  await withStore("readwrite", (store) => store.put(handle, DEFAULT_DOCUMENT_DIRECTORY_KEY));
}

export async function recallDefaultDocumentDirectory(): Promise<FileSystemDirectoryHandle | undefined> {
  if (!("indexedDB" in window)) return undefined;
  return withStore<FileSystemDirectoryHandle | undefined>("readonly", (store) => store.get(DEFAULT_DOCUMENT_DIRECTORY_KEY));
}

export async function forgetDefaultDocumentDirectory(): Promise<void> {
  if (!("indexedDB" in window)) return;
  await withStore("readwrite", (store) => store.delete(DEFAULT_DOCUMENT_DIRECTORY_KEY));
}

export async function permissionFor(handle: WritableFileSystemHandle): Promise<PermissionState> {
  if (!handle.queryPermission) return "granted";
  return handle.queryPermission({ mode: "readwrite" });
}

export async function ensureWritePermission(handle: WritableFileSystemHandle): Promise<boolean> {
  const current = await permissionFor(handle);
  if (current === "granted") return true;
  if (!handle.requestPermission) return false;
  return (await handle.requestPermission({ mode: "readwrite" })) === "granted";
}
