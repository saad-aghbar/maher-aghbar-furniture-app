import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { networkStatusLabel, shouldShowOfflineBanner } from './networkState';

type NetworkContextValue = {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  showOfflineBanner: boolean;
  status: 'online' | 'offline' | 'unknown';
};

const NetworkContext = createContext<NetworkContextValue | null>(null);

function fromState(state: NetInfoState): Pick<NetworkContextValue, 'isConnected' | 'isInternetReachable'> {
  return {
    isConnected: state.isConnected,
    isInternetReachable: state.isInternetReachable,
  };
}

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(null);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const next = fromState(state);
      setIsConnected(next.isConnected);
      setIsInternetReachable(next.isInternetReachable);
    });
    void NetInfo.fetch().then((state) => {
      const next = fromState(state);
      setIsConnected(next.isConnected);
      setIsInternetReachable(next.isInternetReachable);
    });
    return unsub;
  }, []);

  const value = useMemo<NetworkContextValue>(
    () => ({
      isConnected,
      isInternetReachable,
      showOfflineBanner: shouldShowOfflineBanner(isConnected),
      status: networkStatusLabel(isConnected),
    }),
    [isConnected, isInternetReachable],
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork(): NetworkContextValue {
  const ctx = useContext(NetworkContext);
  if (!ctx) {
    throw new Error('useNetwork must be used within NetworkProvider');
  }
  return ctx;
}
