-- Convert execution notes from translated labels to key-based format
-- This allows dynamic translation of field labels based on user's language preference

-- The old format used translated labels like:
-- Portuguese: "Origem (IP): 192.168.1.1" or "Observações:\nsome notes"
-- English: "Source (IP): 192.168.1.1" or "Observations:\nsome notes"

-- The new format uses keys like:
-- "[source_ip]: 192.168.1.1" or "[notes]:\nsome notes"

-- This migration converts all known field labels from both languages to the key-based format

UPDATE executions
SET notes =
    -- Convert Portuguese labels
    REGEXP_REPLACE(
    REGEXP_REPLACE(
    REGEXP_REPLACE(
    REGEXP_REPLACE(
    REGEXP_REPLACE(
    REGEXP_REPLACE(
    -- Convert English labels
    REGEXP_REPLACE(
    REGEXP_REPLACE(
    REGEXP_REPLACE(
    REGEXP_REPLACE(
    REGEXP_REPLACE(
    REGEXP_REPLACE(
        notes,
        -- English: Source (IP)
        '^Source \(IP\):', '[source_ip]:', 'gm'),
        -- English: Hostname
        '^Hostname:', '[hostname]:', 'gm'),
        -- English: User
        '^User:', '[username]:', 'gm'),
        -- English: Target
        '^Target:', '[target_system]:', 'gm'),
        -- English: References
        '^References:', '[references]:', 'gm'),
        -- English: Observations (notes section)
        '(\n?)Observations:\n', E'\\1[notes]:\n', 'gm'),
    -- Portuguese: Origem (IP)
    '^Origem \(IP\):', '[source_ip]:', 'gm'),
    -- Portuguese: Hostname (same in both languages)
    '^Hostname:', '[hostname]:', 'gm'),
    -- Portuguese: Usuário
    '^Usuário:', '[username]:', 'gm'),
    -- Portuguese: Alvo
    '^Alvo:', '[target_system]:', 'gm'),
    -- Portuguese: Referências
    '^Referências:', '[references]:', 'gm'),
    -- Portuguese: Observações (notes section)
    '(\n?)Observações:\n', E'\\1[notes]:\n', 'gm')
WHERE notes IS NOT NULL
  AND notes != ''
  AND (
    -- Only update records that have the old format (contain translated labels)
    notes ~ '(^|\n)(Origem \(IP\)|Source \(IP\)|Hostname|User:|Usuário:|Target:|Alvo:|References:|Referências:|Observations:\n|Observações:\n)'
  );

-- Add a comment to track the migration
COMMENT ON TABLE executions IS 'Notes field now uses key-based format [field_key]: value for i18n support. Migration 003 converted existing records.';
