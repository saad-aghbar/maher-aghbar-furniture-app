import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { apiFetch, ApiClientError } from '../../src/api/client';

type Warehouse = { id: string; code: string; nameEn?: string | null; nameAr?: string | null };
type CountResult = {
  id: string;
  number: string;
  status: string;
  lines?: Array<{
    systemQty: string | number;
    countedQty?: string | number | null;
    varianceQty?: string | number | null;
    inventoryItem?: { sku: string; nameEn?: string | null };
  }>;
};

export default function CycleCountScreen() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [code, setCode] = useState('');
  const [qty, setQty] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<CountResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scannedLock, setScannedLock] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    void (async () => {
      try {
        const rows = await apiFetch<Warehouse[]>('/inventory/warehouses');
        setWarehouses(rows);
        if (rows[0]) setWarehouseId(rows[0].id);
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : 'Failed to load warehouses');
      }
    })();
  }, []);

  const onBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (scannedLock) return;
      const data = result.data?.trim();
      if (!data) return;
      setScannedLock(true);
      setCode(data);
      setScanning(false);
      setMessage(`Scanned: ${data}`);
      setTimeout(() => setScannedLock(false), 1200);
    },
    [scannedLock],
  );

  async function openScanner() {
    setError(null);
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        setError('Camera permission is required to scan barcodes.');
        return;
      }
    }
    setScannedLock(false);
    setScanning(true);
  }

  async function submit(postImmediately: boolean) {
    if (!warehouseId || !code.trim() || !qty.trim()) {
      setError('Warehouse, barcode/SKU, and counted qty are required.');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiFetch<CountResult>('/inventory/counts/scan', {
        method: 'POST',
        body: {
          warehouseId,
          code: code.trim(),
          countedQty: Number(qty),
          postImmediately,
        },
      });
      setLast(result);
      setMessage(
        postImmediately
          ? `Posted count ${result.number}`
          : `Draft count ${result.number} saved`,
      );
      setCode('');
      setQty('');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Cycle count failed');
    } finally {
      setBusy(false);
    }
  }

  const line = last?.lines?.[0];

  if (scanning) {
    return (
      <View style={styles.scannerRoot}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'],
          }}
          onBarcodeScanned={scannedLock ? undefined : onBarcodeScanned}
        />
        <View style={styles.scannerOverlay}>
          <Text style={styles.scannerHint}>Point at barcode / QR</Text>
          <Pressable style={styles.secondaryButton} onPress={() => setScanning(false)}>
            <Text style={styles.secondaryButtonText}>Close camera</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Cycle count</Text>
      <Text style={styles.subtitle}>
        Scan a barcode with the camera, or type SKU / barcode, then enter physical qty.
      </Text>

      <Text style={styles.label}>Warehouse</Text>
      <View style={styles.chipRow}>
        {warehouses.map((w) => (
          <Pressable
            key={w.id}
            onPress={() => setWarehouseId(w.id)}
            style={[styles.chip, warehouseId === w.id && styles.chipActive]}
          >
            <Text style={[styles.chipText, warehouseId === w.id && styles.chipTextActive]}>
              {w.code}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Barcode / SKU</Text>
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="BC-… or SKU"
        placeholderTextColor="#9a9088"
      />
      <Pressable style={styles.secondaryButton} onPress={() => void openScanner()}>
        <Text style={styles.secondaryButtonText}>Scan with camera</Text>
      </Pressable>

      <Text style={styles.label}>Counted quantity</Text>
      <TextInput
        style={styles.input}
        value={qty}
        onChangeText={setQty}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor="#9a9088"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.ok}>{message}</Text> : null}
      {line ? (
        <Text style={styles.meta}>
          {line.inventoryItem?.sku}: system {String(line.systemQty)} · counted{' '}
          {String(line.countedQty ?? '—')} · variance {String(line.varianceQty ?? '—')}
        </Text>
      ) : null}

      <Pressable
        style={[styles.button, styles.secondary, busy && styles.disabled]}
        disabled={busy}
        onPress={() => void submit(false)}
      >
        {busy ? (
          <ActivityIndicator color="#d93a2b" />
        ) : (
          <Text style={styles.secondaryText}>Save draft</Text>
        )}
      </Pressable>
      <Pressable
        style={[styles.button, busy && styles.disabled]}
        disabled={busy}
        onPress={() => void submit(true)}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Post adjustment</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: 24, gap: 10, backgroundColor: '#f5f2ee', flexGrow: 1 },
  scannerRoot: { flex: 1, backgroundColor: '#000' },
  scannerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 40,
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  scannerHint: { color: '#fff', fontSize: 16, fontWeight: '600' },
  back: { alignSelf: 'flex-start', marginBottom: 4 },
  backText: { color: '#d93a2b', fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '700', color: '#1c1612' },
  subtitle: { fontSize: 14, color: '#6b635c', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#4a433d', marginTop: 6 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5dfd8',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1c1612',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d9d0c7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: '#d93a2b', borderColor: '#d93a2b' },
  chipText: { color: '#4a433d', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  button: {
    marginTop: 8,
    backgroundColor: '#d93a2b',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d93a2b' },
  secondaryButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d93a2b',
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#d93a2b', fontWeight: '600', fontSize: 15 },
  secondaryText: { color: '#d93a2b', fontWeight: '600', fontSize: 16 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  disabled: { opacity: 0.7 },
  error: { color: '#b42318', fontSize: 14 },
  ok: { color: '#067647', fontSize: 14 },
  meta: { color: '#6b635c', fontSize: 13 },
});
