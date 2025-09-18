variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "database_id" {
  type    = string
  default = "(default)"
}

resource "google_project_service" "firestore" {
  project = var.project_id
  service = "firestore.googleapis.com"
}

resource "google_firestore_database" "this" {
  project          = var.project_id
  name             = var.database_id
  location_id      = var.region
  type             = "FIRESTORE_NATIVE"
  concurrency_mode = "OPTIMISTIC"

  depends_on = [google_project_service.firestore]
}

output "database_name" {
  value = google_firestore_database.this.name
}

output "location_id" {
  value = google_firestore_database.this.location_id
}


