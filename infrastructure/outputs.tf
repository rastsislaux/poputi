output "project_id" {
  description = "The Google Cloud project ID"
  value       = var.project_id
}

output "firestore_database_name" {
  description = "The Firestore database name"
  value       = module.firestore.database_name
}

output "firestore_location" {
  description = "The Firestore database location"
  value       = module.firestore.location_id
}

output "firebase_web_config" {
  description = "Firebase Web App config for frontend"
  value       = module.firebase.firebase_web_config
  sensitive = true
}

output "export_service_account_email" {
  description = "Email of the Firestore export service account"
  value       = module.iam.export_service_account_email
}

output "export_service_account_key_json" {
  description = "Service account key JSON for export script"
  value       = module.iam.export_service_account_key_json
  sensitive   = true
}


