// The File System Access API (Chrome, Edge, Opera) isn't in TypeScript's DOM lib yet.
interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

interface Window {
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
