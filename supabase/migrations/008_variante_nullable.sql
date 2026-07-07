-- La variante ya no es obligatoria al cargar una sesión;
-- null significa "sin especificar" en stats y listados.
alter table poker_session alter column variante drop not null;
alter table poker_session alter column variante drop default;
