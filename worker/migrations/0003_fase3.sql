-- Fase 3: producten die via een geplakte link binnenkomen hebben eerst een tijdelijke naam.
-- named = 0: naam komt van de eerste geslaagde check. named = 1: vaste naam.
ALTER TABLE products ADD COLUMN named INTEGER NOT NULL DEFAULT 1;
CREATE INDEX watches_product ON watches (product_id);
