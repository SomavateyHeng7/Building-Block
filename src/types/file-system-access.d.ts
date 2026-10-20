// The File System Access API (Chrome, Edge, Opera) isn't in TypeScript's DOM lib yet.
interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

interface DataTransferItem {
  getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>;
}

// File Handling API: files an installed app was launched with (Chrome, Edge).
interface LaunchParams {
  readonly files: readonly FileSystemHandle[];
}

interface LaunchQueue {
  setConsumer(consumer: (params: LaunchParams) => void): void;
}

interface Window {
  launchQueue?: LaunchQueue;
  showOpenFilePicker?: (options?: {
    types?: FilePickerAcceptType[];
    multiple?: boolean;
    excludeAcceptAllOption?: boolean;
  }) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: FilePickerAcceptType[];
    excludeAcceptAllOption?: boolean;
  }) => Promise<FileSystemFileHandle>;
}
