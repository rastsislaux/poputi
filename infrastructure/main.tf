module "firestore" {
  source      = "./firestore"
  project_id  = var.project_id
  region      = var.region
  database_id = var.database_id
}

module "firebase" {
  source     = "./firebase"
  project_id = var.project_id
  region     = var.region
}

module "iam" {
  source     = "./iam"
  project_id = var.project_id
}

# ---- State moves to avoid recreation after refactor ----
# Firestore
moved {
  from = google_project_service.firestore
  to   = module.firestore.google_project_service.firestore
}

moved {
  from = google_firestore_database.this
  to   = module.firestore.google_firestore_database.this
}

# Firebase
moved {
  from = google_project_service.firebaseapi
  to   = module.firebase.google_project_service.firebaseapi
}

moved {
  from = google_project_service.firebaserules
  to   = module.firebase.google_project_service.firebaserules
}

moved {
  from = google_firebase_project.this
  to   = module.firebase.google_firebase_project.this
}

moved {
  from = google_firebaserules_ruleset.firestore
  to   = module.firebase.google_firebaserules_ruleset.firestore
}

moved {
  from = google_firebaserules_release.firestore
  to   = module.firebase.google_firebaserules_release.firestore
}

moved {
  from = google_firebase_web_app.web
  to   = module.firebase.google_firebase_web_app.web
}

# IAM exporter
moved {
  from = google_service_account.exporter
  to   = module.iam.google_service_account.exporter
}

moved {
  from = google_project_iam_member.exporter_firestore_viewer
  to   = module.iam.google_project_iam_member.exporter_firestore_viewer
}

moved {
  from = google_service_account_key.exporter
  to   = module.iam.google_service_account_key.exporter
}


