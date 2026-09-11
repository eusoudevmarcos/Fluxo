import { Pressable, StyleSheet, Text, View } from "react-native";

export type ScreenTab = "home" | "search" | "create" | "messages" | "profile";

type BottomNavProps = {
  activeTab: ScreenTab;
  onChange: (tab: ScreenTab) => void;
  unreadMessages?: number;
};

export function BottomNav({ activeTab, onChange, unreadMessages = 0 }: BottomNavProps) {
  return (
    <View style={styles.bottomNav}>
      <Pressable onPress={() => onChange("home")} style={styles.navItem}>
        <Text style={[styles.navIcon, activeTab === "home" && styles.navActive]}>⌂</Text>
        <Text style={[styles.navLabel, activeTab === "home" && styles.navActive]}>Inicio</Text>
      </Pressable>
      <Pressable onPress={() => onChange("search")} style={styles.navItem}>
        <Text style={[styles.navIcon, activeTab === "search" && styles.navActive]}>⌕</Text>
        <Text style={[styles.navLabel, activeTab === "search" && styles.navActive]}>Buscar</Text>
      </Pressable>
      <Pressable onPress={() => onChange("create")} style={styles.createButton}>
        <Text style={styles.createIcon}>＋</Text>
      </Pressable>
      <Pressable onPress={() => onChange("messages")} style={styles.navItem}>
        <View>
          <Text style={[styles.navIcon, activeTab === "messages" && styles.navActive]}>▱</Text>
          {unreadMessages > 0 && (
            <Text style={styles.badge}>{unreadMessages > 9 ? "9+" : unreadMessages}</Text>
          )}
        </View>
        <Text style={[styles.navLabel, activeTab === "messages" && styles.navActive]}>
          Mensagens
        </Text>
      </Pressable>
      <Pressable onPress={() => onChange("profile")} style={styles.navItem}>
        <Text style={[styles.navIcon, activeTab === "profile" && styles.navActive]}>♙</Text>
        <Text style={[styles.navLabel, activeTab === "profile" && styles.navActive]}>Perfil</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    alignItems: "center",
    backgroundColor: "rgba(3, 7, 17, 0.94)",
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: "row",
    height: 88,
    justifyContent: "space-around",
    left: 0,
    paddingBottom: 16,
    position: "absolute",
    right: 0,
  },
  navItem: {
    alignItems: "center",
    minWidth: 58,
  },
  navIcon: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 26,
    lineHeight: 29,
  },
  navLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    marginTop: 2,
  },
  navActive: {
    color: "#ffc400",
  },
  createButton: {
    alignItems: "center",
    backgroundColor: "#ffc400",
    borderRadius: 28,
    height: 58,
    justifyContent: "center",
    marginTop: -22,
    width: 58,
  },
  createIcon: {
    color: "#050816",
    fontSize: 37,
    lineHeight: 40,
  },
  badge: {
    backgroundColor: "#ffc400",
    borderRadius: 999,
    color: "#050816",
    fontSize: 11,
    fontWeight: "900",
    minWidth: 18,
    paddingHorizontal: 4,
    position: "absolute",
    right: -7,
    textAlign: "center",
    top: -5,
  },
});
