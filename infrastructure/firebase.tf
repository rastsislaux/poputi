# Enable Firebase on the GCP project, deploy Firestore security rules, and configure a Web App

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

# Link the GCP project to Firebase (free)
resource "google_firebase_project" "this" {
  provider = google-beta
  project  = var.project_id
  depends_on = [
    google_project_service.firebaseapi,
  ]
}

# Firestore security rules: allow public create to survey, deny reads/updates/deletes
resource "google_firebaserules_ruleset" "firestore" {
  provider = google-beta
  project  = var.project_id
  source {
    files {
      name    = "firestore.rules"
      content = file("${path.module}/firestore.rules")
    }
  }

  depends_on = [
    google_firebase_project.this,
    google_project_service.firebaserules,
  ]
}

resource "google_firebaserules_release" "firestore" {
  provider     = google-beta
  project      = var.project_id
  name         = "cloud.firestore"
  ruleset_name = google_firebaserules_ruleset.firestore.name
  depends_on = [
    google_firebase_project.this,
    google_project_service.firebaserules,
    google_project_service.firestore
  ]
}

# Register a Firebase Web App to obtain client config for frontend
resource "google_firebase_web_app" "web" {
  provider     = google-beta
  project      = var.project_id
  display_name = "Poputi Web"

  depends_on = [
    google_firebase_project.this,
  ]
}

data "google_firebase_web_app_config" "web" {
  provider   = google-beta
  web_app_id = google_firebase_web_app.web.app_id
}


