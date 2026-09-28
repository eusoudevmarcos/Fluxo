import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { PickerModal, type PickerOption } from "../components/PickerModal";
import { createMobileSupabaseClient } from "../lib/supabase/client";
import {
  listCitiesByState,
  listCountries,
  listStatesByCountry,
  type CountryOption,
  type StateOption,
} from "../lib/services/location.service";
import { normalizeInviteCode, redeemInvite } from "../lib/services/invites.service";
import { uploadAvatar } from "../lib/services/media.service";
import {
  getMyAgeBand,
  isUsernameAvailable,
  setMyBirthDate,
  updateProfileRequiredInfo,
  type BiologicalSex,
  type GeolocationPermission,
  type Profile,
} from "../lib/services/profiles.service";

type StepId = "birth" | "identity" | "location" | "gps" | "sex" | "avatar" | "bio" | "finish";
const STEPS: StepId[] = ["birth", "identity", "location", "gps", "sex", "avatar", "bio", "finish"];

// Tela de idade neutra (modelo TikTok): nao informa a idade minima, para nao induzir a pessoa a
// declarar outra data. Retorna "AAAA-MM-DD" ou null se a data for invalida.
function parseBirthDate(day: string, month: string, year: string) {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y) || year.length !== 4) {
    return null;
  }

  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  if (date.getTime() > Date.now() || y < 1900) return null;

  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

type OnboardingForm = {
  display_name: string;
  username: string;
  country: string;
  countryName: string;
  state: string;
  stateName: string;
  city: string;
  location_lat: number | null;
  location_lng: number | null;
  location_accuracy_meters: number | null;
  geolocation_permission: GeolocationPermission;
  geolocation_consent_at: string | null;
  geolocation_denied_at: string | null;
  biological_sex: BiologicalSex | "";
  avatar_url: string;
  bio: string;
};

const SEX_OPTIONS: { value: BiologicalSex; label: string }[] = [
  { value: "female", label: "Mulher" },
  { value: "male", label: "Homem" },
  { value: "intersex", label: "Intersexo" },
  { value: "prefer_not_to_say", label: "Prefiro não dizer" },
];

type OnboardingScreenProps = {
  session: Session;
  profile: Profile;
  onComplete: (profile: Profile) => void;
};

