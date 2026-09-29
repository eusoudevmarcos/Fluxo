"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { OceanLogo } from "@/components/brand/OceanLogo";
import {
  ensureProfile,
  getErrorMessage,
  isUsernameAvailable,
  normalizeUsername,
  setMyBirthDate,
  updateProfileRequiredInfo,
  type BiologicalSex,
  type GeolocationPermission,
  type OceanProfile,
} from "@/lib/profiles/ensure-profile";
import {
  clearPendingInviteCode,
  normalizeInviteCode,
  readPendingInviteCode,
  redeemInvite,
} from "@/lib/services/invites.service";
import { hasAcceptedCurrentLegalVersions } from "@/lib/services/legal.service";
import {
  listCitiesByState,
  listCountries,
  listStatesByCountry,
  type CityOption,
  type CountryOption,
  type StateOption,
} from "@/lib/services/location.service";
import { safelyApplyDefaultOfficialFollowsForCurrentUser } from "@/lib/services/official-accounts.service";
import { createClient, getSupabaseConfigError } from "@/lib/supabase/client";
import styles from "./page.module.css";

type StepId =
  | "welcome"
  | "birth"
  | "identity"
  | "location"
  | "gps"
  | "sex"
  | "avatar"
  | "bio"
  | "finish";

type OnboardingForm = {
  display_name: string;
  username: string;
  state: string;
  city: string;
  country: string;
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

const steps: Array<{ id: StepId; label: string }> = [
  { id: "welcome", label: "Início" },
  { id: "birth", label: "Idade" },
  { id: "identity", label: "Identidade" },
  { id: "location", label: "Local" },
  { id: "gps", label: "GPS" },
  { id: "sex", label: "Segurança" },
  { id: "avatar", label: "Foto" },
  { id: "bio", label: "Flow" },
  { id: "finish", label: "Final" },
];

const sexOptions: Array<{ value: BiologicalSex; label: string }> = [
  { value: "female", label: "Feminino" },
  { value: "male", label: "Masculino" },
  { value: "intersex", label: "Intersexo" },
  { value: "prefer_not_to_say", label: "Prefiro não informar" },
];

function getInitialForm(profile: OceanProfile): OnboardingForm {
  return {
    display_name: profile.display_name ?? "",
    username: normalizeUsername(profile.username ?? profile.display_name ?? "ocean"),
    state: profile.state ?? "",
    city: profile.city ?? "",
    country: profile.country ?? "BR",
    location_lat: profile.location_lat ?? null,
    location_lng: profile.location_lng ?? null,
    location_accuracy_meters: profile.location_accuracy_meters ?? null,
    geolocation_permission: profile.geolocation_permission ?? "unknown",
    geolocation_consent_at: profile.geolocation_consent_at ?? null,
    geolocation_denied_at: profile.geolocation_denied_at ?? null,
    biological_sex: profile.biological_sex ?? "",
    avatar_url: profile.avatar_url ?? "",
    bio: profile.bio ?? "",
  };
}

function getStepIndex(step: StepId) {
  return steps.findIndex((item) => item.id === step);
}

export default function OnboardingPage() {
  const router = useRouter();
  const configError = useMemo(() => getSupabaseConfigError(), []);
  const [step, setStep] = useState<StepId>("welcome");
  const [profile, setProfile] = useState<OceanProfile | null>(null);
  const [form, setForm] = useState<OnboardingForm | null>(null);
  const [googleAvatarUrl, setGoogleAvatarUrl] = useState("");
  const [isLoading, setIsLoading] = useState(!configError);
  const [isSaving, setIsSaving] = useState(false);
  const [isRequestingGps, setIsRequestingGps] = useState(false);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [states, setStates] = useState<StateOption[]>([]);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [isLoadingCountries, setIsLoadingCountries] = useState(false);
  const [isLoadingStates, setIsLoadingStates] = useState(false);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [locationOptionsError, setLocationOptionsError] = useState("");
  const [error, setError] = useState(configError ?? "");
  const [birthDate, setBirthDate] = useState("");
  const [birthRecorded, setBirthRecorded] = useState(false);
  const [isAgeBlocked, setIsAgeBlocked] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const currentStepIndex = getStepIndex(step);

  useEffect(() => {
    if (configError) return;

    let isMounted = true;

    async function load() {
      try {
        const supabase = createClient();
        const { data, error: userError } = await supabase.auth.getUser();

        if (userError || !data.user) {
          router.replace("/auth?mode=login");
          return;
        }

        if (!(await hasAcceptedCurrentLegalVersions(supabase))) {
          router.replace("/legal/accept");
          return;
        }

        const metadata = data.user.user_metadata as Record<string, unknown>;
        const googlePhoto =
          typeof metadata.avatar_url === "string"
            ? metadata.avatar_url
            : typeof metadata.picture === "string"
              ? metadata.picture
              : "";
        const ensuredProfile = await ensureProfile();

        if (!isMounted) return;

        if (ensuredProfile.onboarding_completed && ensuredProfile.profile_required_completed) {
          router.replace("/perfil");
          return;
        }

        setProfile(ensuredProfile);
        setForm(getInitialForm(ensuredProfile));
        setInviteCode(readPendingInviteCode());
        setIsAgeBlocked(ensuredProfile.age_band === "blocked");
        setBirthRecorded(
          ensuredProfile.age_band !== "unknown" && ensuredProfile.age_band !== "blocked",
        );
        setGoogleAvatarUrl(googlePhoto);
        setIsLoading(false);
      } catch (loadError) {
        if (!isMounted) return;
        setError(getErrorMessage(loadError, "Não foi possível preparar sua entrada na Fluxo."));
        setIsLoading(false);
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [configError, router]);

  useEffect(() => {
    let isMounted = true;

    async function loadCountries() {
      setIsLoadingCountries(true);
      const nextCountries = await listCountries();

      if (!isMounted) return;

      setCountries(nextCountries);
      setIsLoadingCountries(false);
    }

    void loadCountries();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!form?.country) return;

    let isMounted = true;

    async function loadStates() {
      setIsLoadingStates(true);
      setLocationOptionsError("");

      try {
        const nextStates = await listStatesByCountry(form?.country ?? "BR");

        if (!isMounted) return;

        setStates(nextStates);
      } catch (locationError) {
        if (!isMounted) return;
        setStates([]);
        setLocationOptionsError(
          getErrorMessage(locationError, "Não foi possível carregar estados agora."),
        );
      } finally {
        if (isMounted) {
          setIsLoadingStates(false);
        }
      }
    }

    void loadStates();

    return () => {
      isMounted = false;
    };
  }, [form?.country]);

  useEffect(() => {
    if (!form?.country || !form.state) {
      return;
    }

    let isMounted = true;

    async function loadCities() {
      setIsLoadingCities(true);
      setLocationOptionsError("");

      try {
        const nextCities = await listCitiesByState(form?.country ?? "BR", form?.state ?? "");

        if (!isMounted) return;

        setCities(nextCities);
      } catch (locationError) {
        if (!isMounted) return;
        setCities([]);
        setLocationOptionsError(
          getErrorMessage(locationError, "Não foi possível carregar cidades agora."),
        );
      } finally {
        if (isMounted) {
          setIsLoadingCities(false);
        }
      }
    }

    void loadCities();

    return () => {
      isMounted = false;
    };
  }, [form?.country, form?.state]);

  function updateField<T extends keyof OnboardingForm>(field: T, value: OnboardingForm[T]) {
    setForm((current) => (current ? { ...current, [field]: value } : current));
  }

  function updateUsername(value: string) {
    updateField("username", normalizeUsername(value));
  }

  function handleCountryChange(countryCode: string) {
    setForm((current) =>
      current
        ? {
            ...current,
            country: countryCode,
            state: "",
            city: "",
          }
        : current,
    );
    setCities([]);
    setError("");
  }

  function handleStateChange(nextState: string) {
    setForm((current) =>
      current
        ? {
            ...current,
            state: nextState,
            city: "",
          }
        : current,
    );
    setError("");
  }

  async function validateIdentity() {
    if (!form || !profile) return false;

    if (!form.display_name.trim()) {
      setError("Informe seu nome para continuar.");
      return false;
    }

    if (form.username.length < 3) {
      setError("Seu Flow ID precisa ter pelo menos 3 caracteres.");
      return false;
    }

    try {
      const available = await isUsernameAvailable(createClient(), form.username, profile.user_id);
      if (!available) {
        setError("Esse Flow ID já está em uso.");
        return false;
      }
    } catch (checkError) {
      setError(getErrorMessage(checkError, "Não foi possível validar seu Flow ID."));
      return false;
    }

    setError("");
    return true;
  }

  function validateLocation() {
    if (!form?.country.trim() || !form.state.trim() || !form.city.trim()) {
      setError("Informe país, estado e cidade para continuar.");
      return false;
    }

    setError("");
    return true;
  }

  function validateGps() {
    if (!form || form.geolocation_permission === "unknown") {
      setError("Avance pela etapa de localização para continuar.");
      return false;
    }

    setError("");
    return true;
  }

  function validateSex() {
    if (!form?.biological_sex) {
      setError("Selecione uma opção para continuar.");
      return false;
    }

    setError("");
    return true;
  }

  // Declarada uma unica vez; <14 bloqueia a conta (set_my_birth_date retorna "blocked").
  async function submitBirthDate() {
    if (birthRecorded) return true;

    const parsed = new Date(`${birthDate}T00:00:00Z`);
    if (!birthDate || Number.isNaN(parsed.getTime()) || parsed.getTime() > Date.now()) {
      setError("Informe uma data de nascimento válida.");
      return false;
    }

    try {
      const band = await setMyBirthDate(birthDate);
      if (band === "blocked") {
        setIsAgeBlocked(true);
        return false;
      }
      setBirthRecorded(true);
      setError("");
      return true;
    } catch (birthError) {
      // Banco ainda sem a migration 047: nao trava o cadastro em producao enquanto o SQL do
      // beta nao for aplicado (a data volta a ser exigida pelo proprio banco depois dele).
      const code = (birthError as { code?: string } | null)?.code;
      if (code === "PGRST202" || code === "42883") {
        setBirthRecorded(true);
        setError("");
        return true;
      }
      setError(getErrorMessage(birthError, "Não foi possível continuar."));
      return false;
    }
  }

  async function canLeaveStep() {
    if (step === "birth") return submitBirthDate();
    if (step === "identity") return validateIdentity();
    if (step === "location") return validateLocation();
    if (step === "gps") return validateGps();
    if (step === "sex") return validateSex();
    return true;
  }

  async function goNext() {
    if (!(await canLeaveStep())) return;
    const nextStep = steps[currentStepIndex + 1];
    if (nextStep) {
      setError("");
      setStep(nextStep.id);
    }
  }

  function goBack() {
    const previousStep = steps[currentStepIndex - (birthRecorded && step === "identity" ? 2 : 1)];
    if (previousStep) {
      setError("");
      setStep(previousStep.id);
    }
  }

  function markGpsUnavailable() {
    const now = new Date().toISOString();
    updateField("geolocation_permission", "unavailable");
    updateField("geolocation_denied_at", now);
    setError("");
  }

  function requestGps() {
    if (!form) return;

    if (!("geolocation" in navigator)) {
      markGpsUnavailable();
      return;
    }

    setIsRequestingGps(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const now = new Date().toISOString();
        setForm((current) =>
          current
            ? {
                ...current,
                location_lat: Number(position.coords.latitude.toFixed(6)),
                location_lng: Number(position.coords.longitude.toFixed(6)),
                location_accuracy_meters: Math.round(position.coords.accuracy),
                geolocation_permission: "granted",
                geolocation_consent_at: now,
                geolocation_denied_at: null,
              }
            : current,
        );
        setIsRequestingGps(false);
      },
      (gpsError) => {
        const now = new Date().toISOString();
        const permission: GeolocationPermission =
          gpsError.code === gpsError.PERMISSION_DENIED ? "denied" : "unavailable";
        setForm((current) =>
          current
            ? {
                ...current,
                geolocation_permission: permission,
                geolocation_denied_at: now,
                geolocation_consent_at: null,
                location_lat: null,
                location_lng: null,
                location_accuracy_meters: null,
              }
            : current,
        );
        setError("Tudo bem. Vamos usar sua cidade e estado por enquanto.");
        setIsRequestingGps(false);
      },
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 },
    );
  }

  async function handleFinish(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!form) return;

    if (!birthRecorded) {
      setStep("birth");
      setError("Informe sua data de nascimento para continuar.");
      return;
    }

    if (!(await validateIdentity())) {
      setStep("identity");
      return;
    }

    if (!validateLocation()) {
      setStep("location");
      return;
    }

    if (!validateGps()) {
      setStep("gps");
      return;
    }

    if (!validateSex()) {
      setStep("sex");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const biologicalSex = form.biological_sex;
      if (!biologicalSex) {
        setStep("sex");
        setError("Selecione uma opção para continuar.");
        return;
      }

      await updateProfileRequiredInfo({
        ...form,
        biological_sex: biologicalSex,
      });

      // O convite so vale com o cadastro completo (o servidor exige). Se falhar (codigo
      // invalido, convites esgotados), avisa e deixa seguir sem convite no proximo clique.
      if (inviteCode) {
        try {
          await redeemInvite(createClient(), inviteCode);
        } catch (inviteError) {
          setInviteCode("");
          clearPendingInviteCode();
          setError(
            `${getErrorMessage(inviteError, "Não foi possível usar o convite.")} Clique em "Entrar na Fluxo" para continuar sem convite.`,
          );
          return;
        }
        clearPendingInviteCode();
      }

      await safelyApplyDefaultOfficialFollowsForCurrentUser(createClient());
      router.replace("/perfil");
      router.refresh();
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Não foi possível concluir seu onboarding."));
    } finally {
      setIsSaving(false);
    }
  }

  if (isAgeBlocked) {
    return (
      <main className={styles.page}>
        <section className={styles.shell}>
          <header className={styles.topbar}>
            <OceanLogo size="md" />
          </header>
          <div className={styles.card}>
            <section className={styles.stepPanel}>
              <h1>Não foi possível criar sua conta</h1>
              <p>A Fluxo não está disponível para você no momento. Obrigado pelo interesse.</p>
            </section>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.topbar}>
          <OceanLogo size="md" />
          <span>Onboarding obrigatório</span>
        </header>

        <div className={styles.progress} aria-label="Progresso do onboarding">
          {steps.map((item, index) => (
            <span className={index <= currentStepIndex ? styles.progressActive : ""} key={item.id} />
          ))}
        </div>

        <nav className={styles.steps} aria-label="Etapas">
          {steps.map((item, index) => (
            <span className={index <= currentStepIndex ? styles.stepActive : ""} key={item.id}>
              {item.label}
            </span>
          ))}
        </nav>

        {isLoading && <p className={styles.notice}>Carregando sua entrada...</p>}
        {error && <p className={styles.error}>{error}</p>}

        {form && (
          <form className={styles.card} onSubmit={handleFinish}>
            {step === "welcome" && (
              <section className={styles.stepPanel}>
                <span className={styles.eyebrow}>Bem-vindo à Fluxo</span>
                <h1>Vamos montar seu flow?</h1>
                <p>Antes de entrar, personalize sua presença na Fluxo.</p>
                <button
                  type="button"
                  onClick={() => (birthRecorded ? setStep("identity") : void goNext())}
                >
                  Começar
                </button>
              </section>
            )}

            {step === "birth" && (
              <section className={styles.stepPanel}>
                <span className={styles.eyebrow}>Idade</span>
                <h1>Quando você nasceu?</h1>
                <p>
                  Não aparece no seu perfil. Usamos para ajustar sua experiência e sua
                  segurança na Fluxo.
                </p>
                <label>
                  Data de nascimento
                  <input
                    type="date"
                    value={birthDate}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(event) => setBirthDate(event.target.value)}
                    required
                  />
                </label>
              </section>
            )}

            {step === "identity" && (
              <section className={styles.stepPanel}>
                <span className={styles.eyebrow}>Identidade</span>
                <h1>Como você aparece no flow?</h1>
                <p>Seu Flow ID é como as pessoas vão te encontrar na Fluxo.</p>
                <label>
                  Nome de exibição
                  <input
                    value={form.display_name}
                    onChange={(event) => updateField("display_name", event.target.value)}
                    placeholder="Seu nome"
                    required
                  />
                </label>
                <label>
                  Flow ID
                  <input
                    value={form.username}
                    onChange={(event) => updateUsername(event.target.value)}
                    placeholder="marcos.fluxo"
                    required
                  />
                </label>
                <div className={styles.flowPreview}>~{form.username || "seu.flow"}</div>
              </section>
            )}

            {step === "location" && (
              <section className={styles.stepPanel}>
                <span className={styles.eyebrow}>Localização</span>
                <h1>De onde vem seu flow?</h1>
                <p>
                  País, estado e cidade ajudam a Fluxo a preparar comunidades locais.
                  Coordenadas GPS nunca aparecem publicamente.
                </p>
                <div className={styles.fieldGrid}>
                  <label>
                    País
                    <select
                      value={form.country}
                      onChange={(event) => handleCountryChange(event.target.value)}
                      disabled={isLoadingCountries}
                      required
                    >
                      {(countries.length ? countries : [{ code: "BR", name: "Brasil" }]).map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Estado
                    {form.country === "BR" && states.length > 0 ? (
                      <select
                        value={form.state}
                        onChange={(event) => handleStateChange(event.target.value)}
                        disabled={isLoadingStates}
                        required
                      >
                        <option value="">Selecione o estado</option>
                        {states.map((stateOption) => (
                          <option key={stateOption.code} value={stateOption.code}>
                            {stateOption.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={form.state}
                        onChange={(event) => handleStateChange(event.target.value)}
                        placeholder="Ex: São Paulo"
                        required
                      />
                    )}
                  </label>
                  <label>
                    Cidade
                    {form.country === "BR" && cities.length > 0 ? (
                      <select
                        value={form.city}
                        onChange={(event) => updateField("city", event.target.value)}
                        disabled={isLoadingCities}
                        required
                      >
                        <option value="">Selecione a cidade</option>
                        {cities.map((cityOption) => (
                          <option key={cityOption.name} value={cityOption.name}>
                            {cityOption.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={form.city}
                        onChange={(event) => updateField("city", event.target.value)}
                        placeholder="Ex: São Paulo"
                        required
                      />
                    )}
                  </label>
                </div>
                {form.country === "BR" ? (
                  <p className={styles.helperText}>
                    Estados e cidades do Brasil são carregados pela API oficial do IBGE.
                  </p>
                ) : (
                  <p className={styles.helperText}>
                    Para outros países, use preenchimento manual nesta beta.
                  </p>
                )}
                {locationOptionsError && <p className={styles.error}>{locationOptionsError}</p>}
              </section>
            )}
            {step === "gps" && (
              <section className={styles.stepPanel}>
                <span className={styles.eyebrow}>Localização inteligente</span>
                <h1>Uma Fluxo mais próxima de você.</h1>
                <p>
                  Compartilhar sua localização ajuda a Fluxo a sugerir comunidades locais,
                  melhorar a segurança, reduzir spam e preparar experiências mais relevantes
                  para você.
                </p>
                <p>
                  Se preferir não permitir agora, tudo bem: vamos continuar usando o país,
                  estado e cidade que você informou.
                </p>
                <div className={styles.summary}>
                  <strong>
                    {form.geolocation_permission === "granted"
                      ? "Localização precisa ativada"
                      : "Localização manual selecionada"}
                  </strong>
                  {form.geolocation_permission === "granted" && (
                    <span>Coordenadas salvas de forma privada. Elas não aparecem no seu perfil.</span>
                  )}
                  {form.geolocation_permission !== "granted" && (
                    <span>
                      Vamos usar {form.city || "sua cidade"}, {form.state || "seu estado"}.
                    </span>
                  )}
                  <p>
                    Date, comunidades restritas e recursos sensíveis terão regras de idade,
                    segurança e verificação próprias antes de serem liberados.
                  </p>
                </div>
                <div className={styles.avatarControls}>
                  <button type="button" disabled={isRequestingGps} onClick={requestGps}>
                    {isRequestingGps ? "Solicitando..." : "Permitir localização"}
                  </button>
                  <button type="button" onClick={markGpsUnavailable}>
                    Continuar com cidade/estado
                  </button>
                </div>
              </section>
            )}

            {step === "sex" && (
              <section className={styles.stepPanel}>
                <span className={styles.eyebrow}>Segurança</span>
                <h1>Informação privada</h1>
                <p>
                  Essa informação é privada e ajuda a Fluxo a preparar recursos de
                  segurança e experiências futuras.
                </p>
                <div className={styles.chips}>
                  {sexOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={form.biological_sex === option.value ? styles.selected : ""}
                      onClick={() => updateField("biological_sex", option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {step === "avatar" && (
              <section className={styles.stepPanel}>
                <span className={styles.eyebrow}>Foto</span>
                <h1>Sua presença visual</h1>
                <p>Use uma imagem por URL, aproveite a foto do Google ou pule por enquanto.</p>
                <div className={styles.avatarRow}>
                  <div className={styles.avatarPreview}>
                    {form.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={form.avatar_url} alt="" />
                    ) : (
                      <span>fluxo</span>
                    )}
                  </div>
                  <div className={styles.avatarControls}>
                    {googleAvatarUrl && (
                      <button type="button" onClick={() => updateField("avatar_url", googleAvatarUrl)}>
                        Usar foto do Google
                      </button>
                    )}
                    <button type="button" onClick={() => updateField("avatar_url", "")}>
                      Pular por enquanto
                    </button>
                  </div>
                </div>
                <label>
                  Avatar URL
                  <input
                    value={form.avatar_url}
                    onChange={(event) => updateField("avatar_url", event.target.value)}
                    placeholder="https://..."
                  />
                </label>
              </section>
            )}

            {step === "bio" && (
              <section className={styles.stepPanel}>
                <span className={styles.eyebrow}>Sobre seu flow</span>
                <h1>O que a galera encontra por aqui?</h1>
                <p>Conte quem você é, o que curte ou o que a galera vai encontrar no seu flow.</p>
                <p>
                  Saiba como usamos seus dados na{" "}
                  <a href="/legal/privacidade" target="_blank" rel="noreferrer">
                    Política de Privacidade
                  </a>
                  .
                </p>
                <label>
                  Sobre seu flow
                  <textarea
                    value={form.bio}
                    onChange={(event) => updateField("bio", event.target.value)}
                    maxLength={180}
                    rows={5}
                    placeholder="Ex: música, tecnologia, rolês, memes e boas conversas..."
                  />
                </label>
              </section>
            )}

            {step === "finish" && (
              <section className={styles.stepPanel}>
                <span className={styles.eyebrow}>Final</span>
                <h1>Seu flow está pronto.</h1>
                <p>Agora você já pode marcar presença na Fluxo.</p>
                <div className={styles.summary}>
                  <strong>{form.display_name || "Seu nome"}</strong>
                  <span>~{form.username || "flow.id"}</span>
                  <p>{form.city && form.state ? `${form.city}, ${form.state}` : "Cidade e estado pendentes."}</p>
                  <p>{form.bio || "Sobre seu flow será exibido aqui quando você preencher."}</p>
                </div>
                <label>
                  Código de convite (opcional)
                  <input
                    value={inviteCode}
                    onChange={(event) => setInviteCode(normalizeInviteCode(event.target.value))}
                    placeholder="Ex: K7PX2QMA"
                    autoCapitalize="characters"
                  />
                </label>
                <button type="submit" disabled={isSaving}>
                  {isSaving ? "Entrando..." : "Entrar na Fluxo"}
                </button>
              </section>
            )}

            {step !== "welcome" && step !== "finish" && (
              <footer className={styles.actions}>
                <button type="button" onClick={goBack}>Voltar</button>
                <button type="button" onClick={goNext}>Continuar</button>
              </footer>
            )}

            {step === "finish" && (
              <footer className={styles.actions}>
                <button type="button" onClick={goBack}>Voltar</button>
              </footer>
            )}
          </form>
        )}
      </section>
    </main>
  );
}



