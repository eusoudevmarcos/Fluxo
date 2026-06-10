import { PrivsPanel } from "@/components/privs/PrivsPanel";
import { MomentWidget } from "./MomentWidget";
import { NotificationPanel } from "./NotificationPanel";
import { RewardWidget } from "./RewardWidget";
import styles from "./RightSidebar.module.css";
import { TopActions } from "./TopActions";
import { TrendWidget } from "./TrendWidget";

type RightSidebarProps = {
  isPrivsOpen?: boolean;
  isNotificationsOpen?: boolean;
  onClosePrivs?: () => void;
  onCloseNotifications?: () => void;
  onToggleNotifications?: () => void;
  onTogglePrivs?: () => void;
};

export function RightSidebar({
  isPrivsOpen = false,
  isNotificationsOpen = false,
  onClosePrivs = () => {},
  onCloseNotifications = () => {},
  onToggleNotifications,
  onTogglePrivs,
}: RightSidebarProps) {
  return (
    <aside className={styles.rightbar}>
      <TopActions
        isNotificationsOpen={isNotificationsOpen}
        isPrivsOpen={isPrivsOpen}
        onToggleNotifications={onToggleNotifications}
        onTogglePrivs={onTogglePrivs}
      />
      {isPrivsOpen ? (
        <PrivsPanel onClose={onClosePrivs} />
      ) : isNotificationsOpen ? (
        <NotificationPanel onClose={onCloseNotifications} />
      ) : (
        <>
          <MomentWidget />
          <TrendWidget />
          <RewardWidget />
        </>
      )}
    </aside>
  );
}
