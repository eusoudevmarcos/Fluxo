import type { Metadata } from "next";

import { DownloadClient } from "./DownloadClient";

export const metadata: Metadata = {
  title: "Baixar a Fluxo",
  description: "Baixe o app da Fluxo para Android ou iPhone e entre na versão de teste.",
};

// Links preenchidos por variavel de ambiente depois de cada build (ver docs/LANCAMENTO_BETA.md):
// NEXT_PUBLIC_ANDROID_APK_URL = link do APK gerado pelo `eas build --profile preview`
// NEXT_PUBLIC_IOS_TESTFLIGHT_URL = link publico do TestFlight
export default function BaixarPage() {
  return (
    <DownloadClient
      androidUrl={process.env.NEXT_PUBLIC_ANDROID_APK_URL?.trim() || null}
      iosUrl={process.env.NEXT_PUBLIC_IOS_TESTFLIGHT_URL?.trim() || null}
    />
  );
}
