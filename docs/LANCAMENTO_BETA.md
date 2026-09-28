# Lançamento do beta da Fluxo — passo a passo

Siga **nesta ordem**. O app novo depende do banco atualizado: se o link de download sair antes do
passo 1, ninguém consegue concluir o cadastro (a etapa da data de nascimento falha).

## 1. Banco (Supabase)

1. Na raiz do repositório, rode o teste do banco (aplica todas as migrations num Postgres local):
   ```bash
   npm run test:db
   ```
   Tem que terminar com `tudo ok`.
2. Supabase → **SQL Editor** → cole `SUPABASE_LAUNCH_BETA_046_057.sql` inteiro → **Run**.
   Pré-requisito: migrations até a 045 já aplicadas.
3. No mesmo SQL Editor, cadastre as contas oficiais (moderam, aprovam criadores, veem métricas):
   ```sql
   insert into public.official_accounts (user_id, kind, is_default_follow, is_founder, label)
   select user_id, 'founder', true, true, 'Fundador'
   from public.profiles where username = 'SEU_USERNAME'
   on conflict (user_id) do nothing;
   ```
4. **Authentication → URL Configuration**: `Site URL` = domínio do site; em `Redirect URLs`
   adicione `https://SEU_DOMINIO/**` e `fluxo://**`.
5. **Authentication → E-mail**: o envio padrão do Supabase manda poucos e-mails por hora. Para o
   beta, configure um SMTP próprio (Resend, Brevo, SES…) **ou** desligue "Confirm email".

## 2. Site (web)

Variáveis de ambiente na hospedagem (ex.: Vercel), veja `apps/web/.env.example`:

| Variável | Valor |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Do projeto Supabase |
| `NEXT_PUBLIC_ANDROID_APK_URL` | Link do APK (passo 3) |
| `NEXT_PUBLIC_IOS_TESTFLIGHT_URL` | Link público do TestFlight (passo 4) |

Páginas que você divulga:

- `https://SEU_DOMINIO/baixar` — download do app (Android e iPhone) com passo a passo.
- `https://SEU_DOMINIO/c/CODIGO` — link de convite de cada pessoa (leva para `/baixar` com o código salvo).

Admin (só contas oficiais): `/admin/metricas`, `/admin/moderacao`, `/admin/criadores`.

## 3. Android (APK por link)

Dentro de `apps/mobile`, com a conta Expo logada (`npx eas login`):

```bash
npx eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value "https://xxxx.supabase.co" --visibility plaintext
npx eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "CHAVE_ANON" --visibility plaintext
npx eas env:create --environment preview --name EXPO_PUBLIC_WEB_URL --value "https://SEU_DOMINIO" --visibility plaintext
npx eas build --profile preview --platform android
```

Ao terminar, o EAS mostra o link do `.apk`. Coloque em `NEXT_PUBLIC_ANDROID_APK_URL` e publique o site.
(Crie as mesmas variáveis no ambiente `production` quando for para a loja.)

## 4. iPhone (TestFlight)

Precisa de conta Apple Developer (US$ 99/ano). Download direto de arquivo não funciona no iPhone.

```bash
npx eas build --profile testflight --platform ios
npx eas submit --platform ios
```

No App Store Connect → TestFlight: crie um grupo externo, ative o **link público** e cole em
`NEXT_PUBLIC_IOS_TESTFLIGHT_URL`. O primeiro envio para testadores externos passa por uma revisão
rápida da Apple.

## 5. Atualizações sem reinstalar (EAS Update)

Mudanças só de código JavaScript (telas, textos, regras no app) chegam sozinhas na próxima abertura:

```bash
npx eas update --channel preview --message "o que mudou"
```

Os builds `preview` (Android) e `testflight` (iPhone) escutam o canal `preview`. Precisa de **build
novo** (e de novo link no `/baixar`) quando mudar: versão do app em `app.json`, bibliotecas nativas,
permissões, ícone ou splash.

## 6. Antes de divulgar — teste num aparelho real

- [ ] Cadastro com data de nascimento (adulto e 15 anos) e bloqueio de menor de 14
- [ ] Aceite dos termos aparece antes do onboarding
- [ ] Link de convite `/c/CODIGO` → `/baixar` → código no fim do cadastro → os dois se seguem
- [ ] Missões avançam ao postar, curtir e comentar (em outra conta)
- [ ] Notificação push chega com o app fechado (não funciona no Expo Go)
- [ ] Botão voltar do Android volta uma tela por vez
- [ ] Denunciar post e bloquear perfil; post denunciado aparece em `/admin/moderacao`
- [ ] "Enviar feedback" chega em `/admin/moderacao` → Feedbacks
