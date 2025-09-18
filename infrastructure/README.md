# Google Cloud Firestore via Terraform

This directory provisions a Firestore database (Native mode) in a Google Cloud project using Terraform. Firestore has a generous free tier; no extra configuration is required to use it.

## Prerequisites

- OpenTofu >= 1.6
- A Google Cloud project with billing enabled
- A service account with permissions (recommended minimal):
  - Service Usage Admin (`roles/serviceusage.serviceUsageAdmin`) – to enable APIs
  - Firestore Admin (`roles/datastore.owner`) – to create/manage Firestore
  - Alternatively, `roles/editor` works for bootstrap
- Service account key JSON for local use, or GitHub Actions secret for CI

## Layout

- Root:
  - `versions.tf`, `variables.tf`, `main.tf`, `outputs.tf`
- Modules by service:
  - `firestore/`: database provisioning
  - `firebase/`: Firebase linkage, Firestore rules, Web App config
  - `iam/`: exporter service account and IAM bindings

## Usage (local)

1. Authenticate with Google Cloud using a service account key or ADC:

   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/sa-key.json
   ```

2. Set variables (or pass with `-var`):

   ```bash
   export TF_VAR_project_id="your-gcp-project-id"
   export TF_VAR_region="us-central1"  # or your preferred region
   # Optional (default is (default))
   export TF_VAR_database_id="(default)"
   ```

3. Optional: configure remote backend (recommended for teams). Create a GCS bucket once (free tier covers storage for small state files):

   ```bash
   export TF_STATE_BUCKET="your-unique-tf-state-bucket-name"
   gsutil mb -p "$TF_VAR_project_id" -l "$TF_VAR_region" "gs://$TF_STATE_BUCKET"
   gsutil uniformbucketlevelaccess set on "gs://$TF_STATE_BUCKET"
   gsutil versioning set on "gs://$TF_STATE_BUCKET"
   ```

   Then initialize with backend config:

   ```bash
   tofu init \
     -backend-config="bucket=$TF_STATE_BUCKET" \
     -backend-config="prefix=terraform/state"
   ```

4. Initialize and apply:

   ```bash
   tofu init
   tofu plan
   tofu apply -auto-approve
   ```

5. Destroy (if needed):

   ```bash
   tofu destroy -auto-approve
   ```

### Notes

- The default database id is `"(default)"`. Most projects only use this database.
- `region` sets the Firestore location (e.g., `us-central1`, `europe-west2`). Choose once carefully; changing requires recreation.
- Consider configuring a remote state backend (e.g., Google Cloud Storage) for teams.

## Firestore rules

Rules in `firebase/firestore.rules` are deployed and configured to:

- Allow anyone to create docs in `survey` collection (public write for submissions)
- Deny reads/updates/deletes from the web (read happens via privileged access only)

This keeps the web app simple and in free tier. If you need private reads, use the Admin SDK server-side or export via CLI.

## Frontend Firebase config

OpenTofu outputs a Firebase Web App config as a sensitive output. Retrieve it after apply:

```bash
tofu output -json firebase_web_config | jq .
```

Populate a small JS config file under `survey/web/firebase-config.js` with that object, e.g.:

```js
window.POPUTI_FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

Then the frontend can initialize Firebase using this global variable without bundlers.

### Wire into the web app

1. Create the config file:

   ```js
   // survey/web/firebase-config.js (do NOT commit sensitive keys publicly if you prefer)
   window.POPUTI_FIREBASE_CONFIG = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "..."
   };
   ```

2. Open `survey/web/index.html` and ensure Firebase scripts and this config are included before `app.js`.

3. The web app writes submissions to Firestore collection `survey`. Rules allow only `create`; reads/updates/deletes are blocked from clients.

## CI/CD with GitHub Actions

This repository includes a workflow that applies Terraform automatically when files in `infrastructure/` change. Configure repository secrets:

- `GOOGLE_CREDENTIALS`: contents of your service account JSON key
- `GCP_PROJECT_ID`: your Google Cloud project id
- `GCS_TF_STATE_BUCKET`: GCS bucket name for Terraform state (must be globally unique)

The workflow will:

- Authenticate to Google Cloud using the secret
- Create the state bucket if it doesn't exist (with uniform access + versioning)
- Run `terraform init` with GCS backend and `terraform apply` in `infrastructure/`


