-- =============================================================
-- SuKo Shop - schema de aplicação (tabelas public)
-- Rode este script no SQL Editor do projeto Neon NOVO depois de
-- ativar o Neon Auth nele. Recria tudo que o site usa.
-- É seguro rodar mais de uma vez (IF NOT EXISTS / ON CONFLICT).
-- =============================================================

-- Perfil de cada conta: saldo na plataforma + VIP
CREATE TABLE IF NOT EXISTS public.user_profile (
  user_id     uuid PRIMARY KEY,
  email       text UNIQUE NOT NULL,
  name        text,
  balance_cents bigint NOT NULL DEFAULT 0,
  is_vip      boolean NOT NULL DEFAULT false,
  vip_until   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Configurações globais (preço do gmail, preço do vip, etc.)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key        text PRIMARY KEY,
  value      text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Pool de gmails (aged verifieds)
CREATE TABLE IF NOT EXISTS public.gmail_pool (
  id          bigserial PRIMARY KEY,
  address     text UNIQUE NOT NULL,
  note        text,
  status      text NOT NULL DEFAULT 'available',
  kind        text NOT NULL DEFAULT 'alias',
  assigned_email text,
  assigned_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Garante as colunas em pools criadas por versoes antigas do schema
ALTER TABLE public.gmail_pool
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'alias',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Wishlist: emails desbloqueados para todos
CREATE TABLE IF NOT EXISTS public.email_wishlist (
  id         bigserial PRIMARY KEY,
  address    text UNIQUE NOT NULL,
  label      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Histórico de emails gerados/alugados por usuário
CREATE TABLE IF NOT EXISTS public.email_history (
  id          bigserial PRIMARY KEY,
  user_email  text NOT NULL,
  address     text NOT NULL,
  email_type  text NOT NULL DEFAULT 'other',
  source      text NOT NULL DEFAULT 'generated',
  price_cents bigint NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_email, address)
);

-- Log de transações (depósitos, compras, vip, ajustes)
CREATE TABLE IF NOT EXISTS public.transaction_log (
  id          bigserial PRIMARY KEY,
  user_email  text NOT NULL,
  type        text NOT NULL,
  amount_cents bigint NOT NULL DEFAULT 0,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Páginas de revendedores: cada revendedor tem uma página com chave pública
-- (ex: gabriel-523953278934) e uma lista de gmails exclusivos daquela página.
CREATE TABLE IF NOT EXISTS public.reseller_page (
  id         bigserial PRIMARY KEY,
  key        text UNIQUE NOT NULL,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reseller_gmail (
  id         bigserial PRIMARY KEY,
  page_id    bigint NOT NULL REFERENCES public.reseller_page(id) ON DELETE CASCADE,
  address    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_id, address)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_reseller_gmail_page    ON public.reseller_gmail (page_id);
CREATE INDEX IF NOT EXISTS idx_transaction_log_email ON public.transaction_log (user_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_history_user   ON public.email_history (user_email, created_at DESC);

-- Settings padrão (preço gmail = 0, preço vip = $4.00)
INSERT INTO public.platform_settings (key, value)
VALUES ('gmail_price_cents', '0'), ('vip_price_cents', '400')
ON CONFLICT (key) DO NOTHING;
