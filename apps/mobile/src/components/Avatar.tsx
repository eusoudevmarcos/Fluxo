import { Image, StyleSheet, Text, View } from "react-native";

type AvatarProps = {
  avatarUrl?: string | null;
  label: string;
  large?: boolean;
  size?: number;
};

export function Avatar({ avatarUrl, label, large = false, size }: AvatarProps) {
  const dimension = size ?? (large ? 118 : 38);

  return (
    <View
      style={[
        styles.frame,
        large && styles.frameLarge,
        { borderRadius: large ? 23 : 13 },
      ]}
    >
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={{
            borderRadius: large ? 20 : 10,
            height: dimension,
            width: dimension,
          }}
        />
      ) : (
        <View
          style={[
            styles.fallback,
            {
              borderRadius: large ? 20 : 10,
              height: dimension,
              width: dimension,
            },
          ]}
        >
          <Text style={[styles.text, large && styles.textLarge]}>
            {label.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderColor: "#ffc400",
    borderWidth: 1,
    padding: 2,
  },
  frameLarge: {
    borderWidth: 2,
    shadowColor: "#ffc400",
    shadowOpacity: 0.65,
    shadowRadius: 16,
  },
  fallback: {
    alignItems: "center",
    backgroundColor: "#112544",
    justifyContent: "center",
  },
  text: {
    color: "#ffffff",
    fontWeight: "900",
  },
  textLarge: {
    fontSize: 42,
  },
});
