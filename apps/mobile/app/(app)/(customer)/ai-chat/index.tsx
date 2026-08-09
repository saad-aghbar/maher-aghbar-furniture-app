import { useAuth } from '@/auth/AuthProvider';
import { PermissionGate } from '@/navigation/PermissionGate';
import { AiChatbotScreen } from '@/features/ai-chatbot/AiChatbotScreen';

export default function CustomerAiChatRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="ai-chat.read" mode="all">
      <AiChatbotScreen backFallback="/(app)/(customer)/(tabs)/account" />
    </PermissionGate>
  );
}
