-- Confirmed publication snapshots are append-only. Corrections create new rows;
-- they never mutate or delete the publication/item they supersede.

CREATE OR REPLACE FUNCTION "prevent_result_publication_snapshot_mutation"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Result publication snapshots are immutable; create a correction publication instead.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "result_publications_immutable"
BEFORE UPDATE OR DELETE ON "result_publications"
FOR EACH ROW EXECUTE FUNCTION "prevent_result_publication_snapshot_mutation"();

CREATE TRIGGER "result_publication_items_immutable"
BEFORE UPDATE OR DELETE ON "result_publication_items"
FOR EACH ROW EXECUTE FUNCTION "prevent_result_publication_snapshot_mutation"();
