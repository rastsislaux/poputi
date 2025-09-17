resource "google_service_account" "exporter" {
  account_id   = "firestore-exporter"
  display_name = "Firestore Exporter (read-only)"
}

resource "google_project_iam_member" "exporter_firestore_viewer" {
  project = var.project_id
  role    = "roles/datastore.viewer"
  member  = "serviceAccount:${google_service_account.exporter.email}"
}

# JSON key for offline export usage (sensitive). This bypasses Firestore rules via IAM.
resource "google_service_account_key" "exporter" {
  service_account_id = google_service_account.exporter.name
  private_key_type   = "TYPE_GOOGLE_CREDENTIALS_FILE"

  # change this to rotate key material
  keepers = {
    purpose = "exporter-key-v1"
  }
}