export function OnboardingScreen({ session, profile, onComplete }: OnboardingScreenProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<OnboardingForm>({
    display_name: profile.display_name ?? "",
    username: profile.username ?? "",
    country: "BR",
    countryName: "Brasil",
    state: "",
    stateName: "",
    city: "",
    location_lat: null,
    location_lng: null,
    location_accuracy_meters: null,
    geolocation_permission: "unknown",
    geolocation_consent_at: null,
    geolocation_denied_at: null,
    biological_sex: "",
    avatar_url: "",
    bio: "",
  });

  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [states, setStates] = useState<StateOption[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [activePicker, setActivePicker] = useState<"country" | "state" | "city" | null>(null);

  const [isRequestingGps, setIsRequestingGps] = useState(false);
  const [isPickingAvatar, setIsPickingAvatar] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [birth, setBirth] = useState({ day: "", month: "", year: "" });
  const [birthRecorded, setBirthRecorded] = useState(false);
  const [isAgeBlocked, setIsAgeBlocked] = useState(false);
  const [inviteCode, setInviteCode] = useState("");

  useEffect(() => {
    listCountries().then(setCountries).catch(() => undefined);
  }, []);

  useEffect(() => {
    getMyAgeBand(createMobileSupabaseClient())
      .then((band) => {
        if (band === "blocked") {
          setIsAgeBlocked(true);
        } else if (band !== "unknown") {
          setBirthRecorded(true);
          setStepIndex((current) => (current === 0 ? 1 : current));
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!form.country) return;
    listStatesByCountry(form.country)
      .then(setStates)
      .catch(() => setStates([]));
  }, [form.country]);

  useEffect(() => {
    if (!form.country || !form.state) {
      setCities([]);
      return;
    }
    listCitiesByState(form.country, form.state)
      .then((rows) => setCities(rows.map((row) => row.name)))
      .catch(() => setCities([]));
  }, [form.country, form.state]);

  function updateForm(patch: Partial<OnboardingForm>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function validateIdentity() {
    if (!form.display_name.trim()) return "Informe o nome que vai aparecer no seu perfil.";
    if (form.username.trim().length < 3) return "Seu Flow ID precisa ter pelo menos 3 caracteres.";
    return "";
  }

  async function goNext() {
    setErrorMessage("");
    const step = STEPS[stepIndex];

    if (step === "birth" && !birthRecorded) {
      const birthDate = parseBirthDate(birth.day, birth.month, birth.year);
      if (!birthDate) {
        setErrorMessage("Informe uma data de nascimento válida.");
        return;
      }

      setIsSubmitting(true);
      try {
        const band = await setMyBirthDate(createMobileSupabaseClient(), birthDate);
        if (band === "blocked") {
          setIsAgeBlocked(true);
          return;
        }
        setBirthRecorded(true);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Não foi possível continuar.");
        return;
      } finally {
        setIsSubmitting(false);
      }
    }

    if (step === "identity") {
      const validationError = validateIdentity();
      if (validationError) {
        setErrorMessage(validationError);
        return;
      }

      const supabase = createMobileSupabaseClient();
      const available = await isUsernameAvailable(supabase, form.username, session.user.id);
      if (!available) {
        setErrorMessage("Esse Flow ID já está em uso.");
        return;
      }
    }

    if (step === "location" && (!form.state || !form.city)) {
      setErrorMessage("Informe sua cidade e estado para continuar.");
      return;
    }

    if (step === "gps" && form.geolocation_permission === "unknown") {
      setErrorMessage("Avance pela etapa de localização para continuar.");
      return;
    }

    if (step === "sex" && !form.biological_sex) {
      setErrorMessage("Selecione uma opção para continuar.");
      return;
    }

    if (step === "finish") {
      await handleFinish();
      return;
    }

    setStepIndex((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function goBack() {
    setErrorMessage("");
    // A data de nascimento nao pode ser alterada depois de declarada.
    setStepIndex((current) => Math.max(current - 1, birthRecorded ? 1 : 0));
  }

  async function requestGps() {
    setIsRequestingGps(true);
    setErrorMessage("");

    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        markGpsUnavailable();
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        updateForm({
          geolocation_permission: "denied",
          geolocation_denied_at: new Date().toISOString(),
          geolocation_consent_at: null,
          location_lat: null,
          location_lng: null,
          location_accuracy_meters: null,
        });
        setErrorMessage("Tudo bem. Vamos usar sua cidade e estado por enquanto.");
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      updateForm({
        location_lat: Number(position.coords.latitude.toFixed(6)),
        location_lng: Number(position.coords.longitude.toFixed(6)),
        location_accuracy_meters: Math.round(position.coords.accuracy ?? 0),
        geolocation_permission: "granted",
        geolocation_consent_at: new Date().toISOString(),
        geolocation_denied_at: null,
      });
    } catch {
      markGpsUnavailable();
    } finally {
      setIsRequestingGps(false);
    }
  }

  function markGpsUnavailable() {
    updateForm({
      geolocation_permission: "unavailable",
      geolocation_denied_at: new Date().toISOString(),
      geolocation_consent_at: null,
      location_lat: null,
      location_lng: null,
      location_accuracy_meters: null,
    });
  }

  async function handlePickAvatar() {
    setIsPickingAvatar(true);
    setErrorMessage("");

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage("Permita o acesso às fotos para escolher uma imagem.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1],
      });

      if (result.canceled || !result.assets[0]) return;

      const supabase = createMobileSupabaseClient();
      const publicUrl = await uploadAvatar(supabase, {
        uri: result.assets[0].uri,
        mimeType: result.assets[0].mimeType ?? null,
        fileName: result.assets[0].fileName ?? null,
        type: "image",
      });

      updateForm({ avatar_url: publicUrl });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível enviar a foto.");
    } finally {
      setIsPickingAvatar(false);
    }
  }

  async function handleFinish() {
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const supabase = createMobileSupabaseClient();
      const updatedProfile = await updateProfileRequiredInfo(supabase, {
        display_name: form.display_name,
        username: form.username,
        avatar_url: form.avatar_url,
        bio: form.bio,
        state: form.stateName || form.state,
        city: form.city,
        country: form.country,
        location_lat: form.location_lat,
        location_lng: form.location_lng,
        location_accuracy_meters: form.location_accuracy_meters,
        geolocation_permission: form.geolocation_permission,
        geolocation_consent_at: form.geolocation_consent_at,
        geolocation_denied_at: form.geolocation_denied_at,
        biological_sex: form.biological_sex as BiologicalSex,
      });

      // O convite so vale com o cadastro completo (o servidor exige). Se falhar, avisa e deixa
      // seguir sem convite no proximo toque.
      if (inviteCode) {
        try {
          await redeemInvite(supabase, inviteCode);
        } catch (inviteError) {
          setInviteCode("");
          setErrorMessage(
            `${inviteError instanceof Error ? inviteError.message : "Não foi possível usar o convite."} Toque em "Entrar na Fluxo" para continuar sem convite.`,
          );
          return;
        }
      }

      onComplete(updatedProfile);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível concluir.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const step = STEPS[stepIndex];

  const countryOptions: PickerOption[] = countries.map((country) => ({
    label: country.name,
    value: country.code,
  }));
  const stateOptions: PickerOption[] = states.map((stateOption) => ({
    label: stateOption.name,
    value: stateOption.code,
  }));
  const cityOptions: PickerOption[] = cities.map((city) => ({ label: city, value: city }));

  if (isAgeBlocked) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.brand}>fluxo</Text>
          <View style={styles.card}>
            <Text style={styles.title}>Não foi possível criar sua conta</Text>
            <Text style={styles.subtitle}>
              A Fluxo não está disponível para você no momento. Obrigado pelo interesse.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>fluxo</Text>
        <Text style={styles.stepCounter}>
          Passo {stepIndex + 1} de {STEPS.length}
        </Text>

        {step === "birth" && (
          <View style={styles.card}>
            <Text style={styles.title}>Quando você nasceu?</Text>
            <Text style={styles.subtitle}>
              Não aparece no seu perfil. Usamos para ajustar sua experiência e sua segurança.
            </Text>
            <View style={styles.birthRow}>
              <TextInput
                keyboardType="number-pad"
                maxLength={2}
                onChangeText={(value) => setBirth((current) => ({ ...current, day: value.replace(/\D/g, "") }))}
                placeholder="DD"
                placeholderTextColor="rgba(255,255,255,0.4)"
                style={[styles.input, styles.birthInput]}
                value={birth.day}
              />
              <TextInput
                keyboardType="number-pad"
                maxLength={2}
                onChangeText={(value) => setBirth((current) => ({ ...current, month: value.replace(/\D/g, "") }))}
                placeholder="MM"
                placeholderTextColor="rgba(255,255,255,0.4)"
                style={[styles.input, styles.birthInput]}
                value={birth.month}
              />
              <TextInput
                keyboardType="number-pad"
                maxLength={4}
                onChangeText={(value) => setBirth((current) => ({ ...current, year: value.replace(/\D/g, "") }))}
                placeholder="AAAA"
                placeholderTextColor="rgba(255,255,255,0.4)"
                style={[styles.input, styles.birthYearInput]}
                value={birth.year}
              />
            </View>
          </View>
        )}

        {step === "identity" && (
          <View style={styles.card}>
            <Text style={styles.title}>Como querem te chamar?</Text>
            <TextInput
              onChangeText={(value) => updateForm({ display_name: value })}
              placeholder="Nome de exibição"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.input}
              value={form.display_name}
            />
            <TextInput
              autoCapitalize="none"
              onChangeText={(value) => updateForm({ username: value })}
              placeholder="Flow ID (username)"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.input}
              value={form.username}
            />
          </View>
        )}

        {step === "location" && (
          <View style={styles.card}>
            <Text style={styles.title}>De onde você é?</Text>
            <Pressable onPress={() => setActivePicker("country")} style={styles.selectField}>
              <Text style={styles.selectText}>{form.countryName || "País"}</Text>
            </Pressable>
            {form.country === "BR" ? (
              <>
                <Pressable onPress={() => setActivePicker("state")} style={styles.selectField}>
                  <Text style={styles.selectText}>{form.stateName || "Estado"}</Text>
                </Pressable>
                <Pressable
                  disabled={!form.state}
                  onPress={() => setActivePicker("city")}
                  style={[styles.selectField, !form.state && styles.selectFieldDisabled]}
                >
                  <Text style={styles.selectText}>{form.city || "Cidade"}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <TextInput
                  onChangeText={(value) => updateForm({ state: value, stateName: value })}
                  placeholder="Estado/província"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  style={styles.input}
                  value={form.state}
                />
                <TextInput
                  onChangeText={(value) => updateForm({ city: value })}
                  placeholder="Cidade"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  style={styles.input}
                  value={form.city}
                />
              </>
            )}
          </View>
        )}

        {step === "gps" && (
          <View style={styles.card}>
            <Text style={styles.title}>Compartilhar localização?</Text>
            <Text style={styles.subtitle}>
              Ajuda a sugerir comunidades locais e melhorar a segurança. Suas coordenadas nunca
              aparecem publicamente.
            </Text>
            {form.geolocation_permission === "granted" && (
              <Text style={styles.successText}>Localização compartilhada.</Text>
            )}
            <Pressable disabled={isRequestingGps} onPress={requestGps} style={styles.primaryButton}>
              {isRequestingGps ? (
                <ActivityIndicator color="#050816" />
              ) : (
                <Text style={styles.primaryButtonText}>Permitir localização</Text>
              )}
            </Pressable>
            <Pressable onPress={markGpsUnavailable} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Continuar com cidade/estado</Text>
            </Pressable>
          </View>
        )}

        {step === "sex" && (
          <View style={styles.card}>
            <Text style={styles.title}>Como você se identifica?</Text>
            <View style={styles.chipRow}>
              {SEX_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => updateForm({ biological_sex: option.value })}
                  style={[styles.chip, form.biological_sex === option.value && styles.chipActive]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      form.biological_sex === option.value && styles.chipTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {step === "avatar" && (
          <View style={styles.card}>
            <Text style={styles.title}>Foto de perfil</Text>
            <Text style={styles.subtitle}>Opcional — você pode adicionar depois.</Text>
            {form.avatar_url ? (
              <Image source={{ uri: form.avatar_url }} style={styles.avatarPreview} />
            ) : null}
            <Pressable disabled={isPickingAvatar} onPress={handlePickAvatar} style={styles.primaryButton}>
              {isPickingAvatar ? (
                <ActivityIndicator color="#050816" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {form.avatar_url ? "Trocar foto" : "Escolher foto"}
                </Text>
              )}
            </Pressable>
          </View>
        )}

        {step === "bio" && (
          <View style={styles.card}>
            <Text style={styles.title}>Conte um pouco sobre você</Text>
            <Text style={styles.subtitle}>Opcional, no máximo 180 caracteres.</Text>
            <TextInput
              maxLength={180}
              multiline
              onChangeText={(value) => updateForm({ bio: value })}
              placeholder="Sua bio"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={[styles.input, styles.bioInput]}
              value={form.bio}
            />
          </View>
        )}

        {step === "finish" && (
          <View style={styles.card}>
            <Text style={styles.title}>Tudo pronto, {form.display_name || "Fluxo"}!</Text>
            <Text style={styles.summaryLine}>@{form.username}</Text>
            <Text style={styles.summaryLine}>
              {form.city}
              {form.stateName ? `, ${form.stateName}` : ""}
            </Text>
            {!!form.bio && <Text style={styles.summaryLine}>{form.bio}</Text>}
            <Text style={styles.subtitle}>Recebeu um convite? Digite o código (opcional):</Text>
            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
              onChangeText={(value) => setInviteCode(normalizeInviteCode(value))}
              placeholder="Ex: K7PX2QMA"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.input}
              value={inviteCode}
            />
          </View>
        )}

        {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

        <View style={styles.navRow}>
          {stepIndex > (birthRecorded ? 1 : 0) && (
            <Pressable onPress={goBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>Voltar</Text>
            </Pressable>
          )}
          <Pressable disabled={isSubmitting} onPress={goNext} style={styles.nextButton}>
            {isSubmitting ? (
              <ActivityIndicator color="#050816" />
            ) : (
              <Text style={styles.nextButtonText}>
                {step === "finish" ? "Entrar na Fluxo" : "Continuar"}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>

      <PickerModal
        onClose={() => setActivePicker(null)}
        onSelect={(value) => {
          const selected = countries.find((country) => country.code === value);
          updateForm({
            country: value,
            countryName: selected?.name ?? value,
            state: "",
            stateName: "",
            city: "",
          });
          setActivePicker(null);
        }}
        options={countryOptions}
        title="País"
        visible={activePicker === "country"}
      />
      <PickerModal
        onClose={() => setActivePicker(null)}
        onSelect={(value) => {
          const selected = states.find((stateOption) => stateOption.code === value);
          updateForm({ state: value, stateName: selected?.name ?? value, city: "" });
          setActivePicker(null);
        }}
        options={stateOptions}
        title="Estado"
        visible={activePicker === "state"}
      />
      <PickerModal
        onClose={() => setActivePicker(null)}
        onSelect={(value) => {
          updateForm({ city: value });
          setActivePicker(null);
        }}
        options={cityOptions}
        title="Cidade"
        visible={activePicker === "city"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#030711",
    flex: 1,
  },
  content: {
    gap: 16,
    paddingBottom: 60,
    paddingHorizontal: 20,
    paddingTop: 56,
  },
  brand: {
    color: "#ffc400",
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: -1.4,
  },
  stepCounter: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  title: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
  },
  subtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    lineHeight: 20,
  },
  successText: {
    color: "#4ade80",
    fontSize: 14,
    fontWeight: "700",
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 14,
    borderWidth: 1,
    color: "#ffffff",
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bioInput: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  birthRow: {
    flexDirection: "row",
    gap: 10,
  },
  birthInput: {
    flex: 1,
    textAlign: "center",
  },
  birthYearInput: {
    flex: 1.6,
    textAlign: "center",
  },
  selectField: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  selectFieldDisabled: {
    opacity: 0.5,
  },
  selectText: {
    color: "#ffffff",
    fontSize: 15,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipActive: {
    backgroundColor: "#ffc400",
    borderColor: "#ffc400",
  },
  chipText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  chipTextActive: {
    color: "#050816",
  },
  avatarPreview: {
    alignSelf: "center",
    borderRadius: 60,
    height: 120,
    width: 120,
  },
  summaryLine: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#ffc400",
    borderRadius: 16,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: "#050816",
    fontSize: 15,
    fontWeight: "900",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  error: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.26)",
    borderRadius: 14,
    borderWidth: 1,
    color: "#fecaca",
    padding: 12,
  },
  navRow: {
    flexDirection: "row",
    gap: 12,
  },
  backButton: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  backButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  nextButton: {
    alignItems: "center",
    backgroundColor: "#ffc400",
    borderRadius: 16,
    flex: 1,
    paddingVertical: 16,
  },
  nextButtonText: {
    color: "#050816",
    fontSize: 15,
    fontWeight: "900",
  },
});
