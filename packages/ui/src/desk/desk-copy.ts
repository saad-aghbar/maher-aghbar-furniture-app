export type DeskCopy = {
  scanTitle: string;
  scanHint: string;
  scanTypedLabel: string;
  scanConfirm: string;
  scanRescan: string;
  scanPermission: string;
  scanNoCamera: string;
  scanTorchOn: string;
  scanTorchOff: string;
  cameraTitle: string;
  cameraSnap: string;
  cameraLibrary: string;
  cameraUrl: string;
  printQr: string;
  filterApply: string;
  filterClear: string;
  close: string;
  cancel: string;
};

export const DEFAULT_DESK_COPY: DeskCopy = {
  scanTitle: 'Scan a code',
  scanHint: 'Point the camera at a QR or barcode, or type the code.',
  scanTypedLabel: 'Code',
  scanConfirm: 'Use this code',
  scanRescan: 'Scan again',
  scanPermission: 'Allow camera access to scan, or type the code below.',
  scanNoCamera: 'No camera on this device. Type the code, or use a USB scanner.',
  scanTorchOn: 'Light on',
  scanTorchOff: 'Light off',
  cameraTitle: 'Take a photo',
  cameraSnap: 'Capture',
  cameraLibrary: 'Choose from device',
  cameraUrl: 'Attach from URL',
  printQr: 'Print',
  filterApply: 'Apply',
  filterClear: 'Clear',
  close: 'Close',
  cancel: 'Cancel',
};
