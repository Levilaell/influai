-- Troca de provedor de cobrança: AbacatePay -> Stripe (Stripe test não exige CNPJ).
alter table users add column stripe_customer_id text;
