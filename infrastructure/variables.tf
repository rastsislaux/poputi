variable "project_id" {
  description = "The ID of the Google Cloud project"
  type        = string
}

variable "region" {
  description = "The region for the Firestore database"
  type        = string
  default     = "us-central1"
}

variable "database_id" {
  description = "The Firestore database id. Use \"(default)\" for the default database."
  type        = string
  default     = "(default)"
}

variable "tf_state_bucket" {
  description = "Name of the GCS bucket to store Terraform remote state"
  type        = string
}

variable "tf_state_prefix" {
  description = "Prefix (folder path) inside the bucket for Terraform state"
  type        = string
  default     = "terraform/state"
}


