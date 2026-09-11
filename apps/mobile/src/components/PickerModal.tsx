import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export type PickerOption = {
  label: string;
  value: string;
};

type PickerModalProps = {
  title: string;
  options: PickerOption[];
  visible: boolean;
  onClose: () => void;
  onSelect: (value: string) => void;
};

export function PickerModal({ title, options, visible, onClose, onSelect }: PickerModalProps) {
  const [search, setSearch] = useState("");

  const filteredOptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter((option) => option.label.toLowerCase().includes(term));
  }, [options, search]);

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <TextInput
            onChangeText={setSearch}
            placeholder="Buscar"
            placeholderTextColor="rgba(255,255,255,0.4)"
            style={styles.search}
            value={search}
          />

          <FlatList
            contentContainerStyle={styles.list}
            data={filteredOptions}
            keyExtractor={(option) => option.value}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onSelect(item.value);
                  setSearch("");
                }}
                style={styles.option}
              >
                <Text style={styles.optionText}>{item.label}</Text>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>Nada encontrado.</Text>}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.5)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0b1120",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "70%",
  },
  header: {
    alignItems: "center",
    borderBottomColor: "rgba(255,255,255,0.08)",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 18,
  },
  title: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 18,
  },
  search: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 14,
    borderWidth: 1,
    color: "#ffffff",
    fontSize: 15,
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  list: {
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  option: {
    borderBottomColor: "rgba(255,255,255,0.06)",
    borderBottomWidth: 1,
    paddingVertical: 14,
  },
  optionText: {
    color: "#ffffff",
    fontSize: 15,
  },
  emptyText: {
    color: "rgba(255,255,255,0.6)",
    paddingTop: 30,
    textAlign: "center",
  },
});
