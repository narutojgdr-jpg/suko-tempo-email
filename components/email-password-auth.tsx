"use client"

import { useState } from "react"
import { Loader2, Mail, Lock, User } from "lucide-react"
import { authClient } from "@/lib/auth/client"

interface EmailPasswordAuthProps {
  /** Where to land after a successful auth (e.g. "/pt"). */
  callbackURL: string
  /** UI language for the static labels. */
  lang: string
}

type Mode = "signin" | "signup"

const COPY: Record<
  string,
  {
    signinTab: string
    signupTab: string
    name: string
    namePlaceholder: string
    email: string
    emailPlaceholder: string
    password: string
    passwordPlaceholder: string
    signinButton: string
    signupButton: string
    loading: string
    or: string
    invalidEmail: string
    shortPassword: string
    needName: string
    genericError: string
  }
> = {
  pt: {
    signinTab: "Entrar",
    signupTab: "Criar conta",
    name: "Nome",
    namePlaceholder: "Seu nome",
    email: "Email",
    emailPlaceholder: "voce@exemplo.com",
    password: "Senha",
    passwordPlaceholder: "Minimo 8 caracteres",
    signinButton: "Entrar",
    signupButton: "Criar conta",
    loading: "Aguarde...",
    or: "ou",
    invalidEmail: "Digite um email valido.",
    shortPassword: "A senha precisa ter pelo menos 8 caracteres.",
    needName: "Digite seu nome.",
    genericError: "Nao foi possivel autenticar. Verifique os dados e tente novamente.",
  },
  en: {
    signinTab: "Sign in",
    signupTab: "Create account",
    name: "Name",
    namePlaceholder: "Your name",
    email: "Email",
    emailPlaceholder: "you@example.com",
    password: "Password",
    passwordPlaceholder: "At least 8 characters",
    signinButton: "Sign in",
    signupButton: "Create account",
    loading: "Please wait...",
    or: "or",
    invalidEmail: "Enter a valid email.",
    shortPassword: "Password must be at least 8 characters.",
    needName: "Enter your name.",
    genericError: "Could not authenticate. Check your details and try again.",
  },
  ru: {
    signinTab: "Войти",
    signupTab: "Регистрация",
    name: "Имя",
    namePlaceholder: "Ваше имя",
    email: "Email",
    emailPlaceholder: "you@example.com",
    password: "Пароль",
    passwordPlaceholder: "Минимум 8 символов",
    signinButton: "Войти",
    signupButton: "Создать аккаунт",
    loading: "Подождите...",
    or: "или",
    invalidEmail: "Введите корректный email.",
    shortPassword: "Пароль должен содержать минимум 8 символов.",
    needName: "Введите имя.",
    genericError: "Не удалось войти. Проверьте данные и попробуйте снова.",
  },
}

export function EmailPasswordAuth({ callbackURL, lang }: EmailPasswordAuthProps) {
  const t = COPY[lang] ?? COPY.en
  const [mode, setMode] = useState<Mode>("signin")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      setError(t.invalidEmail)
      return
    }
    if (password.length < 8) {
      setError(t.shortPassword)
      return
    }
    if (mode === "signup" && !name.trim()) {
      setError(t.needName)
      return
    }

    setLoading(true)
    try {
      const result =
        mode === "signup"
          ? await authClient.signUp.email({
              email: cleanEmail,
              password,
              name: name.trim(),
              callbackURL,
            })
          : await authClient.signIn.email({
              email: cleanEmail,
              password,
              callbackURL,
              rememberMe: true,
            })

      if (result?.error) {
        setError(result.error.message || t.genericError)
        setLoading(false)
        return
      }

      // Full reload so the server-rendered session is picked up.
      window.location.href = callbackURL
    } catch {
      setError(t.genericError)
      setLoading(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Mode toggle */}
      <div className="inline-flex w-full rounded-lg border border-border bg-background p-1">
        {(["signin", "signup"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m)
              setError(null)
            }}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              mode === m
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m === "signin" ? t.signinTab : t.signupTab}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3 text-left">
        {mode === "signup" && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t.name}</span>
            <div className="flex items-center rounded-lg border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-primary">
              <User className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.namePlaceholder}
                autoComplete="name"
                className="w-full bg-transparent px-2 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t.email}</span>
          <div className="flex items-center rounded-lg border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-primary">
            <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPlaceholder}
              autoComplete="email"
              className="w-full bg-transparent px-2 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t.password}</span>
          <div className="flex items-center rounded-lg border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-primary">
            <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.passwordPlaceholder}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className="w-full bg-transparent px-2 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
        </label>

        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? t.loading : mode === "signin" ? t.signinButton : t.signupButton}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase text-muted-foreground">{t.or}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  )
}
