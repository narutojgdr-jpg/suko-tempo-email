"use client"

import { useState } from "react"
import { Check, Copy, KeyRound, Terminal } from "lucide-react"

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-lg border border-border bg-background p-4 text-xs leading-relaxed text-foreground shadow-soft">
        <code className="font-mono whitespace-pre">{code}</code>
      </pre>
      <button
        onClick={copy}
        className="animate-press absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-fluid hover:text-foreground"
        aria-label="Copiar"
      >
        {copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  )
}

function Method({ verb, path }: { verb: string; path: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-md bg-accent/15 px-2 py-1 font-mono text-xs font-bold text-accent">{verb}</span>
      <code className="font-mono text-sm text-foreground">{path}</code>
    </div>
  )
}

interface Endpoint {
  verb: string
  path: string
  title: string
  desc: string
  example: string
  response: string
}

export function ApiDocs({ baseUrl }: { baseUrl: string }) {
  const endpoints: Endpoint[] = [
    {
      verb: "GET",
      path: "/api/v1/domains",
      title: "Listar domínios",
      desc: "Retorna os domínios que dá para ler (Gmail/Outlook) e os domínios próprios em que dá para gerar endereços.",
      example: `curl "${baseUrl}/api/v1/domains" \\\n  -H "Authorization: Bearer SUA_CHAVE"`,
      response: `{
  "readable": {
    "gmail": ["gmail.com", "googlemail.com"],
    "outlook": ["outlook.com", "hotmail.com", "..."]
  },
  "generatable": ["sukohub.com", "skzz.net", "..."]
}`,
    },
    {
      verb: "GET",
      path: "/api/v1/generate",
      title: "Gerar e-mail",
      desc: "Cria um endereço aleatório em um domínio próprio. Passe ?domain=x para forçar um domínio específico.",
      example: `curl "${baseUrl}/api/v1/generate?domain=sukohub.com" \\\n  -H "Authorization: Bearer SUA_CHAVE"`,
      response: `{
  "email": "xnib9gsluz@sukohub.com",
  "domain": "sukohub.com"
}`,
    },
    {
      verb: "GET",
      path: "/api/v1/inbox",
      title: "Ler caixa de entrada",
      desc: "Lista os e-mails recebidos por um endereço (Gmail, Outlook ou domínio próprio), do mais novo para o mais antigo.",
      example: `curl "${baseUrl}/api/v1/inbox?email=fulano%40gmail.com" \\\n  -H "Authorization: Bearer SUA_CHAVE"`,
      response: `{
  "email": "fulano@gmail.com",
  "provider": "gmail",
  "count": 1,
  "emails": [
    {
      "id": "...",
      "from": "no-reply@netflix.com",
      "subject": "Seu código de acesso",
      "date": "2026-06-22T18:00:00.000Z",
      "body": "<html>...</html>"
    }
  ]
}`,
    },
    {
      verb: "GET",
      path: "/api/v1/code",
      title: "Pegar código de verificação",
      desc: "Detecta e retorna automaticamente o código OTP/2FA mais recente da caixa. Ideal para automação de login.",
      example: `curl "${baseUrl}/api/v1/code?email=fulano%40gmail.com" \\\n  -H "Authorization: Bearer SUA_CHAVE"`,
      response: `{
  "email": "fulano@gmail.com",
  "found": true,
  "code": "123456",
  "from": "no-reply@google.com",
  "subject": "Seu código de verificação",
  "date": "2026-06-22T18:00:00.000Z"
}`,
    },
  ]

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <header className="animate-fade-in-up mb-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Terminal className="h-3.5 w-3.5" />
          API v1
        </div>
        <h1 className="text-balance text-3xl font-bold text-foreground">API de E-mails SuKo</h1>
        <p className="mt-2 text-pretty leading-relaxed text-muted-foreground">
          Leia caixas de Gmail, Outlook e domínios próprios, gere endereços e pegue códigos de verificação
          automaticamente — tudo via uma API REST simples para integrar em qualquer site.
        </p>
      </header>

      {/* Auth */}
      <section className="animate-fade-in-up mb-8 rounded-xl border border-border bg-card p-5 shadow-soft-lg">
        <div className="mb-3 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-card-foreground">Autenticação</h2>
        </div>
        <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
          Toda requisição precisa de uma chave de API no header. Peça uma chave ao administrador. Você pode usar
          qualquer um dos dois formatos:
        </p>
        <CodeBlock code={`Authorization: Bearer SUA_CHAVE\n# ou\nx-api-key: SUA_CHAVE`} />
        <div className="mt-3 rounded-lg border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Base URL:</span>{" "}
            <code className="font-mono text-primary">{baseUrl}</code>
          </p>
        </div>
      </section>

      {/* Endpoints */}
      <div className="space-y-5">
        {endpoints.map((ep) => (
          <section
            key={ep.path}
            className="animate-fade-in-up rounded-xl border border-border bg-card p-5 shadow-soft transition-fluid hover:shadow-soft-lg"
          >
            <Method verb={ep.verb} path={ep.path} />
            <h3 className="mt-3 text-base font-bold text-card-foreground">{ep.title}</h3>
            <p className="mb-4 mt-1 text-sm leading-relaxed text-muted-foreground">{ep.desc}</p>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exemplo</p>
            <CodeBlock code={ep.example} />
            <p className="mb-1.5 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Resposta
            </p>
            <CodeBlock code={ep.response} />
          </section>
        ))}
      </div>

      <footer className="mt-10 rounded-xl border border-border bg-card/60 p-5">
        <h2 className="mb-2 text-sm font-bold text-card-foreground">Erros comuns</h2>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>
            <code className="font-mono text-destructive">401</code> — chave ausente ou inválida.
          </li>
          <li>
            <code className="font-mono text-destructive">400</code> — parâmetro{" "}
            <code className="font-mono">email</code> inválido ou domínio não suportado.
          </li>
          <li>
            <code className="font-mono text-destructive">502</code> — falha ao ler a caixa na origem.
          </li>
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Dica: endereços com <code className="font-mono">+</code> (ex: fulano+tag@gmail.com) funcionam — use{" "}
          <code className="font-mono">%2B</code> na URL ou deixe o <code className="font-mono">+</code> que a API
          trata automaticamente.
        </p>
      </footer>
    </main>
  )
}
