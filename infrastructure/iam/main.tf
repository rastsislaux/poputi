variable "project_id" { type = string }

resource "google_service_account" "exporter" {
  account_id   = "firestore-exporter"
  display_name = "Firestore Exporter (read-only)"
}

resource "google_project_iam_member" "exporter_firestore_viewer" {
  project = var.project_id
  role    = "roles/datastore.viewer"
  member  = "serviceAccount:${google_service_account.exporter.email}"
}

resource "google_service_account_key" "exporter" {
  service_account_id = google_service_account.exporter.name
  private_key_type   = "TYPE_GOOGLE_CREDENTIALS_FILE"
  keepers = { purpose = "exporter-key-v1" }
}

output "export_service_account_email" { value = google_service_account.exporter.email }
output "export_service_account_key_json" { value = base64decode(google_service_account_key.exporter.private_key) }


