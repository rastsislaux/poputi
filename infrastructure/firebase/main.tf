variable "project_id" { type = string }
variable "region" { type = string }

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

data "google_project" "current" {}

resource "google_project_service" "firebaseapi" {
  project = var.project_id
  service = "firebase.googleapis.com"
}

resource "google_project_service" "firebaserules" {
  project = var.project_id
  service = "firebaserules.googleapis.com"
}

resource "google_firebase_project" "this" {
  provider = google-beta
  project  = var.project_id
  depends_on = [google_project_service.firebaseapi]
}

resource "google_firebaserules_ruleset" "firestore" {
  provider = google-beta
  project  = var.project_id
  source {
    files {
      name    = "firestore.rules"
      content = file("${path.module}/firestore.rules")
    }
  }
  depends_on = [google_firebase_project.this, google_project_service.firebaserules]
}

resource "google_firebaserules_release" "firestore" {
  provider     = google-beta
  project      = var.project_id
  name         = "cloud.firestore"
  ruleset_name = google_firebaserules_ruleset.firestore.name
  depends_on   = [google_firebase_project.this, google_project_service.firebaserules]
}

resource "google_firebase_web_app" "web" {
  provider     = google-beta
  project      = var.project_id
  display_name = "Poputi Web"
  depends_on   = [google_firebase_project.this]
}

data "google_firebase_web_app_config" "web" {
  provider   = google-beta
  web_app_id = google_firebase_web_app.web.app_id
}

output "firebase_web_config" {
  value = {
    apiKey            = try(data.google_firebase_web_app_config.web.api_key, null)
    authDomain        = try(data.google_firebase_web_app_config.web.auth_domain, null)
    projectId         = var.project_id
    storageBucket     = try(data.google_firebase_web_app_config.web.storage_bucket, null)
    messagingSenderId = try(data.google_firebase_web_app_config.web.messaging_sender_id, null)
    appId             = try(google_firebase_web_app.web.app_id, null)
    measurementId     = try(data.google_firebase_web_app_config.web.measurement_id, null)
  }
}


