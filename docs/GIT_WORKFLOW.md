# Fluxo — fluxo de trabalho no Git

| Branch | Papel | Quem escreve nela |
|---|---|---|
| `main` | **Definitiva.** Sempre estável; é o que vai para produção (Render/Vercel/EAS). | Só recebe merge de `dev` via Pull Request. |
| `dev` | **Teste / integração.** Onde o trabalho do dia a dia acontece e é validado. | Commits diretos ou merge de branches de feature. |
| `feat/<tema>`, `fix/<tema>` | Trabalhos maiores ou arriscados, saindo de `dev`. | Opcional. |

## Rotina

```bash
git switch dev && git pull            # começar o dia
# ... trabalhar, testar localmente ...
npm run typecheck && npm run lint     # antes de commitar
git add <arquivos> && git commit -m "feat: ..."
git push                              # sobe para origin/dev
```

Quando `dev` estiver testada e estável:

```bash
gh pr create --base main --head dev --title "Release: <resumo>"
# revisar o diff no GitHub e fazer o merge
git switch main && git pull && git switch dev && git merge main   # re-sincroniza
```

## Convenções

- **Commits:** `tipo: resumo no imperativo` — `feat`, `fix`, `chore`, `docs`, `refactor`.
- **Nunca commitar:** `dist/`, `.next/`, `node_modules/`, `.env*` (exceto `.env.example`), dumps de banco, imagens de referência pesadas. O `.gitignore` já cobre isso.
- **Nunca** `git push --force` em `main`.
- Binários grandes ficam para sempre no histórico — pense antes de commitar PNGs pesados.

## Recomendado no GitHub (Settings → Branches)

Proteger `main`: exigir Pull Request, bloquear force-push e bloquear exclusão.
