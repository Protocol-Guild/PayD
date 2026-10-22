# PayD Kubernetes Manifests

Kustomize-based manifests for deploying PayD to a Kubernetes cluster.

## Directory Structure

```
k8s/base/
├── kustomization.yaml          # Resource list and common labels
├── backend-deployment.yaml     # Backend API deployment (2 replicas)
├── backend-service.yaml        # Backend ClusterIP service
├── backend-configmap.yaml      # Non-sensitive backend config
├── secret-store.yaml           # External Secrets Operator SecretStore (AWS SM)
├── external-secret.yaml        # ExternalSecret → payd-backend-secrets
├── backend-hpa.yaml            # Horizontal Pod Autoscaler
├── frontend-deployment.yaml    # Frontend deployment (2 replicas)
├── frontend-service.yaml       # Frontend ClusterIP service
├── frontend-configmap.yaml     # Frontend runtime config
└── ingress.yaml                # nginx ingress with TLS

k8s/examples/
└── backend-secret.example.yaml # Local/dev reference only — never apply with real values
```

## Secrets Management

**No plaintext Kubernetes Secret is applied from `k8s/base/`.** Production uses
the External Secrets Operator (`secret-store.yaml` + `external-secret.yaml`) so
the `payd-backend-secrets` Secret is created only when AWS Secrets Manager is
reachable. If the store or remote keys are missing, the ExternalSecret stays
unready. On first deployment, pods that require `payd-backend-secrets` cannot
start until that Secret is created.

