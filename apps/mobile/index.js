// Stable Metro entry. Do not use `expo-router/entry` as package.json "main" in this
// pnpm workspace — that URL embeds a peer-hash folder and Expo Go will keep
// requesting a stale copy after `pnpm install`.
import 'expo-router/entry';
