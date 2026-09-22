export { cn } from './cn';
export { isNavItemActive } from './isNavItemActive';
export type { AppLinkComponent } from './AppLinkComponent';
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './Button';
export { Spinner, type SpinnerProps } from './Spinner';
export { Input, type InputProps } from './Input';
export { NumberStepper, type NumberStepperProps } from './NumberStepper';
export { DateRangeField, type DateRangeFieldProps, type DateRangeCopy } from './DateRangeField';
export { ImageSourceField, type ImageSourceFieldProps } from './ImageSourceField';
export { PhotoAttachField, type PhotoAttachFieldProps } from './PhotoAttachField';
export { Select, type SelectProps, type SelectOption } from './Select';
export { TextArea, type TextAreaProps } from './TextArea';
export { Badge, type BadgeProps, type BadgeVariant } from './Badge';
export { StatusBadge, StatusLabelProvider, type StatusBadgeProps } from './StatusBadge';
export {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
  TableNumericCell,
  TableNumericHeader,
  type TableProps,
} from './Table';
export { Ltr } from './Ltr';
export { Modal, type ModalProps, type ModalSize } from './Modal';
export { EmptyState, type EmptyStateProps } from './EmptyState';
export { ErrorState, type ErrorStateProps } from './ErrorState';
export { Skeleton, TableSkeleton, type SkeletonProps, type TableSkeletonProps } from './Skeleton';
export { LoadingOverlay, type LoadingOverlayProps } from './LoadingOverlay';
export { UiCopyProvider, useUiCopy } from './UiCopy';
export { Alert, type AlertProps, type AlertVariant } from './Alert';
export { Tabs, TabList, Tab, TabPanel, type TabsProps } from './Tabs';
export {
  BrandMark,
  BRAND_LOGO_SRC,
  type BrandMarkProps,
} from './BrandMark';
export {
  BRAND_LOGO_DATA_URI,
  BRAND_LOGO_MARK_LIGHT_URI,
  BRAND_LOGO_MARK_DARK_URI,
  BRAND_LOGO_LOCKUP_LIGHT_URI,
  BRAND_LOGO_LOCKUP_DARK_URI,
} from './brand-logo-data';
export { PageHeader, type PageHeaderProps } from './PageHeader';
export { useHeaderOverDark } from './useHeaderOverDark';
export {
  THEME_FOUC_SCRIPT,
  THEME_STORAGE_KEY,
  applyTheme,
  getAppliedTheme,
  getStoredTheme,
  getSystemTheme,
  persistTheme,
  resolveTheme,
  type ThemeMode,
} from './theme';
export { ThemeProvider, useTheme, type ThemeContextValue, type ThemeProviderProps } from './ThemeProvider';
export { ThemeToggle, type ThemeToggleProps } from './ThemeToggle';

export {
  useCardMotion,
  useCountUp,
  AnimatedValue,
  MotionSection,
  StaggerGrid,
  type AnimatedValueProps,
  type MotionSectionProps,
  type StaggerGridProps,
} from './motion';

export {
  BARCODE_FORMATS,
  applyUsbWedgeChar,
  emptyUsbWedge,
  isScanWorthy,
  normalizeScanCode,
  USB_WEDGE_IDLE_MS,
  CameraCapture,
  CodeScanner,
  CodeScannerProvider,
  DEFAULT_DESK_COPY,
  DeskToolsProvider,
  FilterChip,
  FilterSection,
  InboxCellGrid,
  PillTabBar,
  PeriodCells,
  QrDisplay,
  useCodeScanner,
  useOptionalCodeScanner,
  type BarcodeFormat,
  type CameraCaptureProps,
  type CodeScannerProps,
  type DeskCopy,
  type FilterChipProps,
  type InboxCellItem,
  type PeriodCellItem,
  type PeriodCellsProps,
  type PillTabBarProps,
  type PillTabItem,
  type QrDisplayProps,
  type UsbWedgeState,
} from './desk';

export {
  Board,
  BoardHeader,
  BoardBody,
  BoardFooter,
  BoardEmpty,
  BoardField,
  Stamp,
  Figure,
  Meter,
  Ribbon,
  Sparkline,
  DayStrip,
  Ticket,
  Ledger,
  LedgerRow,
  toneInk,
  toneSoft,
  toneFromKey,
  type BoardProps,
  type BoardHeaderProps,
  type BoardBodyProps,
  type BoardEmptyProps,
  type BoardTone,
  type StampProps,
  type FigureProps,
  type MeterProps,
  type RibbonProps,
  type RibbonSegment,
  type SparklineProps,
  type DayStripProps,
  type DayStripColumn,
  type TicketProps,
  type LedgerProps,
  type LedgerRowProps,
} from './board';

export {
  FloorSheet,
  FloorFilterTrigger,
  StageSpine,
  SummaryRail,
  InboxCells,
  ListItemEnter,
  PressableCard,
} from './floor';

/* ── Kit: chrome, overlays, lists, details, forms, calendar, documents ── */
export * from './nav';
export * from './overlay';
export * from './list';
export * from './detail';
export * from './form';
export * from './calendar';
export * from './documents';
