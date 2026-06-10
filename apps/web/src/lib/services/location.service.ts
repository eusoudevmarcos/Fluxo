export type CountryOption = {
  code: string;
  name: string;
};

export type StateOption = {
  code: string;
  name: string;
};

export type CityOption = {
  name: string;
};

const FALLBACK_COUNTRIES: CountryOption[] = [
  { code: "BR", name: "Brasil" },
  { code: "PT", name: "Portugal" },
  { code: "US", name: "Estados Unidos" },
  { code: "ES", name: "Espanha" },
  { code: "AR", name: "Argentina" },
  { code: "UY", name: "Uruguai" },
  { code: "CL", name: "Chile" },
  { code: "PY", name: "Paraguai" },
];

type RestCountryRow = {
  cca2?: string;
  name?: {
    common?: string;
  };
  translations?: {
    por?: {
      common?: string;
    };
  };
};

type IbgeStateRow = {
  id: number;
  sigla: string;
  nome: string;
};

type IbgeCityRow = {
  nome: string;
};

function sortByName<T extends { name: string }>(items: T[]) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function withBrazilFirst(countries: CountryOption[]) {
  const uniqueCountries = new Map(countries.map((country) => [country.code, country]));
  const brazil = uniqueCountries.get("BR") ?? FALLBACK_COUNTRIES[0];
  uniqueCountries.delete("BR");

  return [brazil, ...sortByName([...uniqueCountries.values()])];
}

export async function listCountries(): Promise<CountryOption[]> {
  try {
    const response = await fetch("https://restcountries.com/v3.1/all?fields=name,cca2,translations");

    if (!response.ok) {
      throw new Error("Countries API unavailable");
    }

    const rows = (await response.json()) as RestCountryRow[];
    const countries = rows
      .map((row) => ({
        code: row.cca2?.toUpperCase() ?? "",
        name: row.translations?.por?.common || row.name?.common || "",
      }))
      .filter((country) => country.code && country.name);

    return countries.length ? withBrazilFirst(countries) : FALLBACK_COUNTRIES;
  } catch {
    return FALLBACK_COUNTRIES;
  }
}

export async function listStatesByCountry(countryCode: string): Promise<StateOption[]> {
  if (countryCode !== "BR") {
    return [];
  }

  const response = await fetch(
    "https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome",
  );

  if (!response.ok) {
    throw new Error("Não foi possível carregar os estados agora.");
  }

  const rows = (await response.json()) as IbgeStateRow[];

  return rows.map((row) => ({
    code: row.sigla,
    name: row.nome,
  }));
}

export async function listCitiesByState(
  countryCode: string,
  stateCode: string,
): Promise<CityOption[]> {
  if (countryCode !== "BR" || !stateCode) {
    return [];
  }

  const response = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${stateCode}/municipios?orderBy=nome`,
  );

  if (!response.ok) {
    throw new Error("Não foi possível carregar as cidades agora.");
  }

  const rows = (await response.json()) as IbgeCityRow[];

  return rows.map((row) => ({ name: row.nome }));
}
