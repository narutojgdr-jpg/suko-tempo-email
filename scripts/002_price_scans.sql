-- Tabela para armazenar resultados do scanner de preços
CREATE TABLE IF NOT EXISTS public.price_scans (
  id          bigserial PRIMARY KEY,
  keyword     text NOT NULL,
  username    text NOT NULL,
  price       numeric(10,2),
  out_of_stock boolean NOT NULL DEFAULT false,
  last_restock timestamptz,
  snippet     text,
  scanned_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (keyword, username)
);

CREATE INDEX IF NOT EXISTS idx_price_scans_keyword ON public.price_scans (keyword, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_scans_price ON public.price_scans (keyword, price) WHERE price IS NOT NULL AND NOT out_of_stock;
