-- Unknown historical uploader roles stay unknown, never inferred from a changed current role.
ALTER TABLE "ImportBatch" ADD COLUMN "importRole" "Role";
