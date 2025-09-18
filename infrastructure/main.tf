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


