output "project_id" {
  description = "The Google Cloud project ID"
  value       = var.project_id
}

output "firestore_database_name" {
  description = "The Firestore database name"
  value       = google_firestore_database.this.name
}

output "firestore_location" {
  description = "The Firestore database location"
  value       = google_firestore_database.this.location_id
}

output "firebase_web_config" {
  description = "Firebase Web App config for frontend"
  value = {
    apiKey            = try(data.google_firebase_web_app_config.web.api_key, null)
    authDomain        = try(data.google_firebase_web_app_config.web.auth_domain, null)
    projectId         = var.project_id
    storageBucket     = try(data.google_firebase_web_app_config.web.storage_bucket, null)
    messagingSenderId = try(data.google_firebase_web_app_config.web.messaging_sender_id, null)
    appId             = try(google_firebase_web_app.web.app_id, null)
    measurementId     = try(data.google_firebase_web_app_config.web.measurement_id, null)
  }
  sensitive = true
}

output "export_service_account_email" {
  description = "Email of the Firestore export service account"
  value       = google_service_account.exporter.email
}

output "export_service_account_key_json" {
  description = "Service account key JSON for export script"
  value       = base64decode(google_service_account_key.exporter.private_key)
  sensitive   = true
}


