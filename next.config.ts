import type { NextConfig } from "next";
import { execSync } from "node:child_process";

// Hash curto do commit buildado — vira NEXT_PUBLIC_COMMIT_SHA (inlined em
// build time, disponível em client e server). Em produção na Vercel vem do
// env var do próprio provedor; em build local (sem esse env var) cai pro
// HEAD do git na hora do build, pra sempre dar pra identificar a versão
// mesmo fora da Vercel.
function commitShaAtual(): string {
  const daVercel = process.env.VERCEL_GIT_COMMIT_SHA
  if (daVercel) return daVercel.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
}

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse'],
  env: {
    NEXT_PUBLIC_COMMIT_SHA: commitShaAtual(),
  },
};

export default nextConfig;
