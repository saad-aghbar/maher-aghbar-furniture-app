import {
  AlertTriangle,
  Box,
  CheckCircle2,
  Clock,
  FileText,
  Truck,
  Users,
  Wallet,
} from 'lucide-react-native';
import { toneColor, type Tone } from '../../theme/tokens';
import type { MetricTile } from './metrics';

const icons = {
  clock: Clock,
  alert: AlertTriangle,
  check: CheckCircle2,
  money: Wallet,
  box: Box,
  truck: Truck,
  file: FileText,
  users: Users,
} as const;

export function MetricIcon({ name, tone }: { name: MetricTile['icon']; tone: Tone }) {
  const Icon = icons[name] ?? FileText;
  return <Icon size={18} color={toneColor[tone].fg} />;
}
