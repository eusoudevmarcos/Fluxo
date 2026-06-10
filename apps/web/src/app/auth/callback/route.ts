import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

import { ensureProfileWithClient, getErrorMessage } from "@/lib/profiles/ensure-profile";
import { hasAcceptedCurrentLegalVersions } from "@/lib/services/legal.service";
import { getSupabaseConfig } from "@/lib/supabase/config";

function getSafeNextPath(requestUrl: URL) {
  const next = requestUrl.searchParams.get("next") || "/perfil";

  if (!next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }

  return next;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const oauthError =
    requestUrl.searchParams.get("error_description") ||
    requestUrl.searchParams.get("error");

  if (!code) {
    const loginUrl = new URL("/auth?mode=login", requestUrl.origin);
    loginUrl.searchParams.set(
      "error",
      oauthError ||
        "O retorno do Google chegou sem código de sessão. Em testes mobile locais, use HTTPS/túnel ou teste pelo domínio final.",
    );
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const loginUrl = new URL("/auth?mode=login", requestUrl.origin);
    loginUrl.searchParams.set("error", error.message);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const profile = await ensureProfileWithClient(supabase);
    const hasLegalAcceptance = await hasAcceptedCurrentLegalVersions(supabase);

    if (!hasLegalAcceptance) {
      const legalResponse = NextResponse.redirect(new URL("/legal/accept", requestUrl.origin));

      response.cookies.getAll().forEach((cookie) => {
        legalResponse.cookies.set(cookie);
      });

      return legalResponse;
    }

    const safeNextPath = getSafeNextPath(requestUrl);
    const isProfileReady = profile.onboarding_completed && profile.profile_required_completed;
    const nextPath = isProfileReady
      ? safeNextPath === "/onboarding" ? "/perfil" : safeNextPath
      : "/onboarding";
    const redirectResponse = NextResponse.redirect(new URL(nextPath, requestUrl.origin));

    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    return redirectResponse;
  } catch (profileError) {
    const profileUrl = new URL("/perfil", requestUrl.origin);
    profileUrl.searchParams.set(
      "profile_error",
      getErrorMessage(profileError, "Não foi possível preparar seu perfil."),
    );
    const redirectResponse = NextResponse.redirect(profileUrl);

    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    return redirectResponse;
  }
}