The backend Deployment also requires the specific `JWT_REFRESH_SECRET` key.
This prevents a Secret created by an older manifest, without that key, from
starting new containers with the backend's development refresh-signing default.
Kubernetes [requires a referenced key in a non-optional Secret](https://kubernetes.io/docs/concepts/configuration/secret/#optional-secrets)
before the container can start. Provision the refresh key before applying this
Deployment update.

`kubectl apply -k k8s/base/` requires the ESO CRDs and a configured AWS
SecretStore. For local clusters without ESO, create a Secret with Method 1 and
apply the non-ESO manifests separately; do not apply the example with live values
or commit generated credentials.

### Why this matters

The `STELLAR_SECRET_KEY` field holds a Stellar private key that controls funds on
the network. A leaked key means immediate, irreversible loss of assets. The other
fields (database credentials, JWT signing key, API keys) are equally sensitive.
Committing any of them to git — even briefly — means they live in the repository
history forever unless every clone is force-purged.

### Method 1: `kubectl create secret` (simplest, no extra tooling)

Create the secret imperatively from environment variables or a local file so that
no real value ever touches a tracked file:

```bash
# From environment variables (recommended for CI)
: "${JWT_REFRESH_SECRET:?Set JWT_REFRESH_SECRET before creating the backend Secret}"
kubectl create secret generic payd-backend-secrets \
  --namespace payd \
  --from-literal=DATABASE_URL="$DATABASE_URL" \
  --from-literal=DB_USER="$DB_USER" \
  --from-literal=DB_PASSWORD="$DB_PASSWORD" \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --from-literal=JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET" \
  --from-literal=STELLAR_SECRET_KEY="$STELLAR_SECRET_KEY" \
  --from-literal=ANCHOR_API_KEY="$ANCHOR_API_KEY" \
  --from-literal=SDS_API_KEY="$SDS_API_KEY" \
  --dry-run=client -o yaml | kubectl apply -f -
```

For a local cluster without ESO, apply the non-ESO manifests (the base also
contains `SecretStore` and `ExternalSecret` resources that need ESO installed):

```bash
kubectl -n payd apply -f k8s/base/backend-configmap.yaml \
  -f k8s/base/backend-deployment.yaml -f k8s/base/backend-service.yaml \
  -f k8s/base/backend-hpa.yaml -f k8s/base/frontend-configmap.yaml \
  -f k8s/base/frontend-deployment.yaml -f k8s/base/frontend-service.yaml \
  -f k8s/base/ingress.yaml
```

### Method 2: Helm `--set` (if using the Helm chart)

```bash
helm install payd charts/payd \
  --namespace payd --create-namespace \
  --set backend.secrets.DATABASE_URL="$DATABASE_URL" \
  --set backend.secrets.DB_PASSWORD="$DB_PASSWORD" \
  --set backend.secrets.JWT_SECRET="$JWT_SECRET" \
  --set backend.secrets.STELLAR_SECRET_KEY="$STELLAR_SECRET_KEY" \
  --set backend.secrets.ANCHOR_API_KEY="$ANCHOR_API_KEY" \
  --set backend.secrets.SDS_API_KEY="$SDS_API_KEY"
```

### Method 3: External Secrets Operator (recommended for production)

See [External Secrets Operator](#external-secrets-operator) below.

### Method 4: CI-injected secrets

In GitHub Actions or similar CI, store secrets in the CI provider's secret store
and inject them at deploy time:

```yaml
# In your deploy step
- name: Deploy to Kubernetes
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    JWT_SECRET: ${{ secrets.JWT_SECRET }}
    JWT_REFRESH_SECRET: ${{ secrets.JWT_REFRESH_SECRET }}
    STELLAR_SECRET_KEY: ${{ secrets.STELLAR_SECRET_KEY }}
    ANCHOR_API_KEY: ${{ secrets.ANCHOR_API_KEY }}
    SDS_API_KEY: ${{ secrets.SDS_API_KEY }}
  run: |
    : "${JWT_REFRESH_SECRET:?Configure the JWT_REFRESH_SECRET deployment secret}"
    kubectl create secret generic payd-backend-secrets \
      --namespace payd \
      --from-literal=DATABASE_URL="$DATABASE_URL" \
      --from-literal=DB_USER="payd_user" \
      --from-literal=DB_PASSWORD="$DB_PASSWORD" \
      --from-literal=JWT_SECRET="$JWT_SECRET" \
      --from-literal=JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET" \
      --from-literal=STELLAR_SECRET_KEY="$STELLAR_SECRET_KEY" \
      --from-literal=ANCHOR_API_KEY="$ANCHOR_API_KEY" \
      --from-literal=SDS_API_KEY="$SDS_API_KEY" \
      --dry-run=client -o yaml | kubectl apply -f -
```

## External Secrets Operator

For production clusters, the [External Secrets Operator (ESO)](https://external-secrets.io/)
syncs Kubernetes Secrets from an external provider (AWS Secrets Manager, HashiCorp
Vault, GCP Secret Manager, Azure Key Vault, etc.) so that no secret value is ever
stored in the git repository — not even as a placeholder that invites hand-editing.

### Why ESO over Sealed Secrets

| Criterion | External Secrets Operator | Sealed Secrets |
|---|---|---|
| Secret source | External provider (AWS SM, Vault, etc.) | Encrypted blob committed to git |
| Key rotation | Automatic via provider | Requires re-encryption with `kubeseal` |
| Access control | IAM/policies at the provider layer | Cluster-scoped sealing key |
| Audit trail | Provider-native (CloudTrail, Vault audit) | Only K8s audit logs |
| Fits existing infra | Yes — PayD already uses AWS Secrets Manager (see `infrastructure/terraform/modules/secrets/`) | Requires new Sealed Secrets controller |
| Secret updates | Automatic sync on provider change | Manual re-seal + commit |

ESO is the better fit because PayD's Terraform stack already provisions secrets in
AWS Secrets Manager. ESO bridges that into Kubernetes without introducing a second
secret store.

### Quick start (AWS Secrets Manager)

1. Install ESO in the cluster:

```bash
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets \
  --namespace external-secrets --create-namespace
```

2. Create `payd` namespace and the `external-secrets-sa` service account there.
   Grant that account IAM read access to the remote keys and configure its IRSA
   role annotation for your cluster. The namespaced `SecretStore` references
   that service account; installing the ESO controller in its own namespace does
   not create this account for PayD.

3. Provision the remote values. Terraform's secrets module creates
   `payd-production/db-credentials` as JSON with `username` and `password`,
   plus raw-string `payd-production/jwt-secret` and (when configured)
   `payd-production/stellar-credentials`. Provision these additional raw-string
   values in AWS Secrets Manager before deploying the backend:

   - `payd-production/database-url`: complete Postgres connection URL
   - `payd-production/jwt-refresh-secret`: independent refresh-token signing key
   - `payd-production/anchor-api-key`: anchor API key
   - `payd-production/sds-api-key`: SDS API key

   Their names and formats must match `k8s/base/external-secret.yaml`. Missing
   values leave the ExternalSecret unready and prevent initial Secret creation.
   The Terraform module does not create the refresh-token key; provision it
   separately and include it in the service account's IAM read permissions.
   Use a generated secret value, not the backend's development default or the
   example manifest's `REPLACE_AT_APPLY_TIME` marker.

4. Apply the namespaced `SecretStore` and `ExternalSecret` from `k8s/base/`:

```yaml
# k8s/base/secret-store.yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secrets-manager
  labels:
    app: payd
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets-sa
```

   `kubectl -n payd apply -k k8s/base/` includes both resources. Before routing traffic,
   inspect `kubectl -n payd get externalsecret payd-backend-secrets` and confirm
   Ready=True. Do not put remote values in a tracked YAML file.

   Existing containers retain the environment they started with. Roll out the
   backend after the Secret is updated so it uses the new refresh-signing key;
   rotating this key invalidates refresh tokens signed with the previous key.

## Pre-commit Safety Check

A pre-commit hook (`scripts/check-k8s-secrets.sh`) rejects plaintext Secret
manifests under `k8s/base/`. It runs through Husky and in CI.

To run it manually:

```bash
./scripts/check-k8s-secrets.sh
```

## Deploying

See [docs/deployment.md](../docs/deployment.md) for full deployment instructions.
